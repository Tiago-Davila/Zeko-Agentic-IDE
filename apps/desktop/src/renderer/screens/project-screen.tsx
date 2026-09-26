import { useState } from "react";
import type { FlowSummary } from "../ipc/client.js";
import { IpcClientError, ipc } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { FlowList } from "../components/flow-list.js";

interface ProjectScreenProps {
  onOpenFlow: (projectId: string, flowId: string) => void;
}

interface ProjectState {
  projectId: string;
  root: string;
  flows: FlowSummary[];
}

export function ProjectScreen({ onOpenFlow }: ProjectScreenProps) {
  const t = useT();
  const [project, setProject] = useState<ProjectState>();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();

  async function openFolder(): Promise<void> {
    setError(undefined);
    const path = await ipc.openProjectFolder();
    if (!path) return;
    setOpening(true);
    try {
      setProject(await ipc.request("project.open", { path }));
    } catch (cause) {
      setError(projectError(cause, t));
    } finally {
      setOpening(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="project-rail">
        <div className="brand-lockup"><span className="brand-symbol" aria-hidden="true">{"Z"}</span><span>{t("brand.name")}</span></div>
        <div className="rail-caption">{t("project.workspace")}</div>
        {project ? (
          <div className="rail-project"><span className="rail-project__dot" aria-hidden="true" />
            <span title={project.root}>{project.root.split(/[\\/]/).filter(Boolean).at(-1) ?? project.root}</span>
          </div>
        ) : <p className="rail-empty">{t("project.noProject")}</p>}
        <div className="rail-bottom">{t("project.localOnly")}</div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>{t("project.workspace")}</span><span className="breadcrumb-separator">{"/"}</span>
            <strong>{project ? project.root.split(/[\\/]/).filter(Boolean).at(-1) : t("project.noProject")}</strong>
          </div>
          <button className="button button--quiet" type="button" disabled={opening} onClick={() => void openFolder()}>
            <span aria-hidden="true">{"⌕"}</span>{project ? t("project.switch") : t("project.open")}
          </button>
        </header>
        {error && <p className="inline-error project-error" role="alert">{error}</p>}

        {project ? (
          <div className="project-content">
            <section className="project-intro">
              <div>
                <p className="eyebrow">{t("project.repository")}</p>
                <h1>{project.root.split(/[\\/]/).filter(Boolean).at(-1) ?? project.root}</h1>
                <p className="project-path">{project.root}</p>
              </div>
              <div className="repo-status"><span className="repo-status__dot" aria-hidden="true" />{t("project.gitRepository")}</div>
            </section>
            <FlowList projectId={project.projectId} flows={project.flows}
              onFlowsChanged={(flows) => setProject((current) => current ? { ...current, flows } : current)}
              onOpenFlow={(flowId) => onOpenFlow(project.projectId, flowId)} />
          </div>
        ) : (
          <section className="welcome-panel">
            <div className="welcome-panel__art" aria-hidden="true"><span /><span /><span /><i /></div>
            <p className="eyebrow">{t("project.welcomeEyebrow")}</p>
            <h1>{t("project.welcomeTitle")}</h1>
            <p className="welcome-copy">{t("project.welcomeDescription")}</p>
            <button className="button button--primary button--large" type="button" disabled={opening} onClick={() => void openFolder()}>
              <span aria-hidden="true">{"⌕"}</span>{opening ? t("project.opening") : t("project.chooseFolder")}
            </button>
            <p className="welcome-footnote">{t("project.gitOnly")}</p>
          </section>
        )}
      </div>
    </main>
  );
}

function projectError(error: unknown, t: ReturnType<typeof useT>): string {
  if (error instanceof IpcClientError && error.code === "NOT_A_GIT_REPO") return t("project.notGit");
  if (error instanceof IpcClientError && error.code === "NO_COMMITS") return t("project.noCommits");
  if (error instanceof IpcClientError) return t("error.generic", { code: error.code });
  return t("error.requestFailed");
}
