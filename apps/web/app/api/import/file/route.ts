/**
 * POST /api/import/file
 *
 * Unified file import preview endpoint. Accepts .paprikarecipes, .melarecipes,
 * or .aleppo.json files. Auto-detects format, parses, runs duplicate detection,
 * and returns preview items.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseImportFile } from "@/lib/import-parser";
import type { ImportPreviewItem } from "@/lib/import-utils";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 100MB)" }, { status: 400 });
  }

  let result;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    result = parseImportFile(buffer, file.name);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not parse file." },
      { status: 400 }
    );
  }

  if (result.items.length === 0) {
    return NextResponse.json({ error: "No recipes found in the file." }, { status: 400 });
  }

  // Duplicate detection
  const existingRecipes = await db
    .select({ id: recipes.id, title: recipes.title, sourceUrl: recipes.sourceUrl })
    .from(recipes)
    .where(eq(recipes.userId, userId));

  const byTitle = new Map<string, { id: string; title: string }>();
  const byUrl = new Map<string, { id: string; title: string }>();
  for (const r of existingRecipes) {
    byTitle.set(r.title.toLowerCase().trim(), { id: r.id, title: r.title });
    if (r.sourceUrl) byUrl.set(r.sourceUrl.trim(), { id: r.id, title: r.title });
  }

  const previewItems: ImportPreviewItem[] = result.items.map((item) => {
    if (item.sourceUrl) {
      const urlMatch = byUrl.get(item.sourceUrl.trim());
      if (urlMatch) {
        return { ...item, isDuplicate: true, duplicateType: "url" as const, duplicateRecipeId: urlMatch.id, duplicateRecipeTitle: urlMatch.title };
      }
    }
    const titleMatch = byTitle.get(item.name.toLowerCase().trim());
    if (titleMatch) {
      return { ...item, isDuplicate: true, duplicateType: "title" as const, duplicateRecipeId: titleMatch.id, duplicateRecipeTitle: titleMatch.title };
    }
    return item;
  });

  return NextResponse.json({ format: result.format, recipes: previewItems });
}
