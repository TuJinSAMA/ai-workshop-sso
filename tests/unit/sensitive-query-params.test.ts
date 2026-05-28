import { describe, expect, it } from "vitest";

import { stripSensitiveQueryParams } from "@/lib/sensitive-query-params";

describe("stripSensitiveQueryParams", () => {
  it("removes password fields on any page", () => {
    const url = new URL("https://auth.example/account?currentPassword=x&newPassword=y");
    expect(stripSensitiveQueryParams(url)).toBe(true);
    expect(url.search).toBe("");
  });

  it("removes email on login but keeps uid", () => {
    const url = new URL("https://auth.example/login?email=a@b.c&password=secret&uid=abc");
    expect(stripSensitiveQueryParams(url)).toBe(true);
    expect(url.searchParams.get("uid")).toBe("abc");
    expect(url.searchParams.has("email")).toBe(false);
    expect(url.searchParams.has("password")).toBe(false);
  });

  it("keeps intentional token on password reset", () => {
    const url = new URL("https://auth.example/password/reset?token=signed");
    expect(stripSensitiveQueryParams(url)).toBe(false);
    expect(url.searchParams.get("token")).toBe("signed");
  });

  it("does not strip email on account page", () => {
    const url = new URL("https://auth.example/account?message=ok");
    expect(stripSensitiveQueryParams(url)).toBe(false);
  });
});
