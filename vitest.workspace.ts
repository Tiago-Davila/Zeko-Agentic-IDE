import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: { name: "unit", include: ["**/*.test.ts", "**/*.spec.ts", "**/*.test.tsx", "**/*.spec.tsx"], exclude: ["**/*.win.test.ts"] },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "win",
      include: ["**/*.win.test.ts"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
    },
  },
]);
