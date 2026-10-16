import { existsSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";

export type CodexBinaryErrorCode = "CODEX_BINARY_NOT_INJECTED" | "CODEX_NATIVE_BINARY_NOT_FOUND" | "CODEX_SHIM_UNSUPPORTED";

export class CodexBinaryError extends Error {
  constructor(readonly code: CodexBinaryErrorCode, message: string) {
    super(message);
    this.name = "CodexBinaryError";
  }
}

export interface ResolveCodexBinaryOptions {
  readonly binaryPath?: string;
  readonly platform?: NodeJS.Platform;
  readonly env?: NodeJS.ProcessEnv;
  readonly exists?: (path: string) => boolean;
}

const nativeSuffix = ["vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe"];

/** Finds only the native Windows Codex executable; a node-based shim cannot own process cancellation. */
export function resolveCodexBinary(options: ResolveCodexBinaryOptions = {}): string {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  if (options.binaryPath) return validateInjectedPath(options.binaryPath, exists);
  if (env["ZEKO_TEST"] === "1") {
    throw new CodexBinaryError("CODEX_BINARY_NOT_INJECTED", "CODEX_BINARY_NOT_INJECTED: provide binaryPath when ZEKO_TEST=1");
  }
  if (platform !== "win32") {
    throw new CodexBinaryError("CODEX_NATIVE_BINARY_NOT_FOUND", "CODEX_NATIVE_BINARY_NOT_FOUND: native Codex resolution is only verified on Windows");
  }

  const roots = new Set<string>();
  for (const entry of (env["PATH"] ?? "").split(delimiter)) {
    const binDirectory = entry.trim().replace(/^"|"$/gu, "");
    if (!binDirectory) continue;
    roots.add(join(binDirectory, "node_modules"));
    roots.add(join(dirname(binDirectory), "node_modules"));
    roots.add(binDirectory);
  }
  const candidates = [...roots].flatMap((root) => [
    join(root, "@openai", "codex", "node_modules", "@openai", "codex-win32-x64", ...nativeSuffix),
    join(root, "@openai", "codex-win32-x64", ...nativeSuffix),
  ]);
  const binary = candidates.find((candidate) => exists(candidate));
  if (binary) return binary;
  throw new CodexBinaryError("CODEX_NATIVE_BINARY_NOT_FOUND", "CODEX_NATIVE_BINARY_NOT_FOUND: the native @openai/codex-win32-x64 executable was not found; the codex.cmd shim is not supported");
}

function validateInjectedPath(binaryPath: string, exists: (path: string) => boolean): string {
  if (/\.cmd$/iu.test(binaryPath) || /\.ps1$/iu.test(binaryPath)) {
    throw new CodexBinaryError("CODEX_SHIM_UNSUPPORTED", "CODEX_SHIM_UNSUPPORTED: Codex must be launched through its native executable, not a command shim");
  }
  const absolutePath = isAbsolute(binaryPath) ? binaryPath : resolve(binaryPath);
  if (!exists(absolutePath)) {
    throw new CodexBinaryError("CODEX_NATIVE_BINARY_NOT_FOUND", "CODEX_NATIVE_BINARY_NOT_FOUND: the configured Codex executable does not exist");
  }
  return absolutePath;
}
