import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { recipes } from "@/db/schema";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const viewerId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  const isOwner = viewerId === id;

  const rows = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      description: recipes.description,
      imageUrl: recipes.imageUrl,
      tags: recipes.tags,
      prepTime: recipes.prepTime,
      cookTime: recipes.cookTime,
      isPublic: recipes.isPublic,
      sourceName: recipes.sourceName,
      createdAt: recipes.createdAt,
    })
    .from(recipes)
    .where(
      isOwner
        ? eq(recipes.userId, id)
        : and(eq(recipes.userId, id), eq(recipes.isPublic, true))
    )
    .orderBy(desc(recipes.createdAt));

  return NextResponse.json(rows);
}
