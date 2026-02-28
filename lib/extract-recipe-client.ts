/**
 * Client-safe JSON-LD recipe extraction — no Node.js-only imports.
 * Mirrors the logic in lib/recipe-scraper.ts but can run in the browser
 * (used by the bookmarklet postMessage receiver in import-flow.tsx).
 */

import type { ScrapedRecipe } from "@/lib/recipe-scraper";
import type { Ingredient, InstructionStep } from "@/db/schema";

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

function isRecipeType(type: unknown): boolean {
  if (typeof type === "string") return RECIPE_TYPES.has(type);
  if (Array.isArray(type)) return type.some((t) => RECIPE_TYPES.has(t));
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractOneJsonLd(recipe: any): ScrapedRecipe | null {
  if (!isRecipeType(recipe["@type"])) return null;

  const rawIngredients: string[] = Array.isArray(recipe.recipeIngredient)
    ? recipe.recipeIngredient
    : [];

  const rawInstructions: string[] = [];
  if (Array.isArray(recipe.recipeInstructions)) {
    for (const step of recipe.recipeInstructions) {
      if (typeof step === "string") {
        rawInstructions.push(step);
      } else if (step["@type"] === "HowToStep" && step.text) {
        rawInstructions.push(step.text);
      } else if (
        step["@type"] === "HowToSection" &&
        Array.isArray(step.itemListElement)
      ) {
        for (const sub of step.itemListElement) {
          if (sub.text) rawInstructions.push(sub.text);
        }
      }
    }
  }

  let imageUrl: string | undefined;
  if (typeof recipe.image === "string") {
    imageUrl = recipe.image;
  } else if (Array.isArray(recipe.image) && recipe.image.length > 0) {
    imageUrl =
      typeof recipe.image[0] === "string"
        ? recipe.image[0]
        : recipe.image[0]?.url;
  } else if (recipe.image?.url) {
    imageUrl = recipe.image.url;
  }

  const keywords: string[] = [];
  if (typeof recipe.keywords === "string") {
    keywords.push(...recipe.keywords.split(",").map((k: string) => k.trim()));
  } else if (Array.isArray(recipe.keywords)) {
    keywords.push(...recipe.keywords);
  }

  return {
    title: recipe.name || undefined,
    description: recipe.description || undefined,
    ingredients: parseIngredients(rawIngredients),
    instructions: parseInstructions(rawInstructions),
    prepTime: parseTimeToMinutes(recipe.prepTime),
    cookTime: parseTimeToMinutes(recipe.cookTime),
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
