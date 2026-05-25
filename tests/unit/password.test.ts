import { describe, expect, it } from "vitest";
import bcryptjs from "bcryptjs";
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

  it("verifies bcrypt hashes (legacy algo support)", async () => {
    const hash = await bcryptjs.hash("legacy-password", 10);
    expect(await verifyPassword("legacy-password", hash, "bcrypt")).toBe(true);
    expect(await verifyPassword("wrong", hash, "bcrypt")).toBe(false);
  });

  it("verifyAndUpgrade upgrades bcrypt to argon2id on success", async () => {
    const hash = await bcryptjs.hash("old-password", 10);
    const r = await verifyAndUpgrade("old-password", hash, "bcrypt");
    expect(r.ok).toBe(true);
    expect(r.upgradedHash).toMatch(/^\$argon2id\$/);
  });

  it("rejects unsupported algos", async () => {
    await expect(verifyPassword("x", "hash", "md5")).rejects.toThrow("Unsupported password algo: md5");
  });
});
