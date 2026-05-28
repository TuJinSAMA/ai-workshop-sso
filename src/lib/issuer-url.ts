import { env } from "./env";

/** Canonical SSO origin from ISSUER_URL (never 0.0.0.0 bind address). */
export function issuerOrigin(): string {
  return env().ISSUER_URL.replace(/\/+$/, "");
}

/**
 * Build an absolute URL on the configured issuer. Rewrites 0.0.0.0 hosts on
 * absolute targets so browsers stay on localhost / production domain.
 */
export function absoluteIssuerUrl(pathOrUrl: string): string {
  const origin = issuerOrigin();

  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    try {
      const configured = new URL(origin);
      const parsed = new URL(pathOrUrl);
      if (parsed.hostname === "0.0.0.0") {
        parsed.protocol = configured.protocol;
        parsed.host = configured.host;
        return parsed.toString();
      }
      return pathOrUrl;
    } catch {
      return pathOrUrl;
    }
  }

  return new URL(pathOrUrl, `${origin}/`).toString();
}
