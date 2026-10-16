import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "where.exe" : "which";
const found = ["claude", "codex"].filter((name) => spawnSync(command, [name], { stdio: "ignore" }).status === 0);

if (found.length > 0) {
  console.error(`Provider CLIs must not be on the test PATH: ${found.join(", ")}`);
  process.exitCode = 1;
}
