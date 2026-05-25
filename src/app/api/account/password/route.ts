/**
 * POST /api/account/password — change password for the authenticated user.
 * Requires current password for confirmation (spec §6.1 "敏感操作二次验证").
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { readSsoCookie } from "@/lib/cookies";
import { verifyPassword, hashPassword, isPasswordPwned } from "@/lib/password";
import { audit } from "@/lib/audit";

const Body = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});

async function parseBody(req: NextRequest): Promise<{ data: unknown; isJson: boolean }> {
  const ct = req.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");
  if (isJson) return { data: await req.json(), isJson };
  const form = await req.formData();
  return { data: Object.fromEntries(form.entries()), isJson };
}

function ipFrom(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip") ?? null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sid = await readSsoCookie();
  if (!sid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const session = await prisma.session.findUnique({ where: { id: sid } });
  if (!session || session.revokedAt) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.passwordHash) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: raw, isJson } = await parseBody(req);
  const parsed = Body.safeParse(raw);

  const errRedirect = (code: string, status = 400) => {
    if (isJson) return NextResponse.json({ error: code }, { status });
    return new NextResponse(null, { status: 303, headers: { Location: `/account?error=${code}#security` } });
  };

  if (!parsed.success) return errRedirect("invalid_request");

  const { currentPassword, newPassword } = parsed.data;

  const currentOk = await verifyPassword(currentPassword, user.passwordHash, user.passwordAlgo, user.legacySalt);
  if (!currentOk) return errRedirect("invalid_current_password", 401);

  if (currentPassword === newPassword) return errRedirect("same_password");

  const pwned = await isPasswordPwned(newPassword);
  if (pwned) return errRedirect("password_compromised", 422);

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, passwordAlgo: "argon2id", legacySalt: null },
    }),
    // Revoke all other sessions except the current one.
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null, id: { not: sid } },
      data: { revokedAt: new Date() },
    }),
  ]);

  await audit({
    event: "password_changed",
    userId: user.id,
    ipAddress: ipFrom(req),
    metadata: {},
  });

  if (isJson) return NextResponse.json({ ok: true });
  return new NextResponse(null, { status: 303, headers: { Location: "/account?message=password_changed#security" } });
}
