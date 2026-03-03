/**
 * Paprika .paprikarecipes import parser (server-only — uses Node.js zlib + AdmZip).
 *
 * File format: ZIP archive → entries are individual .paprikarecipe files
 * Each entry is gzip-compressed JSON.
 */

import * as zlib from "node:zlib";
import AdmZip from "adm-zip";
import sharp from "sharp";
import { parseIngredients } from "@/lib/parse-ingredients";
import { uploadImageToR2 } from "@/lib/r2";
import type { Ingredient, InstructionStep } from "@/db/schema";

// ── Raw JSON shape from Paprika's export ─────────────────────────────────────

export type PaprikaRecipeJson = {
  uid: string;
  name: string;
  ingredients: string; // newline-separated list
  directions: string; // paragraphs separated by \n or \n\n
  source?: string; // human-readable source name
  source_url?: string;
  photo_data?: string; // base64-encoded JPEG
  photo_hash?: string;
  cook_time?: string; // e.g. "30 minutes", "1 hour"
  prep_time?: string;
  total_time?: string;
  servings?: string; // e.g. "4 servings", "Yield: 3/4 cup"
  notes?: string;
  categories?: string[];
  rating?: number; // 0–5
  created?: string; // "2023-06-16 22:15:05"
  nutritional_info?: string;
  description?: string;
};

// ── Public preview type (returned to the client) ─────────────────────────────

export type PaprikaPreviewItem = {
  uid: string;
  name: string;
  sourceName?: string;
  sourceUrl?: string;
  ingredientCount: number;
  hasPhoto: boolean;
  // Populated by the API route after duplicate detection
  isDuplicate?: boolean;
  duplicateType?: "url" | "title";
  duplicateRecipeId?: string;
  duplicateRecipeTitle?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a natural-language time string (e.g. "1 hour 30 minutes") into minutes. */
export function parseTimeString(s?: string): number | undefined {
  if (!s?.trim()) return undefined;
  let minutes = 0;
  const h = s.match(/(\d+(?:\.\d+)?)\s*h(?:our)?s?/i);
  if (h) minutes += parseFloat(h[1]) * 60;
  const m = s.match(/(\d+)\s*m(?:in(?:ute)?s?)?/i);
  if (m) minutes += parseInt(m[1], 10);
  return minutes > 0 ? Math.round(minutes) : undefined;
}

/** Extract the first integer from a free-form servings string. */
function parseServingsNumber(s?: string): number | undefined {
  if (!s?.trim()) return undefined;
  const match = s.match(/\b(\d+)\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

/** Convert Paprika's directions string into InstructionStep[]. */
function parseDirections(raw: string): InstructionStep[] {
  // Try double-newline split first (paragraph style); fall back to single newline.
  const blocks = raw.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const lines = blocks.length > 1 ? blocks : raw.split("\n").map((b) => b.trim()).filter(Boolean);
  return lines.map((text, i) => ({ step: i + 1, text }));
}

// ── Core ZIP parsing ─────────────────────────────────────────────────────────

/** Parse a .paprikarecipes buffer into an array of raw JSON objects. */
export function parseZipBuffer(buffer: Buffer): PaprikaRecipeJson[] {
  const zip = new AdmZip(buffer);
  const recipes: PaprikaRecipeJson[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    try {
      const compressed = entry.getData();
      const json = zlib.gunzipSync(compressed).toString("utf8");
      const recipe = JSON.parse(json) as PaprikaRecipeJson;
      if (recipe.uid && recipe.name) {
        recipes.push(recipe);
      }
    } catch {
      // Silently skip malformed entries; they'll be absent from the result.
    }
  }

  return recipes;
}

/** Convert a raw Paprika JSON record into a preview item (no photo processing). */
export function toPreviewItem(r: PaprikaRecipeJson): PaprikaPreviewItem {
  const ingredientLines = r.ingredients
    ? r.ingredients.split("\n").filter((l) => l.trim())
    : [];

  return {
    uid: r.uid,
    name: r.name,
    sourceName: r.source?.trim() || undefined,
    sourceUrl: r.source_url?.trim() || undefined,
    ingredientCount: ingredientLines.length,
    hasPhoto: Boolean(r.photo_data?.trim()),
  };
}

// ── Image upload ─────────────────────────────────────────────────────────────

/** Upload a Paprika base64 JPEG photo to R2. Returns the public URL or null. */
export async function uploadPaprikaPhoto(
  photoDataB64: string,
  userId: string
): Promise<string | null> {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
    return null; // R2 not configured (local dev) — skip image rather than store a broken placeholder
  }
  try {
    const raw = Buffer.from(photoDataB64, "base64");
    const processed = await sharp(raw)
      .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const key = `recipes/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
    return await uploadImageToR2(processed, key, "image/webp");
  } catch {
    return null;
  }
}

// ── Full recipe values for DB insert ─────────────────────────────────────────

export type PaprikaRecipeInsertValues = {
  userId: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  imageUrl: string | null;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  tags: string[];
  isPublic: boolean;
  notes: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
};

/**
 * Convert a raw Paprika record into DB insert values, uploading the photo if present.
 * Pass `imageUrl` pre-computed if you've already uploaded (or skipped) the photo.
 */
export function buildRecipeValues(
  r: PaprikaRecipeJson,
  userId: string,
  isPublic: boolean,
  imageUrl: string | null
): PaprikaRecipeInsertValues {
  const ingredientLines = r.ingredients
    ? r.ingredients.split("\n").filter((l) => l.trim())
    : [];

  const cookMinutes =
    parseTimeString(r.cook_time) ??
    (r.total_time && !r.prep_time ? parseTimeString(r.total_time) : undefined);

  return {
    userId,
    title: r.name.trim(),
    description: r.description?.trim() || null,
    sourceUrl: r.source_url?.trim() || null,
    sourceName: r.source?.trim() || null,
    imageUrl,
    ingredients: parseIngredients(ingredientLines),
    instructions: parseDirections(r.directions ?? ""),
    tags: r.categories?.filter(Boolean) ?? [],
    isPublic,
    notes: r.notes?.trim() || null,
    prepTime: parseTimeString(r.prep_time) ?? null,
    cookTime: cookMinutes ?? null,
    servings: parseServingsNumber(r.servings) ?? null,
  };
}

// ── Concurrency utility ───────────────────────────────────────────────────────

/** Run async tasks with a maximum concurrency. */
export async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runWorker)
  );
  return results;
}
