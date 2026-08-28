import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Pre-existing codebase debt — keep visible as warnings, don't block deploy.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "@next/next/no-img-element": "warn",
    },
  },
  {
    // cai/ is a self-contained CommonJS CLI sub-project (its own package.json,
    // run via `node index.js`, no "type":"module"). It intentionally uses
    // require()/module.exports, which the Next/TS config forbids as errors.
    // Relax only require-related rules for this subtree so its existing,
    // behavior-preserving CommonJS style isn't rejected by the app config.
    files: ["cai/**/*.{js,cjs,mjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    ".pw-browsers/**",
    ".tmp-*.log",
  ]),
]);

export default eslintConfig;
