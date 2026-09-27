import { useEffect, useState } from "react";
import { IpcClientError, ipc, type RunDetail, type RunSummary } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { DeleteWorkspacesDialog } from "../dialogs/delete-workspaces-dialog.js";

interface HistoryScreenProps { projectId: string; onBack: () => void }

export function HistoryScreen({ projectId, onBack }: HistoryScreenProps) {
  const t = useT();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [detail, setDetail] = useState<RunDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  useEffect(() => {
    let active = true;
    void ipc.request("run.list", { projectId, limit: 100 }).then((result) => {
      if (active) { setRuns(result); setSelectedRunId((current) => current ?? result[0]?.id); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("history.loadFailed"));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, t]);

  useEffect(() => {
    if (!selectedRunId) { setDetail(undefined); return; }
    let active = true;
    setDetail(undefined);
    void ipc.request("run.get", { runId: selectedRunId }).then((result) => { if (active) setDetail(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("history.loadFailed")); });
    return () => { active = false; };
  }, [selectedRunId, t]);

  async function deleteWorkspaces(): Promise<void> {
    if (!detail) return;
    setDeleting(true); setDeleteError(undefined);
    try {
      await ipc.request("workspaces.delete", { runId: detail.run.id, confirmed: true });
      setConfirmDelete(false);
      setDetail({ ...detail, nodeRuns: detail.nodeRuns.map((node) => ({ ...node, workspacePath: "" })) });
    } catch (cause) {
      setDeleteError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("history.deleteFailed"));
    } finally { setDeleting(false); }
  }

  const selected = runs.find((run) => run.id === selectedRunId);
  const retainedWorkspaces = detail?.nodeRuns.filter((node) => node.workspacePath).length ?? 0;
  return <main className="history-shell">
    <header className="history-toolbar"><button className="button button--quiet" type="button" onClick={onBack}>{t("history.back")}</button>
      <div><p className="eyebrow">{t("history.eyebrow")}</p><h1>{t("history.title")}</h1></div>
      <span>{t("history.runCount", { count: runs.length })}</span>
    </header>
    {error && <p className="inline-error history-error" role="alert">{error}</p>}
    <div className="history-layout">
      <aside className="history-list" aria-label={t("history.runList")}>
        {loading && <p className="history-empty">{t("history.loading")}</p>}
        {!loading && runs.length === 0 && <p className="history-empty">{t("history.empty")}</p>}
        {runs.map((run) => <button className={`history-run${run.id === selectedRunId ? " history-run--selected" : ""}`} key={run.id} type="button" onClick={() => setSelectedRunId(run.id)}>
          <span className={`history-run__status history-run__status--${run.status}`} aria-hidden="true" />
          <span className="history-run__body"><strong>{run.flowId}</strong><small>{new Date(run.startedAt).toLocaleString()}</small>
            <small>{run.costUsd === undefined ? t("costUsage.notAvailable") : formatUsd(run.costUsd)}{run.estimated ? t("costUsage.separator") + t("costUsage.estimated") : ""}</small>
          </span>
          <span className="history-run__meta"><small>{t(`status.${run.status}`)}</small><small>{t(`history.origin.${run.origin}`)}</small></span>
        </button>)}
      </aside>

      <section className="history-detail" aria-label={t("history.runDetail")}>
        {!selected && <p className="history-empty">{t("history.selectRun")}</p>}
        {selected && <>
          <header className="history-detail__header"><div><p className="eyebrow">{t("history.flowRun")}</p><h2>{detail?.run.flowName ?? selected.flowId}</h2>
              <p>{new Date(selected.startedAt).toLocaleString()}</p></div>
            <span className={`result-status result-status--${selected.status}`}>{t(`status.${selected.status}`)}</span>
          </header>
          <div className="history-metrics"><Metric label={t("history.origin")} value={t(`history.origin.${detail?.run.origin ?? selected.origin}`)} />
            <Metric label={t("history.duration")} value={formatDuration(detail?.run.durationMs ?? selected.durationMs, t)} />
            <Metric label={t("history.cost")} value={selected.costUsd === undefined ? t("costUsage.notAvailable") : formatUsd(selected.costUsd)} />
            <Metric label={t("history.baseCommit")} value={detail?.run.baseCommit.slice(0, 10) ?? t("history.unavailable")} />
          </div>
          <section className="history-nodes"><h3>{t("history.nodeResults")}</h3>
            {detail?.nodeRuns.map((node) => <article className="history-node" key={node.nodeId}>
              <div className="history-node__heading"><strong>{node.nodeId}</strong>{node.agentId && <span>{t(node.agentId === "claude-code" ? "agent.claudeCode" : node.agentId === "codex" ? "agent.codex" : "agent.fake")}</span>}
                <span className={`result-status result-status--${node.status}`}>{t(`status.${node.status}`)}</span>
              </div>
              {node.report && <p>{node.report.summary}</p>}
              {node.reason && <small>{t(node.reason.code, node.reason.params as Record<string, string | number>)}</small>}
              {node.model && <small>{t("result.model")}{t("history.modelValueSeparator")}{node.model.model}{t("costUsage.separator")}{t(node.model.source === "project_default" ? "result.projectDefault" : "result.nodeModel")}</small>}
            </article>)}
            {detail && detail.nodeRuns.length === 0 && <p className="history-empty">{t("history.noNodeResults")}</p>}
          </section>
          {detail && retainedWorkspaces > 0 && <button className="button button--quiet history-delete" type="button" disabled={detail.run.status === "running"} onClick={() => { setDeleteError(undefined); setConfirmDelete(true); }}>
            {t("history.deleteWorkspaces")}{t("costUsage.separator")}{t("history.workspaceCount", { count: retainedWorkspaces })}
          </button>}
        </>}
      </section>
    </div>
    {confirmDelete && <DeleteWorkspacesDialog count={retainedWorkspaces} pending={deleting} error={deleteError} onCancel={() => setConfirmDelete(false)} onConfirm={() => void deleteWorkspaces()} />}
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="history-metric"><small>{label}</small><strong>{value}</strong></div>; }
function formatUsd(amount: number): string { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(amount); }
function formatDuration(milliseconds: number | undefined, t: ReturnType<typeof useT>): string {
  if (milliseconds === undefined) return t("history.unavailable");
  const seconds = Math.floor(milliseconds / 1000);
  return seconds < 60 ? t("history.duration.seconds", { seconds }) : t("history.duration.minutes", { minutes: Math.floor(seconds / 60), seconds: seconds % 60 });
}
