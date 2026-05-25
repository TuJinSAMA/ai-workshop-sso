import { cookies } from "next/headers";
import { env } from "./env";

// SSO cookie helpers (spec Section 12.6). The cookie value is the SSO Session.id.
// Signing/encryption is handled by oidc-provider's own cookie keys for its
// internal cookies; this helper is for the persistent SSO browser cookie that
// indicates "this UA has an authenticated session at the IdP".

const SECONDS_PER_DAY = 60 * 60 * 24;

export async function setSsoCookie(sessionId: string): Promise<void> {
  const e = env();
  const jar = await cookies();
  jar.set({
    name: e.SSO_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    secure: e.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: e.SSO_COOKIE_DOMAIN || undefined,
    maxAge: e.SSO_COOKIE_TTL_DAYS * SECONDS_PER_DAY,
  });
}

export async function readSsoCookie(): Promise<string | undefined> {
  const e = env();
  const jar = await cookies();
  return jar.get(e.SSO_COOKIE_NAME)?.value;
}

export async function clearSsoCookie(): Promise<void> {
  const e = env();
  const jar = await cookies();
  jar.set({
    name: e.SSO_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: e.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: e.SSO_COOKIE_DOMAIN || undefined,
    maxAge: 0,
  });
}
