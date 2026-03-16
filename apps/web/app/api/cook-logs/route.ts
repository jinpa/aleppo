import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { cookLogs, recipes } from "@/db/schema";

const createSchema = z.object({
  recipeId: z.string(),
  cookedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Verify recipe belongs to user
  const [recipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(
      and(
        eq(recipes.id, parsed.data.recipeId),
        eq(recipes.userId, userId)
      )
    )
    .limit(1);

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const [log] = await db
    .insert(cookLogs)
    .values({
      recipeId: parsed.data.recipeId,
      userId,
      cookedOn: parsed.data.cookedOn,
      notes: parsed.data.notes,
    })
    .returning();

  return NextResponse.json(log, { status: 201 });
}
