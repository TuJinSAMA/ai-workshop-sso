import { createHash, randomBytes } from "node:crypto";

// PKCE + state helpers (RFC 7636 + OAuth 2.0).
// oidc-provider handles most of this internally for the IdP side; these
// utilities are useful for the demo client and for internal verification.

export function randomUrlSafe(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  return pkceChallengeS256(verifier) === challenge;
}
