/**
 * Client-safe JSON-LD recipe extraction — no Node.js-only imports.
 * Mirrors the logic in lib/recipe-scraper.ts but can run in the browser
 * (used by the bookmarklet postMessage receiver in import-flow.tsx).
 */

import type { ScrapedRecipe } from "@/lib/recipe-scraper";
import type { Ingredient, InstructionStep } from "@/db/schema";

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function parseTimeToMinutes(time: string | undefined): number | undefined {
  if (!time) return undefined;
  const match = time.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return undefined;
  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const total = hours * 60 + minutes;
  return total > 0 ? total : undefined;
}

function parseIngredients(raw: string[]): Ingredient[] {
  return raw
    .filter((s) => s.trim())
    .map((r) => {
      const cleaned = r.trim().replace(/\s+/g, " ");
      const match = cleaned.match(
        /^([\d\/\.\s\u00BC-\u00BE\u2150-\u215E]+)?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)?\s+(.+)?$/
      );
      if (match) {
        return {
          raw: cleaned,
          amount: match[1]?.trim() || undefined,
          unit: match[2]?.trim() || undefined,
          name: match[3]?.trim() || cleaned,
        };
      }
      return { raw: cleaned, name: cleaned };
    });
}

function parseInstructions(raw: string[]): InstructionStep[] {
  return raw
    .filter((s) => s.trim())
    .map((text, i) => ({ step: i + 1, text: text.trim() }));
}

const RECIPE_TYPES = new Set([
  "Recipe",
  "https://schema.org/Recipe",
  "http://schema.org/Recipe",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickBestImage(images: any[]): string | undefined {
  // Sites like AllRecipes / Serious Eats provide 3 crops: [1:1, 4:3, 16:9].
  // We prefer the widest aspect ratio for the banner display on the recipe page.
  // Falls back to the last entry when no dimension metadata is available.
  let bestUrl: string | undefined;
  let bestRatio = -1;
  let hasAnyDimensions = false;

  for (const img of images) {
    const url = typeof img === "string" ? img : img?.url;
    if (!url) continue;

    const w = Number(img?.width);
    const h = Number(img?.height);
    const hasDimensions = w > 0 && h > 0;

    if (hasDimensions) {
      hasAnyDimensions = true;
      const ratio = w / h;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestUrl = url;
      }
    } else if (!hasAnyDimensions) {
      bestUrl = url;
    }
  }

  return bestUrl;
}

function isRecipeType(type: unknown): boolean {
  if (typeof type === "string") return RECIPE_TYPES.has(type);
  if (Array.isArray(type)) return type.some((t) => RECIPE_TYPES.has(t));
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractOneJsonLd(recipe: any): ScrapedRecipe | null {
  if (!isRecipeType(recipe["@type"])) return null;

  const rawIngredients: string[] = (
    Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : []
  ).map((s: string) => decodeHtmlEntities(s));

  const rawInstructions: string[] = [];
  if (Array.isArray(recipe.recipeInstructions)) {
    for (const step of recipe.recipeInstructions) {
      if (typeof step === "string") {
        rawInstructions.push(decodeHtmlEntities(step));
      } else if (step["@type"] === "HowToStep" && step.text) {
        rawInstructions.push(decodeHtmlEntities(step.text));
      } else if (
        step["@type"] === "HowToSection" &&
        Array.isArray(step.itemListElement)
      ) {
        for (const sub of step.itemListElement) {
          if (sub.text) rawInstructions.push(decodeHtmlEntities(sub.text));
        }
      }
    }
  }

  let imageUrl: string | undefined;
  if (typeof recipe.image === "string") {
    imageUrl = recipe.image;
  } else if (Array.isArray(recipe.image) && recipe.image.length > 0) {
    imageUrl = pickBestImage(recipe.image);
  } else if (recipe.image?.url) {
    imageUrl = recipe.image.url;
  }

  const keywords: string[] = [];
  if (typeof recipe.keywords === "string") {
    keywords.push(...recipe.keywords.split(",").map((k: string) => k.trim()));
  } else if (Array.isArray(recipe.keywords)) {
    keywords.push(...recipe.keywords);
  }

  const prepTime = parseTimeToMinutes(recipe.prepTime);
  const cookTime = parseTimeToMinutes(recipe.cookTime);
  const totalTime = parseTimeToMinutes(recipe.totalTime);

  return {
    title: recipe.name ? decodeHtmlEntities(recipe.name) : undefined,
    description: recipe.description ? decodeHtmlEntities(recipe.description) : undefined,
    ingredients: parseIngredients(rawIngredients),
    instructions: parseInstructions(rawInstructions),
    prepTime,
    cookTime: cookTime ?? (!prepTime && totalTime ? totalTime : undefined),
    servings:
      typeof recipe.recipeYield === "number"
        ? recipe.recipeYield
        : typeof recipe.recipeYield === "string"
        ? parseInt(recipe.recipeYield, 10) || undefined
        : undefined,
    imageUrl,
    tags: keywords.filter(Boolean),
  };
}

/**
 * Recursively search a JSON-LD node (or array of nodes) for a Recipe.
 * Handles: plain object, JSON array at top level, @graph, mainEntity.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findRecipeNode(node: any): ScrapedRecipe | null {
  if (!node || typeof node !== "object") return null;

  // Unwrap JSON arrays (some sites emit the script content as a JSON array)
  if (Array.isArray(node)) {
    for (const item of node) {
      const r = findRecipeNode(item);
      if (r) return r;
    }
    return null;
  }

  // This node itself is a Recipe
  const direct = extractOneJsonLd(node);
  if (direct) return direct;

  // Search @graph children
  if (node["@graph"]) {
    const r = findRecipeNode(node["@graph"]);
    if (r) return r;
  }

  // Search mainEntity (WebPage wrapping a Recipe)
  if (node["mainEntity"]) {
    const r = findRecipeNode(node["mainEntity"]);
    if (r) return r;
  }

  return null;
}

export function extractRecipeFromJsonLd(
  jsonLdData: object[],
  meta: { pageTitle?: string; ogImage?: string; siteName?: string } = {}
): ScrapedRecipe | null {
  // jsonLdData is an array of parsed script-tag contents (each may itself be
  // an array or object). Pass the whole array to the recursive finder.
  const recipe = findRecipeNode(jsonLdData);
  if (!recipe) return null;
  return {
    ...recipe,
    sourceName: recipe.sourceName || meta.siteName,
    imageUrl: recipe.imageUrl || meta.ogImage || undefined,
  };
}
