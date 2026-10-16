import { useState } from "react";
import type { NodeStatus, RunStatus } from "@zeko/contracts";
import { IpcClientError, ipc } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";

interface RunControlsProps { runId: string; nodeId: string; runStatus: RunStatus; nodeStatus: NodeStatus | undefined }

export function RunControls({ runId, nodeId, runStatus, nodeStatus }: RunControlsProps) {
  const t = useT();
  const [pending, setPending] = useState<"run" | "node">();
  const [error, setError] = useState<string>();
  const runActive = runStatus === "running";
  const nodeActive = nodeStatus === "running" || nodeStatus === "waiting_approval";

  async function cancelRun(): Promise<void> {
    setPending("run"); setError(undefined);
    try { await ipc.request("run.cancel", { runId }); }
    catch (cause) { setError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("run.cancelFailed")); }
    finally { setPending(undefined); }
  }

  async function cancelNode(): Promise<void> {
    setPending("node"); setError(undefined);
    try { await ipc.request("node.cancel", { runId, nodeId }); }
    catch (cause) { setError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("node.cancelFailed")); }
    finally { setPending(undefined); }
  }

  return <div className="run-controls">
    {runActive && <button className="button button--cancel" type="button" disabled={pending !== undefined} onClick={() => void cancelRun()}>
      {pending === "run" ? t("run.cancelling") : t("run.cancel")}
    </button>}
    {runActive && nodeActive && <button className="button button--cancel-node" type="button" disabled={pending !== undefined} onClick={() => void cancelNode()}>
      {pending === "node" ? t("node.cancelling") : t("node.cancel")}
    </button>}
    {error && <span className="run-controls__error" role="alert">{error}</span>}
  </div>;
}
