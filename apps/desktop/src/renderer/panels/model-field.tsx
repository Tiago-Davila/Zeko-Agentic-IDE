import type { AgentNode } from "@zeko/contracts";
import { useT } from "../i18n/use-t.js";

type AgentModel = NonNullable<AgentNode["models"]>;

interface ModelFieldProps {
  agent: AgentNode["agent"];
  models: AgentModel | undefined;
  onChange: (models: AgentModel) => void;
}

export function ModelField({ agent, models, onChange }: ModelFieldProps) {
  const t = useT();
  const model = models?.[agent]?.model ?? "";
  function updateModel(value: string): void {
    const next = { ...models, [agent]: { ...models?.[agent], model: value } };
    if (agent === "claude-code") onChange({ ...next, "claude-code": { model: value } });
    else onChange({ ...next, codex: { model: value, reasoningEffort: models?.codex?.reasoningEffort ?? "medium" } });
  }

  return <div className="inspector-field">
    <label htmlFor="node-model">{t("node.model")}</label>
    <input id="node-model" type="text" value={model} placeholder={agent === "codex" ? "gpt-6-luna" : "sonnet"} onChange={(event) => updateModel(event.target.value)} />
    {agent === "codex" && <>
      <label htmlFor="node-reasoning">{t("node.reasoningEffort")}</label>
      <select id="node-reasoning" value={models?.codex?.reasoningEffort ?? "medium"} onChange={(event) => onChange({ ...models, codex: { model: model || "gpt-6-luna", reasoningEffort: event.target.value } })}>
        <option value="minimal">{t("node.effortMinimal")}</option>
        <option value="low">{t("node.effortLow")}</option>
        <option value="medium">{t("node.effortMedium")}</option>
        <option value="high">{t("node.effortHigh")}</option>
        <option value="xhigh">{t("node.effortXhigh")}</option>
      </select>
    </>}
  </div>;
}
