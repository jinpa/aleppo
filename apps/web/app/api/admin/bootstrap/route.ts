import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";

/**
 * Self-bootstrap the first admin. Only works when no admin users exist yet.
 * Sets the calling user as admin and returns 403 if any admin already exists.
 */
export async function POST(req: Request) {
  const session = await auth();
  const bearer = await getUserFromBearerToken(req);
  const userId = session?.user?.id ?? bearer?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if any admin already exists
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(users)
    .where(eq(users.isAdmin, true));

  if (Number(cnt) > 0) {
    return NextResponse.json(
      { error: "Admin already exists" },
      { status: 403 }
    );
  }

  await db
    .update(users)
    .set({ isAdmin: true })
    .where(eq(users.id, userId));

  return NextResponse.json({ ok: true });
}
