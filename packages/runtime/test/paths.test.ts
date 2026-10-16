import { describe, expect, it } from "vitest";
import { getRuntimePaths } from "../src/paths.js";

describe("getRuntimePaths", () => {
  it("uses LOCALAPPDATA on Windows", () => {
    expect(getRuntimePaths({ platform: "win32", env: { LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" } })).toEqual({
      root: "C:\\Users\\me\\AppData\\Local\\Zeko",
      database: "C:\\Users\\me\\AppData\\Local\\Zeko\\zeko.db",
      worktrees: "C:\\Users\\me\\AppData\\Local\\Zeko\\wt",
      logs: "C:\\Users\\me\\AppData\\Local\\Zeko\\logs",
    });
  });

  it("uses XDG_DATA_HOME on Linux", () => {
    expect(getRuntimePaths({ platform: "linux", env: { XDG_DATA_HOME: "/state" }, home: "/home/test" })).toEqual({
      root: "/state/zeko", database: "/state/zeko/zeko.db", worktrees: "/state/zeko/wt", logs: "/state/zeko/logs",
    });
  });

  it("defaults Linux state under the home directory", () => {
    expect(getRuntimePaths({ platform: "linux", env: {}, home: "/home/test" }).root).toBe("/home/test/.local/share/zeko");
  });
});
