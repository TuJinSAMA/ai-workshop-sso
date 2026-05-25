import { NextResponse } from "next/server";

import { rotateSigningKey } from "@/lib/jwks";
import { audit } from "@/lib/audit";

export async function POST(): Promise<NextResponse> {
  const newKid = await rotateSigningKey();
  await audit({ event: "key_rotated", metadata: { newKid } });
  return NextResponse.json({ ok: true, newKid });
}
