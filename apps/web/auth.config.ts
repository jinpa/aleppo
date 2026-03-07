import type { NextAuthConfig } from "next-auth";

// Ensure AUTH_URL always has a protocol — Railway sometimes exposes the bare
// hostname (e.g. "aleppo-production.up.railway.app") which causes Auth.js to
// throw "Invalid URL" when constructing redirect URLs in middleware.
if (
  process.env.AUTH_URL &&
  !process.env.AUTH_URL.startsWith("http://") &&
  !process.env.AUTH_URL.startsWith("https://")
) {
  process.env.AUTH_URL = `https://${process.env.AUTH_URL}`;
}

// Lightweight config for use in middleware (edge-compatible, no db/bcrypt imports)
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAuthenticated = !!auth?.user;
      const publicRoutes = [
        "/auth/signin",
        "/auth/signup",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/error",
      ];
      const isPublicRoute = publicRoutes.some((r) =>
        nextUrl.pathname.startsWith(r)
      );
      const isPublicContent =
        nextUrl.pathname.startsWith("/u/") ||
        nextUrl.pathname.startsWith("/r/");
      const isApiRoute = nextUrl.pathname.startsWith("/api/");

      if (isPublicRoute || isPublicContent || isApiRoute) return true;
      return isAuthenticated;
    },
  },
  providers: [],
};
