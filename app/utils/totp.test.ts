import { describe, it, expect } from "vitest";
import { verifyTOTP, generateTOTP, base32Decode } from "./totp";

const SECRET = "JBSWY3DPEHPK3PXP"; // arbitrary base32 test secret
const STEP_MS = 30_000;

describe("verifyTOTP", () => {
  it("accepts the code generated for the current step", () => {
    const now = Date.now();
    const code = generateTOTP(SECRET, now);
    expect(verifyTOTP(SECRET, code, { timestamp: now })).toBe(true);
  });

  it("accepts a code from one step drift within the default window", () => {
    const now = Date.now();
    const previousStepCode = generateTOTP(SECRET, now - STEP_MS);
    expect(verifyTOTP(SECRET, previousStepCode, { timestamp: now })).toBe(true);
  });

  it("rejects a code from outside the allowed window", () => {
    const now = Date.now();
    const farCode = generateTOTP(SECRET, now - STEP_MS * 5);
    expect(verifyTOTP(SECRET, farCode, { timestamp: now })).toBe(false);
  });

  it("rejects a code generated from a different secret", () => {
    const now = Date.now();
    const wrongSecretCode = generateTOTP("AAAAAAAAAAAAAAAA", now);
    expect(verifyTOTP(SECRET, wrongSecretCode, { timestamp: now })).toBe(false);
  });

  it("rejects malformed input instead of throwing", () => {
    expect(verifyTOTP(SECRET, "")).toBe(false);
    expect(verifyTOTP(SECRET, "12345")).toBe(false);
    expect(verifyTOTP(SECRET, "abcdef")).toBe(false);
    expect(verifyTOTP("", "123456")).toBe(false);
  });
});

describe("base32Decode", () => {
  it("round-trips known RFC 4648 test vectors", () => {
    expect(base32Decode("MY======").toString("utf8")).toBe("f");
    expect(base32Decode("MZXQ====").toString("utf8")).toBe("fo");
    expect(base32Decode("MZXW6===").toString("utf8")).toBe("foo");
  });
});
