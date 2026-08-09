import { defineConfig } from "vitest/config";
import path from "path";

// Mirrors the "@/*" -> "./*" path alias in tsconfig.json -- Vitest doesn't
// read tsconfig paths on its own, so utils that import via "@/..." (e.g.
// backupCodes.ts importing supabaseAdmin.ts) need it repeated here.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
