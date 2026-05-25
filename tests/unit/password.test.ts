import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, verifyAndUpgrade } from "../../src/lib/password";

describe("password", () => {
  it("hashes and verifies argon2id", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("verifyAndUpgrade returns no upgrade for argon2id", async () => {
    const hash = await hashPassword("hello world");
    const r = await verifyAndUpgrade("hello world", hash, "argon2id");
    expect(r.ok).toBe(true);
    expect(r.upgradedHash).toBeUndefined();
  });

  it("rejects unsupported algos", async () => {
    await expect(verifyPassword("x", "$bcrypt$abc", "bcrypt")).rejects.toThrow();
  });
});
