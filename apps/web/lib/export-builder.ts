/**
 * Builds an AleppoExportV1 JSON object from a user's library.
 */

import { db } from "@/db";
import { recipes, cookLogs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AleppoExportV1, AleppoExportRecipe, AleppoExportCookLog } from "@aleppo/shared";

export async function buildExport(
  userId: string,
  opts: { includeCookLogs?: boolean; includeImages?: boolean } = {}
): Promise<AleppoExportV1> {
  const { includeCookLogs = true, includeImages = false } = opts;

  // Fetch user info
  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Fetch all recipes
  const allRecipes = await db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, userId));

  // Build export recipes
  const exportRecipes: AleppoExportRecipe[] = await Promise.all(
    allRecipes.map(async (r) => {
      let imageData: string | null = null;
      if (includeImages && r.imageUrl) {
        try {
          const res = await fetch(r.imageUrl);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            imageData = buf.toString("base64");
          }
        } catch {
          // Skip image on failure — keep imageUrl as fallback
        }
      }

      return {
        _exportId: r.id,
        title: r.title,
        description: r.description ?? null,
        sourceUrl: r.sourceUrl ?? null,
        sourceName: r.sourceName ?? null,
        imageUrl: r.imageUrl ?? null,
        imageData,
        ingredients: r.ingredients ?? [],
        instructions: r.instructions ?? [],
        tags: r.tags ?? [],
        isPublic: r.isPublic,
        isAdapted: r.isAdapted,
        notes: r.notes ?? null,
        prepTime: r.prepTime ?? null,
        cookTime: r.cookTime ?? null,
        servings: r.servings ?? null,
        nutritionalInfo: r.nutritionalInfo ?? null,
        commentsUrl: r.commentsUrl ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    })
  );

  // Fetch cook logs if requested
  let exportCookLogs: AleppoExportCookLog[] = [];
  if (includeCookLogs) {
    const logs = await db
      .select()
      .from(cookLogs)
      .where(eq(cookLogs.userId, userId));

    exportCookLogs = logs.map((l) => ({
      _recipeExportId: l.recipeId,
      cookedOn: l.cookedOn,
      notes: l.notes ?? null,
      rating: l.rating ?? null,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: "aleppo",
    user: { name: user?.name ?? null, email: user?.email ?? "" },
    recipes: exportRecipes,
    cookLogs: exportCookLogs,
  };
}
