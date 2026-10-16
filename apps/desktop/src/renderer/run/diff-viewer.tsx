import { useEffect, useState } from "react";
import { IpcClientError, ipc } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";

interface DiffViewerProps { runId: string; nodeId: string; path: string; onClose: () => void }

export function DiffViewer({ runId, nodeId, path, onClose }: DiffViewerProps) {
  const t = useT();
  const [patch, setPatch] = useState<string>();
  const [error, setError] = useState<string>();
  const [nextOffset, setNextOffset] = useState<number>();
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    let active = true;
    setPatch(undefined);
    setError(undefined);
    setNextOffset(undefined);
    void ipc.request("node.diff", { runId, nodeId, path, offset: 0, limit: 500 }).then((result) => {
      if (active) { setPatch(result.patch ?? t("result.diffUnavailable")); setNextOffset(result.nextOffset); }
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("result.diffFailed"));
    });
    return () => { active = false; };
  }, [nodeId, path, runId, t]);

  async function loadMore(): Promise<void> {
    if (nextOffset === undefined || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await ipc.request("node.diff", { runId, nodeId, path, offset: nextOffset, limit: 500 });
      setPatch((current) => `${current ?? ""}${result.patch ?? ""}`);
      setNextOffset(result.nextOffset);
    } catch (cause) {
      setError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("result.diffFailed"));
    } finally { setLoadingMore(false); }
  }
  return <div className="diff-backdrop" role="presentation">
    <section className="diff-dialog" role="dialog" aria-modal="true" aria-labelledby="diff-title">
      <header><div><p className="eyebrow">{t("result.diffEyebrow")}</p><h2 id="diff-title">{path}</h2></div>
        <button className="icon-button" type="button" aria-label={t("common.dismiss")} onClick={onClose}>{"×"}</button>
      </header>
      {error ? <p className="inline-error" role="alert">{error}</p> : <pre>{patch ?? t("result.diffLoading")}</pre>}
      {nextOffset !== undefined && <button className="button button--quiet diff-more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? t("result.diffLoading") : t("result.diffMore")}</button>}
    </section>
  </div>;
}
