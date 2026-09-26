import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ProjectConfigSchema, type ProjectConfig } from "@zeko/contracts";
import { parseDocument, stringify } from "yaml";

export class ProjectConfigFile {
  readonly path: string;
  constructor(projectRoot: string) { this.path = join(projectRoot, ".zeko", "config.yaml"); }

  /** Missing configuration returns schema defaults and does not create project files. */
  async getSettings(): Promise<ProjectConfig> {
    let text: string;
    try { text = await readFile(this.path, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ProjectConfigSchema.parse({}); throw error; }
    const document = parseDocument(text, { uniqueKeys: true, prettyErrors: false });
    if (document.errors.length) throw new ProjectConfigError("CONFIG_PARSE_ERROR", document.errors.map((entry) => entry.message).join("; "));
    const result = ProjectConfigSchema.safeParse(document.toJS());
    if (!result.success) throw new ProjectConfigError("SCHEMA_ERROR", result.error.issues.map((entry) => `${entry.path.join(".")}: ${entry.message}`).join("; "));
    return result.data;
  }

  /** Store only an explicit, effective change; defaults remain implicit on disk. */
  async setSettings(config: ProjectConfig): Promise<ProjectConfig> {
    const parsed = ProjectConfigSchema.safeParse(config);
    if (!parsed.success) throw new ProjectConfigError("SCHEMA_ERROR", parsed.error.issues.map((entry) => entry.message).join("; "));
    const current = await this.getSettings();
    if (JSON.stringify(current) === JSON.stringify(parsed.data)) return current;
    const text = stringify(parsed.data, { indent: 2, lineWidth: 0 });
    await mkdir(join(this.path, ".."), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, text, { encoding: "utf8" });
    await rename(temporary, this.path);
    return parsed.data;
  }
}

export class ProjectConfigError extends Error {
  constructor(readonly code: "CONFIG_PARSE_ERROR" | "SCHEMA_ERROR", message: string) { super(message); this.name = "ProjectConfigError"; }
}
