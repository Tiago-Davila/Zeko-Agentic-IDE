import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_MODELS } from "@zeko/contracts";
import { ProjectConfigFile } from "../src/project-config-file.js";

describe("ProjectConfigFile", () => {
  it("returns defaults without creating a config file", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-config-"));
    try {
      const config = new ProjectConfigFile(root);
      const result = await config.getSettings();
      expect(result.defaultModels).toEqual(DEFAULT_MODELS);
      await expect(stat(config.path)).rejects.toMatchObject({ code: "ENOENT" });
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("writes only changed user settings and reads the canonical YAML back", async () => {
    const root = await mkdtemp(join(tmpdir(), "zeko-config-"));
    try {
      const config = new ProjectConfigFile(root);
      const defaults = await config.getSettings();
      await config.setSettings(defaults);
      await expect(stat(config.path)).rejects.toMatchObject({ code: "ENOENT" });
      const changed = { ...defaults, concurrencyLimit: 4 };
      await config.setSettings(changed);
      expect(await readFile(config.path, "utf8")).toContain("concurrencyLimit: 4");
      expect(await config.getSettings()).toEqual(changed);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
