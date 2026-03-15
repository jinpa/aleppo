import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, follows, notifications } from "@/db/schema";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  ref: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    const { name, email, password, ref } = parsed.data;

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [newUser] = await db.insert(users).values({
      name,
      email,
      passwordHash,
    }).returning({ id: users.id });

    // Auto-follow the inviter if ref is provided
    if (ref && newUser) {
      const [inviter] = await db
        .select({ id: users.id, notifyOnNewFollower: users.notifyOnNewFollower })
        .from(users)
        .where(eq(users.id, ref))
        .limit(1);

      if (inviter) {
        await db.insert(follows).values({
          followerId: newUser.id,
          followingId: inviter.id,
        }).onConflictDoNothing();

        if (inviter.notifyOnNewFollower) {
          await db.insert(notifications).values({
            userId: inviter.id,
            type: "new_follower",
            actorId: newUser.id,
          });
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
