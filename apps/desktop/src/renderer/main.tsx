import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import type { FlowFile } from "@zeko/contracts";
import { ipc } from "./ipc/client.js";
import { useT } from "./i18n/use-t.js";
import { ProjectScreen } from "./screens/project-screen.js";
import { FlowCanvas } from "./canvas/flow-canvas.js";
import "./styles.css";

function App() {
  const t = useT();
  const [opened, setOpened] = useState<{ projectId: string; flow: FlowFile }>();
  const [error, setError] = useState<string>();

  async function openFlow(projectId: string, flowId: string): Promise<void> {
    setError(undefined);
    try {
      const result = await ipc.request("flow.load", { projectId, flowId });
      if (!result.flow) throw new Error("Flow file is unavailable");
      setOpened({ projectId, flow: result.flow });
    } catch {
      setError(t("flow.openFailed"));
    }
  }

  return opened ? (
    <FlowCanvas projectId={opened.projectId} flow={opened.flow} onChange={(flow) => setOpened({ ...opened, flow })}
      onBack={() => setOpened(undefined)} />
  ) : <>
    <ProjectScreen onOpenFlow={(projectId, flowId) => void openFlow(projectId, flowId)} />
    {error && <div className="selection-toast" role="alert">{error}</div>}
  </>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
