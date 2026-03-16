import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc, asc, and, sql } from "drizzle-orm";

import { db } from "@/db";
import { recipes } from "@/db/schema";
import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { reuploadImageToR2 } from "@/lib/r2";
import { parseIngredients } from "@/lib/parse-ingredients";

const SORT_KEYS = ["date", "title", "cooks", "lastCooked", "updated", "totalTime"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  date: "desc",
  title: "asc",
  cooks: "desc",
  lastCooked: "desc",
  updated: "desc",
  totalTime: "asc",
};

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  sourceUrl: z.string().url().optional().or(z.literal("")).nullable(),
  sourceName: z.string().max(200).optional().nullable(),
  imageUrl: z.string().optional(),
  ingredients: z.array(z.object({ raw: z.string() })).default([]),
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
  const session = await safeAuth();
  const userId =
    session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const tag = searchParams.get("tag");
  const sortParam = searchParams.get("sort") as SortKey | null;
  const sortKey: SortKey | null = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : null;
  const dirParam = searchParams.get("dir");
  const dir: "asc" | "desc" =
    dirParam === "asc" || dirParam === "desc"
      ? dirParam
      : sortKey
        ? DEFAULT_DIR[sortKey]
        : "desc";

  const conditions = [eq(recipes.userId, userId)];

  if (search) {
    conditions.push(
      sql`"search_tsv" @@ websearch_to_tsquery('english', ${search})`
    );
  }

  if (tag) {
    conditions.push(
      sql`${recipes.tags} @> ARRAY[${tag}]::text[]`
    );
  }

  const dirFn = dir === "asc" ? asc : desc;

  const listColumns = {
    id: recipes.id,
    title: recipes.title,
    description: recipes.description,
    imageUrl: recipes.imageUrl,
    tags: recipes.tags,
    prepTime: recipes.prepTime,
    cookTime: recipes.cookTime,
    sourceName: recipes.sourceName,
  };

  const listColumnsSql = `"recipes"."id", "recipes"."title", "recipes"."description", "recipes"."imageUrl", "recipes"."tags", "recipes"."prepTime", "recipes"."cookTime", "recipes"."sourceName"`;

  // Default to relevance when searching without explicit sort
  if (!sortKey && search) {
    const result = await db
      .select(listColumns)
      .from(recipes)
      .where(and(...conditions))
      .orderBy(sql`ts_rank("search_tsv", websearch_to_tsquery('english', ${search})) DESC`);
    return NextResponse.json(result);
  }

  const effectiveSort = sortKey ?? "date";

  // Sorts requiring JOIN with cookLogs
  if (effectiveSort === "cooks") {
    const orderExpr = dir === "asc"
      ? sql`COALESCE(COUNT("cookLogs".id), 0) ASC`
      : sql`COALESCE(COUNT("cookLogs".id), 0) DESC`;
    const result = await db.execute(sql`
      SELECT ${sql.raw(listColumnsSql)}
      FROM "recipes"
      LEFT JOIN "cookLogs" ON "cookLogs"."recipeId" = "recipes".id
      WHERE ${and(...conditions)}
      GROUP BY "recipes".id
      ORDER BY ${orderExpr}
    `);
    return NextResponse.json(result);
  }

  if (effectiveSort === "lastCooked") {
    const orderExpr = dir === "asc"
      ? sql`MAX("cookLogs"."cookedOn") ASC NULLS FIRST`
      : sql`MAX("cookLogs"."cookedOn") DESC NULLS LAST`;
    const result = await db.execute(sql`
      SELECT ${sql.raw(listColumnsSql)}
      FROM "recipes"
      LEFT JOIN "cookLogs" ON "cookLogs"."recipeId" = "recipes".id
      WHERE ${and(...conditions)}
      GROUP BY "recipes".id
      ORDER BY ${orderExpr}
    `);
    return NextResponse.json(result);
  }

  // totalTime: recipes with no times sort last
  if (effectiveSort === "totalTime") {
    const bothNull = sql`CASE WHEN "prepTime" IS NULL AND "cookTime" IS NULL THEN 1 ELSE 0 END`;
    const totalTimeExpr = sql`COALESCE("prepTime", 0) + COALESCE("cookTime", 0)`;
    const result = await db
      .select(listColumns)
      .from(recipes)
      .where(and(...conditions))
      .orderBy(asc(bothNull), dirFn(totalTimeExpr));
    return NextResponse.json(result);
  }

  // Simple column sorts: date, title, updated
  const columnMap = {
    date: recipes.createdAt,
    title: recipes.title,
    updated: recipes.updatedAt,
  } as const;

  const result = await db
    .select(listColumns)
    .from(recipes)
    .where(and(...conditions))
    .orderBy(dirFn(columnMap[effectiveSort as keyof typeof columnMap]));
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await safeAuth();
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
  const ingredients = parseIngredients(parsed.data.ingredients.map((i) => i.raw));

  const [recipe] = await db
    .insert(recipes)
    .values({
      ...parsed.data,
      ingredients,
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
