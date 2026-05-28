import { describe, expect, it } from "vitest";

import { authFormErrorRedirect } from "@/lib/auth-form-redirect";

describe("authFormErrorRedirect", () => {
  it("303 to login with error and uid", () => {
    const res = authFormErrorRedirect("/login", "invalid_credentials", {
      uid: "abc",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("Location")).toBe(
      "/login?error=invalid_credentials&uid=abc",
    );
  });

  it("includes retryAfterMs for rate limit", () => {
    const res = authFormErrorRedirect("/login", "rate_limited", {
      retryAfterMs: 90_000,
    });
    expect(res.headers.get("Location")).toBe(
      "/login?error=rate_limited&retryAfterMs=90000",
    );
  });
});
