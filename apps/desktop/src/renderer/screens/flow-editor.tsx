import { useEffect, useState } from "react";
import type { Diagnostic, FlowFile } from "@zeko/contracts";
import { IpcClientError, ipc } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { FileConflictDialog } from "../dialogs/file-conflict-dialog.js";
import { FlowCanvas } from "../canvas/flow-canvas.js";

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
      onSave={() => void save()} dirty={dirty} saving={saving} />
    {conflict && <FileConflictDialog onCancel={() => setConflict(undefined)} onKeep={keepMyVersion} onReload={() => void reload()} />}
  </>;
}
