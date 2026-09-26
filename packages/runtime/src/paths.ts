import { homedir } from "node:os";
import { posix, win32 } from "node:path";

export interface RuntimePaths {
  readonly root: string;
  readonly database: string;
  readonly worktrees: string;
  readonly logs: string;
}

export interface RuntimePathOptions {
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
  readonly home?: string;
}

/** Resolve persistent Zeko state without consulting the host OS during tests. */
export function getRuntimePaths(options: RuntimePathOptions = {}): RuntimePaths {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  if (platform === "win32") {
    const base = env["LOCALAPPDATA"] || win32.join(home, "AppData", "Local");
    const root = win32.join(base, "Zeko");
    return { root, database: win32.join(root, "zeko.db"), worktrees: win32.join(root, "wt"), logs: win32.join(root, "logs") };
  }
  const root = posix.join(env["XDG_DATA_HOME"] || posix.join(home, ".local", "share"), "zeko");
  return { root, database: posix.join(root, "zeko.db"), worktrees: posix.join(root, "wt"), logs: posix.join(root, "logs") };
}
