import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc, asc, and, sql } from "drizzle-orm";

import { db } from "@/db";
import { recipes } from "@/db/schema";
import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { reuploadImageToR2, r2KeyFromUrl } from "@/lib/r2";
import type { RecipeImage } from "@aleppo/shared";
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

const imageSchema = z.object({
  url: z.string(),
  role: z.enum(["thumbnail", "banner", "both"]).optional(),
});

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  sourceUrl: z.string().url().optional().or(z.literal("")).nullable(),
  sourceName: z.string().max(200).optional().nullable(),
  imageUrl: z.string().optional(),
  images: z.array(imageSchema).max(10).default([]),
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

  const listColumnsSql = `"recipes"."id", "recipes"."title", "recipes"."description", "recipes"."imageUrl", "recipes"."images", "recipes"."tags", "recipes"."prepTime", "recipes"."cookTime", "recipes"."sourceName"`;
  const cookStatsSql = `COALESCE(COUNT("cookLogs".id), 0)::int AS "cookCount", MAX("cookLogs"."cookedOn") AS "lastCookedOn"`;
  const baseJoinSql = `FROM "recipes" LEFT JOIN "cookLogs" ON "cookLogs"."recipeId" = "recipes".id`;

  // Default to relevance when searching without explicit sort
  if (!sortKey && search) {
    const result = await db.execute(sql`
      SELECT ${sql.raw(listColumnsSql)}, ${sql.raw(cookStatsSql)}
      ${sql.raw(baseJoinSql)}
      WHERE ${and(...conditions)}
      GROUP BY "recipes".id
      ORDER BY ts_rank("search_tsv", websearch_to_tsquery('english', ${search})) DESC
    `);
    return NextResponse.json(result);
  }

  const effectiveSort = sortKey ?? "date";

  // Sorts requiring JOIN with cookLogs
  if (effectiveSort === "cooks") {
    const orderExpr = dir === "asc"
      ? sql`COALESCE(COUNT("cookLogs".id), 0) ASC`
      : sql`COALESCE(COUNT("cookLogs".id), 0) DESC`;
    const result = await db.execute(sql`
      SELECT ${sql.raw(listColumnsSql)}, ${sql.raw(cookStatsSql)}
      ${sql.raw(baseJoinSql)}
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
      SELECT ${sql.raw(listColumnsSql)}, ${sql.raw(cookStatsSql)}
      ${sql.raw(baseJoinSql)}
      WHERE ${and(...conditions)}
      GROUP BY "recipes".id
      ORDER BY ${orderExpr}
    `);
    return NextResponse.json(result);
  }

  // totalTime: recipes with no times sort last
  if (effectiveSort === "totalTime") {
    const bothNull = `CASE WHEN "prepTime" IS NULL AND "cookTime" IS NULL THEN 1 ELSE 0 END`;
    const totalTimeExpr = `COALESCE("prepTime", 0) + COALESCE("cookTime", 0)`;
    const result = await db.execute(sql`
      SELECT ${sql.raw(listColumnsSql)}, ${sql.raw(cookStatsSql)}
      ${sql.raw(baseJoinSql)}
      WHERE ${and(...conditions)}
      GROUP BY "recipes".id
      ORDER BY ${sql.raw(bothNull)} ASC, ${sql.raw(totalTimeExpr)} ${dir === "asc" ? sql`ASC` : sql`DESC`}
    `);
    return NextResponse.json(result);
  }

  // Simple column sorts: date, title, updated
  const columnMap: Record<string, string> = {
    date: `"recipes"."createdAt"`,
    title: `"recipes"."title"`,
    updated: `"recipes"."updatedAt"`,
  };

  const result = await db.execute(sql`
    SELECT ${sql.raw(listColumnsSql)}, ${sql.raw(cookStatsSql)}
    ${sql.raw(baseJoinSql)}
    WHERE ${and(...conditions)}
    GROUP BY "recipes".id
    ORDER BY ${sql.raw(columnMap[effectiveSort])} ${dir === "asc" ? sql`ASC` : sql`DESC`}
  `);
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

  // Build images array: prefer `images` field, fall back to wrapping `imageUrl`
  let images: RecipeImage[] = parsed.data.images;
  if (images.length === 0 && parsed.data.imageUrl) {
    images = [{ url: parsed.data.imageUrl }];
  }
  // Re-upload any non-R2 URLs
  images = await Promise.all(
    images.map(async (img) => ({
      ...img,
      url: r2KeyFromUrl(img.url) ? img.url : await reuploadImageToR2(img.url, userId),
    }))
  );
  // Derive imageUrl from images (banner → first → null)
  const imageUrl = images.find((i) => i.role === "banner" || i.role === "both")?.url
    ?? images[0]?.url ?? null;

  const ingredients = parseIngredients(parsed.data.ingredients.map((i) => i.raw));

  const [recipe] = await db
    .insert(recipes)
    .values({
      ...parsed.data,
      ingredients,
      userId,
      imageUrl,
      images,
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
