import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, desc, max, sql } from "drizzle-orm";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { wantToCook, recipes } from "@/db/schema";

const schema = z.object({ recipeId: z.string() });

export async function GET(req: Request) {
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queue = await db
    .select({
      recipe: recipes,
      addedAt: wantToCook.addedAt,
    })
    .from(wantToCook)
    .innerJoin(recipes, eq(wantToCook.recipeId, recipes.id))
    .where(eq(wantToCook.userId, userId))
    .orderBy(wantToCook.position, desc(wantToCook.addedAt));

  return NextResponse.json(queue);
}

export async function POST(req: Request) {
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Verify recipe is accessible
  const [recipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.id, parsed.data.recipeId))
    .limit(1);

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  // Place new item at end of queue
  const [{ maxPos }] = await db
    .select({ maxPos: max(wantToCook.position) })
    .from(wantToCook)
    .where(eq(wantToCook.userId, userId));

  await db
    .insert(wantToCook)
    .values({
      userId,
      recipeId: parsed.data.recipeId,
      position: (maxPos ?? -1) + 1,
    })
    .onConflictDoNothing();

  return NextResponse.json({ success: true }, { status: 201 });
}

const reorderSchema = z.object({ order: z.array(z.string()) });

export async function PATCH(req: Request) {
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { order } = parsed.data;

  await db.transaction(async (tx) => {
    await Promise.all(
      order.map((recipeId, index) =>
        tx
          .update(wantToCook)
          .set({ position: index })
          .where(
            and(
              eq(wantToCook.userId, userId),
              eq(wantToCook.recipeId, recipeId)
            )
          )
      )
    );
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  await db
    .delete(wantToCook)
    .where(
      and(
        eq(wantToCook.userId, userId),
        eq(wantToCook.recipeId, parsed.data.recipeId)
      )
    );

  return NextResponse.json({ success: true });
}
