import { NextResponse, type NextRequest } from "next/server";

import { stripSensitiveQueryParams } from "@/lib/sensitive-query-params";

// Edge proxy (spec Section 12.8 + 10):
// - Strip credentials accidentally GET-submitted on auth pages (query string).
// - Guard /api/internal/* with X-Internal-Token header.
// - Apply a strict no-CORS policy on /api/* (auth.aiprd.club must not be
//   reachable cross-origin from a browser context).
// - Heavier rate-limit / CSRF logic lives in the route handlers themselves
//   (Node runtime) since Upstash + Prisma require Node APIs.

function isAuthPage(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/account" ||
    pathname.startsWith("/password/") ||
    pathname === "/verify-email"
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isAuthPage(pathname)) {
    const url = req.nextUrl.clone();
    if (stripSensitiveQueryParams(url)) {
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/api/internal/")) {
    const token = req.headers.get("x-internal-token");
    if (!token || token !== process.env.INTERNAL_API_TOKEN) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const res = NextResponse.next();
  res.headers.set("Vary", "Origin");
  return res;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/login",
    "/register",
    "/account",
    "/password/:path*",
    "/verify-email",
  ],
};
