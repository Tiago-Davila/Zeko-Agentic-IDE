import type { AgentCapabilities, AgentId, Diagnostic, FlowFile, ProjectConfig } from "@zeko/contracts";
import { analyzeCodeLineage } from "./code-lineage.js";
import { validateCycles } from "./cycles.js";
import { validateGraph } from "./graph.js";
import { validateLimitsAndScope } from "./limits-and-scope.js";
import { resolveNodeModel } from "./model.js";

export interface ValidateFlowOptions {
  capabilities?: Partial<Record<AgentId, AgentCapabilities>>;
  headFiles?: string[];
}

export function validateFlow(flow: FlowFile, projectConfig: ProjectConfig, options: ValidateFlowOptions = {}): Diagnostic[] {
  const diagnostics = [
    ...validateGraph(flow),
    ...validateCycles(flow),
    ...analyzeCodeLineage(flow).diagnostics,
    ...validateLimitsAndScope(flow, options.headFiles),
  ];
  for (const node of flow.nodes) {
    if (node.type !== "agent") continue;
    const resolved = resolveNodeModel(node, projectConfig);
    if (resolved.warning) diagnostics.push({ code: resolved.warning, severity: "warning", nodeId: node.id, params: { model: resolved.model, source: resolved.source } });
    const capabilities = options.capabilities?.[node.agent];
    if (!capabilities) continue;
    if (!capabilities.supportsTurnLimit) diagnostics.push(optionDiagnostic(node.id, "maxTurns"));
    if (!capabilities.commandAllowlist.supported && node.terminal.allowedCommands.length > 0) diagnostics.push(optionDiagnostic(node.id, "allowedCommands"));
    if (!capabilities.terminal.canDisable && !node.terminal.enabled) diagnostics.push(optionDiagnostic(node.id, "terminal.enabled"));
  }
  return diagnostics;
}

function optionDiagnostic(nodeId: string, option: string): Diagnostic {
  return { code: "OPTION_NOT_APPLICABLE", severity: "info", nodeId, params: { option } };
}
