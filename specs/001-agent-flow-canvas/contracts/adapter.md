# Contrato: interfaz común de adaptador de agente

**Cubre**: FR-013, FR-014, FR-016, FR-017–023, FR-025, FR-029, FR-030, FR-032, FR-033, FR-038,
FR-050–053, FR-065, FR-066, NFR-004, NFR-012, Principio III.
**Fuente de tipos**: los schemas zod `AgentAdapter` (forma), `AgentCapabilities`,
`AgentAvailability`, `LaunchSpec`, `NormalizedEvent`, `ProcessOutcome` y `ReportCandidate` en
`packages/contracts`. Las implementaciones están en `packages/adapters/{claude-code,codex,fake}`.

**Principio**: `core` solo conoce esta interfaz y las **capacidades**, nunca el id de un agente.
Agregar un agente es escribir un adaptador y registrarlo en `runtime`, sin tocar `core` (FR-016,
Principio III).

## Operaciones

Se describen en notación de contrato; no es código.

| Operación | Entrada | Salida | Semántica |
|---|---|---|---|
| `id` | — | `AgentId` (`claude-code` \| `codex` \| …) | |
| `capabilities(platform)` | `win32` \| `linux` | `AgentCapabilities` | Estática por plataforma. Alimenta la UI (NFR-012), el confinamiento y `resolveNodeResult`. |
| `detect()` | — | `AgentAvailability` | Verificación previa (FR-025, FR-065). Sin costo. No lanza tareas. Usa el mismo entorno que el lanzamiento. Informa la forma de autenticación, **nunca** el email ni el id de la cuenta (research R-28). |
| `readUsage()` | — | `AgentUsageReading?` | Lectura del uso de la suscripción **fuera** de una ejecución. Claude: ausente, porque solo informa en vivo (R-17). Codex: la última lectura de `rate_limits` del rollout, marcada "not live" (FR-052); la consulta sin gastar turno queda en U-11. |
| `launch(spec)` | `LaunchSpec` | `AgentExecution` | Lanza el proceso con el supervisor (R-14). No bloquea. |
| `requestReport(prev, spec)` | `AgentExecution` terminada + `LaunchSpec` | `AgentExecution` | Único pedido adicional de reporte (FR-038). Fork de la sesión **desde el mismo `cwd`** del intento, con el mismo modelo, toolset y schema; nunca desde otro directorio ni reanudando sin fork (research R-16). Claude: `--resume <session> --fork-session` `[001 §4]`. Codex: `exec fork <thread_id>` `[001c §5]`. |

`AgentExecution`:

| Miembro | Tipo | Semántica |
|---|---|---|
| `events` | flujo asíncrono de `NormalizedEvent` | En orden. Termina después del último evento. |
| `completion` | promesa de `{outcome: ProcessOutcome, report: ReportCandidate}` | Se resuelve **después** de `close` del proceso raíz y de verificar el árbol (R-09, R-14). Nunca se rechaza por errores del agente: esos van en `outcome`. |
| `cancel(reason)` | `reason ∈ {user, timeout, shutdown}` → promesa | `user`/`timeout` en un agente con `orderlyInterrupt`: fase 1 (interrupt, 5 s), luego fase 2. En otro caso, o con `shutdown`: solo fase 2, terminación forzada del árbol registrado. Se resuelve cuando el supervisor verificó que **no queda ningún proceso del árbol** (FR-030, NFR-004). Es idempotente. |
| `rootPid` | `{pid, creationTime}` | Para persistir en `process_tree`. |
| `sensitiveValues` | `string[]` | Credenciales que el adaptador inyectó en el proceso (por ejemplo `CODEX_API_KEY`). El `runtime` las registra en el redactor antes de persistir eventos (research R-28). Nunca se persisten ni se emiten en eventos. Así el adaptador no depende de `storage`. |

### `LaunchSpec` (lo arma `core`; lo traduce el adaptador)

| Campo | Tipo | Origen |
|---|---|---|
| `runId`, `nodeRunId`, `attemptId` | ids | motor |
| `workspacePath` | ruta absoluta del worktree | R-15 |
| `model` | `{model}` (Claude) \| `{model, reasoningEffort}` (Codex), **obligatorio** | Modelo **resuelto** del NodeRun: `models.<agente>` del nodo o, si falta, `defaultModels` del proyecto (FR-011a, R-27). Lo resuelve `core` antes de lanzar; el adaptador siempre lo traduce a flags y nunca completa uno faltante. |
| `prompt` | `TaskAssignment` renderizado (tarea + criterios + resultados de predecesores como datos + sección de reporte) | R-16, R-23 |
| `reportSchema` | JSON Schema de [agent-report.md](./agent-report.md) | R-06 |
| `writeScope` | globs | FR-017 |
| `terminal` | `{enabled, allowedCommands}` **efectivos** (según las capacidades) | FR-017, FR-018 |
| `maxTurns?` | int, solo si `supportsTurnLimit` | FR-032 |
| `platform` | `win32` \| `linux` | R-10 |

El **tiempo máximo** no forma parte del `LaunchSpec`: lo aplica el motor llamando a
`cancel('timeout')` (R-11).

## `ProcessOutcome`

Unión discriminada por `kind`. Los campos marcados `?` quedan **ausentes** si el agente no los
informa (decisión 1).

| `kind` | Campos propios | Cuándo | Evidencia |
|---|---|---|---|
| `exited` | `exitCode: 0` | El proceso terminó sin error de agente. Claude: `result` con `is_error: false` y exit 0. | `[001 §3]` |
| `agent_error` | `exitCode`, `terminalReason?`, `errors[]?`, `stderrCode?` | El agente terminó informando un error. Claude: `is_error: true`, incluido el `subtype: success` con modelo inválido. | `[001 §3]` |
| `turn_limit` | `limit` | Se agotaron los turnos (`error_max_turns`). | `[001b §A2]` |
| `killed` | `by: user \| timeout \| shutdown`, `phase: interrupt \| tree_kill` | Zeko terminó el proceso. Con `phase: interrupt` puede haber `result` parcial. | `[001 §7]` |
| `crashed` | `exitCode?`, `signal?` | `close` sin evento final y sin que Zeko lo matara. | `[001 §3]` |
| `infra_failure` | `cause: process_create \| session_lock`, `detail` | Fallo de infraestructura del agente, con su propia política de reintento (R-18). Codex: error de Windows 267 al crear un proceso, en **cualquier** modo de sandbox, detectado en stderr o en el rollout aunque el turno termine con exit 0; o conflicto de writer de sesión. Tiene prioridad sobre `exited`. | `[001c §4, §12]` |
| `spawn_failed` | `cause: not_found \| not_authenticated \| other`, `detail` | El proceso no llegó a ejecutarse o falló la autenticación al arrancar. | |

Campos comunes a todos los `kind`:

| Campo | Tipo | Ausente cuando |
|---|---|---|
| `durationMs` | int | nunca (lo mide el motor) |
| `sessionId?` | string | el agente no llegó a emitirlo |
| `consumption?` | `{inputTokens?, outputTokens?, cacheReadTokens?, cacheCreationTokens?}` | no hubo evento de uso |
| `cost?` | `{amountUsd, basis: billed \| list_price_estimate \| unknown}` | el agente no informa costo (Codex), o se lo mató sin `result` |
| `turns?` | int | el agente no informa turnos (Codex) |
| `denials?` | `Denial[]` (`{tool, reason, input?}`) | el agente **no informa** denegaciones. `[]` significa que informa y no hubo ninguna. |

## `ReportCandidate`

`{state: 'valid', report: AgentReport}` \| `{state: 'invalid', zodErrors}` \| `{state: 'absent'}`

Lo valida el adaptador con el schema de `contracts`. Nunca extrae JSON de texto libre
([agent-report.md](./agent-report.md)).

## `NormalizedEvent`

Es el mismo vocabulario para todos los agentes. Cada evento lleva `ts` y `attemptId`.

| `type` | Campos | Claude (fuente) `[001 §2]` | Codex |
|---|---|---|---|
| `session_started` | `sessionId`, `model?`, `tools?`, `agentVersion?` | `system/init` | `thread.started` (solo `thread_id`); `model` sale del rollout al terminar `[001c §3]` |
| `assistant_text` | `text`, `subagent?` | `assistant` bloque `text` (`parent_tool_use_id` → `subagent`) | `item.completed` / `agent_message`, sin deltas |
| `tool_call` | `toolUseId?`, `name`, `input` | `assistant` bloque `tool_use` | `item.started` / `command_execution`, `file_change`, `mcp_tool_call`, `web_search` (`toolUseId = item.id`) |
| `tool_result` | `toolUseId?`, `ok`, `content` | `user` bloque `tool_result` (`is_error`) | `item.completed` del mismo `item.id` (`status`, `exit_code`, `aggregated_output`) |
| `permission_denied` | `tool`, `reason`, `input?` | `system/permission_denied` y `result.permission_denials[]` (sin duplicar) | — (no informa) |
| `inferred_denial` | `source: 'os_sandbox' \| 'agent_policy' \| 'patch'`, `message`, `target?` | — (informa denegaciones tipadas) | `command_execution` `failed` con "Acceso denegado"/"Access is denied"; stderr `Rejected(…)`/`blocked by policy`; `patch rejected` `[001c §3, §8]`. Se muestra como "inferida" y **no** activa la regla 4 (FR-023) |
| `usage` | `consumption?`, `cost?` | `result.usage`, `total_cost_usd`, `modelUsage.*.costBasis` | `turn.completed.usage` (sin costo) `[001c §11]` |
| `subscription_usage` | `AgentUsageReading` | `rate_limit_event.rate_limit_info.unifiedWindows` | `token_count.rate_limits` del rollout, al terminar `[001c §11]` |
| `model_mismatch` | `requested`, `effective` | `system/init.model` ≠ `LaunchSpec.model` | `turn_context.model` del rollout ≠ `LaunchSpec.model` (R-27) |
| `stderr` | `line` | stderr (`[claude-code:…]`) | stderr |
| `raw` | `data` | cualquier otro evento (`system/status`, `thinking_tokens`, `task_*`, `stream_event`, `control_response`) | `reasoning`, ítem `error`, evento `error` (reintentos de conexión) |

Los eventos `raw` van al log de diagnóstico y no se muestran en la salida en vivo (NFR-002).
`assistant` con thinking redactado se descarta `[001 §2]`. Todos los eventos pasan por el redactor
de research R-28 antes de persistirse; el adaptador no persiste nada por su cuenta.

## Matriz de capacidades

`AgentCapabilities` es la declaración de cada adaptador. La UI la muestra en el nodo (NFR-012,
FR-011) y `core` la usa para el confinamiento (data-model §1) y para `resolveNodeResult`.

| Capacidad (campo) | Claude Code — Windows | Claude Code — Linux | Codex — Windows | Codex — Linux | FR |
|---|---|---|---|---|---|
| `terminal.canDisable` (nodos sin terminal) | sí | sí | **no**, siempre con terminal `[spec-clar]` | no | FR-017 |
| `confinement.noTerminal` | `full` (lectura+escritura), `--restricted` `[001b §B1]` | `full` `[NO VERIFICADO: U-06]` | n/a | n/a | FR-019 |
| `confinement.withTerminal` | `none` `[001b §B2]` | `none` | `write_only`: escritura confinada por el SO, incluida la shell; lectura no `[001c §8]` | `write_only` `[spec-clar]`, `[NO VERIFICADO: U-13]` | FR-019, FR-020 |
| `writeScopeEnforcement` | `prevent` en alcance vacío o total; `detect` en alcance parcial hasta cerrar U-02 | igual | `detect` (el diff de git lo verifica todo) | `detect` | FR-017, US5-3 |
| `commandAllowlist` | sí, `PowerShell(<cmd>)` `[001 §6]`; **los comandos de solo lectura se auto-aprueban** | sí, `Bash(<cmd>)` `[NO VERIFICADO: U-06]` | no `[spec-clar]` | no | FR-018 |
| `reportsDenials` | sí `[001 §6]`, `[001b §B1]` | sí | **no** (verificación "not available") `[spec-clar]` | no | FR-023, FR-036.4 |
| `infersDenials` | no (no hace falta) | no | sí, heurística; se muestran como "inferidas" sin afectar el estado `[001c §3, §8]` | `[NO VERIFICADO: U-13]` | FR-023 |
| `supportsTurnLimit` | sí, `--max-turns` `[001b §A2]` | sí | **no** `[spec-clar]` | no | FR-032 |
| `timeLimit` | motor | motor | motor | motor | FR-032 |
| `orderlyInterrupt` | sí, `control_request interrupt` `[001 §7]` | sí | **no**: kill forzado del árbol `[spec-clar]` | no | FR-030 |
| `network` | sin herramientas de red en `--tools`; con terminal, la shell tiene red | igual | **sin red**; no se puede habilitar `[001c §8]` | `[NO VERIFICADO: U-13]` | FR-066 |
| `structuredOutput` | `--json-schema` + zod `[001 §5]` | igual | `--output-schema` strict + zod; con `turn.completed` siempre hay reporte `[001c §6]` | igual | FR-033 |
| `reportRequest` | `--resume --fork-session`, mismo `cwd` `[001 §4]` | igual | `exec fork <id>`, mismo `cwd` `[001c §5]` | igual | FR-038 |
| `explicitModel` | `--model` `[001 §1]` | igual | `-m` + `-c model_reasoning_effort` `[001c §1]` | igual | FR-011 (R-27) |
| `reportsCost` | sí, `list_price_estimate` (`costBasis: list`) `[sample: result.success.json]` | igual | **no** `[spec-clar]` | no | FR-050, FR-051 |
| `reportsConsumption` | sí (tokens) `[001 §3]` | sí | sí `[spec-clar]` | sí | FR-050 |
| `subscriptionUsage` | `live` (`rate_limit_event`) `[001 §2]` | `live` | `per_node`: rollout al terminar; antes de lanzar, última lectura (U-11) `[001c §11]` | `per_node` | FR-052, FR-053 |
| `authModes` | `detect` sin mecanismo verificado (U-03) | igual | `chatgpt` (verified, `codex login status`), `api_key` (unverified, `CODEX_API_KEY` por proceso) `[001c §2]` | igual | FR-025, FR-065 |
| `infraFailureClasses` | ninguna | ninguna | `process_create` (error 267, cualquier sandbox), `session_lock` `[001c §4, §12]` | `[NO VERIFICADO: U-13]` | FR-032 (R-18) |
| `processTree` | `claude.exe → cmd.exe → pwsh.exe (+conhost)` `[001 §7]` | grupo de procesos `[NO VERIFICADO]` | `codex.exe` nativo, nunca el shim; con `elevated`, descendientes del usuario `CodexSandboxOffline` `[001c §9]` | `[NO VERIFICADO: U-13]` | FR-030 |

Con `writeScopeEnforcement = detect`, una escritura fuera del alcance observada en git deja el nodo
`blocked` con `WRITE_OUTSIDE_SCOPE`, con cualquier agente (FR-036.4, FR-037). La regla vive en
`resolveNodeResult`, no en el adaptador.

## Traducción de `LaunchSpec` a flags de Claude Code (Windows)

La justificación de cada flag está en research R-08 y R-10. Todos están verificados en 001/001b,
salvo lo que dice lo contrario.

| Parte | Flags |
|---|---|
| Base (siempre) | `-p --output-format stream-json --verbose --input-format stream-json --strict-mcp-config --restricted --permission-mode acceptEdits --model <model> --json-schema <schema>` |
| Turnos | `--max-turns <maxTurns + 2>` |
| Herramientas sin terminal, alcance ≠ `[]` | `--tools "Read,Write,Edit,Glob,Grep" --allowedTools "Read Write Edit Glob Grep"` (+ reglas de ruta si U-02 se confirma) |
| Herramientas sin terminal, alcance `[]` | `--tools "Read,Glob,Grep" --allowedTools "Read Glob Grep"` |
| Terminal habilitada | lo anterior, con `PowerShell` agregado a `--tools`; `--allowedTools "PowerShell"` o `"PowerShell(<cmd>)"` por cada comando permitido |
| Prompt | por stdin como mensaje `user` stream-json; stdin se cierra al recibir `result` (U-04) |
| Pedido de reporte | los mismos flags (incluido `--model`) + `--resume <sessionId> --fork-session`, con el mismo `cwd` |
| Nunca | `--dangerously-skip-permissions`, `--disallowedTools StructuredOutput`, `--permission-mode dontAsk`, `child.kill()` |

## Traducción de `LaunchSpec` para Codex (Windows)

La justificación está en research R-13. Todo está verificado en 001c, salvo lo que dice lo
contrario.

| Parte | Flags / regla |
|---|---|
| Binario | `codex.exe` nativo (`@openai/codex-win32-x64/vendor/…/bin/`), sin shell. Nunca `codex.cmd` `[001c §9]`. |
| Base (siempre) | `exec --json --ignore-user-config --ignore-rules --output-schema <schema.json>` |
| Modelo (siempre) | `-m <model> -c model_reasoning_effort="<reasoningEffort>"` (R-27) |
| Sandbox (siempre) | `-s workspace-write -c windows.sandbox="elevated"` (o `"unelevated"` si `detect()` no encontró el setup) `-c sandbox_workspace_write.exclude_tmpdir_env_var=true -c sandbox_workspace_write.exclude_slash_tmp=true` |
| Superficie (siempre) | `--disable apps --disable plugins --disable image_generation --disable multi_agent --disable goals --disable browser_use --disable computer_use -c web_search="disabled"` |
| Prompt | `-` y el `TaskAssignment` por stdin; stdin se cierra después de escribirlo |
| Entorno | sin `CODEX_API_KEY`, `OPENAI_API_KEY` ni `CODEX_HOME` heredados; `CODEX_API_KEY` solo si el nodo usa clave de API, inyectada en ese proceso y nunca persistida (R-28) |
| Terminal / lista de comandos / turnos | no se pasan: la terminal está siempre, la lista y los turnos no aplican (FR-017, FR-018, FR-032) |
| Pedido de reporte | `exec fork <thread_id>` desde el mismo `cwd`, con `-m`, `-c model_reasoning_effort`, `-c windows.sandbox`, los `--disable` y el sandbox como `-c sandbox_mode="…"`: fork **no acepta `-s`** `[001c §5]`. `--json`, `--output-schema`, `--ignore-user-config` e `--ignore-rules` en fork: `[NO VERIFICADO: U-14]` |
| Cancelación | `taskkill /PID <codex.exe> /T /F`; sin fase 1 |
| Al terminar | leer el rollout (`$CODEX_HOME/sessions/…/rollout-*-<thread_id>.jsonl`): `turn_context.model`, `token_count.rate_limits`, `task_complete.duration_ms`, rechazos |
| Clasificación | 1) firma de 267 o de writer lock en stderr/rollout → `infra_failure`; 2) `turn.failed` o exit ≠ 0 → `agent_error`; 3) exit 0 + `turn.completed` → `exited`, con los rechazos como `inferred_denial` |
| Nunca | `danger-full-access`, `exec resume`, fork desde otro `cwd`, `approval_policy` (se ignora en `exec`) |

## Adaptador simulado (`fake`)

Implementa la misma interfaz. Lanza `packages/adapters/test/fake-agent`, un proceso Node real, que
reproduce un guion construido con los JSONL de `spikes/*/samples/`. El guion puede:

- emitir eventos con retardos;
- terminar con o sin evento final;
- responder o ignorar un interrupt;
- lanzar nietos `cmd.exe → powershell.exe` que escriben un archivo cada segundo;
- escribir o no escribir archivos en el worktree;
- simular un `infra_failure`, incluido el caso de Codex que termina con exit 0 y `turn.completed`
  pero con el error 267 en stderr.

Sus capacidades se pueden configurar por test, para cubrir las dos columnas de la matriz sin
proveedores reales (Principio XVI, research R-26).
