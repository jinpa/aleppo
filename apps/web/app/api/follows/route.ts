import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { follows, users, notifications } from "@/db/schema";

const schema = z.object({ followingId: z.string() });

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    if (parsed.data.followingId === userId) {
      return NextResponse.json(
        { error: "Cannot follow yourself" },
        { status: 400 }
      );
    }

    // Verify user exists and get notification preference
    const [target] = await db
      .select({ id: users.id, notifyOnNewFollower: users.notifyOnNewFollower })
      .from(users)
      .where(eq(users.id, parsed.data.followingId))
      .limit(1);

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already following
    const [existing] = await db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, userId),
          eq(follows.followingId, parsed.data.followingId)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(follows).values({
        followerId: userId,
        followingId: parsed.data.followingId,
      });

      // Emit notification if target has it enabled
      if (target.notifyOnNewFollower) {
        await db.insert(notifications).values({
          userId: parsed.data.followingId,
          type: "new_follower",
          actorId: userId,
        });
      }
    }

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
    const userId = session?.user?.id ?? (await getUserFromBearerToken(req))?.id;
    if (!userId) {
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
          eq(follows.followerId, userId),
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
