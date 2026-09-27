import { useEffect, useState, type ReactNode } from "react";
import type { FlowSummary } from "../ipc/client.js";
import { IpcClientError, ipc } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { HistoryIcon, HomeIcon, PlusIcon, SettingsIcon, WorkflowIcon } from "./rail-icons.js";

export type RailView = "flow" | "history" | "settings";

interface WorkspaceRailProps {
  projectId: string;
  flowId: string;
  view: RailView;
  onOpenFlow: (flowId: string) => void;
  onChangeView: (view: RailView) => void;
  onBack: () => void;
}

/** Icon-only rail left of the explorer; hovering it (or focusing inside it) slides out the workflow list, Claude-style. */
export function WorkspaceRail({ projectId, flowId, view, onOpenFlow, onChangeView, onBack }: WorkspaceRailProps) {
  const t = useT();
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void ipc.request("flow.list", { projectId }).then((result) => { if (active) setFlows(result); })
      .catch(() => { if (active) setError(t("rail.flowsFailed")); });
    return () => { active = false; };
  }, [projectId, flowId, t]);

  async function createFlow(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true); setError(undefined);
    try {
      const { flowId: created } = await ipc.request("flow.create", { projectId, name: trimmed });
      setCreating(false); setName("");
      onOpenFlow(created);
    } catch (cause) {
      setError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("error.requestFailed"));
    } finally { setBusy(false); }
  }

  return <nav className="workspace-rail" aria-label={t("rail.navigation")}>
    <div className="workspace-rail__panel">
      <div className="workspace-rail__brand"><span className="brand-symbol" aria-hidden="true">{"Z"}</span><span className="workspace-rail__label">{t("brand.name")}</span></div>
      <RailItem icon={<PlusIcon />} label={t("rail.newWorkflow")} onClick={() => { setCreating(true); setName(""); }} />
      {creating && <form className="workspace-rail__create" onSubmit={(event) => { event.preventDefault(); void createFlow(); }}>
        <input autoFocus aria-label={t("flow.createPrompt")} placeholder={t("flow.createPrompt")} value={name} disabled={busy}
          onChange={(event) => setName(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Escape") setCreating(false); }} />
      </form>}
      <RailItem icon={<HomeIcon />} label={t("canvas.back")} onClick={onBack} />
      <RailItem icon={<HistoryIcon />} label={t("history.runList")} active={view === "history"} onClick={() => onChangeView(view === "history" ? "flow" : "history")} />
      <div className="workspace-rail__section">
        <div className="workspace-rail__caption"><WorkflowIcon /><span className="workspace-rail__label">{t("rail.workflows")}</span></div>
        <ul className="workspace-rail__flows">
          {flows.map((flow) => <li key={flow.id}>
            <button type="button" className={`workspace-rail__flow${flow.id === flowId ? " workspace-rail__flow--current" : ""}`}
              aria-current={flow.id === flowId ? "page" : undefined} title={flow.name}
              onClick={() => { if (flow.id === flowId) onChangeView("flow"); else onOpenFlow(flow.id); }}>
              <span className={`flow-indicator${flow.valid ? " flow-indicator--valid" : ""}`} aria-hidden="true" />
              <span className="workspace-rail__flow-name">{flow.name}</span>
            </button>
          </li>)}
        </ul>
        {error && <p className="workspace-rail__error" role="alert">{error}</p>}
      </div>
      <div className="workspace-rail__bottom">
        <RailItem icon={<SettingsIcon />} label={t("settings.title")} active={view === "settings"} onClick={() => onChangeView(view === "settings" ? "flow" : "settings")} />
      </div>
    </div>
  </nav>;
}

function RailItem({ icon, label, active, onClick }: { icon: ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return <button type="button" className={`workspace-rail__item${active ? " workspace-rail__item--active" : ""}`} aria-label={label} aria-pressed={active} title={label} onClick={onClick}>
    {icon}<span className="workspace-rail__label">{label}</span>
  </button>;
}
