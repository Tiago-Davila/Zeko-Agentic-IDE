# Contrato: IPC de sesiones interactivas

**Cubre**: FR-005–011, FR-014, FR-017, FR-018, FR-023a, FR-025, FR-027, FR-030, FR-032, FR-037,
FR-040, FR-042, FR-047, FR-052, FR-053, NFR-002, NFR-003, NFR-005, SC-003, SC-004.
El canal agente ↔ motor (avisos y herramientas MCP) no pasa por este IPC: está en
[bridge.md](./bridge.md).
**Base**: [contracts/ipc.md de 001](../../001-agent-flow-canvas/contracts/ipc.md). Transporte, forma
de requests, responses y eventos, validación con zod en los dos extremos y la regla "la UI no
contiene reglas" rigen sin cambios.
**Fuente de tipos**: `IpcRequest`, `IpcEvent` (métodos y tipos agregados) y `TerminalMessage` (nuevo)
en `packages/contracts/ipc`.

## Transporte: dos puertos

- El main crea **dos** `MessageChannelMain` al conectar el engine host y el renderer: el **puerto de
  control** de 001 y un **puerto de terminal** nuevo. Entrega un extremo de cada uno al engine host y
  el otro al renderer. El main sigue sin reenviar mensajes (R-01) y deja de tener canales
  `terminal.*` propios (se eliminan `terminal.open`, `terminal.restart`, `terminal.write`,
  `terminal.resize`, `terminal.data` y `terminal.exit` del main y del preload; research I-06).
- **Puerto de control**: requests, responses y eventos de este documento y de 001.
- **Puerto de terminal**: solo bytes de sesión (entrada, salida, tamaño, fin). Nunca se agrupa con
  `node.output` (R-25) ni espera a un lote de 50 ms (research R5-01).
- El preload expone además `zeko.terminal.post(msg)` y `zeko.terminal.onMessage(cb)`, con
  `contextBridge`, igual que `request` y `onEvent`.

## Requests nuevos (renderer → motor, puerto de control)

| Método | Params | Result | Errores | FR |
|---|---|---|---|---|
| `session.open` | `{runId, nodeId, cols, rows}` | `{sessionId, state: 'active', remainingMs, context: NodeContext, warnings, confinement, unsupportedRestrictions}` | `NODE_NOT_READY{missing: nodeId[]}`, `NODE_NOT_WAITING`, `AGENT_NOT_AUTHENTICATED`, `AGENT_UNAVAILABLE`, `WORKSPACE_CREATE_FAILED` | FR-006, FR-007, FR-012, FR-014, FR-017 |
| `session.attach` | `{runId, nodeId, cols, rows}` | `{sessionId, state: 'active' \| 'ended', replay: string, remainingMs?, context: NodeContext}` | `NO_SESSION` | FR-008, FR-009 |
| `node.declareEnd` | `{runId, nodeId, status: 'COMPLETED' \| 'BLOCKED' \| 'FAILED', closeMode?: 'immediate' \| 'after_turn'}` | `{}` (el cierre llega por eventos) | `SESSION_NOT_ACTIVE`, `AGENT_RESPONDING`, `CONFIRM_CLOSE`, `CLOSE_MODE_UNAVAILABLE` | FR-018 |
| `node.cancel` | (001) `{runId, nodeId}` | `{}` | (001) + acepta nodos `waiting_user` y sesiones activas | FR-025 |
| `node.reopen` | `{runId, nodeId}` | `{sessionId, remainingMs, invalidated: nodeId[], cancelled: nodeId[]}` | `NODE_NOT_REOPENABLE`, `WORKSPACE_UNTRUSTED`, `REOPEN_TIME_EXHAUSTED`, `RUN_NOT_REOPENABLE` | FR-011, FR-023a |
| `dependents.rerun.decide` | `{runId, nodeId, decision: 'confirmed' \| 'declined'}` | `{}` | `NO_PENDING_CONFIRMATION` | FR-023a |
| `node.context` | `{runId, nodeId}` | `NodeContext` | | FR-014, FR-017 |
| `node.links` | `{runId, nodeId}` | `{links: {nodeId, title, type, implicit: bool, canRead, canMessage}[]}` | | FR-032 |
| `session.messaging.pause` / `session.messaging.resume` | `{runId, nodeId}` | `{}` | `NO_SESSION` | FR-042 |
| `message.discard` | `{runId, nodeId, messageId}` | `{}` | `MESSAGE_NOT_QUEUED` | FR-042 |
| `message.deliverNow` | `{runId, nodeId, messageId}` | `{}` | `MESSAGE_NOT_QUEUED`, `TARGET_BUSY`, `TARGET_INPUT_UNSUPPORTED` | FR-037, research R5-20 ("Entregar ahora" con texto sin enviar) |
| `spawn.decide` | `{runId, batchId, decision: 'confirmed' \| 'declined'}` | `{children?: {nodeId, branch}[]}` | `NO_PENDING_BATCH` | FR-047 |
| `children.parentEnd.decide` | `{runId, nodeId, decision: 'cancel' \| 'let_finish'}` | `{}` | `NO_PENDING_DECISION` | FR-053 |
| `children.saveToFlow` | `{runId, nodeIds: string[]}` | `{flowFile, savedNodeIds}` | `FLOW_FILE_CHANGED` (el archivo cambió desde el inicio del run; regla de conflictos de 001) | FR-052 |

Semántica:

- `session.open` solo con el nodo en `waiting_user`. Hace, en orden: `detect()` del agente (research
  R5-03), crea el worktree (R-15), arma el lanzamiento, lanza el PTY, adopta la raíz y arma el
  temporizador con `remainingMs`. Si el nodo ya tiene una sesión activa, se comporta como
  `session.attach` (caso límite "otra sesión del mismo nodo"; FR-009).
- `session.attach` nunca lanza nada. Con la sesión terminada devuelve `state: 'ended'` y el `replay`
  en memoria mientras el engine host siga vivo; después de un reinicio devuelve `replay: ""`, porque
  la salida no se persiste (FR-028).
- `node.declareEnd`:
  - sin `closeMode` y con `busyDetection = none` → `CONFIRM_CLOSE`: la vista pide confirmar el cierre
    inmediato y reenvía con `closeMode: 'immediate'`;
  - sin `closeMode` y el agente respondiendo → `AGENT_RESPONDING`: la vista ofrece "Cerrar ahora"
    (`immediate`) o "Esperar a que termine" (`after_turn`);
  - `after_turn` con `busyDetection = none` → `CLOSE_MODE_UNAVAILABLE`;
  - con la sesión terminada → `SESSION_NOT_ACTIVE` (research R5-14).
- `node.reopen` aplica research R5-07: reemplaza el resultado, invalida y cancela los dependientes y
  lanza el segmento nuevo con el mismo perfil. Devuelve qué dependientes se cancelaron o invalidaron
  para que la vista lo muestre.
- Ninguna request de este documento escribe en el PTY salvo `message.deliverNow`, que pide entregar
  un mensaje ya encolado. La entrada al agente es `session.input` del puerto de terminal, que solo
  produce xterm con teclas o pegado del usuario, más la entrega de mensajes y avisos que hace el
  motor con las compuertas de research R5-20 (FR-017, FR-037, NFR-006).
- `spawn.decide` crea los hijos con la instantánea tomada al pedir (research R5-22), no con el estado
  del orquestador en el momento de confirmar.
- `children.saveToFlow` escribe el archivo del flujo con el serializador canónico. Si el archivo cambió
  fuera de Zeko desde el inicio del run, se rechaza con la regla de conflictos de 001 en vez de
  mezclar.

### `NodeContext`

Lo arma el motor desde lo persistido (ya redactado, research R5-11):

| Campo | Tipo | FR |
|---|---|---|
| `instructions` | string (puede ser vacío) | FR-017 |
| `predecessors` | `PredecessorResult[]` **vigentes** | FR-013, FR-014 |
| `base` | `{commit, fromNodeId?}`: de qué estado de código parte la copia | FR-013 |
| `requiresChanges` | bool | FR-021 |

La vista lo muestra como datos, con "Copiar" por bloque. No hay ninguna acción que lo envíe a la
terminal.

### `PredecessorResult` de un nodo interactivo

Misma forma que el `PredecessorResult` de 001
([agent-report.md §Uso posterior](../../001-agent-flow-canvas/contracts/agent-report.md#uso-posterior-resultado-inyectado-en-el-nodo-siguiente-fr-040)),
para que un sucesor no dependa del tipo de nodo (FR-023):

```json
{
  "nodeId": "adjust",
  "agent": "codex",
  "nodeType": "interactive",
  "finalStatus": "completed",
  "reason": null,
  "report": {
    "status": "COMPLETED",
    "summary": "<recap del modelo, o vacío si no hubo>",
    "filesChanged": [],
    "checks": [],
    "blockers": [],
    "findings": []
  },
  "declaration": { "origin": "user", "status": "COMPLETED" },
  "summaryState": "recap",
  "observedFiles": [{ "path": "src/signup/form.ts", "change": "M", "eolOnly": false }],
  "discrepancies": { "undeclared": [], "declaredNotObserved": [], "scopeViolations": [] },
  "inconsistency": null
}
```

- `report` es un `AgentReport` válido de 001 con `status` = la declaración y `summary` = la recap. Si
  no hubo recap, `summary` es `""` y `summaryState` es `recap_unavailable`: la vista muestra "recap
  no disponible" y el prompt del sucesor lo dice explícitamente (FR-018, US2-6). Nunca se inventa
  contenido.
- `nodeType`, `declaration` y `summaryState` son campos **agregados** y opcionales en el schema de
  `PredecessorResult`; un nodo de agente no los lleva.
- `filesChanged` va vacío porque el usuario no declara archivos; los archivos reales están en
  `observedFiles` (FR-020).
- Un orquestador agrega `children: ChildRef[]` (opcional, data-model §2): `{nodeId, title,
  finalStatus, branch, resultCommit?, activeAtParentEnd}`. El sucesor lo recibe como dato. Integrar
  una rama de hijo nunca es automático (FR-051).
- El mismo `PredecessorResult` es lo que devuelven `zeko_get_context` y
  `zeko_read_node{view: result}` ([bridge.md](./bridge.md)).

## Eventos nuevos (motor → renderer, puerto de control)

| `type` | Payload | Entrega | FR / NFR |
|---|---|---|---|
| `node.state` | (001) ahora puede traer `status: 'waiting_user'` y `hold: 'RERUN_CONFIRMATION'` | inmediata | FR-005, NFR-005 |
| `session.state` | `{runId, nodeId, sessionId, active, remainingMs, closing?: 'waiting_turn' \| 'terminating'}` | al abrir, al cerrar y cada 1 s mientras está activa (para mostrar el tiempo restante) | FR-010, NFR-005 |
| `node.declared` | `{runId, nodeId, declaration: EndDeclaration}` | inmediata | FR-018, FR-027 |
| `node.result` | (001) + `declaration?`, `summary?`, `inconsistency?`, `warnings` | inmediata | FR-018–022 |
| `node.reopened` | `{runId, nodeId, generation, invalidated, cancelled}` | inmediata | FR-023a |
| `rerun.confirmation_requested` | `{runId, sourceNodeId, dependents: nodeId[]}` | inmediata | FR-023a |
| `run.reopened` | `{runId, byNodeId}` | inmediata | FR-023a |
| `session.activity` | `{runId, nodeId, sessionId, activity: AgentActivity['state'], composerDirty, messagingPaused}` | en cada transición | FR-030, NFR-005 |
| `messages.queue` | `{runId, nodeId, queued: {messageId, from: nodeId \| 'zeko', at, queuedBecause, expiresAt}[]}` | en cada cambio de la cola del nodo | FR-042, NFR-005 |
| `message.delivery` | `{runId, messageId, from, to, outcome}` | en cada cambio de `outcome` | FR-040, US5-9 |
| `spawn.confirmation_requested` | `{runId, batchId, parentNodeId, children: …, warnings}` (como el evento persistido, data-model §5) | inmediata | FR-047, NFR-005 |
| `child.created` | `{runId, batchId, parentNodeId, nodeId, title, agent, branch}` | inmediata | FR-048, FR-052 |
| `children.parent_end_decision_requested` | `{runId, nodeId, active: nodeId[]}` | inmediata | FR-053 |

`NodeView` (001) agrega: `interactive?: {confinement, unsupportedRestrictions, warnings,
resumeAvailable, busyDetection, activitySource, zekoTools, messagingInput, orchestration?:
{enabled, confirm, maxChildren, used}}` para que la vista muestre, **antes** de abrir, el
confinamiento real, lo que el agente no admite y qué comunicación tendrá disponible (FR-015, FR-016,
FR-033, FR-037, FR-044). Lo calcula el motor desde las capacidades y la configuración. Un hijo agrega
`spawned?: {parentNodeId, batchId}` para dibujarlo dentro de su orquestador (FR-052).

## Mensajes del puerto de terminal

Schema mínimo para no agregar costo por tecla; se valida con zod igual (Principio VII).

| Dirección | `type` | Campos | Semántica | FR / NFR |
|---|---|---|---|---|
| renderer → motor | `session.input` | `sessionId`, `data: string` (≤ 64 KiB) | Teclas o pegado del usuario en xterm. Se descarta si la sesión no está activa. | FR-007, NFR-002 |
| renderer → motor | `session.resize` | `sessionId`, `cols`, `rows` (enteros 2..1000) | | FR-007 |
| renderer → motor | `session.detach` | `sessionId` | La vista se cerró o minimizó. **No** afecta la sesión (FR-008); solo deja de enviarse salida a esa vista. | FR-008 |
| motor → renderer | `session.output` | `sessionId`, `data: string` | Salida del PTY, coalescida ≤ 8 ms por sesión. Solo a las vistas enganchadas. | FR-007, NFR-002 |
| motor → renderer | `session.ended` | `sessionId`, `closeCause` | Fin del segmento. El estado del nodo llega por `node.state` / `node.result`. | FR-011 |

La salida del PTY **no** se persiste ni pasa por el redactor (research R5-11); vive en el buffer de
reenganche en memoria del engine host (512 KiB por sesión, research I-11).

## Reglas de rendimiento agregadas (research R5-01)

- `session.output` nunca espera a un lote de `node.output` ni a un evento de control.
- El renderer mantiene un `@xterm/xterm` por sesión **visible**. Con varias sesiones abiertas a la
  vez (FR-009), cada vista tiene la suya; una vista cerrada libera su xterm y, al reabrir,
  `session.attach` rehidrata desde `replay`.
- `@xyflow/react` no se re-renderiza con `session.output` ni con `session.state` (solo con
  `node.state`).
- Sonda de latencia (solo en builds de desarrollo): marca `keydown` y `onWriteParsed` del eco;
  alimenta el escenario de medición del [quickstart](../quickstart.md#10-latencia-con-carga-nfr-002-nfr-003-sc-003-sc-004).
