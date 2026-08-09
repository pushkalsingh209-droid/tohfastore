import { describe, it, expect, vi } from "vitest";

// backupCodes.ts imports supabaseAdmin.ts, which imports the "server-only"
// marker package -- it throws unconditionally unless resolved through
// Next.js's own server build (via the "react-server" export condition),
// which plain Vitest doesn't do. None of the functions under test here
// touch Supabase, so a no-op mock is enough to let the module load.
vi.mock("server-only", () => ({}));

import { generateBackupCodes, normalizeBackupCode, hashBackupCode } from "./backupCodes";

describe("generateBackupCodes", () => {
  it("generates 8 codes by default, each XXXXX-XXXXX with no ambiguous characters", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(8);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    }
  });

  it("generates a requested count", () => {
    expect(generateBackupCodes(3)).toHaveLength(3);
  });

  it("doesn't repeat a code within a single batch (astronomically unlikely to collide)", () => {
    const codes = generateBackupCodes(20);
    expect(new Set(codes).size).toBe(20);
  });
});

describe("normalizeBackupCode / hashBackupCode", () => {
  it("normalizes case and strips the separating dash", () => {
    expect(normalizeBackupCode("abcde-fghij")).toBe("ABCDEFGHIJ");
  });

  it("hashes equivalent representations of the same code identically", () => {
    expect(hashBackupCode("abcde-fghij")).toBe(hashBackupCode("ABCDE-FGHIJ"));
    expect(hashBackupCode("abcdefghij")).toBe(hashBackupCode("ABCDE-FGHIJ"));
  });

  it("hashes different codes differently", () => {
    expect(hashBackupCode("abcde-fghij")).not.toBe(hashBackupCode("abcde-fghik"));
  });
});
