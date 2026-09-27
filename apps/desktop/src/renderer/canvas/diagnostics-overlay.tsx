import type { Diagnostic } from "@zeko/contracts";
import { useT } from "../i18n/use-t.js";

interface DiagnosticsOverlayProps {
  diagnostics: Diagnostic[];
  onFocusNode: (nodeId: string) => void;
}

export function DiagnosticsOverlay({ diagnostics, onFocusNode }: DiagnosticsOverlayProps) {
  const t = useT();
  if (diagnostics.length === 0) return null;
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  return <section className={`diagnostics-overlay${errors ? " diagnostics-overlay--error" : ""}`} aria-label={t("validation.title")}>
    <div className="diagnostics-overlay__heading"><span className="diagnostics-overlay__mark" aria-hidden="true">{errors ? "!" : "i"}</span>
      <strong>{errors ? t("validation.errors", { count: errors }) : t("validation.warnings", { count: diagnostics.length })}</strong>
    </div>
    <ul>{diagnostics.map((diagnostic, index) => <li key={`${diagnostic.code}-${diagnostic.nodeId ?? "flow"}-${index}`}>
      {diagnostic.nodeId ? <button type="button" onClick={() => onFocusNode(diagnostic.nodeId ?? "")}>{diagnostic.nodeId}</button> : <span>{t("validation.flow")}</span>}
      <span>{t(diagnostic.code)}</span>
      {diagnostic.location?.line && <small>{t("validation.line", { line: diagnostic.location.line })}</small>}
    </li>)}</ul>
  </section>;
}
