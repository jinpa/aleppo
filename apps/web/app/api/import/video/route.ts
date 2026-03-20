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
import { downloadVideo, cleanupDownload, type DownloadResult } from "@/lib/video-downloader";

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
      { error: "URL is not a supported video platform (TikTok, Instagram Reels, YouTube Shorts)" },
      { status: 400 }
    );
  }

  // Download the video
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

    // Run Gemini and thumbnail upload in parallel
    const geminiPromise = (async () => {
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
        throw new Error("RECITATION");
      }
      return text;
    })();

    const imageUrlPromise = (async (): Promise<string | null> => {
      if (!download.thumbnailPath) return null;
      try {
        const thumbBuffer = await fs.readFile(download.thumbnailPath);
        const processed = await sharp(thumbBuffer)
          .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
          return `data:image/webp;base64,${processed.toString("base64")}`;
        }
        const key = `recipes/${userId}/${Date.now()}.webp`;
        return await uploadImageToR2(processed, key, "image/webp");
      } catch (err) {
        console.error("[import/video] Thumbnail upload failed:", err);
        return null;
      }
    })();

    let responseText: string;
    let uploadedImageUrl: string | null;
    try {
      [responseText, uploadedImageUrl] = await Promise.all([geminiPromise, imageUrlPromise]);
    } catch (err) {
      if (err instanceof Error && err.message === "RECITATION") {
        return NextResponse.json(
          { error: "The AI stopped because this recipe may be from a copyrighted source. Try entering it manually." },
          { status: 422 }
        );
      }
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

    const ingredients = Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map((ing: any) => {
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
        : [download.uploader, videoSourceName(url)].filter(Boolean).join(" on ") || "Source",
      ...(uploadedImageUrl
        ? { imageUrl: uploadedImageUrl }
        : typeof parsed.imageUrl === "string" && { imageUrl: parsed.imageUrl }),
    };

    return NextResponse.json({ recipe, generated: parsed.ai_generated === true });
  } finally {
    await cleanupDownload(download);
  }
}
