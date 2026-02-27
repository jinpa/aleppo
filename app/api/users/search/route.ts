import { NextResponse } from "next/server";
import { ilike, eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
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
        ilike(users.name, `%${q}%`)
      )
    )
    .limit(20);

  return NextResponse.json(results);
}
