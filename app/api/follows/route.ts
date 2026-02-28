import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { follows, users } from "@/db/schema";

const schema = z.object({ followingId: z.string() });

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    if (parsed.data.followingId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot follow yourself" },
        { status: 400 }
      );
    }

    // Verify user exists
    const [target] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, parsed.data.followingId))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db
      .insert(follows)
      .values({
        followerId: session.user.id,
        followingId: parsed.data.followingId,
      })
      .onConflictDoNothing();

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/follows]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, session.user.id),
          eq(follows.followingId, parsed.data.followingId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/follows]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
