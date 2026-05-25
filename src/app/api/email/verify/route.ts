import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";

const Body = z.object({ token: z.string().min(1).max(200) });

async function parseBody(req: NextRequest): Promise<{ data: unknown; isJson: boolean }> {
  const ct = req.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");
  if (isJson) return { data: await req.json(), isJson };
  const form = await req.formData();
  return { data: Object.fromEntries(form.entries()), isJson };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return handleVerify(req, token, false);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { data: raw, isJson } = await parseBody(req);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    if (isJson) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    return new NextResponse(null, { status: 303, headers: { Location: "/verify-email?error=invalid_request" } });
  }
  return handleVerify(req, parsed.data.token, isJson);
}

async function handleVerify(req: NextRequest, token: string, isJson: boolean): Promise<NextResponse> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    if (isJson) return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });
    return new NextResponse(null, {
      status: 303,
      headers: { Location: "/verify-email?error=invalid_or_expired_token" },
    });
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { email: record.email, emailVerified: true },
    }),
  ]);

  await audit({
    event: "email_verified",
    userId: record.userId,
    ipAddress: ipFrom(req),
    metadata: { email: record.email },
  });

  if (isJson) return NextResponse.json({ ok: true });
  return new NextResponse(null, { status: 303, headers: { Location: "/account?message=email_verified" } });
}

function ipFrom(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip") ?? null;
}
