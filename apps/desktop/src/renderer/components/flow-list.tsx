import { useState } from "react";
import type { FlowSummary } from "../ipc/client.js";
import { IpcClientError, ipc } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";

interface FlowListProps {
  projectId: string;
  flows: FlowSummary[];
  onFlowsChanged: (flows: FlowSummary[]) => void;
  onOpenFlow: (flowId: string) => void;
}

export function FlowList({ projectId, flows, onFlowsChanged, onOpenFlow }: FlowListProps) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function refresh(): Promise<void> {
    const nextFlows = await ipc.request("flow.list", { projectId });
    onFlowsChanged(nextFlows);
  }

  async function createFlow(): Promise<void> {
    const name = window.prompt(t("flow.createPrompt"))?.trim();
    if (!name) return;
    setBusy(true);
    setError(undefined);
    try {
      const { flowId } = await ipc.request("flow.create", { projectId, name });
      await refresh();
      onOpenFlow(flowId);
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setBusy(false);
    }
  }

  async function deleteFlow(flow: FlowSummary): Promise<void> {
    if (!window.confirm(t("flow.deleteConfirm", { name: flow.name }))) return;
    setBusy(true);
    setError(undefined);
    try {
      await ipc.request("flow.delete", { projectId, flowId: flow.id, confirmed: true });
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flow-section" aria-labelledby="flow-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("project.flowsEyebrow")}</p>
          <h2 id="flow-heading">{t("project.flows")}</h2>
        </div>
        <button className="button button--primary" type="button" disabled={busy} onClick={() => void createFlow()}>
          <span aria-hidden="true">{"+"}</span>{t("flow.create")}
        </button>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {flows.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__mark" aria-hidden="true">{"↳"}</span>
          <h3>{t("flow.emptyTitle")}</h3>
          <p>{t("flow.emptyDescription")}</p>
        </div>
      ) : (
        <ul className="flow-list">
          {flows.map((flow) => (
            <li className="flow-row" key={flow.id}>
              <div className="flow-row__identity">
                <span className={`flow-indicator${flow.valid ? " flow-indicator--valid" : ""}`} aria-hidden="true" />
                <div>
                  <h3>{flow.name}</h3>
                  <p>{flow.valid ? t("flow.valid") : t("flow.errorCount", { count: flow.errorCount })}</p>
                </div>
              </div>
              <div className="flow-row__actions">
                <button className="button button--quiet" type="button" disabled={busy} onClick={() => onOpenFlow(flow.id)}>
                  {t("flow.open")}
                </button>
                <button className="icon-button" type="button" aria-label={t("flow.deleteAria", { name: flow.name })}
                  title={t("flow.delete")} disabled={busy} onClick={() => void deleteFlow(flow)}>
                  <span aria-hidden="true">{"⌫"}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function errorMessage(error: unknown, t: ReturnType<typeof useT>): string {
  if (error instanceof IpcClientError) return t("error.generic", { code: error.code });
  return t("error.requestFailed");
}
