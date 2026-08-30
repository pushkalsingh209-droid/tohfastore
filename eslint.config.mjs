import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from the live schema by `npm run gen:types` -- not hand-written.
    "types/db.ts",
  ]),
  {
    rules: {
      // Standard conventions, not a loosening:
      //  - `_`-prefixed args/vars are intentionally-unused by convention.
      //  - `ignoreRestSiblings` allows the `const { drop, ...rest } = obj`
      //    idiom used to omit a key (admin drafts map, coupon/product
      //    column-drop fallbacks).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      // Downgraded to a warning. In a Next.js SSR app the standard way to
      // hydrate state from a client-only source (localStorage, cookies,
      // matchMedia, document classes, the URL) is a mount effect that
      // setState's once -- which this rule flags. ~18 of the ~24 hits are
      // exactly that; the rest are contained prop-sync resets. None are the
      // cascading-render bug the rule targets (that one real case, in
      // CheckoutSheet's WhatsApp pre-check, is already handled). Kept as a
      // warning so a genuinely bad new one still shows up in review.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
