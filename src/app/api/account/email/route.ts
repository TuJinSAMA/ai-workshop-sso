/**
 * POST /api/account/email — request email address change.
 * Requires current password for confirmation.
 * Sends a verification email to the NEW address; the change is applied only after verification.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { readSsoCookie } from "@/lib/cookies";
import { verifyPassword } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/email-verification";
import { audit } from "@/lib/audit";

const Body = z.object({
  newEmail: z.email().max(254),
  currentPassword: z.string().min(1).max(256),
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
    return new NextResponse(null, { status: 303, headers: { Location: `/account?error=${code}#profile` } });
  };

  if (!parsed.success) return errRedirect("invalid_request");

  const { newEmail, currentPassword } = parsed.data;

  if (newEmail === user.email) return errRedirect("same_email");

  const passwordOk = await verifyPassword(currentPassword, user.passwordHash, user.passwordAlgo, user.legacySalt);
  if (!passwordOk) return errRedirect("invalid_current_password", 401);

  // Check if the new email is already taken by another account.
  const conflict = await prisma.user.findUnique({ where: { email: newEmail } });
  if (conflict) return errRedirect("email_taken", 409);

  // Send verification to the NEW email. The actual change is applied in /api/email/verify.
  await sendVerificationEmail(user.id, newEmail);

  await audit({
    event: "email_change_requested",
    userId: user.id,
    ipAddress: ipFrom(req),
    metadata: { newEmail },
  });

  if (isJson) return NextResponse.json({ ok: true, message: "验证邮件已发送到新邮箱，请点击链接完成更改。" });
  return new NextResponse(null, { status: 303, headers: { Location: "/account?message=email_change_sent#profile" } });
}
