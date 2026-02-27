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

function extractFromJsonLd(jsonLd: object): ScrapedRecipe | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recipe: any = jsonLd;

  if (
    recipe["@type"] !== "Recipe" &&
    !Array.isArray(recipe["@type"]) &&
    !(Array.isArray(recipe["@type"]) && recipe["@type"].includes("Recipe"))
  ) {
    return null;
  }

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
      } else if (step["@type"] === "HowToSection" && Array.isArray(step.itemListElement)) {
        for (const subStep of step.itemListElement) {
          if (subStep.text) rawInstructions.push(subStep.text);
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
          "Mozilla/5.0 (compatible; AleppoBot/1.0; recipe importer)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return {
        recipe: null,
        rawPayload: { status: response.status, url },
        error: `HTTP ${response.status}: ${response.statusText}`,
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

  const root = parse(html);

  // Extract all JSON-LD scripts
  const jsonLdScripts = root.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  const jsonLdData: object[] = [];

  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.text);
      jsonLdData.push(data);
    } catch {
      // skip malformed
    }
  }

  // Extract page title and meta for fallback
  const pageTitle =
    root.querySelector("title")?.text?.trim() ||
    root.querySelector('meta[property="og:title"]')?.getAttribute("content");
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

  // Try to find a Recipe in JSON-LD
  for (const data of jsonLdData) {
    // Handle @graph
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = (data as any)["@graph"]
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data as any)["@graph"]
      : [data];

    for (const item of items) {
      const recipe = extractFromJsonLd(item);
      if (recipe) {
        return {
          recipe: {
            ...recipe,
            sourceName: recipe.sourceName || siteName,
            imageUrl: recipe.imageUrl || ogImage || undefined,
          },
          rawPayload,
        };
      }
    }
  }

  // Fallback: return partial data
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
