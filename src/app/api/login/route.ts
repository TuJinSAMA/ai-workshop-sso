import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyAndUpgrade } from "@/lib/password";
import { setSsoCookie } from "@/lib/cookies";
import { audit } from "@/lib/audit";
import { loginByEmail, loginByIp } from "@/lib/rate-limit";
import { postAuthRedirect } from "@/lib/interaction";
import { checkAndAlertAnomalousLogin } from "@/lib/login-anomaly";

const Body = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
  uid: z.string().min(1).max(128).optional(),
});

const SECONDS_PER_DAY = 60 * 60 * 24;

async function parseBody(req: NextRequest): Promise<unknown> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return req.json();
  const form = await req.formData();
  return Object.fromEntries(form.entries());
}

function ipFromRequest(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "0.0.0.0";
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
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
  const ip = ipFromRequest(req);
  const ua = req.headers.get("user-agent") ?? null;

  // Rate-limit: 5/15min per email, 20/15min per IP (spec §10).
  const [emailGate, ipGate] = await Promise.all([
    loginByEmail.limit(email),
    loginByIp.limit(ip),
  ]);
  if (!emailGate.success || !ipGate.success) {
    return NextResponse.json(
      {
        error: "rate_limited",
        retryAfterMs: Math.max(emailGate.resetMs, ipGate.resetMs),
      },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  const failAndLog = async (reason: string) => {
    await prisma.loginAttempt.create({
      data: {
        userId: user?.id ?? null,
        email,
        ipAddress: ip,
        success: false,
        failReason: reason,
      },
    });
    await audit({
      event: "login_failed",
      userId: user?.id ?? null,
      ipAddress: ip,
      userAgent: ua,
      metadata: { reason },
    });
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  };

  if (!user || !user.passwordHash) return failAndLog("no_user_or_password");
  if (user.status !== "ACTIVE") return failAndLog("user_disabled");

  const { ok, upgradedHash } = await verifyAndUpgrade(
    password,
    user.passwordHash,
    user.passwordAlgo,
    user.legacySalt,
  );
  if (!ok) return failAndLog("bad_password");

  if (upgradedHash) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: upgradedHash, passwordAlgo: "argon2id", legacySalt: null },
    });
  }

  await prisma.loginAttempt.create({
    data: { userId: user.id, email, ipAddress: ip, success: true },
  });

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      ipAddress: ip,
      userAgent: ua,
      expiresAt: new Date(Date.now() + e.SSO_COOKIE_TTL_DAYS * SECONDS_PER_DAY * 1000),
    },
  });
  await setSsoCookie(session.id);
  await audit({ event: "login", userId: user.id, ipAddress: ip, userAgent: ua });

  // Anomaly detection: alert user if this is a new device/IP (non-blocking).
  const loginAt = new Date();
  checkAndAlertAnomalousLogin({
    userId: user.id,
    email,
    ipAddress: ip,
    userAgent: ua,
    loginAt,
  }).catch((err) => console.error("[login] Anomaly check error:", err));

  return postAuthRedirect(req, uid ?? null, user.id);
}
