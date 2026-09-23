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
| `detect()` | — | `AgentAvailability` | Verificación previa (FR-025, FR-065). Sin costo. No lanza tareas. |
| `readUsage()` | — | `AgentUsageReading?` | Lectura del uso de la suscripción **fuera** de una ejecución. Claude: ausente, porque solo informa en vivo (R-17). Codex: fuente P-08 (FR-052). |
| `launch(spec)` | `LaunchSpec` | `AgentExecution` | Lanza el proceso con el supervisor (R-14). No bloquea. |
| `requestReport(prev, spec)` | `AgentExecution` terminada + `LaunchSpec` | `AgentExecution` | Único pedido adicional de reporte (FR-038). Claude: `--resume <session> --fork-session`, mismo toolset y `cwd` `[001 §4]`. Codex: P-10 / U-08. |

`AgentExecution`:

| Miembro | Tipo | Semántica |
|---|---|---|
| `events` | flujo asíncrono de `NormalizedEvent` | En orden. Termina después del último evento. |
| `completion` | promesa de `{outcome: ProcessOutcome, report: ReportCandidate}` | Se resuelve **después** de `close` del proceso raíz y de verificar el árbol (R-09, R-14). Nunca se rechaza por errores del agente: esos van en `outcome`. |
| `cancel(reason)` | `reason ∈ {user, timeout, shutdown}` → promesa | `user`/`timeout` en un agente con `orderlyInterrupt`: fase 1 (interrupt, 5 s), luego fase 2. En otro caso, o con `shutdown`: solo fase 2, terminación forzada del árbol registrado. Se resuelve cuando el supervisor verificó que **no queda ningún proceso del árbol** (FR-030, NFR-004). Es idempotente. |
| `rootPid` | `{pid, creationTime}` | Para persistir en `process_tree`. |

### `LaunchSpec` (lo arma `core`; lo traduce el adaptador)

| Campo | Tipo | Origen |
|---|---|---|
| `runId`, `nodeRunId`, `attemptId` | ids | motor |
| `workspacePath` | ruta absoluta del worktree | R-15 |
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
| `infra_failure` | `cause: sandbox_launcher`, `detail` | Fallo de infraestructura del agente, con su propia política de reintento. | `[001c-resumen]`, P-09 |
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
| `session_started` | `sessionId`, `model?`, `tools?`, `agentVersion?` | `system/init` | P-06 |
| `assistant_text` | `text`, `subagent?` | `assistant` bloque `text` (`parent_tool_use_id` → `subagent`) | P-06 |
| `tool_call` | `toolUseId?`, `name`, `input` | `assistant` bloque `tool_use` | P-06 |
| `tool_result` | `toolUseId?`, `ok`, `content` | `user` bloque `tool_result` (`is_error`) | P-06 |
| `permission_denied` | `tool`, `reason`, `input?` | `system/permission_denied` y `result.permission_denials[]` (sin duplicar) | — (no informa) |
| `sandbox_rejection` | `line` | — | stderr, patrón P-03 (research T-06) |
| `usage` | `consumption?`, `cost?` | `result.usage`, `total_cost_usd`, `modelUsage.*.costBasis` | P-06 |
| `subscription_usage` | `AgentUsageReading` | `rate_limit_event.rate_limit_info.unifiedWindows` | — (usa `readUsage()`) |
| `stderr` | `line` | stderr (`[claude-code:…]`) | stderr |
| `raw` | `data` | cualquier otro evento (`system/status`, `thinking_tokens`, `task_*`, `stream_event`, `control_response`) | P-06 |

Los eventos `raw` van al log de diagnóstico y no se muestran en la salida en vivo (NFR-002).
`assistant` con thinking redactado se descarta `[001 §2]`.

## Matriz de capacidades

`AgentCapabilities` es la declaración de cada adaptador. La UI la muestra en el nodo (NFR-012,
FR-011) y `core` la usa para el confinamiento (data-model §1) y para `resolveNodeResult`.

| Capacidad (campo) | Claude Code — Windows | Claude Code — Linux | Codex — Windows | Codex — Linux | FR |
|---|---|---|---|---|---|
| `terminal.canDisable` (nodos sin terminal) | sí | sí | **no**, siempre con terminal `[spec-clar]` | no | FR-017 |
| `confinement.noTerminal` | `full` (lectura+escritura), `--restricted` `[001b §B1]` | `full` `[NO VERIFICADO: U-06]` | n/a | n/a | FR-019 |
| `confinement.withTerminal` | `none` `[001b §B2]` | `none` | `write_only` `[spec-clar]`, P-02 | `write_only` `[spec-clar]` | FR-019, FR-020 |
| `writeScopeEnforcement` | `prevent` en alcance vacío o total; `detect` en alcance parcial hasta cerrar U-02 | igual | `detect` (el diff de git lo verifica todo) | `detect` | FR-017, US5-3 |
| `commandAllowlist` | sí, `PowerShell(<cmd>)` `[001 §6]`; **los comandos de solo lectura se auto-aprueban** | sí, `Bash(<cmd>)` `[NO VERIFICADO: U-06]` | no `[spec-clar]` | no | FR-018 |
| `reportsDenials` | sí `[001 §6]`, `[001b §B1]` | sí | **no** (verificación "not available") `[spec-clar]` | no | FR-023, FR-036.4 |
| `supportsTurnLimit` | sí, `--max-turns` `[001b §A2]` | sí | **no** `[spec-clar]` | no | FR-032 |
| `timeLimit` | motor | motor | motor | motor | FR-032 |
| `orderlyInterrupt` | sí, `control_request interrupt` `[001 §7]` | sí | **no**: kill forzado del árbol `[spec-clar]` | no | FR-030 |
| `network` | sin herramientas de red en `--tools`; con terminal, la shell tiene red | igual | **sin red** `[spec-clar]` | según P-02 | FR-066 |
| `structuredOutput` | `--json-schema` + zod `[001 §5]` | igual | schema estricto (P-05) + zod | igual | FR-033 |
| `reportRequest` | `--resume --fork-session` `[001 §4]` | igual | P-10 / U-08 | igual | FR-038 |
| `reportsCost` | sí, `list_price_estimate` (`costBasis: list`) `[sample: result.success.json]` | igual | **no** `[spec-clar]` | no | FR-050, FR-051 |
| `reportsConsumption` | sí (tokens) `[001 §3]` | sí | sí `[spec-clar]` | sí | FR-050 |
| `subscriptionUsage` | `live` (`rate_limit_event`) `[001 §2]` | `live` | `per_node` (al terminar y antes de lanzar) `[spec-clar]`, P-08 | `per_node` | FR-052, FR-053 |
| `authModes` | `detect` sin mecanismo verificado (U-03) | igual | `chatgpt` (verified), `api_key` (unverified) `[spec-clar]`, P-07 | igual | FR-025, FR-065 |
| `infraFailureClasses` | ninguna | ninguna | `sandbox_launcher` `[001c-resumen]`, P-09 | P-09 | FR-032 (R-18) |
| `processTree` | `claude.exe → cmd.exe → pwsh.exe (+conhost)` `[001 §7]` | grupo de procesos `[NO VERIFICADO]` | binario real, nunca el shim `[001c-resumen]`, P-01 | P-01 | FR-030 |

## Traducción de `LaunchSpec` a flags de Claude Code (Windows)

La justificación de cada flag está en research R-08 y R-10. Todos están verificados en 001/001b,
salvo lo que dice lo contrario.

| Parte | Flags |
|---|---|
| Base (siempre) | `-p --output-format stream-json --verbose --input-format stream-json --strict-mcp-config --restricted --permission-mode acceptEdits --json-schema <schema>` |
| Turnos | `--max-turns <maxTurns + 2>` |
| Herramientas sin terminal, alcance ≠ `[]` | `--tools "Read,Write,Edit,Glob,Grep" --allowedTools "Read Write Edit Glob Grep"` (+ reglas de ruta si U-02 se confirma) |
| Herramientas sin terminal, alcance `[]` | `--tools "Read,Glob,Grep" --allowedTools "Read Glob Grep"` |
| Terminal habilitada | lo anterior, con `PowerShell` agregado a `--tools`; `--allowedTools "PowerShell"` o `"PowerShell(<cmd>)"` por cada comando permitido |
| Prompt | por stdin como mensaje `user` stream-json; stdin se cierra al recibir `result` (U-04) |
| Pedido de reporte | los mismos flags + `--resume <sessionId> --fork-session` |
| Nunca | `--dangerously-skip-permissions`, `--disallowedTools StructuredOutput`, `--permission-mode dontAsk`, `child.kill()` |

## Traducción de `LaunchSpec` para Codex

**Pendiente de P-01…P-10**, que dependen de los FINDINGS de 001c. El contrato de comportamiento es
obligatorio (research R-13):

- lanzar el binario real, sin shell y nunca el shim de npm;
- fijar la configuración de sandbox de Windows de forma explícita;
- ignorar la config del usuario y deshabilitar los conectores de la cuenta;
- no pasar lista de comandos ni límite de turnos;
- detectar los rechazos del sandbox en stderr aunque el exit sea 0;
- clasificar los fallos del lanzador como `infra_failure`;
- cancelar siempre con kill forzado del árbol registrado.

## Adaptador simulado (`fake`)

Implementa la misma interfaz. Lanza `packages/adapters/test/fake-agent`, un proceso Node real, que
reproduce un guion construido con los JSONL de `spikes/*/samples/`. El guion puede:

- emitir eventos con retardos;
- terminar con o sin evento final;
- responder o ignorar un interrupt;
- lanzar nietos `cmd.exe → powershell.exe` que escriben un archivo cada segundo;
- escribir o no escribir archivos en el worktree;
- simular un `infra_failure`.

Sus capacidades se pueden configurar por test, para cubrir las dos columnas de la matriz sin
proveedores reales (Principio XVI, research R-26).
