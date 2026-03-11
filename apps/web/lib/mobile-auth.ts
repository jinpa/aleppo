import { decode } from "next-auth/jwt";

/**
 * Extracts a user ID from an Authorization: Bearer <token> header.
 * The token is a next-auth JWT produced by /api/auth/mobile/credentials.
 * We try both the secure and non-secure cookie salts so this works in
 * both production (HTTPS → __Secure- prefix) and local dev (HTTP).
 */
export async function getUserFromBearerToken(
  req: Request
): Promise<{ id: string; email: string } | null> {
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
        return { id: decoded.sub, email: decoded.email as string };
      }
    } catch {
      // try next salt
    }
  }

  return null;
}
