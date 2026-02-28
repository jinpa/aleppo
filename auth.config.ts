import type { NextAuthConfig } from "next-auth";

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
