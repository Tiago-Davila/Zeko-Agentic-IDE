# Data Model: Nodos interactivos de agente (005)

**Fecha**: 2026-09-28 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

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

La base sigue sin guardar la transcripción ni la salida del PTY (FR-028).

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

No existen eventos `agent.text`, `agent.tool_call` ni `agent.tool_result` para sesiones interactivas:
no hay stream estructurado y no se guarda la transcripción (FR-028). Tampoco se escriben logs crudos
(research §C, C5-07).
