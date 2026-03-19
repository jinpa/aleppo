import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { recipes } from "@/db/schema";

const PROMPTS_DIR = path.join(process.cwd(), "lib/prompts");

function buildModifyPrompt(recipeJson: string, userInstruction: string): string {
  const instructions = fs.readFileSync(
    path.join(PROMPTS_DIR, "instructions.txt"),
    "utf-8"
  );

  return `Here is a recipe in JSON format:
${recipeJson}

The user wants to modify this recipe. Their instruction: "${userInstruction}"

Output the modified recipe as JSON with the same structure. Keep the recipe in its original language. Only change what's necessary to fulfill the instruction. Preserve the original style and level of detail.

RULES for the output JSON format:
${instructions}

Output only the JSON object, no markdown fences or extra text.`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const body = await req.json();
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt is required" },
      { status: 400 }
    );
  }

  // Load recipe
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, id))
    .limit(1);

  if (!recipe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Visibility check: owned or public
  if (!recipe.isPublic && recipe.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build recipe JSON for the prompt (only relevant fields)
  const recipeForPrompt = {
    title: recipe.title,
    description: recipe.description,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    tags: recipe.tags,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    servings: recipe.servings,
  };

  const geminiPrompt = buildModifyPrompt(
    JSON.stringify(recipeForPrompt, null, 2),
    prompt
  );

  const client = new GoogleGenAI({ apiKey });
  const modelId = "gemini-3.1-flash-lite-preview";

  let responseText: string;
  try {
    const stream = await client.models.generateContentStream({
      model: modelId,
      contents: [{ role: "user", parts: [{ text: geminiPrompt }] }],
      config: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 8192 },
    });

    let text = "";
    let finishReason: string | undefined;
    for await (const chunk of stream) {
      if (chunk.text) text += chunk.text;
      const reason = chunk.candidates?.[0]?.finishReason;
      if (reason) finishReason = reason;
    }

    console.log("[recipes/modify] Gemini finish reason:", finishReason, "chars:", text.length);

    if (finishReason === "RECITATION") {
      return NextResponse.json(
        { error: "The AI stopped because this recipe may be from a copyrighted source. Try modifying it manually instead." },
        { status: 422 }
      );
    }

    responseText = text;
  } catch (err) {
    console.error("[recipes/modify] Gemini error:", err);
    return NextResponse.json(
      { error: "AI service error. Please try again." },
      { status: 502 }
    );
  }

  // Strip optional markdown code fences
  const cleaned = responseText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("[recipes/modify] Invalid JSON from Gemini:", cleaned);
    return NextResponse.json(
      { error: `AI returned invalid JSON: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  // Pick only recipe fields
  const modified = {
    ...(typeof parsed.title === "string" && { title: parsed.title }),
    ...(typeof parsed.description === "string" && { description: parsed.description }),
    ...(Array.isArray(parsed.ingredients) && { ingredients: parsed.ingredients }),
    ...(Array.isArray(parsed.instructions) && { instructions: parsed.instructions }),
    ...(Array.isArray(parsed.tags) && { tags: parsed.tags }),
    ...(parsed.prepTime != null && { prepTime: Number(parsed.prepTime) }),
    ...(parsed.cookTime != null && { cookTime: Number(parsed.cookTime) }),
    ...(parsed.servings != null && { servings: Number(parsed.servings) }),
  };

  return NextResponse.json({ recipe: modified });
}
