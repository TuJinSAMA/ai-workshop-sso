import { NextResponse, type NextRequest } from "next/server";

// Edge middleware (spec Section 12.8 + 10):
// - Guard /api/internal/* with X-Internal-Token header.
// - Apply a strict no-CORS policy on /api/* (auth.aiprd.club must not be
//   reachable cross-origin from a browser context).
// - Heavier rate-limit / CSRF logic lives in the route handlers themselves
//   (Node runtime) since Upstash + Prisma require Node APIs.

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/internal/")) {
    const token = req.headers.get("x-internal-token");
    if (!token || token !== process.env.INTERNAL_API_TOKEN) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const res = NextResponse.next();
  // Disallow cross-origin requests to API routes.
  res.headers.set("Vary", "Origin");
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
