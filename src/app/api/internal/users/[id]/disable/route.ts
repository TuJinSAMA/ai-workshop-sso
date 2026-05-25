import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.status === "DISABLED") return NextResponse.json({ ok: true, alreadyDisabled: true });

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { status: "DISABLED" } }),
    // Revoke all active sessions immediately.
    prisma.session.updateMany({
      where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    }),
  ]);

  await audit({ event: "session_revoked", userId: id, metadata: { reason: "user_disabled" } });

  return NextResponse.json({ ok: true });
}
