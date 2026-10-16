// Spike 001c — servidor MCP mínimo (stdio, JSON-RPC por línea) con herramientas de archivos
// confinadas a un directorio raíz. Sirve para probar un "nodo sin terminal" con Codex:
// se desactiva la shell de Codex y las lecturas/escrituras pasan por acá.
//
//   node mcp-fs.mjs <root> [logFile]
//
// Confinamiento: resuelve la ruta (incluye `..`) y el realpath del ancestro existente más cercano
// (sigue symlinks y junctions) y exige que quede dentro de realpath(root).
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

const ROOT = fs.realpathSync(path.resolve(process.argv[2] ?? "."));
const LOG = process.argv[3];
const log = (o) => LOG && fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...o }) + "\n");

function confine(p) {
  const abs = path.resolve(ROOT, String(p ?? ""));
  let probe = abs;
  while (!fs.existsSync(probe)) probe = path.dirname(probe);
  const real = path.join(fs.realpathSync(probe), path.relative(probe, abs));
  const rel = path.relative(ROOT, real);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`DENIED: ${p} resolves to ${real}, outside ${ROOT}`);
  return real;
}

const tools = {
  read_file: {
    description: "Read a UTF-8 text file inside the workspace. Path relative to the workspace root or absolute.",
    inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    run: ({ path: p }) => fs.readFileSync(confine(p), "utf8"),
  },
  write_file: {
    description: "Create or overwrite a UTF-8 text file inside the workspace.",
    inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
    run: ({ path: p, content }) => {
      const f = confine(p);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, content);
      return `wrote ${Buffer.byteLength(content)} bytes to ${f}`;
    },
  },
  list_dir: {
    description: "List entries of a directory inside the workspace.",
    inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    run: ({ path: p }) => fs.readdirSync(confine(p)).join("\n"),
  },
};

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  const req = JSON.parse(line);
  const { id, method, params } = req;
  if (method === "initialize") {
    return send({ jsonrpc: "2.0", id, result: { protocolVersion: params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "zeko-fs", version: "0.0.1" } } });
  }
  if (method === "tools/list") {
    return send({ jsonrpc: "2.0", id, result: { tools: Object.entries(tools).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) } });
  }
  if (method === "tools/call") {
    const t = tools[params?.name];
    try {
      if (!t) throw new Error(`unknown tool ${params?.name}`);
      const text = t.run(params.arguments ?? {});
      log({ tool: params.name, args: params.arguments, ok: true });
      return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }], isError: false } });
    } catch (e) {
      log({ tool: params?.name, args: params?.arguments, ok: false, error: String(e.message ?? e) });
      return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: String(e.message ?? e) }], isError: true } });
    }
  }
  if (id !== undefined) send({ jsonrpc: "2.0", id, result: {} }); // ping y otros requests
});
