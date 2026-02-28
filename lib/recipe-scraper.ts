import { parse } from "node-html-parser";
import type { Ingredient, InstructionStep } from "@/db/schema";

export interface ScrapedRecipe {
  title?: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  imageUrl?: string;
  sourceName?: string;
  tags?: string[];
}

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
  // ISO 8601 duration: PT1H30M
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
    .map((raw) => {
      const cleaned = raw.trim().replace(/\s+/g, " ");
      // Basic amount/unit/name parsing
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
function findRecipeNode(node: any): ScrapedRecipe | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const r = findRecipeNode(item);
      if (r) return r;
    }
    return null;
  }
  const direct = extractFromJsonLd(node);
  if (direct) return direct;
  if (node["@graph"]) {
    const r = findRecipeNode(node["@graph"]);
    if (r) return r;
  }
  if (node["mainEntity"]) {
    const r = findRecipeNode(node["mainEntity"]);
    if (r) return r;
  }
  return null;
}

export function extractFromJsonLdArray(
  jsonLdData: object[],
  meta: { pageTitle?: string; ogImage?: string; siteName?: string } = {}
): ScrapedRecipe | null {
  const recipe = findRecipeNode(jsonLdData);
  if (!recipe) return null;
  return {
    ...recipe,
    sourceName: recipe.sourceName || meta.siteName,
    imageUrl: recipe.imageUrl || meta.ogImage || undefined,
  };
}

function extractFromJsonLd(jsonLd: object): ScrapedRecipe | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recipe: any = jsonLd;

  if (!isRecipeType(recipe["@type"])) {
    return null;
  }

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
      } else if (step["@type"] === "HowToSection" && Array.isArray(step.itemListElement)) {
        for (const subStep of step.itemListElement) {
          if (subStep.text) rawInstructions.push(decodeHtmlEntities(subStep.text));
        }
      }
    }
  }

  let imageUrl: string | undefined;
  if (typeof recipe.image === "string") {
    imageUrl = recipe.image;
  } else if (Array.isArray(recipe.image) && recipe.image.length > 0) {
    imageUrl = typeof recipe.image[0] === "string" ? recipe.image[0] : recipe.image[0]?.url;
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
    title: recipe.name ? decodeHtmlEntities(recipe.name) : undefined,
    description: recipe.description ? decodeHtmlEntities(recipe.description) : undefined,
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

export function scrapeRecipeFromHtml(
  html: string,
  url?: string
): { recipe: ScrapedRecipe | null; rawPayload: object; error?: string } {
  const root = parse(html);

  const jsonLdScripts = root.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  const jsonLdData: object[] = [];
  for (const script of jsonLdScripts) {
    try {
      jsonLdData.push(JSON.parse(script.text));
    } catch {
      // skip malformed
    }
  }

  const rawPageTitle =
    root.querySelector("title")?.text?.trim() ||
    root.querySelector('meta[property="og:title"]')?.getAttribute("content");
  const pageTitle = rawPageTitle ? decodeHtmlEntities(rawPageTitle) : undefined;
  const siteName = root
    .querySelector('meta[property="og:site_name"]')
    ?.getAttribute("content");
  const ogImage = root
    .querySelector('meta[property="og:image"]')
    ?.getAttribute("content");
  const description = root
    .querySelector('meta[property="og:description"]')
    ?.getAttribute("content");

  const rawPayload = { url, jsonLd: jsonLdData, pageTitle, siteName };

  const recipe = extractFromJsonLdArray(jsonLdData, { pageTitle, ogImage, siteName });
  if (recipe) {
    return { recipe, rawPayload };
  }

  return {
    recipe: {
      title: pageTitle,
      description: description || undefined,
      ingredients: [],
      instructions: [],
      imageUrl: ogImage || undefined,
      sourceName: siteName,
    },
    rawPayload,
    error: "Could not parse recipe structured data. Please fill in manually.",
  };
}

export async function scrapeRecipeFromUrl(url: string): Promise<{
  recipe: ScrapedRecipe | null;
  rawPayload: object;
  error?: string;
}> {
  let html: string;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const isCloudflareSite =
        response.headers.get("server")?.toLowerCase().includes("cloudflare") ||
        response.headers.get("cf-ray") !== null;

      return {
        recipe: null,
        rawPayload: { status: response.status, url, cloudflare: isCloudflareSite },
        error: response.status === 403
          ? "blocked"
          : `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    html = await response.text();
  } catch (err) {
    return {
      recipe: null,
      rawPayload: { url, error: String(err) },
      error: "Failed to fetch URL",
    };
  }

  return scrapeRecipeFromHtml(html, url);
}
