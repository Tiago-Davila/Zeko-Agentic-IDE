import { useEffect, useState } from "react";
import type { ProjectConfig } from "@zeko/contracts";
import { IpcClientError, ipc } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";

interface SettingsScreenProps { projectId: string; onBack: () => void }

export function SettingsScreen({ projectId, onBack }: SettingsScreenProps) {
  const t = useT();
  const [config, setConfig] = useState<ProjectConfig>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void ipc.request("settings.get", { projectId }).then((result) => { if (active) setConfig(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("settings.loadFailed")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, t]);

  async function save(): Promise<void> {
    if (!config || saving) return;
    setSaving(true); setError(undefined); setMessage(undefined);
    try {
      setConfig(await ipc.request("settings.set", { projectId, config }));
      setMessage(t("settings.saved"));
    } catch (cause) {
      setError(cause instanceof IpcClientError ? t("error.generic", { code: cause.code }) : t("settings.saveFailed"));
    } finally { setSaving(false); }
  }

  function update<K extends keyof ProjectConfig>(key: K, value: ProjectConfig[K]): void {
    setConfig((current) => current ? { ...current, [key]: value } : current);
  }

  function updateClaudeModel(model: string): void {
    if (!config) return;
    update("defaultModels", { ...config.defaultModels, "claude-code": { model } });
  }

  function updateCodexModel(model: string): void {
    if (!config) return;
    update("defaultModels", { ...config.defaultModels, codex: { model, reasoningEffort: config.defaultModels.codex?.reasoningEffort ?? "low" } });
  }

  function updateCodexEffort(reasoningEffort: string): void {
    if (!config) return;
    update("defaultModels", { ...config.defaultModels, codex: { model: config.defaultModels.codex?.model ?? "gpt-6-luna", reasoningEffort } });
  }

  return <main className="settings-shell">
    <header className="settings-toolbar"><button className="button button--quiet" type="button" onClick={onBack}>{t("settings.back")}</button>
      <div><p className="eyebrow">{t("settings.eyebrow")}</p><h1>{t("settings.title")}</h1></div>
      <button className="button button--primary" type="button" disabled={!config || loading || saving} onClick={() => void save()}>{saving ? t("settings.saving") : t("settings.save")}</button>
    </header>
    <div className="settings-content">
      {loading && <p className="settings-muted">{t("settings.loading")}</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {message && <p className="settings-success" role="status">{message}</p>}
      {config && <>
        <section className="settings-section"><p className="eyebrow">{t("settings.executionEyebrow")}</p><h2>{t("settings.executionTitle")}</h2>
          <p>{t("settings.executionDescription")}</p>
          <label className="settings-field"><span>{t("settings.concurrency")}</span><small>{t("settings.concurrencyHelp")}</small>
            <input type="number" min={1} max={64} step={1} value={config.concurrencyLimit} onChange={(event) => update("concurrencyLimit", Number(event.target.value))} />
          </label>
          <label className="settings-field"><span>{t("settings.usageThreshold")}</span><small>{t("settings.usageThresholdHelp")}</small>
            <input type="number" min={0.5} max={1} step={0.01} value={config.usageNearLimitThreshold} onChange={(event) => update("usageNearLimitThreshold", Number(event.target.value))} />
          </label>
        </section>
        <section className="settings-section"><p className="eyebrow">{t("settings.modelsEyebrow")}</p><h2>{t("settings.modelsTitle")}</h2>
          <p>{t("settings.modelsDescription")}</p>
          <div className="settings-model-grid">
            <div className="settings-model"><h3>{t("agent.claudeCode")}</h3><label className="settings-field"><span>{t("node.model")}</span>
              <input value={config.defaultModels["claude-code"]?.model ?? ""} placeholder="sonnet" onChange={(event) => updateClaudeModel(event.target.value)} />
            </label></div>
            <div className="settings-model"><h3>{t("agent.codex")}</h3><label className="settings-field"><span>{t("node.model")}</span>
              <input value={config.defaultModels.codex?.model ?? ""} placeholder="gpt-6-luna" onChange={(event) => updateCodexModel(event.target.value)} />
            </label>
              <label className="settings-field"><span>{t("node.reasoningEffort")}</span>
                <select value={config.defaultModels.codex?.reasoningEffort ?? "low"} onChange={(event) => updateCodexEffort(event.target.value)}>
                  <option value="minimal">{t("node.effortMinimal")}</option><option value="low">{t("node.effortLow")}</option>
                  <option value="medium">{t("node.effortMedium")}</option><option value="high">{t("node.effortHigh")}</option>
                  <option value="xhigh">{t("node.effortXhigh")}</option>
                </select>
              </label>
            </div>
          </div>
        </section>
      </>}
    </div>
  </main>;
}
