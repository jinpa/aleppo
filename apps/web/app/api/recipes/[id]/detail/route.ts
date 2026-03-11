import { NextResponse } from "next/server";
import { eq, and, count, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { recipes, users, cookLogs, wantToCook } from "@/db/schema";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;

  // Fetch recipe + author
  const [row] = await db
    .select({
      recipe: recipes,
      author: {
        id: users.id,
        name: users.name,
        image: users.image,
      },
    })
    .from(recipes)
    .innerJoin(users, eq(recipes.userId, users.id))
    .where(eq(recipes.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Privacy check: private recipes only visible to owner
  if (!row.recipe.isPublic && row.recipe.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = row.recipe.userId === userId;

  // Fetch cook logs (owner only)
  const logs = isOwner
    ? await db
        .select()
        .from(cookLogs)
        .where(eq(cookLogs.recipeId, id))
        .orderBy(desc(cookLogs.cookedOn))
    : [];

  // Cook count (visible to all)
  const [{ cookCount }] = await db
    .select({ cookCount: count() })
    .from(cookLogs)
    .where(and(eq(cookLogs.recipeId, id), eq(cookLogs.userId, row.recipe.userId)));

  // Queue status (only if logged in)
  let inQueue = false;
  if (userId) {
    const [queueRow] = await db
      .select({ recipeId: wantToCook.recipeId })
      .from(wantToCook)
      .where(and(eq(wantToCook.userId, userId), eq(wantToCook.recipeId, id)))
      .limit(1);
    inQueue = !!queueRow;
  }

  return NextResponse.json({
    recipe: { ...row.recipe, author: row.author },
    cookLogs: logs,
    cookCount,
    inQueue,
    isOwner,
  });
}
