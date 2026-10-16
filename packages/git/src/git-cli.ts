import { spawn } from "node:child_process";

export interface GitCommandResult {
  stdout: string;
  stderr: string;
}

export interface GitCommandOptions {
  cwd: string;
  gitPath?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  config?: Record<string, string>;
}

export class GitCommandError extends Error {
  override readonly name = "GitCommandError";
  readonly context: {
    command: string;
    args: string[];
    cwd: string;
    exitCode?: number;
    stderr?: string;
  };

  constructor(message: string, context: GitCommandError["context"], options?: ErrorOptions) {
    super(message, options);
    this.context = context;
  }
}

/** Runs git without a shell and enables long paths on Windows for every invocation. */
export function runGit(
  command: string,
  args: string[],
  options: GitCommandOptions,
): Promise<GitCommandResult> {
  const gitArgs = [
    "-c",
    "core.longpaths=true",
    ...Object.entries(options.config ?? {}).flatMap(([key, value]) => ["-c", `${key}=${value}`]),
    command,
    ...args,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(options.gitPath ?? "git", gitArgs, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      windowsHide: true,
      signal: options.signal,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", (cause: Error) => {
      reject(
        new GitCommandError(
          `Unable to start git ${command}`,
          {
            command,
            args: [...args],
            cwd: options.cwd,
          },
          { cause },
        ),
      );
    });
    child.once("close", (exitCode) => {
      const errorText = Buffer.concat(stderr).toString("utf8");
      if (exitCode !== 0) {
        reject(
          new GitCommandError(`git ${command} failed with exit code ${String(exitCode)}`, {
            command,
            args: [...args],
            cwd: options.cwd,
            ...(exitCode === null ? {} : { exitCode }),
            ...(errorText ? { stderr: errorText } : {}),
          }),
        );
        return;
      }
      resolve({ stdout: Buffer.concat(stdout).toString("utf8"), stderr: errorText });
    });
  });
}
