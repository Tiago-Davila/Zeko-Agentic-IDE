# Spike 001: encadenar `claude -p` con stream-json

Spike descartable. No es código de producto.

- **Entorno:** Windows 10, Node 24.14, Claude Code 2.1.280, fecha 2026-09-22.
- **Modelo:** `--model sonnet` (resuelve a `claude-sonnet-5`) salvo que se indique otro. El default del usuario es `claude-opus-5-5`: un "di hola" con opus costó US$ 0,063 (`samples/q1-verbose-raw.jsonl`). Se elige con `SPIKE_MODEL`.
- **Cómo correr:** `npm i`, después `npx tsx chain.ts <events|chain|structured [n]|perms|cancel|worktree|all>`. Sin argumentos corre `chain`.
- **Evidencia:** está en `samples/`. `samples/events/` tiene un ejemplo real por cada tipo de evento. Los logs crudos quedan en `runs/`, que está en gitignore.
- **Costo total del spike:** unos US$ 3–4 en llamadas.

---

## 1. Invocación

**Respuesta:** el mínimo es `claude -p --output-format stream-json --verbose`.

- `--verbose` es obligatorio. Sin él, el proceso sale con exit 1 y este error: `Error: When using --print, --output-format=stream-json requires --verbose` (`samples/q1-no-verbose.txt`).
- El prompt puede ir como argumento o por stdin. Usé stdin para no pelear con el quoting de Windows, y funcionó sin problemas.
- `spawn("claude", args)` funciona sin `shell: true`, porque `claude.exe` es un binario nativo.

**Flags opcionales que conviene usar en un motor:**

| Flag | Para qué |
|---|---|
| `--model` | Fijar el modelo. Si no se pasa, se hereda el default del usuario. |
| `--strict-mcp-config` | No cargar los MCP del usuario. Sin él, el `init` lista 6 servidores de claude.ai en estado `pending`, que son ruido y superficie de riesgo. |
| `--include-partial-messages` | Emite deltas token a token (`stream_event`). Solo hace falta para UI en vivo. |
| `--input-format stream-json` | Mantiene stdin abierto para mandar mensajes y `control_request`. Es necesario para cancelar limpio (ver Q7). |
| `--allowedTools` / `--permission-mode` / `--tools` | Permisos (ver Q6). |
| `--max-budget-usd` | Tope de gasto (ver Q3). |
| `--json-schema` | Salida estructurada nativa (ver Q5). |
| `--session-id <uuid>` | Fijar el id de sesión desde el motor en vez de leerlo del stream. |
| `--no-session-persistence` | No guardar la sesión en disco. Incompatible con resume. |

**Sorpresas:**

- Hay flags de "producto" que el motor podría aprovechar más adelante: `-w/--worktree`, `--bg`, `--agents` y `--restricted`. No los probé.
- En Windows, el `init` reporta la herramienta `PowerShell` y **no** `Bash` (ver Q6).

**Recomendación:** el adaptador arma siempre `-p --output-format stream-json --verbose --model X --strict-mcp-config`, y agrega los flags de permisos por nodo.

## 2. Eventos

Cada línea de stdout es un JSON. Estos son los tipos observados (el ejemplo real de cada uno está en `samples/events/<type>.<subtype>.<bloque>.json`):

| `type` / `subtype` | Cuándo | Datos útiles |
|---|---|---|
| `system/init` | Siempre primero, unos 1,5 s después del spawn. | `session_id`, `model`, `tools[]`, `permissionMode`, `mcp_servers[]`, `cwd`, `claude_code_version`, `powershell_path` |
| `system/status` | Estado de la request (`status: "requesting"`). | |
| `system/thinking_tokens` | Mientras piensa. | |
| `system/task_started` / `system/task_notification` | Una herramienta de shell arranca o termina. | `task_id`, `tool_use_id`, `status` |
| `system/permission_denied` | Una herramienta fue denegada automáticamente. | `tool_name`, `decision_reason`, `message` |
| `assistant` | Un mensaje del modelo por cada bloque de contenido. | `message.content[]` con bloques `text`, `thinking` o `tool_use` (`name`, `input`, `id`) |
| `user` | Resultados de herramientas y mensajes sintéticos. | Bloques `tool_result` (`tool_use_id`, `content`, `is_error`) o `text` (por ejemplo `[Request interrupted by user for tool use]`) |
| `rate_limit_event` | Después de cada request a la API. | `rate_limit_info.unifiedWindows.five_hour.utilization`, `resetsAt` |
| `stream_event` | Solo con `--include-partial-messages`. | Eventos crudos de la Messages API: `message_start`, `content_block_start/delta/stop` (`text_delta`, `thinking_delta`, `input_json_delta`, `signature_delta`), `message_delta`, `message_stop` |
| `control_response` | Respuesta a un `control_request` enviado por stdin. | `response.request_id` |
| `result/<subtype>` | Siempre último, si el proceso no fue matado. | Ver Q3. |

**Sorpresas:**

- Un mensaje `assistant` puede traer un solo bloque. Un turno con thinking, texto y tool_use llega como varios eventos `assistant` que comparten `message.id`.
- El thinking llega redactado: `thinking: ""` con `signature`. No hay texto de razonamiento visible.
- Cada evento trae `session_id`, así que no hace falta esperar al init para correlacionar.
- `parent_tool_use_id` distingue los eventos de subagentes.

**Recomendación:** el adaptador normaliza a un conjunto chico de eventos: `started(session, tools, model)`, `text`, `tool_call(id, name, input)`, `tool_result(id, ok, content)`, `permission_denied`, `rate_limit`, `finished(...)`. Todo lo demás se pasa como `raw` para logging.

## 3. Terminación

**Respuesta:** hay que usar las dos señales: **el evento `type:"result"` y el `close` del proceso**. El éxito se decide por **`is_error`**, no por `subtype`.

| Caso | exit | `result.subtype` | `is_error` | `terminal_reason` | Evidencia |
|---|---|---|---|---|---|
| Normal | 0 | `success` | false | `completed` | `q2-events-summary.json` |
| Modelo inválido | 1 | **`success`** (!) | **true** | `api_error` | `q3-error-bad-model.json` |
| Presupuesto agotado | 1 | `error_max_budget_usd` | true | `budget_exhausted` | `q3-error-budget.json` |
| Interrupt por stdin | 1 | `error_during_execution` | true | `aborted_tools` | `q7-cancel.json` |
| Proceso matado | null / 1 | *(no hay `result`)* | | | `q7-cancel.json` |

**Qué trae el `result`** (`samples/events/result.success.json`):

- `result` (texto final)
- `session_id`
- `total_cost_usd`
- `usage` (`input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`, `iterations[]`)
- `modelUsage` por modelo (con `costUSD` y `contextWindow`)
- `duration_ms`, `duration_api_ms`, `ttft_ms`, `num_turns`
- `permission_denials[]` (con `tool_name` y `tool_input`)
- `stop_reason`, `terminal_reason`
- `structured_output`, cuando se usa `--json-schema`

**Sorpresas:**

- El caso de modelo inválido reporta `subtype: "success"`. Si el motor mira `subtype`, lo toma como éxito.
- Con presupuesto agotado, `result` viene vacío y `usage` en cero, pero `total_cost_usd` es 0,03. Además el tope se controla **después** de gastar, así que no es un límite duro.
- `stderr` trae un código útil en errores del CLI, por ejemplo `[claude-code:unrecognized_model]`.
- El tiempo de pared es aproximadamente `duration_ms` + 1,5–2 s de arranque del proceso.

**Recomendación:**

- `ok = result && !result.is_error && exit === 0`.
- Si llega `close` sin `result`, el estado es "cancelado/crash".
- Guardar `terminal_reason` como motivo tipado.
- Esperar `close`, no `exit`, para que stdout esté drenado.

## 4. Encadenamiento: inyectar vs reanudar

**Setup** (`chain.ts`, comando `chain`):

- **Nodo 1 (ANALISTA):** lee `inventario.md` y devuelve una línea.
- **Nodo 2 (REVISOR, otro agente):** la persona va *solo* en `--append-system-prompt`. Recibe dos preguntas: una que se responde con el resumen, y otra sobre un dato del archivo que el resumen **no** incluye (`lote_referencia`).
- Los dos nodos tienen las mismas herramientas (`--allowedTools Read`).

**Resultados** (`samples/q4-chain.json`):

| Variante | Tokens de entrada | Caché nueva | USD | Herramientas en nodo 2 | Sabe el dato no resumido | Respeta la persona nueva |
|---|---|---|---|---|---|---|
| Nodo 1 | 88k (3 turnos) | 347 | 0,021 | Glob, Read | n/a | n/a |
| **a) inyectar** | 88k (3 turnos) | 29,7k | **0,133** | **Glob, Read (relee el archivo)** | sí, releyendo | **sí** |
| **b) `--resume`** | 29,7k (1 turno) | 0 | **0,027** | ninguna | **sí, del historial** | **no** |
| b) `--resume --fork-session` | 29,7k | 118 | 0,028 | ninguna | sí | **no** |
| b) resume + `--system-prompt-snapshot off` | 29,8k | 6,5k | 0,052 | ninguna | sí | **sí** |
| b) resume desde otro `cwd` | 59,8k | 355 | 0,037 | Glob (falla) | sí, pero confundido | no |

**Hallazgos:**

1. **Resume** conserva todo el historial, incluidos los `tool_result` crudos. El nodo 2 responde sin retrabajo, en 1 turno y a un costo unas 5 veces menor. Mantiene el mismo `session_id`, así que **muta** la sesión del nodo 1.
2. `--fork-session` crea un `session_id` nuevo y deja intacta la sesión original. Es la forma segura de reanudar.
3. **Al reanudar, un system prompt distinto se ignora en silencio.** El snapshot del system prompt (`--system-prompt-snapshot`, activo por defecto) congela el del nodo 1. La persona del nodo 2 solo se aplica con `--system-prompt-snapshot off`, que tiene el costo de recrear la caché.
4. **Cambiar el set de herramientas al reanudar lo rompe.** Probé con `--tools ""`, sin herramientas. El modelo devolvió respuestas vacías: solo thinking, con el mensaje sintético `[Your previous response had no visible output...]`, y `result: ""` con `is_error: false`. Otras veces dijo "no tengo lectura del archivo". Evidencia en `samples/q4-chain-run2-tools-empty.json`.
5. **Inyectar** arranca limpio: persona nueva, herramientas nuevas y contexto chico (9k tokens si no necesita releer). Pero pierde todo lo que no está en el texto del resultado. Si falta un dato, el agente lo re-descubre con herramientas (3 turnos, 88k tokens) o dice que no sabe.
6. Resume funciona desde otro `cwd`: la sesión se encuentra igual. Pero el agente se desorienta porque las rutas relativas cambian.
7. Sorpresa sin resolver: en la primera corrida, con la clave `codigo_secreto`, **ninguna** variante reveló el valor, ni siquiera resume. Con el nombre neutro `lote_referencia` todas lo hicieron. El nombre de la clave influye en la respuesta, algo que hay que tener en cuenta en los tests (`q4-chain-run1-codigo_secreto.json`).

**Recomendación para el motor:**

- **Entre nodos de agentes distintos**, el default es **inyectar**, porque es el único modo que respeta la persona y las herramientas del nuevo agente. El resultado del nodo anterior tiene que ser un **artefacto estructurado** (el JSON de Q5 más los archivos del worktree), no texto libre. Así "lo que no se resumió" queda en el filesystem y no en el historial.
- **Reanudar** conviene para continuar el *mismo* agente: reintentos, "arreglá lo que falló" o respuestas a un BLOCKED. Siempre con `--fork-session`, el mismo toolset, el mismo `cwd`, y sabiendo que el system prompt queda congelado.

## 5. Salida estructurada

Tarea: crear `saludo.txt`, verificarlo y reportar `{status, summary, filesChanged, checks, blockers}`. Se valida con zod `.strict()`. Fueron 5 corridas por variante, las 15 en paralelo (`samples/q5-structured.json`).

| Variante | JSON estricto válido | Válido extrayendo `{…}` | USD promedio | Turnos |
|---|---|---|---|---|
| A) Prompt: "tu último mensaje debe ser solo JSON" | **4/5** | 5/5 | 0,047 | 3 |
| B) Prompt: "escribí `zeko-result.json`" | **5/5** | 5/5 | 0,057 | 4 |
| C) `--json-schema <schema>` | **5/5** | 5/5 | 0,066 | 4 |

**Hallazgos:**

- La falla de A fue el texto `"Verificado: el contenido coincide.\n\n{...}"`: un preámbulo antes del JSON. Es el modo de falla clásico.
- `--json-schema` agrega una herramienta interna `StructuredOutput`. El modelo la llama al final y el `result` trae **`structured_output`** ya parseado, además de `result` con el JSON como string. Es la opción más robusta, porque el CLI valida contra el schema. Cuesta 1 turno extra.
- B depende del permiso de `Write`, ensucia el worktree con un archivo que hay que excluir del diff, y agrega 1 turno.
- 15 procesos `claude` concurrentes convivieron sin problemas.
- **No probado:** casos BLOCKED o FAILED reales, y fallas de schema con `--json-schema` (qué pasa si el modelo nunca llama a `StructuredOutput`). Solo cubrí el camino feliz.

> **Actualizado en 001b:** `--json-schema` **no garantiza** la salida: si el modelo no llama a `StructuredOutput`, el proceso termina en `success` sin `structured_output`. Además, un schema demasiado estricto induce datos de relleno. Ver `../001b-claude-edges/FINDINGS.md` §A.

**Recomendación:** usar `--json-schema` como mecanismo primario y validar igual con zod (defensa en profundidad). Como fallback, parsear leniente el `result`. No usar el archivo.

## 6. Permisos

Sin nadie que apruebe (sin TTY ni host SDK), en modo print **no se cuelga nunca**. Lo que requiere aprobación se deniega automáticamente, el agente sigue con el resto, y el proceso termina con **exit 0 y `is_error: false`**.

Tarea: `Write permiso.txt` y después `git --version` (`samples/q6-perms.json`). Segunda tanda con `git init` (`samples/q6-perms-shell.json`).

| Flags | Write | Shell que muta (`git init`) | Cómo se ve |
|---|---|---|---|
| *(ninguno)* | ❌ denegado | ❌ denegado | `permission_denials[]` en el result, `tool_result` con `is_error`, evento `system/permission_denied` |
| `--permission-prompts none` | ❌ | – | Igual, con un mensaje más explícito ("no approval surface… do not retry") |
| `--allowedTools Write` | ✅ | – | |
| `--allowedTools "PowerShell(git init)"` | – | ✅ | |
| `--allowedTools "Bash(git init)"` | – | ❌ | **La regla Bash no aplica en Windows** |
| `--permission-mode acceptEdits` | ✅ | ❌ | El modelo termina *preguntando* "¿confirmás?" en un proceso sin humano |
| `--permission-mode dontAsk` | ❌ | – | El mensaje de denegación invita al modelo a "intentar con otras herramientas" |
| `dontAsk` + `--allowedTools Write` | ✅ | – | |
| `--disallowedTools PowerShell` | – | ❌ | La herramienta desaparece del set |
| `--tools Read` | ❌ | ❌ | Las herramientas no existen, así que no hay denials |
| `--dangerously-skip-permissions` | ✅ | ✅ | `permissionMode: bypassPermissions` |

**Sorpresas:**

1. **En Windows no hay herramienta Bash, solo `PowerShell`.** `--disallowedTools Bash` no bloquea nada: el modelo corrió `git --version` con PowerShell y lo reportó así. Las reglas de shell dependen de la plataforma.
2. Los comandos de solo lectura (`git --version`, `echo`) pasan **siempre**, incluso en `default` y `dontAsk`, porque el clasificador los auto-aprueba.
3. Una tarea con permisos denegados termina en "éxito" según `is_error`. La única señal es `permission_denials.length > 0`.
4. El mensaje de `dontAsk` sugiere buscar rutas alternativas, lo que abre la puerta a que el modelo esquive una restricción con otra herramienta.

**Recomendación:**

- El motor define por nodo una **allowlist explícita** (`--allowedTools`), con el modo `dontAsk` o `--permission-prompts none`.
- Trata `permission_denials.length > 0` como **BLOCKED**, aunque `is_error` sea false.
- Genera las reglas de shell según la plataforma (`PowerShell(...)` en Windows, `Bash(...)` en Unix), o usa `--tools` para quitar herramientas en vez de solo denegarlas.
- Para aprobaciones interactivas en el futuro: `--permission-prompts host` junto con el protocolo de control por stdin. No lo probé.

## 7. Cancelación

Tarea: un comando PowerShell que agrega una línea por segundo a `progreso.txt` durante 25 s. Se cancela 4 s después del `tool_use` (`samples/q7-cancel.json`).

Árbol de procesos observado: `claude.exe → cmd.exe → pwsh.exe` (+ `conhost.exe`). La shell **no** es hija directa de claude.

| Método | exit / signal | ¿`result`? | Últimos eventos | ¿Huérfanos? |
|---|---|---|---|---|
| `child.kill()` (Node, `TerminateProcess`) | null / SIGTERM | **no** | `system/task_started` (stdout se corta en seco) | **Sí.** `pwsh.exe` sigue vivo y `progreso.txt` pasó de 4 a 10 líneas en 5 s. En una corrida previa llegó a las 25. |
| `taskkill /PID <pid> /T /F` | 1 / null | **no** | ídem | No |
| `control_request {subtype:"interrupt"}` por stdin (con `--input-format stream-json`) | 1 / null | **sí**, `error_during_execution`, `terminal_reason: aborted_tools` | `control_response` → `system/task_notification` → `tool_result` con error "The user doesn't want to proceed…" → `user` "[Request interrupted by user for tool use]" → `result` | No |

**Hallazgos:**

- Los "archivos a medio escribir" dependen de la herramienta. `progreso.txt` quedó con 3 o 4 líneas: el estado parcial del comando del usuario. `fin.txt`, el paso siguiente, nunca se creó.
- Si el proceso se mata, no hay commit ni rollback: el worktree queda en el estado que haya dejado.
- El `interrupt` tardó unos 100 ms en producir el `result`. Además reporta `total_cost_usd` hasta ese momento.
- Nota de método: buscar huérfanos por `ParentProcessId == pid de claude` **no funciona**, porque el padre de `pwsh` es un `cmd.exe` intermedio. Tampoco sirve buscar por línea de comando, porque la herramienta PowerShell no pasa el comando por argv.

**Recomendación:**

- El adaptador arranca **siempre** con `--input-format stream-json` para poder cancelar en dos fases:
  1. `interrupt` por stdin y esperar el `result` con un timeout de unos 5 s.
  2. Si no llega, matar el árbol completo (`taskkill /T /F` en Windows; en Unix, spawn con `detached: true` y `process.kill(-pgid)`).
- Nunca usar `child.kill()` solo.
- Después de cancelar, el worktree se considera sucio y se descarta o inspecciona.

## 8. Aislamiento con git worktree

`chain.ts worktree` hace lo siguiente (`samples/q8-worktree.json`):

1. Crea el worktree con `git worktree add -b spike/wt-<ts> runs/wt HEAD`.
2. Corre claude con `cwd` en el worktree y `--allowedTools "Read Edit Write"`.
3. Verifica los dos lados.
4. Borra el worktree y la rama.

**Resultado:** ✅ aislado.

- Las herramientas usaron rutas absolutas dentro del worktree (`...\runs\wt\README.md`).
- `git status` del worktree: `M README.md`, con el diff esperado.
- `git status` del repo principal: idéntico antes y después. `README.md` del repo principal sin cambios.

**Sorpresas y riesgos:**

- Claude no está confinado al `cwd`: con rutas absolutas podría escribir fuera. El aislamiento es por convención, salvo que se use `--restricted`, que según `--help` confina las herramientas de archivos a los directorios de trabajo. No lo probé.
- El worktree de este spike está *adentro* del repo principal (`runs/wt`, en gitignore). Claude busca `CLAUDE.md` y `.claude/` subiendo por los directorios, así que un worktree anidado **hereda la config del repo padre**.
- El `README.md` del repo tiene CRLF y la línea agregada quedó con LF. Hay que considerar `.gitattributes` para los diffs.

**Recomendación:**

- Crear los worktrees **fuera** del árbol del repo, por ejemplo `~/.zeko/worktrees/<run>/<node>`.
- Una rama por nodo o por run.
- Evaluar `--restricted` junto con `--add-dir` como confinamiento real. **Actualizado en 001b:** confina de verdad las herramientas de archivos (incluidos `..` y symlinks), pero **no** la shell. Ver `../001b-claude-edges/FINDINGS.md` §B.
- El motor verifica el diff del worktree (`git status --porcelain`) como fuente de verdad de `filesChanged`, en lugar de confiar en lo que reporta el agente.

## 9. (Opcional) `codex exec --json`

**Bloqueado:** `codex` no está instalado en esta máquina (`which codex` → not found). Instalarlo con `npm i -g @openai/codex` también requiere autenticarse con OpenAI (API key o login de ChatGPT), así que quedó fuera del tiempo del spike.

**Recomendación para la interfaz común del adaptador**, derivada solo de Claude:

- `start(opts) → stream<NormalizedEvent>`
- `cancel()`, que implementa la cancelación en dos fases de Q7
- `resume(sessionId, {fork})`
- `NormalizedEvent` = `started | text | tool_call | tool_result | permission_denied | usage | finished{ok, reason, sessionId, costUsd, tokens, durationMs, structuredOutput, denials}`

Hay que validar esta interfaz contra la forma de los eventos de codex en un spike 001b.

---

## Resumen de decisiones para el motor

1. **Adaptador base:** `claude -p --output-format stream-json --verbose --input-format stream-json --model X --strict-mcp-config`. El prompt va por stdin como mensaje `user`.
2. **Éxito:** hace falta el evento `result`, `is_error === false`, exit 0 y `permission_denials` vacío. Si no, el estado es FAILED o BLOCKED según `terminal_reason` y los denials.
3. **Entre agentes:** inyectar un artefacto estructurado. `--resume --fork-session` solo para continuar el mismo agente.
4. **Salida:** `--json-schema` más zod.
5. **Permisos:** allowlist explícita por nodo, reglas de shell según la plataforma, y ningún nodo depende de aprobaciones.
6. **Cancelar:** `interrupt` por stdin y, si no alcanza, matar el árbol completo.
7. **Aislamiento:** un worktree por nodo fuera del repo, con el diff de git como fuente de verdad.
