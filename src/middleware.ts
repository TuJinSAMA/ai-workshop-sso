import { NextResponse, type NextRequest } from "next/server";

import { stripSensitiveQueryParams } from "@/lib/sensitive-query-params";

/** Strip credentials accidentally submitted via GET (browser default form method). */
export function middleware(req: NextRequest): NextResponse | undefined {
  const url = req.nextUrl.clone();
  if (!stripSensitiveQueryParams(url)) return;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/account",
    "/password/:path*",
    "/verify-email",
  ],
};
