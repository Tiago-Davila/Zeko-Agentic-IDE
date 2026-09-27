import { spawnSync } from "node:child_process";

if (process.platform !== "win32") {
  console.log("test:win is only available on Windows");
} else {
  const result = spawnSync(
    "pnpm",
    ["exec", "vitest", "run", "--workspace", "vitest.workspace.ts", "--project", "win"],
    { stdio: "inherit", shell: true },
  );

  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}
