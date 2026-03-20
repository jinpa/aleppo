import { GoogleGenAI } from "@google/genai";
import { formatIngredientDisplay } from "@aleppo/shared";
import { parseFractionString } from "@/lib/scale-ingredient";

export type GeminiPart =
  | { text: string; inlineData?: never }
  | { inlineData: { mimeType: string; data: string }; text?: never };

export type GeminiSuccess = { ok: true; parsed: Record<string, unknown> };
export type GeminiError = { ok: false; error: string; status: number };
export type GeminiResult = GeminiSuccess | GeminiError;

const MODEL_ID = "gemini-3.1-flash-lite-preview";
const RECITATION_ERROR =
  "The AI stopped because this recipe may be from a copyrighted source. Please try entering it manually.";

/**
 * Calls Gemini with the given parts, handles RECITATION, strips markdown
 * fences, parses JSON, and checks for an `{ error }` field in the response.
 *
 * Returns `{ ok: true, parsed }` on success, or `{ ok: false, error, status }`
 * for any handled failure. Unhandled Gemini errors are re-thrown.
 */
export async function callGemini(
  parts: GeminiPart[],
  logPrefix: string,
  options?: { recitationError?: string }
): Promise<GeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY not configured", status: 500 };
  }

  const client = new GoogleGenAI({ apiKey });

  let responseText: string;
  try {
    const stream = await client.models.generateContentStream({
      model: MODEL_ID,
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
    console.log(`${logPrefix} Gemini finish reason:`, finishReason, "chars:", text.length);
    if (finishReason === "RECITATION") {
      return {
        ok: false,
        error: options?.recitationError ?? RECITATION_ERROR,
        status: 422,
      };
    }
    responseText = text;
  } catch (err) {
    console.error(`${logPrefix} Gemini error:`, err);
    throw err;
  }

  console.log(`${logPrefix} Gemini raw response:\n`, responseText);

  const cleaned = responseText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return {
      ok: false,
      error: `AI returned invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      status: 502,
    };
  }

  if (typeof parsed.error === "string") {
    return { ok: false, error: parsed.error, status: 422 };
  }

  return { ok: true, parsed };
}

export type GeminiRecipeOverrides = {
  /** Uploaded image URL; takes priority over anything the AI returned. */
  imageUrl?: string | null;
  /** Used as sourceUrl if the AI didn't provide one. */
  fallbackSourceUrl?: string;
  /** If provided, always used as sourceName (overrides AI value). */
  sourceName?: string;
};

/**
 * Builds a ScrapedRecipe-shaped object from a parsed Gemini JSON response.
 * Per-route values (image URL, sourceUrl fallback, sourceName) are supplied
 * via `overrides`.
 */
export function buildGeminiRecipe(
  parsed: Record<string, unknown>,
  overrides: GeminiRecipeOverrides = {}
) {
  const ingredients = Array.isArray(parsed.ingredients)
    ? parsed.ingredients.map((ing: Record<string, unknown>) => {
        const name = typeof ing.name === "string" ? ing.name : "";
        const unit =
          typeof ing.units === "string"
            ? ing.units
            : typeof ing.unit === "string"
              ? ing.unit
              : undefined;
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

  const sourceUrl =
    typeof parsed.sourceUrl === "string"
      ? parsed.sourceUrl
      : overrides.fallbackSourceUrl;

  const sourceName =
    overrides.sourceName !== undefined
      ? overrides.sourceName
      : typeof parsed.sourceName === "string"
        ? parsed.sourceName
        : undefined;

  const imageUrl = overrides.imageUrl
    ? overrides.imageUrl
    : typeof parsed.imageUrl === "string"
      ? parsed.imageUrl
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
    ...(sourceUrl !== undefined && { sourceUrl }),
    ...(sourceName !== undefined && { sourceName }),
    ...(imageUrl !== undefined && { imageUrl }),
  };

  return { recipe, generated: parsed.ai_generated === true };
}
