import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { recipes } from "@/db/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ duplicate: null });
  }

  const [existing] = await db
    .select({ id: recipes.id, title: recipes.title })
    .from(recipes)
    .where(and(eq(recipes.userId, session.user.id), eq(recipes.sourceUrl, url)))
    .limit(1);

  return NextResponse.json({ duplicate: existing ?? null });
}
