import { describe, expect, it } from "vitest";

import { loginErrorMessage, registerErrorMessage } from "@/lib/auth-form-messages";

describe("auth form messages", () => {
  it("maps login invalid_credentials", () => {
    expect(loginErrorMessage("invalid_credentials")).toContain("邮箱或密码");
  });

  it("formats rate_limited with retry window", () => {
    expect(loginErrorMessage("rate_limited", 90_000)).toMatch(/2.*分钟/);
  });

  it("maps register email_taken", () => {
    expect(registerErrorMessage("email_taken")).toContain("已注册");
  });
});
