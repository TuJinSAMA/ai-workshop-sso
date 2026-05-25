import { NextResponse } from "next/server";
import { getAllPublicJwks } from "@/lib/jwks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jwks = await getAllPublicJwks();
  return NextResponse.json(jwks, {
    headers: {
      "Cache-Control": "public, max-age=300, must-revalidate",
      "Content-Type": "application/jwk-set+json",
    },
  });
}
