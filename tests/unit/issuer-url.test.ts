import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stubMinimalEnv(issuer: string): void {
  vi.stubEnv("ISSUER_URL", issuer);
  vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
  vi.stubEnv("COOKIE_SECRET", "a".repeat(32));
  vi.stubEnv("INTERNAL_API_TOKEN", "test-internal-token-min-16");
}

describe("absoluteIssuerUrl", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("anchors relative paths to ISSUER_URL", async () => {
    stubMinimalEnv("http://localhost:3000");
    const { absoluteIssuerUrl } = await import("@/lib/issuer-url");
    expect(absoluteIssuerUrl("/oidc/auth/abc")).toBe(
      "http://localhost:3000/oidc/auth/abc",
    );
  });

  it("rewrites 0.0.0.0 absolute URLs to ISSUER_URL host", async () => {
    stubMinimalEnv("http://localhost:3000");
    const { absoluteIssuerUrl } = await import("@/lib/issuer-url");
    expect(absoluteIssuerUrl("http://0.0.0.0:3000/account")).toBe(
      "http://localhost:3000/account",
    );
  });
});
