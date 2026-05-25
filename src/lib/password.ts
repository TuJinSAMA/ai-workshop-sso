import argon2 from "argon2";

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
  // TODO(Phase 1): support bcrypt and any other legacy hashes carried over
  // from ai-course-copilot's user import.
  throw new Error(`Unsupported password algo: ${algo}`);
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
