import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { recipes } from "@/db/schema";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export async function DELETE(req: Request) {
  const session = await auth();
  const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );

  const deleted = await db
    .delete(recipes)
    .where(and(inArray(recipes.id, parsed.data.ids), eq(recipes.userId, userId)))
    .returning({ id: recipes.id });

  return NextResponse.json({ deleted: deleted.map((r) => r.id) });
}
