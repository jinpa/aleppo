import { safeAuth, getUserFromBearerToken } from "@/lib/mobile-auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Verifies the caller is an admin by checking the DB (not JWT).
 * Returns the user row if admin, null otherwise.
 */
export async function requireAdmin(req: Request) {
  const session = await safeAuth();
  const bearer = await getUserFromBearerToken(req);
  const userId = session?.user?.id ?? bearer?.id;
  if (!userId) return null;

  const [user] = await db
    .select({ id: users.id, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.isAdmin ? user : null;
}
