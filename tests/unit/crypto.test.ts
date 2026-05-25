import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret } from "../../src/lib/crypto";

let prevKey: string | undefined;
let prevCookie: string | undefined;

beforeAll(() => {
  prevKey = process.env.JWKS_ENCRYPTION_KEY;
  prevCookie = process.env.COOKIE_SECRET;
  process.env.JWKS_ENCRYPTION_KEY = "0".repeat(64);
});

afterAll(() => {
  if (prevKey === undefined) delete process.env.JWKS_ENCRYPTION_KEY;
  else process.env.JWKS_ENCRYPTION_KEY = prevKey;
  if (prevCookie !== undefined) process.env.COOKIE_SECRET = prevCookie;
});

describe("crypto", () => {
  it("round-trips AES-256-GCM with hex master key", () => {
    const ct = encryptSecret("hello secret");
    expect(ct).not.toContain("hello");
    expect(decryptSecret(ct)).toBe("hello secret");
  });

  it("yields different ciphertexts for same plaintext (random IV)", () => {
    const a = encryptSecret("x");
    const b = encryptSecret("x");
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext", () => {
    const ct = encryptSecret("payload");
    const buf = Buffer.from(ct, "base64");
    buf[buf.length - 1] ^= 0x01;
    expect(() => decryptSecret(buf.toString("base64"))).toThrow();
  });
});
