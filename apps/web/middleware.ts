import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { type NextRequest, type NextFetchEvent, NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  // For API routes with a Bearer token, inject it as a session cookie so
  // that auth() in route handlers can read it without any modification.
  // API routes are already unconditionally allowed through by authConfig,
  // so bypassing the auth middleware here is safe.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const isSecure = request.nextUrl.protocol === "https:";
      const cookieName = isSecure
        ? "__Secure-authjs.session-token"
        : "authjs.session-token";

      if (!request.cookies.has(cookieName)) {
        const modifiedHeaders = new Headers(request.headers);
        const existingCookie = request.headers.get("cookie");
        modifiedHeaders.set(
          "cookie",
          existingCookie
            ? `${existingCookie}; ${cookieName}=${token}`
            : `${cookieName}=${token}`
        );
        return NextResponse.next({ request: { headers: modifiedHeaders } });
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (auth as any)(request, event);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
