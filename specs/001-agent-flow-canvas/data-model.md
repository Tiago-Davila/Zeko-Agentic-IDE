# Data Model: Canvas de flujos de agentes CLI (001)

**Fecha**: 2026-09-23 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Todas las entidades se definen **una sola vez** como schemas zod en `packages/contracts`, y los
tipos TypeScript se infieren de ellos (Principio VII). Este documento describe los campos, las
reglas y las transiciones. No contiene código.

Convenciones:

- `?` = campo opcional **ausente cuando no hay dato**. Nunca lleva un valor por defecto que simule
  un dato (decisión 1).
- Ids de flujo y de nodo: slugs `[a-z0-9-]{1,40}`, estables y definidos en el archivo.
- Ids de run, nodeRun e intento: UUID v7 (ordenables por tiempo).
- Fechas: ISO-8601 UTC en el dominio; enteros de milisegundos epoch en SQLite.

---

## 1. Entidades de definición (archivo, no base de datos)

Se persisten en `.zeko/` (Principio V). El formato está en
[contracts/flow-file.md](./contracts/flow-file.md).

### ProjectConfig — `.zeko/config.yaml`

| Campo | Tipo | Default | Regla | FR |
|---|---|---|---|---|
| `schemaVersion` | `1` | — | obligatorio | FR-054 |
| `concurrencyLimit` | int | 8 | 1..64 | FR-027 |
| `usageNearLimitThreshold` | número | 0.9 | 0.5..1.0 | FR-053 |

Si el archivo no existe, se usan los defaults. Zeko solo lo escribe cuando el usuario cambia un
valor.

### Flow

| Campo | Tipo | Regla | FR |
|---|---|---|---|
| `schemaVersion` | `1` | obligatorio | FR-054 |
| `id` | slug | igual al nombre del archivo sin `.flow.yaml` | FR-004 |
| `name` | string | no vacío | FR-004 |
| `nodes` | `Node[]` | ids únicos | FR-005 |
| `edges` | `Edge[]` | ver validación | FR-006 |

### Node (unión discriminada por `type`)

Campos comunes: `id`, `type`, `label?`, `position {x:int, y:int}` (FR-055).

**InputNode** (`type: input`)

| Campo | Tipo | Regla | FR |
|---|---|---|---|
| `objective` | string multilínea | no vacío | FR-010 |

**AgentNode** (`type: agent`)

| Campo | Tipo | Default al crear | Regla | FR |
|---|---|---|---|---|
| `agent` | `claude-code` \| `codex` | `claude-code` | adaptador registrado | FR-011, FR-013 |
| `instructions` | string multilínea | — | no vacío | FR-011 |
| `acceptanceCriteria` | string[] | `[]` | | FR-011 |
| `writeScope` | string[] (globs relativos a la raíz, separador `/`) | `["**"]` | sin `..`, sin rutas absolutas; `[]` = solo lectura | FR-011, FR-017 |
| `terminal.enabled` | bool | `false` | se conserva aunque el agente no lo use (FR-015) | FR-017, FR-018 |
| `terminal.allowedCommands` | string[] | `[]` | solo aplica si `enabled` y el agente admite lista | FR-018 |
| `limits.timeoutMinutes` | int | 30 | 1..1440, obligatorio y finito | FR-032, NFR-008 |
| `limits.maxTurns` | int | 40 | 1..500; se conserva aunque no aplique | FR-032 |
| `limits.maxRetries` | int | 1 | 0..5 | FR-032, NFR-008 |

Cambiar `agent` no borra ningún campo (FR-015). Qué campos se muestran como "not applicable" y cuál
es el valor *efectivo* lo deciden las capacidades del adaptador
([contracts/adapter.md §Capacidades](./contracts/adapter.md#matriz-de-capacidades)). Por ejemplo,
para Codex la terminal efectiva es `true` aunque `terminal.enabled` sea `false`.

**ApprovalNode** (`type: approval`): sin campos propios (FR-012).

### Edge

| Campo | Tipo | Regla | FR |
|---|---|---|---|
| `from` | nodeId | existe | FR-006 |
| `to` | nodeId | existe, `≠ from`, sin duplicados | FR-006, FR-007 |

### Reglas de validación del flujo (`packages/core/validation`)

Cada error lleva `code`, `nodeId?` y `edgeId?`, más la ubicación en el archivo cuando corresponde
(FR-009, FR-057).

| Código | Severidad | Regla | FR |
|---|---|---|---|
| `FILE_PARSE_ERROR` | error | YAML inválido, con línea y columna | FR-057 |
| `SCHEMA_ERROR` | error | no cumple el schema zod, con path, línea y columna | FR-057 |
| `NO_INPUT_NODE` / `MULTIPLE_INPUT_NODES` | error | debe haber exactamente un nodo de entrada | FR-010, casos límite |
| `INPUT_HAS_PREDECESSOR` | error | el nodo de entrada no tiene aristas entrantes | FR-010 |
| `CYCLE` | error | el grafo tiene un ciclo (se informan los nodos del ciclo). En edición, `validateEdge` rechaza la arista antes de crearla. | FR-007 |
| `DISCONNECTED_NODE` | error | nodo no alcanzable desde la entrada | casos límite |
| `APPROVAL_WITHOUT_PREDECESSOR` | error | una aprobación necesita al menos un predecesor | FR-012 |
| `MULTIPLE_CODE_SOURCES` | error | un nodo de agente (o una aprobación con dependientes de agente) recibe más de una fuente de código distinta, según `codeSource` (research R-22) | FR-008 |
| `INVALID_LIMIT` | error | límite fuera de rango o ausente | NFR-008 |
| `SCOPE_PATH_NOT_FOUND` | warning | un glob de `writeScope` no coincide con ningún archivo del `HEAD` | casos límite |
| `OPTION_NOT_APPLICABLE` | info | la opción configurada no aplica al agente (terminal, lista de comandos, turnos) | FR-011, FR-015 |

`codeSource(n)`:

- entrada → `∅`;
- agente con `writeScope ≠ []` → `{n}`;
- aprobación, o agente con `writeScope = []` → la unión de `codeSource` de sus predecesores.

El error `MULTIPLE_CODE_SOURCES` se produce cuando esa unión, calculada sobre los predecesores, tiene
más de un elemento.

### Nivel de confinamiento derivado (función pura en `core`)

| Agente | Terminal efectiva | `writeScope` | Nivel | Motivo | FR |
|---|---|---|---|---|---|
| claude-code | no | cualquiera | `confined` | — | FR-019 |
| claude-code | sí | cualquiera | `unconfined` | `TERMINAL_ENABLED` | FR-020 |
| codex | siempre sí | cualquiera | `write_only` | `CAN_READ_OUTSIDE_WORKSPACE` | FR-019–021 |
| agente sin `confinement.noTerminal` | no | cualquiera | `unconfined` | `AGENT_CANNOT_CONFINE` (+ advertencia FR-022) | FR-020, FR-022 |

La función solo mira las capacidades del adaptador, nunca el id del agente (FR-016).

Advertencias por nodo derivadas de las capacidades (NFR-012): `DENIAL_CHECK_NOT_AVAILABLE`,
`TURN_LIMIT_NOT_APPLICABLE`, `NO_NETWORK_ON_PLATFORM`, `COST_NOT_REPORTED`, `USAGE_NOT_LIVE`,
`READONLY_COMMANDS_AUTO_APPROVED`, `AUTH_API_KEY_UNVERIFIED`, `SCOPE_ENFORCEMENT_DETECTION_ONLY`
(mientras U-02 esté abierto).

---

## 2. Entidades de ejecución (SQLite)

### Run

| Campo | Tipo | Notas | FR |
|---|---|---|---|
| `id` | uuid v7 | se usa como identificador de correlación en todos los eventos | FR-063 |
| `projectRoot` | ruta | | FR-001 |
| `flowId`, `flowName`, `flowFile` | | | FR-060 |
| `flowSnapshot` | JSON | flujo validado tal como se ejecutó (research T-12) | FR-060 |
| `flowHash` | sha256 del archivo | | |
| `origin` | `desktop` \| `cli` | | FR-060 |
| `baseCommit` | sha | `HEAD` del repositorio al iniciar | FR-041, casos límite |
| `warnings` | code[] | por ejemplo `UNCOMMITTED_CHANGES_EXCLUDED` | casos límite |
| `status` | `RunStatus` | ver §3 | FR-060 |
| `outcome?` | `all_succeeded` \| `some_not_succeeded` | solo si `status = finished` | FR-060 |
| `hold?` | `USAGE_NEAR_LIMIT` | run en espera (caso límite) | FR-053 |
| `startedAt`, `endedAt?`, `durationMs?` | | | FR-060 |
| `totals` | `CostTotals` | ver abajo | FR-050, FR-051 |
| `hostPid`, `hostStartedAt`, `heartbeatAt` | | para detectar interrupciones (research R-20) | FR-062 |

### NodeRun (uno por nodo del flujo en cada run)

| Campo | Tipo | Notas | FR |
|---|---|---|---|
| `id`, `runId`, `nodeId`, `nodeType` | | | FR-063 |
| `agentId?` | | agente que ejecutó el nodo | FR-060 |
| `status` | `NodeStatus` | ver §3 | FR-028 |
| `reason?` | `{code: ReasonCode, params}` | siempre presente en estados terminales distintos de `completed` y `approved` | FR-039, NFR-011 |
| `hold?` | `USAGE_NEAR_LIMIT` | mientras está `pending` retenido | FR-053 |
| `confinement` | `{level, reason?}` | se fija al crear el NodeRun y no cambia | FR-021, FR-022 |
| `warnings` | code[] | capacidades no disponibles, etc. | FR-022, FR-023, NFR-012 |
| `attempts` | `Attempt[]` | | FR-032 |
| `baseCommit?`, `resultCommit?` | sha | | FR-041, FR-046 |
| `workspace?` | `IsolatedWorkspace` | del último intento | FR-043 |
| `report?` | `AgentReport` | último reporte válido | FR-033 |
| `reportState` | `valid` \| `invalid` \| `absent` \| `not_applicable` | tras el pedido adicional | FR-038 |
| `observedFiles?` | `{path, change, eolOnly}[]` | desde git | FR-037 |
| `discrepancies?` | `{undeclared[], declaredNotObserved[], scopeViolations[], historyRewritten}` | | FR-037, research R-10 |
| `denials?` | `Denial[]` | **ausente** si el agente no informa denegaciones | FR-023 |
| `denialCheck` | `applied` \| `not_available` | | FR-023 |
| `inconsistency?` | `COMPLETED_WITH_BLOCKERS` | | FR-036.6 |
| `cost?` | `{amountUsd, basis: 'billed' \| 'list_price_estimate' \| 'unknown'}` | ausente si el agente no lo informa | FR-050, FR-051 |
| `consumption?` | `{inputTokens?, outputTokens?, cacheReadTokens?, cacheCreationTokens?}` | | FR-050 |
| `approval?` | `ApprovalDecision` | solo nodos de aprobación | FR-012 |
| `startedAt?`, `endedAt?` | | | FR-060 |

### Attempt (intento de ejecución de un nodo de agente)

| Campo | Tipo | Notas |
|---|---|---|
| `n` | int | 1..(1 + maxRetries) para `kind = agent` |
| `kind` | `agent` \| `infra_retry` \| `report_request` | `infra_retry` no cuenta contra `maxRetries` (R-18); `report_request` es el pedido adicional de FR-038 |
| `sessionId?` | string | |
| `processOutcome?` | `ProcessOutcome` | [contracts/adapter.md](./contracts/adapter.md#processoutcome) |
| `workspacePath` | ruta | |
| `startedAt`, `endedAt?` | | |

### IsolatedWorkspace

| Campo | Tipo | Notas | FR |
|---|---|---|---|
| `path` | ruta absoluta fuera del repo | `%LOCALAPPDATA%\Zeko\wt\<run8>\<nodeKey>` | FR-043 |
| `branch` | `zeko/<run8>/<nodeId>` | | FR-043, FR-045 |
| `baseCommit` | sha | | FR-041 |
| `trust` | `trusted` \| `untrusted` | `untrusted` si se canceló o interrumpió | FR-049 |
| `state` | `active` \| `kept` \| `deleted` | `deleted` solo tras confirmación | FR-048 |

### ApprovalDecision

`{decision: 'approved' | 'rejected', decidedAt, origin: 'desktop' | 'cli'}` (FR-012, FR-063).

### AgentUsageReading

`{agentId, authMode, windows: [{name, utilization 0..1, resetsAt?}], readAt, live: bool, source}`
(FR-052). La lectura efectiva es el `max(utilization)` de las ventanas vigentes.

### CostTotals

`{amountUsd?, partial: bool, estimated: bool, consumption: {...}}`:

- `partial = true` si algún NodeRun de agente no tiene `cost`;
- `estimated = true` si algún `cost.basis ≠ 'billed'`.

(FR-050, FR-051)

### NodeResult (salida de `resolveNodeResult`)

Es una función pura de `core` que implementa FR-036 en el orden exacto de la spec. Su entrada:

- `cancelledByUser: bool`
- `outcome: ProcessOutcome` (el definitivo del último intento de tipo `agent` o `infra_retry`)
- `reportState` + `report?` (tras el pedido adicional, si hizo falta)
- `denials?` + `capabilities.reportsDenials`
- `observedFiles`

Evaluación, en orden. La primera regla que coincide decide el resultado:

| # | Condición | Estado | `reason.code` | FR |
|---|---|---|---|---|
| 1 | `cancelledByUser` | `cancelled` | `CANCELLED_BY_USER` | FR-036.1 |
| 2a | `outcome.kind = killed` con `by = timeout` | `failed` | `TIME_LIMIT_EXCEEDED` | FR-036.2, FR-032 |
| 2b | `outcome.kind = turn_limit` | `failed` | `TURN_LIMIT_EXCEEDED` | FR-036.2 |
| 2c | `outcome.kind ∈ {agent_error, crashed}` | `failed` | `PROCESS_ERROR` (params: `terminalReason`, `exitCode`, `stderrCode`) | FR-036.2 |
| 2d | `outcome.kind = infra_failure` (reintentos de infra agotados) | `failed` | `INFRA_FAILURE_EXHAUSTED` | FR-036.2, R-18 |
| 2e | `outcome.kind = spawn_failed` | `failed` | `AGENT_UNAVAILABLE` / `AGENT_NOT_AUTHENTICATED` | casos límite |
| 3 | `reportState ∈ {absent, invalid}` | `failed` | `REPORT_MISSING` / `REPORT_INVALID` | FR-036.3, FR-038 |
| 4 | `capabilities.reportsDenials` y `denials.length > 0` | `blocked` | `ACTION_DENIED` (params: denials) | FR-036.4, FR-023 |
| 5a | `report.status = FAILED` | `failed` | `AGENT_REPORTED_FAILED` | FR-036.5 |
| 5b | `report.status = BLOCKED` | `blocked` | `AGENT_REPORTED_BLOCKED` | FR-036.5 |
| 6 | `report.status = COMPLETED` y `blockers.length > 0` | `blocked` | `REPORTED_COMPLETED_WITH_BLOCKERS` (+ `inconsistency`) | FR-036.6 |
| 7 | en cualquier otro caso | `completed` | — | FR-036.7 |

Aparte de las reglas, y **sin cambiar el estado**, la función siempre calcula `discrepancies`
(FR-037) y fija `denialCheck = reportsDenials ? 'applied' : 'not_available'` (FR-023).

---

## 3. Estados y transiciones

### Estados de nodo

| `NodeStatus` | Etiqueta UI (catálogo) | Terminal | Principio XIII | FR |
|---|---|---|---|---|
| `pending` | Pending | no | idle | FR-028 |
| `running` | Running | no | running | FR-028 |
| `waiting_approval` | Waiting for approval | no | waiting approval | FR-028 |
| `approved` | Approved | sí | done | FR-028 |
| `rejected` | Rejected | sí | failed | FR-031 (research T-03) |
| `completed` | Completed | sí | done | FR-028 |
| `blocked` | Blocked | sí | failed | FR-028 |
| `failed` | Failed | sí | failed | FR-028 |
| `cancelled` | Cancelled | sí | failed | FR-028 |
| `skipped` | Skipped | sí | idle | FR-028 |
| `interrupted` | Interrupted | sí (solo historial) | failed | FR-062 (research T-03) |

**Transiciones de un nodo de agente**

```text
pending ──(predecesores OK ∧ sin retención de uso ∧ slot libre)──▶ running
pending ──(predecesor en {blocked,failed,cancelled,rejected,skipped,interrupted})──▶ skipped  [UPSTREAM_NOT_SUCCEEDED | REJECTED_BY_USER | RUN_CANCELLED]
pending ──(cancelar run)──▶ skipped [RUN_CANCELLED]
pending ──(uso ≥ umbral)──▶ pending (hold = USAGE_NEAR_LIMIT) ──(uso < umbral)──▶ pending
running ──(fin de intento con error ∧ reintentos restantes)──▶ running (intento n+1)
running ──(infra_failure ∧ reintentos de infra restantes)──▶ running (infra_retry)
running ──(resolveNodeResult)──▶ completed | blocked | failed | cancelled
running ──(cierre de la app / crash)──▶ interrupted
```

**Transiciones de un nodo de aprobación**

```text
pending ──(todos los predecesores completed/approved)──▶ waiting_approval
waiting_approval ──(usuario aprueba)──▶ approved
waiting_approval ──(usuario rechaza)──▶ rejected ; dependientes ──▶ skipped [REJECTED_BY_USER]
waiting_approval ──(cancelar run)──▶ cancelled
pending ──(predecesor no exitoso)──▶ skipped
```

**Nodo de entrada**: `pending → completed` en cuanto arranca el run. Su resultado es `objective`
(FR-010).

**Propagación (FR-031)**: cuando un nodo queda en `{blocked, failed, cancelled, rejected}`, todos
sus descendientes que siguen `pending` pasan a `skipped`. El motivo incluye el id del nodo de
origen. Las ramas independientes continúan.

### Estados de run

| `RunStatus` | Etiqueta | Terminal | FR |
|---|---|---|---|
| `running` | Running | no | FR-060 |
| `finished` | Finished | sí; `outcome` = `all_succeeded` si todos los nodos terminaron `completed` o `approved` | FR-060 |
| `cancelled` | Cancelled | sí | FR-030 |
| `interrupted` | Interrupted | sí | FR-062 |

```text
(validación ✓ ∧ verificación previa ✓) ──▶ running
running ──(todos los NodeRuns terminales)──▶ finished
running ──(usuario cancela run)──▶ cancelled   [running→cancelled, waiting_approval→cancelled, pending→skipped]
running ──(cierre ordenado o crash detectado al reiniciar)──▶ interrupted
```

Si falla la validación o la verificación previa, **no se crea el run** (FR-009, FR-024, FR-025).

---

## 4. Esquema SQLite (`packages/storage`)

Base: `%LOCALAPPDATA%\Zeko\zeko.db`, en modo WAL con `synchronous=FULL` y `foreign_keys=ON`. Las
migraciones son numeradas y van hacia adelante (research R-03).

```text
schema_migrations(version INTEGER PK, applied_at INTEGER)

projects(
  id TEXT PK, root_path TEXT UNIQUE NOT NULL, created_at INTEGER)

runs(
  id TEXT PK, project_id TEXT FK→projects,
  flow_id TEXT, flow_name TEXT, flow_file TEXT, flow_hash TEXT, flow_snapshot TEXT /*JSON*/,
  origin TEXT CHECK(origin IN ('desktop','cli')),
  base_commit TEXT, warnings TEXT /*JSON*/,
  status TEXT, outcome TEXT NULL, hold TEXT NULL,
  started_at INTEGER, ended_at INTEGER NULL,
  cost_usd REAL NULL, cost_partial INTEGER, cost_estimated INTEGER, consumption TEXT /*JSON*/,
  host_pid INTEGER, host_started_at INTEGER, heartbeat_at INTEGER)
  INDEX (project_id, flow_id, started_at DESC)
  INDEX (status)

node_runs(
  id TEXT PK, run_id TEXT FK→runs, node_id TEXT, node_type TEXT, agent_id TEXT NULL,
  status TEXT, reason_code TEXT NULL, reason_params TEXT /*JSON*/, hold TEXT NULL,
  confinement_level TEXT, confinement_reason TEXT NULL, warnings TEXT /*JSON*/,
  base_commit TEXT NULL, result_commit TEXT NULL,
  report TEXT NULL /*JSON*/, report_state TEXT,
  observed_files TEXT NULL, discrepancies TEXT NULL,
  denials TEXT NULL /*NULL = el agente no informa; '[]' = informa y no hubo*/,
  denial_check TEXT, inconsistency TEXT NULL,
  cost_usd REAL NULL, cost_basis TEXT NULL, consumption TEXT NULL,
  started_at INTEGER NULL, ended_at INTEGER NULL,
  UNIQUE(run_id, node_id))

attempts(
  id TEXT PK, node_run_id TEXT FK→node_runs, n INTEGER, kind TEXT,
  session_id TEXT NULL, process_outcome TEXT NULL /*JSON*/,
  started_at INTEGER, ended_at INTEGER NULL)

workspaces(
  id TEXT PK, node_run_id TEXT FK→node_runs, attempt_id TEXT FK→attempts,
  path TEXT, branch TEXT, base_commit TEXT,
  trust TEXT CHECK(trust IN ('trusted','untrusted')),
  state TEXT CHECK(state IN ('active','kept','deleted')),
  created_at INTEGER, deleted_at INTEGER NULL)

process_tree(               -- R-14: solo procesos del árbol lanzado por el motor
  attempt_id TEXT FK→attempts, pid INTEGER, creation_time INTEGER,
  parent_pid INTEGER NULL, is_root INTEGER,
  first_seen INTEGER, last_seen INTEGER, ended_at INTEGER NULL,
  PRIMARY KEY (attempt_id, pid, creation_time))

approvals(
  id TEXT PK, run_id TEXT FK→runs, node_run_id TEXT FK→node_runs,
  decision TEXT CHECK(decision IN ('approved','rejected')),
  origin TEXT, decided_at INTEGER)

events(
  seq INTEGER PK AUTOINCREMENT, run_id TEXT FK→runs, node_run_id TEXT NULL, attempt_id TEXT NULL,
  ts INTEGER, type TEXT, payload TEXT /*JSON, redactado*/)
  INDEX (run_id, seq)
  INDEX (node_run_id, seq)

agent_usage(
  agent_id TEXT, auth_mode TEXT, window TEXT, utilization REAL, resets_at INTEGER NULL,
  read_at INTEGER, live INTEGER, source TEXT,
  PRIMARY KEY (agent_id, window))

slot_leases(                -- R-21: límite global por proyecto entre procesos
  project_id TEXT, node_run_id TEXT PK, host_pid INTEGER, host_started_at INTEGER,
  acquired_at INTEGER, heartbeat_at INTEGER)
  INDEX (project_id)
```

La base guarda **solo estado de ejecución** (Principio V). Las definiciones de flujo viven en
`.zeko/`. `flow_snapshot` es el registro de lo que se ejecutó (research T-12). La base nunca guarda
variables de entorno ni credenciales (NFR-007).

---

## 5. Eventos persistidos (`events.type`)

Todos llevan `run_id` (FR-063). El `payload` se valida con zod y pasa por el redactor de
credenciales antes de guardarse (research R-23).

| Tipo | Payload (resumen) | FR |
|---|---|---|
| `run.started` | `origin`, `baseCommit`, `warnings`, `preflight` (agentes, forma de auth efectiva por nodo) | FR-024, FR-025, FR-065 |
| `run.held` / `run.resumed` | `reason` | FR-053 |
| `run.cancel_requested` | `origin` | FR-030, FR-063 |
| `run.finished` | `status`, `outcome`, `totals` | FR-060 |
| `run.interrupted` | `detectedAt`, `mode` (`graceful` \| `recovered`) | FR-062 |
| `node.state_changed` | `from`, `to`, `reason?`, `hold?` | FR-028, FR-063 |
| `node.attempt_started` | `attemptId`, `n`, `kind`, `workspace`, `confinement` | FR-063 |
| `node.attempt_finished` | `processOutcome` | FR-063 |
| `node.report_requested` | `why` (`absent` \| `invalid`), `zodErrors?` | FR-038 |
| `node.report_received` | `reportState` | FR-033 |
| `node.result` | `NodeResult` completo | FR-036, FR-039 |
| `node.cancel_requested` | `origin`, `phase` | FR-030 |
| `node.process_killed` | `phase` (`interrupt` \| `tree_kill`), `pids` terminados, `verifiedClean` | FR-030, NFR-004 |
| `agent.session_started` | `sessionId`, `model?`, `tools?`, `agentVersion?` | FR-063 |
| `agent.text` | `text`, `subagent?` | FR-029, FR-063 |
| `agent.tool_call` | `toolUseId?`, `name`, `input` | FR-063 ("acción reportada") |
| `agent.tool_result` | `toolUseId?`, `ok`, `content` (truncado a 64 KiB con marca) | FR-063 |
| `agent.permission_denied` | `tool`, `reason`, `input?` | FR-023, FR-063 |
| `agent.sandbox_rejection` | `line` (stderr) | FR-063, research T-06 |
| `agent.usage` | `consumption`, `cost?` | FR-050 |
| `agent.subscription_usage` | `AgentUsageReading` | FR-052 |
| `agent.stderr` | `line` | diagnóstico |
| `approval.requested` | `summary` (resultados de predecesores) | FR-012 |
| `approval.decided` | `decision`, `origin` | FR-012, FR-063 |
| `workspace.created` / `workspace.committed` / `workspace.marked_untrusted` / `workspace.deleted` | `path`, `branch`, `commit?` | FR-043, FR-048, FR-049 |
| `error` | `code`, `context` | FR-063 |

La salida cruda del agente (JSONL completo, redactado) también se guarda en
`%LOCALAPPDATA%\Zeko\logs\<run>\<node>-<attempt>.jsonl` para diagnóstico. Lo que se muestra y lo
que cuenta como historial es la tabla `events`.
