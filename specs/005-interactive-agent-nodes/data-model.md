# Data Model: Nodos interactivos de agente (005)

**Fecha**: 2026-09-28 | **Actualizado**: 2026-10-16 (enlaces, mensajes, orquestación, rutas
compartidas) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Este documento describe **solo los cambios y agregados** respecto de
[data-model.md de 001](../001-agent-flow-canvas/data-model.md). Todo lo que no aparece aquí rige sin
cambios: convenciones (`?` = ausente cuando no hay dato, ids, fechas), `ProjectConfig`, `Run`,
`Attempt`, `IsolatedWorkspace`, `process_tree`, redacción y la tabla de `resolveNodeResult`, salvo
las filas que se indican.

Las entidades se definen una sola vez como schemas zod en `packages/contracts` (Principio VII).

---

## 1. Definición (archivo de flujo)

### InteractiveNode (`type: interactive`) — nuevo

Se agrega a la unión discriminada `Node`. Campos comunes: `id`, `type`, `label?`, `position`
(igual que 001). Formato en [contracts/flow-file.md](./contracts/flow-file.md).

| Campo | Tipo | Default al crear | Regla | FR |
|---|---|---|---|---|
| `agent` | `claude-code` \| `codex` | `claude-code` | el adaptador declara `capabilities.interactive.supported` | FR-002, FR-004 |
| `models` | igual que `AgentNode.models` | entrada del agente, copiada de `defaultModels` | **la entrada del agente actual es obligatoria**: sin ella, `SCHEMA_ERROR` (no hay `MODEL_DEFAULTED`, research R5-12) | FR-002 |
| `instructions` | string multilínea | `""` | opcional; se muestra al usuario y **nunca** se envía al agente | FR-002, FR-017 |
| `writeScope` | string[] | `["**"]` | mismas reglas que `AgentNode` | FR-002, FR-020 |
| `terminal.enabled` | bool | `false` | restricción de herramientas de FR-016 | FR-016 |
| `terminal.allowedCommands` | string[] | `[]` | solo si `enabled` y el agente la admite en modo interactivo | FR-016 |
| `requiresChanges` | bool | `false` | activa la inconsistencia `COMPLETED_WITHOUT_CHANGES` | FR-021 |
| `limits.timeoutMinutes` | int | 30 | 1..1440, obligatorio y finito | FR-002, FR-010, NFR-008 de 001 |
| `orchestration?` | `Orchestration` | ausente (= deshabilitada) | ver abajo | FR-044 |

### Orchestration — nueva (dentro de `InteractiveNode`)

| Campo | Tipo | Default | Regla | FR |
|---|---|---|---|---|
| `enabled` | bool | `false` | sin `true` no se exponen las herramientas de orquestación | FR-044 |
| `allowedAgents` | (`claude-code` \| `codex`)[] | `[agent del nodo]` | no vacío si `enabled` | FR-044, FR-046 |
| `allowedModels?` | `{ "claude-code"?: string[], codex?: string[] }` | ausente = cualquier modelo explícito | si existe, el modelo del hijo tiene que estar en la lista de su agente | FR-046 |
| `maxChildren` | int | 4 | 1..16; total de hijos en el run para este nodo | FR-044, FR-046 |
| `childLimits.timeoutMinutes` | int | 30 | 1..1440; máximo por hijo | FR-044, FR-046 |
| `childLimits.maxTurns` | int | 40 | 1..200 | FR-044 |
| `childLimits.maxRetries` | int | 1 | 0..3 | FR-044 |
| `confirm` | bool | `true` | `false` crea los lotes válidos sin preguntar | FR-047 |

### Communication y Link — nuevos (nivel de flujo)

`communication` (opcional, todo con default):

| Campo | Tipo | Default | Regla | FR |
|---|---|---|---|---|
| `messaging` | bool | `false` | interruptor general de mensajería del flujo | FR-036 |
| `limits.pairIntervalSeconds` | int | 10 | 5..600 | FR-041 |
| `limits.perTurn` | int | 4 | 1..8 | FR-041 |
| `limits.perNode` | int | 20 | 1..100 | FR-041 |
| `queue.capacity` | int | 16 | 1..32 | FR-038 |
| `queue.ttlMinutes` | int | 10 | 1..60 | FR-038 |

`links[]` (opcional):

| Campo | Tipo | Regla | FR |
|---|---|---|---|
| `nodes` | `[nodeId, nodeId]` | dos nodos distintos del flujo; sin pares repetidos (en cualquier orden) | FR-032 |
| `read` | `both` \| `nodeId` | `nodeId` = el que lee (tiene que ser uno de `nodes`) | FR-032, FR-035 |
| `messages` | bool, default `false` | `true` exige que los dos nodos sean `interactive` | FR-036 |

**Enlaces implícitos** (no se escriben): un `interactive` lee a sus predecesores directos; un
orquestador lee a sus hijos. `resolveLinks` (research R5-19) une declarados e implícitos.

### ProjectConfig — agregado

| Campo | Tipo | Default | Regla | FR |
|---|---|---|---|---|
| `workspace.sharedPaths` | string[] | `[]` | rutas relativas sin `..` ni absolutas; al crear un worktree solo se vinculan las que existen, son directorios e ignoradas por git (research R5-22) | FR-056 |

No tiene `acceptanceCriteria`, `limits.maxTurns` ni `limits.maxRetries`: el schema los rechaza
(`additionalProperties: false`). No hay reintentos automáticos: una sesión fallida se reabre por
decisión del usuario (FR-011).

**Linaje (R-22)**: `codeSource(interactive)` = `{n}` si `writeScope ≠ []`, si no `∅`.
`inputSources` y `MULTIPLE_CODE_SOURCES` se aplican igual que a un nodo de agente.

### Validación — agregados

| Código | Severidad | Regla | FR |
|---|---|---|---|
| `INTERACTIVE_NODE_REQUIRES_DESKTOP` | error **solo con `host = cli`** | el flujo contiene un nodo `interactive`; uno por nodo, con `nodeId` | FR-029 |
| `INTERACTIVE_AGENT_UNSUPPORTED` | error | el adaptador del agente no declara `interactive.supported` | FR-004 |
| `INVALID_LIMIT` | error | (existente) también para `timeoutMinutes` del nodo interactivo | FR-002, FR-010 |
| `OPTION_NOT_APPLICABLE` | info | (existente) `terminal.allowedCommands` con un agente sin `toolRestriction` interactiva | FR-016 |
| `LINK_UNKNOWN_NODE` | error | `links[].nodes` o `read` nombran un nodo inexistente | FR-032 |
| `LINK_DUPLICATE` | error | dos enlaces sobre el mismo par | FR-032 |
| `MESSAGING_LINK_NOT_INTERACTIVE` | error | `messages: true` con algún nodo no `interactive` | FR-036 |
| `MESSAGING_LINKS_WITHOUT_SWITCH` | warning | hay enlaces con `messages: true` y `communication.messaging` es `false` | FR-036 |
| `ORCHESTRATION_INVALID` | error | `enabled` con `allowedAgents` vacío, límites fuera de rango o un agente sin `interactive`/adaptador | FR-044 |
| `LINKS_WITHOUT_INTERACTIVE_READER` | info | un enlace declarado sin ningún nodo `interactive` que pueda leer por él (no tiene efecto en 005) | FR-032 |
| `COMMUNICATION_UNSUPPORTED_BY_AGENT` | warning | el adaptador declara `zekoTools = false` o `messaging.input = none` para un nodo con enlaces, mensajería u orquestación | FR-033, FR-037 |

`validateFlow` recibe `host: 'desktop' | 'cli'`; es la misma función para los dos (research R5-12).

### Confinamiento derivado — agregado

Para nodos interactivos, la función pura de confinamiento lee `capabilities.interactive.confinement`
(research R5-02), nunca el id del agente:

| `interactive.confinement.fileTools` | `interactive.confinement.shell` | Terminal del nodo | `approvalCanWiden` | Nivel | Motivo |
|---|---|---|---|---|---|
| `full` | cualquiera | no | `false` | `confined` | — |
| cualquiera | `none` | sí | cualquiera | `unconfined` | `TERMINAL_ENABLED` |
| cualquiera | `write_only` | sí (o siempre) | `false` | `write_only` | `CAN_READ_OUTSIDE_WORKSPACE` |
| cualquiera | cualquiera | cualquiera | `true` | `unconfined` | `APPROVAL_CAN_WIDEN_SCOPE` |
| `none` | `none` | cualquiera | cualquiera | `unconfined` | `INTERACTIVE_CONFINEMENT_UNVERIFIED` |

Con los valores conservadores de research R5-02 (hasta 005a), todo nodo interactivo resulta
`unconfined` con `INTERACTIVE_CONFINEMENT_UNVERIFIED`. La copia aislada y el alcance de rutas nunca
se presentan como confinamiento de la terminal (FR-015).

**Advertencias nuevas por nodo** (`WarningCode`, NFR-012 de 001):

| Código | Cuándo | FR |
|---|---|---|
| `INTERACTIVE_CONFINEMENT_UNVERIFIED` | confinamiento interactivo no verificado para el agente | FR-015 |
| `INTERACTIVE_RESTRICTION_UNSUPPORTED` | una restricción configurada que el agente no admite en modo interactivo (params: cuál) | FR-016 |
| `USER_CONFIG_NOT_ISOLATED` | `interactive.userConfigIsolation = false` | FR-015 |
| `RECAP_UNAVAILABLE` | el resultado no tiene recap | FR-018 |
| `RESUME_UNAVAILABLE` | la reapertura abrió una conversación nueva | FR-011 |
| `AGENT_PERMISSION_FILES_EXCLUDED` | el commit excluyó archivos de permisos del agente (params: rutas) | FR-016 |
| `COST_NOT_REPORTED` | (existente) también para sesiones interactivas sin fuente de costo | FR-027 |
| `ACTIVITY_UNAVAILABLE` | el agente no tiene `activitySource`: actividad siempre `unknown` | FR-031 |
| `ZEKO_TOOLS_UNAVAILABLE` | el agente no admite el servidor MCP de Zeko: sin lectura, mensajes ni orquestación | FR-033 |
| `MESSAGE_INPUT_UNAVAILABLE` | el nodo no puede recibir mensajes ni avisos en su terminal | FR-037, FR-050 |
| `SHARED_PATHS_NOT_ISOLATED` | el worktree tiene rutas compartidas (params: rutas) | FR-056 |
| `SHARED_PATH_NOT_DIRECTORY` | una ruta compartida no es directorio y se omitió | FR-056 |
| `SCOPES_OVERLAP` | (en un lote) dos hijos con alcances que se pueden intersecar (params: pares) | FR-049 |

---

## 2. Ejecución (SQLite)

### NodeRun — campos agregados

| Campo | Tipo | Notas | FR |
|---|---|---|---|
| `nodeType` | se agrega `interactive` al enum | | FR-001 |
| `generation` | int, desde 1 | +1 en cada reapertura; el resultado vigente es el de la generación actual | FR-023a |
| `declaration?` | `EndDeclaration` | ausente mientras no terminó una sesión | FR-018, FR-027 |
| `summary?` | `{state: 'recap', text}` \| `{state: 'recap_unavailable', cause}` | solo interactivos; `text` redactado, ≤ 64 KiB | FR-018, FR-022 |
| `inconsistency?` | se agrega `COMPLETED_WITHOUT_CHANGES` al enum | | FR-021 |
| `activeMs` | int | Σ `activeMs` de sus segmentos | FR-010 |
| `hold?` | se agrega `RERUN_CONFIRMATION` | dependiente de un nodo reabierto, a la espera de confirmación | FR-023a |
| `reportState` | se usa `not_applicable` para interactivos | la declaración reemplaza al reporte | FR-022 |
| `origin` | `flow` \| `spawned` | `flow` por defecto; `spawned` = hijo de un lote | FR-045, FR-052 |
| `parentNodeRunId?` | FK | solo hijos | FR-048, FR-050 |
| `spawnBatchId?`, `spawnKey?` | FK, string | solo hijos; `nodeId = <padre>~<spawnKey>` | FR-045 |
| `children?` | `ChildRef[]` | solo orquestadores; parte del resultado (`{nodeId, title, finalStatus, branch, resultCommit?, activeAtParentEnd}`) | FR-022, FR-053 |

### AgentActivity — nueva (en memoria; transiciones como eventos)

| Campo | Tipo | Notas | FR |
|---|---|---|---|
| `state` | `starting` \| `waiting_input` \| `working` \| `waiting_permission` \| `unknown` | `reduceActivity` (research R5-17) | FR-030, FR-031 |
| `turnSeq` | int | +1 por `turn_started` | FR-040, FR-041 |
| `lastEventAt?` | fecha | | FR-030 |
| `composerDirty` | bool | texto del usuario sin enviar (research R5-20) | FR-037 |
| `pasteMode` | bool | la TUI activó bracketed paste | FR-037 |
| `messagingPaused` | bool | pausa del usuario | FR-042 |

### SpawnBatch (tabla `spawn_batches`) — nueva

| Campo | Tipo | Notas | FR |
|---|---|---|---|
| `id` | uuid v7 | | FR-045 |
| `runId`, `parentNodeRunId` | FK | | FR-045 |
| `requestedAt` | fecha | | FR-027 |
| `snapshotCommit` | sha | instantánea del orquestador al pedir (research R5-22) | FR-049 |
| `status` | `rejected` \| `pending_confirmation` \| `confirmed` \| `declined` \| `expired` | | FR-046, FR-047 |
| `problems` | `{code, childKey?, params}[]` | errores y advertencias de `validateSpawnBatch` | FR-046 |
| `decidedAt?`, `decidedBy?` | fecha, `desktop` \| `auto` | `auto` = `confirm: false` | FR-047 |

Un lote `rejected` o `dryRun` no crea filas en `spawned_nodes` ni NodeRuns. Un `dryRun` ni siquiera
se persiste: solo emite `spawn.validated`.

### SpawnedNodeDefinition (tabla `spawned_nodes`) — nueva

La definición de un hijo, con la forma de `AgentNode` de 001 (Principio VII: el mismo schema zod),
más:

| Campo | Tipo | Notas | FR |
|---|---|---|---|
| `nodeRunId` | FK | 1:1 con el NodeRun del hijo | FR-048 |
| `batchId` | FK | | FR-045 |
| `key` | string | `^[a-z][a-z0-9-]{0,31}$` | FR-045 |
| `dependsOn` | key[] | dentro del lote | FR-045, FR-049 |
| `definition` | JSON `AgentNode` (sin `position`) | `instructions` redactadas antes de persistir | FR-028, FR-045 |
| `savedToFlowAt?` | fecha | "Guardar en el flujo" | FR-052 |

### ReasonCode — agregados de comunicación

| Código | Estado | Cuándo | FR |
|---|---|---|---|
| `PARENT_CANCELLED` | `cancelled` | el orquestador se canceló, o el usuario eligió cancelar los hijos al terminar el orquestador | FR-053 |
| `CANCELLED_BY_ORCHESTRATOR` | `cancelled` | `zeko_cancel_child` | FR-050 |

Un hijo cuya dependencia no termina `completed` queda `skipped` con `UPSTREAM_NOT_SUCCEEDED`, como
cualquier nodo de agente. En la interrupción, `interrupted` sin motivo nuevo.

### MessageDelivery — nueva (solo eventos; sin tabla ni cuerpo)

| Campo | Tipo | Notas | FR |
|---|---|---|---|
| `messageId` | uuid v7 | | FR-040 |
| `kind` | `agent` \| `zeko_notice` | | FR-039, FR-050 |
| `fromNodeRunId?`, `toNodeRunId`, `toSessionId` | FK | `fromNodeRunId` ausente en avisos | FR-027 |
| `inReplyTo?` | messageId | | FR-037 |
| `chars` | int | tamaño después de sanear y redactar | FR-028 |
| `outcome` | `MessageOutcome` (contracts/bridge.md) | último estado conocido | FR-040 |
| `at` | fecha | | FR-027 |

La cola vive en memoria del engine host (research R5-20). `zeko_message_status` y la vista leen esa
memoria; el historial lee los eventos.

`denials` queda ausente y `denialCheck = not_available` (en modo interactivo no hay denegaciones
informadas, research R5-02).

### EndDeclaration — nueva

| Campo | Tipo | Notas | FR |
|---|---|---|---|
| `origin` | `user` \| `normal_exit` | `user`: declaración explícita; `normal_exit`: el agente salió normalmente | FR-018, FR-027 |
| `status` | `COMPLETED` \| `BLOCKED` \| `FAILED` | con `normal_exit` siempre `COMPLETED` (provisional) | FR-011, FR-018 |
| `declaredBy?` | `desktop` | quién declaró; ausente con `normal_exit`. Un solo usuario (Principio XVIII): solo se registra el origen, nunca un dato personal | FR-027, US4-1 |
| `declaredAt` | fecha | | FR-027 |
| `closeMode?` | `immediate` \| `after_turn` | solo con `origin = user` (research R5-14) | FR-018 |

### InteractiveSegment (fila de `attempts`) — nuevo uso

Cada apertura o reapertura es un **segmento**, y se guarda como un `Attempt` de 001 con
`kind = interactive_segment`. Así `process_tree` (clave `attempt_id`), los eventos y la recuperación
de R-20 funcionan sin cambios.

| Campo | Tipo | Notas | FR |
|---|---|---|---|
| `n` | int | 1 = primera apertura; +1 por reapertura | FR-011 |
| `kind` | se agrega `interactive_segment` | | |
| `sessionId` | uuid v7 de Zeko | identifica la sesión en IPC y en la vista | FR-008, FR-009 |
| `agentSessionRef?` | string | id de sesión del agente (Claude `--session-id`; Codex `thread_id` del rollout); ausente si no se pudo localizar | FR-011, FR-018 |
| `resumedFrom?` | `agentSessionRef` del segmento anterior | ausente en el primero o si la reanudación no estuvo disponible | FR-011 |
| `launchProfileHash` | sha256 | de herramientas, permisos y flags; una reapertura exige el mismo (research R5-07) | FR-011 |
| `openedAt`, `closedAt?` | fechas | | FR-027 |
| `activeMs` | int | desde la adopción de la raíz hasta el fin verificado | FR-010 |
| `closeCause?` | `declaration` \| `normal_exit` \| `crash` \| `timeout` \| `cancel` \| `shutdown` \| `spawn_failed` | | FR-027 |
| `processOutcome?` | `ProcessOutcome` | `killed.by` admite `declaration` | FR-019 |
| `workspacePath` | ruta | **la misma** en todos los segmentos del NodeRun (§C5-03 de research) | FR-011, FR-012 |
| `activitySource` | `hooks` \| `notify_rollout` \| `rollout` \| `none` | lo que el adaptador pudo armar para este segmento | FR-030, FR-031 |
| `toolsExposed` | string[] | herramientas de Zeko registradas en este segmento (research R5-18) | FR-033, NFR-006 |

La credencial de sesión (research R5-16) **no** se persiste en la base: vive en memoria del engine
host y en el archivo de token del segmento, que se borra al cerrarlo.

### NodeResultRecord (tabla `node_results`) — nueva

Historial de resultados de cualquier NodeRun que fue **reemplazado** por una reapertura (del propio
nodo interactivo o de un ancestro). El resultado vigente sigue en `node_runs`.

| Campo | Tipo | Notas | FR |
|---|---|---|---|
| `id` | uuid v7 | | |
| `nodeRunId` | FK | | |
| `generation` | int | generación del NodeRun al producirse | FR-023a |
| `result` | JSON | instantánea del `NodeResult` + `declaration?` + `summary?` + `observedFiles` + `discrepancies` + `resultCommit?`, ya redactada | FR-023a, FR-028 |
| `supersededAt` | fecha | | FR-023a |
| `supersededBy` | `REOPENED` \| `UPSTREAM_REOPENED` | `REOPENED`: el propio nodo; `UPSTREAM_REOPENED`: un ancestro | FR-023a |
| `sourceNodeRunId?` | FK | el nodo reabierto, si fue un ancestro | FR-023a |

Regla: el bloque de predecesores (R-23 de 001) y el contexto de R5-14 solo usan resultados
**vigentes**. Un `NodeResultRecord` nunca se inyecta ni se muestra como vigente.

### IsolatedWorkspace — cambio de cardinalidad

Un nodo interactivo tiene **un** workspace por NodeRun (no uno por intento). Se crea al abrir la
primera sesión (no al quedar `waiting_user`), así que un nodo que nunca se abre no deja copia. `trust`
y `state` no cambian.

### ReasonCode — agregados

| Código | Estado | Cuándo | FR |
|---|---|---|---|
| `USER_DECLARED_FAILED` | `failed` | declaración `FAILED` | FR-018 |
| `USER_DECLARED_BLOCKED` | `blocked` | declaración `BLOCKED` | FR-018 |
| `UPSTREAM_REOPENED` | `cancelled` (si estaba corriendo) o motivo de reemplazo | un ancestro se reabrió | FR-023a |
| `RERUN_DECLINED` | `skipped` | el usuario rechazó reejecutar los dependientes | FR-023a |

Los demás motivos de un nodo interactivo son los de 001: `CANCELLED_BY_USER`, `TIME_LIMIT_EXCEEDED`,
`PROCESS_ERROR` (corte inesperado), `AGENT_UNAVAILABLE`, `AGENT_NOT_AUTHENTICATED`,
`WORKSPACE_CREATE_FAILED`, `WRITE_OUTSIDE_SCOPE`, `UPSTREAM_NOT_SUCCEEDED`, `RUN_CANCELLED`.

### `resolveNodeResult` — cambios a la tabla de 001

La entrada agrega `declaration: Declaration`, que reemplaza el uso directo de `report` en las reglas
5 y 6:

- `Declaration = {origin: 'agent_report', reportState, report?}` para nodos de agente (sin cambios de
  comportamiento);
- `Declaration = {origin: 'user' | 'normal_exit', status, blockers: []}` para nodos interactivos.

| # de 001 | Cambio |
|---|---|
| 2a–2e | `killed{by: declaration}` **no** coincide con ninguna: es un cierre pedido por Zeko tras una declaración válida. |
| 3 | Solo si `origin = agent_report`. |
| 4a | Sin cambio (en interactivos `reportsDenials = false`). |
| 4b | Sin cambio: `scopeViolations` bloquea con cualquier origen (FR-020). |
| 5a / 5b | Leen `declaration.status`; el `reason.code` es `AGENT_REPORTED_*` o `USER_DECLARED_*` según el origen (`normal_exit` solo produce `COMPLETED`). |
| 6 | Lee `declaration.blockers` (vacío en interactivos). |
| aparte | `inconsistency = COMPLETED_WITHOUT_CHANGES` si `requiresChanges ∧ status = COMPLETED ∧ observedFiles = []`; no cambia el estado (FR-021). |
| aparte | `undeclared` / `declaredNotObserved` solo con `origin = agent_report` (el usuario no declara archivos). |

---

## 3. Estados y transiciones

### Estados de nodo — agregado

| `NodeStatus` | Etiqueta UI | Terminal | Principio XIII | FR |
|---|---|---|---|---|
| `waiting_user` | Waiting for you | no | waiting approval | FR-005 |

**Transiciones de un nodo interactivo**

```text
pending ──(predecesores completed/approved)──▶ waiting_user                       [evento node.waiting_user]
pending ──(predecesor no exitoso)──▶ skipped [UPSTREAM_NOT_SUCCEEDED]
pending ──(cancelar run)──▶ skipped [RUN_CANCELLED]
waiting_user ──(session.open ∧ auth ok ∧ worktree creado ∧ raíz adoptada)──▶ running
waiting_user ──(session.open con auth o spawn fallido)──▶ failed [AGENT_NOT_AUTHENTICATED | AGENT_UNAVAILABLE | WORKSPACE_CREATE_FAILED]
waiting_user ──(cancelar nodo o run)──▶ cancelled [CANCELLED_BY_USER | RUN_CANCELLED]
running ──(declaración ∧ cierre verificado ∧ commit)──▶ resolveNodeResult ──▶ completed | blocked | failed
running ──(salida normal ∧ commit)──▶ resolveNodeResult (declaración provisional COMPLETED)
running ──(corte inesperado)──▶ failed [PROCESS_ERROR]
running ──(tiempo acumulado ≥ límite)──▶ failed [TIME_LIMIT_EXCEEDED]
running ──(cancelar)──▶ cancelled [CANCELLED_BY_USER]        ; worktree untrusted, sin commit
running | waiting_user ──(cierre de la app / crash)──▶ interrupted  ; worktree untrusted
completed | blocked | failed ──(node.reopen ∧ trusted ∧ tiempo restante > 0 ∧ run running|finished)──▶ running (generation+1)
```

Cerrar o minimizar la vista **no** es una transición (FR-008). Una declaración con la sesión ya
terminada se rechaza (`SESSION_NOT_ACTIVE`), así que no hay transición desde un estado terminal
salvo la reapertura.

**Transiciones de un dependiente de un nodo reabierto** (directo o indirecto, FR-023a):

```text
running ──(ancestro reabierto)──▶ cancelled [UPSTREAM_REOPENED] ──▶ pending (hold = RERUN_CONFIRMATION)
completed | blocked | failed | approved | rejected | skipped ──(ancestro reabierto)──▶ pending (hold = RERUN_CONFIRMATION)
        ; el resultado anterior pasa a node_results (supersededBy = UPSTREAM_REOPENED)
pending (hold = RERUN_CONFIRMATION) ──(ancestro cerrado completed ∧ usuario confirma)──▶ pending (sin hold) ──▶ scheduler normal
pending (hold = RERUN_CONFIRMATION) ──(ancestro cerrado completed ∧ usuario rechaza)──▶ skipped [RERUN_DECLINED]
pending (hold = RERUN_CONFIRMATION) ──(ancestro cerrado blocked | failed | cancelled)──▶ skipped [UPSTREAM_NOT_SUCCEEDED]
```

- El paso `cancelled → pending` de un dependiente activo registra primero el resultado `cancelled`
  (con su worktree `untrusted`) en `node_results`. El NodeRun vuelve a `pending` con una generación
  nueva, y su reejecución usa un intento y un worktree nuevos desde el nuevo `resultCommit` (R-15).
- Las ramas independientes no cambian.
- Una aprobación dependiente vuelve a `pending` y, tras la confirmación, se pide de nuevo
  (`waiting_approval`).

### Lotes e hijos (FR-045–053)

```text
pedido ──(validateSpawnBatch con errores)──▶ rejected                          [spawn.rejected]
pedido ──(válido ∧ confirm = false)──▶ confirmed (decidedBy = auto) ──▶ hijos creados
pedido ──(válido ∧ confirm = true)──▶ pending_confirmation                     [spawn.confirmation_requested]
pending_confirmation ──(usuario confirma)──▶ confirmed ──▶ hijos creados
pending_confirmation ──(usuario rechaza)──▶ declined
pending_confirmation ──(sesión del orquestador termina)──▶ expired [PARENT_ENDED]
```

Un hijo creado es un NodeRun `origin = spawned` en `pending` y sigue las transiciones de un nodo de
agente de 001, más:

```text
pending | running | waiting_approval ──(orquestador cancelado | usuario elige cancelar)──▶ cancelled [PARENT_CANCELLED]
pending | running ──(zeko_cancel_child)──▶ cancelled [CANCELLED_BY_ORCHESTRATOR]
pending ──(dependencia no completed)──▶ skipped [UPSTREAM_NOT_SUCCEEDED]
(cualquier no terminal) ──(cierre de la app)──▶ interrupted
```

- Los hijos no son descendientes del orquestador en el DAG del flujo: la reapertura del orquestador
  **no** los invalida (FR-023a) y sus dependientes del flujo no los esperan (FR-054).
- Al terminar el orquestador con hijos activos (fuera de cancelación e interrupción), el run guarda
  la decisión pendiente `children_on_parent_end` y la vista la pide (FR-053).

### Estados de run — agregado

```text
finished ──(node.reopen de un nodo interactivo)──▶ running
```

`outcome` y `endedAt` se limpian al volver a `running` y se recalculan en el próximo `finished`. Los
runs `cancelled` e `interrupted` no admiten reapertura (`RUN_NOT_REOPENABLE`).

---

## 4. Esquema SQLite — migración `002_interactive`

Migración hacia adelante sobre `001_initial` (R-03). Solo agrega columnas y tablas.

```text
node_runs
  + generation INTEGER NOT NULL DEFAULT 1
  + declaration TEXT NULL        /*JSON EndDeclaration*/
  + summary TEXT NULL            /*JSON {state, text?|cause?}; redactado*/
  + active_ms INTEGER NOT NULL DEFAULT 0
  -- node_type admite 'interactive'; hold admite 'RERUN_CONFIRMATION';
  -- inconsistency admite 'COMPLETED_WITHOUT_CHANGES' (TEXT sin CHECK en 001)

attempts
  + agent_session_ref TEXT NULL
  + resumed_from TEXT NULL
  + launch_profile_hash TEXT NULL
  + active_ms INTEGER NULL
  + close_cause TEXT NULL
  -- kind admite 'interactive_segment'

node_results(
  id TEXT PK, node_run_id TEXT FK→node_runs, generation INTEGER,
  result TEXT /*JSON, redactado*/, superseded_at INTEGER,
  superseded_by TEXT CHECK(superseded_by IN ('REOPENED','UPSTREAM_REOPENED')),
  source_node_run_id TEXT NULL FK→node_runs)
  INDEX (node_run_id, generation)
```

`runs` no cambia: la transición `finished → running` reutiliza `status`, `outcome` y `ended_at`.
`workspaces.attempt_id` apunta al primer segmento del nodo interactivo.

Agregados de comunicación (misma migración `002_interactive`, todavía no publicada):

```text
node_runs
  + origin TEXT NOT NULL DEFAULT 'flow' CHECK(origin IN ('flow','spawned'))
  + parent_node_run_id TEXT NULL FK→node_runs
  + spawn_batch_id TEXT NULL FK→spawn_batches
  + spawn_key TEXT NULL
  + children TEXT NULL            /*JSON ChildRef[]; solo orquestadores*/
  INDEX (parent_node_run_id)

attempts
  + activity_source TEXT NULL
  + tools_exposed TEXT NULL       /*JSON string[]*/

spawn_batches(
  id TEXT PK, run_id TEXT FK→runs, parent_node_run_id TEXT FK→node_runs,
  requested_at INTEGER, snapshot_commit TEXT,
  status TEXT CHECK(status IN ('rejected','pending_confirmation','confirmed','declined','expired')),
  problems TEXT /*JSON*/, decided_at INTEGER NULL, decided_by TEXT NULL)

spawned_nodes(
  node_run_id TEXT PK FK→node_runs, batch_id TEXT FK→spawn_batches,
  key TEXT, depends_on TEXT /*JSON key[]*/, definition TEXT /*JSON AgentNode, redactado*/,
  saved_to_flow_at INTEGER NULL)
  UNIQUE (batch_id, key)
```

`workspaces` no cambia: la base de un hijo (instantánea o `resultCommit`) va en `base_commit` como
cualquier copia. La ref `refs/zeko/snapshots/…` vive en el repositorio y la borra la limpieza de
workspaces de 001 junto con las ramas `zeko/*`.

La base sigue sin guardar la transcripción, la salida del PTY ni el texto de los mensajes (FR-028).

---

## 5. Eventos persistidos — agregados

Todos llevan `run_id` y pasan por el redactor antes de guardarse (R-28, research R5-11).

| Tipo | Payload | FR |
|---|---|---|
| `node.waiting_user` | `{}` | FR-005 |
| `session.opened` | `sessionId`, `attemptId`, `n`, `workspace`, `confinement`, `warnings`, `resumedFrom?`, `remainingMs` | FR-006, FR-010, FR-027 |
| `session.resume_unavailable` | `cause` | FR-011 |
| `session.closed` | `sessionId`, `closeCause`, `processOutcome`, `activeMs` | FR-011, FR-019, FR-027 |
| `session.permission_files_excluded` | `paths` | FR-016 |
| `node.declared` | `EndDeclaration` | FR-018, FR-027 |
| `node.close_confirmation_requested` | `reason: agent_responding \| busy_unknown` | FR-018 |
| `node.recap` | `{state, cause?}` (la recap en sí va en `node.result`) | FR-018, FR-028 |
| `node.result` | (existente) `NodeResult` + `declaration?` + `summary?` + `inconsistency?` | FR-022, FR-027 |
| `node.reopened` | `generation`, `supersededResultId`, `remainingMs` | FR-011, FR-023a |
| `node.result_superseded` | `nodeRunId`, `resultId`, `supersededBy`, `sourceNodeRunId?` | FR-023a |
| `dependents.invalidated` | `sourceNodeRunId`, `cancelled: nodeId[]`, `invalidated: nodeId[]` | FR-023a |
| `rerun.confirmation_requested` | `sourceNodeRunId`, `dependents: nodeId[]` | FR-023a |
| `rerun.decided` | `decision: confirmed \| declined`, `origin` | FR-023a |
| `run.reopened` | `byNodeRunId` | FR-023a |
| `session.activity` | `sessionId`, `from`, `to`, `turnSeq` (sin nombres ni argumentos de herramientas) | FR-030 |
| `bridge.rejected` | `sessionId?`, `kind: hook \| tool`, `cause: no_token \| bad_token \| session_closed \| too_large \| timeout \| rate_limited` | FR-055, SC-011 |
| `tool.called` | `sessionId`, `tool`, `outcome` (sin argumentos ni salida) | FR-033, XIII |
| `tool.rejected` | `sessionId`, `tool`, `code` | FR-035, NFR-006 |
| `context.read` | `reader`, `target`, `view`, `bytes` | FR-033, FR-034 |
| `message.queued` | `MessageDelivery` con `outcome = QUEUED` | FR-038 |
| `message.delivery` | `MessageDelivery` (cada cambio de `outcome`) | FR-040, US7-4 |
| `session.messaging_paused` / `session.messaging_resumed` | `sessionId` | FR-042 |
| `message.discarded` | `messageId`, `by: user` | FR-042 |
| `spawn.validated` | `parentNodeRunId`, `dryRun: true`, `problems` | FR-045 |
| `spawn.rejected` | `batchId`, `problems` | FR-046 |
| `spawn.confirmation_requested` | `batchId`, `children: {key, agent, model, writeScope, limits, dependsOn}[]`, `warnings` | FR-047 |
| `spawn.decided` | `batchId`, `decision: confirmed \| declined \| expired`, `decidedBy` | FR-047 |
| `child.created` | `batchId`, `nodeRunId`, `nodeId`, `baseCommit` | FR-048, FR-049 |
| `children.parent_end_decision` | `parentNodeRunId`, `decision: cancel \| let_finish`, `active: nodeId[]` | FR-053 |
| `children.saved_to_flow` | `nodeIds`, `flowFile` | FR-052 |

No existen eventos `agent.text`, `agent.tool_call` ni `agent.tool_result` para sesiones interactivas:
no hay stream estructurado y no se guarda la transcripción (FR-028). Tampoco se escriben logs crudos
(research §C, C5-07).
