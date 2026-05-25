import argon2 from "argon2";
import bcryptjs from "bcryptjs";
import { createHash } from "node:crypto";

// Argon2id parameters recommended by spec (Section 10).
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
};

export type PasswordAlgo = "argon2id" | "bcrypt" | string;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

/**
 * Verify a password against a stored hash, supporting legacy algorithms.
 * legacySalt is reserved for historical schemes that used an external salt.
 */
export async function verifyPassword(
  plain: string,
  hash: string,
  algo: PasswordAlgo = "argon2id",
  _legacySalt?: string | null,
): Promise<boolean> {
  if (algo === "argon2id") {
    return argon2.verify(hash, plain);
  }
  if (algo === "bcrypt") {
    return bcryptjs.compare(plain, hash);
  }
  throw new Error(`Unsupported password algo: ${algo}`);
}

/**
 * Check password against HIBP k-anonymity API (spec §10).
 * Returns true if the password has been seen in known data breaches.
 * On network failure, logs and returns false to avoid blocking registration.
 */
export async function isPasswordPwned(plain: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(plain).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const resp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return false;

    const text = await resp.text();
    for (const line of text.split("\n")) {
      const [hash, countStr] = line.split(":");
      if (hash?.trim().toUpperCase() === suffix && parseInt(countStr ?? "0", 10) > 0) {
        return true;
      }
    }
    return false;
  } catch {
    console.warn("[password] HIBP check failed, skipping");
    return false;
  }
}

/**
 * Verify and transparently upgrade an old-algo hash to argon2id.
 * Returns { ok, upgradedHash? }. Callers should persist upgradedHash when present.
 */
export async function verifyAndUpgrade(
  plain: string,
  hash: string,
  algo: PasswordAlgo,
  legacySalt?: string | null,
): Promise<{ ok: boolean; upgradedHash?: string }> {
  const ok = await verifyPassword(plain, hash, algo, legacySalt);
  if (!ok) return { ok: false };
  if (algo === "argon2id") return { ok: true };
  const upgradedHash = await hashPassword(plain);
  return { ok: true, upgradedHash };
}
