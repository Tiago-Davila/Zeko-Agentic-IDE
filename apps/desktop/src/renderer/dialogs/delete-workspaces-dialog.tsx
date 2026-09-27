import { useT } from "../i18n/use-t.js";

interface DeleteWorkspacesDialogProps {
  count: number;
  pending: boolean;
  error: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteWorkspacesDialog({ count, pending, error, onCancel, onConfirm }: DeleteWorkspacesDialogProps) {
  const t = useT();
  return <div className="dialog-backdrop" role="presentation">
    <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-workspaces-title">
      <span className="dialog-symbol dialog-symbol--amber" aria-hidden="true">{"⌫"}</span>
      <p className="eyebrow">{t("history.cleanupEyebrow")}</p>
      <h2 id="delete-workspaces-title">{t("history.cleanupTitle")}</h2>
      <p>{t("history.cleanupDescription", { count })}</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button className="button button--quiet" type="button" disabled={pending} onClick={onCancel}>{t("common.cancel")}</button>
        <button className="button button--primary button--danger" type="button" disabled={pending} onClick={onConfirm}>{pending ? t("history.deleting") : t("history.deleteWorkspaces")}</button>
      </div>
    </section>
  </div>;
}
