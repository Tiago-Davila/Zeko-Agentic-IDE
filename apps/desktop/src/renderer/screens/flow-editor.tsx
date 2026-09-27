import { useEffect, useState } from "react";
import { PredecessorResultSchema, type Diagnostic, type FlowFile, type PredecessorResult } from "@zeko/contracts";
import { IpcClientError, ipc } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { FileConflictDialog } from "../dialogs/file-conflict-dialog.js";
import { PreflightDialog } from "../dialogs/preflight-dialog.js";
import { ApprovalDialog } from "../dialogs/approval-dialog.js";
import { FlowCanvas } from "../canvas/flow-canvas.js";
import type { PreflightResult } from "../ipc/client.js";
import { HistoryScreen } from "./history-screen.js";
import { SettingsScreen } from "./settings-screen.js";

interface FlowEditorProps { projectId: string; flowId: string; onBack: () => void }
interface Conflict { currentHash: string }

export function FlowEditor({ projectId, flowId, onBack }: FlowEditorProps) {
  const t = useT();
  const [flow, setFlow] = useState<FlowFile>();
  const [fileHash, setFileHash] = useState("");
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState<Conflict>();
  const [preflight, setPreflight] = useState<PreflightResult>();
  const [starting, setStarting] = useState(false);
  const [runId, setRunId] = useState<string>();
  const [runStatus, setRunStatus] = useState<"running" | "finished" | "cancelled" | "interrupted">("running");
  const [preflightError, setPreflightError] = useState<string>();
  const [approvals, setApprovals] = useState<Array<{ nodeId: string; summary: PredecessorResult[] }>>([]);
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalError, setApprovalError] = useState<string>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function reload(): Promise<void> {
    setLoading(true);
    setError(undefined);
    try {
      const loaded = await ipc.request("flow.load", { projectId, flowId });
      setFileHash(loaded.fileHash);
      setDiagnostics(loaded.diagnostics);
      setFlow(loaded.flow);
      setDirty(false);
      setConflict(undefined);
    } catch {
      setError(t("flow.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, [projectId, flowId]);

  useEffect(() => ipc.onEvent((event) => {
    if (event.type !== "flow.fileChanged") return;
    const payload = event.payload as { projectId?: unknown; flowId?: unknown; fileHash?: unknown };
    if (payload.projectId !== projectId || payload.flowId !== flowId || typeof payload.fileHash !== "string") return;
    if (payload.fileHash === fileHash) return;
    setConflict({ currentHash: payload.fileHash });
  }), [fileHash, flowId, projectId]);

  useEffect(() => {
    if (!runId) return;
    let active = true;
    void ipc.request("run.get", { runId }).then((result) => {
      if (active && result) setRunStatus(result.run.status);
    }).catch(() => undefined);
    const unsubscribe = ipc.onEvent((event) => {
      if (event.runId !== runId || typeof event.payload !== "object" || event.payload === null) return;
      if (event.type === "approval.requested") {
        const payload = event.payload as Record<string, unknown>;
        const nodeId = payload["nodeId"];
        const summaries = payload["summary"];
        if (typeof nodeId !== "string" || !Array.isArray(summaries)) return;
        const parsed = summaries.map((item) => PredecessorResultSchema.safeParse(item));
        const summary = parsed.flatMap((item) => item.success ? [item.data] : []);
        if (summary.length !== parsed.length) return;
        setApprovals((current) => current.some((item) => item.nodeId === nodeId) ? current : [...current, { nodeId, summary }]);
        return;
      }
      if (event.type === "node.state") {
        const payload = event.payload as Record<string, unknown>;
        if ((payload["status"] === "approved" || payload["status"] === "rejected") && typeof payload["nodeId"] === "string") {
          setApprovals((current) => current.filter((item) => item.nodeId !== payload["nodeId"]));
        }
        return;
      }
      if (event.type !== "run.finished") return;
      const status = (event.payload as Record<string, unknown>)["status"];
      if (status === "running" || status === "finished" || status === "cancelled" || status === "interrupted") setRunStatus(status);
    });
    return () => { active = false; unsubscribe(); };
  }, [runId]);

  async function save(): Promise<void> {
    if (!flow || saving || !dirty) return;
    setSaving(true);
    setError(undefined);
    try {
      const result = await ipc.request("flow.save", { projectId, flow, expectedHash: fileHash });
      setFileHash(result.fileHash);
      setDiagnostics(result.diagnostics);
      setDirty(false);
      setConflict(undefined);
    } catch (cause) {
      if (cause instanceof IpcClientError && cause.code === "FILE_CHANGED_ON_DISK" && typeof cause.params["currentHash"] === "string") {
        setConflict({ currentHash: cause.params["currentHash"] });
      } else setError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("flow.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function keepMyVersion(): void {
    if (!conflict) return;
    setFileHash(conflict.currentHash);
    setConflict(undefined);
  }

  async function checkBeforeRun(): Promise<void> {
    setPreflightError(undefined);
    try {
      setPreflight(await ipc.request("run.preflight", { projectId, flowId }));
    } catch (cause) {
      setError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("preflight.failed"));
    }
  }

  async function startRun(): Promise<void> {
    if (!preflight?.ok || !fileHash) return;
    setStarting(true);
    setPreflightError(undefined);
    try {
      const result = await ipc.request("run.start", { projectId, flowId, fileHash });
      setRunId(result.runId);
      setRunStatus("running");
      setPreflight(undefined);
    } catch (cause) {
      setPreflightError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("run.startFailed"));
    } finally {
      setStarting(false);
    }
  }

  async function decideApproval(nodeId: string, decision: "approved" | "rejected"): Promise<void> {
    if (!runId || approvalPending) return;
    setApprovalPending(true); setApprovalError(undefined);
    try {
      await ipc.request("approval.decide", { runId, nodeId, decision });
      setApprovals((current) => current.filter((item) => item.nodeId !== nodeId));
    } catch (cause) {
      setApprovalError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("approval.failed"));
    } finally { setApprovalPending(false); }
  }

  if (historyOpen) return <HistoryScreen projectId={projectId} onBack={() => setHistoryOpen(false)} />;
  if (settingsOpen) return <SettingsScreen projectId={projectId} onBack={() => setSettingsOpen(false)} />;
  if (loading) return <main className="flow-editor-state"><span className="eyebrow">{t("flow.loading")}</span></main>;
  if (!flow) return <main className="flow-editor-state">
    <button className="button button--quiet" type="button" onClick={onBack}>{t("canvas.back")}</button>
    <div className="invalid-flow-panel"><p className="eyebrow">{t("flow.cannotOpen")}</p><h1>{t("flow.invalidTitle")}</h1>
      <p>{error ?? t("flow.invalidDescription")}</p>
      {diagnostics.map((diagnostic, index) => <div className="file-diagnostic" key={`${diagnostic.code}-${index}`}>
        <div><strong>{t(diagnostic.code)}</strong>{typeof diagnostic.params["message"] === "string" && <p>{diagnostic.params["message"]}</p>}
          {typeof diagnostic.params["path"] === "string" && <small>{diagnostic.params["path"]}</small>}</div>
        <span>{diagnostic.location ? t("validation.lineColumn", { line: diagnostic.location.line ?? 1, column: diagnostic.location.column ?? 1 }) : t("validation.noLocation")}</span>
      </div>)}
      <button className="button button--quiet" type="button" onClick={() => void reload()}>{t("flow.tryAgain")}</button>
    </div>
  </main>;

  return <>
    {error && <div className="editor-error" role="alert">{error}</div>}
    <FlowCanvas projectId={projectId} flow={flow} onChange={(next) => { setFlow(next); setDirty(true); }} onBack={onBack}
      onSave={() => void save()} onStartRun={() => void checkBeforeRun()} onOpenHistory={() => setHistoryOpen(true)} onOpenSettings={() => setSettingsOpen(true)} dirty={dirty} saving={saving} runId={runId} runStatus={runStatus} />
    {runId && <div className="run-start-toast" role="status">{t("run.started")}</div>}
    {conflict && <FileConflictDialog onCancel={() => setConflict(undefined)} onKeep={keepMyVersion} onReload={() => void reload()} />}
    {preflight && <PreflightDialog result={preflight} running={starting} error={preflightError} onCancel={() => setPreflight(undefined)} onStart={() => void startRun()} />}
    {approvals[0] && <ApprovalDialog nodeId={approvals[0].nodeId} summary={approvals[0].summary} pending={approvalPending} error={approvalError}
      onDecide={(decision) => void decideApproval(approvals[0]?.nodeId ?? "", decision)} />}
  </>;
}
