import { NextResponse } from "next/server";
import { ilike, eq, and, or } from "drizzle-orm";

import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { users, follows } from "@/db/schema";

export async function GET(req: Request) {
  const session = await safeAuth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const results = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      bio: users.bio,
    })
    .from(users)
    .where(
      and(
        eq(users.isPublic, true),
        or(
          ilike(users.name, `%${q}%`),
          ilike(users.email, `%${q}%`)
        )
      )
    )
    .limit(20);

  // Look up which of these users the caller already follows
  const followedIds = new Set<string>();
  if (results.length > 0) {
    const rows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userId));
    for (const row of rows) followedIds.add(row.followingId);
  }

  return NextResponse.json(
    results.map((u) => ({
      ...u,
      isFollowing: followedIds.has(u.id),
      isSelf: u.id === userId,
    }))
  );
}
