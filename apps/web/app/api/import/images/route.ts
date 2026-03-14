import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";
import { GoogleGenAI } from "@google/genai";
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
    return `${base}Extract the recipe from the following text\nTEXT: ${inputText}\nJSON:`;
  }
  return `${base}Extract the recipe from the provided images\nJSON:`;
}

export async function POST(req: Request) {
  const session = await auth();
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

  for (const entry of imageEntries) {
    if (!(entry instanceof File)) {
      return NextResponse.json(
        { error: "Invalid image entry" },
        { status: 400 }
      );
    }
    const buffer = await entry.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = entry.type || "image/jpeg";
    parts.push({ inlineData: { mimeType, data: base64 } });
  }

  const client = new GoogleGenAI({ apiKey });
  const modelId = "gemini-3.1-flash-lite-preview";

  // Stream response, accumulate text
  const stream = await client.models.generateContentStream({
    model: modelId,
    contents: [{ role: "user", parts }],
    config: { thinkingConfig: { thinkingBudget: 0 } },
  });

  let responseText = "";
  for await (const chunk of stream) {
    if (chunk.text) {
      responseText += chunk.text;
    }
  }

  console.log("[import/images] Gemini raw response:\n", responseText);

  // Strip optional markdown code fences (```json ... ```)
  const cleaned = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 502 });
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
    ...(typeof parsed.imageUrl === "string" && { imageUrl: parsed.imageUrl }),
  };

  return NextResponse.json({ recipe });
}
