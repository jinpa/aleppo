import { NextResponse } from "next/server";
import { asc, count, sql, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import { users, recipes, cookLogs, follows } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { listStorageByUser } from "@/lib/r2";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  const [
    [totals],
    userRows,
    recipeCounts,
    cookLogCounts,
    storageMap,
  ] = await Promise.all([
    db
      .select({
        totalUsers: count(users.id),
        totalRecipes: sql<number>`(select count(*) from recipes)`,
        totalCookLogs: sql<number>`(select count(*) from "cookLogs")`,
        totalFollows: sql<number>`(select count(*) from follows)`,
      })
      .from(users),

    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isPublic: users.isPublic,
        isAdmin: users.isAdmin,
        isSuspended: users.isSuspended,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        q
          ? or(
              ilike(users.name, `%${q}%`),
              ilike(users.email, `%${q}%`)
            )
          : undefined
      )
      .orderBy(asc(users.createdAt)),

    db
      .select({ userId: recipes.userId, cnt: count() })
      .from(recipes)
      .groupBy(recipes.userId),

    db
      .select({ userId: cookLogs.userId, cnt: count() })
      .from(cookLogs)
      .groupBy(cookLogs.userId),

    listStorageByUser(),
  ]);

  const recipeMap = new Map(recipeCounts.map((r) => [r.userId, Number(r.cnt)]));
  const cookMap = new Map(cookLogCounts.map((r) => [r.userId, Number(r.cnt)]));

  let totalStorageBytes = 0;
  for (const bytes of storageMap.values()) {
    totalStorageBytes += bytes;
  }

  return NextResponse.json({
    totals: {
      users: Number(totals.totalUsers),
      recipes: Number(totals.totalRecipes),
      cookLogs: Number(totals.totalCookLogs),
      follows: Number(totals.totalFollows),
      totalStorageBytes,
    },
    users: userRows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isPublic: u.isPublic,
      isAdmin: u.isAdmin,
      isSuspended: u.isSuspended,
      recipeCount: recipeMap.get(u.id) ?? 0,
      cookLogCount: cookMap.get(u.id) ?? 0,
      storageBytes: storageMap.get(u.id) ?? 0,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
