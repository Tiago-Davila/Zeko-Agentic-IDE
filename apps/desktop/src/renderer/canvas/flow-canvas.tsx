import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge as CanvasEdge,
  type EdgeChange,
  type EdgeTypes,
  type Node as CanvasNode,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { DEFAULT_MODELS, type AgentNode, type Diagnostic, type Edge, type FlowFile, type FlowNode, type ProjectConfig } from "@zeko/contracts";
import { ipc, type NodeView } from "../ipc/client.js";
import { useT } from "../i18n/use-t.js";
import { FlowCanvasNode, type FlowNodeData } from "./node-types.js";
import { ConfigEdge } from "./config-edge.js";
import { CanvasToolbar } from "./canvas-toolbar.js";
import { layoutColumns, layoutPositions } from "./layout.js";
import { toneOf } from "./state-tone.js";
import { NodeDock } from "../panels/node-dock.js";
import { DiagnosticsOverlay } from "./diagnostics-overlay.js";
import { useRunState } from "../run/run-state-store.js";
import { NodeResultPanel } from "../run/node-result-panel.js";
import type { RunStatus } from "@zeko/contracts";
import { NODE_DRAG_TYPE, NodePalette } from "./node-palette.js";
import { PlayIcon, SaveIcon } from "../components/rail-icons.js";

interface FlowCanvasProps {
  projectId: string;
  flow: FlowFile;
  onChange: (flow: FlowFile) => void;
  onSave: () => void;
  onStartRun: () => void;
  dirty: boolean;
  saving: boolean;
  runId?: string | undefined;
  runStatus: RunStatus;
}

const nodeTypes = { input: FlowCanvasNode, agent: FlowCanvasNode, approval: FlowCanvasNode };
const edgeTypes: EdgeTypes = { config: ConfigEdge };

export function FlowCanvas({ projectId, flow, onChange, onSave, onStartRun, dirty, saving, runId, runStatus }: FlowCanvasProps) {
  const t = useT();
  const [message, setMessage] = useState<string>();
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [defaults, setDefaults] = useState<ProjectConfig["defaultModels"]>(DEFAULT_MODELS);
  const [notApplicable, setNotApplicable] = useState<string[]>([]);
  const liveStates = useRunState(runId);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [validationReady, setValidationReady] = useState(false);
  const [nodeViews, setNodeViews] = useState<NodeView[]>([]);
  const [minimapVisible, setMinimapVisible] = useState(true);
  const validationRequestId = useRef(0);
  const flowInstance = useRef<ReactFlowInstance<CanvasNode<FlowNodeData>, CanvasEdge>>(undefined);
  const selectedNode = flow.nodes.find((node) => node.id === selectedNodeId);
  const nodes = useMemo<CanvasNode<FlowNodeData>[]>(() => flow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    selected: node.id === selectedNodeId,
    data: { flowNode: node, diagnostics: diagnostics.filter((item) => item.nodeId === node.id), nodeView: nodeViews.find((view) => view.nodeId === node.id) ?? null, liveState: liveStates[node.id] ?? null },
  })), [diagnostics, flow.nodes, liveStates, nodeViews, selectedNodeId]);
  const edges = useMemo<CanvasEdge[]>(() => flow.edges.map((edge) => ({
    id: `${edge.from}->${edge.to}`,
    source: edge.from,
    target: edge.to,
    type: "config",
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

  // Lays nodes out in dependency columns; the new positions are saved with the flow.
  function resetLayout(): void {
    const columns = layoutColumns(flow.nodes.map((node) => node.id), flow.edges);
    const positions = layoutPositions(flow.nodes.map((node) => ({ id: node.id, column: columns.get(node.id) ?? 0 })));
    onChange({ ...flow, nodes: flow.nodes.map((node) => ({ ...node, position: positions[node.id] ?? node.position })) });
  }

  function addNode(type: FlowNode["type"], at?: { x: number; y: number }): void {
    const id = `${type}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const position = at ? { x: Math.round(at.x), y: Math.round(at.y) } : { x: 220 + (flow.nodes.length % 3) * 60, y: 150 + flow.nodes.length * 30 };
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

  function dropNode(event: DragEvent): void {
    const type = event.dataTransfer.getData(NODE_DRAG_TYPE);
    if (type !== "input" && type !== "agent" && type !== "approval") return;
    event.preventDefault();
    addNode(type, flowInstance.current?.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }

  const runBlocked = !validationReady || hasErrors || dirty;
  return <main className="canvas-shell">
    <div className="canvas-column">
      <header className="canvas-toolbar">
        <div className="canvas-toolbar__left">
          <span className="canvas-toolbar__eyebrow">{t("canvas.flowLabel")}</span>
          <h1>{flow.name}</h1>
          <span className={`canvas-toolbar__status${dirty ? " canvas-toolbar__status--dirty" : ""}`}>{saving ? t("flow.saving") : dirty ? t("flow.unsaved") : t("flow.saved")}</span>
        </div>
      </header>
      {message && <div className="canvas-message" role="alert">{message}<button type="button" aria-label={t("common.dismiss")} onClick={() => setMessage(undefined)}>{"×"}</button></div>}
      <section className="canvas-body zeko-canvas" aria-label={t("canvas.flowCanvas")}
        onDragOver={(event) => { if (event.dataTransfer.types.includes(NODE_DRAG_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }} onDrop={dropNode}>
        <ReactFlowProvider>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodesChange={updateNodes} onEdgesChange={removeEdges} onConnect={(connection) => void connect(connection)}
            onInit={(instance) => { flowInstance.current = instance; }}
            onNodeClick={(_event, node) => setSelectedNodeId(node.id)} onPaneClick={() => setSelectedNodeId(undefined)}
            fitView fitViewOptions={{ padding: 0.24 }} minZoom={0.25} maxZoom={2} snapToGrid snapGrid={[16, 16]} panOnScroll selectionOnDrag
            nodesDraggable nodesConnectable elementsSelectable deleteKeyCode={["Backspace", "Delete"]} defaultEdgeOptions={{ type: "config" }} proOptions={{ hideAttribution: false }}>
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
            {minimapVisible && <MiniMap pannable zoomable ariaLabel={t("canvas.minimap")} maskColor="var(--xy-minimap-mask-background-color)" style={{ width: 168, height: 112 }}
              nodeColor={(node) => `var(--color-state-${toneOf((node.data as FlowNodeData).liveState?.status)})`} className="zeko-canvas__minimap" />}
            <div className="zeko-canvas__toolbar">
              <CanvasToolbar nodeCount={nodes.length} onResetLayout={resetLayout} minimapVisible={minimapVisible} onToggleMinimap={() => setMinimapVisible((visible) => !visible)} />
            </div>
          </ReactFlow>
        </ReactFlowProvider>
        <div className="canvas-actions" role="toolbar" aria-label={t("canvas.flowActions")}>
          <button type="button" className="canvas-action" disabled={!dirty || saving} aria-label={t("flow.save")} title={saving ? t("flow.saving") : dirty ? t("flow.save") : t("flow.saved")} onClick={onSave}><SaveIcon /></button>
          <button type="button" className="canvas-action canvas-action--run" disabled={runBlocked} aria-label={t("run.start")}
            title={!validationReady ? t("validation.pending") : hasErrors ? t("run.blockedByErrors") : dirty ? t("run.saveBeforeRun") : t("run.start")} onClick={onStartRun}><PlayIcon /></button>
        </div>
        {flow.edges.length === 0 && <div className="canvas-hint">{t("canvas.connectHint")}</div>}
        <DiagnosticsOverlay diagnostics={diagnostics} onFocusNode={setSelectedNodeId} />
      </section>
      {runId && selectedNodeId && <NodeResultPanel projectId={projectId} runId={runId} nodeId={selectedNodeId} runStatus={runStatus} nodeStatus={liveStates[selectedNodeId]?.status} />}
    </div>
    {selectedNode?.type === "agent" && <NodeDock projectRoot={projectId} node={selectedNode} defaults={defaults} notApplicable={notApplicable}
      onChange={(node: AgentNode) => onChange({ ...flow, nodes: flow.nodes.map((item) => item.id === node.id ? node : item) })}
      onClose={() => setSelectedNodeId(undefined)} />}
    <NodePalette onAdd={(type) => addNode(type)} />
  </main>;
}
