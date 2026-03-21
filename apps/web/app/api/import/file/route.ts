/**
 * POST /api/import/file
 *
 * Unified file import preview endpoint. Accepts .paprikarecipes, .melarecipes,
 * or .aleppo.json files. Auto-detects format, parses, runs duplicate detection,
 * and returns preview items.
 */

import { NextResponse } from "next/server";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { recipes, recipeImports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseImportFile } from "@/lib/import-parser";
import type { ImportPreviewItem } from "@/lib/import-utils";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await safeAuth();
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

  const logImport = (format: string, status: string, count?: number, errorMessage?: string) =>
    db.insert(recipeImports).values({
      userId, importType: format, status, errorMessage,
      rawPayload: count != null ? { recipeCount: count } : undefined,
    }).catch((err) => console.error("[import/file] Failed to log import:", err));

  let result;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    result = parseImportFile(buffer, file.name);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not parse file.";
    await logImport("file", "failed", undefined, msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (result.items.length === 0) {
    await logImport(result.format, "failed", 0, "No recipes found in the file.");
    return NextResponse.json({ error: "No recipes found in the file." }, { status: 400 });
  }

  await logImport(result.format, "parsed", result.items.length);

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
