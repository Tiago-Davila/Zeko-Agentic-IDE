import type { AgentNode, ProjectConfig } from "@zeko/contracts";
import { useT } from "../i18n/use-t.js";
import { ModelField } from "./model-field.js";

interface AgentNodePanelProps {
  node: AgentNode;
  defaults: ProjectConfig["defaultModels"];
  notApplicable: string[];
  onChange: (node: AgentNode) => void;
  onClose: () => void;
}

export function AgentNodePanel({ node, defaults, notApplicable, onChange, onClose }: AgentNodePanelProps) {
  const t = useT();
  const update = <K extends keyof AgentNode>(key: K, value: AgentNode[K]) => onChange({ ...node, [key]: value });

  function changeAgent(agent: AgentNode["agent"]): void {
    const models = { ...node.models };
    if (!models[agent]) {
      if (agent === "claude-code") models[agent] = defaults[agent] ?? { model: "sonnet" };
      else models[agent] = defaults[agent] ?? { model: "gpt-6-luna", reasoningEffort: "low" };
    }
    onChange({ ...node, agent, models });
  }

  return <aside className="agent-inspector" aria-label={t("node.agentSettings")}>
    <header className="inspector-header"><div><p className="eyebrow">{t("node.inspectorEyebrow")}</p><h2>{node.label || t("canvas.agentNode")}</h2></div>
      <button className="icon-button" type="button" aria-label={t("common.dismiss")} onClick={onClose}>{"×"}</button>
    </header>
    <div className="inspector-scroll">
      <div className="inspector-field">
        <label htmlFor="node-label">{t("node.name")}</label>
        <input id="node-label" value={node.label ?? ""} onChange={(event) => update("label", event.target.value)} />
      </div>
      <div className="inspector-field">
        <label htmlFor="node-agent">{t("node.agent")}</label>
        <select id="node-agent" value={node.agent} onChange={(event) => changeAgent(event.target.value as AgentNode["agent"])}>
          <option value="claude-code">{"Claude Code"}</option><option value="codex">{"Codex"}</option>
        </select>
      </div>
      <ModelField agent={node.agent} models={node.models} onChange={(models) => update("models", models)} />
      <div className="inspector-field">
        <label htmlFor="node-instructions">{t("node.instructions")}</label>
        <textarea id="node-instructions" rows={5} value={node.instructions} onChange={(event) => update("instructions", event.target.value)} />
      </div>
      <div className="inspector-field">
        <label htmlFor="node-criteria">{t("node.acceptanceCriteria")}</label>
        <textarea id="node-criteria" rows={3} value={node.acceptanceCriteria.join("\n")} placeholder={t("node.onePerLine")} onChange={(event) => update("acceptanceCriteria", lines(event.target.value))} />
      </div>
      <div className="inspector-field">
        <label htmlFor="node-scope">{t("node.writeScope")}</label>
        <textarea id="node-scope" rows={3} value={node.writeScope.join("\n")} placeholder={t("node.onePerLine")} onChange={(event) => update("writeScope", lines(event.target.value))} />
      </div>
      <fieldset className="inspector-field inspector-field--fieldset">
        <legend>{t("node.terminal")}</legend>
        <label className="toggle-row"><input type="checkbox" checked={node.terminal.enabled} onChange={(event) => update("terminal", { ...node.terminal, enabled: event.target.checked })} /><span>{t("node.terminalEnabled")}</span></label>
        <textarea rows={3} aria-label={t("node.allowedCommands")} value={node.terminal.allowedCommands.join("\n")} placeholder={t("node.commandsPlaceholder")} onChange={(event) => update("terminal", { ...node.terminal, allowedCommands: lines(event.target.value) })} />
      </fieldset>
      <div className="inspector-field inspector-field--limits">
        <label>{t("node.limits")}</label>
        <NumberField label={t("node.timeoutMinutes")} value={node.limits.timeoutMinutes} min={1} max={1440} onChange={(value) => update("limits", { ...node.limits, timeoutMinutes: value })} />
        <NumberField label={t("node.maxTurns")} value={node.limits.maxTurns} min={1} max={500} onChange={(value) => update("limits", { ...node.limits, maxTurns: value })} />
        <NumberField label={t("node.maxRetries")} value={node.limits.maxRetries} min={0} max={5} onChange={(value) => update("limits", { ...node.limits, maxRetries: value })} />
      </div>
      {notApplicable.length > 0 && <section className="not-applicable"><h3>{t("node.notApplicable")}</h3><ul>{notApplicable.map((field) => <li key={field}>{t("node.optionNotApplicable", { option: field })}</li>)}</ul></section>}
    </div>
  </aside>;
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="number-field"><span>{label}</span><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))} /></label>;
}

function lines(value: string): string[] { return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
