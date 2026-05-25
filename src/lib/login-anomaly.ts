/**
 * Anomaly login detection (spec §10 "异常登录告警").
 * On each successful login, check whether the IP and UA combination is
 * "known" (seen in the last 30 days). If not, send a new-device email alert.
 */
import { prisma } from "./db";
import { emailService } from "./email";
import { newDeviceLoginEmail } from "./email-templates";

const KNOWN_WINDOW_DAYS = 30;

export async function checkAndAlertAnomalousLogin(params: {
  userId: string;
  email: string;
  ipAddress: string | null;
  userAgent: string | null;
  loginAt: Date;
}): Promise<void> {
  const { userId, email, ipAddress, userAgent, loginAt } = params;

  if (!ipAddress && !userAgent) return;

  const since = new Date(Date.now() - KNOWN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Count prior successful logins from this same IP+UA in the last 30 days.
  const known = await prisma.loginAttempt.count({
    where: {
      userId,
      success: true,
      ipAddress: ipAddress ?? undefined,
      // Exclude the current login (createdAt < now but > since).
      createdAt: { gte: since, lt: loginAt },
    },
  });

  if (known > 0) return; // Already seen this device — not anomalous.

  // New device detected: send alert (non-blocking).
  const { subject, html, text } = newDeviceLoginEmail({
    email,
    ipAddress: ipAddress ?? "unknown",
    userAgent: userAgent ?? "unknown",
    loginAt,
  });

  emailService()
    .send({ to: email, subject, html, text })
    .catch((err) => console.error("[anomaly] Failed to send new-device alert:", err));
}
