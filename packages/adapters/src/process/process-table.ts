import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

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

const WINDOWS_QUERY = "Get-CimInstance -ClassName Win32_Process | Select-Object @{Name='pid';Expression={$_.ProcessId}},@{Name='parentPid';Expression={$_.ParentProcessId}},@{Name='creationTime';Expression={$_.CreationDate.ToUniversalTime().ToString('o')}} | ConvertTo-Json -Compress";

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
    const creationTime = typeof row["creationTime"] === "string" ? Date.parse(row["creationTime"]) : Number.NaN;
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
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", WINDOWS_QUERY], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Win32_Process snapshot failed (${code}): ${stderr.trim()}`));
    });
  });
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
