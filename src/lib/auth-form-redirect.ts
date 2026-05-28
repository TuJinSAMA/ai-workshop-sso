import { NextResponse } from "next/server";

/**
 * 303 back to login/register when the browser did a classic HTML form POST
 * (no Accept: application/json). Avoids landing on a raw JSON error page.
 */
export function authFormErrorRedirect(
  page: "/login" | "/register",
  error: string,
  opts?: { uid?: string; retryAfterMs?: number },
): NextResponse {
  const params = new URLSearchParams({ error });
  if (opts?.uid) params.set("uid", opts.uid);
  if (opts?.retryAfterMs != null) {
    params.set("retryAfterMs", String(opts.retryAfterMs));
  }
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `${page}?${params.toString()}` },
  });
}
