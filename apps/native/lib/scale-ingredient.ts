import type { Ingredient } from "@aleppo/shared";

const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

// Common cooking fractions for rounding display values
const COOKING_FRACTIONS: [number, string][] = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [3 / 8, "3/8"],
  [1 / 2, "1/2"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [7 / 8, "7/8"],
];

function normalizeUnicodeFractions(s: string): string {
  return s.replace(
    /[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g,
    (c) => UNICODE_FRACTIONS[c] ?? c
  );
}

function parseFraction(s: string): number | null {
  const normalized = normalizeUnicodeFractions(s.trim());

  // Mixed number: "1 1/2"
  const mixed = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const w = parseInt(mixed[1]);
    const n = parseInt(mixed[2]);
    const d = parseInt(mixed[3]);
    return d === 0 ? null : w + n / d;
  }

  // Simple fraction: "1/2"
  const simple = normalized.match(/^(\d+)\/(\d+)$/);
  if (simple) {
    const n = parseInt(simple[1]);
    const d = parseInt(simple[2]);
    return d === 0 ? null : n / d;
  }

  // Decimal or integer
  const n = parseFloat(normalized);
  return isNaN(n) || n <= 0 ? null : n;
}

function formatCookingNumber(n: number): string {
  if (n <= 0) return "0";
  const whole = Math.floor(n);
  const frac = n - whole;

  if (frac < 0.05) return whole.toString();
  if (frac > 0.95) return (whole + 1).toString();

  let best = COOKING_FRACTIONS[0];
  for (const cf of COOKING_FRACTIONS) {
    if (Math.abs(cf[0] - frac) < Math.abs(best[0] - frac)) best = cf;
  }

  return whole > 0 ? `${whole} ${best[1]}` : best[1];
}

export function scaleIngredient(
  ing: Ingredient,
  factor: number
): string | null {
  if (factor === 1) return ing.raw;

  // Skip percentages and temperatures
  if (/[°%]|°[FCK]/.test(ing.raw)) return null;

  // Use parsed amount field if available
  if (ing.amount) {
    const parsed = parseFraction(ing.amount);
    if (parsed !== null) {
      const scaled = formatCookingNumber(parsed * factor);
      const rest = [ing.unit, ing.name, ing.notes]
        .filter(Boolean)
        .join(" ")
        .trim();
      return rest ? `${scaled} ${rest}` : scaled;
    }
  }

  // Fall back to regex scaling on the raw string
  const normalized = normalizeUnicodeFractions(ing.raw);

  // Pattern: optional whole number + optional fraction
  const pattern =
    /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/g;

  let scaled = normalized;
  let hasMatch = false;

  scaled = normalized.replace(pattern, (match) => {
    // Skip numbers that look like temperatures or step numbers at end of string
    const parsed = parseFraction(match);
    if (parsed === null) return match;
    hasMatch = true;
    return formatCookingNumber(parsed * factor);
  });

  return hasMatch ? scaled : null;
}
