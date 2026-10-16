import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { FlowFileSchema, type Diagnostic, type FlowFile } from "@zeko/contracts";
import { parseDocument, isMap, isSeq, stringify, type Document, type Node as YamlNode } from "yaml";

const hash = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const flowName = (id: string) => `${id}.flow.yaml`;

export class FlowFileError extends Error {
  constructor(readonly code: "FLOW_EXISTS" | "CONFIRMATION_REQUIRED" | "FILE_CHANGED_ON_DISK" | "SCHEMA_ERROR", message: string, readonly currentHash?: string) {
    super(message);
    this.name = "FlowFileError";
  }
}

export interface LoadedFlow {
  readonly flow?: FlowFile;
  readonly fileHash: string;
  readonly diagnostics: Diagnostic[];
}

/** File-backed flow operations. Invalid input is diagnosed but never rewritten. */
export class FlowFiles {
  readonly directory: string;
  constructor(projectRoot: string) { this.directory = join(projectRoot, ".zeko", "flows"); }

  async listFlows(): Promise<Array<{ id: string; name: string; valid: boolean; errorCount: number }>> {
    let names: string[];
    try { names = await readdir(this.directory); } catch (error) { if (isMissing(error)) return []; throw error; }
    const flows = await Promise.all(names.filter((name) => name.endsWith(".flow.yaml")).sort().map(async (name) => {
      const loaded = await this.loadFlow(name.slice(0, -".flow.yaml".length));
      return { id: loaded.flow?.id ?? name.slice(0, -".flow.yaml".length), name: loaded.flow?.name ?? name, valid: !!loaded.flow && !loaded.diagnostics.some((d) => d.severity === "error"), errorCount: loaded.diagnostics.filter((d) => d.severity === "error").length };
    }));
    return flows;
  }

  async loadFlow(id: string): Promise<LoadedFlow> {
    const text = await readFile(join(this.directory, flowName(id)), "utf8");
    const doc = parseDocument(text, { uniqueKeys: true, prettyErrors: false });
    const fileHash = hash(text);
    if (doc.errors.length) {
      return { fileHash, diagnostics: doc.errors.map((error) => ({ code: "FILE_PARSE_ERROR", severity: "error", params: { message: error.message }, location: markLocation(text, error.pos?.[0]) })) };
    }
    const parsed = FlowFileSchema.safeParse(doc.toJS());
    if (!parsed.success) {
      return { fileHash, diagnostics: parsed.error.issues.map((issue) => ({ code: "SCHEMA_ERROR", severity: "error", params: { path: issue.path.join("."), message: issue.message }, location: markLocation(text, locatePath(doc, issue.path.map(String))) })) };
    }
    if (parsed.data.id !== id) return { fileHash, diagnostics: [{ code: "SCHEMA_ERROR", severity: "error", params: { path: "id", message: "Flow id must match its filename" }, location: markLocation(text, locatePath(doc, ["id"])) }] };
    return { flow: parsed.data, fileHash, diagnostics: [] };
  }

  async createFlow(id: string, name = id): Promise<{ flowId: string }> {
    const flowId = id.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    const parsed = FlowFileSchema.safeParse({ schemaVersion: 1, id: flowId, name, nodes: [], edges: [] });
    if (!flowId || !parsed.success) throw new FlowFileError("SCHEMA_ERROR", "Invalid flow id");
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, flowName(flowId));
    try { await writeFile(path, canonical(parsed.data), { encoding: "utf8", flag: "wx" }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new FlowFileError("FLOW_EXISTS", `Flow ${flowId} already exists`); throw error; }
    return { flowId };
  }

  async deleteFlow(id: string, confirmed: boolean): Promise<void> {
    if (!confirmed) throw new FlowFileError("CONFIRMATION_REQUIRED", "Deleting a flow requires confirmation");
    await rm(join(this.directory, flowName(id)));
  }

  async saveFlow(flow: FlowFile, expectedHash: string): Promise<{ fileHash: string; diagnostics: Diagnostic[] }> {
    const parsed = FlowFileSchema.safeParse(flow);
    if (!parsed.success) throw new FlowFileError("SCHEMA_ERROR", parsed.error.issues.map((issue) => issue.message).join("; "));
    const path = join(this.directory, flowName(flow.id));
    let previous = "";
    try { previous = await readFile(path, "utf8"); } catch (error) { if (!isMissing(error)) throw error; }
    const currentHash = previous ? hash(previous) : "";
    if (currentHash !== expectedHash) throw new FlowFileError("FILE_CHANGED_ON_DISK", "Flow changed on disk", currentHash);
    const output = previous ? preserveComments(previous, parsed.data) : canonical(parsed.data);
    await mkdir(this.directory, { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, output, { encoding: "utf8" });
    await rename(temporary, path);
    return { fileHash: hash(output), diagnostics: [] };
  }
}

function canonical(flow: FlowFile): string {
  // JSON-compatible object insertion order follows the schema; YAML emits stable two-space indentation.
  const edges = [...flow.edges].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return stringify({ schemaVersion: flow.schemaVersion, id: flow.id, name: flow.name, nodes: flow.nodes, edges }, { indent: 2, lineWidth: 0 });
}

function preserveComments(source: string, flow: FlowFile): string {
  const document = parseDocument(source, { uniqueKeys: true, prettyErrors: false });
  if (document.errors.length) return canonical(flow);
  const old = document.toJS() as Record<string, unknown>;
  if (JSON.stringify(old) === JSON.stringify(flow)) return `${document.toString({ lineWidth: 0 }).replace(/\r\n/g, "\n").replace(/\n+$/, "")}\n`;
  // Keep top-level comments and comments on unchanged fields while updating editor-owned values.
  const replacement = document.createNode(flow);
  if (isMap(document.contents) && isMap(replacement)) {
    for (const pair of document.contents.items) {
      const key = String(pair.key?.toJSON());
      const next = replacement.items.find((candidate) => String(candidate.key?.toJSON()) === key);
      if (next && pair.value && next.value && pair.value !== next.value) {
        (next.value as YamlNode).commentBefore = pair.value.commentBefore ?? null;
        (next.value as YamlNode).comment = pair.value.comment ?? null;
      }
    }
    replacement.commentBefore = document.contents.commentBefore ?? null;
  }
  document.contents = replacement as typeof document.contents;
  return `${document.toString({ lineWidth: 0 }).replace(/\r\n/g, "\n").replace(/\n+$/, "")}\n`;
}

function locatePath(document: Document, path: readonly (string | number)[]): number | undefined {
  let node: unknown = document.contents;
  for (const key of path) {
    if (isMap(node)) node = node.items.find((pair) => String(pair.key) === String(key))?.value;
    else if (isSeq(node)) node = node.items[Number(key)];
    else return undefined;
  }
  return node && typeof node === "object" && "range" in node ? (node as { range?: [number, number, number] }).range?.[0] : undefined;
}

function markLocation(text: string, offset?: number): Diagnostic["location"] {
  if (offset === undefined) return undefined;
  const before = text.slice(0, offset);
  return { line: before.split("\n").length, column: offset - before.lastIndexOf("\n") };
}

function isMissing(error: unknown): boolean { return (error as NodeJS.ErrnoException).code === "ENOENT"; }

export function flowIdFromFilename(filename: string): string { return basename(filename).replace(/\.flow\.yaml$/, ""); }
