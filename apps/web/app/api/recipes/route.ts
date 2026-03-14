import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc, and, ilike, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { recipes } from "@/db/schema";
import { getUserFromBearerToken } from "@/lib/mobile-auth";
import { reuploadImageToR2 } from "@/lib/r2";

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  sourceUrl: z.string().url().optional().or(z.literal("")).nullable(),
  sourceName: z.string().max(200).optional().nullable(),
  imageUrl: z.string().optional(),
  ingredients: z
    .array(
      z.object({
        raw: z.string(),
        amount: z.string().optional(),
        unit: z.string().optional(),
        name: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .default([]),
  instructions: z
    .array(z.object({ step: z.number(), text: z.string() }))
    .default([]),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  notes: z.string().max(5000).optional().nullable(),
  prepTime: z.number().int().positive().optional().nullable(),
  cookTime: z.number().int().positive().optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  commentsUrl: z.string().url().optional().nullable(),
  isAdapted: z.boolean().default(false),
  forkedFromRecipeId: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  const userId =
    session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const tag = searchParams.get("tag");

  let query = db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, userId))
    .orderBy(desc(recipes.createdAt))
    .$dynamic();

  if (search) {
    query = query.where(
      and(
        eq(recipes.userId, userId),
        ilike(recipes.title, `%${search}%`)
      )
    );
  }

  if (tag) {
    query = query.where(
      and(
        eq(recipes.userId, userId),
        sql`${recipes.tags} @> ARRAY[${tag}]::text[]`
      )
    );
  }

  const result = await query;
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Validate forkedFromRecipeId if provided
  let forkedFromRecipeId: string | null = null;
  if (parsed.data.forkedFromRecipeId) {
    const [source] = await db
      .select({ id: recipes.id, isPublic: recipes.isPublic, userId: recipes.userId })
      .from(recipes)
      .where(eq(recipes.id, parsed.data.forkedFromRecipeId))
      .limit(1);
    if (!source || (!source.isPublic && source.userId !== userId)) {
      return NextResponse.json(
        { error: "Source recipe not found" },
        { status: 404 }
      );
    }
    forkedFromRecipeId = source.id;
  }

  let imageUrl = parsed.data.imageUrl;
  if (imageUrl) {
    imageUrl = await reuploadImageToR2(imageUrl, userId);
  }

  const [recipe] = await db
    .insert(recipes)
    .values({
      ...parsed.data,
      userId,
      imageUrl: imageUrl ?? null,
      sourceUrl: parsed.data.sourceUrl || null,
      sourceName: parsed.data.sourceName || null,
      prepTime: parsed.data.prepTime ?? null,
      cookTime: parsed.data.cookTime ?? null,
      servings: parsed.data.servings ?? null,
      commentsUrl: parsed.data.commentsUrl ?? null,
      isAdapted: parsed.data.isAdapted,
      forkedFromRecipeId,
    })
    .returning();

  return NextResponse.json(recipe, { status: 201 });
}
