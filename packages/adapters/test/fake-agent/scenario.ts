import {
  AgentUsageReadingSchema,
  NormalizedEventSchema,
  ProcessOutcomeSchema,
  ReportCandidateSchema,
  type AgentUsageReading,
  type NormalizedEvent,
  type ProcessOutcome,
  type ReportCandidate,
} from "@zeko/contracts";
import { ALL_FIXTURE_PATHS } from "../fixtures/index.ts";

export interface FakeAgentScenario {
  mode: "native" | "replay";
  events: NormalizedEvent[];
  fixture?: string;
  eventDelayMs: number;
  emitFinalEvent: boolean;
  exitCode: number;
  interruptMode: "respond" | "ignore";
  hangUntilInterrupt: boolean;
  files: Array<{ path: string; content: string }>;
  spawnGrandchildSeconds?: number;
  stderrLines: string[];
  usage?: AgentUsageReading;
  outcome?: ProcessOutcome;
  reportCandidate?: ReportCandidate;
}

const KNOWN_FIELDS = new Set([
  "mode", "events", "fixture", "eventDelayMs", "emitFinalEvent", "exitCode", "interruptMode",
  "hangUntilInterrupt", "files", "spawnGrandchildSeconds", "stderrLines", "usage", "outcome", "reportCandidate",
]);

export function parseFakeAgentScenario(value: unknown): FakeAgentScenario {
  const issues: string[] = [];
  if (!isRecord(value)) throw new Error("Scenario must be a JSON object");
  for (const key of Object.keys(value)) if (!KNOWN_FIELDS.has(key)) issues.push(`Unknown scenario field: ${key}`);

  const mode = value["mode"] === undefined ? "native" : value["mode"];
  if (mode !== "native" && mode !== "replay") issues.push("mode must be native or replay");

  const events: NormalizedEvent[] = [];
  const rawEvents = value["events"] ?? [];
  if (!Array.isArray(rawEvents)) issues.push("events must be an array");
  else rawEvents.forEach((event, index) => {
    const parsed = NormalizedEventSchema.safeParse(event);
    if (parsed.success) events.push(parsed.data);
    else for (const issue of parsed.error.issues) issues.push(`events[${index}]${issue.path.length ? `.${issue.path.join(".")}` : ""}: ${issue.message}`);
  });

  const fixtureValue = value["fixture"];
  const fixture = optionalString(fixtureValue, "fixture", issues);
  if (fixture && !(ALL_FIXTURE_PATHS as readonly string[]).includes(fixture)) issues.push("fixture must reference a path in the typed fixture index");
  if (mode === "replay" && !fixture) issues.push("fixture is required in replay mode");

  const eventDelayMs = boundedInteger(value["eventDelayMs"], "eventDelayMs", 0, 30_000, 0, issues);
  const exitCode = boundedInteger(value["exitCode"], "exitCode", 0, 255, 0, issues);
  const emitFinalEvent = booleanValue(value["emitFinalEvent"], "emitFinalEvent", true, issues);
  const hangUntilInterrupt = booleanValue(value["hangUntilInterrupt"], "hangUntilInterrupt", false, issues);
  const interruptMode = value["interruptMode"] ?? "respond";
  if (interruptMode !== "respond" && interruptMode !== "ignore") issues.push("interruptMode must be respond or ignore");

  const files: Array<{ path: string; content: string }> = [];
  const rawFiles = value["files"] ?? [];
  if (!Array.isArray(rawFiles)) issues.push("files must be an array");
  else rawFiles.forEach((file, index) => {
    if (!isRecord(file) || typeof file["path"] !== "string" || typeof file["content"] !== "string") {
      issues.push(`files[${index}] must have string path and content`);
    } else files.push({ path: file["path"], content: file["content"] });
  });

  let spawnGrandchildSeconds: number | undefined;
  if (value["spawnGrandchildSeconds"] !== undefined) spawnGrandchildSeconds = boundedInteger(value["spawnGrandchildSeconds"], "spawnGrandchildSeconds", 1, 3600, 1, issues);
  const stderrLines = stringArray(value["stderrLines"], "stderrLines", issues);
  let usage: AgentUsageReading | undefined;
  if (value["usage"] !== undefined) {
    const parsed = AgentUsageReadingSchema.safeParse(value["usage"]);
    if (parsed.success) usage = parsed.data;
    else for (const issue of parsed.error.issues) issues.push(`usage.${issue.path.join(".")}: ${issue.message}`);
  }
  let outcome: ProcessOutcome | undefined;
  if (value["outcome"] !== undefined) {
    const parsed = ProcessOutcomeSchema.safeParse(value["outcome"]);
    if (parsed.success) outcome = parsed.data;
    else for (const issue of parsed.error.issues) issues.push(`outcome.${issue.path.join(".")}: ${issue.message}`);
  }
  let reportCandidate: ReportCandidate | undefined;
  if (value["reportCandidate"] !== undefined) {
    const parsed = ReportCandidateSchema.safeParse(value["reportCandidate"]);
    if (parsed.success) reportCandidate = parsed.data;
    else for (const issue of parsed.error.issues) issues.push(`reportCandidate.${issue.path.join(".")}: ${issue.message}`);
  }

  if (issues.length > 0) throw new Error(`Invalid fake-agent scenario:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  return {
    mode: mode as "native" | "replay",
    events,
    ...(fixture === undefined ? {} : { fixture }),
    eventDelayMs,
    emitFinalEvent,
    exitCode,
    interruptMode: interruptMode as "respond" | "ignore",
    hangUntilInterrupt,
    files,
    ...(spawnGrandchildSeconds === undefined ? {} : { spawnGrandchildSeconds }),
    stderrLines,
    ...(usage === undefined ? {} : { usage }),
    ...(outcome === undefined ? {} : { outcome }),
    ...(reportCandidate === undefined ? {} : { reportCandidate }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedInteger(value: unknown, name: string, min: number, max: number, defaultValue: number, issues: string[]): number {
  if (value === undefined) return defaultValue;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    issues.push(`${name} must be an integer between ${min} and ${max}`);
    return defaultValue;
  }
  return value;
}

function booleanValue(value: unknown, name: string, defaultValue: boolean, issues: string[]): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value !== "boolean") { issues.push(`${name} must be a boolean`); return defaultValue; }
  return value;
}

function optionalString(value: unknown, name: string, issues: string[]): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") { issues.push(`${name} must be a string`); return undefined; }
  return value;
}

function stringArray(value: unknown, name: string, issues: string[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) { issues.push(`${name} must be an array of strings`); return []; }
  return value;
}
