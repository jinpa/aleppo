import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { recipes } from "@/db/schema";

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).optional().nullable(),
  sourceUrl: z.string().url().optional().or(z.literal("")).nullable(),
  sourceName: z.string().max(200).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
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
    .optional(),
  instructions: z
    .array(z.object({ step: z.number(), text: z.string() }))
    .optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  notes: z.string().max(5000).optional().nullable(),
  prepTime: z.number().int().positive().optional().nullable(),
  cookTime: z.number().int().positive().optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

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
  const session = await auth();
  if (!session?.user?.id) {
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

  const [updated] = await db
    .update(recipes)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(recipes.id, id), eq(recipes.userId, session.user.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [deleted] = await db
    .delete(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, session.user.id)))
    .returning({ id: recipes.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
