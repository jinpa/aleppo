import { NextResponse } from "next/server";

import { db } from "@/db";
import { recipeImports } from "@/db/schema";
import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { uploadImageToR2 } from "@/lib/r2";
import sharp from "sharp";
import fs from "fs/promises";
import { buildPrompt } from "@/lib/build-recipe-prompt";
import { isVideoUrl, isYouTubeUrl, videoSourceName } from "@/lib/video-url";
import { downloadVideo, cleanupDownload, extractFrame, getVideoMeta, extractUrlsFromDescription, fetchYouTubeDescription, type DownloadResult } from "@/lib/video-downloader";
import { callGemini, buildGeminiRecipe } from "@/lib/gemini-recipe";
import { scrapeRecipeFromUrl } from "@/lib/recipe-scraper";

const MAX_DURATION_SECONDS = 300; // 5 minutes
const MAX_SIZE_MB = 50;

export async function POST(req: Request) {
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const logImport = (status: string, errorMessage?: string) =>
    db.insert(recipeImports).values({
      userId, importType: "video", sourceUrl: url, status, errorMessage,
    }).catch((err) => console.error("[import/video] Failed to log import:", err));

  // YouTube: can't download video from server, but try to find recipe URLs in the description
  if (isYouTubeUrl(url)) {
    console.log("[import/video] YouTube URL detected, trying HTML scrape for description");
    const yt = await fetchYouTubeDescription(url);
    if (yt?.description) {
      const descriptionUrls = extractUrlsFromDescription(yt.description);
      console.log("[import/video] YouTube description URLs:", descriptionUrls);
      for (const recipeUrl of descriptionUrls) {
        try {
          const result = await scrapeRecipeFromUrl(recipeUrl);
          if (result.recipe && result.recipe.title) {
            console.log("[import/video] Found recipe in YouTube description URL:", recipeUrl);
            await logImport("parsed");
            return NextResponse.json({
              recipe: {
                ...result.recipe,
                sourceUrl: recipeUrl,
                sourceName: result.recipe.sourceName ?? ([yt.uploader, "YouTube"].filter(Boolean).join(" on ") || "Source"),
              },
              generated: false,
            });
          }
        } catch {
          // This URL didn't work, try the next one
        }
      }
    }
    await logImport("failed", "No recipe link found in YouTube description");
    return NextResponse.json(
      { error: "We couldn't find a recipe link in this YouTube video's description. Try copying the recipe URL from the video description and importing it directly." },
      { status: 404 }
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
        await logImport("parsed");
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
    // YouTube bot detection — show a user-friendly message
    if (/sign in to confirm you.re not a bot/i.test(msg)) {
      await logImport("failed", "YouTube bot detection");
      return NextResponse.json(
        { error: "YouTube blocks video downloads from our server. Try importing from TikTok or Instagram instead, or paste the recipe URL from the video description." },
        { status: 502 }
      );
    }
    await logImport("failed", msg.slice(0, 500));
    return NextResponse.json({ error: `Failed to download video: ${msg}` }, { status: 502 });
  }

  try {
    const videoBuffer = await fs.readFile(download.videoPath);
    const prompt = buildPrompt({ language, mode: "video" });
    const parts = [
      { text: prompt },
      { inlineData: { mimeType: download.mimeType, data: videoBuffer.toString("base64") } },
    ] as const;

    const result = await callGemini(parts as any, "[import/video]", {
      recitationError:
        "The AI stopped because this recipe may be from a copyrighted source. Try entering it manually.",
    });

    if (!result.ok) {
      await logImport("failed", result.error);
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Extract frame at the AI-chosen timestamp and upload to R2
    const bestTimestamp =
      typeof result.parsed.bestFrameTimestamp === "number"
        ? result.parsed.bestFrameTimestamp
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

    const sourceName =
      typeof result.parsed.sourceName === "string"
        ? result.parsed.sourceName
        : ([meta.uploader, videoSourceName(url)].filter(Boolean).join(" on ") || "Source");

    const { recipe, generated } = buildGeminiRecipe(result.parsed, {
      imageUrl: uploadedImageUrl,
      fallbackSourceUrl: url,
      sourceName,
    });

    await logImport("parsed");
    return NextResponse.json({ recipe, generated });
  } finally {
    await cleanupDownload(download);
  }
}
