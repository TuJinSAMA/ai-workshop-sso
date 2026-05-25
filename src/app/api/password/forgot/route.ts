import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { emailService } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email-templates";
import { generateToken, hashToken, tokenExpiresAt, RESET_TOKEN_TTL_MINUTES } from "@/lib/tokens";
import { audit } from "@/lib/audit";

const Body = z.object({
  email: z.email().max(254),
});

async function parseBody(req: NextRequest): Promise<unknown> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return req.json();
  const form = await req.formData();
  return Object.fromEntries(form.entries());
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const raw = await parseBody(req);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { email } = parsed.data;

  // Always respond 200 to prevent user enumeration.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") {
    return respondOk(req);
  }

  // Invalidate any existing unused tokens for this user to prevent token accumulation.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  const raw_token = generateToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw_token),
      expiresAt: tokenExpiresAt(RESET_TOKEN_TTL_MINUTES),
    },
  });

  const { subject, html, text } = passwordResetEmail(raw_token);
  await emailService().send({ to: email, subject, html, text });

  await audit({
    event: "password_reset_requested",
    userId: user.id,
    ipAddress: ipFrom(req),
    metadata: { email },
  });

  return respondOk(req);
}

function respondOk(req: NextRequest): NextResponse {
  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");
  if (isJson) {
    return NextResponse.json({ ok: true, message: "如果该邮箱存在，你将收到一封密码重置邮件。" });
  }
  // Form POST: redirect so the page can show a confirmation.
  return new NextResponse(null, { status: 303, headers: { Location: "/password/forgot?sent=1" } });
}

function ipFrom(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip") ?? null;
}
