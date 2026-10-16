import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ProjectScreen } from "./screens/project-screen.js";
import { FlowEditor } from "./screens/flow-editor.js";
import "./styles.css";

function App() {
  const [opened, setOpened] = useState<{ projectId: string; flowId: string }>();

  return opened ? (
    <FlowEditor key={opened.flowId} projectId={opened.projectId} flowId={opened.flowId} onBack={() => setOpened(undefined)}
      onOpenFlow={(flowId) => setOpened({ projectId: opened.projectId, flowId })} />
  ) : <>
    <ProjectScreen onOpenFlow={(projectId, flowId) => setOpened({ projectId, flowId })} />
  </>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
