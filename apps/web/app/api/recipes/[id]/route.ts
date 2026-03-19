import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { parseIngredients } from "@/lib/parse-ingredients";
import { deleteR2ByUrl } from "@/lib/r2";
import type { RecipeImage } from "@aleppo/shared";

const imageSchema = z.object({
  url: z.string(),
  role: z.enum(["thumbnail", "banner", "both"]).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional().nullable(),
  sourceUrl: z.string().url().optional().or(z.literal("")).nullable(),
  sourceName: z.string().max(200).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  images: z.array(imageSchema).max(10).optional(),
  ingredients: z.array(z.object({ raw: z.string() })).optional(),
  instructions: z
    .array(z.object({ step: z.number(), text: z.string() }))
    .optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  isAdapted: z.boolean().optional(),
  notes: z.string().max(5000).optional().nullable(),
  prepTime: z.number().int().positive().optional().nullable(),
  cookTime: z.number().int().positive().optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  servingName: z.string().max(100).optional().nullable(),
  commentsUrl: z.string().url().optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await safeAuth();

  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, id))
    .limit(1);

  if (!recipe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the owner or public recipes are accessible
  if (!recipe.isPublic && recipe.userId !== session?.user?.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(recipe);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const ingredients = parsed.data.ingredients
    ? parseIngredients(parsed.data.ingredients.map((i) => i.raw))
    : undefined;

  // If images or imageUrl is changing, fetch old images so we can clean up R2
  let removedUrls: string[] = [];
  const updateFields: Record<string, unknown> = {
    ...parsed.data,
    ...(ingredients && { ingredients }),
    updatedAt: new Date(),
  };

  if (parsed.data.images) {
    const [existing] = await db
      .select({ images: recipes.images, imageUrl: recipes.imageUrl })
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .limit(1);
    if (existing) {
      const oldUrls = new Set((existing.images ?? []).map((i: RecipeImage) => i.url));
      const newUrls = new Set(parsed.data.images.map((i) => i.url));
      removedUrls = [...oldUrls].filter((u) => !newUrls.has(u));
    }
    // Derive imageUrl from new images
    const newImages = parsed.data.images;
    updateFields.imageUrl = newImages.find((i) => i.role === "banner" || i.role === "both")?.url
      ?? newImages[0]?.url ?? null;
  } else if ("imageUrl" in parsed.data) {
    const [existing] = await db
      .select({ imageUrl: recipes.imageUrl })
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .limit(1);
    if (existing?.imageUrl && existing.imageUrl !== parsed.data.imageUrl) {
      removedUrls = [existing.imageUrl];
    }
  }

  const [updated] = await db
    .update(recipes)
    .set(updateFields)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clean up removed images from R2 (fire-and-forget)
  for (const url of removedUrls) {
    deleteR2ByUrl(url).catch(() => {});
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [deleted] = await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
    .returning({ id: recipes.id, images: recipes.images, imageUrl: recipes.imageUrl });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clean up all images from R2 (fire-and-forget)
  const allUrls = (deleted.images ?? []).map((i: RecipeImage) => i.url);
  if (deleted.imageUrl && !allUrls.includes(deleted.imageUrl)) {
    allUrls.push(deleted.imageUrl);
  }
  for (const url of allUrls) {
    deleteR2ByUrl(url).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
