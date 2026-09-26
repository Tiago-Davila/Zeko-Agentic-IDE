---
description: "Lista de tareas para implementar el canvas de flujos de agentes CLI (primera versión de Zeko)"
---

# Tasks: Canvas de flujos de agentes CLI (primera versión de Zeko)

**Input**: documentos de diseño en `specs/001-agent-flow-canvas/` (spec.md, plan.md, research.md,
data-model.md, quickstart.md, contracts/) y los hallazgos de `spikes/001-claude-chain`,
`spikes/001b-claude-edges` y `spikes/001c-codex`.

**Tests**: obligatorios para toda regla del motor (Principio XVI). Cada regla se implementa con sus
tests **en la misma tarea**. Los tests automáticos **nunca** llaman a Claude Code ni a Codex reales:
usan el agente simulado (`fake-agent`) y los fixtures de `spikes/*/samples/`.

**Organización**: 15 fases técnicas, en el orden pedido. Hay un corte vertical temprano: al cerrar
la fase 10, la CLI ejecuta un flujo de dos nodos con el agente simulado, antes de cualquier tarea de
UI. Los adaptadores reales (fases 11 y 12) se construyen después.

## Formato

`- [ ] T### [P] [REAL] [US#] Descripción`, seguida de:

- **Archivos**: lo que la tarea crea o modifica. Una tarea = un diff = un commit (Principio XX).
- **Cubre**: FR/NFR/SC de spec.md.
- **Base**: decisión de plan.md (`D#`), de research.md (`R-##`, `T-##`, `U-##`) o hallazgo de spike
  (`[001 §N]`, `[001b §X]`, `[001c §N]`).
- **Depende de**: tareas que tienen que estar cerradas antes.

Marcadores:

- **[P]**: paralelizable. Toca archivos distintos y sus dependencias ya están cerradas.
- **[REAL]**: requiere Claude Code o Codex reales y consume la suscripción. Nunca corre en CI.
- **[US#]**: historia de usuario principal de spec.md (US1 diseño de flujos, US2 ejecución y
  resultado, US3 aprobación, US4 flujos mixtos, US5 terminal y confinamiento, US6 costo y uso,
  US7 CLI, US8 historial y recuperación). Las fases 1 y 2 no llevan etiqueta: son base común.

## Convenciones de rutas (plan.md §Project Structure)

- `packages/{contracts,core,adapters,git,storage,i18n,runtime}/src/…` y `…/test/…`.
- `apps/cli/src/…`, `apps/desktop/src/{main,engine-host,preload,renderer}/…`.
- Tests de integración solo para Windows: sufijo `*.win.test.ts` (corren con `pnpm test:win`).

---

## Phase 1: Setup del monorepo

**Propósito**: workspaces, TypeScript estricto, Vitest, lint y la estructura de paquetes de
plan.md.

- [X] T001 Crear la raíz del monorepo pnpm con scripts `build`, `test`, `test:win`, `lint` y
  `typecheck`, y fijar Node 24 LTS. **Archivos**: `package.json`, `pnpm-workspace.yaml`, `.npmrc`,
  `.nvmrc`, `.gitignore`. **Cubre**: NFR-001. **Base**: plan.md §Technical Context, R-02.
  **Depende de**: —
- [X] T002 Crear la configuración base de TypeScript: `strict`, `noImplicitAny`, ESM,
  `noUncheckedIndexedAccess`, project references. **Archivos**: `tsconfig.base.json`,
  `tsconfig.json`. **Cubre**: —. **Base**: Principio XV. **Depende de**: T001
- [X] T003 [P] Configurar Vitest para todo el workspace. `pnpm test` excluye `*.win.test.ts`;
  `pnpm test:win` los incluye solo en `win32`. Un setup global fija `ZEKO_TEST=1`: con esa variable,
  los adaptadores reales se niegan a resolver `claude` o `codex` desde el `PATH` o desde npm y solo
  aceptan una ruta inyectada (T115, T120). Así ningún test llama a un proveedor real aunque los CLI
  estén instalados en la máquina. **Archivos**: `vitest.workspace.ts`, `vitest.config.ts`,
  `vitest.setup.ts`. **Cubre**: —. **Base**: Principio XVI, R-26. **Depende de**: T002
- [X] T004 [P] Configurar ESLint (flat config) y Prettier: sin `any`, sin promesas flotantes, sin
  `catch` vacío. **Archivos**: `eslint.config.js`, `.prettierrc`. **Cubre**: —. **Base**:
  Principio XV. **Depende de**: T002
- [X] T005 Crear el esqueleto de los ocho paquetes, cada uno con `package.json`, `tsconfig.json`,
  `src/index.ts` vacío y `test/`: `contracts` (solo depende de zod), `core`, `adapters`, `git`,
  `storage`, `i18n`, `runtime` y `testing` (dobles de prueba; solo depende de `contracts` y los
  demás paquetes lo usan únicamente como `devDependency`). **Archivos**: `packages/*/package.json`, `packages/*/tsconfig.json`,
  `packages/*/src/index.ts`. **Cubre**: FR-059. **Base**: plan.md §Structure Decision, R-02.
  **Depende de**: T002
- [X] T006 [P] Crear el esqueleto de `apps/cli` con su binario `zeko`. **Archivos**:
  `apps/cli/package.json`, `apps/cli/tsconfig.json`, `apps/cli/src/index.ts`. **Cubre**: FR-059.
  **Base**: R-01. **Depende de**: T005
- [X] T007 [P] Crear el esqueleto de `apps/desktop` con electron-vite y cuatro entradas vacías:
  `main`, `engine-host`, `preload` y `renderer` (React). **Archivos**: `apps/desktop/package.json`,
  `apps/desktop/electron.vite.config.ts`, `apps/desktop/src/main/index.ts`,
  `apps/desktop/src/engine-host/index.ts`, `apps/desktop/src/preload/index.ts`,
  `apps/desktop/src/renderer/main.tsx`, `apps/desktop/src/renderer/index.html`. **Cubre**: —.
  **Base**: R-01. **Depende de**: T005
- [X] T008 Agregar reglas de dependencias entre paquetes en ESLint:
  `contracts ← core ← runtime → {adapters, git, storage} ← apps`.
  - `core` no puede importar `node:fs`, `node:child_process`, `node:sqlite` ni paquetes de
    infraestructura.
  - `adapters`, `git` y `storage` solo pueden importar `contracts`: nunca `core`, nunca entre
    ellos. Lo que necesitan de otro lo recibe el `runtime`, que es el único que los compone.
  - `testing` solo puede importarse desde `test/`, nunca desde `src/`.
  - El renderer no puede importar Node.

  Incluye un test con un import prohibido por cada regla. **Archivos**: `eslint.config.js`,
  `scripts/lint-boundaries.test.ts`. **Cubre**: FR-016. **Base**: Principio IV, plan.md
  §Structure Decision. **Depende de**: T004, T005, T006, T007
- [X] T009 [P] Crear el CI con Ubuntu (lint, typecheck, `pnpm test`) y Windows (lo mismo más
  `pnpm test:win`). No usa secretos de proveedores y falla si `claude` o `codex` están en el `PATH`
  de los tests. **Archivos**: `.github/workflows/ci.yml`. **Cubre**: NFR-001. **Base**: Principio
  XVI, R-26. **Depende de**: T003, T004

**Checkpoint fase 1**: `pnpm install && pnpm lint && pnpm typecheck && pnpm test` pasa en limpio en
Windows y en Linux. Un import prohibido (por ejemplo `node:child_process` en `core`) hace fallar el
lint.

---

## Phase 2: Contratos (zod, única fuente de tipos)

**Propósito**: schemas del archivo de flujo, AgentReport, eventos normalizados, ProcessOutcome,
interfaz de adaptador y matriz de capacidades. Todo lo demás depende de esta fase.

- [X] T010 Definir los códigos tipados: `ReasonCode` (todos los de data-model §NodeResult y
  §Transiciones, incluidos `WRITE_OUTSIDE_SCOPE` e `INFRA_FAILURE_EXHAUSTED`), `WarningCode`
  (incluidos `MODEL_DEFAULTED`, `MODEL_MISMATCH` y `SCOPE_ENFORCEMENT_DETECTION_ONLY`) y
  `DiagnosticCode`. Incluye un test de unicidad. **Archivos**: `packages/contracts/src/codes.ts`,
  `packages/contracts/test/codes.test.ts`. **Cubre**: FR-039, NFR-011, NFR-013. **Base**: R-24.
  **Depende de**: T005
- [X] T011 [P] Schema `FlowFile`: `Flow`, `InputNode`, `AgentNode` (con `models` por agente,
  opcional), `ApprovalNode` y `Edge`, con `additionalProperties: false` en todos los niveles y
  límites finitos. Tests: un campo desconocido (por ejemplo `apiKey`) da `SCHEMA_ERROR` (FR-058),
  rangos de límites, `writeScope` sin `..` ni rutas absolutas, una entrada de Codex sin
  `reasoningEffort` da `SCHEMA_ERROR` con su ubicación, y una entrada de Claude con
  `reasoningEffort` también. **Archivos**:
  `packages/contracts/src/flow-file.ts`, `packages/contracts/test/flow-file.test.ts`. **Cubre**:
  FR-004–012, FR-015, FR-058, NFR-007, NFR-008. **Base**: contracts/flow-file.md, R-04, R-27.
  **Depende de**: T010
- [X] T012 [P] Schema `ProjectConfig`: `concurrencyLimit` (8, 1..64), `usageNearLimitThreshold`
  (0.9, 0.5..1.0) y `defaultModels` con los defaults que trae Zeko. Tests de defaults y rangos.
  **Archivos**: `packages/contracts/src/project-config.ts`,
  `packages/contracts/test/project-config.test.ts`. **Cubre**: FR-011, FR-011a, FR-027, FR-053.
  **Base**: R-27, contracts/flow-file.md §config. **Depende de**: T010
- [X] T013 [P] Schema `AgentReport` (`.strict()`, alias `WorkReport`) y generación del JSON Schema
  que reciben los agentes. Tests:
  - snapshot del JSON generado;
  - solo usa las palabras clave permitidas (U-10);
  - forma "strict" de OpenAI: todas las propiedades en `required` y `additionalProperties: false`;
  - siempre admite `BLOCKED` y `FAILED`, y ninguna lista tiene `minItems`/`maxItems`.

  **Archivos**: `packages/contracts/src/agent-report.ts`,
  `packages/contracts/scripts/generate-schemas.ts`,
  `packages/contracts/generated/agent-report.schema.json`,
  `packages/contracts/test/agent-report.test.ts`. **Cubre**: FR-033–035. **Base**: R-06, T-11,
  `[001b §A3]`, `[001c §6]`. **Depende de**: T010
- [X] T014 [P] Schemas `TaskAssignment` y `PredecessorResult`, con tests. **Archivos**:
  `packages/contracts/src/task-assignment.ts`, `packages/contracts/test/task-assignment.test.ts`.
  **Cubre**: FR-040, FR-042. **Base**: Principio VII, contracts/agent-report.md §Uso posterior.
  **Depende de**: T013
- [X] T015 [P] Schema `NormalizedEvent`: `session_started`, `assistant_text`, `tool_call`,
  `tool_result`, `permission_denied`, `inferred_denial`, `usage`, `subscription_usage`,
  `model_mismatch`, `stderr` y `raw`. Todos llevan `ts` y `attemptId`. Con tests. **Archivos**:
  `packages/contracts/src/adapter/normalized-event.ts`,
  `packages/contracts/test/normalized-event.test.ts`. **Cubre**: FR-023, FR-029, FR-063.
  **Base**: contracts/adapter.md §NormalizedEvent, `[001 §2]`, `[001c §3]`. **Depende de**: T010
- [X] T016 [P] Schemas `ProcessOutcome` (unión discriminada: `exited`, `agent_error`,
  `turn_limit`, `killed{by, phase}`, `crashed`, `infra_failure{cause: process_create | session_lock}`
  y `spawn_failed`), con campos ausentes cuando no hay dato, y `ReportCandidate`. Tests: `denials`
  ausente es distinto de `[]`. **Archivos**:
  `packages/contracts/src/adapter/process-outcome.ts`,
  `packages/contracts/src/adapter/report-candidate.ts`,
  `packages/contracts/test/process-outcome.test.ts`. **Cubre**: FR-032, FR-036. **Base**: R-05,
  R-18, D2. **Depende de**: T010
- [X] T017 [P] Schemas `AgentCapabilities` (todas las filas de la matriz de adapter.md, incluidas
  `infersDenials` y `explicitModel`), `AgentAvailability` (sin campos de email ni de cuenta) y
  `AgentUsageReading`. Tests: `AgentAvailability` rechaza un campo `email`. **Archivos**:
  `packages/contracts/src/adapter/capabilities.ts`,
  `packages/contracts/src/adapter/availability.ts`, `packages/contracts/src/adapter/usage.ts`,
  `packages/contracts/test/capabilities.test.ts`. **Cubre**: FR-016, FR-021, FR-025, FR-052,
  FR-065, NFR-007, NFR-012. **Base**: contracts/adapter.md §Matriz, R-28. **Depende de**: T010
- [X] T018 Definir `LaunchSpec` (con `model` resuelto obligatorio) y la forma `AgentAdapter` /
  `AgentExecution` (`id`, `capabilities(platform)`, `detect`, `readUsage`, `launch`,
  `requestReport`, `cancel`, `rootPid` y `sensitiveValues`, la lista de credenciales que la
  ejecución inyectó y que el redactor debe ocultar; nunca se persiste). **Archivos**:
  `packages/contracts/src/adapter/launch-spec.ts`, `packages/contracts/src/adapter/adapter.ts`,
  `packages/contracts/test/launch-spec.test.ts`. **Cubre**: FR-011a, FR-013, FR-016. **Base**:
  contracts/adapter.md §Operaciones, Principio III. **Depende de**: T015, T016, T017
- [X] T019 [P] Declarar la matriz de capacidades de Claude Code y de Codex por plataforma (`win32`,
  `linux`) como datos, con tests que la comparan celda por celda con contracts/adapter.md.
  **Archivos**: `packages/adapters/src/capabilities/claude-code.ts`,
  `packages/adapters/src/capabilities/codex.ts`, `packages/adapters/test/capabilities.test.ts`.
  **Cubre**: FR-017–023, FR-032, FR-050–053, FR-064–066, NFR-012. **Base**: R-10, R-13,
  `[001 §6]`, `[001b §B]`, `[001c §7–9]`. **Depende de**: T017
- [X] T020 [P] Schemas de ejecución: `NodeStatus`, `RunStatus`, `Run`, `NodeRun` (con `model`
  resuelto e `inferredDenials`), `Attempt`, `IsolatedWorkspace`, `ApprovalDecision`, `CostTotals` y
  `NodeResult`, con tests. **Archivos**: `packages/contracts/src/run.ts`,
  `packages/contracts/src/node-result.ts`, `packages/contracts/test/run.test.ts`. **Cubre**:
  FR-028, FR-036–039, FR-050, FR-060. **Base**: data-model §2–3. **Depende de**: T010, T016
- [X] T021 [P] Schemas de los eventos persistidos de data-model §5 (incluido
  `agent.inferred_denial`), con tests. **Archivos**: `packages/contracts/src/events.ts`,
  `packages/contracts/test/events.test.ts`. **Cubre**: FR-063. **Base**: data-model §5.
  **Depende de**: T015, T020
- [X] T022 Definir los puertos que usa `core`: `WorkspacePort`, `RunStorePort`, `ClockPort`,
  `SlotLeasePort` y `UsageStorePort`. **Archivos**: `packages/contracts/src/ports.ts`,
  `packages/contracts/test/ports.test.ts`. **Cubre**: FR-059. **Base**: R-02, Principio IV.
  **Depende de**: T018, T020
- [X] T023 Schemas IPC: `IpcRequest`, `IpcResponse`, `IpcEvent`, `NodeView` (con `model` y
  `warnings`) y `FILE_CHANGED_ON_DISK{currentHash}`, con tests. **Archivos**:
  `packages/contracts/src/ipc.ts`, `packages/contracts/test/ipc.test.ts`. **Cubre**: FR-021,
  FR-028, FR-029, NFR-002, NFR-003. **Base**: contracts/ipc.md, R-25. **Depende de**: T020, T021
- [X] T024 [P] Schemas `CliEvent` (NDJSON): `validation`, `preflight`, `run.started`,
  `node.state`, `approval.requested`, `node.result` y `run.finished`, con tests. **Archivos**:
  `packages/contracts/src/cli-events.ts`, `packages/contracts/test/cli-events.test.ts`. **Cubre**:
  FR-059. **Base**: contracts/cli.md. **Depende de**: T020
- [X] T025 [P] Crear el catálogo i18n: `t(key, params)` sin dependencias y `en.json`. Incluye un
  test que falla si algún código de T010 no tiene entrada. **Archivos**:
  `packages/i18n/src/index.ts`, `packages/i18n/src/en.json`, `packages/i18n/test/catalog.test.ts`.
  **Cubre**: NFR-013. **Base**: R-24. **Depende de**: T010

**Checkpoint fase 2**: `packages/contracts` exporta todos los schemas; el JSON Schema del reporte
se genera y pasa la verificación de modo strict; las matrices de capacidades coinciden con
adapter.md; todo código tiene texto en el catálogo.

---

## Phase 3: Dominio (`packages/core`, funciones puras)

**Propósito**: validación de flujos, modelo por nodo, confinamiento, estados y transiciones de
nodos y runs, y el prompt del nodo.

- [X] T026 [US1] Reglas de grafo con tests (un caso por regla): `NO_INPUT_NODE`,
  `MULTIPLE_INPUT_NODES`, `INPUT_HAS_PREDECESSOR`, `DISCONNECTED_NODE`,
  `APPROVAL_WITHOUT_PREDECESSOR`, aristas a nodos inexistentes y aristas duplicadas. **Archivos**:
  `packages/core/src/validation/graph.ts`, `packages/core/test/validation/graph.test.ts`. **Cubre**:
  FR-006, FR-009, FR-010, FR-012. **Base**: data-model §Reglas de validación. **Depende de**: T011
- [X] T027 [US1] Detección de ciclos (`CYCLE` con los nodos del ciclo) y `validateEdge`, que rechaza
  una arista antes de crearla, con tests (US1-3). **Archivos**:
  `packages/core/src/validation/cycles.ts`, `packages/core/test/validation/cycles.test.ts`.
  **Cubre**: FR-007. **Base**: data-model §Reglas. **Depende de**: T026
- [X] T028 [US1] Linaje de código: `codeSource` e `inputSources`, más el error
  `MULTIPLE_CODE_SOURCES`. Tests:
  - dos predecesores que modifican código (US1-4);
  - herencia a través de una aprobación;
  - un nodo de solo lectura que **no** transporta linaje (`A → B(ro) → C`, C parte de la base);
  - una aprobación con dos fuentes y dependientes de agente.

  **Archivos**: `packages/core/src/validation/code-lineage.ts`,
  `packages/core/test/validation/code-lineage.test.ts`. **Cubre**: FR-008, FR-041. **Base**: R-22,
  T-02 (clarificación 2026-09-23). **Depende de**: T026
- [X] T029 [P] [US1] Límites y alcance con tests: `INVALID_LIMIT`, validación de globs de
  `writeScope`, y `SCOPE_PATH_NOT_FOUND` como advertencia (recibe la lista de archivos de `HEAD`
  como dato). **Archivos**: `packages/core/src/validation/limits-and-scope.ts`,
  `packages/core/test/validation/limits-and-scope.test.ts`. **Cubre**: FR-011, FR-017, NFR-008,
  casos límite. **Base**: data-model §Reglas. **Depende de**: T026
- [X] T030 [US1] **Modelo explícito por nodo**: `resolveNodeModel(node, projectConfig)` →
  `{model, reasoningEffort?, source: 'node' | 'project_default'}`.
  - Si falta el modelo, advertencia `MODEL_DEFAULTED` (nunca un error).
  - **Nunca** devuelve "sin modelo" ni delega en el default del agente.
  - El respaldo del proyecto aplica solo cuando el nodo **no tiene entrada** para su agente. Una
    entrada de Codex sin `reasoningEffort` no llega acá: el schema la rechaza (T011).
  - Tests: nodo con modelo; sin entrada para su agente (modelo y esfuerzo del proyecto, con
    `source: 'project_default'`); entrada de otro agente conservada (FR-015).

  **Archivos**: `packages/core/src/validation/model.ts`,
  `packages/core/test/validation/model.test.ts`. **Cubre**: FR-011, FR-011a, FR-015, FR-016.
  **Base**: R-27, `[001c §1]` (el default cambia sin cambiar la configuración), `[001 §1]`.
  **Depende de**: T011, T012
- [X] T031 [US1] `validateFlow`: agrega las reglas de T026–T030, calcula `OPTION_NOT_APPLICABLE`
  según capacidades (recibidas como dato, nunca importadas de `adapters`) y devuelve diagnósticos
  por nodo, con tests de integración de las reglas. Los tests usan perfiles de capacidades
  sintéticos, construidos con el tipo `AgentCapabilities` de `contracts`. **Archivos**:
  `packages/core/src/validation/validate-flow.ts`,
  `packages/core/test/validation/validate-flow.test.ts`. **Cubre**: FR-009, FR-011, FR-015.
  **Base**: data-model §Reglas, Principio IV. **Depende de**: T027, T028, T029, T030, T017
- [X] T032 [P] [US5] Confinamiento derivado y advertencias por capacidades:
  - nivel `confined`, `write_only` o `unconfined`, con su motivo;
  - terminal efectiva y lista `notApplicable`;
  - advertencias: `DENIAL_CHECK_NOT_AVAILABLE`, `TURN_LIMIT_NOT_APPLICABLE`,
    `NO_NETWORK_ON_PLATFORM`, `COST_NOT_REPORTED`, `USAGE_NOT_LIVE`,
    `READONLY_COMMANDS_AUTO_APPROVED`, `AUTH_API_KEY_UNVERIFIED` y
    `SCOPE_ENFORCEMENT_DETECTION_ONLY`.

  Tests con perfiles de capacidades sintéticos (construidos con el tipo `AgentCapabilities`, sin
  importar las matrices de `adapters`) que cubren cada valor de cada capacidad, incluidos los dos
  perfiles de la matriz de adapter.md; un test verifica que la función no recibe el id del agente.
  **Archivos**: `packages/core/src/policy/confinement.ts`,
  `packages/core/test/policy/confinement.test.ts`. **Cubre**: FR-017–023, FR-066, NFR-009, NFR-012.
  **Base**: data-model §Nivel de confinamiento, R-10, R-13, T-05. **Depende de**: T017
- [X] T033 [US2] Máquina de estados de nodo (agente, aprobación y entrada, incluido
  `interrupted`). Rechaza transiciones inválidas. Con tests. **Archivos**:
  `packages/core/src/state/node-machine.ts`, `packages/core/test/state/node-machine.test.ts`.
  **Cubre**: FR-028, FR-031, FR-062. **Base**: data-model §3, T-03. **Depende de**: T020
- [X] T034 [US2] Máquina de estados de run (`running`, `finished`, `cancelled`, `interrupted`) y
  cálculo de `outcome`, con tests. **Archivos**: `packages/core/src/state/run-machine.ts`,
  `packages/core/test/state/run-machine.test.ts`. **Cubre**: FR-060, FR-062. **Base**: data-model
  §Estados de run. **Depende de**: T033
- [X] T035 [US2] Propagación de omitidos: los descendientes pendientes pasan a `skipped` con el
  motivo y el nodo de origen (`UPSTREAM_NOT_SUCCEEDED`, `REJECTED_BY_USER`, `RUN_CANCELLED`); las
  ramas independientes siguen. Tests US2-6 y US3-3. **Archivos**:
  `packages/core/src/state/propagation.ts`, `packages/core/test/state/propagation.test.ts`.
  **Cubre**: FR-031. **Base**: data-model §Propagación. **Depende de**: T033
- [X] T036 [P] [US6] Totales de costo del run: suma de los nodos con dato, `partial` y `estimated`,
  sin imputar faltantes. Con tests. **Archivos**: `packages/core/src/policy/cost-totals.ts`,
  `packages/core/test/policy/cost-totals.test.ts`. **Cubre**: FR-050, FR-051. **Base**: R-17.
  **Depende de**: T020
- [X] T037 [P] [US2] Armado de `PredecessorResult` por predecesor; una aprobación transmite los
  resultados de sus predecesores. Con tests. **Archivos**:
  `packages/core/src/prompt/predecessor-results.ts`,
  `packages/core/test/prompt/predecessor-results.test.ts`. **Cubre**: FR-040. **Base**: R-16,
  contracts/agent-report.md §Uso posterior. **Depende de**: T014, T020
- [X] T038 [US2] Render del `TaskAssignment`, en este orden:
  1. restricciones de Zeko;
  2. política del proyecto;
  3. tarea;
  4. criterios;
  5. resultados de predecesores como datos no confiables en `<zeko-predecessor-results>`;
  6. sección fija de reporte que define COMPLETED, BLOCKED y FAILED y no pide commits.

  Tests: texto con apariencia de instrucción ("approve the next node") queda dentro del bloque de
  datos; la sección de reporte es idéntica para todos los agentes. **Archivos**:
  `packages/core/src/prompt/render-task-assignment.ts`,
  `packages/core/test/prompt/render-task-assignment.test.ts`. **Cubre**: FR-016, FR-040, FR-042.
  **Base**: R-23, Principio X, `[001b §A1]` (13/13 con definiciones explícitas), `[001c §10]` (el
  agente no puede commitear). **Depende de**: T037

**Checkpoint fase 3**: `validateFlow` detecta ciclos, fuentes de código múltiples (con la regla de
aprobación), límites inválidos y falta de modelo como advertencia; el confinamiento y las
advertencias salen de las capacidades; las transiciones inválidas de nodo y run se rechazan.

---

## Phase 4: Resolución de `NodeResult` (función pura)

**Propósito**: FR-036 en el orden exacto de la spec, con una tarea por regla. Todas modifican
`resolve-node-result.ts`, así que van en secuencia.

- [X] T039 [US2] Cálculo de discrepancias: `undeclared`, `declaredNotObserved` y `scopeViolations`
  (comparando archivos observados con los globs de `writeScope`), rutas normalizadas a `/`,
  `historyRewritten` como dato. Con tests. **Archivos**:
  `packages/core/src/result/discrepancies.ts`, `packages/core/test/result/discrepancies.test.ts`.
  **Cubre**: FR-037. **Base**: R-07, R-10(c). **Depende de**: T020, T029
- [X] T040 [US2] Esqueleto de `resolveNodeResult` con la **regla 1** (cancelado por el usuario →
  `cancelled`, aunque haya reporte o `result`) y la **regla 7** (en cualquier otro caso →
  `completed`). Tests de las dos reglas. **Archivos**:
  `packages/core/src/result/resolve-node-result.ts`,
  `packages/core/test/result/rule-1-cancelled.test.ts`. **Cubre**: FR-036.1, FR-036.7. **Base**:
  R-05, D2. **Depende de**: T039
- [X] T041 [US2] **Regla 2a/2b**: tiempo agotado (`killed{by: timeout}`) y límite de turnos
  (`turn_limit`) → `failed`, sin importar el reporte. Con tests. **Archivos**:
  `packages/core/src/result/resolve-node-result.ts`,
  `packages/core/test/result/rule-2-limits.test.ts`. **Cubre**: FR-032, FR-036.2, US2-11.
  **Base**: R-11, `[001b §A2]`. **Depende de**: T040
- [X] T042 [US2] **Regla 2c/2e**: `agent_error` o `crashed` → `failed` con `PROCESS_ERROR` y sus
  parámetros; `spawn_failed` → `AGENT_UNAVAILABLE` o `AGENT_NOT_AUTHENTICATED`. Con tests.
  **Archivos**: `packages/core/src/result/resolve-node-result.ts`,
  `packages/core/test/result/rule-2-process-error.test.ts`. **Cubre**: FR-036.2, casos límite.
  **Base**: `[001 §3]` (modelo inválido con `subtype: success`). **Depende de**: T041
- [X] T043 [US2] **Regla 2d**: `infra_failure` con los relanzamientos de infraestructura agotados →
  `failed` con `INFRA_FAILURE_EXHAUSTED`. Con tests. **Archivos**:
  `packages/core/src/result/resolve-node-result.ts`,
  `packages/core/test/result/rule-2-infra.test.ts`. **Cubre**: FR-032, FR-036.2. **Base**: R-18,
  `[001c §4]`. **Depende de**: T042
- [X] T044 [US2] **Regla 3**: reporte `absent` o `invalid` después del pedido adicional → `failed`
  con `REPORT_MISSING` o `REPORT_INVALID`; un estado declarado inválido cuenta como ausente. Con
  tests (US2-9). **Archivos**: `packages/core/src/result/resolve-node-result.ts`,
  `packages/core/test/result/rule-3-report.test.ts`. **Cubre**: FR-036.3, FR-038. **Base**:
  `[001b §A2]`. **Depende de**: T043
- [X] T045 [US2] **Regla 4a**: con `reportsDenials` y alguna denegación → `blocked` con
  `ACTION_DENIED`. Tests:
  - `denials` ausente o `[]` no bloquea;
  - las `inferredDenials` **no** activan la regla;
  - `denialCheck` es `applied` o `not_available` según la capacidad.

  **Archivos**: `packages/core/src/result/resolve-node-result.ts`,
  `packages/core/test/result/rule-4a-denials.test.ts`. **Cubre**: FR-023, FR-036.4, US2-8.
  **Base**: `[001 §6]`, T-06 (clarificación 2026-09-24). **Depende de**: T044
- [X] T046 [US2] **Regla 4b**: `scopeViolations` no vacío → `blocked` con `WRITE_OUTSIDE_SCOPE` y
  la lista de archivos, **con cualquier agente**, aunque el agente declare COMPLETED. Tests con
  capacidades de Claude y de Codex. **Archivos**: `packages/core/src/result/resolve-node-result.ts`,
  `packages/core/test/result/rule-4b-scope.test.ts`. **Cubre**: FR-017, FR-036.4, FR-037, US5-3.
  **Base**: T-04 (clarificación 2026-09-24). **Depende de**: T045
- [X] T047 [US2] **Regla 5**: reporte que declara FAILED → `failed`; que declara BLOCKED →
  `blocked`. Con tests. **Archivos**: `packages/core/src/result/resolve-node-result.ts`,
  `packages/core/test/result/rule-5-declared.test.ts`. **Cubre**: FR-036.5. **Base**: `[001b §A1]`.
  **Depende de**: T046
- [X] T048 [US2] **Regla 6**: COMPLETED con `blockers` no vacío → `blocked` con
  `REPORTED_COMPLETED_WITH_BLOCKERS` e `inconsistency`. Con tests (US2-7). **Archivos**:
  `packages/core/src/result/resolve-node-result.ts`,
  `packages/core/test/result/rule-6-inconsistency.test.ts`. **Cubre**: FR-036.6. **Base**:
  `[001b §A]` (manda la spec: "bloqueado", no "fallido"). **Depende de**: T047
- [X] T049 [US2] Matriz de precedencia: casos que cumplen dos o más reglas a la vez (por ejemplo,
  cancelado con timeout, o denegación con reporte FAILED) y verifican que gana la de menor número.
  También: `undeclared`, `declaredNotObserved` e `historyRewritten` nunca cambian el estado; la
  función no recibe el id del agente. **Archivos**:
  `packages/core/test/result/precedence.test.ts`. **Cubre**: FR-016, FR-036, FR-037, SC-005.
  **Base**: R-05. **Depende de**: T048

**Checkpoint fase 4**: cada regla de FR-036 tiene su test verde y la matriz de precedencia
demuestra el orden. Esto cubre SC-005 a nivel unitario.

---

## Phase 5: Agente simulado y fixtures

**Propósito**: poder probar todo sin proveedores reales. Fixtures curados de `spikes/*/samples/`,
un ejecutable `fake-agent` y un adaptador en memoria para los tests del motor.

- [X] T050 [P] [US2] Curar los fixtures: copiar a `packages/adapters/test/fixtures/` los samples
  que usan los tests.
  - Claude: `001/events/*`, `q1-verbose-raw.jsonl`, `q3-error-bad-model.json`, `q7-cancel.json`,
    `q6-perms.json` y `001b/a-schema.json`.
  - Codex: `001c/events/*`, `q4-termination.json`, `q6-structured.json`, `q8-sandbox.json` y
    `q9-cancel.json`.

  Incluye un índice tipado y un `PROVENANCE.md` con el origen de cada archivo. **Archivos**:
  `packages/adapters/test/fixtures/**`, `packages/adapters/test/fixtures/index.ts`,
  `packages/adapters/test/fixtures/PROVENANCE.md`. **Cubre**: Principio XVI. **Base**: R-26.
  **Depende de**: T005
- [X] T051 [P] [US2] Patrones de detección de secretos y datos personales, como función pura: claves
  con prefijo conocido (`sk-…`, `sk-ant-…`), `Authorization: Bearer …`, JWT (`eyJ…`), tokens de
  `auth.json` (`id_token`, `access_token`, `refresh_token`), emails y `account_id`. Vive en
  `contracts` (datos puros, sin dependencias) porque lo usan `storage` (redactor, T088) y `adapters`
  (test de fixtures, T052), que no pueden importar `core`. Tests con positivos y falsos positivos
  comunes. **Archivos**: `packages/contracts/src/redaction-patterns.ts`,
  `packages/contracts/test/redaction-patterns.test.ts`. **Cubre**: NFR-007. **Base**: R-28,
  `[001c §2, §11]`, T008. **Depende de**: T005
- [X] T052 [US2] **Verificar que ningún fixture contiene claves de API ni emails**: un test recorre
  `spikes/*/samples/**` y `packages/adapters/test/fixtures/**` con los patrones de T051 y falla si
  encuentra alguno. Se ejecuta en `pnpm test` y en CI. **Archivos**:
  `packages/adapters/test/fixtures-no-secrets.test.ts`. **Cubre**: NFR-007. **Base**: R-28,
  `[001c §11]` (el harness redactó emails). **Depende de**: T050, T051
- [X] T053 [US2] Ejecutable `fake-agent` (proceso Node real) guiado por un escenario JSON.
  - Modo `native`: emite `NormalizedEvent` JSONL con retardos.
  - Modo `replay`: reproduce líneas crudas de un fixture de Claude o de Codex.
  - Opciones del guion: salir con o sin evento final; código de salida; responder o ignorar un
    `control_request` de interrupt por stdin; escribir archivos en el `cwd` (dentro o fuera del
    alcance); lanzar nietos `cmd.exe → powershell.exe` que escriben una línea por segundo; emitir
    stderr (por ejemplo, la firma del error 267); informar lecturas de uso.

  Incluye tests del parser de escenarios. **Archivos**:
  `packages/adapters/test/fake-agent/main.ts`, `packages/adapters/test/fake-agent/scenario.ts`,
  `packages/adapters/test/fake-agent/scenario.test.ts`. **Cubre**: FR-030, SC-003, SC-005.
  **Base**: R-26, `[001 §7]`, `[001c §9]`. **Depende de**: T015, T050
- [X] T054 [P] [US2] Biblioteca de escenarios:
  - resultados: `done`, `blocked`, `failed`, `no-report`, `invalid-report`,
    `completed-with-blockers`, `denied`;
  - límites y fallos: `hang-until-timeout`, `crash`, `infra-267-exit0`;
  - procesos y uso: `slow-grandchild`, `usage-near-limit`;
  - otros: `writes-outside-scope`, `model-mismatch`, `leaks-secret` (imprime una clave y un email
    sintéticos).

  **Archivos**: `packages/adapters/test/fake-agent/scenarios/*.json`. **Cubre**: FR-036, NFR-007.
  **Base**: R-26. **Depende de**: T053
- [X] T055 [US2] Dobles de prueba en `packages/testing`, sin procesos, para los tests de `core` y de
  `runtime`:
  - `ScriptedAdapter`: implementa `AgentAdapter` con escenarios deterministas y capacidades
    configurables;
  - perfiles de capacidades sintéticos, incluidos los dos de la matriz de adapter.md
    (tipo Claude y tipo Codex), definidos como datos con el tipo de `contracts`;
  - puertos en memoria: `WorkspacePort`, `RunStorePort`, `SlotLeasePort`, `UsageStorePort` y un
    `ClockPort` controlable.

  Con tests propios. Vive en `testing` y no en `adapters`, para que los tests de `core` no dependan
  de un paquete de infraestructura (T008). **Archivos**:
  `packages/testing/src/scripted-adapter.ts`, `packages/testing/src/capability-profiles.ts`,
  `packages/testing/src/in-memory-ports.ts`, `packages/testing/test/scripted-adapter.test.ts`.
  **Cubre**: FR-016. **Base**: Principio XVI, R-26, Principio IV. **Depende de**: T018, T022

**Checkpoint fase 5**: `fake-agent` reproduce los eventos de los spikes; los escenarios cubren cada
regla de FR-036; el test de fixtures demuestra que no hay claves ni emails en ningún sample.

---

## Phase 6: Scheduler y motor de ejecución (probado contra el agente simulado)

**Propósito**: dependencias, paralelismo, concurrencia, omitidos, límites, retención por uso,
aprobación, cancelación, reintentos y modelo explícito. Todo con `ScriptedAdapter` y puertos en
memoria.

- [X] T056 [US2] `nextActions(state)` puro: el nodo de entrada se completa enseguida; un nodo de
  agente queda listo cuando todos sus predecesores terminaron `completed` o `approved`; varios
  listos se lanzan en paralelo. Tests US2-1 y US2-3. **Archivos**:
  `packages/core/src/scheduler/next-actions.ts`,
  `packages/core/test/scheduler/next-actions.test.ts`. **Cubre**: FR-010, FR-026, FR-027.
  **Base**: R-21, plan.md §Flujo paso 6. **Depende de**: T033, T035
- [X] T057 [US2] Límite de concurrencia global: contabilidad de slots a través de `SlotLeasePort`;
  las aprobaciones y la entrada no toman slot; sin sub-límites por agente. Tests con límite 1 y 8.
  **Archivos**: `packages/core/src/scheduler/slots.ts`,
  `packages/core/test/scheduler/slots.test.ts`. **Cubre**: FR-027. **Base**: R-21. **Depende de**:
  T056, T022
- [X] T058 [US2] **Política de reintentos**:
  - `agent_error` y `crashed` consumen `maxRetries`;
  - `turn_limit`, timeout, reporte FAILED/BLOCKED, cancelación y `spawn_failed` no se reintentan;
  - **`infra_failure` (error 267 al crear procesos, en cualquier modo de sandbox) usa un
    presupuesto aparte**: hasta 2 relanzamientos con espera de 2 s y 5 s, **sin consumir
    `maxRetries`**; agotados → `INFRA_FAILURE_EXHAUSTED`.

  Con tests. **Archivos**: `packages/core/src/policy/retry.ts`,
  `packages/core/test/policy/retry.test.ts`. **Cubre**: FR-032, NFR-008. **Base**: R-18, D12,
  `[001c §4]`, clarificación 2026-09-24. **Depende de**: T016
- [X] T059 [US2] Esqueleto de `RunEngine` sobre puertos:
  - crea el run y los NodeRuns, fijando confinamiento, advertencias y **modelo resuelto**;
  - lanza un intento por nodo y aplica `resolveNodeResult`;
  - emite eventos con `run_id`.

  Test: flujo `goal → a → b` con `ScriptedAdapter` y puertos en memoria; `b` empieza solo cuando
  `a` termina. **Archivos**: `packages/core/src/engine/run-engine.ts`,
  `packages/core/test/engine/run-engine.basic.test.ts`. **Cubre**: FR-024, FR-026, FR-028, FR-036,
  FR-063. **Base**: plan.md §Flujo pasos 5–7, R-05. **Depende de**: T031, T032, T038, T049, T055,
  T057
- [X] T060 [US2] **Modelo explícito en el motor**:
  - cada `LaunchSpec` lleva el modelo resuelto (del nodo o del proyecto), también en el pedido de
    reporte y en los reintentos;
  - `MODEL_DEFAULTED` cuando el nodo no tenía modelo;
  - advertencia `MODEL_MISMATCH` cuando el agente informa otro modelo, sin cambiar el estado.

  Tests con `ScriptedAdapter` que registra los `LaunchSpec` recibidos. **Archivos**:
  `packages/core/src/engine/run-engine.ts`, `packages/core/test/engine/model-pinning.test.ts`.
  **Cubre**: FR-011, FR-011a, FR-016. **Base**: R-27, D16, `[001c §1]`. **Depende de**: T059, T030
- [X] T061 [US2] Pedido único de reporte: si el reporte es `absent` o `invalid`, se llama **una**
  vez a `requestReport` sobre el mismo intento y el mismo espacio de trabajo, sin consumir
  reintentos. Si persiste, `REPORT_MISSING`/`REPORT_INVALID`. Tests US2-9. **Archivos**:
  `packages/core/src/engine/run-engine.ts`, `packages/core/test/engine/report-request.test.ts`.
  **Cubre**: FR-038, FR-036.3. **Base**: R-16 (fork solo desde el mismo directorio), `[001c §5]`.
  **Depende de**: T059
- [X] T062 [US2] **Reintentos e infraestructura en el motor**:
  - cada intento pide un espacio de trabajo nuevo desde la misma base y **nunca** hace fork del
    intento anterior;
  - `infra_failure` se relanza con el presupuesto de T058 y queda registrado como intento
    `infra_retry`.

  Tests: `agent_error` y luego éxito; 267 dos veces y luego éxito; 267 tres veces →
  `INFRA_FAILURE_EXHAUSTED`; `maxRetries: 0` con 267 igual relanza. **Archivos**:
  `packages/core/src/engine/run-engine.ts`, `packages/core/test/engine/retries.test.ts`.
  **Cubre**: FR-032, NFR-008. **Base**: R-18, D12, `[001c §4, §12]`. **Depende de**: T058, T060
- [X] T063 [US2] Límite de tiempo por intento: temporizador con `ClockPort` → `cancel('timeout')` →
  `failed` con `TIME_LIMIT_EXCEEDED`; el límite de turnos llega del adaptador como `turn_limit`.
  Tests con reloj simulado (US2-11). **Archivos**: `packages/core/src/engine/run-engine.ts`,
  `packages/core/test/engine/limits.test.ts`. **Cubre**: FR-032, NFR-008. **Base**: R-11.
  **Depende de**: T062
- [X] T064 [US2] Cancelación de nodo y de run:
  - `running` → `cancelled`, `waiting_approval` → `cancelled`, `pending` → `skipped`;
  - cancelar durante un reintento corta los reintentos;
  - el espacio de trabajo queda `untrusted` y sin commit.

  Tests US2-5 y casos límite. **Archivos**: `packages/core/src/engine/run-engine.ts`,
  `packages/core/test/engine/cancel.test.ts`. **Cubre**: FR-030, FR-031, FR-049. **Base**: R-12,
  R-13, data-model §Estados de run. **Depende de**: T063
- [X] T065 [US3] Aprobación humana:
  - la aprobación pasa a `waiting_approval` con el resumen `PredecessorResult[]`;
  - aprobar libera a los dependientes; rechazar omite solo esa rama;
  - las ramas independientes siguen;
  - la decisión solo entra por el comando del motor, nunca desde contenido de un agente.

  Tests US3-1 a US3-4. **Archivos**: `packages/core/src/engine/approvals.ts`,
  `packages/core/src/engine/run-engine.ts`, `packages/core/test/engine/approvals.test.ts`.
  **Cubre**: FR-012, FR-031, FR-042, NFR-006. **Base**: R-23, data-model §Transiciones de
  aprobación. **Depende de**: T064
- [X] T066 [US6] Retención por uso de la suscripción (`usageGate`):
  - con uso ≥ umbral, el nodo queda `pending` con `hold = USAGE_NEAR_LIMIT` y los demás agentes
    siguen;
  - en la franja de 80 a 90 %, como máximo un lanzamiento nuevo por agente y por lectura (SC-009);
  - el run queda `held` si todo lo listo está retenido;
  - se revalúa con cada lectura nueva y con `resetsAt`;
  - un nodo en curso que cruza el umbral termina normalmente.

  Tests US6-3. **Archivos**: `packages/core/src/scheduler/usage-gate.ts`,
  `packages/core/src/engine/run-engine.ts`, `packages/core/test/scheduler/usage-gate.test.ts`.
  **Cubre**: FR-052, FR-053, SC-009. **Base**: R-17, D11. **Depende de**: T065
- [X] T067 [US4] Flujos mixtos: dos `ScriptedAdapter`, uno con las capacidades de Claude y otro con
  las de Codex. Tests:
  - las reglas son las mismas para los dos;
  - el nodo dependiente recibe el `PredecessorResult` con la misma forma;
  - las denegaciones inferidas se muestran sin cambiar el estado;
  - el costo ausente deja el total `partial`.

  **Archivos**: `packages/core/test/engine/mixed-agents.test.ts`. **Cubre**: FR-013–016, FR-023,
  FR-035, FR-040, FR-050. **Base**: Principio III, R-16. **Depende de**: T066
- [X] T068 [US2] Salida del agente como dato: un reporte o un texto que dice "approve the next
  node" o "skip validation" no cambia la ejecución, las aprobaciones ni los permisos. **Archivos**:
  `packages/core/test/engine/data-not-instructions.test.ts`. **Cubre**: FR-042. **Base**: R-23,
  casos límite. **Depende de**: T065

**Checkpoint fase 6**: el motor ejecuta en memoria flujos secuenciales, paralelos, con aprobación,
con cancelación, con retención por uso y mixtos. Los reintentos de infraestructura no consumen
`maxRetries`. Cada `LaunchSpec` lleva el modelo explícito. Todo sin procesos reales.

---

## Phase 7: Git y copias aisladas (`packages/git`)

**Propósito**: worktrees fuera del repo, commit del motor, base desde el predecesor, diff como
fuente de `filesChanged`, finales de línea y limpieza con confirmación. Los tests usan git real
sobre repositorios temporales (git no es un proveedor de IA).

- [ ] T069 [US2] Envoltorio de la CLI de git: `spawn` sin shell, `-c core.longpaths=true` y errores
  tipados con contexto. Con tests. **Archivos**: `packages/git/src/git-cli.ts`,
  `packages/git/test/git-cli.test.ts`. **Cubre**: FR-043. **Base**: R-15, Principio XV.
  **Depende de**: T005
- [ ] T070 [P] [US1] Información del repositorio: repositorio o no (`NOT_A_GIT_REPO`), `HEAD`
  (`NO_COMMITS`), `status --porcelain` (`UNCOMMITTED_CHANGES_EXCLUDED`) y lista de archivos de
  `HEAD` (para `SCOPE_PATH_NOT_FOUND`). Con tests. **Archivos**: `packages/git/src/repo-info.ts`,
  `packages/git/test/repo-info.test.ts`. **Cubre**: FR-002, casos límite. **Base**: plan.md §Flujo
  paso 3. **Depende de**: T069
- [ ] T071 [US2] Crear el worktree de un intento en `%LOCALAPPDATA%\Zeko\wt\<run8>\<nodeKey>`
  (`$XDG_DATA_HOME` en Linux), **nunca** dentro del repo ni bajo `%TEMP%`, con rama
  `zeko/<run8>/<nodeId>` desde un sha dado. Si falla, `WORKSPACE_CREATE_FAILED`. Tests: el repo
  original no cambia y se rechaza una ruta bajo `%TEMP%`. **Archivos**:
  `packages/git/src/worktree.ts`, `packages/git/test/worktree.test.ts`. **Cubre**: FR-043–045,
  SC-004. **Base**: R-15, D9, `[001 §8]`, `[001c §8, §10]`. **Depende de**: T069
- [ ] T072 [US2] Commit del motor: `add -A` y `commit` con identidad Zeko, `core.hooksPath` vacío,
  `--no-verify` y `--allow-empty`; detecta `HISTORY_REWRITTEN`. Tests: sin commit si se canceló. **Archivos**:
  `packages/git/src/engine-commit.ts`, `packages/git/test/engine-commit.test.ts`. **Cubre**:
  FR-046, FR-047, FR-049. **Base**: R-15. **Depende de**: T071
- [ ] T073 [US2] Archivos observados: `diff --name-status -z base..result`, rutas relativas con
  `/`, y marca `eolOnly` calculada con `--ignore-cr-at-eol`. Tests con un repo CRLF y
  `.gitattributes`. **Archivos**: `packages/git/src/observed-files.ts`,
  `packages/git/test/observed-files.test.ts`. **Cubre**: FR-037, FR-046. **Base**: R-07, D4,
  `[001 §8]` (línea LF en archivo CRLF). **Depende de**: T072
- [ ] T074 [P] [US2] Diff por archivo para `node.diff`, paginado. Con tests. **Archivos**:
  `packages/git/src/diff.ts`, `packages/git/test/diff.test.ts`. **Cubre**: FR-046. **Base**:
  contracts/ipc.md `node.diff`. **Depende de**: T072
- [ ] T075 [P] [US8] Limpieza: `worktree remove --force` y `branch -D` de las ramas del run, **solo**
  con confirmación explícita. Tests: sin confirmación no borra nada. **Archivos**:
  `packages/git/src/cleanup.ts`, `packages/git/test/cleanup.test.ts`. **Cubre**: FR-048, FR-049.
  **Base**: R-15. **Depende de**: T071
- [ ] T076 [US2] Implementar `WorkspacePort` con git:
  - worktree por intento; el de un intento con error se descarta al reintentar;
  - confianza guardada fuera del worktree;
  - base = `resultCommit` de la única fuente de `inputSources`.

  Tests unitarios del puerto contra git real en `git`. El test de integración con `RunEngine` y
  `ScriptedAdapter` que escribe archivos vive en `runtime`, el único paquete que puede componer
  `core` con `git`: `b` parte del commit de `a`; linaje a través de una aprobación; un nodo de solo
  lectura no lo transporta. **Archivos**: `packages/git/src/workspace-port.ts`,
  `packages/git/test/workspace-port.test.ts`,
  `packages/runtime/test/workspace-port.integration.test.ts`. **Cubre**: FR-041, FR-043, FR-044,
  US2-12. **Base**: R-15, R-22, T008. **Depende de**: T073, T059, T055
- [ ] T077 [US2] Integración Windows de aislamiento: el hash del árbol de trabajo, `HEAD`, la rama
  actual y `status --porcelain` del repo original son idénticos antes y después de un run con
  varios nodos. Vive en `runtime` porque ejecuta el motor. **Archivos**:
  `packages/runtime/test/isolation.win.test.ts`. **Cubre**: FR-045, SC-004. **Base**: R-26, T008.
  **Depende de**: T076

**Checkpoint fase 7**: con git real y el motor en memoria, un flujo de dos nodos deja commits del
motor en `zeko/<run>/*`, el dependiente parte del predecesor, los archivos observados salen del diff
(con la marca de finales de línea) y el repo original queda idéntico.

---

## Phase 8: Procesos (supervisor del árbol)

**Propósito**: lanzar procesos, seguir su árbol y terminar **solo** ese árbol, identificado por
`(pid, creationTime)`.

- [ ] T078 [US2] Instantánea de la tabla de procesos: en Windows, `Win32_Process` (PID, PPID,
  `CreationDate`) con **una sola consulta por tick** para todos los árboles activos; en Linux,
  `/proc/<pid>/stat`. Tests con datos inyectados. **Archivos**:
  `packages/adapters/src/process/process-table.ts`,
  `packages/adapters/test/process/process-table.test.ts`. **Cubre**: FR-030. **Base**: R-14, U-05.
  **Depende de**: T005
- [ ] T079 [US2] Seguimiento del árbol: cierre transitivo desde la raíz; los descendientes quedan
  registrados aunque muera el padre intermedio (caso `cmd.exe` de `[001 §7]`); incluye procesos de
  otro usuario que descienden del PID lanzado (sandbox `elevated` de Codex). Tests con instantáneas
  sintéticas. **Archivos**: `packages/adapters/src/process/tree-tracker.ts`,
  `packages/adapters/test/process/tree-tracker.test.ts`. **Cubre**: FR-030, FR-062. **Base**: R-14,
  `[001 §7]`, `[001c §9]`. **Depende de**: T078
- [ ] T080 [US2] Lanzamiento con el supervisor: `spawn` sin shell, registro de la raíz
  `(pid, creationTime)`, streams de stdout/stderr por línea, fin del intento en `close` (no en
  `exit`) y tick de seguimiento cada 2 s. Tests con `fake-agent`. **Archivos**:
  `packages/adapters/src/process/supervisor.ts`,
  `packages/adapters/test/process/supervisor.launch.test.ts`. **Cubre**: FR-029, FR-030. **Base**:
  R-14, `[001 §3]`. **Depende de**: T079, T053
- [ ] T081 [US2] Terminación del supervisor:
  - Windows: `taskkill /PID <raíz> /T /F` **solo si** una instantánea confirma que la raíz sigue
    viva con el mismo `creationTime` registrado; si no, se omite (su PID pudo reutilizarse);
    después, cada PID registrado que siga vivo **y** tenga el mismo `creationTime`, de a uno; al
    final, una instantánea confirma que no queda ninguno.
  - Linux: grupo de procesos (`detached` y `kill(-pgid)`), con la misma verificación de la raíz.
  - Nunca `child.kill()` solo.

  Tests, incluido el caso en que la raíz terminó y su PID lo tiene otro proceso: ese proceso y su
  árbol **no** se tocan. **Archivos**: `packages/adapters/src/process/supervisor.ts`,
  `packages/adapters/test/process/supervisor.terminate.test.ts`. **Cubre**: FR-030, NFR-004.
  **Base**: R-14, D8, `[001 §7]`, `[001c §9]`. **Depende de**: T080
- [ ] T082 [US2] **Garantizar que el motor nunca termina procesos por nombre ni por patrón**:
  - un test recorre el código de `packages/**` y `apps/**` y falla si encuentra `taskkill /IM`,
    `Stop-Process -Name`, `pkill`, `killall`, `Get-Process <nombre> | Stop-Process` o un filtro por
    nombre o línea de comandos en la terminación;
  - una regla `no-restricted-syntax` en ESLint bloquea esas llamadas;
  - el único punto que termina procesos es `supervisor.terminate`, y solo recibe
    `(pid, creationTime)` registrados.

  **Archivos**: `packages/adapters/test/process/no-kill-by-name.test.ts`, `eslint.config.js`.
  **Cubre**: FR-030, FR-062. **Base**: D8, R-14, `[001c §9]` (el filtro por nombre mató al propio
  runner). **Depende de**: T081
- [ ] T083 [US2] Adaptador `fake` basado en procesos: lanza `fake-agent` en modo `native` a través
  del supervisor, con capacidades configurables; cancela en dos fases si `orderlyInterrupt`, si no
  mata el árbol. Con tests. **Archivos**: `packages/adapters/src/fake/fake-adapter.ts`,
  `packages/adapters/test/fake/fake-adapter.test.ts`. **Cubre**: FR-016, FR-030. **Base**: R-26.
  **Depende de**: T081, T054
- [ ] T084 [US2] Integración Windows de cancelación:
  - `fake-agent` lanza un nieto que escribe una línea por segundo;
  - después de cancelar, el archivo deja de crecer (dos mediciones con 5 s de diferencia) y ningún
    `(pid, creationTime)` registrado sigue vivo, todo en menos de 10 s;
  - un `powershell Start-Sleep 600` lanzado por el test, ajeno al árbol, **sigue vivo**.

  **Archivos**: `packages/adapters/test/process/cancel.win.test.ts`. **Cubre**: FR-030, NFR-004,
  SC-003. **Base**: D8, quickstart Escenario 4 (variante crítica). **Depende de**: T083
- [ ] T085 [P] [US2] Medición del costo de la instantánea con 8 árboles activos (U-05): falla si el
  tick supera el presupuesto definido para NFR-002. **Archivos**:
  `packages/adapters/test/process/snapshot-cost.win.test.ts`. **Cubre**: NFR-002, NFR-004.
  **Base**: R-14, U-05. **Depende de**: T083

**Checkpoint fase 8**: un proceso lanzado por el motor, con nietos intermedios, se cancela en menos
de 10 s sin huérfanos; un proceso ajeno sobrevive; el test estático prueba que no hay terminación
por nombre ni patrón.

---

## Phase 9: Persistencia (`packages/storage`)

**Propósito**: runs, eventos, historial, leases entre procesos, recuperación como `interrupted` y
redacción antes de toda escritura.

- [ ] T086 [US8] `SqlDriver` (`exec`, `prepare`, `transaction`) con `node:sqlite`: WAL,
  `synchronous=FULL`, `busy_timeout` y `foreign_keys=ON`. Con tests. **Archivos**:
  `packages/storage/src/sql-driver.ts`, `packages/storage/src/node-sqlite-driver.ts`,
  `packages/storage/test/sql-driver.test.ts`. **Cubre**: FR-061, NFR-005. **Base**: R-03, D13.
  **Depende de**: T005
- [ ] T087 [US8] Migración inicial con el esquema de data-model §4 (incluidas las columnas
  `node_runs.model`, que registra el modelo usado y su origen, y `node_runs.inferred_denials`) y un
  runner de migraciones solo hacia adelante. Con tests, incluido uno que guarda y relee el modelo
  de un NodeRun con `source: 'project_default'`. **Archivos**: `packages/storage/src/migrations/001_initial.ts`,
  `packages/storage/src/migrate.ts`, `packages/storage/test/migrate.test.ts`. **Cubre**: FR-060,
  FR-061. **Base**: data-model §4. **Depende de**: T086
- [ ] T088 [US8] **Redactor**:
  - aplica los patrones de T051 (importados de `contracts`) más un registro de **valores exactos**
    de credenciales inyectadas, que el `runtime` alimenta con los `sensitiveValues` que declara
    cada ejecución de un adaptador (T018, T121); `storage` nunca importa `adapters`;
  - reemplaza con marcadores tipados (`[REDACTED:api_key]`, `[REDACTED:email]`);
  - produce un tipo `Redacted<T>` que los repositorios exigen, así ninguna escritura lo puede
    saltear.

  Con tests. **Archivos**: `packages/storage/src/redactor.ts`,
  `packages/storage/test/redactor.test.ts`. **Cubre**: NFR-007, FR-065. **Base**: R-28, D17,
  clarificación 2026-09-24. **Depende de**: T051
- [ ] T089 [US8] Repositorios de runs, NodeRuns y attempts (implementan `RunStorePort`), con tests.
  **Archivos**: `packages/storage/src/repos/runs.ts`, `packages/storage/src/repos/node-runs.ts`,
  `packages/storage/src/repos/attempts.ts`, `packages/storage/test/repos/runs.test.ts`. **Cubre**:
  FR-011a, FR-023, FR-060, FR-063. **Base**: data-model §2 y §4. **Depende de**: T087, T088, T022
- [ ] T090 [US8] Repositorio de eventos:
  - escritura por lotes en transacciones de 50 ms como máximo (NFR-005);
  - solo acepta payloads `Redacted`;
  - escribe también el log crudo en `%LOCALAPPDATA%\Zeko\logs\<run>\<node>-<attempt>.jsonl`,
    redactado;
  - consulta paginada por nodo (`afterSeq`, `limit`) que devuelve `NormalizedEvent[]` y `nextSeq`,
    para `node.output.page`.

  Con tests. **Archivos**: `packages/storage/src/repos/events.ts`,
  `packages/storage/src/raw-log.ts`, `packages/storage/test/repos/events.test.ts`. **Cubre**:
  FR-029, FR-063, NFR-005, NFR-007. **Base**: R-20, R-25, R-28. **Depende de**: T089
- [ ] T091 [P] [US8] Repositorios de workspaces, aprobaciones y `process_tree`, con tests.
  **Archivos**: `packages/storage/src/repos/workspaces.ts`,
  `packages/storage/src/repos/approvals.ts`, `packages/storage/src/repos/process-tree.ts`,
  `packages/storage/test/repos/workspaces.test.ts`. **Cubre**: FR-012, FR-048, FR-049, FR-062.
  **Base**: data-model §4. **Depende de**: T089
- [ ] T092 [P] [US6] Repositorio `agent_usage` (implementa `UsageStorePort`), con tests.
  **Archivos**: `packages/storage/src/repos/agent-usage.ts`,
  `packages/storage/test/repos/agent-usage.test.ts`. **Cubre**: FR-052. **Base**: R-17.
  **Depende de**: T089
- [ ] T093 [US2] Leases de slots entre procesos (implementa `SlotLeasePort`): `BEGIN IMMEDIATE`,
  heartbeat cada 5 s y vencimiento si el host no está vivo. Test con dos conexiones a la misma base
  que respetan el límite (dos runs a la vez, caso límite). **Archivos**:
  `packages/storage/src/leases.ts`, `packages/storage/test/leases.test.ts`. **Cubre**: FR-027.
  **Base**: R-21, D13. **Depende de**: T087
- [ ] T094 [US8] Recuperación al arrancar, orquestada en `runtime` (el único paquete que puede usar
  a la vez `storage` y el supervisor de `adapters`):
  - `storage` aporta las consultas y actualizaciones: runs `running` con host muerto, sus NodeRuns
    no terminales y sus filas de `process_tree`;
  - los runs pasan a `interrupted`, y sus nodos no terminales a `interrupted` o `skipped`;
  - el supervisor termina **solo** los PID vivos con el mismo `creationTime` registrado;
  - los worktrees quedan `untrusted`.

  Con tests. **Archivos**: `packages/runtime/src/recovery.ts`,
  `packages/runtime/test/recovery.test.ts`, `packages/storage/src/repos/runs.ts`,
  `packages/storage/src/repos/process-tree.ts`. **Cubre**: FR-049, FR-061, FR-062. **Base**: R-20,
  D8, T008. **Depende de**: T091, T081
- [ ] T095 [US8] **Verificar que ningún evento persistido contiene claves de API ni emails**: el
  motor corre el escenario `leaks-secret` (clave sintética, bearer, JWT y email en texto, stderr,
  `tool_result` y mensaje de error) con una clave inyectada registrada; después se escanea la tabla
  `events`, `node_runs`, `attempts` y los logs crudos con los patrones de T051 y con el valor
  exacto. No debe aparecer nada; sí los marcadores. Vive en `runtime` porque compone el motor, el
  adaptador `fake` y `storage`. **Archivos**:
  `packages/runtime/test/persisted-no-secrets.test.ts`. **Cubre**: NFR-007, FR-065. **Base**:
  R-28, T008. **Depende de**: T090, T083
- [ ] T096 [US8] Durabilidad: un proceso hijo escribe eventos, se lo mata a mitad de camino y, al
  reabrir, todos los eventos confirmados están. **Archivos**:
  `packages/storage/test/durability.test.ts`. **Cubre**: NFR-005. **Base**: R-20. **Depende de**:
  T090

**Checkpoint fase 9**: el historial sobrevive a un kill del host; un run con host muerto aparece
como `interrupted` al reabrir, sin procesos vivos; dos procesos respetan un único límite de
concurrencia; ningún dato persistido contiene claves ni emails.

---

## Phase 10: Runtime y CLI (corte vertical)

**Propósito**: componer el motor una sola vez y ejecutarlo desde la CLI. Al cerrar esta fase, la
CLI ejecuta un flujo de dos nodos con el agente simulado, **antes de cualquier tarea de UI**.

- [ ] T097 [US7] Rutas por plataforma: `%LOCALAPPDATA%\Zeko\{zeko.db, wt, logs}` en Windows y XDG
  en Linux, con tests. **Archivos**: `packages/runtime/src/paths.ts`,
  `packages/runtime/test/paths.test.ts`. **Cubre**: FR-064. **Base**: R-03, R-15. **Depende de**:
  T005
- [ ] T098 [US1] Archivos de flujo:
  - cargar YAML y mapear errores de zod a línea y columna;
  - guardar en forma canónica, conservando comentarios (U-09);
  - listar, crear y borrar con confirmación;
  - conflicto `FILE_CHANGED_ON_DISK{currentHash}`, y "Conservar mi versión" como guardado con
    `expectedHash = currentHash`.

  Tests: ida y vuelta idéntica (SC-007), archivo inválido no se modifica, comentarios
  conservados. **Archivos**: `packages/runtime/src/flow-files.ts`,
  `packages/runtime/test/flow-files.test.ts`. **Cubre**: FR-003, FR-004, FR-054–058, SC-007.
  **Base**: R-04, contracts/flow-file.md, clarificación 2026-09-24. **Depende de**: T011, T097
- [ ] T099 [P] [US1] Carga de `.zeko/config.yaml` con defaults (incluido `defaultModels`) y
  escritura solo cuando el usuario cambia un valor. Con tests. **Archivos**:
  `packages/runtime/src/project-config-file.ts`, `packages/runtime/test/project-config-file.test.ts`.
  **Cubre**: FR-011a, FR-027, FR-053. **Base**: data-model §ProjectConfig. **Depende de**: T012,
  T097
- [ ] T100 [US7] Verificación previa: `detect()` de cada agente usado y forma de autenticación por
  nodo (sin email). Si falta algo, no se crea el run. Tests con disponibilidades simuladas.
  **Archivos**: `packages/runtime/src/preflight.ts`, `packages/runtime/test/preflight.test.ts`.
  **Cubre**: FR-025, FR-065, NFR-007. **Base**: R-19. **Depende de**: T018, T083
- [ ] T101 [US7] `createZekoRuntime()`: compone `core`, el registro de adaptadores (inicialmente
  `fake`), `git` y `storage`, y corre la recuperación al arrancar. Expone **una función por cada
  método IPC** de contracts/ipc.md, que la CLI y el engine host usan tal cual:
  - `project.open` → `openProject`;
  - `flow.list`, `flow.load`, `flow.create`, `flow.save` y `flow.delete` → `listFlows`,
    `loadFlow`, `createFlow`, `saveFlow` y `deleteFlow` (sobre T098);
  - `flow.validate` → `validateFlow` (diagnósticos y `NodeView[]`); `flow.validateEdge` →
    `validateEdge`;
  - `agents.status` → `agentsStatus` (`detect()` y `readUsage()` de cada adaptador);
  - `run.preflight`, `run.start`, `run.cancel`, `node.cancel` y `approval.decide` → `preflight`,
    `startRun`, `cancelRun`, `cancelNode` y `decideApproval`;
  - `run.list`, `run.get`, `node.output.page` y `node.diff` → `listRuns`, `getRun`,
    `nodeOutputPage` (sobre la consulta paginada de T090) y `nodeDiff`;
  - `workspaces.delete` → `deleteWorkspaces`; `settings.get` / `settings.set` → `getSettings` /
    `setSettings` (sobre T099).

  Al lanzar cada ejecución, registra sus `sensitiveValues` en el redactor de `storage` antes de
  persistir cualquier evento (T088). Además, `subscribe(listener)` entrega los eventos de ipc.md: `run.started`, `node.state`,
  `node.output`, `node.result`, `approval.requested`, `agent.usage`, `run.held`, `run.resumed`,
  `run.finished`, `runs.recovered` y `engine.error`. Un test de exhaustividad falla si algún método
  o evento de `IpcRequest` / `IpcEvent` (T023) no tiene su función. Tests con el adaptador `fake`.
  **Archivos**: `packages/runtime/src/create-runtime.ts`, `packages/runtime/src/adapter-registry.ts`,
  `packages/runtime/test/create-runtime.test.ts`,
  `packages/runtime/test/ipc-exhaustiveness.test.ts`. **Cubre**: FR-001–004, FR-007, FR-009,
  FR-024, FR-025, FR-029, FR-052, FR-059, FR-062, SC-008. **Base**: R-01, D1, contracts/ipc.md.
  **Depende de**: T023, T076, T089, T090, T093, T094, T098, T099, T100
- [ ] T102 [US7] `zeko validate`: errores con archivo, línea, columna y nodo; código 2 si hay
  errores. Con tests. **Archivos**: `apps/cli/src/commands/validate.ts`,
  `apps/cli/test/validate.test.ts`. **Cubre**: FR-009, FR-057, FR-059. **Base**: contracts/cli.md.
  **Depende de**: T101, T025
- [ ] T103 [US7] `zeko run`:
  - líneas de estado `[hh:mm:ss] <nodeId> <Status> <reason>`;
  - `--json` como NDJSON;
  - resumen por nodo con costo (`n/a`, `~`) y total `(partial)` / `(estimated)`;
  - códigos de salida 0, 1, 2, 3 y 5.

  Tests con el adaptador `fake`. **Archivos**: `apps/cli/src/commands/run.ts`,
  `apps/cli/src/output/summary.ts`, `apps/cli/test/run.test.ts`. **Cubre**: FR-050, FR-051,
  FR-059, US7-1, US7-2. **Base**: contracts/cli.md. **Depende de**: T102
- [ ] T104 [US7] Aprobaciones en la TTY (`[a]pprove / [r]eject`) mientras otras ramas siguen.
  Sin TTY, `APPROVAL_REQUIRES_TTY` y código 3 **antes** de iniciar; nunca decide sola. Con tests.
  **Archivos**: `apps/cli/src/tty/approval-prompt.ts`, `apps/cli/test/approvals.test.ts`.
  **Cubre**: FR-012, FR-059, NFR-006, US7-3. **Base**: contracts/cli.md punto 4. **Depende de**:
  T103
- [ ] T105 [US7] Ctrl+C: el primero cancela el run; el segundo, dentro de 3 s, fuerza la
  terminación de los árboles. En los dos casos espera la confirmación del supervisor y sale con 4.
  Con tests. **Archivos**: `apps/cli/src/signals.ts`, `apps/cli/test/signals.test.ts`. **Cubre**:
  FR-030, NFR-004. **Base**: contracts/cli.md punto 7. **Depende de**: T103
- [ ] T106 [P] [US8] `zeko runs list` y `zeko runs show` (con los `(pid, creationTime)` registrados),
  con tests. **Archivos**: `apps/cli/src/commands/runs.ts`, `apps/cli/test/runs.test.ts`.
  **Cubre**: FR-060, FR-061. **Base**: contracts/cli.md, quickstart §Verificación de procesos.
  **Depende de**: T103
- [ ] T107 [P] [US8] `zeko workspaces delete`: con `--yes` o confirmación por TTY; sin TTY ni
  `--yes`, no borra nada y sale con 64. Con tests. **Archivos**:
  `apps/cli/src/commands/workspaces.ts`, `apps/cli/test/workspaces.test.ts`. **Cubre**: FR-048.
  **Base**: contracts/cli.md. **Depende de**: T103
- [ ] T108 [P] [US7] `zeko agents check`, con tests. **Archivos**: `apps/cli/src/commands/agents.ts`,
  `apps/cli/test/agents.test.ts`. **Cubre**: FR-025, FR-065. **Base**: contracts/cli.md.
  **Depende de**: T103
- [ ] T109 [US7] **Corte vertical E2E**: repositorio git temporal, flujo `goal → a → b` con el
  agente `fake` (procesos reales de `fake-agent`) y `zeko run` desde la CLI. Verifica:
  - `b` parte del commit de `a`;
  - estados y motivos por nodo;
  - repo original intacto;
  - run guardado en el historial;
  - código de salida 0.

  **Archivos**: `apps/cli/test/two-node-flow.e2e.test.ts`. **Cubre**: FR-026, FR-041, FR-045,
  FR-059, FR-060, SC-004. **Base**: plan.md §Orden sugerido paso 4. **Depende de**: T103
- [ ] T110 [US7] Equivalencia CLI/escritorio: el mismo flujo contra el agente `fake` con `origin`
  `cli` y `desktop` produce los mismos `NodeResult` finales. **Archivos**:
  `packages/runtime/test/sc-008-equivalence.test.ts`. **Cubre**: SC-008. **Base**:
  contracts/cli.md §Equivalencia. **Depende de**: T109

**Checkpoint fase 10 (corte vertical)**: `zeko run` ejecuta un flujo de dos nodos con el agente
simulado, con copias aisladas, commits del motor, historial en SQLite, cancelación con Ctrl+C y
aprobaciones por TTY. Nada de UI todavía.

---

## Phase 11: Adaptador de Claude Code

**Propósito**: traducir `LaunchSpec` a los flags verificados en 001/001b. Se prueba contra
`fake-agent` en modo `replay` con los fixtures de Claude.

- [ ] T111 [REAL] Ejecutar el mini-spike 001d para U-02 (reglas de ruta), U-03 (verificación de
  autenticación sin costo), U-04 (cierre de stdin después de `result`) y U-07 (`CLAUDE.md` con
  `--restricted`), y actualizar research §U. Es investigación: no crea código de producto. No
  bloquea T112–T118, que tienen comportamiento por defecto definido. **Archivos**:
  `spikes/001d-claude-gaps/FINDINGS.md`, `spikes/001d-claude-gaps/samples/**`,
  `specs/001-agent-flow-canvas/research.md`. **Cubre**: FR-017, FR-025. **Base**: plan.md §Orden
  sugerido paso 1, U-02, U-03, U-04, U-07. **Depende de**: —
- [ ] T112 [US2] Constructor de argumentos de Claude:
  - base: `-p --output-format stream-json --verbose --input-format stream-json --strict-mcp-config
    --restricted --permission-mode acceptEdits`;
  - **`--model <modelo resuelto>` siempre**;
  - `--json-schema`;
  - `--max-turns <n + 2>`;
  - `--tools` / `--allowedTools` según terminal, alcance y plataforma (`PowerShell(...)` en Windows,
    `Bash(...)` en Linux).

  Tests de snapshot por configuración; un test prohíbe `--dangerously-skip-permissions`,
  `--disallowedTools StructuredOutput` y `dontAsk`. **Archivos**:
  `packages/adapters/src/claude-code/args.ts`, `packages/adapters/test/claude-code/args.test.ts`.
  **Cubre**: FR-011a, FR-017–019, FR-032. **Base**: R-08, R-10, R-11, D5, `[001 §1, §6]`,
  `[001b §A2, §B1]`. **Depende de**: T018, T019, T109
- [ ] T113 [US2] Parser de stream-json a `NormalizedEvent` contra los fixtures de 001:
  - los `assistant` que comparten `message.id` se tratan como bloques sueltos; el thinking se
    descarta; `parent_tool_use_id` se marca como subagente;
  - `permission_denied` se deduplica por `tool_use_id`;
  - `rate_limit_event` → `subscription_usage` (máximo de las ventanas; se descartan lecturas con
    `resetsAt` vencido);
  - `system/init` → `session_started` con modelo, y `model_mismatch` si difiere del pedido.

  Con tests. **Archivos**: `packages/adapters/src/claude-code/parser.ts`,
  `packages/adapters/test/claude-code/parser.test.ts`. **Cubre**: FR-023, FR-029, FR-052, FR-063.
  **Base**: R-08, R-17, R-27, `[001 §2]`. **Depende de**: T112, T050
- [ ] T114 [US2] `ProcessOutcome` y reporte de Claude:
  - se decide por `is_error`, **nunca** por `subtype`;
  - `error_max_turns` → `turn_limit`;
  - `close` sin `result` → `killed` o `crashed`;
  - código de stderr `[claude-code:…]`;
  - costo con base `list_price_estimate`;
  - reporte desde `structured_output` con zod, ausente si falta; nunca se extrae JSON del texto.

  Tests con `q3-error-bad-model`, `result.success`, `q7-cancel` y los casos de `a-schema`.
  **Archivos**: `packages/adapters/src/claude-code/outcome.ts`,
  `packages/adapters/test/claude-code/outcome.test.ts`. **Cubre**: FR-033, FR-036, FR-050, FR-051.
  **Base**: R-09, R-17, `[001 §3]`, `[001b §A2]`. **Depende de**: T113
- [ ] T115 [US2] `launch` y `requestReport` de Claude:
  - ruta del binario inyectable por configuración del adaptador; sin inyección se resuelve
    `claude` desde el `PATH`, salvo con `ZEKO_TEST=1`, donde falla con un error tipado (T003). Un
    test verifica ese bloqueo;
  - `claude.exe` a través del supervisor, con el prompt como mensaje `user` stream-json por stdin;
  - stdin se cierra al recibir `result`;
  - `requestReport` con `--resume <session> --fork-session`, el mismo `cwd`, el mismo modelo y el
    mismo toolset.

  Tests contra `fake-agent` en modo `replay`. **Archivos**:
  `packages/adapters/src/claude-code/adapter.ts`,
  `packages/adapters/test/claude-code/adapter.launch.test.ts`. **Cubre**: FR-029, FR-038.
  **Base**: R-08, R-16, `[001 §4]`. **Depende de**: T114, T081
- [ ] T116 [US2] Cancelación en dos fases de Claude: `control_request interrupt`, espera de hasta
  5 s y después terminación del árbol. Tests con `fake-agent` que responde como en `q7-cancel` y
  con uno que ignora el interrupt. **Archivos**: `packages/adapters/src/claude-code/adapter.ts`,
  `packages/adapters/test/claude-code/cancel.test.ts`. **Cubre**: FR-030, NFR-004. **Base**: R-12,
  D6, `[001 §7]`. **Depende de**: T115
- [ ] T117 [US2] `detect()` de Claude: instalación con `claude --version`. Autenticación "no
  verificada" (`auth.verified = false`) mientras U-03 no encuentre un chequeo sin costo; si T111 lo
  encuentra, se usa ese chequeo y un resultado negativo bloquea el run. `AgentAvailability` sin datos
  personales. Tests con un binario simulado inyectado (T115). **Archivos**:
  `packages/adapters/src/claude-code/detect.ts`, `packages/adapters/test/claude-code/detect.test.ts`.
  **Cubre**: FR-025. **Base**: R-19, T-07 (clarificación 2026-09-24).
  **Depende de**: T115
- [ ] T118 [US2] Registrar el adaptador de Claude en el runtime. Test de extremo a extremo: `zeko run`
  con `fake-agent` en modo `replay` del dialecto de Claude, cubriendo un nodo completado, uno con
  denegaciones (`ACTION_DENIED`) y uno con escritura fuera de alcance (`WRITE_OUTSIDE_SCOPE`).
  **Archivos**: `packages/runtime/src/adapter-registry.ts`,
  `apps/cli/test/claude-dialect.e2e.test.ts`. **Cubre**: FR-013, FR-036.4, US2-8, US5-3. **Base**:
  D5. **Depende de**: T116, T117, T109
- [ ] T119 [REAL] [US2] Prueba de humo con Claude real desde la CLI: un nodo `goal → a` del
  quickstart Escenario 1. Verifica el modelo pasado explícito, el reporte válido y el repo original
  intacto. **Archivos**: `specs/001-agent-flow-canvas/evidence/t119-claude-smoke.md`. **Cubre**:
  FR-011a, FR-026, SC-004. **Base**: quickstart Escenario 1. **Depende de**: T118

**Checkpoint fase 11**: el adaptador de Claude pasa todos sus tests contra los fixtures de 001/001b
sin llamar al proveedor; `zeko run` funciona con el dialecto de Claude; la prueba de humo real
(manual) confirma el camino feliz.

---

## Phase 12: Adaptador de Codex

**Propósito**: traducir `LaunchSpec` a los flags verificados en 001c. Se prueba contra `fake-agent`
en modo `replay` con los fixtures de Codex.

- [ ] T120 [US4] Resolver el binario nativo `codex.exe` bajo
  `@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/`, **nunca** el shim `codex.cmd`. Si
  solo se encuentra el shim, falla la verificación previa. La ruta también se puede inyectar por
  configuración; con `ZEKO_TEST=1` solo se acepta la inyectada y la resolución automática falla con
  un error tipado (T003). Tests con un árbol de directorios simulado y del bloqueo en modo test.
  **Archivos**: `packages/adapters/src/codex/binary.ts`,
  `packages/adapters/test/codex/binary.test.ts`. **Cubre**: FR-030, FR-065. **Base**: R-13, D7,
  `[001c §9]` (matar el shim no cancela). **Depende de**: T005, T109
- [ ] T121 [US4] Entorno del proceso de Codex: quita `CODEX_API_KEY`, `OPENAI_API_KEY` y
  `CODEX_HOME` heredados. Con clave de API, inyecta `CODEX_API_KEY` solo en ese proceso y declara
  el valor en `AgentExecution.sensitiveValues` (T018). El `runtime` lo registra en el redactor
  (T088): el adaptador no importa `storage`. Con tests. **Archivos**: `packages/adapters/src/codex/env.ts`,
  `packages/adapters/test/codex/env.test.ts`. **Cubre**: FR-065, NFR-007. **Base**: R-13, R-19,
  R-28, `[001c §2, §10]`. **Depende de**: T018, T109
- [ ] T122 [US4] Constructor de argumentos de Codex:
  - `exec --json --ignore-user-config --ignore-rules`;
  - **`-m <modelo resuelto> -c model_reasoning_effort="<esfuerzo>"` siempre**;
  - `-c windows.sandbox="elevated|unelevated"`, `-s workspace-write`, `exclude_tmpdir_env_var` y
    `exclude_slash_tmp`;
  - `--output-schema <archivo>`;
  - los `--disable` de conectores y herramientas, y `web_search="disabled"`;
  - `-` para el prompt por stdin.

  Tests de snapshot; un test prohíbe `danger-full-access`, `exec resume` y `approval_policy`.
  **Archivos**: `packages/adapters/src/codex/args.ts`, `packages/adapters/test/codex/args.test.ts`.
  **Cubre**: FR-011a, FR-017, FR-019, FR-066. **Base**: R-13, R-27, D7, `[001c §1, §4, §7, §8]`.
  **Depende de**: T018, T019, T109
- [ ] T123 [US4] Parser de `exec --json` a `NormalizedEvent` según la tabla de R-13, contra
  `001c/samples/events/*`: `thread.started`, `agent_message`, ítems `command_execution`,
  `file_change`, `mcp_tool_call` y `web_search` correlacionados por `item.id`, `reasoning` y
  `error` como `raw`, y `turn.completed.usage`. Con tests. **Archivos**:
  `packages/adapters/src/codex/parser.ts`, `packages/adapters/test/codex/parser.test.ts`.
  **Cubre**: FR-029, FR-050, FR-063. **Base**: R-13, `[001c §3]`. **Depende de**: T122, T050
- [ ] T124 [US4] Lectura del rollout por `thread_id` en `$CODEX_HOME/sessions/…`:
  `turn_context.model` (para `model_mismatch`), `token_count.rate_limits` (ventanas primaria y
  secundaria), `task_complete.duration_ms` y rechazos. Tests con un rollout fixture. **Archivos**:
  `packages/adapters/src/codex/rollout.ts`, `packages/adapters/test/codex/rollout.test.ts`.
  **Cubre**: FR-011a, FR-052. **Base**: R-13, R-17, `[001c §3, §11]`. **Depende de**: T123
- [ ] T125 [US4] **Firmas de fallo de Codex** (política de infraestructura). Se revisan stderr y el
  rollout **antes** del código de salida:
  - `failed: 267` / `os error 267` en sus tres formas (`CreateProcessWithLogonW`,
    `CreateProcessAsUserW`, `unified exec`) → `infra_failure{process_create}`, **en cualquier modo de
    sandbox y aunque el turno termine con exit 0**;
  - `thread-store conflict … active writer` → `infra_failure{session_lock}`;
  - `Rejected(`, `blocked by policy`, `patch rejected` y "Acceso denegado" / "Access is denied" →
    `inferred_denial`;
  - 267 se clasifica antes que `Rejected(`.

  Con tests. **Archivos**: `packages/adapters/src/codex/signatures.ts`,
  `packages/adapters/test/codex/signatures.test.ts`. **Cubre**: FR-023, FR-032, NFR-008.
  **Base**: R-13, R-18, D12, `[001c §3, §4, §8, §12]`. **Depende de**: T123
- [ ] T126 [US4] `ProcessOutcome` y reporte de Codex:
  - `exited` = exit 0 + `turn.completed` + ninguna firma de infraestructura;
  - `agent_error` = `turn.failed` o exit ≠ 0 sin eventos;
  - `killed`, `crashed` y `spawn_failed`;
  - reporte = último `agent_message` final validado con zod.

  Tests con `q4-termination` y `q6-structured`. **Archivos**:
  `packages/adapters/src/codex/outcome.ts`, `packages/adapters/test/codex/outcome.test.ts`.
  **Cubre**: FR-033, FR-036. **Base**: R-13, `[001c §4, §6]`. **Depende de**: T125
- [ ] T127 [US4] Archivo de schema por intento: escribe el JSON Schema de T013 fuera del worktree y
  verifica la forma strict antes de lanzar. Con tests. **Archivos**:
  `packages/adapters/src/codex/schema-file.ts`, `packages/adapters/test/codex/schema-file.test.ts`.
  **Cubre**: FR-033, FR-034. **Base**: R-06, `[001c §6]` (sin strict → `turn.failed`).
  **Depende de**: T013, T109
- [ ] T128 [US4] `launch`, `requestReport` y `cancel` de Codex:
  - `launch` a través del supervisor, con el prompt por stdin y stdin cerrado;
  - `requestReport` con `exec fork <thread_id>` desde el **mismo `cwd`**, con el sandbox como
    `-c sandbox_mode="…"` porque fork **no acepta `-s`** `[001c §5]`; los flags de fork no
    verificados (U-14) quedan detrás de una opción, con la alternativa de un lanzamiento nuevo en el
    mismo worktree que solo pide el reporte;
  - `cancel` con `taskkill /T /F` del `codex.exe`, sin fase 1 y sin esperar evento final.

  Tests contra `fake-agent` en modo `replay` del dialecto de Codex, incluido exit 0 con 267.
  **Archivos**: `packages/adapters/src/codex/adapter.ts`,
  `packages/adapters/test/codex/adapter.test.ts`. **Cubre**: FR-030, FR-038, NFR-004. **Base**:
  R-13, R-16, `[001c §5, §9]`. **Depende de**: T120, T121, T124, T126, T127, T081
- [ ] T129 [US4] `detect()` y `readUsage()` de Codex:
  - `codex --version` y `codex login status` por código de salida, con el entorno limpio, sobre el
    binario resuelto por T120 (inyectado en los tests);
  - detecta el setup del sandbox `elevated`;
  - clave de API marcada como no verificada; sin email;
  - `readUsage()` devuelve la última lectura del rollout, marcada `live: false`.

  Con tests. **Archivos**: `packages/adapters/src/codex/detect.ts`,
  `packages/adapters/test/codex/detect.test.ts`. **Cubre**: FR-025, FR-052, FR-065, NFR-007.
  **Base**: R-13, R-19, `[001c §2, §11]`. **Depende de**: T120, T121, T124
- [ ] T130 [US4] Registrar el adaptador de Codex en el runtime. Test de extremo a extremo con un
  flujo mixto por la CLI: dialecto Claude → aprobación → dialecto Codex. Verifica:
  - el nodo de Codex parte del commit del primero;
  - las denegaciones inferidas se muestran sin cambiar el estado;
  - el costo es `n/a` y el total `partial`;
  - un 267 con exit 0 se relanza sin consumir `maxRetries`.

  **Archivos**: `packages/runtime/src/adapter-registry.ts`, `apps/cli/test/mixed-flow.e2e.test.ts`.
  **Cubre**: FR-013–016, FR-023, FR-032, FR-041, FR-050, US4-1, US4-2. **Base**: D7, D12.
  **Depende de**: T128, T129, T118
- [ ] T131 [REAL] [US4] Prueba de humo con Codex real desde la CLI: un nodo de solo lectura.
  Verifica el modelo y el esfuerzo explícitos (en el rollout), el reporte válido, la ausencia de
  email en el historial y el repo original intacto. Además cierra U-14: ejecuta un `exec fork` con
  `--json`, `--output-schema`, `--ignore-user-config` e `--ignore-rules`, registra cuáles acepta y
  fija la opción de T128 (fork o lanzamiento nuevo). **Archivos**:
  `specs/001-agent-flow-canvas/evidence/t131-codex-smoke.md`, `specs/001-agent-flow-canvas/research.md`.
  **Cubre**: FR-011a, FR-038, FR-065, NFR-007. **Base**: quickstart Escenario 6 (parcial), U-14.
  **Depende de**: T130

**Checkpoint fase 12**: el adaptador de Codex pasa todos sus tests contra los fixtures de 001c; el
flujo mixto funciona por la CLI; el 267 se trata como falla de infraestructura; el modelo y el
esfuerzo van siempre explícitos.

---

## Phase 13: Aplicación de escritorio (proceso del motor e IPC)

**Propósito**: alojar el mismo runtime en un `utilityProcess` y comunicarlo con la UI por
MessagePort, con validación zod en los dos extremos.

- [ ] T132 [US1] Proceso principal: ventanas, `dialog.openFolder`, `app.quit`, `engine.restart`,
  `MessageChannelMain` (un puerto al engine host y otro al renderer), y `before-quit` con runs
  activos → `shutdown` del motor (nodos `interrupted`). **Archivos**:
  `apps/desktop/src/main/index.ts`, `apps/desktop/src/main/engine-host-lifecycle.ts`. **Cubre**:
  FR-001, FR-062. **Base**: R-01, R-20, D1. **Depende de**: T007, T109
- [ ] T133 [US1] Engine host (`utilityProcess`): crea el runtime, valida cada `IpcRequest` con zod,
  despacha y emite eventos. `node.state` sale al instante y `node.output` se agrupa cada 50 ms como
  máximo. **Archivos**: `apps/desktop/src/engine-host/index.ts`,
  `apps/desktop/src/engine-host/dispatch.ts`, `apps/desktop/src/engine-host/output-batcher.ts`,
  `apps/desktop/test/engine-host/output-batcher.test.ts`. **Cubre**: FR-028, FR-029, NFR-002,
  NFR-003. **Base**: R-01, R-25. **Depende de**: T132, T101, T023
- [ ] T134 [US1] Preload: expone solo `zeko.request` y `zeko.onEvent` con `contextBridge`, sin
  acceso a Node. **Archivos**: `apps/desktop/src/preload/index.ts`. **Cubre**: —. **Base**:
  contracts/ipc.md §Transporte, Principio IV. **Depende de**: T132
- [ ] T135 [US1] Tests de contrato IPC: los dos extremos validan; un mensaje inválido se descarta y
  produce `engine.error`; cada método de contracts/ipc.md responde con su forma. **Archivos**:
  `apps/desktop/test/ipc-contract.test.ts`. **Cubre**: FR-063. **Base**: contracts/ipc.md.
  **Depende de**: T133, T134
- [ ] T136 [P] [US1] Watcher de `.zeko/flows`, que emite `flow.fileChanged`. Con tests. **Archivos**:
  `apps/desktop/src/engine-host/flow-watcher.ts`, `apps/desktop/test/engine-host/flow-watcher.test.ts`.
  **Cubre**: FR-056, casos límite. **Base**: contracts/ipc.md. **Depende de**: T133
- [ ] T137 [US8] Empaquetado y compuerta U-01: configuración de electron-builder para Windows x64 y
  test de humo que abre la base con `node:sqlite` desde el engine host **empaquetado**. Si falla, se
  registra la alternativa `better-sqlite3` en Complexity Tracking. **Archivos**:
  `apps/desktop/electron-builder.yml`, `apps/desktop/test/packaged-sqlite.win.test.ts`. **Cubre**:
  FR-061, NFR-005. **Base**: R-03, U-01, D13. **Depende de**: T133

**Checkpoint fase 13**: la app de escritorio levanta el engine host, que responde por IPC con el
mismo runtime que la CLI. Un mensaje inválido no rompe nada. `node:sqlite` funciona empaquetado.

---

## Phase 14: UI (renderer, sin reglas de negocio)

**Propósito**: canvas de edición, validación visual, estados en vivo, salida por nodo, aprobación,
confinamiento y capacidades, costo y uso, e historial. La UI solo pinta lo que calcula el motor
(Principio IV). Todos los textos vienen de `packages/i18n` (NFR-013).

- [ ] T138 [P] [US1] Infraestructura del renderer: cliente IPC tipado y hook `useT()`. Regla de lint
  que prohíbe strings literales en JSX. **Archivos**: `apps/desktop/src/renderer/ipc/client.ts`,
  `apps/desktop/src/renderer/i18n/use-t.ts`, `eslint.config.js`. **Cubre**: NFR-013. **Base**:
  R-24. **Depende de**: T134, T025
- [ ] T139 [US1] Pantalla de proyecto: abrir carpeta (mensaje claro si no es repositorio git) y
  lista de flujos con crear, abrir y eliminar (con confirmación). **Archivos**:
  `apps/desktop/src/renderer/screens/project-screen.tsx`,
  `apps/desktop/src/renderer/components/flow-list.tsx`. **Cubre**: FR-001–004, US1-1, US1-2.
  **Base**: contracts/ipc.md `project.open`, `flow.*`. **Depende de**: T138
- [ ] T140 [US1] Canvas con `@xyflow/react`: tres tipos de nodo; agregar, mover, conectar y
  eliminar. `validateEdge` se consulta al motor **antes** de crear una arista y el ciclo se explica
  (US1-3). **Archivos**: `apps/desktop/src/renderer/canvas/flow-canvas.tsx`,
  `apps/desktop/src/renderer/canvas/node-types.tsx`. **Cubre**: FR-005–007. **Base**: R-25.
  **Depende de**: T139
- [ ] T141 [US1] Panel de configuración del nodo de agente:
  - campos: agente, **modelo por agente** (y esfuerzo si el agente lo admite), instrucciones,
    criterios, alcance, terminal y lista de comandos, límites;
  - al crear el nodo o cambiar de agente se copia el default del proyecto;
  - cambiar de agente conserva todo y muestra lo que no aplica según `NodeView.notApplicable`.

  **Archivos**: `apps/desktop/src/renderer/panels/agent-node-panel.tsx`,
  `apps/desktop/src/renderer/panels/model-field.tsx`. **Cubre**: FR-011, FR-011a, FR-015, US4-3.
  **Base**: R-27, D16. **Depende de**: T140
- [ ] T142 [US1] Validación visual: diagnósticos de `flow.validate` marcados en cada nodo
  (incluidos `MULTIPLE_CODE_SOURCES` y `MODEL_DEFAULTED`); el botón de ejecutar se deshabilita si
  hay errores. **Archivos**: `apps/desktop/src/renderer/canvas/diagnostics-overlay.tsx`. **Cubre**:
  FR-008, FR-009, US1-4. **Base**: data-model §Reglas. **Depende de**: T140
- [ ] T143 [US1] Guardar y abrir: flujo inválido con errores y ubicación, sin modificar el archivo;
  diálogo de conflicto "Reload" / "Keep my version" ante `FILE_CHANGED_ON_DISK` o
  `flow.fileChanged`. **Archivos**: `apps/desktop/src/renderer/screens/flow-editor.tsx`,
  `apps/desktop/src/renderer/dialogs/file-conflict-dialog.tsx`. **Cubre**: FR-054–057, US1-5–7,
  SC-007. **Base**: clarificación 2026-09-24, contracts/flow-file.md §Conflictos. **Depende de**:
  T141, T136
- [ ] T144 [US5] Nivel de confinamiento y capacidades en el nodo:
  - insignia `Confined` / `Write-only confined` / `Unconfined` con su motivo, antes, durante y
    después del run;
  - advertencias de `NodeView` (terminal, comandos, denegaciones no disponibles, turnos, red, costo,
    uso, autenticación, alcance solo por detección, modelo por defecto).

  **Archivos**: `apps/desktop/src/renderer/canvas/node-badges.tsx`. **Cubre**: FR-020–023, FR-066,
  NFR-009, NFR-012, US5-1, US5-4–7. **Base**: R-10, R-13. **Depende de**: T142
- [ ] T145 [US2] Diálogo de verificación previa: agentes faltantes, forma de autenticación por nodo
  (sin email), "API key (unverified)" y aviso de cambios sin confirmar. **Archivos**:
  `apps/desktop/src/renderer/dialogs/preflight-dialog.tsx`. **Cubre**: FR-025, FR-065, NFR-007,
  US2-2. **Base**: R-19. **Depende de**: T143
- [ ] T146 [US2] Estados en vivo en el canvas a partir de `node.state` (sin esperar la salida) y
  motivo visible con una interacción como máximo. **Archivos**:
  `apps/desktop/src/renderer/run/run-state-store.ts`,
  `apps/desktop/src/renderer/canvas/node-status.tsx`. **Cubre**: FR-028, FR-039, NFR-003, NFR-011.
  **Base**: R-25. **Depende de**: T145
- [ ] T147 [US2] Salida por nodo: un único `@xterm/xterm` de solo lectura, ring buffer de 5 000
  eventos por nodo y rehidratación con `node.output.page` al cambiar de nodo o al reconectar.
  **Archivos**: `apps/desktop/src/renderer/run/output-panel.tsx`,
  `apps/desktop/src/renderer/run/ring-buffer.ts`. **Cubre**: FR-029, NFR-002, US2-4. **Base**:
  R-25. **Depende de**: T146
- [ ] T148 [US2] Panel de resultado del nodo:
  - estado final y motivo;
  - reporte, archivos observados con "line endings only", discrepancias y **archivos fuera de
    alcance**;
  - denegaciones informadas e **inferidas** (marcadas así);
  - modelo usado y su origen;
  - visor de diff (`node.diff`).

  **Archivos**: `apps/desktop/src/renderer/run/node-result-panel.tsx`,
  `apps/desktop/src/renderer/run/diff-viewer.tsx`. **Cubre**: FR-011a, FR-023, FR-036–039, FR-046,
  US2-7–10. **Base**: data-model §NodeRun. **Depende de**: T147
- [ ] T149 [US2] Controles de cancelación de nodo y de run. **Archivos**:
  `apps/desktop/src/renderer/run/run-controls.tsx`. **Cubre**: FR-030, US2-5. **Base**: R-12,
  R-13. **Depende de**: T146
- [ ] T150 [US3] Diálogo de aprobación con el resumen de los predecesores, y aprobar / rechazar.
  **Archivos**: `apps/desktop/src/renderer/dialogs/approval-dialog.tsx`. **Cubre**: FR-012,
  US3-1–4. **Base**: contracts/ipc.md `approval.*`. **Depende de**: T146
- [ ] T151 [US6] Costo y uso:
  - costo y consumo por nodo ("not available", "estimated") y total del run ("partial",
    "estimated");
  - uso de la suscripción por agente con la hora de la última lectura y "not live" para Codex;
  - nodos retenidos con "Usage near limit" y run en espera.

  **Archivos**: `apps/desktop/src/renderer/run/cost-usage-panel.tsx`. **Cubre**: FR-050–053,
  US6-1–3. **Base**: R-17. **Depende de**: T146
- [ ] T152 [US8] Historial:
  - lista de runs con fecha, duración, costo, estado, resultado por nodo, agente y origen;
  - detalle de un run y runs `interrupted`;
  - eliminación de copias aisladas con confirmación.

  **Archivos**: `apps/desktop/src/renderer/screens/history-screen.tsx`,
  `apps/desktop/src/renderer/dialogs/delete-workspaces-dialog.tsx`. **Cubre**: FR-048, FR-060–062,
  US8-1–3. **Base**: contracts/ipc.md `run.list`, `run.get`, `workspaces.delete`. **Depende de**:
  T146
- [ ] T153 [P] [US1] Configuración del proyecto: `concurrencyLimit`, umbral de uso y
  `defaultModels`, a través de `settings.get` / `settings.set`. **Archivos**:
  `apps/desktop/src/renderer/screens/settings-screen.tsx`. **Cubre**: FR-011a, FR-027, FR-053.
  **Base**: data-model §ProjectConfig. **Depende de**: T139
- [ ] T154 [US2] Prueba de rendimiento: 8 agentes simulados emitiendo a la tasa de
  `q1-verbose-raw.jsonl` × 10. Verifica que la interacción (seleccionar un nodo, desplazar el
  canvas, abrir la salida) responde en menos de 200 ms y que un cambio de estado se ve en menos de
  1 s. **Archivos**: `apps/desktop/test/perf.win.test.ts`. **Cubre**: NFR-002, NFR-003, SC-002.
  **Base**: R-25. **Depende de**: T147, T151

**Checkpoint fase 14**: con el agente simulado, la app permite diseñar, validar, guardar y reabrir
un flujo idéntico, ejecutarlo viendo estados y salida en vivo, aprobar, cancelar, ver confinamiento,
capacidades, costo y uso, y consultar el historial. La UI no contiene reglas y la prueba de
rendimiento pasa.

---

## Phase 15: Validación end-to-end en Windows (quickstart.md)

**Propósito**: validar con agentes reales en Windows nativo. Todas las tareas `[REAL]` consumen la
suscripción y adjuntan evidencia (runIds y capturas). Cada una incluye la verificación común de
quickstart (repo original, rama actual, ramas `zeko/*` y procesos).

- [ ] T155 [REAL] [US1] Quickstart **Escenario 1**, flujo secuencial: canvas idéntico al reabrir;
  `b` parte del commit de `a`; diff con marca de finales de línea; costo "estimated". **Archivos**:
  `specs/001-agent-flow-canvas/evidence/scenario-1.md`. **Cubre**: FR-026, FR-041, FR-043,
  FR-046, FR-051, SC-004, SC-007. **Depende de**: T154, T119
- [ ] T156 [REAL] [US2] Quickstart **Escenario 2**, flujo paralelo con límite 8 y 1: `y` Blocked,
  `z` Skipped, `x` Completed. **Archivos**: `specs/001-agent-flow-canvas/evidence/scenario-2.md`.
  **Cubre**: FR-027, FR-031, NFR-011. **Depende de**: T155
- [ ] T157 [REAL] [US3] Quickstart **Escenario 3**, aprobación: aprobar y rechazar desde el canvas,
  y aprobar desde la CLI con TTY; `zeko run appr < NUL` sale con 3. **Archivos**:
  `specs/001-agent-flow-canvas/evidence/scenario-3.md`. **Cubre**: FR-012, FR-031, FR-059, FR-060.
  **Depende de**: T155
- [ ] T158 [REAL] [US2] Quickstart **Escenario 4**, cancelación de nodo, de run y con Ctrl+C:
  menos de 10 s, `progress.txt` deja de crecer, ningún PID registrado vivo, worktree `untrusted`.
  Incluye la **variante crítica**: una consola ajena sigue viva (nunca terminación por nombre).
  **Archivos**: `specs/001-agent-flow-canvas/evidence/scenario-4.md`. **Cubre**: FR-030, FR-049,
  NFR-004, SC-003. **Depende de**: T155
- [ ] T159 [REAL] [US5] Quickstart **Escenario 5**, reglas de resultado: `deny`, `outside` (el
  token no aparece en el filesystem), `ro`, discrepancia y **escritura fuera de alcance →
  Blocked**. **Archivos**: `specs/001-agent-flow-canvas/evidence/scenario-5.md`. **Cubre**:
  FR-023, FR-036, FR-037, SC-005, SC-006. **Depende de**: T155
- [ ] T160 [REAL] [US4] Quickstart **Escenario 6**, flujo mixto Claude → Codex:
  - capacidades del nodo de Codex visibles;
  - modelo y esfuerzo explícitos;
  - `MODEL_DEFAULTED` al borrar `models` a mano;
  - denegaciones inferidas sin cambio de estado;
  - costo "not available" y total parcial;
  - cambio de agente ida y vuelta conserva el modelo;
  - con clave de API, "API key (unverified)" y **la clave no aparece en el historial ni en los
    logs** (verificado con los patrones de T051).

  **Archivos**: `specs/001-agent-flow-canvas/evidence/scenario-6.md`. **Cubre**: FR-011a,
  FR-013–016, FR-023, FR-040, FR-041, FR-050–052, FR-065, FR-066, NFR-007. **Depende de**: T131,
  T155
- [ ] T161 [REAL] [US8] Quickstart **Escenario 7**, recuperación: se termina la app desde el
  Administrador de tareas con `slow` en Running; al reabrir, el run está Interrupted con todos sus
  eventos y no queda ningún proceso registrado. **Archivos**:
  `specs/001-agent-flow-canvas/evidence/scenario-7.md`. **Cubre**: FR-062, NFR-005. **Depende de**:
  T158
- [ ] T162 [US6] Quickstart **Escenario 8**, retención por uso con el adaptador **simulado**
  (`ZEKO_FAKE_USAGE=0.95`, solo en builds de desarrollo). No es `[REAL]`. **Archivos**:
  `specs/001-agent-flow-canvas/evidence/scenario-8.md`. **Cubre**: FR-053, SC-009. **Depende de**:
  T151
- [ ] T163 Cierre de la validación:
  - `pnpm test` y `pnpm test:win` en verde en el CI de Windows;
  - `pnpm test` en verde en Linux;
  - los escenarios 1 a 8 con evidencia enlazada;
  - revisión de que el CI nunca invocó un proveedor real.

  **Archivos**: `specs/001-agent-flow-canvas/evidence/README.md`. **Cubre**: SC-001–009.
  **Depende de**: T155–T162, T165
- [ ] T164 [REAL] Validación en Linux, **no bloquea v1** (clarificación 2026-09-23): repetir los
  escenarios 1, 4 y 6 en Linux x64 (reglas `Bash(...)`, kill por grupo, binario de Codex) y
  registrar las diferencias como hotfix post-v1. **Archivos**:
  `specs/001-agent-flow-canvas/evidence/linux.md`. **Cubre**: FR-064, NFR-001. **Base**: T-01,
  U-06, U-13. **Depende de**: T163
- [ ] T165 [REAL] [US1] Prueba de usabilidad cronometrada (NFR-010, SC-001). **10 intentos**, cada
  uno con una persona que nunca usó Zeko, sobre una máquina con Claude Code instalado y
  autenticado y el repositorio de quickstart ya preparado. El cronómetro corre desde que se abre la
  app hasta que termina un run de un flujo `goal → a → b` con dos nodos de agente, armado en el
  canvas sin ayuda. Pasa si al menos 9 de 10 intentos terminan en menos de 5 minutos. Se registran
  los tiempos y los puntos donde cada persona se trabó, como insumo de mejoras de UI. Se ejecuta
  antes del cierre T163 aunque su ID sea posterior. **Archivos**:
  `specs/001-agent-flow-canvas/evidence/usability-nfr-010.md`. **Cubre**: NFR-010, SC-001.
  **Base**: spec NFR-010. **Depende de**: T155

**Checkpoint fase 15**: la prueba de usabilidad (T165) pasa en al menos 9 de 10 intentos; los
escenarios 1 a 7 pasan con Claude Code y Codex reales en Windows, el 8
con el adaptador simulado, y las dos suites automáticas están en verde. La validación en Linux queda
registrada sin bloquear la entrega.

---

## Dependencias y orden de ejecución

### Entre fases

```text
F1 Setup ─▶ F2 Contratos ─▶ F3 Dominio ─▶ F4 NodeResult ─▶ F6 Scheduler/motor
                        └─▶ F5 Agente simulado ───────────────┘      │
F2 ─▶ F7 Git ──────────────────────────────────────────────────────┤ (T076 necesita T059)
F5 ─▶ F8 Procesos ─────────────────────────────────────────────────┤
F2 ─▶ F9 Persistencia (T094 necesita T081, T095 necesita T083) ────┤
                                                                   ▼
                                                  F10 Runtime + CLI (corte vertical)
                                                                   │
                                              ┌────────────────────┴────────────────┐
                                              ▼                                     ▼
                                    F11 Adaptador Claude ─▶ F12 Adaptador Codex   F13 Escritorio ─▶ F14 UI
                                              └──────────────────────┬──────────────┘
                                                                     ▼
                                                        F15 Validación E2E (Windows)
```

- **F10 es la compuerta del corte vertical**: ninguna tarea de F13/F14 empieza antes de T109
  (dependencia explícita en T132, de la que cuelga el resto del escritorio y la UI).
- **Los adaptadores reales (F11, F12) empiezan después de T109**, con el motor ya probado contra el
  agente simulado (dependencia explícita en T112, T120, T121, T122 y T127).
- F11/F12 y F13/F14 pueden avanzar en paralelo una vez cerrada F10.
- F15 necesita F12 y F14 completas.

### Dependencias críticas dentro de fases

- `resolve-node-result.ts` (T040–T048) y `run-engine.ts` (T059–T066) se modifican en secuencia
  estricta: nunca en paralelo.
- T082 (sin terminación por nombre) depende del supervisor (T081) y bloquea la cancelación del
  motor con procesos reales (T084, T105, T116, T128).
- T052 (fixtures sin secretos) y T095 (persistidos sin secretos) tienen que estar en verde antes de
  que cualquier adaptador real escriba al historial (T119, T131).

### Tareas explícitas pedidas

| Pedido | Tareas |
|---|---|
| Fijar el modelo de cada nodo sin heredar el default del agente | T011, T012, T030, T060, T112, T122, T124, T141, T160 |
| Reintento de infraestructura ante fallos de creación de proceso | T016, T043, T058, T062, T125, T130 |
| Ningún fixture ni evento persistido contiene claves de API ni emails | T051, T052, T088, T095, T121, T160 |
| El motor nunca termina procesos por nombre ni por patrón | T081, T082, T084, T094, T158 |

---

## Oportunidades de paralelismo

### Fase 2 (después de T010)

```text
T011 flow-file   T012 project-config   T013 agent-report   T015 normalized-event
T016 process-outcome   T017 capabilities   T025 i18n
```

### Fase 3 (después de T026 y T019)

```text
T027 ciclos → luego T028 linaje      T029 límites/alcance      T032 confinamiento
T036 totales de costo                T037 predecessor-results
```

### Fase 5

```text
T050 fixtures   T051 redaction-patterns   (después) T054 escenarios en paralelo con T055 dobles de prueba
```

### Fases 7, 8 y 9 (después de F2 y F5)

Git (T069–T075), procesos (T078–T083) y persistencia (T086–T093) pueden avanzar en paralelo por
personas distintas; solo convergen en T076, T094, T095 y T101.

### Después del corte vertical (T109)

```text
Equipo A: F11 Claude (T112–T118) → F12 Codex (T120–T130)
Equipo B: F13 Escritorio (T132–T137) → F14 UI (T138–T154)
```

---

## Estrategia de implementación

### MVP (US1 + US2 con el agente simulado)

1. Fases 1 a 6: contratos, dominio, `resolveNodeResult` y motor probados en memoria.
2. Fases 7 a 9: git, procesos y persistencia reales.
3. Fase 10: **corte vertical**. `zeko run` ejecuta un flujo de dos nodos con el agente simulado.
   **Parar y validar**: T109 y T110 en verde.

### Entrega incremental

1. + Fase 11: Claude Code real por la CLI (US2 con un agente real, T119).
2. + Fase 12: Codex y flujos mixtos (US4, T131).
3. + Fases 13 y 14: escritorio y canvas (US1, US3, US5, US6, US8 en la UI).
4. + Fase 15: validación end-to-end en Windows con evidencia.

### Reglas de trabajo

- Una tarea = un diff = un commit (Principio XX). No se empieza la siguiente sin cerrar la actual.
- Los tests del motor afectados pasan antes de cada commit.
- Ninguna tarea automática usa proveedores reales; las `[REAL]` se ejecutan a mano y dejan
  evidencia en `specs/001-agent-flow-canvas/evidence/`.
