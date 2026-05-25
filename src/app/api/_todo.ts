import { NextResponse } from "next/server";

/**
 * Helper for skeleton route handlers. Returns 501 with the route name so
 * Phase 0 implementation has a clearly visible TODO surface.
 */
export function notImplemented(route: string) {
  return NextResponse.json(
    { error: "not_implemented", route, message: `${route} is a Phase 0 skeleton; implement me.` },
    { status: 501 },
  );
}
