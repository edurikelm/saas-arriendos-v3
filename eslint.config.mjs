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
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // P1-tests: relax no-explicit-any for test files (mocks/fixtures).
    // Code in lib/actions, components, api routes, etc. remains strict.
    // See docs/handoffs/lint-cleanup.md for the rationale.
    files: [
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "**/__mocks__/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
