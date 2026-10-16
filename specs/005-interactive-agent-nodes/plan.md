# Implementation Plan: Nodos interactivos de agente

**Branch**: `feature/interactive-nodes` (directorio de feature `005-interactive-agent-nodes`) | **Date**: 2026-09-28 | **Updated**: 2026-10-16 (comunicación entre agentes) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-interactive-agent-nodes/spec.md`

**Insumos**: el diseño de 001 (`specs/001-agent-flow-canvas/`: plan, research R-01…R-28,
data-model y contracts), que esta feature **extiende**; los spikes `001`, `001b`, `001c`, `001d` y
`001e`; el código actual de terminales (`apps/desktop/src/main/pty-manager.ts`,
`apps/desktop/src/renderer/terminal/node-terminal.tsx`, `apps/desktop/test/pty-manager.test.ts`); y,
desde el 2026-10-16, el análisis de `eneskirca/nodeterm` como **referencia de diseño** para la
comunicación entre agentes (research `[ref-nodeterm]`; no se copia código, T5-14).

## Summary

Un nodo `interactive` del flujo pone al usuario a conversar con Claude Code o Codex en la terminal
del nodo, dentro de un run:

1. Cuando el nodo queda listo, pasa a `waiting_user` sin lanzar nada.
2. El usuario abre la sesión y trabaja en la TUI del agente, que corre en la copia aislada del nodo.
3. Termina declarando el estado o saliendo del agente. El motor commitea, observa los archivos con
   git y resuelve el estado final con la misma función de 001.
4. Los sucesores reciben un `PredecessorResult` con la misma forma que el de un nodo de agente, y la
   recap del agente como resumen.

**Desde el 2026-10-16**, los agentes de distintos nodos se comunican en tres niveles, todos por un
**puente agente ↔ Zeko**:

1. **Lectura a pedido** (`zeko_get_context`, `zeko_list_links`, `zeko_read_node`): el agente lee el
   estado, el resultado y la actividad reciente de los nodos enlazados, y su propio contexto. Nada se
   empuja a la conversación.
2. **Mensajes** (`zeko_send_message`) entre nodos interactivos enlazados. Zeko los escribe en la
   terminal del destino solo cuando ese agente espera entrada y el usuario no dejó texto sin enviar.
   Si no, los encola. Van enmarcados, con acuse, límites y apagados por defecto.
3. **Orquestación** (`zeko_spawn_children`): un nodo interactivo crea **lotes de hijos** de agente no
   interactivo dentro del run. Los hijos tienen un alcance contenido en el del padre, el usuario
   confirma cada lote y cada hijo parte de una instantánea del padre en su propio worktree. Zeko
   nunca integra ramas.

El enfoque técnico:

- **La sesión pasa del proceso principal al engine host**, para que el motor controle ciclo de vida,
  tiempo, cancelación e interrupción (R5-01).
- **El agente es la raíz del PTY**, sin shell intermedia, con el binario nativo y restricciones duras
  por flag (R5-02).
- **La recap se lee de los archivos de sesión del agente**, nunca de la terminal (R5-04), con la ruta
  que informa el propio agente por hooks (R5-17).
- **`resolveNodeResult` agrega una capa de declaración**, sin duplicar reglas (R5-08).
- **La reapertura continúa en la misma copia**, invalida los dependientes y los reejecuta con
  confirmación (R5-07).
- **Puente** (R5-16):
  - un `BridgeServer` en el engine host sobre named pipe;
  - un ejecutable `zeko-bridge` que el agente lanza como **hook** (avisos de actividad) y como
    **servidor MCP** stdio (herramientas);
  - una credencial HMAC por sesión.
- **Actividad por hooks, nunca por la pantalla** (R5-17): una sola fuente para badges, entrega de
  mensajes, avisos y cierre tras declaración.
- **Archivos sin locks** (R5-22): un worktree por nodo y por hijo, instantánea del orquestador con
  índice temporal (sin tocar su `HEAD` ni su índice), integración hecha por el agente o el usuario y
  rutas compartidas por junction.

Ningún spike ejercitó los agentes en modo interactivo, ni sus hooks, `notify` o servidores MCP en la
TUI. Por eso los adaptadores declaran **valores conservadores** hasta que el mini-spike **005a**
(research §S, Q1–Q24) los verifique. La feature es funcional y segura antes de 005a, y la
comunicación se construye y prueba completa con el **agente simulado**. Lo que no se promete con
agentes reales hasta cerrar 005a: confinamiento, recap, reanudación, "salida normal = completado",
actividad, herramientas de Zeko y entrega de mensajes.

## Technical Context

**Language/Version**: TypeScript 5.x estricto, ESM, Node.js 24 LTS (igual que 001).

**Primary Dependencies**: las de 001, más:

- `node-pty` (ya en el stack de la constitución y ya usado hoy en el main) pasa a cargarse en el
  engine host (`utilityProcess`);
- `@xterm/xterm` y `@xterm/addon-fit` en el renderer, como hoy;
- **nueva**: `@modelcontextprotocol/sdk`, solo en `apps/bridge` (servidor MCP stdio). Ver Complexity
  Tracking;
- **empaquetado nuevo**: `zeko-bridge` como Node single executable application. No agrega
  dependencias de runtime: usa el Node de la toolchain.

**Storage**: SQLite de 001 con la migración `002_interactive` (data-model §4), que incluye
`spawn_batches`, `spawned_nodes` y las columnas de origen y actividad. No guarda transcripciones,
logs crudos de sesiones interactivas ni texto de mensajes (FR-028).

**Testing**: Vitest (unit de `core`, contratos, adaptadores y puente contra el agente simulado en
modo interactivo y `bridge`) e integración Windows (`pnpm test:win`) para cancelación, aislamiento,
interrupción, latencia, instantánea y junctions. Nunca proveedores reales (Principio XVI).

**Target Platform**: Windows 10/11 x64 nativo (NFR-001). Linux no es requisito de 005; el diseño no lo
impide (socket Unix en lugar de named pipe, symlink en lugar de junction), pero nada de lo
interactivo está verificado ahí.

**Project Type**: app de escritorio con motor headless compartido con la CLI (monorepo pnpm de 001),
más un ejecutable auxiliar `zeko-bridge`.

**Performance Goals**:

- eco de tecleo < 100 ms en **todas** las pulsaciones medidas con 4 sesiones interactivas y 8 nodos
  no interactivos (NFR-002, NFR-003, SC-003);
- cancelación completa < 10 s (NFR-004);
- mensaje a destino listo < 2 s (NFR-007);
- aviso de actividad ≤ 500 ms para el agente (NFR-008);
- lectura < 2 s (NFR-010).

**Constraints**:

- el repositorio original no cambia salvo ramas `zeko/*`, refs `refs/zeko/snapshots/*` y rutas
  compartidas declaradas (FR-012, SC-006);
- solo se termina el árbol adoptado del segmento, por `(pid, creationTime)`, nunca por nombre o
  patrón (R-14). El hook y el servidor MCP son parte de ese árbol;
- no se persiste la salida del PTY, la transcripción ni el texto de los mensajes (FR-028);
- Zeko escribe en la terminal de un agente **solo** para entregar mensajes y avisos con las
  compuertas de R5-20 (FR-017, FR-037, NFR-006);
- modelo explícito siempre (FR-002), también en cada hijo (FR-045);
- no se toca la configuración global del usuario: settings, hooks y MCP son por sesión (NFR-009).

**Scale/Scope**: un usuario y una máquina (Principio XVIII). Al menos 4 sesiones interactivas
simultáneas, una por nodo (FR-009), además del límite de 8 nodos no interactivos, que **incluye a
los hijos** (R-21). Hasta 16 hijos por orquestador y run.

**NEEDS CLARIFICATION**: ninguno bloquea el diseño. Lo no verificado está en research §U
(U5-01…U5-24) con valores conservadores definidos, y lo cierra el mini-spike 005a (research §S), que
bloquea solo las tareas indicadas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Fuente: `.specify/memory/constitution.md` v1.0.0. Evaluación inicial y re-evaluación post-diseño,
rehechas el 2026-10-16 con la comunicación entre agentes.

- [x] **I. Spec manda**: cada componente está trazado a FR/NFR (tabla de trazabilidad abajo). Lo que
  existe hoy y no está en la spec se retira: terminal `shell` suelta y terminal de agente en modo
  edición (research §I, I-09).
- [x] **II. Local-first**: sin servidor ni cuenta de Zeko. El puente es un named pipe local con ACL
  de usuario, sin TCP. La recap y las lecturas se toman de archivos locales del agente.
- [x] **III. CLI es el motor**: la sesión es la TUI del propio agente; Zeko no reimplementa chat.
  Hooks, `notify`, MCP y formatos de sesión se traducen en operaciones puras del adaptador
  ([contracts/adapter.md](./contracts/adapter.md)). `core` no conoce ids de agente.
- [ ] ⚠ **IV. Núcleo headless**: todas las reglas (validación, estados, tiempo, declaración,
  resultado, reapertura, actividad, compuertas de mensajes, validación de lotes, enlaces) viven en
  `core` y se prueban sin UI. Pero FR-029 hace que la CLI **rechace** flujos con nodos interactivos,
  contra "todo flujo del canvas MUST poder ejecutarse desde la CLI" → Complexity Tracking + enmienda
  MAJOR propuesta (R5-10), a aplicar antes de `/speckit-tasks`.
- [x] **V. Archivos como verdad**: el nodo interactivo, `orchestration`, `communication` y `links` se
  guardan en `.zeko/flows/*.flow.yaml`, y `sharedPaths` en `.zeko/config.yaml`. Los hijos son estado
  de ejecución del run y pasan al archivo solo con "Guardar en el flujo" (T5-13).
- [ ] ⚠ **VI. Estándares abiertos**: **resuelto en lo principal**. Lectura, mensajes y orquestación
  usan MCP (R5-18), y la actividad usa los hooks nativos de cada agente. Queda fuera de alcance el
  **resultado** estructurado por MCP (aclaración del 2026-09-28) → Complexity Tracking solo por eso.
- [x] **VII. Contratos**: el resultado del nodo interactivo tiene la forma de `AgentReport` /
  `PredecessorResult` de 001. Las herramientas, avisos, resultados de mensajes y problemas de lotes
  tienen schema zod único ([contracts/bridge.md](./contracts/bridge.md)). Los hijos usan el schema de
  `AgentNode` de 001.
- [x] **VIII. Aislamiento**: un worktree por NodeRun interactivo y por hijo, fuera del repositorio.
  La instantánea no toca la copia del orquestador. Commits del motor, sin merge, push ni rebase de
  Zeko; la integración de ramas de hijos la hace el agente o el usuario en su propia copia (R5-22).
- [ ] ⚠ **IX. Permiso ≠ autonomía**:
  - los límites duros van por flags que una aprobación no puede levantar, y lo que el agente no
    admite se muestra (R5-02);
  - los hijos nunca exceden al padre, y la confirmación de lotes está activada por defecto (T5-11);
  - pero la shell de Claude sigue sin confinar `[001b §B2]` y la escritura fuera de un alcance
    parcial solo se detecta al cerrar → mismo caso que 001, Complexity Tracking.
- [x] **X. Jerarquía**: Zeko no inyecta nada por su cuenta en la conversación. Los mensajes y avisos
  son datos por debajo del usuario (FR-043, T5-10). El plan del orquestador opera dentro de su
  configuración. El orquestador nunca revierte cambios de la sesión: los archivos de permisos se
  **excluyen** del commit, no se revierten (R5-05, T5-04).
- [x] **XI. Seguridad**:
  - sin secretos en el flujo (schema estricto);
  - recap, eventos, lecturas y mensajes redactados (R5-11, R5-19, R5-20);
  - la salida de agentes, las lecturas y los mensajes son datos (R-23, C5-15);
  - límite de tiempo obligatorio y finito por nodo y por hijo;
  - límites de mensajes (par, turno, nodo), `maxChildren` y profundidad 1 (T5-12);
  - modelo de amenazas en R5-23;
  - la espera en `waiting_user` no tiene límite, como `waiting_approval` en 001 (T5-05).
- [x] **XII. Arquitectura**: N/A (canvas de arquitectura fuera de alcance).
- [x] **XIII. Observabilidad**: eventos nuevos con `run_id` (data-model §5), incluidos actividad,
  rechazos del puente, llamadas a herramientas, entregas y lotes. `waiting_user` es visible y se
  mapea a "waiting approval" (T5-06). La actividad del agente es visible en el nodo (FR-030).
- [x] **XIV. Referencias**: sin dependencias de Orca ni Alera. nodeterm (BUSL-1.1) es solo
  referencia de diseño, citada como `[ref-nodeterm]`, sin código copiado (T5-14).
- [x] **XV/XVI. Calidad y tests**: TS estricto, errores tipados (`ReasonCode`, códigos IPC, códigos
  del puente). Tests unitarios de cada regla nueva, propiedades del saneador y adaptadores y puente
  contra el agente simulado (R5-15).
- [x] **XVII. Performance**:
  - salida del PTY en streaming por un puerto dedicado, ≤ 8 ms;
  - medición explícita de NFR-002 con carga (R5-01);
  - la entrega de mensajes no retiene la entrada del usuario (R5-20);
  - los hijos usan los 8 slots de 001.
- [x] **XVIII. MVP**: un usuario, una máquina, repositorios locales; sin compartir sesiones ni
  comunicación entre máquinas.
- [ ] ⚠ **Stack**: `@modelcontextprotocol/sdk` está fuera del stack listado → Complexity Tracking
  (T5-15).

**Resultado**: PASS con cuatro justificaciones en Complexity Tracking (Principios IV, VI —reducida—,
IX y Stack). La del Principio IV requiere además la enmienda de R5-10 antes de generar tareas.

## Project Structure

### Documentation (this feature)

```text
specs/005-interactive-agent-nodes/
├── spec.md
├── plan.md              # este archivo
├── research.md          # inventario (§I), R5-01…R5-23, cambios a 001 (§C), tensiones (§T),
│                        # supuestos (§U) y mini-spike 005a (§S)
├── data-model.md        # solo cambios respecto de 001
├── quickstart.md        # escenarios de validación en Windows (1–15)
├── contracts/
│   ├── flow-file.md
│   ├── flow-file.example.yaml
│   ├── adapter.md
│   ├── bridge.md        # puente: avisos, herramientas MCP, marco de mensajes, resultados
│   ├── ipc.md
│   └── cli.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (no lo genera este comando)
```

### Source Code (repository root)

Misma estructura de 001 más `apps/bridge`. Solo se listan los archivos que cambian o se agregan.

```text
packages/
├── contracts/src/
│   ├── flow-file.ts          # + InteractiveNodeSchema (con orchestration), communication, links
│   ├── project-config.ts     # + workspace.sharedPaths
│   ├── run.ts                # + waiting_user, generation, declaration, summary, origin, parent, children
│   ├── codes.ts              # + ReasonCode, WarningCode, DiagnosticCode de 005
│   ├── events.ts             # + session.*, node.declared, node.reopened, rerun.*, message.*, spawn.*, …
│   ├── ipc.ts                # + métodos de sesión, mensajes, lotes y TerminalMessage
│   ├── task-assignment.ts    # PredecessorResult: + nodeType, declaration, summaryState, children
│   ├── ports.ts              # + TerminalPort, BridgePort (lo implementa el escritorio)
│   ├── bridge/               # BridgeRequest/Response, ActivityEvent, ZekoTool*, MessageOutcome,
│   │                         #   SpawnBatchInput/Output, SpawnProblem
│   └── adapter/              # + interactive-capabilities (activitySource, zekoTools, messaging),
│                             #   interactive-launch (bridge, files), recap, session-ref;
│                             #   ProcessOutcome.killed.by + 'declaration'
├── core/src/
│   ├── validation/           # + host 'desktop'|'cli', INTERACTIVE_NODE_REQUIRES_DESKTOP, modelo
│   │                         #   obligatorio, links, communication, orchestration
│   ├── policy/confinement.ts # + confinamiento interactivo por capacidades
│   ├── result/               # + capa Declaration en resolveNodeResult; COMPLETED_WITHOUT_CHANGES
│   ├── state/                # + waiting_user, reapertura, finished → running, RERUN_CONFIRMATION,
│   │                         #   lotes e hijos
│   ├── scheduler/            # + acción await_user; sin slot para interactivos; hijos como nodos
│   ├── engine/               # + InteractiveNodeController (apertura, temporizador, declaración,
│   │                         #   cierre, commit, reapertura, invalidación) + OrchestrationController
│   │                         #   (lotes, confirmación, avisos, fin del orquestador)
│   ├── comm/                 # NUEVO, todo puro:
│   │   ├── activity.ts       #   reduceActivity
│   │   ├── links.ts          #   resolveLinks
│   │   ├── tools.ts          #   toolsExposedFor, authorizeTool
│   │   ├── delivery.ts       #   decideDelivery, MESSAGE_RETRYABLE
│   │   ├── flow-control.ts   #   reserveFlow (par, turno, nodo)
│   │   ├── queue.ts          #   política de cola (capacidad, vencimiento, una entrega por ciclo)
│   │   ├── envelope.ts       #   buildEnvelope, oneLine, sanitizeMessageBody, frameLineRe
│   │   ├── notices.ts        #   tabla cerrada de avisos de Zeko
│   │   └── spawn.ts          #   validateSpawnBatch, contención de globs, superposición
│   └── prompt/               # PredecessorResult de interactivos y de orquestadores (misma forma)
├── adapters/src/
│   ├── process/supervisor.ts # + adopt(pid)
│   ├── claude-code/interactive.ts  # buildInteractiveLaunch (+ --settings, --mcp-config),
│   │                               #   classifyInteractiveExit, locateSession, readRecap, isBusy,
│   │                               #   normalizeActivityEvent, readConversationTail
│   ├── codex/interactive.ts        # ídem (+ -c notify, -c mcp_servers), watchSessionFile
│   └── fake/                 # + modo interactivo y modo bridge
│       test/fake-agent/      # + modo interactive (eco, archivo de sesión, nietos) y bridge
│                             #   (avisos, cliente MCP, DECSET 2004, registro de entradas)
├── git/src/
│   ├── engine-commit.ts      # + exclusión de permissionPersistencePaths
│   ├── snapshot.ts           # NUEVO: instantánea con índice temporal + refs/zeko/snapshots
│   ├── shared-paths.ts       # NUEVO: junctions de sharedPaths y desvinculación segura
│   └── cleanup.ts            # + desvincular junctions antes de borrar; borrar refs de instantáneas
├── storage/src/
│   ├── migrations/002_interactive.ts   # + spawn_batches, spawned_nodes, columnas de origen/actividad
│   └── repos/                # + node-results, spawn-batches, spawned-nodes
├── runtime/src/              # composición: TerminalPort y BridgePort opcionales (solo escritorio);
│                             #   recovery: marca mensajes encolados como vencidos e hijos interrumpidos
└── i18n/src/en.json          # textos de estados, motivos, advertencias, actividad, mensajes y lotes

apps/
├── bridge/                   # NUEVO: ejecutable zeko-bridge (Node SEA)
│   ├── src/main.ts           #   subcomandos `hook <agente>` y `mcp`
│   ├── src/hook.ts           #   stdin → pipe; fail-open en ≤ 500 ms
│   ├── src/mcp.ts            #   servidor MCP stdio (@modelcontextprotocol/sdk) → pipe
│   ├── src/pipe-client.ts    #   protocolo de bridge.md
│   └── sea-config.json       #   empaquetado
├── desktop/src/
│   ├── main/index.ts                 # − PtyManager y canales terminal.*; + segundo MessageChannel
│   ├── main/pty-manager.ts           # se elimina (research I-01…I-07, I-15)
│   ├── preload/index.ts              # − terminal.* por ipcRenderer; + zeko.terminal.post/onMessage
│   ├── engine-host/interactive-session-host.ts  # node-pty, buffer de reenganche, TerminalPort,
│   │                                            #   seguimiento de DECSET 2004 y texto sin enviar,
│   │                                            #   entrega de mensajes (paste + Enter)
│   ├── engine-host/bridge/server.ts  # NUEVO: named pipe, protocolo, límites
│   ├── engine-host/bridge/credentials.ts  # NUEVO: secreto del host, tokens por sesión, archivos
│   ├── engine-host/bridge/routes.ts  # NUEVO: hook → adaptador → reduceActivity; tool → authorizeTool → motor
│   ├── engine-host/dispatch.ts       # + métodos de sesión, mensajes y lotes
│   ├── renderer/terminal/node-terminal.tsx      # transporte al puerto de terminal; sin cwd/kind/modelo
│   ├── renderer/panels/node-dock.tsx            # − selector de kind, shell, "pegar instrucciones";
│   │                                            # + contexto con "Copiar", declarar fin, cancelar,
│   │                                            #   reabrir, actividad, cola de mensajes, pausa
│   ├── renderer/canvas/                         # + nodo interactive, waiting_user, enlaces
│   │                                            #   (línea punteada), hijos dentro del marco del
│   │                                            #   orquestador, "Guardar en el flujo"
│   ├── renderer/dialogs/                        # + confirmación de lote, fin del orquestador con hijos
│   └── test/                                    # − pty-manager.test.ts; + sesión, latencia, puente
└── cli/src/                          # validación con host 'cli' (sin lógica propia)
```

**Structure Decision**: la de 001 más `apps/bridge`. `node-pty`, el named pipe y las credenciales
quedan en `apps/desktop/src/engine-host/` detrás de `TerminalPort` y `BridgePort`, así que `core`,
`runtime`, `adapters` y la CLI no los cargan (Principio IV, R5-01, R5-16). El SDK de MCP queda
confinado a `apps/bridge`: el motor habla con el puente por el protocolo de líneas JSON de
[bridge.md](./contracts/bridge.md), no por MCP. Las operaciones de los adaptadores y todas las reglas
de comunicación son puras, para probarlas sin PTY ni pipe.

## Arquitectura

```text
┌──────────────────────────────── apps/desktop ─────────────────────────────────┐
│ renderer: canvas (nodos, enlaces, hijos) · NodeDock (contexto, actividad,      │
│           cola, declarar, cancelar, reabrir) · diálogos (lote, fin) · xterm    │
│    │ puerto de control (zeko.request/onEvent)      │ puerto de terminal        │
│ main: crea los DOS MessageChannel; ya no tiene PTY ni canales terminal.*      │
│    ▼                                               ▼                          │
│ engine host (utilityProcess)                                                  │
│   runtime ── core (InteractiveNodeController, OrchestrationController,        │
│      │            resolveNodeResult, scheduler, comm/*)                       │
│      │            │ TerminalPort                │ BridgePort                  │
│      │            ▼                             ▼                             │
│      │   InteractiveSessionHost ◀─entrega──  BridgeServer ◀── \\.\pipe\zeko-…  │
│      │   node-pty · ConPTY                       ▲                            │
│      │      │                                    │                            │
│      │      ▼                                    │                            │
│      │   claude.exe / codex.exe ─ hooks/notify ─▶ zeko-bridge hook ───────────┤
│      │      └──────────── MCP stdio ───────────▶ zeko-bridge mcp ─────────────┘
│      ├── adapters (launch, exit, recap, activity, conversation tail, adopt)   │
│      ├── git (worktree, instantánea, junctions, commit con exclusiones, diff) │
│      └── storage (segmentos, declaraciones, node_results, lotes, hijos, eventos)│
└───────────────────────────────────────────────────────────────────────────────┘
apps/cli ── runtime ── core.validateFlow(host = 'cli') → INTERACTIVE_NODE_REQUIRES_DESKTOP (exit 2)
```

## Flujo de un nodo interactivo

Cada paso indica los requisitos y la decisión de research que lo sustentan.

1. **Edición** (FR-001–004, FR-032, FR-036, FR-044):
   - el nodo `interactive` se guarda con agente, modelo obligatorio, instrucciones opcionales,
     alcance, restricciones de terminal, `requiresChanges`, tiempo máximo y `orchestration`
     opcional;
   - el flujo guarda `communication` y `links`;
   - la validación de escritorio muestra errores, el confinamiento real (FR-015), las restricciones
     no admitidas (FR-016) y qué comunicación tendrá el agente, todo desde las capacidades (R5-02,
     R5-12).
2. **Inicio del run** (FR-006, NFR-006): igual que 001. La CLI rechaza el flujo en la validación
   (FR-029, R5-10). Iniciar el run no lanza ninguna sesión.
3. **Espera** (FR-005, FR-024, US3-1, US3-3): con los predecesores `completed`/`approved`,
   `nextActions` emite `await_user` y el nodo pasa a `waiting_user`:
   - estado y acción visibles, y notificación;
   - no toma slot de concurrencia;
   - las ramas independientes siguen y los dependientes esperan;
   - el tiempo no corre (R5-13).
4. **Apertura** (FR-006, FR-007, FR-012–014, FR-017, FR-055; R5-02, R5-03, R5-14, R5-16):
   1. `session.open` explícito del usuario;
   2. `detect()` del agente → si no está autenticado, `failed` con `AGENT_NOT_AUTHENTICATED`;
   3. worktree nuevo desde la base de su fuente de código (R-15, R-22), con las rutas compartidas
      (R5-22); si falla, `WORKSPACE_CREATE_FAILED`;
   4. credencial de sesión y `toolsExposed` desde la configuración y las capacidades (R5-18);
   5. `buildInteractiveLaunch` → el host escribe los `files` de la sesión (settings con hooks,
      `mcp.json`) → `InteractiveSessionHost` lanza el binario nativo en el PTY →
      `supervisor.adopt(pid)` registra el árbol en `process_tree`;
   6. temporizador con `remainingMs` (FR-010);
   7. la vista recibe `NodeContext` (instrucciones y resultados completos de predecesores) como datos,
      sin escribir nada en el PTY.
5. **Sesión** (FR-007–010, FR-030, R5-01, R5-17):
   - bytes por el puerto de terminal;
   - cerrar o minimizar la vista no afecta la sesión; reabrirla hace `session.attach` con el buffer
     en memoria;
   - una sola sesión por copia y varias sesiones de nodos distintos en paralelo;
   - los avisos del agente llegan por el puente, `reduceActivity` actualiza la actividad y el nodo la
     muestra.
6. **Fin** (FR-011, FR-018; R5-03, R5-14):
   - **declaración** (`node.declareEnd`): si el agente responde según su actividad (o no se puede
     saber), el usuario elige cerrar ahora o esperar. El motor cierra el agente
     (`killed{by: declaration}`) y verifica el árbol;
   - **salida normal**: `classifyInteractiveExit` → `exited` → declaración provisional `COMPLETED`
     con origen `normal_exit`. Con `normalExit.codes = []` hasta 005a, toda salida es `crashed`;
   - **corte inesperado** → `crashed` → `failed`; **tiempo** → `killed{timeout}` → `failed`;
   - en todos los casos se invalida la credencial, se borran los archivos de sesión y los mensajes
     encolados para esa sesión terminan `TARGET_ENDED`.
7. **Resultado** (FR-018–023; R5-04, R5-05, R5-08):
   1. `SessionRef` del aviso `session_started` o de `locateSession`, y después `readRecap` → resumen
      o "recap no disponible";
   2. commit del motor con exclusión de `permissionPersistencePaths` (no en cancelado ni
      interrumpido);
   3. `observedFiles` = diff `base..result`; `scopeViolations` desde `writeScope`;
   4. `resolveNodeResult` con la capa de declaración → estado final y motivo; inconsistencia
      `COMPLETED_WITHOUT_CHANGES` si aplica;
   5. se persiste (redactado) y se emite `node.result`, con `children` si es orquestador. Los
      dependientes reciben el `PredecessorResult` con la forma de 001 y arrancan desde
      `resultCommit` (FR-023), o quedan `skipped` (FR-024).
8. **Reapertura** (FR-011, FR-023a; R5-07): `node.reopen` sobre `completed`/`blocked`/`failed` con
   copia confiable, tiempo restante y run `running`/`finished`:
   1. el resultado pasa a `node_results` como reemplazado; `generation + 1`; el run vuelve a
      `running`;
   2. los dependientes activos se cancelan (`UPSTREAM_REOPENED`), los resultados de todos los
      descendientes se reemplazan y quedan `pending` con `RERUN_CONFIRMATION`. Los hijos del
      orquestador **no** son descendientes y conservan sus resultados;
   3. segmento nuevo en la **misma** copia con el mismo perfil (incluidas las herramientas),
      reanudando la conversación (fork preferido) o, si no se puede, conversación nueva con
      `RESUME_UNAVAILABLE`;
   4. al cerrar de nuevo: si queda `completed`, confirmación explícita para reejecutar dependientes
      en worktrees nuevos desde el nuevo `resultCommit`; si no, `skipped`.
9. **Cancelación** (FR-025, NFR-004; R5-06):
   - fase 1 solo si está verificada; fase 2 terminación del árbol adoptado (agente, hooks y servidor
     MCP) por `(pid, creationTime)`; cierre del PTY; verificación;
   - el nodo queda `cancelled`, con la copia `untrusted`, sin commit y con los dependientes
     `skipped`;
   - los hijos activos quedan `cancelled` (`PARENT_CANCELLED`);
   - si coincide con el commit, prevalece la cancelación.
10. **Interrupción** (FR-026; R5-09):
    - cierre ordenado → fase 2 forzada, `interrupted`, copias `untrusted`;
    - crash → la recuperación de R-20 termina los `(pid, creationTime)` registrados en
      `process_tree`, marca los nodos y los hijos activos `interrupted` y vence los mensajes
      encolados.

## Flujos de comunicación

**Lectura** (US4; R5-18, R5-19):

```text
agente A ─ tools/call zeko_read_node{B, activity} ─▶ zeko-bridge mcp ─▶ pipe ─▶ BridgeServer
  ─▶ credencial ─▶ authorizeTool ─▶ resolveLinks(A puede leer B)
  ─▶ adaptador(B).readConversationTail | eventos persistidos de B ─▶ redactor ─▶ <zeko-node-data>
  ─▶ evento context.read ─▶ respuesta a A
```

**Mensaje** (US5; R5-20):

```text
A: zeko_send_message{to: B, text}
  ─▶ authorizeTool ─▶ decideDelivery (compuertas 1–4) ─▶ reserveFlow
  ─▶ ¿B listo? (actividad waiting_input ∧ sin texto sin enviar ∧ sin pausa ∧ paste activo)
       sí → suscripción de acuse → paste(marco) → espera → \r → DELIVERED | DELIVERED_UNCONFIRMED
       no → cola de la sesión de B → QUEUED  (flush en el próximo waiting_input)
  ─▶ evento message.delivery (sin cuerpo)
```

**Orquestación** (US6; R5-21, R5-22):

```text
A: zeko_spawn_children{children}
  ─▶ instantánea de la copia de A (índice temporal, refs/zeko/snapshots/…)
  ─▶ validateSpawnBatch ─▶ rejected | (confirm ? pending_confirmation : confirmed)
  ─▶ [UI] spawn.decide ─▶ confirmed
  ─▶ NodeRuns origin=spawned + spawned_nodes ─▶ scheduler (slots de 001) ─▶ worktree por hijo
  ─▶ hijo termina ─▶ aviso de Zeko a A (cola de mensajes) ─▶ A lee y decide si integra la rama
```

## Decisiones principales

| # | Decisión | Evidencia | Cubre |
|---|---|---|---|
| 1 | PTY en el engine host; puerto de terminal dedicado; `node-pty` detrás de `TerminalPort` | R5-01; I-06; `[001 §7]` | FR-006, FR-008–010, FR-025, FR-026, NFR-002, NFR-003 |
| 2 | Agente como raíz del PTY, binario nativo, sin shell; flags de 001 como candidatos; capacidades interactivas conservadoras hasta 005a | R5-02; I-01, I-04, I-05; `[001 §1, §6]`, `[001b §B]`, `[001c §1–10]` | FR-002, FR-007, FR-012, FR-015, FR-016, NFR-006 |
| 3 | Fin de sesión clasificado en `ProcessOutcome`; auth verificada al abrir; salida normal solo con códigos verificados | R5-03; `[001d U-03]`, `[001c §2]` | FR-011, FR-018, FR-019 |
| 4 | Recap desde el archivo de sesión del agente, localizado por el aviso de inicio; nunca desde la terminal; sin copiarlo | R5-04, R5-17; `[sample: 001c/q4-termination.json]`, `[001c §3]` | FR-018, FR-022, FR-028 |
| 5 | Archivos de permisos del agente excluidos del commit, no revertidos | R5-05; `[001c §10]`, `[001b §B1]`, `[001d U-07]` | FR-016, FR-020, FR-023 |
| 6 | Cancelación en fases con `supervisor.adopt`; nunca `pty.kill()` como mecanismo de terminación | R5-06; `[001 §7]`, `[001c §9]` | FR-025, NFR-004, SC-005 |
| 7 | Reapertura en la misma copia, fork preferido, tiempo acumulado, resultados reemplazados, reejecución confirmada | R5-07; `[001 §4]`, `[001c §5, §12]` | FR-010, FR-011, FR-023a |
| 8 | Capa `Declaration` en `resolveNodeResult`; commit del motor tras verificar el árbol | R5-08; R-05, R-07, R-15 | FR-019–023, SC-006 |
| 9 | Interrupción con la recuperación de R-20 sin cambios de mecanismo | R5-09; R-20 | FR-026 |
| 10 | Enmienda MAJOR del Principio IV antes de `/speckit-tasks` | R5-10 | FR-029 |
| 11 | Redactor de R-28 para recap, eventos, historial, lecturas y mensajes; salida del PTY ni se redacta ni se persiste | R5-11 | FR-028, FR-034, SC-007 |
| 12 | Tipo `interactive` con modelo obligatorio; validación por `host` | R5-12 | FR-001–004, FR-029 |
| 13 | `waiting_user` sin slot de concurrencia; notificación en el renderer | R5-13 | FR-005, FR-024, NFR-003, NFR-005 |
| 14 | Contexto como datos con "Copiar" y lectura a pedido; declaración con confirmación si el agente responde o no se sabe | R5-14; I-10 | FR-014, FR-017, FR-018 |
| 15 | Retiro de la terminal `shell` y de la terminal de agente en modo edición | research §I, I-09 | Out of Scope, FR-012, Principio I |
| 16 | Puente: named pipe en el engine host + `zeko-bridge` (hook y MCP) + credencial HMAC por sesión | R5-16; `[ref-nodeterm: hook-server.ts]` | FR-030, FR-033, FR-055, NFR-008, NFR-009 |
| 17 | Actividad por hooks/`notify`/rollout, normalizada por el adaptador y reducida en `core` | R5-17; `[ref-nodeterm: normalize.ts]` | FR-030, FR-031 |
| 18 | Herramientas de Zeko por MCP, filtradas por configuración del nodo y fijadas al lanzar | R5-18; Principio VI | FR-033, FR-037, FR-045, FR-050, NFR-006 |
| 19 | Enlaces declarados + implícitos; lectura a pedido, redactada y etiquetada como dato | R5-19; `[ref-nodeterm: context-link.ts]` | FR-032–035 |
| 20 | Mensajes con compuertas ordenadas, marca por entrega, paste + Enter, detección de texto sin enviar, acuse, cola en memoria y límites | R5-20; `[ref-nodeterm: agent-message*.ts]` | FR-036–043, NFR-007, SC-008 |
| 21 | Lotes de hijos no interactivos, contenidos en el padre, confirmados por defecto, profundidad 1 | R5-21 | FR-044–054, SC-009 |
| 22 | Sin locks: worktree por hijo, instantánea con índice temporal, integración por el agente o el usuario, junctions para rutas compartidas | R5-22; `[ref-nodeterm: worktree-shared-paths.ts]` | FR-049, FR-051, FR-056, SC-006, SC-010 |
| 23 | Modelo de amenazas explícito del canal | R5-23 | FR-014, FR-039, FR-043, FR-055, SC-011 |

**Restricciones que el plan no puede levantar** (se muestran en el nodo):

- hasta 005a, todo nodo interactivo se muestra `unconfined` (`INTERACTIVE_CONFINEMENT_UNVERIFIED`),
  sin recap, sin reanudación y con "salida del agente = fallo" (T5-07, T5-08);
- hasta 005a (Q16–Q22), con agentes reales: actividad `unknown`, sin herramientas de Zeko y sin
  entrega de mensajes (`ACTIVITY_UNAVAILABLE`, `ZEKO_TOOLS_UNAVAILABLE`,
  `MESSAGE_INPUT_UNAVAILABLE`). Con el agente simulado, todo funciona;
- la shell de Claude no está confinada, igual que en 001 `[001b §B2]`;
- el alcance parcial se detecta al cerrar y bloquea el nodo, no se previene `[001d U-02]`;
- Codex no confina la lectura `[001c §8]`;
- sin costo en dinero en sesiones interactivas hasta que un spike encuentre una fuente (T5-09);
- un fallo de autenticación **durante** la sesión puede verse como salida normal si el agente sale con
  el mismo código (R5-03);
- la credencial de sesión no es frontera frente a procesos del mismo usuario (R5-23);
- un mensaje entregado en el mismo instante en que el usuario empieza a escribir no se puede excluir
  del todo (R5-20);
- las rutas compartidas no están aisladas para una shell sin confinar (R5-22).

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
| FR-014, FR-017 | core/prompt (`PredecessorResult`), core/engine (`NodeContext`), renderer (Copiar), bridge (`zeko_get_context`) | ipc `NodeContext`, bridge |
| FR-015, FR-016 | adapters (bloque `interactive`, flags), core/policy (confinamiento, advertencias) | adapter, data-model §1 |
| FR-018 | core/engine (declaración, cierre), adapters (`readRecap`), core/comm/activity | ipc `node.declareEnd`, adapter |
| FR-019, FR-020, FR-022 | core/result (capa `Declaration`, `children`), git (commit, diff) | data-model §2 |
| FR-021 | core/validation (`requiresChanges`), core/result (`COMPLETED_WITHOUT_CHANGES`) | flow-file, data-model §2 |
| FR-023 | core/prompt, core/engine (base = `resultCommit`) | ipc `PredecessorResult` |
| FR-023a | core/state, core/engine (invalidación, `RERUN_CONFIRMATION`), storage (`node_results`) | data-model §2–3, ipc `node.reopen`, `dependents.rerun.decide` |
| FR-024 | core/scheduler (propagación de 001) | data-model §3 |
| FR-025 | core/engine, adapters/process (`adopt`, `terminateTree`), OrchestrationController | adapter, ipc `node.cancel` |
| FR-026 | runtime/recovery (R-20), engine-host (shutdown) | data-model §3 |
| FR-027 | storage (eventos, segmentos) | data-model §5 |
| FR-028 | storage/redactor, engine-host (buffer solo en memoria), adapters (`readRecap`, `readConversationTail` sin copia), eventos de mensajes sin cuerpo | data-model §4–5 |
| FR-029 | core/validation (`host = cli`), apps/cli | cli |
| FR-030, FR-031 | adapters (`normalizeActivityEvent`, `watchSessionFile`), core/comm/activity, engine-host/bridge, renderer | bridge §avisos, ipc `session.activity` |
| FR-032–035 | core/comm/links, core/comm/tools, adapters (`readConversationTail`), storage/redactor | flow-file `links`, bridge `zeko_read_node` |
| FR-036–043 | core/comm/{delivery, flow-control, queue, envelope}, engine-host/InteractiveSessionHost (entrega), renderer (cola, pausa) | bridge `zeko_send_message`, `MessageOutcome`, ipc mensajes |
| FR-044–047 | core/comm/spawn, core/engine/OrchestrationController, renderer/dialogs | flow-file `orchestration`, bridge `zeko_spawn_children`, ipc `spawn.decide` |
| FR-048, FR-054 | core/scheduler, core/state (hijos como NodeRuns), storage (`spawned_nodes`) | data-model §2–3 |
| FR-049, FR-051 | git/snapshot, core/engine (base de hijos) | research R5-22 |
| FR-050, FR-053 | OrchestrationController, core/comm/notices | bridge (avisos), ipc `children.parentEnd.decide` |
| FR-052 | renderer/canvas, runtime/flow-files (serializador) | ipc `children.saveToFlow`, flow-file |
| FR-055 | engine-host/bridge/credentials, apps/bridge | bridge §protocolo |
| FR-056 | git/shared-paths, git/cleanup, contracts/project-config | flow-file §config, research R5-22 |
| NFR-001 | adapters (Windows), engine-host (ConPTY, named pipe), git (junctions) | quickstart |
| NFR-002, NFR-003, SC-003, SC-004 | engine-host, puerto de terminal, renderer | ipc §rendimiento, quickstart §10 |
| NFR-004, SC-005 | adapters/process | adapter, quickstart §4 |
| NFR-005 | renderer (estado, actividad, cola, confirmación en el nodo) | ipc `NodeView.interactive` |
| NFR-006, SC-002 | core/scheduler, core/engine (solo `session.open` lanza), core/comm/tools | ipc, bridge |
| NFR-007, SC-008 | core/comm/delivery, engine-host (entrega) | bridge §entrega, quickstart §12 |
| NFR-008 | apps/bridge (fail-open) | bridge §avisos |
| NFR-009 | adapters (archivos de sesión, flags), apps/bridge | adapter |
| NFR-010 | core/comm/links, adapters | quickstart §11 |
| SC-001 | todo el flujo | quickstart §1 |
| SC-006 | git, core/result | quickstart §1, §7, §14 |
| SC-007 | storage/redactor | quickstart §8, §11 |
| SC-009, SC-010 | core/comm/spawn, git/snapshot | quickstart §13 |
| SC-011 | engine-host/bridge/credentials | quickstart §15 |

## Orden sugerido de implementación (insumo para `/speckit-tasks`)

0. **Prerrequisitos**:
   - aplicar la enmienda del Principio IV con `/speckit-constitution` (R5-10);
   - lanzar el mini-spike **005a** en paralelo (research §S, Q1–Q24). Bloquea solo las tareas de la
     columna "Bloquea" de research §U.
1. `contracts`:
   - schemas y códigos nuevos;
   - `InteractiveCapabilities` con valores conservadores, incluidos `activitySource`, `zekoTools` y
     `messaging`;
   - `ProcessOutcome.killed.by = declaration`;
   - eventos, IPC y `PredecessorResult` extendido;
   - `communication`, `links`, `orchestration`, `sharedPaths`;
   - `contracts/bridge`.
2. `core` (con tests unitarios completos, R5-15):
   - validación por host y de comunicación;
   - confinamiento interactivo;
   - capa `Declaration` en `resolveNodeResult`;
   - máquinas de estado (incluidos lotes e hijos);
   - `await_user`, tiempo acumulado, invalidación y reejecución de dependientes;
   - `comm/*` completo.
3. `storage` (migración 002, `node_results`, `spawn_batches`, `spawned_nodes`) y `git` (commit con
   exclusiones, instantánea, junctions y limpieza segura, con integración Windows).
4. `adapters/process`: `supervisor.adopt` y tests de integración Windows con el agente simulado
   interactivo.
5. **Puente** con el agente simulado en modo `bridge`: `apps/bridge` (hook, MCP, empaquetado SEA),
   `engine-host/bridge` (pipe, credenciales, rutas). Tests de SC-011.
6. `apps/desktop`:
   - `InteractiveSessionHost` en el engine host, con entrega de mensajes, DECSET 2004 y texto sin
     enviar;
   - segundo puerto; retiro de `PtyManager`, de la terminal `shell` y de la terminal de edición;
   - vista con contexto, actividad, cola, declarar, cancelar y reabrir;
   - canvas con enlaces e hijos y diálogos de lote y fin;
   - medición de latencia (quickstart §10).
7. `OrchestrationController`: lotes, confirmación, hijos en el scheduler, avisos, fin del
   orquestador, "Guardar en el flujo" (quickstart §13 con el agente simulado).
8. `apps/cli`: validación con `host = cli` y código 2; `runs show` con hijos y mensajes.
9. **Tras 005a**:
   - flags interactivos de cada adaptador, `normalExit`, `locateSession`, `readRecap`, `resume`,
     `busyDetection`, `orderlyExit`, `permissionPersistencePaths`;
   - `activitySource`, `zekoTools`, `messaging.input`/`submitDelayMs` y `readConversationTail`;
   - actualización de la matriz de capacidades con las citas del spike.
10. Quickstart manual completo en Windows (1–15), primero con el agente simulado y después con
    agentes reales.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Principio IV**: la CLI no puede ejecutar flujos con nodos interactivos (FR-029). Se propone la enmienda MAJOR de research R5-10. | Un nodo interactivo necesita que el usuario converse con el agente en la terminal de la interfaz; la CLI de 001 solo tiene TTY para aprobaciones. La spec (FR-029, US3-7) exige rechazar esos flujos antes del run. Las reglas del nodo, incluidas todas las de comunicación, siguen en el núcleo headless y la CLI usa la misma validación. | **Ejecutar el nodo en la TTY de la CLI**: agrega una segunda superficie de terminal con su propio ciclo de vida, fuera del alcance de la spec. **Saltar el nodo en la CLI**: cambiaría el resultado del flujo según el host (contra SC-008 de 001) y contradice FR-029. |
| **Principio VI (reducida)**: el **resultado** del nodo interactivo no llega por MCP; la declaración viene del usuario y la recap de un archivo del agente. Lectura, mensajes y orquestación sí usan MCP. | La aclaración del 2026-09-28 deja fuera de alcance el resultado estructurado por MCP, y la declaración del usuario es la fuente que la spec define (FR-018). | **Herramienta `zeko_report_result`**: técnicamente trivial ahora que existe el puente, pero contradice la aclaración vigente. Queda como siguiente paso natural si se reabre esa decisión. |
| **Principio IX**: acciones fuera de alcance pueden ocurrir sin denegación previa (shell de Claude sin confinar, alcance parcial solo detectado, lectura de Codex), y hasta 005a no se sabe si una aprobación en la TUI puede levantar un límite duro. Un orquestador con `confirm: false` crea hijos sin intervención. | Son los mismos límites de 001 (`[001b §B2]`, `[001d U-02]`, `[001c §8]`), más la falta de evidencia interactiva. La spec los acepta mostrando el confinamiento real y las restricciones no admitidas (FR-015, FR-016) y bloqueando al detectar escrituras fuera de alcance (FR-020). Los hijos nunca exceden los permisos del padre (FR-046) y `confirm: false` es una elección explícita del usuario, visible en el diff del flujo. | **Bloquear los nodos interactivos con shell**: dejaría a Codex sin uso (no lee sin shell `[001c §7]`) y a Claude sin tests ni builds. **Confinamiento a nivel de SO**: fuera de alcance (Out of Scope; D-07 de 001). **Confirmación obligatoria siempre**: la spec la permite desactivar (aclaración 2026-10-16). |
| **Stack**: `@modelcontextprotocol/sdk` fuera del stack de la constitución, y un ejecutable auxiliar empaquetado como Node SEA. | El Principio VI exige MCP para el canal agente ↔ Zeko, y el SDK es la implementación de referencia del estándar. El agente necesita lanzar un proceso propio para hooks y MCP sin depender de Node, curl o una shell en el `PATH` (R5-16). El SDK queda confinado a `apps/bridge`. | **Implementar MCP y JSON-RPC a mano**: duplica un estándar vivo con más riesgo y sin beneficio. **Scripts sh con curl** (nodeterm): dependen de la shell con que cada agente ejecuta hooks en Windows, exponen el payload en argv y no sirven para MCP. **Electron como Node**: exige `ELECTRON_RUN_AS_NODE` en el entorno del agente, heredado por su shell; queda como respaldo si U5-20 falla. |
