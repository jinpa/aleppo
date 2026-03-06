import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendPasswordResetEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email } = parsed.data;

  // Always return success to prevent email enumeration
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      // Delete any existing tokens for this user before issuing a new one
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, user.id));

      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + TOKEN_TTL_MS);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expires,
      });

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

      await sendPasswordResetEmail(email, resetUrl);
    }
  } catch (err) {
    console.error("[forgot-password]", err);
    // Still return success — don't leak server errors to the client
  }

  return NextResponse.json({ success: true });
}
