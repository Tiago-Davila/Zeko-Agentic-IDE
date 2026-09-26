import { describe, expect, it, vi } from "vitest";
import { getProcessSnapshot, parseProcStat, parseWindowsProcessSnapshot } from "../../src/process/process-table.ts";

describe("process table", () => {
  it("parses Win32_Process rows and accepts a single-row JSON response", () => {
    expect(parseWindowsProcessSnapshot(JSON.stringify({
      pid: 12,
      parentPid: 4,
      creationTime: "2026-09-26T15:00:00.1234567Z",
    }))).toEqual([{ pid: 12, parentPid: 4, creationTime: 1790434800123 }]);
  });

  it("parses every row returned by the single Windows snapshot query", () => {
    const query = vi.fn(async () => JSON.stringify([
      { pid: 8, parentPid: 1, creationTime: "2026-09-26T15:00:00.000Z" },
      { pid: 9, parentPid: 8, creationTime: "2026-09-26T15:00:01.000Z" },
    ]));

    return expect(getProcessSnapshot("win32", { queryWindows: query })).resolves.toHaveLength(2).then(() => {
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores invalid Windows rows instead of inventing identities", () => {
    expect(parseWindowsProcessSnapshot(JSON.stringify([
      { pid: 8, parentPid: 1, creationTime: "2026-09-26T15:00:00.000Z" },
      { pid: "not-a-pid", parentPid: 1, creationTime: "bad" },
    ]))).toHaveLength(1);
  });

  it("parses Linux stat fields even when the executable name contains spaces and parentheses", () => {
    const fields = ["S", "101", ...Array.from({ length: 17 }, (_, index) => String(index + 2)), "987654"];
    expect(parseProcStat(`54321 (agent (worker)) ${fields.join(" ")}`)).toEqual({ pid: 54321, parentPid: 101, creationTime: 987654 });
  });

  it("reads injected /proc rows and skips processes that vanish during the snapshot", async () => {
    const readFile = vi.fn(async (path: string) => {
      if (path.endsWith("/10/stat")) return `10 (root) ${["S", "1", ...Array.from({ length: 17 }, (_, index) => String(index + 2)), "500"].join(" ")}`;
      throw new Error("ENOENT");
    });
    await expect(getProcessSnapshot("linux", { listProcPids: async () => ["10", "11"], readFile })).resolves.toEqual([
      { pid: 10, parentPid: 1, creationTime: 500 },
    ]);
  });
});
