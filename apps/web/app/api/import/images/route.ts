import { NextResponse } from "next/server";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { uploadImageToR2 } from "@/lib/r2";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "lib/prompts");

function buildPrompt(inputText?: string): string {
  const prefix = fs.readFileSync(path.join(PROMPTS_DIR, "prefix.txt"), "utf-8");

  const shotFiles = fs
    .readdirSync(PROMPTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const shots = shotFiles
    .map((f) => {
      const content = fs.readFileSync(path.join(PROMPTS_DIR, f), "utf-8");
      return `---\nEXAMPLE:\n${content}`;
    })
    .join("\n");

  const instructions = fs.readFileSync(
    path.join(PROMPTS_DIR, "instructions.txt"),
    "utf-8"
  );

  const base = `${prefix}\n${shots}\n---\nRULES:\n0- Keep the recipe in its original language\n${instructions}\n---\n`;

  if (inputText) {
    return `${base}Process the following text and output the recipe JSON.\nTEXT: ${inputText}\nJSON:`;
  }
  return `${base}Process the provided images and output the recipe JSON.\nJSON:`;
}

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

  const formData = await req.formData();
  const imageEntries = formData.getAll("images");
  const inputText = formData.get("text");

  if (imageEntries.length === 0 && !inputText) {
    return NextResponse.json(
      { error: "Provide at least one image or a text field" },
      { status: 400 }
    );
  }

  const textInput = typeof inputText === "string" ? inputText : undefined;
  const prompt = buildPrompt(textInput);
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: prompt },
  ];

  let firstImageBuffer: Buffer | null = null;
  let firstImageMime = "image/jpeg";

  for (const entry of imageEntries) {
    if (!(entry instanceof File)) {
      return NextResponse.json(
        { error: "Invalid image entry" },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await entry.arrayBuffer());
    const mimeType = entry.type || "image/jpeg";
    if (!firstImageBuffer) {
      firstImageBuffer = buffer;
      firstImageMime = mimeType;
    }
    parts.push({ inlineData: { mimeType, data: buffer.toString("base64") } });
  }

  const client = new GoogleGenAI({ apiKey });
  const modelId = "gemini-3.1-flash-lite-preview";

  // Run Gemini and R2 upload in parallel
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
    console.log("[import/images] Gemini finish reason:", finishReason, "chars:", text.length);
    if (finishReason === "RECITATION") {
      throw new Error("RECITATION");
    }
    return text;
  })();

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

  let responseText: string;
  let uploadedImageUrl: string | null;
  try {
    [responseText, uploadedImageUrl] = await Promise.all([geminiPromise, imageUrlPromise]);
  } catch (err) {
    if (err instanceof Error && err.message === "RECITATION") {
      return NextResponse.json(
        { error: "The AI stopped because this recipe may be from a copyrighted source. Try importing it by URL instead, or enter it manually." },
        { status: 422 }
      );
    }
    throw err;
  }

  console.log("[import/images] Gemini raw response:\n", responseText);

  // Strip optional markdown code fences (```json ... ```)
  const cleaned = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return NextResponse.json({ error: `AI returned invalid JSON: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }

  if (typeof parsed.error === "string") {
    return NextResponse.json({ error: parsed.error }, { status: 422 });
  }

  // Pick only the fields that belong to ScrapedRecipe
  const recipe = {
    ...(typeof parsed.title === "string" && { title: parsed.title }),
    ...(typeof parsed.description === "string" && { description: parsed.description }),
    ...(Array.isArray(parsed.ingredients) && { ingredients: parsed.ingredients }),
    ...(Array.isArray(parsed.instructions) && { instructions: parsed.instructions }),
    ...(Array.isArray(parsed.tags) && { tags: parsed.tags }),
    ...(parsed.prepTime != null && { prepTime: Number(parsed.prepTime) }),
    ...(parsed.cookTime != null && { cookTime: Number(parsed.cookTime) }),
    ...(parsed.servings != null && { servings: Number(parsed.servings) }),
    ...(typeof parsed.sourceUrl === "string" && { sourceUrl: parsed.sourceUrl }),
    ...(typeof parsed.sourceName === "string" && { sourceName: parsed.sourceName }),
    ...(uploadedImageUrl
      ? { imageUrl: uploadedImageUrl }
      : typeof parsed.imageUrl === "string" && { imageUrl: parsed.imageUrl }),
  };

  return NextResponse.json({ recipe, generated: parsed.ai_generated === true });
}
