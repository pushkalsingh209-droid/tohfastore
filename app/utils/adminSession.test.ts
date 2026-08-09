import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { createAdminSessionToken, isValidAdminSessionToken } from "./adminSession";

const SECRET = "test_session_secret";

describe("admin session token", () => {
  it("accepts a token it just issued", () => {
    const token = createAdminSessionToken(SECRET);
    expect(isValidAdminSessionToken(token, SECRET)).toBe(true);
  });

  it("rejects a token verified against a different secret", () => {
    const token = createAdminSessionToken(SECRET);
    expect(isValidAdminSessionToken(token, "wrong_secret")).toBe(false);
  });

  it("rejects a tampered expiry with the original signature reused", () => {
    const token = createAdminSessionToken(SECRET);
    const [, signature] = token.split(".");
    const farFuture = Date.now() + 1000 * 60 * 60 * 24 * 365;
    const tampered = `${farFuture}.${signature}`;
    expect(isValidAdminSessionToken(tampered, SECRET)).toBe(false);
  });

  it("rejects an expired token", () => {
    // Build a token as if it were signed to expire in the past.
    const past = Date.now() - 1000;
    const signature = crypto.createHmac("sha256", SECRET).update(String(past)).digest("hex");
    const expiredToken = `${past}.${signature}`;
    expect(isValidAdminSessionToken(expiredToken, SECRET)).toBe(false);
  });

  it("rejects missing token or secret", () => {
    expect(isValidAdminSessionToken(null, SECRET)).toBe(false);
    expect(isValidAdminSessionToken(undefined, SECRET)).toBe(false);
    expect(isValidAdminSessionToken(createAdminSessionToken(SECRET), undefined)).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(isValidAdminSessionToken("not-a-real-token", SECRET)).toBe(false);
    expect(isValidAdminSessionToken("12345", SECRET)).toBe(false);
  });
});
