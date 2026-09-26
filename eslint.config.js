import js from "@eslint/js";
import promise from "eslint-plugin-promise";
import globals from "globals";
import tseslint from "typescript-eslint";

const infrastructure = ["node:fs", "node:child_process", "node:sqlite"];
const packageInfrastructure = ["@zeko/adapters", "@zeko/git", "@zeko/storage", "@zeko/runtime"];

export default tseslint.config(
  { ignores: ["**/dist/**", "**/out/**", "**/node_modules/**", "**/coverage/**", "spikes/**", "specs/**"] },
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
      "no-restricted-syntax": ["error",
        { selector: "TSAnyKeyword", message: "Avoid any." },
        { selector: "Identifier[name=/^(pkill|killall)$/]", message: "Terminate only registered process identities through the supervisor." },
        { selector: "CallExpression[callee.property.name='kill'][arguments.0.type!='UnaryExpression']", message: "Do not terminate an individual process handle or PID; use the process supervisor." },
        { selector: "Literal[value=/^(?:taskkill(?:\\.exe)?|\\/IM)$/i]", message: "Use the process supervisor instead of taskkill by image or raw shell command." },
        { selector: "Literal[value=/^taskkill(?:\\.exe)?\\s+[^\\n]*\\/IM\\b/i]", message: "Process termination by image name is forbidden." },
        { selector: "Literal[value=/^Stop-Process\\s+[^\\n]*-Name\\b/i]", message: "Process termination by process name is forbidden." },
        { selector: "Literal[value=/^Get-Process\\s+[^|]+\\|\\s*Stop-Process/i]", message: "Do not select processes by name for termination." },
        { selector: "Literal[value=/^(?:pkill|killall)(?:\\s|$)/i]", message: "Process termination by pattern is forbidden." },
      ],
      "promise/catch-or-return": "error",
      "promise/no-return-wrap": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },
  {
    files: ["packages/adapters/src/process/supervisor.ts"],
    rules: {
      // The supervisor is the sole allowlisted module for taskkill and Linux process-group signals.
      "no-restricted-syntax": ["error",
        { selector: "TSAnyKeyword", message: "Avoid any." },
        { selector: "Identifier[name=/^(pkill|killall)$/]", message: "Terminate only registered process identities through the supervisor." },
        { selector: "CallExpression[callee.property.name='kill'][arguments.0.type!='UnaryExpression']", message: "Do not terminate an individual process handle or PID; use the process supervisor." },
      ],
    },
  },
  {
    files: ["packages/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}"],
    languageOptions: { parserOptions: { projectService: { allowDefaultProject: ["apps/cli/test/claude-dialect.e2e.test.ts", "apps/cli/test/mixed-flow.e2e.test.ts", "apps/cli/test/t131-real-smoke.manual.test.ts"] } } },
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
