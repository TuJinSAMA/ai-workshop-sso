import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { readSsoCookie } from "@/lib/cookies";
import { getProvider } from "@/lib/oidc-provider";

// POST /api/sessions/[id]/revoke
//
// Marks one of the current user's Prisma Sessions as revoked. As a defensive
// best-effort, we also walk every oidc-provider Grant that belongs to the
// owning user and call revokeByGrantId, so any access/refresh tokens issued
// via those grants are killed too. Phase 0 keeps the mapping coarse (user-
// wide, not per-device) because we don't carry an SSO-session → grantId
// linkage in the schema yet.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const currentSid = await readSsoCookie();
  if (!currentSid) return new NextResponse("unauthenticated", { status: 401 });

  const current = await prisma.session.findUnique({ where: { id: currentSid } });
  if (!current || current.revokedAt) {
    return new NextResponse("unauthenticated", { status: 401 });
  }

  const target = await prisma.session.findUnique({ where: { id } });
  if (!target || target.userId !== current.userId) {
    return new NextResponse("not_found", { status: 404 });
  }

  if (!target.revokedAt) {
    await prisma.session.update({
      where: { id: target.id },
      data: { revokedAt: new Date() },
    });
  }

  // Best-effort: revoke OIDC grants belonging to this user. We scan
  // OidcModel rows for model='Grant' and JS-filter by payload.accountId
  // since the JSON column doesn't have a typed index here.
  try {
    const provider = await getProvider();
    const grantRows = await prisma.oidcModel.findMany({
      where: { model: "Grant" },
    });
    const grantIds = grantRows
      .filter((row) => {
        const p = row.payload as { accountId?: string } | null;
        return p?.accountId === current.userId;
      })
      .map((row) => row.id.replace(/^Grant:/, ""));
    await Promise.all(
      grantIds.map((gid) => provider.AccessToken.revokeByGrantId(gid)),
    );
    await Promise.all(
      grantIds.map((gid) => provider.RefreshToken.revokeByGrantId(gid)),
    );
  } catch (err) {
    console.error("[sessions.revoke] grant cleanup failed", err);
  }

  await audit({
    event: "session_revoked",
    userId: current.userId,
    metadata: { sessionId: target.id, viaUi: true },
  });

  return new NextResponse(null, {
    status: 303,
    headers: { Location: new URL("/account", req.url).toString() },
  });
}
