/**
 * Parser for Aleppo's own .aleppo.json export format (re-import).
 */

import { uploadImportPhoto, type ImportPreviewItem } from "@/lib/import-utils";
import type {
  AleppoExportV1,
  AleppoExportRecipe,
  AleppoExportCookLog,
  Ingredient,
  InstructionStep,
  NutritionalInfo,
} from "@aleppo/shared";

// ── Validation ───────────────────────────────────────────────────────────────

export function parseAleppoJson(buffer: Buffer): AleppoExportV1 {
  const text = buffer.toString("utf8");
  const data = JSON.parse(text);

  if (data.version !== 1 || data.app !== "aleppo" || !Array.isArray(data.recipes)) {
    throw new Error("Invalid Aleppo export file");
  }

  return data as AleppoExportV1;
}

// ── Preview ──────────────────────────────────────────────────────────────────

export function toPreviewItem(r: AleppoExportRecipe): ImportPreviewItem {
  return {
    uid: r._exportId,
    name: r.title,
    sourceName: r.sourceName ?? undefined,
    sourceUrl: r.sourceUrl ?? undefined,
    ingredientCount: r.ingredients?.length ?? 0,
    hasPhoto: Boolean(r.imageData || r.imageUrl),
  };
}

// ── Recipe insert values ─────────────────────────────────────────────────────

export type AleppoRecipeInsertValues = {
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
  isAdapted: boolean;
  notes: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  nutritionalInfo: NutritionalInfo | null;
  commentsUrl: string | null;
};

export async function buildRecipeValues(
  r: AleppoExportRecipe,
  userId: string,
  isPublic: boolean
): Promise<AleppoRecipeInsertValues> {
  // If embedded image data, upload to R2; otherwise keep existing URL
  let imageUrl = r.imageUrl;
  if (r.imageData) {
    const uploaded = await uploadImportPhoto(r.imageData, userId);
    if (uploaded) imageUrl = uploaded;
  }

  return {
    userId,
    title: r.title,
    description: r.description,
    sourceUrl: r.sourceUrl,
    sourceName: r.sourceName,
    imageUrl,
    ingredients: r.ingredients ?? [],
    instructions: r.instructions ?? [],
    tags: r.tags ?? [],
    isPublic,
    isAdapted: r.isAdapted ?? false,
    notes: r.notes,
    prepTime: r.prepTime,
    cookTime: r.cookTime,
    servings: r.servings,
    nutritionalInfo: r.nutritionalInfo,
    commentsUrl: r.commentsUrl,
  };
}

// ── Cook log helpers ─────────────────────────────────────────────────────────

export function getCookLogs(data: AleppoExportV1): AleppoExportCookLog[] {
  return data.cookLogs ?? [];
}
