/**
 * Shared utilities for recipe file import parsers.
 *
 * Extracted from paprika-parser.ts so Mela, Aleppo JSON, and future parsers
 * can reuse the same helpers.
 */

import sharp from "sharp";
import { uploadImageToR2 } from "@/lib/r2";
import type { InstructionStep } from "@aleppo/shared";

// ── Time / servings parsing ──────────────────────────────────────────────────

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
export function parseServingsNumber(s?: string): number | undefined {
  if (!s?.trim()) return undefined;
  const match = s.match(/\b(\d+)\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

// ── Directions parsing ───────────────────────────────────────────────────────

/** Convert a directions/instructions string into InstructionStep[]. */
export function parseDirections(raw: string): InstructionStep[] {
  const blocks = raw
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const lines =
    blocks.length > 1
      ? blocks
      : raw
          .split("\n")
          .map((b) => b.trim())
          .filter(Boolean);
  return lines.map((text, i) => ({ step: i + 1, text }));
}

// ── Image upload ─────────────────────────────────────────────────────────────

/** Upload a base64-encoded photo to R2. Returns the public URL or null. */
export async function uploadImportPhoto(
  photoDataB64: string,
  userId: string
): Promise<string | null> {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
    return null;
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

// ── Concurrency utility ──────────────────────────────────────────────────────

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

// ── Unified preview type ─────────────────────────────────────────────────────

export type ImportPreviewItem = {
  uid: string;
  name: string;
  sourceName?: string;
  sourceUrl?: string;
  ingredientCount: number;
  hasPhoto: boolean;
  isDuplicate?: boolean;
  duplicateType?: "url" | "title";
  duplicateRecipeId?: string;
  duplicateRecipeTitle?: string;
};
