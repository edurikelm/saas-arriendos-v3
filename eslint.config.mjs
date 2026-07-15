import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      ".agents/**",
      ".opencode/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Lint cleanup: downgrade no-explicit-any from error to warn globally.
    // Rationale: ~498 existing warnings are dominated by pragmatic mocks
    // (test fixtures, lib/actions inputs, third-party payloads). Refactoring
    // each one to a precise type has low ROI vs adding types is the right
    // move per-call when touching that code. See CONTEXT.md decisions.
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
