import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, desc, and, ilike, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { recipes } from "@/db/schema";

const createSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  sourceName: z.string().max(200).optional(),
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
  notes: z.string().max(5000).optional(),
  prepTime: z.number().int().positive().optional().nullable(),
  cookTime: z.number().int().positive().optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const tag = searchParams.get("tag");

  let query = db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, session.user.id))
    .orderBy(desc(recipes.createdAt))
    .$dynamic();

  if (search) {
    query = query.where(
      and(
        eq(recipes.userId, session.user.id),
        ilike(recipes.title, `%${search}%`)
      )
    );
  }

  if (tag) {
    query = query.where(
      and(
        eq(recipes.userId, session.user.id),
        sql`${recipes.tags} @> ARRAY[${tag}]::text[]`
      )
    );
  }

  const result = await query;
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
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

  const [recipe] = await db
    .insert(recipes)
    .values({
      ...parsed.data,
      userId: session.user.id,
      sourceUrl: parsed.data.sourceUrl || null,
      sourceName: parsed.data.sourceName || null,
      prepTime: parsed.data.prepTime ?? null,
      cookTime: parsed.data.cookTime ?? null,
      servings: parsed.data.servings ?? null,
    })
    .returning();

  return NextResponse.json(recipe, { status: 201 });
}
