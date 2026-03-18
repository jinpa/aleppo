/**
 * Parser for Mela .melarecipes export format.
 *
 * File format: plain ZIP archive (no gzip) → each entry is a JSON file
 * representing one recipe.
 */

import AdmZip from "adm-zip";
import { parseIngredients } from "@/lib/parse-ingredients";
import {
  parseTimeString,
  parseServingsNumber,
  parseDirections,
  uploadImportPhoto,
  type ImportPreviewItem,
} from "@/lib/import-utils";
import type { Ingredient, InstructionStep } from "@aleppo/shared";

// ── Raw JSON shape from Mela ─────────────────────────────────────────────────

export type MelaRecipeJson = {
  id?: string;
  title?: string;
  text?: string; // description
  ingredients?: string; // newline-separated
  instructions?: string; // newline-separated
  images?: string[]; // base64-encoded
  categories?: string[];
  cookTime?: string;
  prepTime?: string;
  yield?: string;
  link?: string;
  notes?: string;
};

// ── ZIP parsing ──────────────────────────────────────────────────────────────

export function parseZipBuffer(buffer: Buffer): MelaRecipeJson[] {
  const zip = new AdmZip(buffer);
  const recipes: MelaRecipeJson[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    try {
      const json = entry.getData().toString("utf8");
      const recipe = JSON.parse(json) as MelaRecipeJson;
      if (recipe.title) {
        recipes.push(recipe);
      }
    } catch {
      // Skip malformed entries
    }
  }

  return recipes;
}

// ── Preview ──────────────────────────────────────────────────────────────────

export function toPreviewItem(r: MelaRecipeJson): ImportPreviewItem {
  const ingredientLines = r.ingredients
    ? r.ingredients.split("\n").filter((l) => l.trim())
    : [];

  return {
    uid: r.id ?? r.title ?? crypto.randomUUID(),
    name: r.title ?? "Untitled",
    sourceUrl: r.link?.trim() || undefined,
    ingredientCount: ingredientLines.length,
    hasPhoto: Boolean(r.images?.length),
  };
}

// ── Full recipe values for DB insert ─────────────────────────────────────────

export type MelaRecipeInsertValues = {
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

export async function buildRecipeValues(
  r: MelaRecipeJson,
  userId: string,
  isPublic: boolean
): Promise<MelaRecipeInsertValues> {
  // Upload first image if present
  let imageUrl: string | null = null;
  if (r.images?.length) {
    imageUrl = await uploadImportPhoto(r.images[0], userId);
  }

  const ingredientLines = r.ingredients
    ? r.ingredients.split("\n").filter((l) => l.trim())
    : [];

  return {
    userId,
    title: (r.title ?? "Untitled").trim(),
    description: r.text?.trim() || null,
    sourceUrl: r.link?.trim() || null,
    sourceName: null,
    imageUrl,
    images: imageUrl ? [{ url: imageUrl }] : [],
    ingredients: parseIngredients(ingredientLines),
    instructions: parseDirections(r.instructions ?? ""),
    tags: r.categories?.filter(Boolean) ?? [],
    isPublic,
    notes: r.notes?.trim() || null,
    prepTime: parseTimeString(r.prepTime) ?? null,
    cookTime: parseTimeString(r.cookTime) ?? null,
    servings: parseServingsNumber(r.yield) ?? null,
  };
}
