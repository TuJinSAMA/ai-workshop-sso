import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Symmetric encryption for at-rest secrets (currently: JWKS private keys
// stored in the SigningKey table). AES-256-GCM with a per-record random IV.
//
// Master key source priority:
//   1. JWKS_ENCRYPTION_KEY — 32 random bytes encoded as hex (preferred)
//   2. COOKIE_SECRET, derived via scrypt (fallback so the project boots in
//      dev without extra setup; do NOT rely on this in production)
//
// Ciphertext format (base64): iv (12B) || tag (16B) || ciphertext (Nb)

const IV_BYTES = 12;
const TAG_BYTES = 16;

function getMasterKey(): Buffer {
  const hex = process.env.JWKS_ENCRYPTION_KEY;
  if (hex) {
    const buf = Buffer.from(hex, "hex");
    if (buf.length !== 32) {
      throw new Error("JWKS_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
    }
    return buf;
  }
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret) {
    throw new Error("Neither JWKS_ENCRYPTION_KEY nor COOKIE_SECRET is set");
  }
  // Deterministic derivation so the same secret yields the same KEK across restarts.
  return scryptSync(cookieSecret, "ai-workshop-sso:jwks-kek", 32);
}

export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const key = getMasterKey();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const enc = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
