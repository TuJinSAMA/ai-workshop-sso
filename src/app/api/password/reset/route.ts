import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { hashPassword, isPasswordPwned } from "@/lib/password";
import { hashToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";

const Body = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8).max(256),
});

async function parseBody(req: NextRequest): Promise<{ data: unknown; isJson: boolean }> {
  const ct = req.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");
  if (isJson) return { data: await req.json(), isJson };
  const form = await req.formData();
  return { data: Object.fromEntries(form.entries()), isJson };
}

function errorResponse(req: NextRequest, isJson: boolean, token: string, errorCode: string, status: number): NextResponse {
  if (isJson) return NextResponse.json({ error: errorCode }, { status });
  const url = `/password/reset?token=${encodeURIComponent(token)}&error=${errorCode}`;
  return new NextResponse(null, { status: 303, headers: { Location: url } });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { data: raw, isJson } = await parseBody(req);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(req, isJson, "", "invalid_request", 400);
  }
  const { token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return errorResponse(req, isJson, token, "invalid_or_expired_token", 400);
  }

  if (record.user.status !== "ACTIVE") {
    return errorResponse(req, isJson, token, "account_disabled", 403);
  }

  // HIBP check on new password.
  const pwned = await isPasswordPwned(password);
  if (pwned) {
    return errorResponse(req, isJson, token, "password_compromised", 422);
  }

  const passwordHash = await hashPassword(password);

  // Mark token used + update password + revoke all existing sessions (force re-login).
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordAlgo: "argon2id", legacySalt: null },
    }),
    prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await audit({
    event: "password_reset_completed",
    userId: record.userId,
    ipAddress: ipFrom(req),
    metadata: {},
  });

  if (isJson) return NextResponse.json({ ok: true, message: "密码已重置，请用新密码登录。" });
  return new NextResponse(null, { status: 303, headers: { Location: "/login?message=password_reset_ok" } });
}

function ipFrom(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip") ?? null;
}
