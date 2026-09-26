import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { toAgentReportJsonSchema } from "../src/agent-report.js";

const jsonSchema = toAgentReportJsonSchema();

const outputPath = resolve(import.meta.dirname, "../../generated/agent-report.schema.json");
await mkdir(resolve(outputPath, ".."), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(jsonSchema, null, 2)}\n`,
);
