import { describe, it, expect } from "vitest";
import { getClientIp } from "./clientIp";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://example.com", { headers });
}

describe("getClientIp", () => {
  it("takes the first entry of x-forwarded-for", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("trims whitespace around the first entry", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": " 1.2.3.4 , 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("falls back to \"unknown\" when neither header is present", () => {
    expect(getClientIp(reqWith({}))).toBe("unknown");
  });
});
