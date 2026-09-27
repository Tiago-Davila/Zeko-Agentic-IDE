// Spike 001 — descartable. Lanza `claude -p` con stream-json, parsea eventos en vivo,
// y corre un experimento por pregunta del spike. Ver FINDINGS.md.
//
//   npx tsx chain.ts <cmd> [args]
//   cmds: events | chain | structured [n] | perms | cancel | worktree | all
//
// Env: SPIKE_MODEL (default "sonnet"), SPIKE_KEEP=1 (no borra el worktree).

import { spawn, execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const SAMPLES = path.join(ROOT, "samples");
const RUNS = path.join(ROOT, "runs"); // logs crudos, gitignored
const MODEL = process.env.SPIKE_MODEL ?? "sonnet";
fs.mkdirSync(SAMPLES, { recursive: true });
fs.mkdirSync(RUNS, { recursive: true });

// Flags base. `--verbose` es obligatorio con stream-json en -p (ver samples/q1-no-verbose.txt).
// `--strict-mcp-config` evita cargar los MCP de claude.ai del usuario (ruido + latencia).
const BASE = ["-p", "--output-format", "stream-json", "--verbose", "--model", MODEL, "--strict-mcp-config"];

type Ev = Record<string, any>;
type RunResult = {
  label: string;
  events: Ev[];
  result?: Ev; // evento type=result
  code: number | null;
  signal: string | null;
  stderr: string;
  wallMs: number;
  parseErrors: string[];
};

type RunOpts = {
  label: string;
  prompt: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  quiet?: boolean;
  onEvent?: (ev: Ev, child: ReturnType<typeof spawn>) => void;
  stdinJson?: boolean; // --input-format stream-json: el prompt va como mensaje y stdin queda abierto
};

function runClaude(o: RunOpts): Promise<RunResult> {
  const args = [...BASE, ...(o.stdinJson ? ["--input-format", "stream-json"] : []), ...(o.args ?? [])];
  const t0 = Date.now();
  const logPath = path.join(RUNS, `${o.label}.jsonl`);
  const log = fs.createWriteStream(logPath);
  const child = spawn("claude", args, { cwd: o.cwd ?? ROOT, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const res: RunResult = { label: o.label, events: [], code: null, signal: null, stderr: "", wallMs: 0, parseErrors: [] };

  // El prompt va por stdin para no pelear con el quoting de argumentos en Windows.
  if (o.stdinJson) {
    child.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content: o.prompt } }) + "\n");
  } else {
    child.stdin.end(o.prompt);
  }

  child.stderr.on("data", (d) => (res.stderr += d));
  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    log.write(line + "\n");
    let ev: Ev;
    try {
      ev = JSON.parse(line);
    } catch {
      res.parseErrors.push(line);
      return;
    }
    res.events.push(ev);
    if (ev.type === "result") {
      res.result = ev;
      if (o.stdinJson) child.stdin.end(); // en modo stdin-json el proceso espera más input hasta EOF
    }
    if (!o.quiet) console.log(`  [${o.label}] +${Date.now() - t0}ms ${describe(ev)}`);
    saveSample(ev);
    o.onEvent?.(ev, child);
  });

  const timer = o.timeoutMs
    ? setTimeout(() => {
        console.log(`  [${o.label}] TIMEOUT ${o.timeoutMs}ms -> kill`);
        child.kill();
      }, o.timeoutMs)
    : undefined;

  return new Promise((resolve) => {
    // "close" (no "exit") garantiza que stdout ya se drenó.
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      log.end();
      res.code = code;
      res.signal = signal;
      res.wallMs = Date.now() - t0;
      resolve(res);
    });
  });
}

function blocks(ev: Ev): any[] {
  return Array.isArray(ev.message?.content) ? ev.message.content : [];
}

function describe(ev: Ev): string {
  const t = ev.subtype ? `${ev.type}/${ev.subtype}` : ev.type;
  if (ev.type === "assistant" || ev.type === "user") {
    const b = blocks(ev).map((b) => {
      if (b.type === "text") return `text(${JSON.stringify(b.text.slice(0, 60))})`;
      if (b.type === "tool_use") return `tool_use(${b.name} ${JSON.stringify(b.input).slice(0, 60)})`;
      if (b.type === "tool_result") return `tool_result(${b.is_error ? "ERR " : ""}${JSON.stringify(b.content).slice(0, 60)})`;
      return b.type;
    });
    return `${t} ${b.join(" ")}`;
  }
  if (ev.type === "result") return `${t} is_error=${ev.is_error} turns=${ev.num_turns} cost=$${ev.total_cost_usd?.toFixed(4)} ${JSON.stringify(String(ev.result ?? "").slice(0, 60))}`;
  return t;
}

// Guarda el primer ejemplo real de cada clase de evento en samples/events/.
function saveSample(ev: Ev) {
  let key = ev.subtype ? `${ev.type}.${ev.subtype}` : ev.type;
  if (ev.type === "assistant" || ev.type === "user") {
    const kinds = [...new Set(blocks(ev).map((b) => b.type + (b.is_error ? "_error" : "")))];
    key += "." + (kinds.join("+") || "string");
  }
  if (ev.type === "stream_event") key += `.${ev.event?.type}` + (ev.event?.delta?.type ? `.${ev.event.delta.type}` : "") + (ev.event?.content_block?.type ? `.${ev.event.content_block.type}` : "");
  const dir = path.join(SAMPLES, "events");
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${key}.json`);
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify(ev, null, 2));
}

function writeSample(name: string, data: unknown) {
  fs.writeFileSync(path.join(SAMPLES, name), typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

function summarize(r: RunResult) {
  const u = r.result?.usage ?? {};
  return {
    label: r.label,
    exit: r.code,
    signal: r.signal,
    gotResult: !!r.result,
    subtype: r.result?.subtype,
    is_error: r.result?.is_error,
    terminal_reason: r.result?.terminal_reason,
    num_turns: r.result?.num_turns,
    cost_usd: r.result?.total_cost_usd,
    duration_ms: r.result?.duration_ms,
    wall_ms: r.wallMs,
    input_tokens: u.input_tokens,
    cache_creation: u.cache_creation_input_tokens,
    cache_read: u.cache_read_input_tokens,
    total_input: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    output_tokens: u.output_tokens,
    permission_denials: r.result?.permission_denials,
    session_id: r.result?.session_id ?? r.events[0]?.session_id,
    result: r.result?.result,
    stderr: r.stderr.trim() || undefined,
    event_types: r.events.map((e) => (e.subtype ? `${e.type}/${e.subtype}` : e.type)),
  };
}

function tmpDir(name: string) {
  const d = path.join(RUNS, name);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// ---------------------------------------------------------------- Q2/Q3: catálogo de eventos
async function cmdEvents() {
  const cwd = tmpDir("events");
  fs.writeFileSync(path.join(cwd, "datos.txt"), "alfa\nbeta\ngamma\n");
  const r = await runClaude({
    label: "events",
    cwd,
    prompt: "Leé datos.txt con Read, después ejecutá `echo listo` con Bash, y respondé en una línea cuántas líneas tiene el archivo.",
    args: ["--allowedTools", "Read Bash(echo *)", "--include-partial-messages"],
  });
  writeSample("q2-events-summary.json", summarize(r));
  // Error de API/CLI forzado: modelo inexistente.
  const bad = await runClaude({ label: "events-bad-model", prompt: "hola", args: ["--model", "modelo-que-no-existe"] });
  writeSample("q3-error-bad-model.json", summarize(bad));
  // Tope de turnos/costo: presupuesto ridículo.
  const budget = await runClaude({ label: "events-budget", cwd, prompt: "Leé datos.txt y resumilo.", args: ["--allowedTools", "Read", "--max-budget-usd", "0.0001"] });
  writeSample("q3-error-budget.json", summarize(budget));
}

// ---------------------------------------------------------------- Q4: encadenamiento
async function cmdChain() {
  const cwd = tmpDir("chain");
  // Fixture con un detalle (línea 7) que el resumen de la llamada 1 probablemente no conserve.
  const lines = ["# Inventario", "manzanas: 12", "peras: 7", "uvas: 30", "kiwis: 4", "bananas: 18", "lote_referencia: ZK-4471", "naranjas: 9"];
  fs.writeFileSync(path.join(cwd, "inventario.md"), lines.join("\n") + "\n");

  const p1 = "Sos el agente ANALISTA. Leé inventario.md y devolvé SOLO una línea: la fruta con más stock y la de menos stock.";
  const tools = ["--allowedTools", "Read"];
  const first = await runClaude({ label: "chain-1", cwd, prompt: p1, args: tools });
  const r1 = String(first.result?.result ?? "");
  const sid = first.result!.session_id;

  // Nodo 2 = otro "agente": la persona va SOLO en el system prompt, así medimos si el resume la respeta.
  // Mismas herramientas que el nodo 1 (cambiar el toolset al reanudar degrada la respuesta, ver q4-chain-run2-tools-empty.json).
  const persona = ["--append-system-prompt", "Sos el agente REVISOR. Empezá SIEMPRE tu respuesta con la palabra 'REVISOR:'."];
  const q2 = "(1) Proponé en una línea qué fruta reponer. (2) ¿Qué valor tiene lote_referencia en inventario.md?";

  // a) Inyección: sesión nueva, el resultado textual del nodo 1 va en el prompt.
  const inj = await runClaude({ label: "chain-2-inject", cwd, prompt: `Resultado del nodo anterior (ANALISTA):\n<<<\n${r1}\n>>>\n\n${q2}`, args: [...tools, ...persona] });
  // b) Resume con --fork-session (no muta la sesión del nodo 1, así las variantes siguientes parten del mismo punto).
  const fork = await runClaude({ label: "chain-2-resume-fork", cwd, prompt: q2, args: ["--resume", sid, "--fork-session", ...tools, ...persona] });
  // b') Igual pero sin snapshot del system prompt: ¿se aplica la persona nueva?
  const noSnap = await runClaude({ label: "chain-2-resume-fork-nosnapshot", cwd, prompt: q2, args: ["--resume", sid, "--fork-session", "--system-prompt-snapshot", "off", ...tools, ...persona] });
  // b'') Resume desde otro cwd: ¿las sesiones están atadas al directorio?
  const other = tmpDir("chain-other-cwd");
  const otherCwd = await runClaude({ label: "chain-2-resume-other-cwd", cwd: other, prompt: q2, args: ["--resume", sid, "--fork-session", ...tools, ...persona] });
  // b''') Resume "puro" (muta la sesión original).
  const res = await runClaude({ label: "chain-2-resume", cwd, prompt: q2, args: ["--resume", sid, ...tools, ...persona] });

  const view = (r: RunResult) => ({
    ...summarize(r),
    toolUses: r.events.flatMap((e) => blocks(e).filter((b) => b.type === "tool_use").map((b) => b.name)),
    knowsLote: String(r.result?.result ?? "").includes("ZK-4471"),
    startsWithPersona: String(r.result?.result ?? "").trim().startsWith("REVISOR"),
    sameSessionAsNode1: r.result?.session_id === sid,
  });
  const rows = [first, inj, fork, noSnap, otherCwd, res].map(view);
  writeSample("q4-chain.json", rows);
  console.table(
    rows.map((s) => ({
      label: s.label,
      exit: s.exit,
      in: s.total_input,
      cache_read: s.cache_read,
      cache_new: s.cache_creation,
      out: s.output_tokens,
      usd: s.cost_usd?.toFixed(4),
      tools: s.toolUses.join(","),
      lote: s.knowsLote,
      persona: s.startsWithPersona,
      sameSid: s.sameSessionAsNode1,
    })),
  );
  for (const s of rows) console.log(`${s.label}: ${String(s.result ?? s.stderr).replace(/\n/g, " ").slice(0, 160)}`);
}

// ---------------------------------------------------------------- Q5: salida estructurada
const ZekoResult = z
  .object({
    status: z.enum(["DONE", "BLOCKED", "FAILED"]),
    summary: z.string(),
    filesChanged: z.array(z.string()),
    checks: z.array(z.string()),
    blockers: z.array(z.string()),
  })
  .strict();

const SHAPE = `{ "status": "DONE" | "BLOCKED" | "FAILED", "summary": string, "filesChanged": string[], "checks": string[], "blockers": string[] }`;
const TASK = "Tarea: creá el archivo saludo.txt con el contenido 'hola zeko' y verificá con Read que quedó bien.";

const JSON_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    status: { type: "string", enum: ["DONE", "BLOCKED", "FAILED"] },
    summary: { type: "string" },
    filesChanged: { type: "array", items: { type: "string" } },
    checks: { type: "array", items: { type: "string" } },
    blockers: { type: "array", items: { type: "string" } },
  },
  required: ["status", "summary", "filesChanged", "checks", "blockers"],
  additionalProperties: false,
});

function validate(raw: unknown) {
  if (typeof raw !== "string") {
    const p = ZekoResult.safeParse(raw);
    return { strictJson: p.success, lenient: p.success, err: p.success ? undefined : p.error.issues };
  }
  const tryParse = (s: string) => {
    try {
      return ZekoResult.safeParse(JSON.parse(s));
    } catch (e) {
      return { success: false as const, error: { issues: [String(e)] } };
    }
  };
  const strict = tryParse(raw.trim());
  if (strict.success) return { strictJson: true, lenient: true };
  // Leniente: bloque ```json ...``` o primer { hasta último }.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const brace = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const len = tryParse(fence?.[1] ?? brace);
  return { strictJson: false, lenient: len.success, err: len.success ? undefined : (len as any).error.issues };
}

async function cmdStructured(n = 5) {
  const variants = {
    prompt: {
      prompt: `${TASK}\n\nAl terminar, tu ÚLTIMO mensaje debe ser ÚNICAMENTE un objeto JSON válido (sin texto extra, sin markdown) con esta forma exacta:\n${SHAPE}`,
      args: [] as string[],
      read: (r: RunResult) => r.result?.result,
    },
    file: {
      prompt: `${TASK}\n\nAl terminar, escribí con Write el archivo zeko-result.json con un objeto JSON con esta forma exacta:\n${SHAPE}\nTu respuesta final puede ser cualquier cosa.`,
      args: [] as string[],
      read: (_r: RunResult, cwd: string) => {
        const f = path.join(cwd, "zeko-result.json");
        return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "<no existe zeko-result.json>";
      },
    },
    schema: {
      prompt: `${TASK}\n\nReportá el resultado con la forma: ${SHAPE}`,
      args: ["--json-schema", JSON_SCHEMA],
      read: (r: RunResult) => r.result?.structured_output ?? r.result?.result,
    },
  };

  const jobs: Promise<any>[] = [];
  for (const [name, v] of Object.entries(variants)) {
    for (let i = 0; i < n; i++) {
      const label = `struct-${name}-${i}`;
      const cwd = tmpDir(label);
      jobs.push(
        runClaude({ label, cwd, prompt: v.prompt, quiet: true, args: ["--allowedTools", "Read Write", ...v.args] }).then((r) => {
          const raw = v.read(r, cwd);
          const val = validate(raw);
          console.log(`  ${label}: strict=${val.strictJson} lenient=${val.lenient}`);
          return { variant: name, i, ...val, exit: r.code, cost: r.result?.total_cost_usd, turns: r.result?.num_turns, raw, resultText: r.result?.result, hasStructuredOutput: "structured_output" in (r.result ?? {}) };
        }),
      );
    }
  }
  // Todas en paralelo: de paso prueba que N procesos claude concurrentes conviven.
  const rows = await Promise.all(jobs);
  const table = Object.keys(variants).map((v) => {
    const rs = rows.filter((r) => r.variant === v);
    return { variant: v, runs: rs.length, strictOk: rs.filter((r) => r.strictJson).length, lenientOk: rs.filter((r) => r.lenient).length, avgUsd: (rs.reduce((a, r) => a + (r.cost ?? 0), 0) / rs.length).toFixed(4) };
  });
  console.table(table);
  writeSample("q5-structured.json", { table, rows });
}

// ---------------------------------------------------------------- Q6: permisos
async function cmdPerms() {
  const prompt = "Hacé dos cosas en orden: (1) creá permiso.txt con el texto 'x' usando Write. (2) ejecutá `git --version` con Bash. Después respondé en una línea qué pudiste hacer y qué no.";
  const configs: Record<string, string[]> = {
    default: [],
    "prompts-none": ["--permission-prompts", "none"],
    "allowed-write": ["--allowedTools", "Write"],
    "allowed-write-bashgit": ["--allowedTools", "Write Bash(git --version)"],
    acceptEdits: ["--permission-mode", "acceptEdits"],
    dontAsk: ["--permission-mode", "dontAsk"],
    "dontAsk+allowed-write": ["--permission-mode", "dontAsk", "--allowedTools", "Write"],
    "disallowed-bash": ["--allowedTools", "Write", "--disallowedTools", "Bash"],
    "tools-read-only": ["--tools", "Read"],
    bypass: ["--dangerously-skip-permissions"],
  };
  const rows = await Promise.all(
    Object.entries(configs).map(async ([name, args]) => {
      const cwd = tmpDir(`perm-${name}`);
      const r = await runClaude({ label: `perm-${name}`, cwd, prompt, args, quiet: true, timeoutMs: 180_000 });
      const toolErrors = r.events.flatMap((e) => blocks(e).filter((b) => b.type === "tool_result" && b.is_error).map((b) => JSON.stringify(b.content).slice(0, 200)));
      const row = {
        config: name,
        flags: args.join(" "),
        exit: r.code,
        permissionMode: r.events.find((e) => e.subtype === "init")?.permissionMode,
        fileCreated: fs.existsSync(path.join(cwd, "permiso.txt")),
        bashRan: r.events.some((e) => blocks(e).some((b) => b.type === "tool_result" && !b.is_error && JSON.stringify(b.content).includes("git version"))),
        denials: (r.result?.permission_denials ?? []).map((d: any) => d.tool_name),
        toolErrors,
        wall_ms: r.wallMs,
        result: r.result?.result,
      };
      console.log(`  perm-${name}: file=${row.fileCreated} bash=${row.bashRan} denials=${row.denials}`);
      return row;
    }),
  );
  console.table(rows.map(({ toolErrors, result, ...r }) => r));
  writeSample("q6-perms.json", rows);

  // En Windows el CLI expone PowerShell (no Bash) y `git --version` es read-only => auto-permitido.
  // Segunda tanda con un comando de shell que muta (git init).
  const shellPrompt = "Ejecutá `git init` en el directorio actual usando la herramienta de shell que tengas. Respondé en una línea si pudiste.";
  const shellConfigs: Record<string, string[]> = {
    default: [],
    "allowed-ps-gitinit": ["--allowedTools", "PowerShell(git init)"],
    "allowed-bash-gitinit": ["--allowedTools", "Bash(git init)"],
    "disallowed-ps": ["--disallowedTools", "PowerShell"],
    acceptEdits: ["--permission-mode", "acceptEdits"],
  };
  const shellRows = await Promise.all(
    Object.entries(shellConfigs).map(async ([name, args]) => {
      const cwd = tmpDir(`perm-shell-${name}`);
      const r = await runClaude({ label: `perm-shell-${name}`, cwd, prompt: shellPrompt, args, quiet: true, timeoutMs: 180_000 });
      return {
        config: name,
        flags: args.join(" "),
        exit: r.code,
        tools: r.events.flatMap((e) => blocks(e).filter((b) => b.type === "tool_use").map((b) => b.name)).join(","),
        gitDirCreated: fs.existsSync(path.join(cwd, ".git")),
        denials: (r.result?.permission_denials ?? []).map((d: any) => d.tool_name),
        toolErrors: r.events.flatMap((e) => blocks(e).filter((b) => b.type === "tool_result" && b.is_error).map((b) => JSON.stringify(b.content).slice(0, 200))),
        result: r.result?.result,
      };
    }),
  );
  console.table(shellRows.map(({ toolErrors, result, ...r }) => r));
  writeSample("q6-perms-shell.json", shellRows);
}

// ---------------------------------------------------------------- Q7: cancelación
function countGrowth(file: string) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").length : 0;
}

// Procesos shell/claude creados desde `since` (excluye esta consulta), con su cadena de padres.
// Filtrar por ParentProcessId del hijo no alcanza: ver FINDINGS Q7.
function procSnapshot(since: Date): string[] {
  const ps = [
    `$since = [datetime]::Parse('${since.toISOString()}').ToLocalTime()`,
    `$all = Get-CimInstance Win32_Process; $by = @{}; foreach ($p in $all) { $by[$p.ProcessId] = $p }`,
    `foreach ($p in $all | ? { $_.Name -match 'pwsh|powershell|claude|bash|conhost' -and $_.ProcessId -ne $PID -and $_.CreationDate -ge $since }) {`,
    `  $ch = @(); $c = $p; for ($i = 0; $i -lt 5 -and $c; $i++) { $ch += "$($c.ProcessId):$($c.Name)"; $c = $by[$c.ParentProcessId] }`,
    `  ($ch -join ' <- ')`,
    `}`,
  ].join("\n");
  try {
    return execFileSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  } catch (e) {
    return [String(e)];
  }
}

async function cancelCase(label: string, how: "kill" | "interrupt" | "taskkill-tree") {
  const cwd = tmpDir(label);
  const marker = path.join(cwd, "progreso.txt");
  // PowerShell porque en Windows el CLI no expone Bash (ver Q6).
  const cmd = `1..25 | % { Add-Content progreso.txt $_; Start-Sleep 1 }`;
  let fired = false;
  let pid: number | undefined;
  const since = new Date(Date.now() - 1000);
  const r = await runClaude({
    label,
    cwd,
    stdinJson: how === "interrupt",
    prompt: `Ejecutá exactamente este comando con la herramienta PowerShell y esperá a que termine: ${cmd}\nDespués escribí con Write el archivo fin.txt con 'ok'.`,
    args: ["--allowedTools", "PowerShell Bash Write"],
    timeoutMs: 120_000,
    onEvent: (ev, child) => {
      pid = child.pid;
      const started = blocks(ev).some((b) => b.type === "tool_use" && (b.name === "Bash" || b.name === "PowerShell"));
      if (!started || fired) return;
      fired = true;
      setTimeout(() => {
        console.log(`  [${label}] >>> cancel via ${how} (progreso=${countGrowth(marker)})`);
        console.log(`  [${label}] procesos antes de cancelar:`, procSnapshot(since));
        if (how === "kill") child.kill("SIGTERM");
        else if (how === "taskkill-tree") execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"]);
        else child.stdin!.write(JSON.stringify({ type: "control_request", request_id: "cancel-1", request: { subtype: "interrupt" } }) + "\n");
      }, 4000);
    },
  });
  const atExit = countGrowth(marker);
  const procsAtExit = procSnapshot(since);
  await new Promise((s) => setTimeout(s, 5000));
  const after5s = countGrowth(marker);
  const out = {
    how,
    spawnedPid: pid,
    exit: r.code,
    signal: r.signal,
    gotResult: !!r.result,
    result: r.result && { subtype: r.result.subtype, is_error: r.result.is_error, terminal_reason: r.result.terminal_reason, result: r.result.result },
    lastEvents: r.events.slice(-4).map(describe),
    controlEvents: r.events.filter((e) => e.type?.startsWith("control")),
    progresoAtExit: atExit,
    progreso5sLater: after5s,
    orphanStillWriting: after5s > atExit,
    procsAtExit,
    procs5sLater: procSnapshot(since),
    finTxtExists: fs.existsSync(path.join(cwd, "fin.txt")),
    stderr: r.stderr.trim().slice(0, 500),
  };
  console.log(out);
  // Limpieza para que el caso siguiente arranque limpio.
  for (const line of out.procs5sLater) {
    try { execFileSync("taskkill", ["/F", "/T", "/PID", line.split(":")[0]], { stdio: "ignore" }); } catch {}
  }
  return out;
}

async function cmdCancel() {
  const kill = await cancelCase("cancel-kill", "kill");
  const tree = await cancelCase("cancel-taskkill-tree", "taskkill-tree");
  const intr = await cancelCase("cancel-interrupt", "interrupt");
  writeSample("q7-cancel.json", { kill, tree, interrupt: intr });
}

// ---------------------------------------------------------------- Q8: aislamiento con worktree
function git(args: string[], cwd = ROOT) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

async function cmdWorktree() {
  const repo = git(["rev-parse", "--show-toplevel"]);
  const branch = `spike/wt-${Date.now()}`;
  const wt = path.join(RUNS, "wt");
  try { git(["worktree", "remove", "--force", wt], repo); } catch {}
  fs.rmSync(wt, { recursive: true, force: true });
  git(["worktree", "add", "-b", branch, wt, "HEAD"], repo);

  const mainBefore = git(["status", "--porcelain"], repo);
  const r = await runClaude({
    label: "worktree-1",
    cwd: wt,
    prompt: "Agregá al final de README.md una línea que diga 'editado por zeko spike'. Usá Edit o Write. Respondé 'ok' al terminar.",
    args: ["--allowedTools", "Read Edit Write"],
  });
  const out = {
    worktree: wt,
    branch,
    run: summarize(r),
    toolUses: r.events.flatMap((e) => blocks(e).filter((b) => b.type === "tool_use").map((b) => ({ name: b.name, file_path: b.input?.file_path }))),
    worktreeStatus: git(["status", "--porcelain"], wt),
    worktreeDiff: git(["diff"], wt),
    mainStatusBefore: mainBefore,
    mainStatusAfter: git(["status", "--porcelain"], repo),
    mainReadme: fs.readFileSync(path.join(repo, "README.md"), "utf8"),
  };
  console.log(out);
  writeSample("q8-worktree.json", out);
  if (!process.env.SPIKE_KEEP) {
    git(["worktree", "remove", "--force", wt], repo);
    git(["branch", "-D", branch], repo);
  }
}

// ----------------------------------------------------------------
const [cmd = "chain", arg] = process.argv.slice(2);
const cmds: Record<string, () => Promise<void>> = {
  events: cmdEvents,
  chain: cmdChain,
  structured: () => cmdStructured(Number(arg ?? 5)),
  perms: cmdPerms,
  cancel: cmdCancel,
  worktree: cmdWorktree,
  all: async () => {
    for (const c of ["events", "chain", "structured", "perms", "cancel", "worktree"]) await cmds[c]();
  },
};
if (!cmds[cmd]) {
  console.error(`uso: tsx chain.ts <${Object.keys(cmds).join("|")}>`);
  process.exit(2);
}
console.log(`model=${MODEL} cmd=${cmd}`);
await cmds[cmd]();
