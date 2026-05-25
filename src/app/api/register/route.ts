import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { setSsoCookie } from "@/lib/cookies";
import { audit } from "@/lib/audit";
import { postAuthRedirect } from "@/lib/interaction";

const Body = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(256),
  // Optional: forwarded from the /login?uid= query as a hidden field so we
  // can resume the OIDC interaction once the account is created.
  uid: z.string().min(1).max(128).optional(),
});

const SECONDS_PER_DAY = 60 * 60 * 24;

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
    return NextResponse.json(
      { error: "invalid_request", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { email, password, uid } = parsed.data;
  const e = env();

  // TODO(M3): HIBP k-anonymity weak-password check before hashing.

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, passwordAlgo: "argon2id" },
  });

  const ip = ipFromRequest(req);
  const ua = req.headers.get("user-agent") ?? null;
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      expiresAt: new Date(Date.now() + e.SSO_COOKIE_TTL_DAYS * SECONDS_PER_DAY * 1000),
    },
  });
  await setSsoCookie(session.id);
  await audit({ event: "register", userId: user.id, ipAddress: ip, userAgent: ua });

  return postAuthRedirect(req, uid ?? null, user.id);
}

function ipFromRequest(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip") ?? null;
}
