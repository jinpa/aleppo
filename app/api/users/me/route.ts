import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional().nullable(),
  image: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(100).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      bio: users.bio,
      isPublic: users.isPublic,
      createdAt: users.createdAt,
      hasPassword: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    hasPassword: !!user.hasPassword,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { currentPassword, newPassword, ...updates } = parsed.data;

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password required" },
        { status: 400 }
      );
    }

    const [user] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: "No password set on this account" },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, session.user.id));
  }

  return NextResponse.json({ success: true });
}
