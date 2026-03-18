/**
 * Paprika .paprikarecipes import parser (server-only — uses Node.js zlib + AdmZip).
 *
 * File format: ZIP archive → entries are individual .paprikarecipe files
 * Each entry is gzip-compressed JSON.
 */

import * as zlib from "node:zlib";
import AdmZip from "adm-zip";
import { parseIngredients } from "@/lib/parse-ingredients";
import {
  parseTimeString,
  parseServingsNumber,
  parseDirections,
  uploadImportPhoto,
  mapConcurrent,
  type ImportPreviewItem,
} from "@/lib/import-utils";
import type { Ingredient, InstructionStep } from "@aleppo/shared";

// Re-export shared utils so existing import sites don't break
export { parseTimeString, mapConcurrent, uploadImportPhoto as uploadPaprikaPhoto };

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

export type PaprikaPreviewItem = ImportPreviewItem;

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

// ── Full recipe values for DB insert ─────────────────────────────────────────

export type PaprikaRecipeInsertValues = {
  userId: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  imageUrl: string | null;
  images: { url: string }[];
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
    images: imageUrl ? [{ url: imageUrl }] : [],
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
