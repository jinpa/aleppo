import { NextResponse } from "next/server";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { uploadImageToR2 } from "@/lib/r2";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import fs from "fs/promises";
import { formatIngredientDisplay } from "@aleppo/shared";
import { parseFractionString } from "@/lib/scale-ingredient";
import { buildPrompt } from "@/lib/build-recipe-prompt";
import { isVideoUrl, videoSourceName } from "@/lib/video-url";
import { downloadVideo, cleanupDownload, extractFrame, getVideoMeta, extractUrlsFromDescription, type DownloadResult } from "@/lib/video-downloader";
import { scrapeRecipeFromUrl } from "@/lib/recipe-scraper";

const MAX_DURATION_SECONDS = 300; // 5 minutes
const MAX_SIZE_MB = 50;

export async function POST(req: Request) {
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: { url?: string; language?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, language } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  if (!isVideoUrl(url)) {
    return NextResponse.json(
      { error: "URL is not a supported video platform (TikTok, Instagram Reels, YouTube)" },
      { status: 400 }
    );
  }

  // Step 1: Fetch metadata (lightweight, no download)
  const meta = await getVideoMeta(url);
  console.log("[import/video] Meta:", { duration: meta.duration, filesize: meta.filesize, uploader: meta.uploader });

  // Step 2: Check the description for recipe URLs (much faster than processing the video)
  const descriptionUrls = extractUrlsFromDescription(meta.description);
  console.log("[import/video] Description URLs:", descriptionUrls);
  for (const recipeUrl of descriptionUrls) {
    try {
      const result = await scrapeRecipeFromUrl(recipeUrl);
      if (result.recipe && result.recipe.title) {
        console.log("[import/video] Found recipe in description URL:", recipeUrl);
        return NextResponse.json({
          recipe: {
            ...result.recipe,
            sourceUrl: recipeUrl,
            sourceName: result.recipe.sourceName ?? ([meta.uploader, videoSourceName(url)].filter(Boolean).join(" on ") || "Source"),
          },
          generated: false,
        });
      }
    } catch {
      // This URL didn't work, try the next one
    }
  }

  // Step 3: Check duration/size limits before downloading
  if (meta.duration && meta.duration > MAX_DURATION_SECONDS) {
    return NextResponse.json(
      { error: `Video is too long (${Math.round(meta.duration / 60)} minutes). Maximum is ${MAX_DURATION_SECONDS / 60} minutes. If the video description has a recipe link, try importing that URL directly.` },
      { status: 400 }
    );
  }
  if (meta.filesize && meta.filesize > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Video is too large (${Math.round(meta.filesize / 1024 / 1024)}MB). Maximum is ${MAX_SIZE_MB}MB.` },
      { status: 400 }
    );
  }

  // Step 4: Download and process the video
  let download: DownloadResult;
  try {
    download = await downloadVideo(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[import/video] Download failed:", msg);
    return NextResponse.json({ error: `Failed to download video: ${msg}` }, { status: 502 });
  }

  try {
    const videoBuffer = await fs.readFile(download.videoPath);
    const prompt = buildPrompt({ language, mode: "video" });

    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
      { text: prompt },
      { inlineData: { mimeType: download.mimeType, data: videoBuffer.toString("base64") } },
    ];

    const client = new GoogleGenAI({ apiKey });
    const modelId = "gemini-3.1-flash-lite-preview";

    // Step 1: Run Gemini to get recipe + bestFrameTimestamp
    let responseText: string;
    try {
      const stream = await client.models.generateContentStream({
        model: modelId,
        contents: [{ role: "user", parts }],
        config: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 8192 },
      });
      let text = "";
      let finishReason: string | undefined;
      for await (const chunk of stream) {
        if (chunk.text) text += chunk.text;
        const reason = chunk.candidates?.[0]?.finishReason;
        if (reason) finishReason = reason;
      }
      console.log("[import/video] Gemini finish reason:", finishReason, "chars:", text.length);
      if (finishReason === "RECITATION") {
        return NextResponse.json(
          { error: "The AI stopped because this recipe may be from a copyrighted source. Try entering it manually." },
          { status: 422 }
        );
      }
      responseText = text;
    } catch (err) {
      console.error("[import/video] Gemini error:", err);
      throw err;
    }

    console.log("[import/video] Gemini raw response:\n", responseText);

    // Strip optional markdown code fences
    const cleaned = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return NextResponse.json(
        { error: `AI returned invalid JSON: ${e instanceof Error ? e.message : String(e)}` },
        { status: 502 }
      );
    }

    if (typeof parsed.error === "string") {
      return NextResponse.json({ error: parsed.error }, { status: 422 });
    }

    // Step 2: Extract frame at the AI-chosen timestamp and upload to R2
    const bestTimestamp = typeof parsed.bestFrameTimestamp === "number"
      ? parsed.bestFrameTimestamp
      : undefined;
    console.log("[import/video] bestFrameTimestamp:", bestTimestamp);

    let uploadedImageUrl: string | null = null;
    try {
      const framePath = await extractFrame(download.videoPath, bestTimestamp);
      if (framePath) {
        const thumbBuffer = await fs.readFile(framePath);
        const processed = await sharp(thumbBuffer)
          .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        await fs.unlink(framePath).catch(() => {});
        if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
          uploadedImageUrl = `data:image/webp;base64,${processed.toString("base64")}`;
        } else {
          const key = `recipes/${userId}/${Date.now()}.webp`;
          uploadedImageUrl = await uploadImageToR2(processed, key, "image/webp");
        }
      }
    } catch (err) {
      console.error("[import/video] Thumbnail extraction/upload failed:", err);
    }

    const ingredients = Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map((ing: Record<string, unknown>) => {
          const name = typeof ing.name === "string" ? ing.name : "";
          const unit = typeof ing.units === "string" ? ing.units : (typeof ing.unit === "string" ? ing.unit : undefined);
          const notes = typeof ing.notes === "string" ? ing.notes : undefined;

          let quantity = typeof ing.quantity === "number" ? ing.quantity : undefined;
          const amountStr = typeof ing.amount === "string" ? ing.amount : undefined;

          if (quantity === undefined && amountStr) {
            quantity = parseFractionString(amountStr)?.valueOf();
          }

          let raw = formatIngredientDisplay({ name, unit, quantity });
          if (notes) raw += ` (${notes})`;

          return {
            raw: raw || (typeof ing.raw === "string" ? ing.raw : ""),
            name,
            unit,
            amount: amountStr,
            quantity,
            notes,
          };
        })
      : undefined;

    const recipe = {
      ...(typeof parsed.title === "string" && { title: parsed.title }),
      ...(typeof parsed.description === "string" && { description: parsed.description }),
      ...(ingredients && { ingredients }),
      ...(Array.isArray(parsed.instructions) && { instructions: parsed.instructions }),
      ...(Array.isArray(parsed.tags) && { tags: parsed.tags }),
      ...(parsed.prepTime != null && { prepTime: Number(parsed.prepTime) }),
      ...(parsed.cookTime != null && { cookTime: Number(parsed.cookTime) }),
      ...(parsed.servings != null && { servings: Number(parsed.servings) }),
      ...(parsed.servingName != null && { servingName: parsed.servingName }),
      ...(typeof parsed.sourceUrl === "string" ? { sourceUrl: parsed.sourceUrl } : { sourceUrl: url }),
      sourceName: typeof parsed.sourceName === "string"
        ? parsed.sourceName
        : [meta.uploader, videoSourceName(url)].filter(Boolean).join(" on ") || "Source",
      ...(uploadedImageUrl
        ? { imageUrl: uploadedImageUrl }
        : typeof parsed.imageUrl === "string" && { imageUrl: parsed.imageUrl }),
    };

    return NextResponse.json({ recipe, generated: parsed.ai_generated === true });
  } finally {
    await cleanupDownload(download);
  }
}
