import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── API routes ────────────────────────────────────────────────────────────
  // Inject a Bearer token as a session cookie so that auth() in route handlers
  // works for both cookie-based and token-based callers.
  if (pathname.startsWith("/api/")) {
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
    return NextResponse.next();
  }

  // ── SPA catch-all ─────────────────────────────────────────────────────────
  // All non-API, non-static requests are served by the Expo web SPA.
  // Auth is handled client-side by the SPA (Bearer token in localStorage).
  const url = request.nextUrl.clone();
  url.pathname = "/spa.html";
  return NextResponse.rewrite(url);
}

export const config = {
  // Exclude Next.js internals, Expo static assets, and files with extensions
  // (images, fonts, manifests, etc.) — those are served directly from public/.
  matcher: [
    "/((?!_next/static|_next/image|_expo|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json|woff2?|ttf|otf)$).*)",
  ],
};
