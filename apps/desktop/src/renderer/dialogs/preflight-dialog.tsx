import type { PreflightResult } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";

interface PreflightDialogProps {
  result: PreflightResult;
  running: boolean;
  error: string | undefined;
  onCancel: () => void;
  onStart: () => void;
}

export function PreflightDialog({ result, running, error, onCancel, onStart }: PreflightDialogProps) {
  const t = useT();
  return <div className="dialog-backdrop" role="presentation">
    <section className="confirm-dialog preflight-dialog" role="dialog" aria-modal="true" aria-labelledby="preflight-title">
      <p className="eyebrow">{t("preflight.eyebrow")}</p>
      <h2 id="preflight-title">{t("preflight.title")}</h2>
      <p>{t("preflight.description")}</p>
      <section className={`preflight-repository${result.uncommittedChanges ? " preflight-repository--warning" : ""}`}>
        <span className="preflight-status-dot" aria-hidden="true" />
        <span>{result.uncommittedChanges ? t("preflight.uncommitted") : t("preflight.clean")}</span>
      </section>
      <div className="preflight-agent-list">
        {result.perNodeAuth.map((item) => <article className="preflight-agent" key={item.nodeId}>
          <div className="preflight-agent__heading"><strong>{t(item.agentId === "claude-code" ? "agent.claudeCode" : item.agentId === "codex" ? "agent.codex" : "agent.fake")}</strong><code>{item.nodeId}</code></div>
          <div className="preflight-agent__details">
            <span>{item.installed ? t("preflight.installed") : t("preflight.notInstalled")}</span>
            <span>{t(`preflight.auth.${item.state}`)}</span>
            {item.mode && <span>{t(`preflight.mode.${item.mode}`)}</span>}
            {item.mode === "api_key" && !item.verified && <span className="preflight-tag preflight-tag--warning">{t("preflight.apiKeyUnverified")}</span>}
          </div>
        </article>)}
      </div>
      {result.missing.length > 0 && <p className="preflight-blocked" role="alert">{t("preflight.missing", { count: result.missing.length })}</p>}
      {result.warnings.map((warning) => <p className="preflight-warning" key={warning}>{t(warning)}</p>)}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button className="button button--quiet" type="button" disabled={running} onClick={onCancel}>{t("common.cancel")}</button>
        <button className="button button--primary" type="button" disabled={!result.ok || running} onClick={onStart}>
          {running ? t("preflight.starting") : t("preflight.startRun")}
        </button>
      </div>
    </section>
  </div>;
}
