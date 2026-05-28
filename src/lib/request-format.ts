import type { NextRequest } from "next/server";

/** True when the client expects a JSON body (browser fetch or API caller). */
export function wantsJsonResponse(req: NextRequest): boolean {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return true;
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("application/json");
}
