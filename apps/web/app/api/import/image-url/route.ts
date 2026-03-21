import { NextResponse } from "next/server";

import { db } from "@/db";
import { recipeImports } from "@/db/schema";
import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { uploadImageToR2 } from "@/lib/r2";
import sharp from "sharp";
import { buildPrompt } from "@/lib/build-recipe-prompt";
import { callGemini, buildGeminiRecipe } from "@/lib/gemini-recipe";

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

  // Download the image
  let imageBuffer: Buffer;
  let mimeType: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "apinch/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }
    mimeType = res.headers.get("content-type") ?? "image/jpeg";
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json(
        { error: "URL does not point to an image" },
        { status: 400 }
      );
    }
    imageBuffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to download image: ${msg}` }, { status: 502 });
  }

  const prompt = buildPrompt({ language });
  const parts = [
    { text: prompt },
    { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
  ] as const;

  // Run Gemini and R2 upload in parallel
  const geminiPromise = callGemini(parts as any, "[import/image-url]");

  const imageUrlPromise = (async (): Promise<string | null> => {
    try {
      const processed = await sharp(imageBuffer)
        .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
        return `data:image/webp;base64,${processed.toString("base64")}`;
      }
      const key = `recipes/${userId}/${Date.now()}.webp`;
      return await uploadImageToR2(processed, key, "image/webp");
    } catch (err) {
      console.error("[import/image-url] R2 upload failed:", err);
      return null;
    }
  })();

  const [result, uploadedImageUrl] = await Promise.all([geminiPromise, imageUrlPromise]);

  const imageSourceType = result.ok
    ? (result.parsed.imageSourceType as string) ?? null
    : null;

  const logImport = (status: string, errorMessage?: string) =>
    db.insert(recipeImports).values({
      userId, importType: "image", sourceUrl: url, status, errorMessage,
      rawPayload: imageSourceType ? { imageSourceType } : undefined,
    }).catch((err) => console.error("[import/image-url] Failed to log import:", err));

  if (!result.ok) {
    await logImport("failed", result.error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { recipe, generated } = buildGeminiRecipe(result.parsed, {
    imageUrl: uploadedImageUrl,
    fallbackSourceUrl: url,
  });

  await logImport("parsed");
  return NextResponse.json({ recipe, generated });
}
