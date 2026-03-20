import { NextResponse } from "next/server";

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

  const formData = await req.formData();
  const imageEntries = formData.getAll("images");
  const inputText = formData.get("text");
  const language = formData.get("language");
  const ingredientInstructions = formData.get("ingredientInstructions") === "true";

  if (imageEntries.length === 0 && !inputText) {
    return NextResponse.json(
      { error: "Provide at least one image or a text field" },
      { status: 400 }
    );
  }

  const textInput = typeof inputText === "string" ? inputText : undefined;
  const targetLanguage = typeof language === "string" ? language : undefined;
  const prompt = buildPrompt({ inputText: textInput, language: targetLanguage, ingredientInstructions });
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: prompt },
  ];

  let firstImageBuffer: Buffer | null = null;

  for (const entry of imageEntries) {
    if (!(entry instanceof File)) {
      return NextResponse.json({ error: "Invalid image entry" }, { status: 400 });
    }
    const buffer = Buffer.from(await entry.arrayBuffer());
    const mimeType = entry.type || "image/jpeg";
    if (!firstImageBuffer) firstImageBuffer = buffer;
    parts.push({ inlineData: { mimeType, data: buffer.toString("base64") } });
  }

  // Run Gemini and R2 upload in parallel
  const geminiPromise = callGemini(parts as any, "[import/images]");

  const imageUrlPromise = (async (): Promise<string | null> => {
    if (!firstImageBuffer) return null;
    try {
      const processed = await sharp(firstImageBuffer)
        .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
        return `data:image/webp;base64,${processed.toString("base64")}`;
      }
      const key = `recipes/${userId}/${Date.now()}.webp`;
      return await uploadImageToR2(processed, key, "image/webp");
    } catch (err) {
      console.error("[import/images] R2 upload failed:", err);
      return null;
    }
  })();

  const [result, uploadedImageUrl] = await Promise.all([geminiPromise, imageUrlPromise]);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { recipe, generated } = buildGeminiRecipe(result.parsed, {
    imageUrl: uploadedImageUrl,
  });

  return NextResponse.json({ recipe, generated });
}
