import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentUsageReadingSchema, NormalizedEventSchema, type NormalizedEvent } from "@zeko/contracts";
import { ALL_FIXTURE_PATHS } from "../fixtures/index.ts";
import { parseFakeAgentScenario, type FakeAgentScenario } from "./scenario.ts";

const ATTEMPT_ID = "018f0000-0000-7000-8000-000000000099";
const FIXTURE_ROOT = fileURLToPath(new URL("../fixtures/", import.meta.url));

export async function runFakeAgent(scenarioFile: string): Promise<void> {
  let scenario: FakeAgentScenario;
  try {
    scenario = parseFakeAgentScenario(JSON.parse(readFileSync(scenarioFile, "utf8")) as unknown);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Invalid fake-agent scenario"}\n`);
    process.exitCode = 2;
    return;
  }

  for (const line of scenario.stderrLines) process.stderr.write(`${line}\n`);
  for (const file of scenario.files) {
    const target = isAbsolute(file.path) ? file.path : resolve(process.cwd(), file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content, "utf8");
  }
  if (scenario.spawnGrandchildSeconds !== undefined) startWritingGrandchild(scenario.spawnGrandchildSeconds);

  if (scenario.mode === "replay") await replayFixture(scenario);
  else await emitNativeEvents(scenario);

  const interrupted = scenario.hangUntilInterrupt ? await waitForInterrupt(scenario.interruptMode) : false;
  if (!scenario.hangUntilInterrupt) process.stdin.pause();
  process.exitCode = interrupted ? 130 : scenario.exitCode;
}

async function emitNativeEvents(scenario: FakeAgentScenario): Promise<void> {
  for (const event of scenario.events) {
    await emitValidated(event);
    if (scenario.eventDelayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, scenario.eventDelayMs));
  }
  if (scenario.usage) {
    const reading = AgentUsageReadingSchema.parse(scenario.usage);
    await emitValidated({ type: "subscription_usage", ts: new Date().toISOString(), attemptId: ATTEMPT_ID, ...reading });
  }
  if (scenario.emitFinalEvent) {
    await emitValidated({ type: "assistant_text", ts: new Date().toISOString(), attemptId: ATTEMPT_ID, text: "fake-agent scenario complete" });
  }
  if (scenario.outcome || scenario.reportCandidate) {
    await emitValidated({
      type: "raw", ts: new Date().toISOString(), attemptId: ATTEMPT_ID,
      data: { fakeAgentResult: { ...(scenario.outcome ? { outcome: scenario.outcome } : {}), ...(scenario.reportCandidate ? { reportCandidate: scenario.reportCandidate } : {}) } },
    });
  }
}

async function replayFixture(scenario: FakeAgentScenario): Promise<void> {
  const fixture = scenario.fixture;
  if (!fixture || !(ALL_FIXTURE_PATHS as readonly string[]).includes(fixture)) throw new Error("Replay fixture is not in the typed fixture index");
  const path = resolve(FIXTURE_ROOT, fixture);
  if (!path.startsWith(resolve(FIXTURE_ROOT)) || !existsSync(path)) throw new Error("Replay fixture does not exist");
  const text = readFileSync(path, "utf8");
  const lines = fixture.endsWith(".jsonl")
    ? text.split(/\r?\n/).filter((line) => line.length > 0)
    : [JSON.stringify(JSON.parse(text) as unknown)];
  for (const line of lines) {
    await writeLine(line);
    if (scenario.eventDelayMs > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, scenario.eventDelayMs));
  }
}

async function emitValidated(event: NormalizedEvent): Promise<void> {
  const parsed = NormalizedEventSchema.safeParse(event);
  if (!parsed.success) throw new Error(`fake-agent produced an invalid normalized event: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  await writeLine(JSON.stringify(parsed.data));
}

async function writeLine(line: string): Promise<void> {
  if (!process.stdout.write(`${line}\n`)) await new Promise<void>((resolveDrain) => process.stdout.once("drain", resolveDrain));
}

function waitForInterrupt(mode: "respond" | "ignore"): Promise<boolean> {
  return new Promise((resolveDone) => {
    const input = createInterface({ input: process.stdin });
    const keepAlive = setInterval(() => undefined, 1000);
    const finish = (wasInterrupted = false): void => {
      clearInterval(keepAlive);
      input.close();
      process.stdin.pause();
      process.off("SIGTERM", finish);
      resolveDone(wasInterrupted);
    };
    input.on("line", (line) => {
      let message: unknown;
      try { message = JSON.parse(line) as unknown; } catch { return; }
      if (!isRecord(message) || message["type"] !== "control_request" || message["subtype"] !== "interrupt" || mode === "ignore") return;
      const response: NormalizedEvent = { type: "raw", ts: new Date().toISOString(), attemptId: ATTEMPT_ID, data: { type: "control_response", requestId: message["requestId"] ?? null, response: "interrupt_acknowledged" } };
      void emitValidated(response).then(() => finish(true));
      process.exitCode = 130;
    });
    process.once("SIGTERM", finish);
  });
}

function startWritingGrandchild(seconds: number): void {
  const output = join(process.cwd(), "fake-grandchild.log");
  if (process.platform === "win32") {
    const script = `1..${seconds} | ForEach-Object { Add-Content -LiteralPath '${output.replaceAll("'", "''")}' -Value $_; Start-Sleep -Seconds 1 }`;
    const child = spawn("cmd.exe", ["/d", "/s", "/c", "powershell.exe", "-NoProfile", "-Command", script], { stdio: "ignore", windowsHide: true });
    child.unref();
    return;
  }
  const script = `const fs=require('node:fs');let n=0;const timer=setInterval(()=>{fs.appendFileSync(${JSON.stringify(output)},String(++n)+'\\n');if(n>=${seconds})clearInterval(timer)},1000)`;
  const child = spawn(process.execPath, ["-e", script], { stdio: "ignore" });
  child.unref();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const scenarioFile = process.argv[2];
  if (!scenarioFile) {
    process.stderr.write("Usage: fake-agent <scenario.json>\n");
    process.exitCode = 2;
  } else {
    void runFakeAgent(scenarioFile).catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : "fake-agent failed"}\n`);
      process.exitCode = 2;
    });
  }
}
