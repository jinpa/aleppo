/**
 * POST /api/import/paprika
 *
 * Accepts a .paprikarecipes file upload, parses all recipes, detects duplicates
 * against the user's existing library, and returns a preview list.
 * No recipes are saved — this is the read-only parse step.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  parseZipBuffer,
  toPreviewItem,
  type PaprikaPreviewItem,
} from "@/lib/paprika-parser";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 100MB)" },
      { status: 400 }
    );
  }

  // Parse the ZIP archive
  let paprikaRecipes;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    paprikaRecipes = parseZipBuffer(buffer);
  } catch {
    return NextResponse.json(
      { error: "Could not parse file. Make sure it's a valid .paprikarecipes export." },
      { status: 400 }
    );
  }

  if (paprikaRecipes.length === 0) {
    return NextResponse.json(
      { error: "No recipes found in the file." },
      { status: 400 }
    );
  }

  // Fetch user's existing recipes for duplicate detection
  const existingRecipes = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      sourceUrl: recipes.sourceUrl,
    })
    .from(recipes)
    .where(eq(recipes.userId, userId));

  // Build lookup maps: normalised title → id, sourceUrl → id
  const byTitle = new Map<string, { id: string; title: string }>();
  const byUrl = new Map<string, { id: string; title: string }>();

  for (const r of existingRecipes) {
    byTitle.set(r.title.toLowerCase().trim(), { id: r.id, title: r.title });
    if (r.sourceUrl) byUrl.set(r.sourceUrl.trim(), { id: r.id, title: r.title });
  }

  // Build preview items and annotate duplicates
  const previewItems: PaprikaPreviewItem[] = paprikaRecipes.map((r) => {
    const item = toPreviewItem(r);

    // URL match is the stronger signal
    if (item.sourceUrl) {
      const urlMatch = byUrl.get(item.sourceUrl.trim());
      if (urlMatch) {
        return {
          ...item,
          isDuplicate: true,
          duplicateType: "url" as const,
          duplicateRecipeId: urlMatch.id,
          duplicateRecipeTitle: urlMatch.title,
        };
      }
    }

    // Title match (weaker — could be a coincidence)
    const titleMatch = byTitle.get(item.name.toLowerCase().trim());
    if (titleMatch) {
      return {
        ...item,
        isDuplicate: true,
        duplicateType: "title" as const,
        duplicateRecipeId: titleMatch.id,
        duplicateRecipeTitle: titleMatch.title,
      };
    }

    return item;
  });

  return NextResponse.json({ recipes: previewItems });
}
