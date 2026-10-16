# Contrato: adaptador de agente — capacidades y lanzamiento interactivo

**Cubre**: FR-002, FR-004, FR-007, FR-011, FR-012, FR-015, FR-016, FR-018, FR-019, FR-025, FR-027,
FR-028, FR-030, FR-031, FR-033, FR-034, FR-037, NFR-004, NFR-006, NFR-009, SC-005.
**Base**: [contracts/adapter.md de 001](../../001-agent-flow-canvas/contracts/adapter.md). Las
operaciones de 001 (`capabilities`, `detect`, `readUsage`, `launch`, `requestReport`), `LaunchSpec`,
`NormalizedEvent`, `ReportCandidate` y la matriz de capacidades rigen sin cambios.
**Fuente de tipos**: schemas zod en `packages/contracts/adapter/` (`InteractiveCapabilities`,
`InteractiveLaunchSpec`, `InteractiveCommand`, `RecapResult`, `SessionRef`) y el cambio a
`ProcessOutcome`.

**Principio** (igual que 001): `core` solo conoce esta interfaz y las capacidades, nunca el id del
agente. Las operaciones interactivas son **puras** o de solo lectura de archivos: el adaptador no
lanza el PTY. Lo lanza el `InteractiveSessionHost` del engine host de escritorio con `node-pty`, y el
supervisor lo adopta (research R5-01, R5-06). Así `packages/adapters` sigue sin depender de
`node-pty` y la CLI no lo carga.

## Operaciones nuevas

| Operación | Entrada | Salida | Semántica | FR |
|---|---|---|---|---|
| `buildInteractiveLaunch(spec)` | `InteractiveLaunchSpec` | `InteractiveCommand` | Traduce el spec a binario, argumentos y entorno. Pura. Nunca devuelve una shell como binario ni un shim (`.cmd`, `.ps1`). Siempre incluye el modelo. Si `spec.resume` está y la capacidad `resume` es `none`, lo ignora y lo informa en `resumeApplied: false`. | FR-002, FR-007, FR-011, FR-016 |
| `classifyInteractiveExit(input)` | `{exitCode?, signal?, killedBy?: user \| timeout \| shutdown \| declaration, durationMs}` | `ProcessOutcome` | Pura. Tabla de research R5-03: con `killedBy` → `killed`; sin él, `exitCode ∈ interactive.normalExit.codes` → `exited`; en otro caso → `crashed`. | FR-011, FR-019 |
| `locateSession(input)` | `{workspacePath, openedAt, sessionIdHint?}` | `SessionRef?` | Solo lectura de archivos del agente. Claude: el `sessionIdHint` que Zeko pasó con `--session-id` (si está verificado). Codex: el rollout creado después de `openedAt` cuyo `turn_context.cwd` es `workspacePath` (research R5-04). Nunca inspecciona procesos. | FR-011, FR-018 |
| `readRecap(ref)` | `SessionRef` | `RecapResult` | Lee en streaming el archivo de sesión y devuelve solo la última respuesta completa del agente. No copia el archivo ni devuelve otras partes. | FR-018, FR-028 |
| `readSessionUsage(ref)` | `SessionRef` | `{consumption?, cost?, subscription?: AgentUsageReading}` | Opcional. Codex: `token_count` y `rate_limits` del rollout, como en 001 `[001c §11]`. Ausente si el agente no lo informa. | FR-027 |
| `isBusy(ref)` | `SessionRef` | `boolean \| 'unknown'` | Opcional, solo si `interactive.busyDetection ≠ none`. | FR-018 |
| `detect()` | (001) | `AgentAvailability` | Sin cambios; se llama también al abrir cada sesión (research R5-03). | FR-011, supuestos de la spec |
| `normalizeActivityEvent(raw)` | `{payload: unknown}` (JSON nativo de un hook o de `notify`, o un registro del rollout) | `ActivityEvent[]` ([bridge.md](./bridge.md#avisos-de-actividad-kind-hook)) | Pura. Los nombres de eventos del agente viven solo aquí (research R5-17). Un payload desconocido devuelve `[]`, nunca error. | FR-030 |
| `readConversationTail(ref, n)` | `SessionRef`, `n ≤ 50` | `{entries: string[], truncated}` | Solo lectura en streaming del archivo de sesión. Devuelve las últimas `n` entradas como `user:` / `assistant:` / `tool: <nombre>` / `result: <primera línea>`, sin copiar el archivo. Lo redacta el `runtime` antes de entregarlo (research R5-19). | FR-033, FR-034 |
| `watchSessionFile?(ref)` | `SessionRef` | `AsyncIterable<unknown>` | Opcional (`activitySource ∈ {rollout, notify_rollout}`). Lee el archivo en streaming desde el final y entrega registros nuevos a `normalizeActivityEvent`. | FR-030 |

### `InteractiveLaunchSpec` (lo arma `core`)

| Campo | Tipo | Origen |
|---|---|---|
| `agentId` | `claude-code` \| `codex` | nodo |
| `runId`, `nodeRunId`, `attemptId` | ids | motor; `attemptId` = segmento |
| `workspacePath` | ruta absoluta del worktree del nodo | R-15, R5-07; nunca la raíz del repositorio (FR-012) |
| `model` | `{model}` \| `{model, reasoningEffort}`, **obligatorio** | `models.<agente>` del nodo (FR-002) |
| `writeScope` | globs | nodo (FR-020) |
| `terminal` | `{enabled, allowedCommands}` efectivos | nodo + capacidades (FR-016) |
| `platform` | `win32` \| `linux` | |
| `sessionIdHint?` | uuid | motor, solo si `interactive.sessionRef = zeko_assigned` |
| `resume?` | `{ref: SessionRef, mode: 'fork' \| 'in_place'}` | reapertura (R5-07) |
| `launchProfileHash` | sha256 | motor; se compara con el del segmento anterior antes de reanudar. Incluye `toolsExposed` |
| `bridge` | `{exePath, pipe, sessionId, tokenFile, sessionDir, toolsExposed: ZekoToolName[]}` | motor (research R5-16, R5-18). `toolsExposed = []` si el nodo no tiene herramientas o el agente no las admite |

**Qué no lleva**: prompt, instrucciones, criterios, resultados de predecesores ni schema de reporte.
Nada de eso llega al agente (FR-017). El tiempo máximo tampoco: lo aplica el motor (R-11).

### `InteractiveCommand`

| Campo | Tipo | Semántica |
|---|---|---|
| `file` | ruta absoluta del binario nativo | Claude: `claude.exe`; Codex: `codex.exe` de `@openai/codex-win32-x64/vendor/…/bin/` `[001c §9]` |
| `args` | string[] | Sin quoting de shell: se pasan como argv (no hay shell, research I-01) |
| `env` | registro | Entorno de 001 limpio (`CODEX_API_KEY`, `OPENAI_API_KEY`, `CODEX_HOME` heredados quitados, `ELECTRON_*`, `ZEKO_*`, marcadores de sesión de Claude) + `TERM=xterm-256color`, `COLORTERM=truecolor` |
| `cwd` | = `spec.workspacePath` | |
| `sensitiveValues` | string[] | Igual que 001: se registran en el redactor (R-28) |
| `resumeApplied` | bool | `false` si se pidió reanudar y no se pudo armar |
| `unsupportedRestrictions` | code[] | Restricciones del nodo que el agente no admite en modo interactivo; se muestran (FR-016) |
| `files` | `{path, content}[]` | Archivos que el host escribe en `bridge.sessionDir` **antes** de lanzar y borra al cerrar: `claude-settings.json` (hooks) y `mcp.json` para Claude; ninguno para Codex (usa `-c`). La operación sigue siendo pura: el adaptador no escribe nada |
| `activitySource` | `hooks` \| `notify_rollout` \| `rollout` \| `none` | Lo que se pudo armar; queda en el segmento |
| `env` (agregado) | | `ZEKO_BRIDGE_PIPE`, `ZEKO_SESSION_ID`, `ZEKO_SESSION_TOKEN_FILE` cuando `bridge` está presente ([bridge.md](./bridge.md#entorno-de-la-sesión)) |

### `SessionRef` y `RecapResult`

- `SessionRef = {agentId, id, file?}`: `id` es el `session_id` de Claude o el `thread_id` de Codex;
  `file` es la ruta del archivo de sesión si el adaptador la resolvió. **Nunca se persiste `file`**
  (puede contener el nombre del usuario del SO): solo `id` va a `attempts.agent_session_ref`.
- `RecapResult = {state: 'available', text} | {state: 'unavailable', cause}` con
  `cause ∈ {no_session_ref, file_not_found, unreadable, turn_incomplete, no_agent_message}`
  (research R5-04). El texto se devuelve crudo: lo redacta el `runtime` antes de persistirlo, como
  todo (R-28).

### Cambio a `ProcessOutcome`

`killed.by` admite un valor nuevo: `declaration` (Zeko cerró el agente después de una declaración
válida del usuario). `resolveNodeResult` no lo trata como fallo (research R5-08). El resto de la
unión no cambia.

### Supervisor de procesos (`packages/adapters/src/process`)

| Operación | Semántica | FR |
|---|---|---|
| `adopt(pid)` → `ProcessIdentity` | Nueva. Registra como raíz un proceso que no lanzó el supervisor (el que creó `node-pty`), con el mismo mecanismo que `launch`: instantánea, `(pid, creationTime)`, seguimiento de descendientes cada 2 s y persistencia en `process_tree` con el `attemptId` del segmento. Falla si el PID no aparece en la instantánea. | FR-025, FR-026 |
| `terminateTree(root)` | Existente (R-14). Mismo algoritmo: raíz viva con su `creationTime` → `taskkill /PID /T /F`; luego cada PID registrado vivo; verificación final. **Nunca** por nombre, fecha o patrón. | FR-025, NFR-004 |

## Bloque `interactive` en `AgentCapabilities`

Campo nuevo, **opcional**: su ausencia significa que el agente no admite nodos interactivos
(`INTERACTIVE_AGENT_UNSUPPORTED`). Lo consumen la validación, la función de confinamiento
(data-model §1), la UI (FR-015, FR-016) y el motor (cierre, cancelación, reapertura).

| Campo | Tipo | Semántica |
|---|---|---|
| `supported` | `true` | |
| `confinement.fileTools` | `full` \| `none` | Confinamiento de las herramientas de archivos del agente en la TUI. |
| `confinement.shell` | `none` \| `write_only` | Confinamiento de la shell del agente en la TUI. |
| `approvalCanWiden` | bool | `true` si una aprobación del usuario en la TUI puede levantar un límite duro (FR-016). |
| `toolRestriction` | `tools_and_commands` \| `tools_only` \| `none` | Qué restricciones de herramientas y comandos del nodo aplica el agente en la TUI. |
| `userConfigIsolation` | bool | Si el lanzamiento evita la configuración global del usuario (MCP, hooks, conectores). |
| `normalExit.codes` | int[] | Códigos que cuentan como salida normal. `[]` = ninguno verificado. |
| `sessionRef` | `zeko_assigned` \| `located` \| `none` | Cómo se obtiene `SessionRef`. |
| `recap` | `session_file` \| `none` | |
| `resume` | `fork` \| `in_place` \| `none` | Qué reanudación ofrece la TUI desde el mismo `cwd`. |
| `busyDetection` | `session_file` \| `none` | |
| `orderlyExit` | `{sequence: string, graceMs: int}` \| `none` | Fase 1 de la cancelación (research R5-06). `graceMs ≤ 3000`. |
| `permissionPersistencePaths` | string[] \| `unknown` | Rutas relativas al worktree donde el agente guarda aprobaciones persistentes; el commit del motor las excluye (research R5-05). |
| `reportsCost`, `reportsConsumption` | bool | En sesiones interactivas. |
| `activitySource` | `hooks` \| `notify_rollout` \| `rollout` \| `none` | De dónde sale la actividad (research R5-17). `none` = siempre `unknown`. |
| `sessionsRoot` | ruta con variables (`~/.claude/projects`, `$CODEX_HOME/sessions`) | Directorio dentro del cual tiene que estar un `transcriptPath` informado por un aviso (research R5-23). |
| `zekoTools` | bool | Si el lanzamiento puede registrar el servidor MCP `zeko` y sus herramientas quedan usables en la TUI (research R5-18). |
| `messaging.input` | `bracketed_paste` \| `none` | Si el nodo puede recibir mensajes y avisos en su terminal (research R5-20). |
| `messaging.submitDelayMs` | int 0..1000 | Espera entre el cierre del paste y el `\r`. |

### Valores declarados

La columna "Hasta 005a" es lo que **declaran los adaptadores** mientras las preguntas de
[research §S](../research.md#s--mini-spike-005a-propuesto) no estén cerradas. Las columnas "Candidato"
son lo que se espera verificar; no se prometen.

| Campo | Claude Code — candidato | Codex — candidato | Hasta 005a (ambos) | Pregunta |
|---|---|---|---|---|
| `confinement.fileTools` | `full` (`--restricted`, `[001b §B1]` en print) | `none` (sin herramientas de archivos propias `[001c §7]`) | `none` | Q1, Q2 |
| `confinement.shell` | `none` `[001b §B2]` | `write_only` (`[001c §8]` en `exec`) | `none` | Q7 |
| `approvalCanWiden` | `false` | `false` | `true` | Q2, Q7 |
| `toolRestriction` | `tools_and_commands` (`--tools`, `--allowedTools`, `[001 §6]` en print) | `none` (sin allowlist en `exec` `[001c §8]`) | `none` | Q1 |
| `userConfigIsolation` | `true` (`--strict-mcp-config`, `--restricted`) | `true` (`--ignore-user-config`, `--disable`) | `false` | Q1, Q6 |
| `normalExit.codes` | a medir | a medir | `[]` | Q4, Q8 |
| `sessionRef` | `zeko_assigned` (`--session-id`, listado en `[001 §1]`) | `located` (rollout por `cwd`) | `none` | Q3, Q9 |
| `recap` | `session_file` | `session_file` (`task_complete.last_agent_message` `[sample: 001c/q4-termination.json]`) | `none` | Q3, Q9 |
| `resume` | `fork` (`--resume --fork-session`, `[001 §4]` en print) | `fork` (`exec fork`, `[001c §5]`; TUI a verificar) | `none` | Q3, Q9 |
| `busyDetection` | a verificar | `session_file` (turno sin `task_complete`) | `none` | Q14 |
| `orderlyExit` | a medir | a medir | `none` | Q10 |
| `permissionPersistencePaths` | a medir | a medir | `unknown` | Q5, Q12 |
| `reportsCost` | a verificar | `false` `[001c §11]` | `false` | Q3 |
| `reportsConsumption` | a verificar | `true` (rollout, `[001c §11]`) | `false` | Q3, Q9 |
| `activitySource` | `hooks` (`--settings`) | `notify_rollout` | `none` | Q16, Q17 |
| `zekoTools` | `true` (`--mcp-config`) | `true` (`-c mcp_servers`) | `false` | Q18, Q19, Q22 |
| `messaging.input` | `bracketed_paste` | `bracketed_paste` | `none` | Q20 |
| `messaging.submitDelayMs` | a medir | a medir | — | Q20 |

El **adaptador simulado** declara los valores candidatos de comunicación desde el primer día, para que
el puente, los mensajes y la orquestación se prueben sin esperar a 005a (research §S, compuerta).

Un test de contrato falla si un adaptador declara un valor distinto del de "Hasta 005a" sin una
referencia a un hallazgo de `spikes/005a-interactive-agents/FINDINGS.md` en el código de la
declaración (Principio XVI; research R5-15).

## Traducción de `InteractiveLaunchSpec` (candidatos, Windows)

Todos los flags son **candidatos** hasta 005a (U5-01, U5-05). La columna "Evidencia" cita el modo en
que sí se verificaron.

### Claude Code

| Parte | Flags | Evidencia (modo print) |
|---|---|---|
| Binario | `claude.exe`, sin shell | `[001 §1]` |
| Modelo (siempre) | `--model <model>` | `[001 §1]`, R-27 |
| Configuración | `--strict-mcp-config --restricted` | `[001 §1]`, `[001b §B1]` |
| Herramientas sin terminal | `--tools "Read,Write,Edit,Glob,Grep"` (alcance ≠ `[]`) o `--tools "Read,Glob,Grep"` (alcance `[]`); `--allowedTools` con las de solo lectura | `[001 §6]`, R-10 |
| Terminal habilitada | `PowerShell` agregado a `--tools`; `--allowedTools "PowerShell(<cmd>)"` por comando permitido | `[001 §6]` |
| Sesión | `--session-id <uuid>` si `sessionRef = zeko_assigned` | listado en `[001 §1]`, no ejercitado |
| Reapertura | `--resume <id>` (+ `--fork-session` si `resume = fork`), mismos flags | `[001 §4]` |
| Actividad | `--settings <sessionDir>/claude-settings.json` con un hook `command` por evento de research R5-17: `"<exePath>" hook claude`, `timeout: 5` | `[claude-docs]`; U5-15 |
| Herramientas de Zeko | `--mcp-config <sessionDir>/mcp.json` (servidor `zeko`: `<exePath> mcp`), junto al `--strict-mcp-config` de siempre; `--allowedTools` suma `mcp__zeko__<cada herramienta de toolsExposed>` | `[claude-docs]`; U5-17 |
| Nunca | `-p`, `--output-format`, `--input-format`, `--json-schema`, `--max-turns`, `--permission-mode acceptEdits`, `--dangerously-skip-permissions` | R-10, research C5-12 |

### Codex

| Parte | Flags / regla | Evidencia (modo `exec`) |
|---|---|---|
| Binario | `codex.exe` nativo; nunca el shim | `[001c §9]` |
| Modelo (siempre) | `-m <model> -c model_reasoning_effort="<e>"` | `[001c §1]`, R-27 |
| Sandbox (siempre) | `-s workspace-write -c windows.sandbox="<elevated\|unelevated>" -c sandbox_workspace_write.exclude_tmpdir_env_var=true -c sandbox_workspace_write.exclude_slash_tmp=true` | `[001c §4, §8]` |
| Superficie | `--disable apps --disable plugins --disable image_generation --disable multi_agent --disable goals --disable browser_use --disable computer_use -c web_search="disabled"` | `[001c §7]` |
| Configuración | `--ignore-user-config --ignore-rules`, si la TUI los acepta | `[001c §1, §10]` |
| Aprobaciones | la política que Q7 encuentre sin escalado fuera del sandbox | `[001c §8]` (en `exec` siempre `never`) |
| Entorno | sin `CODEX_API_KEY`, `OPENAI_API_KEY` ni `CODEX_HOME` heredados | `[001c §2, §10]` |
| Reapertura | la forma de fork o reanudación de la TUI que Q9 verifique, mismo `cwd` | `[001c §5]` (`exec fork`) |
| Actividad | `-c notify=["<exePath>","hook","codex"]`; respaldo con `watchSessionFile` del rollout localizado | `[codex-docs]`; U5-16 |
| Herramientas de Zeko | `-c mcp_servers.zeko.command="<exePath>" -c mcp_servers.zeko.args=["mcp"]` y, si existe, la opción que restringe las herramientas expuestas a `toolsExposed` | `[codex-docs]`; U5-18, U5-21 |
| Nunca | `exec`, `--json`, `--output-schema`, `danger-full-access`, reanudar desde otro `cwd` | R-13, R-16 |

## Adaptador simulado (`fake`, modo interactivo)

Implementa el bloque `interactive` con capacidades configurables por test y lanza
`packages/adapters/test/fake-agent` en modo `interactive` (research R5-15): lee el TTY en modo raw,
hace eco inmediato, sale con el código del guion, escribe un archivo de sesión simulado con una recap
(o sin ella, o con el último turno incompleto) y puede lanzar nietos `cmd.exe → powershell.exe` que
escriben un archivo por segundo. Nunca llama a proveedores reales (Principio XVI).

En modo `bridge` (research R5-15) además:

- emite avisos con `zeko-bridge hook fake` en los puntos del guion;
- es cliente MCP de `zeko-bridge mcp` para llamar herramientas desde el guion;
- activa y desactiva `ESC[?2004h/l`;
- registra cada entrada recibida, separando lo que llegó dentro de un bracketed paste, para que los
  tests verifiquen el marco y la entrega en un solo turno.
