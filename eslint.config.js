import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "design"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // SV-01: errors go through reportError (src/lib/errors/report.ts). SV-26: an error.
      "no-console": "error",
    },
  },
  {
    // The one module allowed to print an error, in development.
    files: ["src/lib/errors/report.ts"],
    rules: { "no-console": "off" },
  },
  {
    // The rule is for the app (src). The Node scripts, the edge functions (whose logs are console output) and the
    // e2e audits (which print their reports) print on purpose.
    files: ["scripts/**", "supabase/functions/**", "e2e/**"],
    rules: { "no-console": "off" },
  },
);
