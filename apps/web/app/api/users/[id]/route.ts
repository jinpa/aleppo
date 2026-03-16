import { NextResponse } from "next/server";
import { eq, and, count } from "drizzle-orm";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { users, recipes, cookLogs, follows } from "@/db/schema";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await safeAuth();
  const viewerId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      bio: users.bio,
      isPublic: users.isPublic,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isOwner = viewerId === id;

  // Only show non-public profiles to their owner
  if (!user.isPublic && !isOwner) {
    return NextResponse.json({ error: "Profile is private" }, { status: 403 });
  }

  const [[recipeCount], [cookCount], [followerCount], [followingCount]] = await Promise.all([
    db.select({ count: count() }).from(recipes).where(isOwner ? eq(recipes.userId, id) : and(eq(recipes.userId, id), eq(recipes.isPublic, true))),
    db.select({ count: count() }).from(cookLogs).where(eq(cookLogs.userId, id)),
    db.select({ count: count() }).from(follows).where(eq(follows.followingId, id)),
    db.select({ count: count() }).from(follows).where(eq(follows.followerId, id)),
  ]);

  let isFollowing = false;
  if (viewerId && !isOwner) {
    const [f] = await db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, viewerId!),
          eq(follows.followingId, id)
        )
      )
      .limit(1);
    isFollowing = !!f;
  }

  return NextResponse.json({
    ...user,
    recipeCount: recipeCount.count,
    cookCount: cookCount.count,
    followerCount: followerCount.count,
    followingCount: followingCount.count,
    isFollowing,
    isOwner,
  });
}
