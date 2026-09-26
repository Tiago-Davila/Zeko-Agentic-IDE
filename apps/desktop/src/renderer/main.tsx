import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { useT } from "./i18n/use-t.js";
import { ProjectScreen } from "./screens/project-screen.js";
import "./styles.css";

function App() {
  const t = useT();
  const [openedFlow, setOpenedFlow] = useState<string>();
  return <>
    <ProjectScreen onOpenFlow={(_projectId, flowId) => setOpenedFlow(flowId)} />
    {openedFlow && <div className="selection-toast" role="status">{t("flow.selected", { id: openedFlow })}</div>}
  </>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
