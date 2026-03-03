/**
 * Test script: parse a .paprikarecipes file and evaluate ingredient parsing quality.
 * Usage: npx tsx scripts/test-paprika-ingredients.ts [path/to/file.paprikarecipes]
 */

import AdmZip from "adm-zip";
import * as zlib from "node:zlib";
import * as path from "node:path";

// ---- inline parseIngredients (keep in sync with lib/recipe-scraper.ts) ----
type Ingredient = {
  raw: string;
  amount?: string;
  unit?: string;
  name?: string;
  notes?: string;
};

const INGREDIENT_RE = new RegExp(
  "^([\\d\\/\\.\\s\\u00BC-\\u00BE\\u2150-\\u215E]+)?\\s*" +
    "(?:(fluid\\s+ounces?|fl\\.?\\s*oz\\.?|tablespoons?|tbsps?|tbs|teaspoons?|tsps?|cups?|" +
    "ounces?|oz\\.?|pounds?|lbs?|grams?|kilograms?|kgs?|milligrams?|milliliters?|ml|liters?|" +
    "pints?|quarts?|gallons?|cloves?|slices?|pieces?|pcs|cans?|packages?|pkgs?|bunches?|" +
    "heads?|stalks?|sprigs?|dashes?|pinch(?:es)?|drops?|handfuls?|inches?|sticks?|bars?|" +
    "sheets?|envelopes?|pouches?|bags?|jars?|bottles?|loaves?|links?|strips?|fillets?)\\s+)?" +
    "(.+)?$",
  "i"
);

function parseIngredients(raw: string[]): Ingredient[] {
  return raw
    .filter((s) => s.trim())
    .map((original) => {
      const cleaned = original.trim().replace(/\s+/g, " ");
      const forParsing = cleaned.replace(/^[-–•*·]\s+/, "");
      const match = forParsing.match(INGREDIENT_RE);
      if (match) {
        const amount = match[1]?.trim() || undefined;
        const unit = match[2]?.trim() || undefined;
        const name = match[3]?.trim() || forParsing;
        return { raw: cleaned, amount, unit, name };
      }
      return { raw: cleaned, name: cleaned };
    });
}
// --------------------------------------------------------------------

type PaprikaRecipeJson = {
  name: string;
  ingredients: string;
  directions: string;
  source_url?: string;
  source?: string;
  photo_data?: string;
  cook_time?: string;
  prep_time?: string;
  servings?: string;
  notes?: string;
  categories?: string[];
  rating?: number;
};

function parsePaprikaFile(filePath: string): PaprikaRecipeJson[] {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const recipes: PaprikaRecipeJson[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    try {
      const compressed = entry.getData();
      const json = zlib.gunzipSync(compressed).toString("utf8");
      const recipe = JSON.parse(json) as PaprikaRecipeJson;
      recipes.push(recipe);
    } catch (e) {
      console.warn(`  Skipping ${entry.entryName}: ${e}`);
    }
  }
  return recipes;
}

// ---- categorise a parsed ingredient result ----
type ParseQuality = "good" | "no-amount" | "suspicious-unit" | "fallback";

function classifyResult(raw: string, parsed: Ingredient): ParseQuality {
  if (!parsed.amount && !parsed.unit) return "no-amount";
  if (!parsed.amount && parsed.unit) return "suspicious-unit";
  if (parsed.name === parsed.raw) return "fallback";
  return "good";
}

// ---- main ----
const filePath =
  process.argv[2] ??
  path.join(process.cwd(), "scripts/test-data/PaprikaRecipes.paprikarecipes");

console.log(`\nParsing: ${filePath}\n`);
const recipes = parsePaprikaFile(filePath);
console.log(`Loaded ${recipes.length} recipes.\n`);

// Collect all unique ingredient strings across all recipes
const allRawIngredients = new Map<string, number>(); // raw -> count
for (const r of recipes) {
  if (!r.ingredients) continue;
  for (const line of r.ingredients.split("\n")) {
    const t = line.trim();
    if (t) allRawIngredients.set(t, (allRawIngredients.get(t) ?? 0) + 1);
  }
}
const uniqueLines = [...allRawIngredients.keys()];
console.log(`Total unique ingredient strings: ${uniqueLines.length}\n`);

// Run the parser
const parsed = parseIngredients(uniqueLines);

// Bucket by quality
const buckets: Record<ParseQuality, Ingredient[]> = {
  good: [],
  "no-amount": [],
  "suspicious-unit": [],
  fallback: [],
};
parsed.forEach((p, i) => {
  const q = classifyResult(uniqueLines[i], p);
  buckets[q].push(p);
});

const total = parsed.length;
const pct = (n: number) => ((n / total) * 100).toFixed(1);

console.log("=== Parse Quality Summary ===");
console.log(`  good              ${buckets.good.length.toString().padStart(5)}  (${pct(buckets.good.length)}%)`);
console.log(`  no-amount         ${buckets["no-amount"].length.toString().padStart(5)}  (${pct(buckets["no-amount"].length)}%) — e.g. "salt to taste"`);
console.log(`  suspicious-unit   ${buckets["suspicious-unit"].length.toString().padStart(5)}  (${pct(buckets["suspicious-unit"].length)}%) — amount missing, unit present`);
console.log(`  fallback (no match) ${buckets.fallback.length.toString().padStart(4)}  (${pct(buckets.fallback.length)}%)`);

// Print 20 samples from each bucket
function printSamples(label: string, items: Ingredient[], n = 20) {
  console.log(`\n--- ${label} (${items.length} total, showing ${Math.min(n, items.length)}) ---`);
  const samples = items.slice(0, n);
  for (const p of samples) {
    const parts = [
      p.amount ? `amount:"${p.amount}"` : "",
      p.unit   ? `unit:"${p.unit}"` : "",
      p.name   ? `name:"${p.name}"` : "",
    ].filter(Boolean).join("  ");
    console.log(`  raw: "${p.raw}"\n       → ${parts || "(no fields)"}\n`);
  }
}

printSamples("GOOD", buckets.good);
printSamples("NO-AMOUNT (qualitative ingredients)", buckets["no-amount"]);
printSamples("SUSPICIOUS-UNIT (likely misparsed)", buckets["suspicious-unit"]);
printSamples("FALLBACK (regex didn't match)", buckets.fallback);

// Also show stats on recipes
console.log("\n=== Recipe Field Coverage ===");
const withSourceUrl = recipes.filter(r => r.source_url?.trim()).length;
const withPhoto = recipes.filter(r => r.photo_data?.trim()).length;
const withNotes = recipes.filter(r => r.notes?.trim()).length;
const withCookTime = recipes.filter(r => r.cook_time?.trim()).length;
console.log(`  source_url present: ${withSourceUrl} / ${recipes.length} (${pct(withSourceUrl / recipes.length * total)}%)`);
console.log(`  photo_data present: ${withPhoto} / ${recipes.length}`);
console.log(`  notes present:      ${withNotes} / ${recipes.length}`);
console.log(`  cook_time present:  ${withCookTime} / ${recipes.length}`);

// Print a sample recipe's raw JSON fields (no photo_data)
const sample = recipes.find(r => r.source_url && r.ingredients);
if (sample) {
  const { photo_data: _, ...rest } = sample;
  console.log("\n=== Sample Recipe (first with source_url + ingredients) ===");
  console.log(JSON.stringify(rest, null, 2));
}
