import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";
import { getUserFromBearerToken } from "@/lib/mobile-auth";

/**
 * Bootstrap admin access via ADMIN_EMAIL env var.
 *
 * Requires ADMIN_EMAIL to be set — the user matching that email is promoted to
 * admin. This lets you bootstrap a specific account without touching the DB.
 * Without ADMIN_EMAIL, admins must be set directly in the database.
 */
export async function POST(req: Request) {
  const session = await auth();
  const bearer = await getUserFromBearerToken(req);
  const userId = session?.user?.id ?? bearer?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    return NextResponse.json(
      { error: "ADMIN_EMAIL not configured" },
      { status: 403 }
    );
  }

  // Only the ADMIN_EMAIL user may bootstrap themselves
  const callerEmail = session?.user?.email ?? bearer?.email;
  if (callerEmail !== adminEmail) {
    return NextResponse.json(
      { error: "Your account does not match ADMIN_EMAIL" },
      { status: 403 }
    );
  }

  const [target] = await db
    .select({ id: users.id, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (!target) {
    return NextResponse.json(
      { error: "No user found with ADMIN_EMAIL" },
      { status: 404 }
    );
  }

  if (target.isAdmin) {
    return NextResponse.json({ ok: true, alreadyAdmin: true });
  }

  await db
    .update(users)
    .set({ isAdmin: true })
    .where(eq(users.id, target.id));

  return NextResponse.json({ ok: true });
}
