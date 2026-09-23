# Implementation Plan: Canvas de flujos de agentes CLI (primera versión de Zeko)

**Branch**: `feature/001-desktop-app` (directorio de feature `001-agent-flow-canvas`) | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-agent-flow-canvas/spec.md`

**Insumos técnicos**: `spikes/001-claude-chain/FINDINGS.md`, `spikes/001b-claude-edges/FINDINGS.md`,
`spikes/*/samples/`. **Falta en el repo `spikes/001c-*` (Codex)**; ver
[research.md §P](./research.md#p--datos-pendientes-de-001c-no-inventados).

## Summary

Zeko v1 es una app de escritorio (Electron) con una CLI. Permite diseñar flujos DAG de nodos de
entrada, de agente (Claude Code o Codex) y de aprobación. Los flujos se guardan como YAML en
`.zeko/flows/`, y el motor headless los ejecuta con:

- un worktree de git por nodo, fuera del repositorio;
- scheduler con límite de concurrencia global;
- resultado de nodo decidido por el motor en tres capas (`ProcessOutcome` → `AgentReport` →
  `NodeResult`);
- cancelación que termina solo el árbol de procesos lanzado;
- historial en SQLite.

El motor vive en `packages/core` más `packages/runtime`, y corre igual en un `utilityProcess` de
Electron y en la CLI. Los adaptadores traducen una interfaz común a los flags verificados de cada
agente y declaran una matriz de capacidades. La UI muestra esas diferencias sin contener reglas.

## Technical Context

**Language/Version**: TypeScript 5.x en modo `strict` (sin `any` implícito, ESM), Node.js 24 LTS.
Los spikes corrieron sobre Node 24.14.

**Primary Dependencies**:

- Electron + electron-vite, React, `@xyflow/react`, `@xterm/xterm`, zod 4;
- `yaml` (eemeli), justificada en R-04 y Complexity Tracking;
- electron-builder para empaquetar (herramienta de build).

**Storage**:

- Archivos de definición: `.zeko/flows/*.flow.yaml` y `.zeko/config.yaml` en el repositorio.
- Estado de ejecución: SQLite (`node:sqlite`, WAL) en `%LOCALAPPDATA%\Zeko\zeko.db`, con
  `better-sqlite3` como alternativa (R-03, U-01).
- Worktrees en `%LOCALAPPDATA%\Zeko\wt\`.

**Testing**:

- Vitest para unit (core), contrato (contracts) y adaptadores contra el agente simulado
  (`fake-agent`, que reproduce `spikes/*/samples/`).
- Integración Windows (`pnpm test:win`) para cancelación, aislamiento y recuperación, verificadas en
  el filesystem y en la tabla de procesos.
- Nunca se llama a proveedores reales.

**Target Platform**: Windows 10/11 x64 nativo (obligatoria, primera en validarse). Linux x64 está
diseñada y es requerida por FR-064, pero no está verificada (research T-01, U-06). macOS queda
fuera.

**Project Type**: app de escritorio con CLI y motor headless compartido (monorepo pnpm).

**Performance Goals**:

- interacción de UI < 200 ms con 8 nodos de agente activos (NFR-002);
- cambio de estado visible en < 1 s (NFR-003);
- cancelación completa en < 10 s (NFR-004).

**Constraints**:

- el repositorio del usuario no cambia salvo por las ramas `zeko/*` (FR-045);
- sin secretos en archivos, eventos ni logs (NFR-007);
- límites finitos obligatorios (NFR-008);
- solo se terminan procesos del árbol lanzado, nunca por nombre o patrón (decisión 7);
- local-first (Principio II).

**Scale/Scope**: un usuario y una máquina. Flujos del orden de decenas de nodos y hasta 8 o más
agentes concurrentes por proyecto (límite configurable). Historial de cientos de runs.

**NEEDS CLARIFICATION**: ninguno bloquea el diseño. Los puntos abiertos quedan resueltos como
decisiones con supuestos explícitos (research §U) o como datos pendientes de 001c (research §P),
que **bloquean la generación de tareas del adaptador de Codex**, no el resto.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Fuente: `.specify/memory/constitution.md` v1.0.0. Evaluación inicial y re-evaluación
post-diseño:

- [x] **I. Spec manda**: cada componente está trazado a FR/NFR (tabla de trazabilidad abajo). Lo
  que no está en la spec va a diferidos: selección de modelo (D-06), MCP de Zeko (D-01).
- [x] **II. Local-first**: sin servidor ni cuenta de Zeko. Solo sale lo que cada CLI envía a su
  proveedor. `--strict-mcp-config` evita cargar MCPs del usuario en Claude `[001 §1]`, y en Codex se
  deshabilitan los conectores (R-13).
- [x] **III. CLI es el motor**: agentes solo mediante `AgentAdapter`. `core` depende de las
  capacidades, no del id de agente (FR-016).
- [x] **IV. Núcleo headless**: `core` y `runtime` son compartidos por escritorio y CLI (R-01). La
  UI solo pinta `NodeView`, y validación, confinamiento y estados vienen del motor
  ([ipc.md](./contracts/ipc.md)).
- [x] **V. Archivos como verdad**: los flujos y la config están en `.zeko/`. SQLite guarda solo
  runs, eventos, aprobaciones y la instantánea de ejecución (T-12).
- [ ] ⚠ **VI. Estándares abiertos**: la comunicación agente ↔ Zeko es stdout JSON + schema de
  salida, no MCP (T-09) → Complexity Tracking. SKILL.md/AGENTS.md no aplica: la librería de agentes
  está fuera de alcance.
- [x] **VII. Contratos**: `TaskAssignment` y `AgentReport` (= `WorkReport`) definidos una sola vez
  en zod, con `findings` agregado (R-06, T-11).
- [x] **VIII. Aislamiento**: un worktree por nodo de agente y por intento, fuera del repo. Sin
  merge, push ni rebase (FR-047).
- [x] **IX. Permiso ≠ autonomía**: permisos con mecanismos nativos (`--restricted`,
  `--allowedTools`, sandbox de Codex). Las acciones fuera de alcance se **deniegan** en lugar de
  aprobarse; es más estricto (T-10). La detección posterior de alcance parcial está documentada
  (T-04).
- [x] **X. Jerarquía**: el prompt se ordena restricciones de Zeko → política del proyecto → tarea →
  criterios → datos de predecesores (R-23).
- [x] **XI. Seguridad**: sin campos de secretos en el schema, con redactor en eventos (T-08).
  Límites de tiempo, turnos y reintentos obligatorios. Sin ciclos (DAG).
- [x] **XII. Arquitectura**: N/A. El canvas de arquitectura está fuera de alcance.
- [x] **XIII. Observabilidad**: todos los eventos llevan `run_id`. Estados visibles siempre, con
  mapeo a los estados del principio (data-model §3).
- [x] **XIV. Referencias**: sin Orca ni Alera.
- [x] **XV/XVI. Calidad y tests**: TS estricto, errores tipados (`ReasonCode`). Tests unitarios de
  cada regla y adaptadores contra `fake-agent` (R-26).
- [x] **XVII. Performance**: motor fuera del main, streaming por MessagePort, salida agrupada y
  estados inmediatos, 8 o más concurrentes (R-25). `[001 §5]`: 15 `claude` concurrentes sin
  problemas.
- [x] **XVIII. MVP**: un usuario, una máquina, repositorios locales.
- [ ] ⚠ **Stack**: `yaml` es una dependencia fuera del stack → Complexity Tracking. `node-pty` no se
  usa (R-25).

**Resultado**: PASS con dos justificaciones en Complexity Tracking. La re-evaluación post-diseño no
encontró violaciones nuevas.

## Project Structure

### Documentation (this feature)

```text
specs/001-agent-flow-canvas/
├── spec.md
├── plan.md              # este archivo
├── research.md          # decisiones R-01…R-26, tensiones, supuestos, pendientes 001c, diferidos
├── data-model.md        # entidades, NodeResult, estados, SQLite, eventos
├── quickstart.md        # escenarios E2E en Windows
├── contracts/
│   ├── flow-file.md
│   ├── flow-file.example.yaml
│   ├── agent-report.md
│   ├── adapter.md
│   ├── ipc.md
│   └── cli.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (no lo genera este comando)
```

### Source Code (repository root)

```text
package.json                 # pnpm workspaces, scripts: build, test, test:win, lint
pnpm-workspace.yaml
tsconfig.base.json           # strict, ESM

packages/
├── contracts/               # zod: única fuente de tipos. Depende solo de zod
│   └── src/ flow-file · project-config · agent-report · task-assignment · adapter
│            (capabilities, launch-spec, normalized-event, process-outcome) · node-result
│            · run · events · ipc · cli-events · codes (ReasonCode, WarningCode)
├── core/                    # dominio puro. Depende de contracts. Sin fs, child_process ni sqlite
│   └── src/ validation/ (grafo, ciclos, codeSource, límites)
│            scheduler/ (máquina de estados de Run y NodeRun, listos, slots, retención, propagación)
│            result/ (resolveNodeResult, discrepancias)
│            policy/ (confinamiento, advertencias por capacidades, reintentos, totales de costo)
│            prompt/ (render de TaskAssignment, bloque de predecesores como datos)
│            engine/ (RunEngine: orquesta a través de puertos AgentAdapter, Workspace, RunStore, Clock)
├── adapters/                # depende de contracts
│   └── src/ process/ (supervisor: spawn, instantáneas del árbol, kill por (pid, creationTime))
│            claude-code/ (flags, parser stream-json → NormalizedEvent, outcome, cancelación en 2 fases)
│            codex/ (contrato de comportamiento; flags pendientes de 001c)
│            fake/ (adaptador simulado)
│       test/fake-agent/ (ejecutable que reproduce spikes/*/samples/)
├── git/                     # CLI de git: worktree add/remove, commit del motor, diff, status, rev-parse
├── storage/                 # SqlDriver (node:sqlite | better-sqlite3), migraciones, repositorios, leases
├── i18n/                    # catálogo en.json + t(); usado por desktop y cli (NFR-013)
└── runtime/                 # raíz de composición: createZekoRuntime() = core + adapters + git + storage
                             # + recuperación al arrancar; API común para desktop y cli

apps/
├── desktop/                 # electron-vite
│   └── src/ main/ (ventanas, MessageChannelMain, diálogos, ciclo de vida del engine host)
│            engine-host/ (entrada del utilityProcess: importa runtime y atiende el MessagePort)
│            preload/ (contextBridge: request/onEvent)
│            renderer/ (React, @xyflow/react canvas, panel de nodo, xterm de solo lectura,
│                       historial, diálogos de aprobación y confirmación; sin reglas)
└── cli/                     # zeko validate|run|runs|workspaces|agents; TTY para aprobaciones
```

**Structure Decision**: es la estructura del pedido con dos paquetes más.
`packages/runtime` garantiza que CLI y escritorio usen **exactamente** el mismo motor ya compuesto
(FR-059, SC-008). `packages/i18n` es el catálogo único de textos (NFR-013). El supervisor de
procesos va dentro de `adapters` porque lo comparten los adaptadores y es código de SO. Las
dependencias van en una sola dirección: `contracts ← core ← runtime → {adapters, git, storage} ←
apps`, y `core` nunca importa infraestructura (Principio IV, stack de la constitución). Detalle en
research R-01 y R-02.

## Arquitectura

```text
┌──────────── apps/desktop ────────────┐          ┌──── apps/cli ────┐
│ renderer (React/xyflow/xterm)        │          │ TTY / NDJSON     │
│        │ MessagePort (zod)           │          │                  │
│ main ──┼── crea canal, diálogos      │          │                  │
│        ▼                             │          │                  │
│ engine-host (utilityProcess) ────────┼──┐    ┌──┼──────────────────┘
└──────────────────────────────────────┘  ▼    ▼
                                   packages/runtime
                      ┌──────────────┼──────────────┬──────────────┐
                      ▼              ▼              ▼              ▼
                packages/core   adapters        packages/git   packages/storage
                (reglas puras)  (claude/codex/  (worktrees,    (SQLite: runs, eventos,
                                 fake + supervisor) commits, diff)  leases, árbol de procesos)
                      ▲
               packages/contracts (zod) ── packages/i18n (textos)
```

## Flujo de ejecución de un run

Cada paso indica los requisitos que cumple. El detalle de cada decisión está en research.

1. **Inicio explícito** (FR-024, NFR-006): `run.start` desde la UI o `zeko run` desde la CLI. No
   existe ningún disparador automático.
2. **Carga y validación** (FR-009, FR-057): se parsea el YAML y se valida con zod y con las reglas
   de grafo (ciclos, entrada única, conectividad, `MULTIPLE_CODE_SOURCES`, límites). Si hay errores
   no se crea el run.
3. **Repositorio**:
   - `rev-parse HEAD` → `baseCommit`; sin commits, se aborta;
   - `status --porcelain` → aviso de cambios no incluidos (casos límite).
4. **Verificación previa** (FR-025, FR-065): `detect()` de cada agente que usa el flujo. Informa la
   forma de autenticación efectiva por nodo. Si falta alguno, se aborta con la lista.
5. **Creación del run** (FR-060, FR-063): fila `runs` con la instantánea del flujo, `origin` y
   `host_pid`, un NodeRun `pending` por nodo con su confinamiento y advertencias fijados, y el
   evento `run.started`.
6. **Bucle del scheduler** (función pura `nextActions(state)`, R-17, R-21), ante cada evento:
   - **Entrada**: pasa a `completed` y su resultado es `objective` (FR-010).
   - **Aprobación lista** (predecesores completados o aprobados): pasa a `waiting_approval` con el
     resumen `PredecessorResult[]` (FR-012). No toma slot.
   - **Agente listo**:
     - consulta la retención por uso (`usageGate`; Codex refresca con `readUsage()`). Si retiene,
       queda `pending` con `hold` (FR-053);
     - si no, toma un lease de slot en SQLite (FR-027) y ejecuta el nodo (paso 7).
   - **Propagación**: cuando un nodo termina `blocked`, `failed`, `cancelled` o `rejected`, sus
     descendientes pendientes pasan a `skipped` con motivo (FR-031).
7. **Ejecución de un nodo de agente**:
   1. `baseCommit` del nodo = `resultCommit` de su única fuente de código, o `baseCommit` del run
      (R-22, FR-041).
   2. `git worktree add -b zeko/<run8>/<node> <wt> <base>` fuera del repo (R-15, FR-043, FR-044).
      Si falla, el nodo queda `failed` con `WORKSPACE_CREATE_FAILED`.
   3. Render del `TaskAssignment`: restricciones → tarea → criterios → resultados de predecesores
      como datos → sección de reporte (R-16, R-23, FR-040, FR-042).
   4. `adapter.launch(LaunchSpec)` con los flags de R-08 y R-10. El supervisor registra el árbol en
      `process_tree` (R-14). El motor arma el temporizador de `timeoutMinutes` (R-11).
   5. Streaming: `NormalizedEvent` → `events` (lotes ≤ 50 ms) → `node.output` a UI o CLI (FR-029,
      FR-063). `subscription_usage` → `agent_usage` → el scheduler revalúa las retenciones.
   6. `completion` → `ProcessOutcome` + `ReportCandidate` (R-09).
   7. Si el outcome es limpio y el reporte es `absent` o `invalid`: **un** `requestReport` (fork de
      sesión) en el mismo worktree (FR-038, R-16).
   8. Si el outcome es `agent_error`/`crashed` y quedan reintentos: se descarta el worktree del
      intento y se vuelve a 7.2 desde la misma base. Si es `infra_failure`, se relanza con el
      presupuesto de infraestructura, sin consumir `maxRetries` (R-18).
   9. Si no fue cancelado ni interrumpido: `git add -A` + commit del motor → `resultCommit` (R-15).
      Luego `observedFiles` = diff `base..result` con la marca `eolOnly` (R-07).
   10. `resolveNodeResult(...)` → `NodeResult` (FR-036 en orden, FR-037, FR-023) → se persiste y
       se emite `node.result`. El lease se libera.
8. **Cancelación** (FR-030, NFR-004):
   - de nodo: `adapter.cancel('user')`. Claude: interrupt y luego árbol. Codex: árbol forzado. El
     supervisor verifica que no quede ningún proceso, y el nodo queda `cancelled` con el worktree
     `untrusted` y sin commit (FR-049);
   - de run: se cancelan todos los nodos en curso, las aprobaciones pendientes pasan a `cancelled` y
     los pendientes a `skipped`.
9. **Aprobación** (FR-012, FR-031): `approval.decide` o la respuesta en la TTY. `approved` libera
   a los dependientes; `rejected` omite solo esa rama.
10. **Fin** (FR-050, FR-051, FR-060):
    - cuando todos los NodeRuns son terminales: `run.finished` con `outcome` y totales (`partial` y
      `estimated`);
    - al cerrar la app o en un crash: `interrupted`, con la recuperación de R-20.

## Decisiones y restricciones principales

| # | Decisión | Evidencia | Cubre |
|---|---|---|---|
| 1 | Motor en `utilityProcess`; `runtime` compartido con la CLI | R-01 | FR-059, NFR-002/003, SC-008 |
| 2 | Resultado en tres capas; FR-036 solo en `resolveNodeResult` (pura, por capacidades) | R-05; `[001 §3]`, `[001b §A1]` | FR-016, FR-033–039, SC-005 |
| 3 | `AgentReport` estricto-compatible: siempre BLOCKED/FAILED, sin cardinalidad ni longitud, más `findings` | R-06; `[001b §A3]` | FR-033–035 |
| 4 | `filesChanged` observado por git después del commit del motor | R-07; `[001 §8]` | FR-037, FR-046 |
| 5 | Claude: stream-json + `--restricted` + allowlist por plataforma + `--json-schema` + `--max-turns` | R-08–R-11; `[001 §1,§6]`, `[001b §A,§B]` | FR-017–023, FR-032 |
| 6 | Claude: cancelación con interrupt por stdin (5 s) y luego árbol | R-12; `[001 §7]` | FR-030, NFR-004 |
| 7 | Codex: comportamiento de la decisión 5; flags pendientes de 001c | R-13; `[001c-resumen]`, `[spec-clar]` | FR-017–023, FR-030, FR-050–053, FR-065, FR-066 |
| 8 | Supervisor de procesos: solo el árbol lanzado, `(pid, creationTime)`, nunca por nombre | R-14; `[001 §7]`, `[001c-resumen]` | FR-030, FR-062 |
| 9 | Worktree por nodo e intento fuera del repo; commits del motor; base = fuente de código; sin reescribir EOL | R-15, R-22; `[001 §8]` | FR-008, FR-041, FR-043–049 |
| 10 | Inyectar resultados; fork de sesión solo para pedir el reporte | R-16; `[001 §4]` | FR-038, FR-040–042 |
| 11 | Retención por uso por agente; costo de Claude marcado como estimado (precio de lista) | R-17; `[001 §2]`, `[sample: result.success.json]` | FR-050–053, SC-009 |
| 12 | Reintentos solo por error de ejecución; reintentos de infraestructura aparte | R-18 | FR-032, NFR-008 |
| 13 | SQLite `node:sqlite` (alternativa `better-sqlite3`), base por usuario, leases entre procesos | R-03, R-21 | FR-027, FR-060–063, NFR-005 |
| 14 | Flujo en YAML canónico; config en `.zeko/config.yaml` | R-04 | FR-054–058, SC-007 |
| 15 | Textos solo desde `packages/i18n`; el motor emite códigos | R-24 | NFR-013 |

**Restricciones que el plan no puede levantar** (se muestran en la UI y están documentadas):

- la shell no está confinada con `--restricted` (R-10, `[001b §B2]`);
- los comandos de solo lectura se auto-aprueban (T-05);
- el alcance parcial es solo detección hasta cerrar U-02 (T-04);
- la autenticación de Claude no se verifica antes del run hasta cerrar U-03 (T-07);
- Linux no está verificado (T-01).

## Trazabilidad FR/NFR → componentes

| Requisitos | Componente principal | Contrato |
|---|---|---|
| FR-001–003 | runtime (proyecto), git (rev-parse) | ipc `project.open` |
| FR-004–009, FR-054–058 | contracts (FlowFile), core/validation, runtime (fs, watcher) | flow-file, ipc `flow.*`, cli `validate` |
| FR-010–012 | contracts, core/scheduler, core/prompt | flow-file, ipc `approval.*` |
| FR-013–016 | core (por capacidades), adapters | adapter (matriz) |
| FR-017–023 | adapters (flags), core/policy (confinamiento, advertencias), core/result (regla 4) | adapter, ipc `NodeView` |
| FR-024–032 | core/scheduler + engine, adapters/process, storage/leases | ipc `run.*`, cli `run` |
| FR-033–039 | contracts (AgentReport), core/result | agent-report, data-model §NodeResult |
| FR-040–042 | core/prompt | agent-report §Uso posterior |
| FR-043–049 | git, core/engine | data-model (Workspace), ipc `node.diff`, `workspaces.delete` |
| FR-050–053 | adapters (usage), core/policy (totales, retención) | adapter, ipc `agent.usage` |
| FR-059 | apps/cli + runtime | cli |
| FR-060–063 | storage, runtime (recuperación) | data-model §4–5, ipc `run.list` |
| FR-064, NFR-001 | adapters (reglas por plataforma), supervisor | adapter (matriz por plataforma) |
| FR-065, FR-066 | adapters/codex `detect()`, capacidades | adapter |
| NFR-002/003 | engine host, IPC agrupado, renderer | ipc |
| NFR-004, SC-003 | adapters/process | adapter `cancel` |
| NFR-005 | storage (WAL, FULL) | data-model §4 |
| NFR-006–009 | core/validation (límites), contracts (schema estricto), redactor | flow-file |
| NFR-010–012 | renderer (defaults, NodeView) | ipc |
| NFR-013 | i18n | — |

## Orden sugerido de implementación (insumo para `/speckit-tasks`)

1. **Gates de verificación**:
   - U-01 (`node:sqlite` en Electron);
   - mini-spike 001d para U-02, U-03, U-04 y U-07;
   - incorporar 001c al repo (P-01…P-10).
2. `contracts` → `core` (validación, `resolveNodeResult`, scheduler) con tests unitarios completos.
3. `adapters/process` + `fake-agent` + tests de integración de cancelación en Windows.
4. `git` + `storage` + `runtime` → `apps/cli` (camino headless completo con el adaptador simulado).
5. Adaptador `claude-code` contra los samples de 001 y 001b.
6. `apps/desktop` (canvas, panel de nodo, salida, historial, aprobaciones).
7. Adaptador `codex` una vez resuelto §P.
8. Quickstart manual en Windows y después en Linux.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Principio VI: la comunicación agente ↔ Zeko no usa MCP | El único canal verificado es stdout stream-json + schema de salida (`[001 §2, §5]`, `[001b §A]`). El resultado lo decide el motor desde el proceso y git, no un canal del agente. | Un servidor MCP de Zeko (D-01) exige diseñar y verificar un servidor y su confinamiento. La decisión 10 del pedido lo difiere. Se retoma para los nodos de Codex sin terminal. |
| Dependencia de runtime `yaml` fuera del stack | Archivo de flujo legible y editable a mano, con comentarios y errores con línea y columna (FR-056, FR-057; R-04). | Con JSON (sin dependencias) las instrucciones multilínea quedan escapadas, no hay comentarios y las ediciones a mano son propensas a errores. Escribir un parser YAML propio viola XV. |
| (Condicional) `better-sqlite3` como módulo nativo | Solo si U-01 descarta `node:sqlite`. | `sql.js` pierde durabilidad (NFR-005). |
| Paquetes extra `runtime` e `i18n` | Mismo motor en escritorio y CLI (SC-008); catálogo único (NFR-013). | Componer el motor en cada app duplica lógica (XV). Poner los textos en `contracts` mezcla presentación con schemas. |
