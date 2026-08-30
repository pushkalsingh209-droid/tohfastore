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
    },
  },
]);

export default eslintConfig;
