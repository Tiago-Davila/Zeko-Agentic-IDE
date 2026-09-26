import { readdir, readFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

export interface ProcessEntry {
  readonly pid: number;
  readonly parentPid: number;
  readonly creationTime: number;
}

export interface ProcessTableDependencies {
  readonly queryWindows?: () => Promise<string>;
  readonly listProcPids?: () => Promise<string[]>;
  readonly readFile?: (path: string) => Promise<string>;
}

const WINDOWS_WORKER_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "while ($null -ne [Console]::In.ReadLine()) {",
  "  try {",
  "    foreach ($entry in Get-CimInstance -Query 'SELECT ProcessId,ParentProcessId,CreationDate FROM Win32_Process') { $creation = [long]($entry.CreationDate.ToFileTimeUtc() / 10000 - 11644473600000); [Console]::Out.WriteLine((\"{0}`t{1}`t{2}\" -f $entry.ProcessId, $entry.ParentProcessId, $creation)) }",
  "  } catch {",
  "    [Console]::Out.WriteLine('__ZEKO_PROCESS_SNAPSHOT_ERROR__' + $_.Exception.Message)",
  "  }",
  "  [Console]::Out.WriteLine('__ZEKO_PROCESS_SNAPSHOT_END__')",
  "  [Console]::Out.Flush()",
  "}",
].join("\n");
const WINDOWS_SNAPSHOT_END = "__ZEKO_PROCESS_SNAPSHOT_END__";
let windowsSnapshotWorker: WindowsSnapshotWorker | undefined;

export async function getProcessSnapshot(
  platform: NodeJS.Platform = process.platform,
  dependencies: ProcessTableDependencies = {},
): Promise<ProcessEntry[]> {
  if (platform === "win32") {
    const json = await (dependencies.queryWindows ?? queryWindowsProcessTable)();
    return parseWindowsProcessSnapshot(json);
  }
  if (platform === "linux") {
    const pids = await (dependencies.listProcPids ?? (() => readdir("/proc")))();
    const read = dependencies.readFile ?? ((path: string) => readFile(path, "utf8"));
    const rows = await Promise.all(pids.filter((pid) => /^\d+$/.test(pid)).map(async (pid) => {
      try {
        const parsed = parseProcStat(await read(`/proc/${pid}/stat`));
        return parsed?.pid === Number(pid) ? parsed : undefined;
      } catch {
        // Processes may exit or become inaccessible between listing /proc and reading stat.
        return undefined;
      }
    }));
    return rows.filter((row): row is ProcessEntry => row !== undefined);
  }
  throw new Error(`Process snapshots are not implemented for ${platform}`);
}

export function parseWindowsProcessSnapshot(json: string): ProcessEntry[] {
  if (json.trim().length === 0) return [];
  const value: unknown = JSON.parse(json);
  const rows = Array.isArray(value) ? value : [value];
  const processes: ProcessEntry[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const pid = parsePositiveInteger(row["pid"]);
    const parentPid = parseNonNegativeInteger(row["parentPid"]);
    const creationValue = row["creationTime"];
    const creationTime = typeof creationValue === "number"
      ? creationValue
      : typeof creationValue === "string" && Number.isFinite(Number(creationValue))
        ? Number(creationValue)
        : typeof creationValue === "string" ? Date.parse(creationValue) : Number.NaN;
    if (pid !== undefined && parentPid !== undefined && Number.isFinite(creationTime)) {
      processes.push({ pid, parentPid, creationTime });
    }
  }
  return processes;
}

export function parseProcStat(stat: string): ProcessEntry | undefined {
  const opening = stat.indexOf(" (");
  const closing = stat.lastIndexOf(")");
  if (opening <= 0 || closing <= opening) return undefined;
  const pid = parsePositiveInteger(stat.slice(0, opening));
  const fields = stat.slice(closing + 1).trim().split(/\s+/);
  // The remainder begins at field 3 (state); ppid is field 4 and starttime is field 22.
  const parentPid = parseNonNegativeInteger(fields[1]);
  const creationTime = parseNonNegativeInteger(fields[19]);
  if (pid === undefined || parentPid === undefined || creationTime === undefined) return undefined;
  return { pid, parentPid, creationTime };
}

function queryWindowsProcessTable(): Promise<string> {
  windowsSnapshotWorker ??= new WindowsSnapshotWorker();
  return windowsSnapshotWorker.query();
}

class WindowsSnapshotWorker {
  readonly #child: ChildProcess;
  readonly #lines: ReturnType<typeof createInterface>;
  #current: { readonly lines: string[]; readonly resolve: (value: string) => void; readonly reject: (error: Error) => void } | undefined;
  #busy = false;

  constructor() {
    this.#child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", WINDOWS_WORKER_SCRIPT], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (!this.#child.stdin || !this.#child.stdout || !this.#child.stderr) throw new Error("PowerShell snapshot worker pipes were not created");
    this.#child.stderr.resume();
    this.#lines = createInterface({ input: this.#child.stdout, crlfDelay: Infinity });
    this.#lines.on("line", (line) => this.#onLine(line));
    this.#child.once("error", (error) => this.#fail(error));
    this.#child.once("close", (code) => this.#fail(new Error(`Win32_Process snapshot worker exited (${code ?? "unknown"})`)));
  }

  query(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.#child.stdin || this.#child.stdin.destroyed || !this.#child.stdin.writable) {
        reject(new Error("PowerShell snapshot worker stdin is unavailable"));
        return;
      }
      this.#queue.push({ lines: [], resolve, reject });
      this.#pump();
    });
  }

  readonly #queue: Array<{ readonly lines: string[]; readonly resolve: (value: string) => void; readonly reject: (error: Error) => void }> = [];

  #pump(): void {
    if (this.#busy || this.#queue.length === 0) return;
    this.#busy = true;
    this.#current = this.#queue.shift();
    this.#child.stdin!.write("snapshot\n", "utf8", (error) => {
      if (error) this.#fail(error);
    });
  }

  #onLine(line: string): void {
    if (line === WINDOWS_SNAPSHOT_END) {
      const current = this.#current;
      this.#current = undefined;
      this.#busy = false;
      if (current) {
        try {
          const error = current.lines.find((line) => line.startsWith("__ZEKO_PROCESS_SNAPSHOT_ERROR__"));
          if (error) throw new Error(error.slice("__ZEKO_PROCESS_SNAPSHOT_ERROR__".length));
          const rows = current.lines.filter((line) => line.length > 0).map((line) => {
            const [pid, parentPid, creationTime] = line.split("\t");
            return { pid: Number(pid), parentPid: Number(parentPid), creationTime: Number(creationTime) };
          });
          current.resolve(JSON.stringify(rows));
        } catch (error) {
          current.reject(error instanceof Error ? error : new Error("Invalid Win32_Process snapshot response"));
        }
      }
      this.#pump();
      return;
    }
    this.#current?.lines.push(line);
  }

  #fail(error: Error): void {
    this.#current?.reject(error);
    this.#current = undefined;
    this.#busy = false;
    for (const queued of this.#queue.splice(0)) queued.reject(error);
  }
}

function parsePositiveInteger(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function parseNonNegativeInteger(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
