/**
 * Secure one-time token utilities for password reset and email verification.
 * Tokens are 32 random bytes, base64url-encoded, SHA-256 hashed before storage.
 */
import { randomBytes, createHash } from "node:crypto";

export const RESET_TOKEN_TTL_MINUTES = 30;
export const VERIFY_TOKEN_TTL_MINUTES = 60 * 24; // 24 hours

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function tokenExpiresAt(ttlMinutes: number): Date {
  return new Date(Date.now() + ttlMinutes * 60 * 1000);
}
