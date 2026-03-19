import type { ScrapedRecipe } from "@aleppo/shared";

export type ImportOutcome =
  | { ok: true; recipe: ScrapedRecipe; parseError?: string; aiGenerated?: boolean; commentsUrl?: string }
  | { ok: false; error: string };
