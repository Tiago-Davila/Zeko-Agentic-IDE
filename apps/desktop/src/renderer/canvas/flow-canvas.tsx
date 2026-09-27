import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Connection,
  type Edge as CanvasEdge,
  type EdgeChange,
  type Node as CanvasNode,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { DEFAULT_MODELS, type AgentNode, type Diagnostic, type Edge, type FlowFile, type FlowNode, type ProjectConfig } from "@zeko/contracts";
import { ipc, type NodeView } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { AgentCanvasNode, ApprovalCanvasNode, InputCanvasNode, type FlowNodeData } from "./node-types.js";
import { NodeDock } from "../panels/node-dock.js";
import { DiagnosticsOverlay } from "./diagnostics-overlay.js";
import { useRunState } from "../run/run-state-store.js";
import { NodeResultPanel } from "../run/node-result-panel.js";
import type { RunStatus } from "@zeko/contracts";

interface FlowCanvasProps {
  projectId: string;
  flow: FlowFile;
  onChange: (flow: FlowFile) => void;
  onBack: () => void;
  onSave: () => void;
  onStartRun: () => void;
  dirty: boolean;
  saving: boolean;
  runId?: string | undefined;
  runStatus: RunStatus;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

const nodeTypes = { input: InputCanvasNode, agent: AgentCanvasNode, approval: ApprovalCanvasNode };

export function FlowCanvas({ projectId, flow, onChange, onBack, onSave, onStartRun, onOpenHistory, onOpenSettings, dirty, saving, runId, runStatus }: FlowCanvasProps) {
  const t = useT();
  const [message, setMessage] = useState<string>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [defaults, setDefaults] = useState<ProjectConfig["defaultModels"]>(DEFAULT_MODELS);
  const [notApplicable, setNotApplicable] = useState<string[]>([]);
  const liveStates = useRunState(runId);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [validationReady, setValidationReady] = useState(false);
  const [nodeViews, setNodeViews] = useState<NodeView[]>([]);
  const validationRequestId = useRef(0);
  const selectedNode = flow.nodes.find((node) => node.id === selectedNodeId);
  const nodes = useMemo<CanvasNode<FlowNodeData>[]>(() => flow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: { flowNode: node, diagnostics: diagnostics.filter((item) => item.nodeId === node.id), nodeView: nodeViews.find((view) => view.nodeId === node.id) ?? null, liveState: liveStates[node.id] ?? null },
  })), [diagnostics, flow.nodes, liveStates, nodeViews]);
  const edges = useMemo<CanvasEdge[]>(() => flow.edges.map((edge) => ({
    id: `${edge.from}->${edge.to}`,
    source: edge.from,
    target: edge.to,
    type: "smoothstep",
  })), [flow.edges]);
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");

  useEffect(() => {
    let current = true;
    void ipc.request("settings.get", { projectId }).then((config) => {
      if (current) setDefaults(config.defaultModels);
    }).catch(() => {
      if (current) setMessage(t("settings.loadFailed"));
    });
    return () => { current = false; };
  }, [projectId, t]);

  useEffect(() => {
    setValidationReady(false);
    const requestId = ++validationRequestId.current;
    const timer = window.setTimeout(() => {
      void ipc.request("flow.validate", { projectId, flow }).then(({ diagnostics: nextDiagnostics, nodeViews }) => {
        if (requestId !== validationRequestId.current) return;
        setDiagnostics(nextDiagnostics);
        setNodeViews(nodeViews);
        setValidationReady(true);
        const view = selectedNode?.type === "agent" ? nodeViews.find((item) => item.nodeId === selectedNode.id) : undefined;
        setNotApplicable(view?.notApplicable ?? []);
      }).catch(() => {
        if (requestId !== validationRequestId.current) return;
        setNotApplicable([]); setDiagnostics([]); setNodeViews([]); setValidationReady(false);
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [flow, projectId, selectedNodeId, selectedNode]);

  const updateNodes = useCallback((changes: NodeChange<CanvasNode<FlowNodeData>>[]) => {
    const nextNodes = applyNodeChanges(changes, nodes);
    const nextFlowNodes = flow.nodes.flatMap((node) => {
      const next = nextNodes.find((candidate) => candidate.id === node.id);
      return next ? [{ ...node, position: { x: Math.round(next.position.x), y: Math.round(next.position.y) } } as FlowNode] : [];
    });
    const changed = nextFlowNodes.length !== flow.nodes.length || nextFlowNodes.some((node, index) => {
      const current = flow.nodes[index];
      return !current || current.id !== node.id || current.position.x !== node.position.x || current.position.y !== node.position.y;
    });
    if (!changed) return;
    const removed = new Set(flow.nodes.filter((node) => !nextFlowNodes.some((next) => next.id === node.id)).map((node) => node.id));
    onChange({ ...flow, nodes: nextFlowNodes, edges: flow.edges.filter((edge) => !removed.has(edge.from) && !removed.has(edge.to)) });
  }, [flow, nodes, onChange]);

  const connect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const candidate: Edge = { from: connection.source, to: connection.target };
    if (flow.edges.some((edge) => edge.from === candidate.from && edge.to === candidate.to)) return;
    setMessage(undefined);
    try {
      const result = await ipc.request("flow.validateEdge", { projectId, flow, edge: candidate });
      if (!result.allowed) {
        setMessage(result.diagnostic?.code === "CYCLE" ? t("canvas.cycleBlocked") : t("canvas.edgeRejected"));
        return;
      }
      onChange({ ...flow, edges: [...flow.edges, candidate] });
    } catch {
      setMessage(t("canvas.edgeRejected"));
    }
  }, [flow, onChange, projectId, t]);

  const removeEdges = useCallback((changes: EdgeChange<CanvasEdge>[]) => {
    const removed = new Set(changes.filter((change): change is Extract<EdgeChange<CanvasEdge>, { type: "remove" }> => change.type === "remove").map((change) => change.id));
    if (removed.size === 0) return;
    onChange({ ...flow, edges: flow.edges.filter((edge) => !removed.has(`${edge.from}->${edge.to}`)) });
  }, [flow, onChange]);

  function addNode(type: FlowNode["type"]): void {
    const id = `${type}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const position = { x: 220 + (flow.nodes.length % 3) * 60, y: 150 + flow.nodes.length * 30 };
    let node: FlowNode;
    if (type === "input") node = { id, type, label: t("canvas.inputNode"), objective: t("canvas.defaultObjective"), position };
    else if (type === "approval") node = { id, type, label: t("canvas.approvalNode"), position };
    else node = {
      id, type, label: t("canvas.agentNode"), agent: "claude-code", instructions: t("canvas.defaultInstructions"),
      acceptanceCriteria: [], writeScope: [], terminal: { enabled: false, allowedCommands: [] },
      models: { ...defaults }, limits: { timeoutMinutes: 30, maxTurns: 30, maxRetries: 0 }, position,
    };
    onChange({ ...flow, nodes: [...flow.nodes, node] });
  }

  return <main className="canvas-shell">
    <header className="canvas-toolbar">
      <div className="canvas-toolbar__left">
        <button className="button button--quiet" type="button" onClick={onBack}><span aria-hidden="true">{"←"}</span>{t("canvas.back")}</button>
        <span className="canvas-toolbar__divider" />
        <div><p className="eyebrow">{t("canvas.flowLabel")}</p><h1>{flow.name}</h1></div>
      </div>
      <div className="canvas-toolbar__actions">
        <button className="button button--quiet" type="button" onClick={onOpenSettings}>{t("settings.title")}</button>
        <button className="button button--quiet" type="button" onClick={onOpenHistory}>{t("history.title")}</button>
        <button className="button button--quiet" type="button" disabled={!dirty || saving} onClick={onSave}>{saving ? t("flow.saving") : dirty ? t("flow.save") : t("flow.saved")}</button>
        <button className="button button--primary" type="button" disabled={!validationReady || hasErrors || dirty} title={!validationReady ? t("validation.pending") : hasErrors ? t("run.blockedByErrors") : dirty ? t("run.saveBeforeRun") : undefined} onClick={onStartRun}>{t("run.start")}</button>
        <button className="button button--node" type="button" onClick={() => addNode("input")}>{t("canvas.addInput")}</button>
        <button className="button button--node" type="button" onClick={() => addNode("agent")}>{t("canvas.addAgent")}</button>
        <button className="button button--node" type="button" onClick={() => addNode("approval")}>{t("canvas.addApproval")}</button>
      </div>
    </header>
    {message && <div className="canvas-message" role="alert">{message}<button type="button" aria-label={t("common.dismiss")} onClick={() => setMessage(undefined)}>{"×"}</button></div>}
    <section className="canvas-body" aria-label={t("canvas.flowCanvas")}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={updateNodes} onEdgesChange={removeEdges} onConnect={(connection) => void connect(connection)}
        onNodeClick={(_event, node) => setSelectedNodeId(node.id)} onPaneClick={() => setSelectedNodeId(undefined)}
        fitView minZoom={0.25} maxZoom={1.5} deleteKeyCode={["Backspace", "Delete"]} defaultEdgeOptions={{ type: "smoothstep", animated: false }}>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd8d9" />
        <Controls showInteractive={false} />
      </ReactFlow>
      {flow.edges.length === 0 && <div className="canvas-hint">{t("canvas.connectHint")}</div>}
      <DiagnosticsOverlay diagnostics={diagnostics} onFocusNode={setSelectedNodeId} hasInspector={selectedNode?.type === "agent"} />
      {selectedNode?.type === "agent" && <NodeDock projectRoot={projectId} node={selectedNode} defaults={defaults} notApplicable={notApplicable}
        onChange={(node: AgentNode) => onChange({ ...flow, nodes: flow.nodes.map((item) => item.id === node.id ? node : item) })}
        onClose={() => setSelectedNodeId(undefined)} />}
    </section>
    {runId && selectedNodeId && <NodeResultPanel projectId={projectId} runId={runId} nodeId={selectedNodeId} runStatus={runStatus} nodeStatus={liveStates[selectedNodeId]?.status} />}
  </main>;
}
