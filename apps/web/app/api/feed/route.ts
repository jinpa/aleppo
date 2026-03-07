import { NextResponse } from "next/server";
import { eq, desc, inArray, and } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { cookLogs, recipes, users, follows } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const following = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, session.user.id));

  if (following.length === 0) {
    return NextResponse.json([]);
  }

  const followingIds = following.map((f) => f.followingId);

  const feed = await db
    .select({
      log: {
        id: cookLogs.id,
        cookedOn: cookLogs.cookedOn,
        notes: cookLogs.notes,
        createdAt: cookLogs.createdAt,
      },
      recipe: {
        id: recipes.id,
        title: recipes.title,
        imageUrl: recipes.imageUrl,
        tags: recipes.tags,
      },
      user: {
        id: users.id,
        name: users.name,
        image: users.image,
      },
    })
    .from(cookLogs)
    .innerJoin(
      recipes,
      and(eq(cookLogs.recipeId, recipes.id), eq(recipes.isPublic, true))
    )
    .innerJoin(
      users,
      and(eq(cookLogs.userId, users.id), eq(users.isPublic, true))
    )
    .where(inArray(cookLogs.userId, followingIds))
    .orderBy(desc(cookLogs.createdAt))
    .limit(50);

  return NextResponse.json(feed);
}
