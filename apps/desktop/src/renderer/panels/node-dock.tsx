import { useEffect, useRef, useState } from "react";
import type { AgentNode, ProjectConfig } from "@zeko/contracts";
import { terminalBridge, type OpenTerminalRequest, type TerminalKind } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { NodeTerminal } from "../terminal/node-terminal.js";
import { AgentNodePanel } from "./agent-node-panel.js";

interface NodeDockProps {
  projectRoot: string;
  node: AgentNode;
  defaults: ProjectConfig["defaultModels"];
  notApplicable: string[];
  onChange: (node: AgentNode) => void;
  onClose: () => void;
}

/** Opening an agent node drops you straight into that agent's own CLI, like an Orca terminal tab. */
export function NodeDock({ projectRoot, node, defaults, notApplicable, onChange, onClose }: NodeDockProps) {
  const t = useT();
  const [kind, setKind] = useState<TerminalKind>(node.agent);
  const [tab, setTab] = useState<"terminal" | "settings">("terminal");
  const [restartToken, setRestartToken] = useState(0);
  const session = useRef<string | undefined>(undefined);

  useEffect(() => { setKind(node.agent); setTab("terminal"); }, [node.id, node.agent]);

  const agentModel: { model: string; reasoningEffort?: string } | undefined = kind === "shell" ? undefined : node.models?.[kind] ?? defaults[kind];
  const request: Omit<OpenTerminalRequest, "cols" | "rows"> = {
    sessionKey: `${projectRoot}\0${node.id}\0${kind}`,
    cwd: projectRoot,
    kind,
    ...(agentModel?.model ? { model: agentModel.model } : {}),
    ...(agentModel?.reasoningEffort ? { reasoningEffort: agentModel.reasoningEffort } : {}),
  };

  function pasteInstructions(): void {
    const text = node.instructions.trim();
    if (!session.current || !text) return;
    // Bracketed paste: the agent receives it as one block and waits for the user to press Enter.
    terminalBridge().write(session.current, `\x1b[200~${text}\x1b[201~`);
  }

  return <aside className="node-dock" aria-label={node.label || t("canvas.agentNode")}>
    <header className="node-dock__header">
      <div className="node-dock__title"><p className="eyebrow">{t("terminal.eyebrow")}</p><h2>{node.label || t("canvas.agentNode")}</h2></div>
      <div className="node-dock__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "terminal"} onClick={() => setTab("terminal")}>{t("terminal.tab")}</button>
        <button type="button" role="tab" aria-selected={tab === "settings"} onClick={() => setTab("settings")}>{t("terminal.settingsTab")}</button>
      </div>
      <button className="icon-button" type="button" aria-label={t("common.dismiss")} onClick={onClose}>{"×"}</button>
    </header>
    <div className="node-dock__toolbar" hidden={tab !== "terminal"}>
      <select aria-label={t("terminal.kind")} value={kind} onChange={(event) => setKind(event.target.value as TerminalKind)}>
        <option value="claude-code">{t("agent.claudeCode")}</option>
        <option value="codex">{t("agent.codex")}</option>
        <option value="shell">{t("terminal.shell")}</option>
      </select>
      <span className="node-dock__cwd" title={projectRoot}>{projectRoot}</span>
      <button className="button button--quiet" type="button" disabled={kind === "shell" || !node.instructions.trim()} onClick={pasteInstructions}>{t("terminal.pasteInstructions")}</button>
      <button className="button button--quiet" type="button" onClick={() => setRestartToken((value) => value + 1)}>{t("terminal.restart")}</button>
    </div>
    <div className="node-dock__terminal" hidden={tab !== "terminal"}>
      <NodeTerminal request={request} restartToken={restartToken} ariaLabel={t("terminal.aria", { node: node.label || node.id })}
        onSession={(id) => { session.current = id; }} />
    </div>
    {tab === "settings" && <AgentNodePanel embedded node={node} defaults={defaults} notApplicable={notApplicable} onChange={onChange} onClose={onClose} />}
  </aside>;
}
