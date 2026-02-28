import Fraction from "fraction.js";
import type { Ingredient } from "@/db/schema";

// Maps Unicode vulgar fractions to their ASCII slash equivalents.
const UNICODE_FRACTION_MAP: Record<string, string> = {
  "\u00BC": "1/4",  // ¼
  "\u00BD": "1/2",  // ½
  "\u00BE": "3/4",  // ¾
  "\u2150": "1/7",  // ⅐
  "\u2151": "1/9",  // ⅑
  "\u2152": "1/10", // ⅒
  "\u2153": "1/3",  // ⅓
  "\u2154": "2/3",  // ⅔
  "\u2155": "1/5",  // ⅕
  "\u2156": "2/5",  // ⅖
  "\u2157": "3/5",  // ⅗
  "\u2158": "4/5",  // ⅘
  "\u2159": "1/6",  // ⅙
  "\u215A": "5/6",  // ⅚
  "\u215B": "1/8",  // ⅛
  "\u215C": "3/8",  // ⅜
  "\u215D": "5/8",  // ⅝
  "\u215E": "7/8",  // ⅞
};

/**
 * Converts Unicode vulgar fractions to ASCII form so downstream parsers can
 * handle them.  Mixed numbers like "1½" become "1 1/2"; standalone "½" → "1/2".
 */
function normalizeUnicodeFractions(str: string): string {
  return str.replace(/(\d*)([\u00BC-\u00BE\u2150-\u215E])/g, (_, whole, frac) => {
    const ascii = UNICODE_FRACTION_MAP[frac];
    if (!ascii) return _;
    return whole ? `${whole} ${ascii}` : ascii;
  });
}

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
      // The amount is already scaled above; scale any parentheticals embedded
      // in the name or notes (e.g. "finely grated Parmesan (about 1½ oz)").
      return scaleParentheticals(result, factor);
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
  // Normalize unicode fractions so the regex below can match leading "½ cup" etc.
  const normalized = normalizeUnicodeFractions(raw);
  // Order matters: try mixed number first before whole number eats the leading digit
  const match = normalized.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)(.*)/);
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
 * Scales measurable numbers inside parenthetical groups in `text`.
 * Leaves text outside parentheses untouched.
 *
 * Skips parentheticals that describe percentage ranges (contain "%" or "percent")
 * since those are descriptors, not quantities — e.g. "(15- to 20-percent fat)".
 *
 * Also handles Unicode fractions: "(about 1½ ounces)" at 2× → "(about 3 ounces)".
 *
 * "white sugar (1 cup; 205g)" at 2× → "white sugar (2 cup; 410g)"
 */
function scaleParentheticals(text: string, factor: number): string {
  return text.replace(/\(([^)]+)\)/g, (fullMatch, inner: string) => {
    // Percentage/ratio descriptors — never scale these numbers.
    if (/percent|%/i.test(inner)) return fullMatch;

    const scaledInner = inner.replace(
      /(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*[\u00BC-\u00BE\u2150-\u215E]?|[\u00BC-\u00BE\u2150-\u215E])/g,
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
 * Parses a string like "1/2", "2", "1 1/4", or "½" into a Fraction.
 * Returns null if the string can't be parsed as a positive number.
 */
function parseFractionString(str: string): Fraction | null {
  const s = normalizeUnicodeFractions(str.trim());

  // Mixed numbers: "1 1/2", "2 3/4", etc.
  const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const den = parseInt(mixedMatch[3]);
    if (den === 0) return null;
    return new Fraction(whole * den + num, den);
  }

  try {
    const f = new Fraction(s);
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
