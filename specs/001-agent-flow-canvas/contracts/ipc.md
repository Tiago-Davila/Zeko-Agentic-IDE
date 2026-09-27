# Contrato: IPC entre el motor (engine host) y la UI (renderer)

**Cubre**: FR-001–012, FR-021–031, FR-039, FR-046, FR-048, FR-050–053, FR-055–057, FR-060–062,
NFR-002, NFR-003, NFR-011, Principio IV.
**Fuente de tipos**: los schemas zod `IpcRequest`, `IpcResponse` e `IpcEvent` en
`packages/contracts/ipc`. **Los dos extremos validan** cada mensaje; un mensaje inválido se descarta
y se registra como `error`.

## Transporte

- El proceso principal crea un `MessageChannelMain`. Entrega `port1` al engine host
  (`utilityProcess`) y `port2` al renderer por el preload (research R-01).
- El preload expone al renderer solo `zeko.request(msg)` y `zeko.onEvent(cb)` con `contextBridge`.
  El renderer no tiene acceso a Node, al filesystem ni a `child_process`.
- El proceso principal no reenvía mensajes. Solo atiende tres canales propios:
  - `dialog.openFolder`, el selector nativo de carpeta;
  - `app.quit`;
  - `engine.restart`.
- **La UI no contiene reglas** (Principio IV): la validación, la detección de ciclos, el
  confinamiento, los estados y los motivos vienen siempre del motor.

## Forma de los mensajes

- Request: `{kind: 'request', id: uuid, method: string, params}`.
- Response: `{kind: 'response', id, ok: true, result}` o `{kind: 'response', id, ok: false, error: {code, params}}`.
- Event: `{kind: 'event', type: string, runId?, payload, seq?}`.

Los errores y los motivos son **códigos**, que la UI traduce con `packages/i18n` (NFR-013).

## Requests (renderer → motor)

| Método | Params | Result | Errores | FR |
|---|---|---|---|---|
| `project.open` | `{path}` | `{projectId, root, flows: FlowSummary[]}` | `NOT_A_GIT_REPO`, `PATH_NOT_FOUND` | FR-001–003 |
| `flow.list` | `{projectId}` | `FlowSummary[]` (`id, name, valid, errorCount`) | | FR-003 |
| `flow.load` | `{projectId, flowId}` | `{flow?, fileHash, diagnostics: Diagnostic[]}`; `flow` ausente si no se pudo parsear | | FR-055–057 |
| `flow.create` | `{projectId, name}` | `{flowId}` | `FLOW_EXISTS` | FR-004 |
| `flow.save` | `{projectId, flow, expectedHash}` | `{fileHash, diagnostics}` | `FILE_CHANGED_ON_DISK{currentHash}` (la UI ofrece "Recargar" o "Conservar mi versión", que reintenta con `expectedHash = currentHash`; [flow-file.md](./flow-file.md#conflictos-de-edición-externa-casos-límite)), `SCHEMA_ERROR` | FR-004, FR-054, casos límite |
| `flow.delete` | `{projectId, flowId, confirmed: true}` | `{}` | `CONFIRMATION_REQUIRED` | FR-004 |
| `flow.validate` | `{projectId, flow}` | `{diagnostics: Diagnostic[], nodeViews: NodeView[]}` | | FR-008, FR-009, FR-021 |
| `flow.validateEdge` | `{projectId, flow, edge}` | `{allowed: bool, diagnostic?}` (p. ej. `CYCLE`) | | FR-007 |
| `agents.status` | `{projectId, agents?: AgentId[]}` | `AgentAvailability[]` + `AgentUsageReading[]` | | FR-025, FR-052, FR-065 |
| `run.preflight` | `{projectId, flowId}` | `{ok, diagnostics, agents: AgentAvailability[], perNodeAuth, warnings}` | | FR-009, FR-025, FR-065 |
| `run.start` | `{projectId, flowId, fileHash}` | `{runId}` | `FLOW_INVALID`, `PREFLIGHT_FAILED{missing}`, `NO_COMMITS`, `FILE_CHANGED_ON_DISK` | FR-024, FR-025, NFR-006 |
| `run.cancel` | `{runId}` | `{}` (el cierre llega por eventos) | | FR-030 |
| `node.cancel` | `{runId, nodeId}` | `{}` | `NODE_NOT_RUNNING` | FR-030 |
| `approval.decide` | `{runId, nodeId, decision: 'approved' \| 'rejected'}` | `{}` | `NOT_WAITING_APPROVAL` | FR-012, US3 |
| `run.list` | `{projectId, flowId?, limit, before?}` | `RunSummary[]` (fecha, duración, costo con `partial`/`estimated`, estado, resultado por nodo y agente) | | FR-060, FR-061 |
| `run.get` | `{runId}` | `RunDetail` (`Run` + `NodeRun[]` según data-model) | | FR-039, FR-060 |
| `node.output.page` | `{runId, nodeId, afterSeq?, limit}` | `{events: NormalizedEvent[], nextSeq}` | | FR-029 |
| `node.diff` | `{runId, nodeId, path?}` | `{files: ObservedFile[], patch?}` (`base..result`, paginado por archivo) | `WORKSPACE_DELETED` | FR-046 |
| `workspaces.delete` | `{runId, confirmed: true}` | `{deleted: n}` | `CONFIRMATION_REQUIRED`, `RUN_ACTIVE` | FR-048, FR-049 |
| `settings.get` / `settings.set` | `{projectId, config?}` | `ProjectConfig` | `SCHEMA_ERROR` | FR-027, FR-053 |

`NodeView` es la vista derivada que el motor calcula por nodo y la UI solo pinta:

- `confinement: {level, reason?}`;
- `warnings: WarningCode[]`, por ejemplo `DENIAL_CHECK_NOT_AVAILABLE`, `TURN_LIMIT_NOT_APPLICABLE`,
  `NO_NETWORK_ON_PLATFORM`, `COST_NOT_REPORTED`, `USAGE_NOT_LIVE`, `AUTH_API_KEY_UNVERIFIED`,
  `READONLY_COMMANDS_AUTO_APPROVED`, `SCOPE_ENFORCEMENT_DETECTION_ONLY` o `MODEL_DEFAULTED`;
- `model: {model, reasoningEffort?, source: 'node' | 'project_default'}` (FR-011a);
- `notApplicable: FieldPath[]` (FR-011, FR-015, FR-021–023, NFR-012).

## Events (motor → renderer)

| `type` | Payload | Entrega | FR / NFR |
|---|---|---|---|
| `run.started` | `{runId, flowId, origin, warnings}` | inmediata | FR-024 |
| `node.state` | `{runId, nodeId, status, reason?, hold?, attempt?}` | **inmediata**, sin agrupar | FR-028, NFR-003 |
| `node.output` | `{runId, nodeId, events: NormalizedEvent[] (sin raw)}` | agrupada por nodo cada ≤ 50 ms | FR-029, NFR-002 |
| `node.result` | `{runId, nodeId, NodeResult, observedFiles, discrepancies, inferredDenials?, model, cost?, consumption?}` | inmediata | FR-023, FR-036–039, FR-050, FR-011a |
| `approval.requested` | `{runId, nodeId, summary: PredecessorResult[]}` | inmediata | FR-012 |
| `agent.usage` | `AgentUsageReading` | al cambiar | FR-052 |
| `run.held` / `run.resumed` | `{runId, reason}` | inmediata | FR-053 |
| `run.finished` | `{runId, status, outcome?, totals}` | inmediata | FR-060 |
| `flow.fileChanged` | `{projectId, flowId, fileHash}` (watcher de `.zeko/flows`) | inmediata | casos límite |
| `runs.recovered` | `{runIds}` (runs marcados `interrupted` al arrancar) | al iniciar | FR-062 |
| `engine.error` | `{code, params}` | inmediata | FR-063 |

Reglas de rendimiento (research R-25):

- `node.output` nunca se mezcla con `node.state`: un cambio de estado no espera a la salida.
- El renderer guarda un ring buffer de 5 000 eventos por nodo y un único `@xterm/xterm` activo.
- Después de reconectar (por ejemplo, tras `engine.restart`), el renderer vuelve a pedir `run.get`
  y `node.output.page`.
