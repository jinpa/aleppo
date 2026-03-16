import { decode } from "next-auth/jwt";
import { auth } from "@/auth";

/**
 * Calls auth() but returns null instead of throwing if the session cookie
 * is present but unreadable (e.g. encrypted with a rotated AUTH_SECRET).
 */
export async function safeAuth() {
  try {
    return await auth();
  } catch {
    return null;
  }
}

/**
 * Extracts a user ID from an Authorization: Bearer <token> header.
 * The token is a next-auth JWT produced by /api/auth/mobile/credentials.
 * We try both the secure and non-secure cookie salts so this works in
 * both production (HTTPS → __Secure- prefix) and local dev (HTTP).
 */
export async function getUserFromBearerToken(
  req: Request
): Promise<{ id: string; email: string; isAdmin: boolean } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const salts = ["__Secure-authjs.session-token", "authjs.session-token"];
  for (const salt of salts) {
    try {
      const decoded = await decode({ token, secret, salt });
      if (decoded?.sub) {
        return { id: decoded.sub, email: decoded.email as string, isAdmin: !!decoded.isAdmin };
      }
    } catch {
      // try next salt
    }
  }

  return null;
}
