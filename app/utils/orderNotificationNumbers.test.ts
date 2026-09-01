import { describe, it, expect } from "vitest";
import { resolveSupplierTargets, isValidOrderNotificationNumber } from "./orderNotificationNumbers";

const BIZ = "916302672351";

describe("resolveSupplierTargets", () => {
  it("returns the distinct in-list supplier numbers across the order's products", () => {
    const targets = resolveSupplierTargets(
      [["919000000001", "919000000002"], ["919000000002"], null, undefined],
      ["919000000001", "919000000002", "919000000009"],
      BIZ
    );
    expect(targets.sort()).toEqual(["919000000001", "919000000002"]);
  });

  it("drops a number that's no longer in the managed list", () => {
    const targets = resolveSupplierTargets([["919000000001", "919000000003"]], ["919000000001"], BIZ);
    expect(targets).toEqual(["919000000001"]);
  });

  it("never includes the business number even if a product lists it", () => {
    const targets = resolveSupplierTargets([[BIZ, "919000000001"]], [BIZ, "919000000001"], BIZ);
    expect(targets).toEqual(["919000000001"]);
  });

  it("returns [] when no product has suppliers", () => {
    expect(resolveSupplierTargets([null, undefined, []], ["919000000001"], BIZ)).toEqual([]);
  });

  it("trims and ignores blank entries", () => {
    expect(resolveSupplierTargets([[" 919000000001 ", "", "  "]], ["919000000001"], BIZ)).toEqual(["919000000001"]);
  });
});

describe("isValidOrderNotificationNumber", () => {
  it("accepts canonical 91 + 10-digit (6-9 lead) numbers", () => {
    expect(isValidOrderNotificationNumber("919812345678")).toBe(true);
    expect(isValidOrderNotificationNumber("916302672351")).toBe(true);
  });
  it("rejects the rest", () => {
    for (const bad of ["9812345678", "911234567890", "9198123456", "+919812345678", "", 42, null]) {
      expect(isValidOrderNotificationNumber(bad as unknown)).toBe(false);
    }
  });
});
