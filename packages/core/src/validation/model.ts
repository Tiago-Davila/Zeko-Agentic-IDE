import type { AgentNode, ProjectConfig } from "@zeko/contracts";

export interface ResolvedNodeModel {
  model: string;
  reasoningEffort?: string;
  source: "node" | "project_default";
  warning?: "MODEL_DEFAULTED";
}

export function resolveNodeModel(node: AgentNode, projectConfig: ProjectConfig): ResolvedNodeModel {
  const explicit = node.agent === "codex" ? node.models?.codex : node.models?.["claude-code"];
  const selected = explicit ?? (node.agent === "codex" ? projectConfig.defaultModels.codex : projectConfig.defaultModels["claude-code"]);
  if (!selected) throw new Error(`No project default model configured for ${node.agent}`);
  return {
    model: selected.model,
    ...(node.agent === "codex" && "reasoningEffort" in selected && typeof selected.reasoningEffort === "string" ? { reasoningEffort: selected.reasoningEffort } : {}),
    source: explicit ? "node" : "project_default",
    ...(!explicit ? { warning: "MODEL_DEFAULTED" as const } : {}),
  };
}
