import Fraction from "fraction.js";
import type { Ingredient } from "@/db/schema";

/**
 * Returns a display string for a scaled ingredient, or null if the ingredient
 * can't be scaled (no parseable leading number). Callers should fall back to
 * `ing.raw` when null is returned.
 *
 * Strategy:
 * 1. If the parsed `amount` field is populated, use it to reconstruct the full
 *    string from parsed parts (cleanest output).
 * 2. Otherwise, find and replace the leading number/fraction in `ing.raw`
 *    directly (handles most real-world cases where amount isn't parsed).
 */
export function scaleIngredient(
  ing: Ingredient,
  factor: number
): string | null {
  // Path 1: use stored parsed fields
  if (ing.amount?.trim()) {
    const parsed = parseFractionString(ing.amount.trim());
    if (parsed !== null) {
      const scaled = parsed.mul(new Fraction(factor));
      const formatted = formatFraction(scaled);

      const parts: string[] = [formatted];
      if (ing.unit) parts.push(ing.unit);
      if (ing.name) parts.push(ing.name);

      let result = parts.join(" ");
      if (ing.notes) result += `, ${ing.notes}`;
      return result;
    }
  }

  // Path 2: scale the leading number/fraction in the raw string
  return scaleRawString(ing.raw, factor);
}

/**
 * Finds and scales the leading numeric amount in a raw ingredient string,
 * and also scales any numbers inside parenthetical descriptions.
 * Returns null if no leading number is found.
 *
 * Examples at 2×:
 *   "1 1/2 cups flour"                          → "3 cups flour"
 *   "1/4 cup butter"                            → "1/2 cup butter"
 *   "2 large eggs"                              → "4 large eggs"
 *   "7 1/4 ounces white sugar (1 cup; 205g)"    → "14 1/2 ounces white sugar (2 cup; 410g)"
 *   "salt to taste"                             → null
 */
function scaleRawString(raw: string, factor: number): string | null {
  // Order matters: try mixed number first before whole number eats the leading digit
  const match = raw.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)(.*)/);
  if (!match) return null;

  const amountStr = match[1].trim();
  const rest = match[2];

  const parsed = parseFractionString(amountStr);
  if (!parsed) return null;

  const scaled = parsed.mul(new Fraction(factor));
  const formatted = formatFraction(scaled);

  return formatted + scaleParentheticals(rest, factor);
}

/**
 * Scales every number inside parenthetical groups in `text`.
 * Leaves text outside parentheses untouched.
 *
 * "white sugar (1 cup; 205g)" at 2× → "white sugar (2 cup; 410g)"
 */
function scaleParentheticals(text: string, factor: number): string {
  return text.replace(/\(([^)]+)\)/g, (_, inner: string) => {
    const scaledInner = inner.replace(
      /(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)/g,
      (num, _p1, offset: number, str: string) => {
        // Don't scale temperature values — e.g. 65°F, 18°C, 350°K
        if (/^\s*°[FCK]/i.test(str.slice(offset + num.length))) return num;
        const parsed = parseFractionString(num.trim());
        if (!parsed) return num;
        return formatFraction(parsed.mul(new Fraction(factor)));
      }
    );
    return `(${scaledInner})`;
  });
}

/**
 * Parses a string like "1/2", "2", "1 1/4" into a Fraction.
 * Returns null if the string can't be parsed as a positive number.
 */
function parseFractionString(str: string): Fraction | null {
  // Mixed numbers: "1 1/2", "2 3/4", etc.
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const den = parseInt(mixedMatch[3]);
    if (den === 0) return null;
    return new Fraction(whole * den + num, den);
  }

  try {
    const f = new Fraction(str);
    return f.valueOf() > 0 ? f : null;
  } catch {
    return null;
  }
}

/**
 * Formats a Fraction into a cooking-friendly string.
 * Whole numbers come back as integers ("2"), others as mixed fractions ("1 1/2").
 * Uses simplify(0.05) so that e.g. 0.666... rounds to "2/3".
 */
function formatFraction(frac: Fraction): string {
  const value = frac.valueOf();
  if (value <= 0) return "0";
  if (Number.isInteger(value)) return value.toString();

  try {
    return frac.simplify(0.05).toFraction(true);
  } catch {
    return parseFloat(value.toFixed(2)).toString();
  }
}
