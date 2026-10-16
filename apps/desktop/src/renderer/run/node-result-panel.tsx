import { useEffect, useState } from "react";
import type { RunDetail } from "../ipc/client.js";
import { ipc } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { DiffViewer } from "./diff-viewer.js";
import { RunControls } from "./run-controls.js";
import type { NodeStatus, RunStatus } from "@zeko/contracts";
import { CostUsagePanel } from "./cost-usage-panel.js";

interface NodeResultPanelProps { projectId: string; runId: string; nodeId: string; runStatus: RunStatus; nodeStatus: NodeStatus | undefined }

export function NodeResultPanel({ projectId, runId, nodeId, runStatus, nodeStatus }: NodeResultPanelProps) {
  const t = useT();
  const [detail, setDetail] = useState<RunDetail["nodeRuns"][number]>();
  const [runRecord, setRunRecord] = useState<RunDetail["run"]>();
  const [diffPath, setDiffPath] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDetail(undefined);
    async function refresh(): Promise<void> {
      try {
        const result = await ipc.request("run.get", { runId });
        if (active) { setRunRecord(result?.run); setDetail(result?.nodeRuns.find((nodeRun) => nodeRun.nodeId === nodeId)); }
      } catch {
        if (active) setDetail(undefined);
      } finally { if (active) setLoading(false); }
    }
    void refresh();
    const unsubscribe = ipc.onEvent((event) => {
      if (event.runId !== runId) return;
      if (event.type === "run.finished" || event.type === "run.held" || event.type === "run.resumed" || event.type === "node.result" || event.type === "node.state") void refresh();
    });
    return () => { active = false; unsubscribe(); };
  }, [nodeId, runId]);

  if (loading && !detail) return <section className="result-panel"><header className="result-panel__header"><div><p className="eyebrow">{t("result.eyebrow")}</p><strong>{nodeId}</strong></div>
    <RunControls runId={runId} nodeId={nodeId} runStatus={runStatus} nodeStatus={nodeStatus} /></header><p className="result-panel__empty">{t("result.loading")}</p></section>;
  if (!detail || !runRecord) return <section className="result-panel"><header className="result-panel__header"><div><p className="eyebrow">{t("result.eyebrow")}</p><strong>{nodeId}</strong></div>
    <RunControls runId={runId} nodeId={nodeId} runStatus={runStatus} nodeStatus={nodeStatus} /></header><p className="result-panel__empty">{t("result.notAvailable")}</p></section>;

  return <>
    <section className="result-panel" aria-label={t("result.title")}>
      <header className="result-panel__header"><div><p className="eyebrow">{t("result.eyebrow")}</p><strong>{nodeId}</strong></div>
        <div className="result-panel__actions"><RunControls runId={runId} nodeId={nodeId} runStatus={runStatus} nodeStatus={nodeStatus} />
          <span className={`result-status result-status--${detail.status}`}>{t(`status.${nodeStatus ?? detail.status}`)}</span></div>
      </header>
      <div className="result-panel__content">
        {detail.reason && <section className="result-block"><h3>{t("result.reason")}</h3><p>{t(detail.reason.code, detail.reason.params as Record<string, string | number>)}</p></section>}
        {detail.report && <section className="result-block"><h3>{t("result.report")}</h3><strong>{t(`report.${detail.report.status}`)}</strong><p>{detail.report.summary}</p>
          {detail.report.blockers.length > 0 && <StringList title={t("result.blockers")} values={detail.report.blockers} />}
          {detail.report.findings.length > 0 && <StringList title={t("result.findings")} values={detail.report.findings} />}
        </section>}
        {detail.model && <section className="result-block"><h3>{t("result.model")}</h3><p>{detail.model.model}{detail.model.reasoningEffort ? ` · ${detail.model.reasoningEffort}` : ""}</p>
          <small>{t(detail.model.source === "project_default" ? "result.projectDefault" : "result.nodeModel")}</small></section>}
        {detail.observedFiles && detail.observedFiles.length > 0 && <section className="result-block"><h3>{t("result.filesObserved")}</h3>
          {detail.observedFiles.map((file) => <button className="result-file" type="button" key={file.path} onClick={() => setDiffPath(file.path)}>
            <span>{file.change}</span><code>{file.path}</code>{file.eolOnly && <em>{t("result.lineEndingsOnly")}</em>}
          </button>)}
        </section>}
        {detail.discrepancies && <>
          {detail.discrepancies.scopeViolations.length > 0 && <StringList title={t("result.outOfScope")} values={detail.discrepancies.scopeViolations} danger />}
          {detail.discrepancies.undeclared.length > 0 && <StringList title={t("result.undeclared")} values={detail.discrepancies.undeclared} />}
          {detail.discrepancies.declaredNotObserved.length > 0 && <StringList title={t("result.declaredNotObserved")} values={detail.discrepancies.declaredNotObserved} />}
          {detail.discrepancies.historyRewritten && <p className="result-warning">{t("result.historyRewritten")}</p>}
        </>}
        {detail.denials && detail.denials.length > 0 && <section className="result-block"><h3>{t("result.reportedDenials")}</h3>
          {detail.denials.map((denial, index) => <p key={`${denial.tool}-${index}`}><strong>{denial.tool}</strong>{" — "}{denial.reason}</p>)}
        </section>}
        {detail.denialCheck === "not_available" && <p className="result-warning">{t("result.denialCheckUnavailable")}</p>}
        {detail.inferredDenials.length > 0 && <section className="result-block"><h3>{t("result.inferredDenials")}</h3>
          {detail.inferredDenials.map((denial, index) => <p key={`${denial.source}-${index}`}><span className="inferred-tag">{t("result.inferredTag")}</span>{denial.message}</p>)}
        </section>}
        {detail.inconsistency && <p className="result-warning">{t("result.inconsistency")}</p>}
        <CostUsagePanel projectId={projectId} runId={runId} run={runRecord} nodeRun={detail} />
      </div>
    </section>
    {diffPath && <DiffViewer runId={runId} nodeId={nodeId} path={diffPath} onClose={() => setDiffPath(undefined)} />}
  </>;
}

function StringList({ title, values, danger = false }: { title: string; values: string[]; danger?: boolean }) {
  return <section className={`result-block${danger ? " result-block--danger" : ""}`}><h3>{title}</h3><ul>{values.map((value) => <li key={value}>{value}</li>)}</ul></section>;
}
