# Implementation Plan: Nodos interactivos de agente

**Branch**: `feature/interactive-nodes` (directorio de feature `005-interactive-agent-nodes`) | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-interactive-agent-nodes/spec.md`

**Insumos**: el diseño de 001 (`specs/001-agent-flow-canvas/`: plan, research R-01…R-28,
data-model y contracts), que esta feature **extiende**; los spikes `001`, `001b`, `001c`, `001d` y
`001e`; y el código actual de terminales (`apps/desktop/src/main/pty-manager.ts`,
`apps/desktop/src/renderer/terminal/node-terminal.tsx`, `apps/desktop/test/pty-manager.test.ts`).

## Summary

Un nodo `interactive` del flujo pone al usuario a conversar con Claude Code o Codex en la terminal
del nodo, dentro de un run. Cuando el nodo queda listo, pasa a `waiting_user` sin lanzar nada. El
usuario abre la sesión y trabaja en la TUI del agente, que corre en la copia aislada del nodo. Termina
declarando el estado o saliendo del agente. Entonces el motor commitea, observa los archivos con git
y resuelve el estado final con la misma función de 001. Los sucesores reciben un `PredecessorResult`
con la misma forma que el de un nodo de agente, y la recap del agente como resumen.

El enfoque técnico:

- **La sesión pasa del proceso principal al engine host**, para que el motor controle ciclo de vida,
  tiempo, cancelación e interrupción (R5-01).
- **El agente es la raíz del PTY**, sin shell intermedia, con el binario nativo y restricciones duras
  por flag (R5-02).
- **La recap se lee de los archivos de sesión del agente**, nunca de la terminal (R5-04).
- **`resolveNodeResult` agrega una capa de declaración**, sin duplicar reglas (R5-08).
- **La reapertura continúa en la misma copia**, invalida los dependientes y los reejecuta con
  confirmación (R5-07).

Ningún spike ejercitó los agentes en modo interactivo. Por eso los adaptadores declaran **valores
conservadores** hasta que el mini-spike **005a** (research §S) los verifique: la feature es funcional
y segura antes de 005a, pero no promete confinamiento, recap, reanudación ni "salida normal =
completado" hasta cerrarlo.

## Technical Context

**Language/Version**: TypeScript 5.x estricto, ESM, Node.js 24 LTS (igual que 001).

**Primary Dependencies**: las de 001. `node-pty` (ya en el stack de la constitución y ya usado hoy en
el main) pasa a cargarse en el engine host (`utilityProcess`). `@xterm/xterm` y `@xterm/addon-fit` en
el renderer, como hoy. No se agregan dependencias de runtime.

**Storage**: SQLite de 001 con la migración `002_interactive` (data-model §4). Sin transcripciones ni
logs crudos de sesiones interactivas (FR-028).

**Testing**: Vitest (unit de `core`, contratos, adaptadores contra el agente simulado en modo
interactivo) e integración Windows (`pnpm test:win`) para cancelación, aislamiento, interrupción y
latencia. Nunca proveedores reales (Principio XVI).

**Target Platform**: Windows 10/11 x64 nativo (NFR-001). Linux no es requisito de 005; el diseño no lo
impide, pero nada de lo interactivo está verificado ahí.

**Project Type**: app de escritorio con motor headless compartido con la CLI (monorepo pnpm de 001).

**Performance Goals**: eco de tecleo < 100 ms en **todas** las pulsaciones medidas con 4 sesiones
interactivas y 8 nodos no interactivos (NFR-002, NFR-003, SC-003); cancelación completa < 10 s
(NFR-004).

**Constraints**:

- el repositorio original no cambia salvo ramas `zeko/*` (FR-012, SC-006);
- solo se termina el árbol adoptado del segmento, por `(pid, creationTime)`, nunca por nombre o
  patrón (R-14);
- no se persiste la salida del PTY ni la transcripción (FR-028);
- nada llega al agente salvo lo que el usuario escribe (FR-017, NFR-006);
- modelo explícito siempre (FR-002).

**Scale/Scope**: un usuario y una máquina (Principio XVIII). Al menos 4 sesiones interactivas
simultáneas, una por nodo (FR-009), además del límite de 8 nodos no interactivos.

**NEEDS CLARIFICATION**: ninguno bloquea el diseño. Lo no verificado del modo interactivo está en
research §U (U5-01…U5-14) con valores conservadores definidos, y lo cierra el mini-spike 005a
(research §S), que bloquea solo las tareas indicadas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Fuente: `.specify/memory/constitution.md` v1.0.0. Evaluación inicial y re-evaluación post-diseño
(los resultados coinciden; las notas indican qué confirmó el diseño).

- [x] **I. Spec manda**: cada componente está trazado a FR/NFR (tabla de trazabilidad abajo). Lo que
  existe hoy y no está en la spec se retira: terminal `shell` suelta y terminal de agente en modo
  edición (research §I, I-09).
- [x] **II. Local-first**: sin servidor ni cuenta de Zeko. La recap se lee de archivos locales del
  agente. El aislamiento de la configuración del usuario (MCP, conectores) usa los flags de 001, a
  verificar en la TUI (U5-01, U5-05); mientras tanto, el nodo muestra `USER_CONFIG_NOT_ISOLATED`.
- [x] **III. CLI es el motor**: la sesión es la TUI del propio agente; Zeko no reimplementa chat. Las
  diferencias por agente están en el bloque `interactive` de las capacidades y en operaciones puras
  del adaptador ([contracts/adapter.md](./contracts/adapter.md)). `core` no conoce ids de agente.
- [ ] ⚠ **IV. Núcleo headless**: todas las reglas del nodo (validación, estados, tiempo, declaración,
  resultado, reapertura) viven en `core`; la UI solo pinta. Pero FR-029 hace que la CLI **rechace**
  flujos con nodos interactivos, contra "todo flujo del canvas MUST poder ejecutarse desde la CLI" →
  Complexity Tracking + enmienda MAJOR propuesta (R5-10), a aplicar antes de `/speckit-tasks`.
- [x] **V. Archivos como verdad**: el nodo interactivo se guarda en `.zeko/flows/*.flow.yaml`
  ([contracts/flow-file.md](./contracts/flow-file.md)). SQLite guarda solo estado de ejecución:
  segmentos, declaraciones, resultados reemplazados y eventos.
- [ ] ⚠ **VI. Estándares abiertos**: sin canal MCP agente ↔ Zeko (continúa T-09 de 001); el resultado
  estructurado por MCP está fuera de alcance por la aclaración del 2026-09-28 → Complexity Tracking.
- [x] **VII. Contratos**: el resultado del nodo interactivo tiene la forma de `AgentReport` /
  `PredecessorResult` de 001 (estado, resumen, archivos, checks, hallazgos, bloqueos; listas vacías
  admitidas). Los schemas nuevos se definen una vez en `contracts`.
- [x] **VIII. Aislamiento**: un worktree por NodeRun interactivo, fuera del repositorio; commits del
  motor; sin merge, push ni rebase. El `cwd` deja de ser la raíz del repositorio (research I-08).
- [ ] ⚠ **IX. Permiso ≠ autonomía**: los límites duros van por flags que una aprobación no puede
  levantar, y lo que el agente no admite se muestra (R5-02). Pero la shell de Claude sigue sin
  confinar `[001b §B2]`, y la escritura fuera de un alcance parcial solo se detecta al cerrar → mismo
  caso que 001, Complexity Tracking.
- [x] **X. Jerarquía**: Zeko no inyecta nada en la conversación (el usuario es la instrucción de mayor
  rango en la sesión). La notificación al orquestador es que hubo sesión, declaración y recap; el
  orquestador nunca revierte cambios de la sesión: los archivos de permisos se **excluyen** del
  commit, no se revierten (R5-05, T5-04).
- [x] **XI. Seguridad**: sin secretos en el flujo (schema estricto); recap y eventos redactados
  (R5-11); la salida del agente es dato (R-23, FR-014); límite de tiempo obligatorio y finito por
  nodo. La espera en `waiting_user` no tiene límite, como `waiting_approval` en 001 (T5-05).
- [x] **XII. Arquitectura**: N/A (canvas de arquitectura fuera de alcance).
- [x] **XIII. Observabilidad**: eventos nuevos con `run_id` (data-model §5); `waiting_user` visible y
  mapeado a "waiting approval" (T5-06).
- [x] **XIV. Referencias**: sin dependencias de Orca ni Alera. El código actual cita a Orca como
  referencia de diseño en comentarios; no hay código copiado que requiera atribución.
- [x] **XV/XVI. Calidad y tests**: TS estricto, errores tipados (`ReasonCode`, códigos IPC). Tests
  unitarios de cada regla nueva y adaptadores contra el agente simulado interactivo (R5-15).
- [x] **XVII. Performance**: salida del PTY en streaming por un puerto dedicado, ≤ 8 ms; medición
  explícita de NFR-002 con carga (R5-01); 8 nodos no interactivos concurrentes sin cambios.
- [x] **XVIII. MVP**: un usuario, una máquina, repositorios locales; sin compartir sesiones.
- [x] **Stack**: sin dependencias nuevas. `node-pty` y `@xterm/xterm` ya están en el stack.

**Resultado**: PASS con tres justificaciones en Complexity Tracking (Principios IV, VI y IX). La del
Principio IV requiere además la enmienda de R5-10 antes de generar tareas.

## Project Structure

### Documentation (this feature)

```text
specs/005-interactive-agent-nodes/
├── spec.md
├── plan.md              # este archivo
├── research.md          # inventario (§I), R5-01…R5-15, cambios a 001 (§C), tensiones (§T),
│                        # supuestos (§U) y mini-spike 005a (§S)
├── data-model.md        # solo cambios respecto de 001
├── quickstart.md        # escenarios de validación en Windows
├── contracts/
│   ├── flow-file.md
│   ├── flow-file.example.yaml
│   ├── adapter.md
│   ├── ipc.md
│   └── cli.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (no lo genera este comando)
```

### Source Code (repository root)

Misma estructura de 001; solo se listan los archivos que cambian o se agregan.

```text
packages/
├── contracts/src/
│   ├── flow-file.ts          # + InteractiveNodeSchema en la unión FlowNode
│   ├── run.ts                # + waiting_user, generation, declaration, summary, hold RERUN_CONFIRMATION
│   ├── codes.ts              # + ReasonCode, WarningCode, DiagnosticCode de 005
│   ├── events.ts             # + eventos session.*, node.declared, node.reopened, rerun.*, …
│   ├── ipc.ts                # + métodos de sesión y TerminalMessage
│   ├── task-assignment.ts    # PredecessorResult: + nodeType, declaration, summaryState (opcionales)
│   ├── ports.ts              # + TerminalPort (lo implementa el escritorio)
│   └── adapter/              # + interactive-capabilities, interactive-launch, recap, session-ref;
│                             #   ProcessOutcome.killed.by + 'declaration'
├── core/src/
│   ├── validation/           # + host 'desktop'|'cli', INTERACTIVE_NODE_REQUIRES_DESKTOP, modelo obligatorio
│   ├── policy/confinement.ts # + confinamiento interactivo por capacidades
│   ├── result/               # + capa Declaration en resolveNodeResult; COMPLETED_WITHOUT_CHANGES
│   ├── state/                # + waiting_user, reapertura, finished → running, RERUN_CONFIRMATION
│   ├── scheduler/            # + acción await_user; sin slot para interactivos
│   ├── engine/               # + InteractiveNodeController (apertura, temporizador, declaración,
│   │                         #   cierre, commit, reapertura, invalidación de dependientes)
│   └── prompt/               # PredecessorResult de interactivos (misma forma)
├── adapters/src/
│   ├── process/supervisor.ts # + adopt(pid)
│   ├── claude-code/interactive.ts  # buildInteractiveLaunch, classifyInteractiveExit, locateSession,
│   ├── codex/interactive.ts        # readRecap, isBusy; capacidades interactivas (conservadoras)
│   └── fake/                 # + modo interactivo
│       test/fake-agent/      # + modo interactive (eco, archivo de sesión simulado, nietos)
├── git/src/engine-commit.ts  # + exclusión de permissionPersistencePaths
├── storage/src/
│   ├── migrations/002_interactive.ts
│   └── repos/                # + node-results; columnas nuevas en node-runs y attempts
├── runtime/src/              # composición: TerminalPort opcional (solo escritorio); recovery sin cambios
└── i18n/src/en.json          # textos de estados, motivos, advertencias y errores nuevos

apps/
├── desktop/src/
│   ├── main/index.ts                 # − PtyManager y canales terminal.*; + segundo MessageChannel
│   ├── main/pty-manager.ts           # se elimina (research I-01…I-07, I-15)
│   ├── preload/index.ts              # − terminal.* por ipcRenderer; + zeko.terminal.post/onMessage
│   ├── engine-host/interactive-session-host.ts  # node-pty, buffer de reenganche, TerminalPort
│   ├── engine-host/dispatch.ts       # + métodos de sesión
│   ├── renderer/terminal/node-terminal.tsx      # transporte al puerto de terminal; sin cwd/kind/modelo
│   ├── renderer/panels/node-dock.tsx            # − selector de kind, shell, "pegar instrucciones";
│   │                                            # + contexto con "Copiar", declarar fin, cancelar, reabrir
│   ├── renderer/canvas/                         # + nodo interactive, estado waiting_user, notificación
│   └── test/                                    # − pty-manager.test.ts; + tests de sesión y latencia
└── cli/src/                          # validación con host 'cli' (sin lógica propia)
```

**Structure Decision**: la de 001, sin paquetes nuevos. `node-pty` queda confinado a
`apps/desktop/src/engine-host/` detrás de `TerminalPort`, así que `core`, `runtime`, `adapters` y la
CLI no lo cargan (Principio IV, R5-01). Las operaciones interactivas del adaptador son puras para que
se prueben sin PTY.

## Arquitectura

```text
┌────────────────────────────── apps/desktop ───────────────────────────────┐
│ renderer: canvas · NodeDock(contexto, declarar, cancelar, reabrir) · xterm │
│    │ puerto de control (zeko.request/onEvent)   │ puerto de terminal        │
│ main: crea los DOS MessageChannel; ya no tiene PTY ni canales terminal.*   │
│    ▼                                            ▼                          │
│ engine host (utilityProcess)                                               │
│   runtime ── core (InteractiveNodeController, resolveNodeResult, scheduler)│
│      │            │ TerminalPort                                           │
│      │            ▼                                                        │
│      │      InteractiveSessionHost ── node-pty ── ConPTY ── claude.exe /   │
│      │            (buffer en memoria)                        codex.exe     │
│      ├── adapters (buildInteractiveLaunch, classifyInteractiveExit,        │
│      │             locateSession, readRecap) + supervisor.adopt()          │
│      ├── git (worktree, commit con exclusiones, diff)                      │
│      └── storage (segmentos, declaraciones, node_results, eventos)         │
└────────────────────────────────────────────────────────────────────────────┘
apps/cli ── runtime ── core.validateFlow(host = 'cli') → INTERACTIVE_NODE_REQUIRES_DESKTOP (exit 2)
```

## Flujo de un nodo interactivo

Cada paso indica los requisitos y la decisión de research que lo sustentan.

1. **Edición** (FR-001–004): el nodo `interactive` se guarda con agente, modelo obligatorio,
   instrucciones opcionales, alcance, restricciones de terminal, `requiresChanges` y tiempo máximo.
   La validación de escritorio muestra errores y el confinamiento real (FR-015) y las restricciones
   no admitidas (FR-016) desde las capacidades (R5-02, R5-12).
2. **Inicio del run** (FR-006, NFR-006): igual que 001. La CLI rechaza el flujo en la validación
   (FR-029, R5-10). Iniciar el run no lanza ninguna sesión.
3. **Espera** (FR-005, FR-024, US3-1, US3-3): con los predecesores `completed`/`approved`,
   `nextActions` emite `await_user` y el nodo pasa a `waiting_user`: estado y acción visibles,
   notificación. No toma slot de concurrencia. Las ramas independientes siguen; los dependientes
   esperan. El tiempo no corre (R5-13).
4. **Apertura** (FR-006, FR-007, FR-012–014, FR-017; R5-02, R5-03, R5-14):
   1. `session.open` explícito del usuario;
   2. `detect()` del agente → si no está autenticado, `failed` con `AGENT_NOT_AUTHENTICATED`;
   3. worktree nuevo desde la base de su fuente de código (R-15, R-22); si falla,
      `WORKSPACE_CREATE_FAILED`;
   4. `buildInteractiveLaunch` → `InteractiveSessionHost` lanza el binario nativo en el PTY →
      `supervisor.adopt(pid)` registra el árbol en `process_tree`;
   5. temporizador con `remainingMs` (FR-010);
   6. la vista recibe `NodeContext` (instrucciones y resultados completos de predecesores) como datos,
      sin escribir nada en el PTY.
5. **Sesión** (FR-007–010, R5-01): bytes por el puerto de terminal; cerrar o minimizar la vista no
   afecta la sesión; reabrir la vista hace `session.attach` con el buffer en memoria. Una sola sesión
   por copia; varias sesiones de nodos distintos en paralelo.
6. **Fin** (FR-011, FR-018; R5-03, R5-14):
   - **declaración** (`node.declareEnd`): si el agente responde (o no se puede saber), el usuario elige
     cerrar ahora o esperar; el motor cierra el agente (`killed{by: declaration}`) y verifica el árbol;
   - **salida normal**: `classifyInteractiveExit` → `exited` → declaración provisional `COMPLETED`
     con origen `normal_exit` (con `normalExit.codes = []` hasta 005a, toda salida es `crashed`);
   - **corte inesperado** → `crashed` → `failed`; **tiempo** → `killed{timeout}` → `failed`.
7. **Resultado** (FR-018–023; R5-04, R5-05, R5-08):
   1. `locateSession` + `readRecap` → resumen o "recap no disponible";
   2. commit del motor con exclusión de `permissionPersistencePaths` (no en cancelado ni interrumpido);
   3. `observedFiles` = diff `base..result`; `scopeViolations` desde `writeScope`;
   4. `resolveNodeResult` con la capa de declaración → estado final y motivo; inconsistencia
      `COMPLETED_WITHOUT_CHANGES` si aplica;
   5. se persiste (redactado) y se emite `node.result`; los dependientes reciben el
      `PredecessorResult` con la forma de 001 y arrancan desde `resultCommit` (FR-023), o quedan
      `skipped` (FR-024).
8. **Reapertura** (FR-011, FR-023a; R5-07): `node.reopen` sobre `completed`/`blocked`/`failed` con copia
   confiable, tiempo restante y run `running`/`finished`:
   1. el resultado pasa a `node_results` como reemplazado; `generation + 1`; el run vuelve a
      `running`;
   2. los dependientes activos se cancelan (`UPSTREAM_REOPENED`), los resultados de todos los
      descendientes se reemplazan y quedan `pending` con `RERUN_CONFIRMATION`;
   3. segmento nuevo en la **misma** copia con el mismo perfil, reanudando la conversación (fork
      preferido) o, si no se puede, conversación nueva con `RESUME_UNAVAILABLE`;
   4. al cerrar de nuevo: si queda `completed`, confirmación explícita para reejecutar dependientes en
      worktrees nuevos desde el nuevo `resultCommit`; si no, `skipped`.
9. **Cancelación** (FR-025, NFR-004; R5-06): fase 1 solo si está verificada; fase 2 terminación del
   árbol adoptado por `(pid, creationTime)`; cierre del PTY; verificación. `cancelled`, copia
   `untrusted`, sin commit, dependientes `skipped`. Si coincide con el commit, prevalece la
   cancelación.
10. **Interrupción** (FR-026; R5-09): cierre ordenado → fase 2 forzada, `interrupted`, copias
    `untrusted`. Crash → la recuperación de R-20 termina los `(pid, creationTime)` registrados en
    `process_tree` y marca los nodos `interrupted`.

## Decisiones principales

| # | Decisión | Evidencia | Cubre |
|---|---|---|---|
| 1 | PTY en el engine host; puerto de terminal dedicado; `node-pty` detrás de `TerminalPort` | R5-01; I-06; `[001 §7]` | FR-006, FR-008–010, FR-025, FR-026, NFR-002, NFR-003 |
| 2 | Agente como raíz del PTY, binario nativo, sin shell; flags de 001 como candidatos; capacidades interactivas conservadoras hasta 005a | R5-02; I-01, I-04, I-05; `[001 §1, §6]`, `[001b §B]`, `[001c §1–10]` | FR-002, FR-007, FR-012, FR-015, FR-016, NFR-006 |
| 3 | Fin de sesión clasificado en `ProcessOutcome`; auth verificada al abrir; salida normal solo con códigos verificados | R5-03; `[001d U-03]`, `[001c §2]` | FR-011, FR-018, FR-019 |
| 4 | Recap desde el archivo de sesión del agente; nunca desde la terminal; sin copiarlo | R5-04; `[sample: 001c/q4-termination.json]`, `[001c §3]` | FR-018, FR-022, FR-028 |
| 5 | Archivos de permisos del agente excluidos del commit, no revertidos | R5-05; `[001c §10]`, `[001b §B1]`, `[001d U-07]` | FR-016, FR-020, FR-023 |
| 6 | Cancelación en fases con `supervisor.adopt`; nunca `pty.kill()` como mecanismo de terminación | R5-06; `[001 §7]`, `[001c §9]` | FR-025, NFR-004, SC-005 |
| 7 | Reapertura en la misma copia, fork preferido, tiempo acumulado, resultados reemplazados, reejecución confirmada | R5-07; `[001 §4]`, `[001c §5, §12]` | FR-010, FR-011, FR-023a |
| 8 | Capa `Declaration` en `resolveNodeResult`; commit del motor tras verificar el árbol | R5-08; R-05, R-07, R-15 | FR-019–023, SC-006 |
| 9 | Interrupción con la recuperación de R-20 sin cambios de mecanismo | R5-09; R-20 | FR-026 |
| 10 | Enmienda MAJOR del Principio IV antes de `/speckit-tasks` | R5-10 | FR-029 |
| 11 | Redactor de R-28 para recap, eventos e historial; salida del PTY ni se redacta ni se persiste | R5-11 | FR-028, SC-007 |
| 12 | Tipo `interactive` con modelo obligatorio; validación por `host` | R5-12 | FR-001–004, FR-029 |
| 13 | `waiting_user` sin slot de concurrencia; notificación en el renderer | R5-13 | FR-005, FR-024, NFR-003, NFR-005 |
| 14 | Contexto como datos con "Copiar"; declaración con confirmación si el agente responde o no se sabe | R5-14; I-10 | FR-014, FR-017, FR-018 |
| 15 | Retiro de la terminal `shell` y de la terminal de agente en modo edición | research §I, I-09 | Out of Scope, FR-012, Principio I |

**Restricciones que el plan no puede levantar** (se muestran en el nodo):

- hasta 005a, todo nodo interactivo se muestra `unconfined` (`INTERACTIVE_CONFINEMENT_UNVERIFIED`),
  sin recap, sin reanudación y con "salida del agente = fallo" (T5-07, T5-08);
- la shell de Claude no está confinada, igual que en 001 `[001b §B2]`;
- el alcance parcial se detecta al cerrar y bloquea el nodo, no se previene `[001d U-02]`;
- Codex no confina la lectura `[001c §8]`;
- sin costo en dinero en sesiones interactivas hasta que un spike encuentre una fuente (T5-09);
- un fallo de autenticación **durante** la sesión puede verse como salida normal si el agente sale con
  el mismo código (R5-03).

## Trazabilidad FR/NFR/SC → componentes

| Requisitos | Componente principal | Contrato / documento |
|---|---|---|
| FR-001 | contracts (`InteractiveNodeSchema`), renderer/canvas | flow-file |
| FR-002, FR-003, FR-004 | contracts, core/validation (modelo obligatorio, `INTERACTIVE_AGENT_UNSUPPORTED`) | flow-file, data-model §1 |
| FR-005, FR-006 | core/scheduler (`await_user`), core/state, renderer (notificación) | ipc `node.state`, data-model §3 |
| FR-007, FR-008, FR-009 | engine-host/InteractiveSessionHost, renderer/terminal | ipc (puerto de terminal, `session.open/attach`) |
| FR-010 | core/engine (temporizador, `activeMs`) | data-model §2, ipc `session.state` |
| FR-011 | adapters (`classifyInteractiveExit`, `resume`), core/engine (reapertura) | adapter, ipc `node.reopen` |
| FR-012, FR-013 | git (worktree), core/engine (base por linaje R-22) | data-model §2 |
| FR-014, FR-017 | core/prompt (`PredecessorResult`), core/engine (`NodeContext`), renderer (Copiar) | ipc `NodeContext`, `PredecessorResult` |
| FR-015, FR-016 | adapters (bloque `interactive`, flags), core/policy (confinamiento, advertencias) | adapter, data-model §1 |
| FR-018 | core/engine (declaración, cierre), adapters (`readRecap`, `isBusy`) | ipc `node.declareEnd`, adapter |
| FR-019, FR-020, FR-022 | core/result (capa `Declaration`), git (commit, diff) | data-model §2 |
| FR-021 | core/validation (`requiresChanges`), core/result (`COMPLETED_WITHOUT_CHANGES`) | flow-file, data-model §2 |
| FR-023 | core/prompt, core/engine (base = `resultCommit`) | ipc `PredecessorResult` |
| FR-023a | core/state, core/engine (invalidación, `RERUN_CONFIRMATION`), storage (`node_results`) | data-model §2–3, ipc `node.reopen`, `dependents.rerun.decide` |
| FR-024 | core/scheduler (propagación de 001) | data-model §3 |
| FR-025 | core/engine, adapters/process (`adopt`, `terminateTree`) | adapter, ipc `node.cancel` |
| FR-026 | runtime/recovery (R-20), engine-host (shutdown) | data-model §3 |
| FR-027 | storage (eventos, segmentos) | data-model §5 |
| FR-028 | storage/redactor, engine-host (buffer solo en memoria), adapters (`readRecap` sin copia) | data-model §4–5 |
| FR-029 | core/validation (`host = cli`), apps/cli | cli |
| NFR-001 | adapters (Windows), engine-host (ConPTY) | quickstart |
| NFR-002, NFR-003, SC-003, SC-004 | engine-host, puerto de terminal, renderer | ipc §rendimiento, quickstart §10 |
| NFR-004, SC-005 | adapters/process | adapter, quickstart §4 |
| NFR-005 | renderer (estado y acción en el nodo) | ipc `NodeView.interactive` |
| NFR-006, SC-002 | core/scheduler, core/engine (solo `session.open` lanza) | ipc |
| SC-001 | todo el flujo | quickstart §1 |
| SC-006 | git, core/result | quickstart §1, §7 |
| SC-007 | storage/redactor | quickstart §8 |

## Orden sugerido de implementación (insumo para `/speckit-tasks`)

0. **Prerrequisitos**:
   - aplicar la enmienda del Principio IV con `/speckit-constitution` (R5-10);
   - lanzar el mini-spike **005a** en paralelo (research §S). Bloquea solo las tareas de la columna
     "Bloquea" de research §U.
1. `contracts`: schemas y códigos nuevos, `InteractiveCapabilities` con valores conservadores,
   `ProcessOutcome.killed.by = declaration`, eventos, IPC y `PredecessorResult` extendido.
2. `core`: validación por host, confinamiento interactivo, capa `Declaration` en `resolveNodeResult`,
   máquinas de estado, `await_user`, tiempo acumulado, invalidación y reejecución de dependientes, con
   tests unitarios completos (R5-15).
3. `storage` (migración 002, `node_results`) y `git` (commit con exclusiones).
4. `adapters/process`: `supervisor.adopt` + tests de integración Windows con el agente simulado
   interactivo.
5. `apps/desktop`: `InteractiveSessionHost` en el engine host, segundo puerto, retiro de `PtyManager`,
   de la terminal `shell` y de la terminal de edición; vista con contexto, declarar, cancelar y
   reabrir. Medición de latencia (quickstart §10).
6. `apps/cli`: validación con `host = cli` y código 2.
7. **Tras 005a**: flags interactivos de cada adaptador, `normalExit`, `locateSession`, `readRecap`,
   `resume`, `busyDetection`, `orderlyExit`, `permissionPersistencePaths`, y actualización de la
   matriz de capacidades con las citas del spike.
8. Quickstart manual completo en Windows.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Principio IV**: la CLI no puede ejecutar flujos con nodos interactivos (FR-029). Se propone la enmienda MAJOR de research R5-10. | Un nodo interactivo necesita que el usuario converse con el agente en la terminal de la interfaz; la CLI de 001 solo tiene TTY para aprobaciones. La spec (FR-029, US3-7) exige rechazar esos flujos antes del run. Las reglas del nodo siguen en el núcleo headless y la CLI usa la misma validación. | **Ejecutar el nodo en la TTY de la CLI**: agrega una segunda superficie de terminal con su propio ciclo de vida, fuera del alcance de la spec. **Saltar el nodo en la CLI**: cambiaría el resultado del flujo según el host (contra SC-008 de 001) y contradice FR-029. |
| **Principio VI**: sin canal MCP agente ↔ Zeko; la declaración viene del usuario y la recap de un archivo del agente. | Es la única fuente estructurada disponible sin inyectar mensajes en la conversación (FR-017) ni interpretar la terminal (R5-04). La aclaración del 2026-09-28 deja fuera de alcance el resultado estructurado por MCP. | **Servidor MCP de Zeko** para que el agente entregue el resultado: fuera de alcance por la aclaración; además exigiría instruir al agente, contra FR-017. **Parsear la terminal**: heurístico y dependiente de la versión de la TUI. |
| **Principio IX**: acciones fuera de alcance pueden ocurrir sin denegación previa (shell de Claude sin confinar, alcance parcial solo detectado, lectura de Codex) y, hasta 005a, no se sabe si una aprobación en la TUI puede levantar un límite duro. | Son los mismos límites de 001 (`[001b §B2]`, `[001d U-02]`, `[001c §8]`), más la falta de evidencia interactiva. La spec los acepta mostrando el confinamiento real y las restricciones no admitidas (FR-015, FR-016) y bloqueando al detectar escrituras fuera de alcance (FR-020). | **Bloquear los nodos interactivos con shell**: dejaría a Codex sin uso (no lee sin shell `[001c §7]`) y a Claude sin tests ni builds. **Confinamiento a nivel de SO**: fuera de alcance (Out of Scope: "Confinar realmente la terminal interactiva"; D-07 de 001). |
