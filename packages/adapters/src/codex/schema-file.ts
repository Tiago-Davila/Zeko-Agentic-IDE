import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createCodexSchemaFile(schema: Record<string, unknown>, attemptId: string): Promise<{ path: string; cleanup(): Promise<void> }> {
  assertStrictSchema(schema);
  const directory = await mkdtemp(join(tmpdir(), "zeko-codex-schema-"));
  const path = join(directory, `${attemptId}.json`);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path, `${JSON.stringify(schema)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return { path, cleanup: async () => rm(directory, { recursive: true, force: true }) };
}

export function assertStrictSchema(schema: Record<string, unknown>): void {
  validateNode(schema, "$", new Set());
}

function validateNode(value: unknown, path: string, seen: Set<object>): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Invalid JSON Schema at ${path}`);
  if (seen.has(value)) return;
  seen.add(value);
  const node = value as Record<string, unknown>;
  if (node["type"] === "object") {
    const properties = node["properties"];
    if (!properties || typeof properties !== "object" || Array.isArray(properties) || node["additionalProperties"] !== false) throw new Error(`Codex strict schema requires properties and additionalProperties:false at ${path}`);
    const keys = Object.keys(properties);
    const required = node["required"];
    if (!Array.isArray(required) || keys.some((key) => !required.includes(key)) || required.some((key) => !keys.includes(String(key)))) throw new Error(`Codex strict schema requires every property at ${path}`);
    for (const [key, child] of Object.entries(properties)) validateNode(child, `${path}.properties.${key}`, seen);
  }
  if (node["type"] === "array" && node["items"] !== undefined) validateNode(node["items"], `${path}.items`, seen);
  if (node["anyOf"] !== undefined) {
    if (!Array.isArray(node["anyOf"])) throw new Error(`Invalid anyOf at ${path}`);
    node["anyOf"].forEach((child, index) => validateNode(child, `${path}.anyOf[${index}]`, seen));
  }
}
