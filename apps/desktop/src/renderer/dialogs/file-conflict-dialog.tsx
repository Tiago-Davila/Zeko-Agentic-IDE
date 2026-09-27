import { useT } from "../i18n/use-t.js";

interface FileConflictDialogProps {
  onReload: () => void;
  onKeep: () => void;
  onCancel: () => void;
}

export function FileConflictDialog({ onReload, onKeep, onCancel }: FileConflictDialogProps) {
  const t = useT();
  return <div className="dialog-backdrop" role="presentation">
    <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="conflict-title">
      <span className="dialog-symbol dialog-symbol--amber" aria-hidden="true">{"↻"}</span>
      <p className="eyebrow">{t("conflict.eyebrow")}</p>
      <h2 id="conflict-title">{t("conflict.title")}</h2>
      <p>{t("conflict.description")}</p>
      <div className="dialog-actions">
        <button className="button button--quiet" type="button" onClick={onCancel}>{t("common.cancel")}</button>
        <button className="button button--quiet" type="button" onClick={onKeep}>{t("conflict.keep")}</button>
        <button className="button button--primary" type="button" onClick={onReload}>{t("conflict.reload")}</button>
      </div>
    </section>
  </div>;
}
