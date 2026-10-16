import type { PredecessorResult } from "@zeko/contracts";
import { useT } from "../i18n/use-t.js";

interface ApprovalDialogProps {
  nodeId: string;
  summary: PredecessorResult[];
  pending: boolean;
  error: string | undefined;
  onDecide: (decision: "approved" | "rejected") => void;
}

export function ApprovalDialog({ nodeId, summary, pending, error, onDecide }: ApprovalDialogProps) {
  const t = useT();
  return <div className="dialog-backdrop" role="presentation">
    <section className="confirm-dialog approval-dialog" role="dialog" aria-modal="true" aria-labelledby="approval-title">
      <span className="dialog-symbol dialog-symbol--amber" aria-hidden="true">{"✓"}</span>
      <p className="eyebrow">{t("approval.eyebrow")}</p>
      <h2 id="approval-title">{t("approval.title", { node: nodeId })}</h2>
      <p>{t("approval.description")}</p>
      <div className="approval-predecessors">
        {summary.map((predecessor) => <article className="approval-predecessor" key={predecessor.nodeId}>
          <header><div><strong>{predecessor.nodeId}</strong>{predecessor.agent && <span>{predecessor.agent === "claude-code" ? t("agent.claudeCode") : predecessor.agent === "codex" ? t("agent.codex") : predecessor.agent}</span>}</div>
            <span className={`result-status result-status--${predecessor.finalStatus}`}>{t(`status.${predecessor.finalStatus}`)}</span>
          </header>
          {predecessor.report && <p>{predecessor.report.summary}</p>}
          {predecessor.observedFiles.length > 0 && <div className="approval-files"><strong>{t("approval.files")}</strong>
            {predecessor.observedFiles.map((file) => <span key={file.path}>{file.change} {file.path}{file.eolOnly ? ` · ${t("result.lineEndingsOnly")}` : ""}</span>)}
          </div>}
          {predecessor.discrepancies.scopeViolations.length > 0 && <div className="approval-scope"><strong>{t("result.outOfScope")}</strong>
            {predecessor.discrepancies.scopeViolations.map((path) => <span key={path}>{path}</span>)}
          </div>}
        </article>)}
        {summary.length === 0 && <p className="approval-empty">{t("approval.noPredecessors")}</p>}
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button className="button button--quiet" type="button" disabled={pending} onClick={() => onDecide("rejected")}>{pending ? t("approval.submitting") : t("approval.reject")}</button>
        <button className="button button--primary" type="button" disabled={pending} onClick={() => onDecide("approved")}>{pending ? t("approval.submitting") : t("approval.approve")}</button>
      </div>
    </section>
  </div>;
}
