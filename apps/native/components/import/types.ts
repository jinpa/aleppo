import type { ScrapedRecipe } from "@aleppo/shared";

export type ImportOutcome =
  | { ok: true; recipe: ScrapedRecipe; parseError?: string; aiGenerated?: boolean }
  | { ok: false; error: string };
