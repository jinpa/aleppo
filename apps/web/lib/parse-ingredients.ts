/**
 * Shared ingredient parser — no Node.js-only imports, safe for client and server.
 * Used by lib/recipe-scraper.ts, lib/extract-recipe-client.ts, and lib/paprika-parser.ts.
 */

import type { Ingredient } from "@aleppo/shared";
import { parseFractionString } from "@/lib/scale-ingredient";

// Restricts the unit field to a known cooking vocabulary so we don't greedily
// capture adjectives as the unit (e.g. "tablespoon Dijon" or "cup extra").
// Multi-word units are listed first so they win the alternation.
export const INGREDIENT_RE = new RegExp(
  "^([\\d\\/\\.\\s\\u00BC-\\u00BE\\u2150-\\u215E]+)?\\s*" +
    "(?:(fluid\\s+ounces?|fl\\.?\\s*oz\\.?|tablespoons?|tbsps?|tbs|teaspoons?|tsps?|cups?|" +
    "ounces?|oz\\.?|pounds?|lbs?|grams?|kilograms?|kgs?|milligrams?|milliliters?|ml|liters?|" +
    "pints?|quarts?|gallons?|cloves?|slices?|pieces?|pcs|cans?|packages?|pkgs?|bunches?|" +
    "heads?|stalks?|sprigs?|dashes?|pinch(?:es)?|drops?|handfuls?|inches?|sticks?|bars?|" +
    "sheets?|envelopes?|pouches?|bags?|jars?|bottles?|loaves?|links?|strips?|fillets?)\\s+)?" +
    "(.+)?$",
  "i"
);

export function parseIngredients(raw: string[]): Ingredient[] {
  return raw
    .filter((s) => s.trim())
    .map((original) => {
      const cleaned = original.trim().replace(/\s+/g, " ");
      // Strip leading bullet/dash prefixes common in Paprika and copy-pasted lists
      const forParsing = cleaned.replace(/^[-–•*·]\s+/, "");
      const match = forParsing.match(INGREDIENT_RE);
      if (match) {
        const amount = match[1]?.trim() || undefined;
        const unit = match[2]?.trim() || undefined;
        const name = match[3]?.trim() || forParsing;
        const quantity = amount ? (parseFractionString(amount)?.valueOf() ?? undefined) : undefined;
        return { raw: cleaned, amount, quantity, unit, name };
      }
      return { raw: cleaned, name: cleaned };
    });
}
