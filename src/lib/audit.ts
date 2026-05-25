import { prisma } from "./db";

export type AuditEvent =
  | "login"
  | "login_failed"
  | "logout"
  | "register"
  | "password_change"
  | "password_reset_requested"
  | "email_verification_sent"
  | "email_verified"
  | "session_revoked"
  | "token_issued"
  | "token_refreshed"
  | "token_refresh_reuse_detected"
  | "client_created"
  | "key_rotated";

export type AuditInput = {
  event: AuditEvent | string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        event: input.event,
        userId: input.userId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: (input.metadata ?? undefined) as never,
      },
    });
  } catch (err) {
    // Audit must never break the request path.
    console.error("[audit] failed to write log", err);
  }
}
