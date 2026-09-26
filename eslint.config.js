import js from "@eslint/js";
import promise from "eslint-plugin-promise";
import globals from "globals";
import tseslint from "typescript-eslint";

const infrastructure = ["node:fs", "node:child_process", "node:sqlite"];
const packageInfrastructure = ["@zeko/adapters", "@zeko/git", "@zeko/storage", "@zeko/runtime"];

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "spikes/**", "specs/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,ts,tsx,mjs,cjs}", "**/*.config.{js,ts,mjs,cjs}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { promise },
    rules: {
      "no-restricted-syntax": ["error", { selector: "TSAnyKeyword", message: "Avoid any." }],
      "promise/catch-or-return": "error",
      "promise/no-return-wrap": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },
  {
    files: ["packages/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}"],
    languageOptions: { parserOptions: { projectService: true } },
    rules: { "@typescript-eslint/no-floating-promises": "error" },
  },
  {
    files: ["packages/core/src/**/*"],
    rules: {
      "no-restricted-imports": ["error", { paths: [...infrastructure, ...packageInfrastructure].map((name) => ({ name, message: "core must remain infrastructure-free." })) }],
    },
  },
  {
    files: ["packages/{adapters,git,storage}/src/**/*"],
    rules: {
      "no-restricted-imports": ["error", { paths: ["@zeko/core", "@zeko/runtime", "@zeko/adapters", "@zeko/git", "@zeko/storage", "@zeko/i18n"].map((name) => ({ name, message: "Infrastructure packages only depend on contracts." })) }],
    },
  },
  {
    files: ["packages/*/src/**/*", "apps/*/src/**/*"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@zeko/testing", "../../testing", "../../../testing"], message: "Testing helpers are only allowed in tests." }] }],
    },
  },
  {
    files: ["apps/desktop/src/renderer/**/*"],
    languageOptions: { globals: globals.browser },
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["node:*", "electron", "fs", "child_process"], message: "The renderer cannot import Node APIs." }] }],
    },
  },
);
