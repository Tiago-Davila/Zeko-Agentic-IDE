# Spike 001c: Codex CLI en modo no interactivo

Spike descartable, no es código de producto. Responde para Codex las mismas preguntas que `001-claude-chain` y `001b-claude-edges` respondieron para Claude Code, para poder comparar y decidir qué garantías puede prometer Zeko con cada agente.

- **Entorno:** Windows 11 Pro 10.0.26200, nativo (sin WSL). Node 22.23.2. Spike el 2026-09-23; re-ejecución completa (`codex.ts all`) el 2026-09-24.
- **Sobre las dos pasadas:** los `samples/` versionados son los de la re-ejecución del 2026-09-24. Los números de este documento salen de esos samples. Donde la primera pasada dio un resultado distinto, se aclara, porque la variación entre corridas también es un hallazgo.
- **Codex:** `codex-cli 0.155.1`, instalado por npm. Se lanza el binario nativo `…/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe`, no el shim `codex.cmd` (ver Q9).
- **Autenticación:** cuenta de ChatGPT (plan `team`). No había clave de API real disponible (ver Q2).
- **Modelo:** `gpt-6-luna` con `model_reasoning_effort="low"`. Es el modelo más barato de la lista visible (`codex debug models`: "significantly more efficient, so your usage limits go even further"). La configuración del usuario trae `gpt-5.6-luna` con effort `max`, por eso el modelo y el effort se fijan siempre por flag. Se cambian con `SPIKE_MODEL` y `SPIKE_EFFORT`.
- **Cómo correr:** `npm i`, después `npx tsx codex.ts <invocation|auth|events|termination|chain|structured|tools|sandbox|cancel|isolation|usage|concurrency|all>`.
  - `SPIKE_ONLY=a,b` filtra casos dentro de un subcomando.
  - `SPIKE_WINSANDBOX` elige el sandbox de Windows (`unelevated` por defecto, `elevated` o `none`).
- **Evidencia:** en `samples/`, con un archivo por pregunta. `samples/events/` tiene un ejemplo real de cada tipo de evento. Los logs crudos, stderr y directorios de trabajo quedan en `runs/`, que está en gitignore.
- **Fuentes:**
  - `codex --help`, `codex exec --help`, `codex exec resume|fork --help`, `codex login --help`, `codex app-server --help`, `codex features list`, `codex doctor --json`.
  - Documentación oficial en learn.chatgpt.com (antes developers.openai.com/codex): *non-interactive mode*, *sandboxing*, *windows sandbox* y *config reference*.
  - Todo lo que la documentación afirma se verificó contra el comportamiento real. Si hubo diferencias, están anotadas.
- **Costo del spike:**
  - Codex no informa dinero. Con la cuenta de ChatGPT, cada pasada completa usó unos 2–3 % de la ventana de 5 h.
  - La única llamada a Claude (el caso cruzado de Q5, con `sonnet`) costó US$ 0,41 en la primera pasada y US$ 0,24 en la re-ejecución.
- **Nota del entorno:** esta máquina corre dentro de Orca, que exporta `CODEX_HOME=%APPDATA%\orca\codex-runtime-home\home` e instala hooks de Codex que postean a su UI. El runner quita las variables `ORCA_*` y reemplaza el endpoint del hook por un script que solo deja una marca. Así se mide si los hooks corren (Q10) sin tocar la configuración del usuario. Esto ya es un hallazgo: **el entorno del proceso padre cambia qué configuración usa Codex**, así que el motor tiene que controlarlo.

---

## 1. Invocación

**Respuesta:** el comando mínimo es `codex exec --json -`, con el prompt por stdin (`samples/q1-invocation.json` y `q1-min-raw.jsonl`).

- **Prompt:** puede ir como argumento posicional o por stdin con `-`. Si se pasan los dos, stdin se agrega al prompt como bloque `<stdin>…</stdin>`: el rollout muestra `"…respondé solo el número.\n\n<stdin>\nuno dos tres cuatro cinco\n</stdin>"`. Si el prompt va como argumento y stdin queda abierto pero vacío, Codex igual lo lee (`Reading additional input from stdin...`), así que conviene cerrarlo.
- **Flags obligatorios:** no hay, salvo una condición. **Fuera de un repositorio git, y fuera de un directorio "trusted", `exec` se niega a correr:** exit 1, cero eventos y el mensaje `Not inside a trusted directory and --skip-git-repo-check was not specified.` en stderr. Los worktrees de Zeko son repos, así que no hace falta el flag.
- **Salida:** `--json` emite JSONL en stdout. Sin `--json`, stdout trae solo el último mensaje y stderr trae un banner con modelo, sandbox, approval y session id (`q1-no-json.txt`).
- **Modelo:** `-m <modelo>` o `-c model="<modelo>"`, que son equivalentes. `-m` no se puede repetir (exit 2). **Los eventos no dicen qué modelo se usó.** El dato solo está en el archivo de sesión (`turn_context.model`).
- **Default del modelo:**
  - Sin `-m` y con `--ignore-user-config`, el modelo es `gpt-6-sol`, **no** el barato.
  - Sin `-m` y con la configuración del usuario, además corren los 3 hooks del usuario. El modelo efectivo **no es estable**: el `config.toml` dice `gpt-5.6-luna` y así se usó el 2026-09-23, pero el 2026-09-24, con el mismo `config.toml`, el rollout registró `gpt-6-sol`. El default depende de algo más que el archivo de configuración.
- **Sandbox por defecto de `exec`:** `read-only`. La approval policy efectiva es siempre `never`.

**Flags que el motor debería pasar siempre:**

| Flag | Para qué |
|---|---|
| `--json` | Eventos JSONL. |
| `-m X -c model_reasoning_effort="…"` | Fijar modelo y esfuerzo, sin heredar los del usuario. |
| `--ignore-user-config` | No cargar `$CODEX_HOME/config.toml`: MCP del usuario, plugins, hooks, modelo (Q10). |
| `--ignore-rules` | No cargar reglas execpolicy del usuario ni del proyecto. |
| `-c windows.sandbox="unelevated"\|"elevated"` | **Obligatorio en Windows** si se ignora la configuración del usuario (Q8). |
| `-s read-only\|workspace-write` | Sandbox por nodo. |
| `--output-schema <archivo>` | Reporte estructurado (Q6). |
| `--disable …` / `-c web_search="disabled"` | Recortar herramientas (Q7). |

**Sorpresa:** un "decí hola" ya consume entre 14k y 16k tokens de entrada (unos 11k de ellos cacheados). Son las instrucciones base, las skills del sistema, la lista de plugins recomendados y las instrucciones multiagente, todas inyectadas incluso con `--ignore-user-config`.

**Recomendación:** el adaptador lanza `codex.exe` directo con `exec --json --ignore-user-config --ignore-rules -m X -c model_reasoning_effort=… -c windows.sandbox=… -s … -`, pasa el prompt por stdin y cierra stdin.

## 2. Autenticación

**Cómo detectarla sin ejecutar una tarea** (`samples/q2-auth.json`):

| Chequeo | Resultado con login de ChatGPT | Sin credenciales (`CODEX_HOME` vacío) |
|---|---|---|
| `codex --version` | exit 0, `codex-cli 0.155.1` | exit 0 |
| `codex login status` | **exit 0**, stderr `Logged in using ChatGPT` | **exit 1**, stderr `Not logged in` |
| `codex doctor --json` → `checks["auth.credentials"]` | `stored auth mode: chatgpt`, `stored ChatGPT tokens: true`, `stored API key: false` | |
| `$CODEX_HOME/auth.json` | `auth_mode: "chatgpt"`, `OPENAI_API_KEY: null`, `tokens{id_token, access_token, refresh_token, account_id}` | no existe |

- El texto del estado va por **stderr**, no por stdout. Hay que decidir por el exit code.
- `codex doctor --json` es el chequeo más rico y no consume modelo. Informa `auth file`, el modo, la instalación, las rutas y la cantidad de servidores MCP. Toma alrededor de 1 s.

**Qué pasa si falta la autenticación:** `exec` **no falla rápido**. Hace 10 reintentos (`error` "Reconnecting... n/5", por websocket y después por HTTPS) y termina en `turn.failed` con 401, **exit 1, después de unos 15–17 s**. Por eso conviene chequear antes de lanzar (FR-025).

**Clave de API:** no había una clave real, así que se probó con una clave inválida, que no consume nada.

- `CODEX_API_KEY=<clave>` en el entorno hace que `exec` use la clave: `turn.failed` con `invalid_api_key` después de unos 20 s de reintentos.
- **Trampa: con `CODEX_API_KEY` en el entorno, `codex login status` sigue diciendo "Logged in using ChatGPT" (exit 0), pero `exec` usa la clave y no la cuenta.** `login status` solo ve las credenciales guardadas.
- `OPENAI_API_KEY` en el entorno **se ignora** si hay login de ChatGPT: la corrida funcionó con la cuenta. Con un home vacío, `login status` tampoco lo detecta.
- `codex login --with-api-key` (clave por stdin) guarda la clave en `auth.json`. No lo probé para no pisar el login del usuario.

**Qué cambia entre ChatGPT y clave de API:**

- **Costo en dinero:** con ChatGPT no se informa en ningún lado. `turn.completed.usage` solo trae tokens, sin campo de costo, y el rollout tampoco lo trae. Con clave de API: **no verificado**. El esquema de `turn.completed` no tiene campo de costo, así que lo más probable es que tampoco se informe, pero no lo pude comprobar.
- **Modelos:** con ChatGPT, un modelo no soportado se rechaza con `"The 'X' model is not supported when using Codex with a ChatGPT account."`. El catálogo depende del modo de autenticación.
- **Uso:** con ChatGPT hay ventanas de uso (Q11). Con clave de API se esperaría facturación por tokens sin ventanas, pero no está verificado.

**Recomendación:**

- Detección en dos pasos: exit code de `codex --version`, y después exit code de `codex login status` (o `doctor --json` para mostrar detalle).
- El adaptador **limpia `CODEX_API_KEY` y `OPENAI_API_KEY` del entorno heredado**. Si el usuario eligió clave de API, Zeko la inyecta solo en ese proceso como `CODEX_API_KEY`. Así lo que el motor verificó coincide con lo que `exec` usa.

## 3. Eventos

Cada línea de stdout es un JSON. Tipos observados, con un ejemplo real de cada uno en `samples/events/`:

| Evento | Cuándo | Datos |
|---|---|---|
| `thread.started` | Siempre primero, a unos 350 ms del spawn. | `thread_id`, y nada más: ni modelo, ni herramientas, ni cwd. |
| `turn.started` | | Sin datos. |
| `item.started` / `item.completed` | Por cada ítem. Comparten `item.id`, que sirve para correlacionar. | `item.type` y `status` |
| ↳ `agent_message` | Texto del modelo. Hay mensajes de "commentary" y el final. | `text`, siempre completo: no hay deltas. |
| ↳ `reasoning` | Resumen de razonamiento. Apareció con effort `medium`, no con `low`. | `text` (resumen, no el razonamiento) |
| ↳ `command_execution` | Comando de shell. | `command`, `aggregated_output`, `exit_code`, `status` (`in_progress`/`completed`/`failed`) |
| ↳ `file_change` | Edición con `apply_patch`. | `changes[{path, kind: add\|update\|delete}]`, `status`. **Sin contenido ni diff.** |
| ↳ `mcp_tool_call` | Herramienta MCP. | `server`, `tool`, `arguments`, `result`, `error`, `status` |
| ↳ `web_search` | Búsqueda web nativa. | `query`, `action` |
| ↳ `error` (ítem) | Advertencia no fatal, por ejemplo "Model metadata for `gpt-6-luna` not found…". | `message` |
| `error` | Errores y reintentos de conexión ("Reconnecting... 2/5"). | `message` |
| `turn.completed` | Fin del turno. | `usage{input_tokens, cached_input_tokens, cache_write_input_tokens, output_tokens, reasoning_output_tokens}` |
| `turn.failed` | Fin por error. | `error.message` |

No observé `item.updated` ni `todo_list`: `exec` no expone herramienta de plan. El modelo lo reportó ("No encontré una herramienta de plan").

**Equivalencias con Claude (spike 001):**

| Concepto | Claude Code (`stream-json`) | Codex (`exec --json`) |
|---|---|---|
| Init | `system/init` con `session_id`, `model`, `tools[]`, `permissionMode`, `cwd` | `thread.started`, **solo** `thread_id`. Modelo, sandbox y herramientas solo están en el rollout (`turn_context`). |
| Texto | `assistant` con bloques `text` (y deltas con `--include-partial-messages`) | `item.completed` / `agent_message`, solo completo. Sin deltas. |
| Tool call | `assistant` con `tool_use{id, name, input}` | `item.started` con `command_execution`, `file_change`, `mcp_tool_call` o `web_search`. Cada tipo trae campos propios; no hay `name` + `input` genéricos. |
| Tool result | `user` con `tool_result{tool_use_id, content, is_error}` | `item.completed` del mismo `item.id`, con `status` `completed`/`failed` y `exit_code`/`aggregated_output`/`result`/`error`. |
| Permiso denegado | `system/permission_denied` + `result.permission_denials[]` | **No hay evento.** Hay tres formas, ninguna tipada (Q8): (a) el SO niega dentro del sandbox, y aparece como `command_execution` `failed` con "Acceso denegado" en `aggregated_output`; (b) Codex rechaza lanzar el proceso, y **no aparece ningún ítem**, solo stderr (`ERROR codex_core::tools::router: … Rejected(… blocked by policy)`) y la salida de la herramienta en el rollout; (c) `mcp_tool_call` `failed` con "requires approval". |
| Uso / límites | `result.usage`, `total_cost_usd`, `modelUsage` + `rate_limit_event` | `turn.completed.usage`, solo tokens. **No hay costo ni rate limits en el stream**; están en el rollout (`token_count.rate_limits`) y en el app-server (Q11). |
| Resultado final | `result{subtype, is_error, result, session_id, duration_ms, num_turns, …}` | `turn.completed` o `turn.failed`. **No trae texto final, duración ni `session_id`**: el texto es el último `agent_message` y la duración está en el rollout (`task_complete.duration_ms`). |

**Sorpresas:**

- **La herramienta real del modelo es `exec`, un "code mode"**: el modelo escribe JavaScript que llama `tools.exec_command(...)` o `tools.apply_patch(...)` dentro de `codex-code-mode-host.exe`. El stream traduce esas llamadas a ítems. Lo que el modelo ejecutó de verdad (el JS) solo está en el rollout como `custom_tool_call`.
- `command_execution.command` es la línea completa: `"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -Command '…'`. La shell de Codex en Windows es **Windows PowerShell 5.1**, no pwsh.
- **El archivo de sesión (rollout) es la fuente de verdad** que el stream no da. Está en `$CODEX_HOME/sessions/AAAA/MM/DD/rollout-<ts>-<thread_id>.jsonl` y trae:
  - `turn_context` (modelo, effort, sandbox, approval, raíces escribibles);
  - `token_count` (con rate limits);
  - `task_complete` (duración, TTFT);
  - las llamadas y salidas crudas de herramientas;
  - los rechazos del sandbox;
  - `world_state.agents_md` (qué AGENTS.md se cargaron).

**Recomendación:** normalizar a `started | text | tool_call | tool_result | denied | usage | finished` (ver la interfaz al final). El adaptador de Codex completa `started` y `finished` leyendo el rollout al terminar. Los rechazos se detectan por heurística: `status: failed` más un patrón "Acceso denegado"/"Access is denied" en la salida, más los rechazos del rollout y de stderr.

## 4. Terminación

**Respuesta:** el éxito del **proceso** es `exit 0` más `turn.completed`. Un fallo es `exit ≠ 0` y/o `turn.failed` (`samples/q4-termination.json`).

| Caso | exit | Evento final | Notas |
|---|---|---|---|
| Normal | 0 | `turn.completed` | |
| Modelo inválido | **1** | `turn.failed` + `error` | `"The 'modelo-que-no-existe' model is not supported when using Codex with a ChatGPT account."` Se reporta como error, **sin la trampa de Claude** (`subtype: success` con `is_error`). |
| Valor de config inválido (`-c sandbox_mode="x"`) | 1 | *(ninguno)* | stderr `Error loading config.toml: unknown variant…`. Cero eventos. |
| Flag inexistente (`--max-turns`) | 2 | *(ninguno)* | Error de clap en stderr. **No existe `--max-turns`.** |
| Límite de turnos o tokens | – | – | **No existe en `exec`.** La feature `rollout_budget` (en desarrollo) no se pudo configurar: `--enable rollout_budget` pide `limit_tokens`, y `{enabled=true,…}` → `did not match any variant`. La forma que sí carga (`{limit_tokens=3000}`) **se ignora**: la corrida gastó 58k tokens sin cortar. |
| Tiempo agotado (el motor mata a los 25 s) | 1 | *(ninguno)* | No hay `--timeout`. El límite lo impone el motor (Q9). |
| Sin autenticación / clave inválida | 1 | `turn.failed` después de 10 `error` de reintento | Unos 15–20 s (Q2). |
| Proceso matado | null / 1 | *(ninguno)* | Ver Q9. |

**Trampas donde un error se reporta como éxito:**

1. **Sandbox de Windows no configurado.** Con `--ignore-user-config` y sin `-c windows.sandbox=…`, **Codex rechaza todos los comandos de shell** (`Rejected(… blocked by policy)`).
   - El turno termina con **exit 0 y `turn.completed`**. El modelo dice "No pude leer `datos.txt`: el entorno bloqueó el comando".
   - **El stream no tiene ningún `command_execution`**: el rechazo solo está en stderr y en el rollout.
   - Es la trampa más peligrosa, porque falla silenciosamente el 100 % de la shell.
2. Toda acción denegada termina igual con exit 0 y `turn.completed` (Q8). Pasa lo mismo que en Claude, pero sin un `permission_denials` que la delate.
3. **La creación del proceso de shell falla de forma esporádica con el error de Windows 267** ("El nombre del directorio no es válido"). Aparece como `CreateProcessWithLogonW failed: 267` (elevated), `CreateProcessAsUserW failed: 267` (unelevated) y `Failed to create unified exec process: … (os error 267)` **incluso con `danger-full-access`**, así que no es propio del sandbox.
   - Frecuencia: 3 veces en cada pasada completa (unas 200 corridas cada una, con hasta 6 en paralelo).
   - En la re-ejecución: `q4-rollout-budget-ignored`, `q8-ro-unelev-write-junction` y `q8-full-write-abs-out`.
   - El modelo recibe el error, se rinde y el turno termina con `turn.completed`, exit 0.

**Recomendación:**

- `processOk = exit === 0 && turn.completed && !turn.failed`.
- Si llega `close` sin ninguno de los dos, el resultado es cancelado o crash.
- Además, el adaptador **escanea stderr y el rollout** buscando `Rejected(`, `blocked by policy`, `patch rejected` y `267` (`failed: 267` u `os error 267`). Si encuentra algo, lo registra como acción denegada o error de infraestructura, porque el stream no lo informa.
- Los límites de tiempo son del motor (matar el proceso). Los de turnos no existen en Codex: un "límite de turnos" solo se puede aproximar contando ítems y matando el proceso.

## 5. Encadenamiento

Mismo escenario que 001 (`samples/q5-chain.json`). Nodo 1 ANALISTA en `read-only`. La persona del nodo 2 (REVISOR) va **solo** en `-c developer_instructions="…"`, que es el equivalente de `--append-system-prompt`.

| Variante | thread | Tokens de entrada (cacheados) | Comandos | Sabe `lote_referencia` | Respeta la persona |
|---|---|---|---|---|---|
| Nodo 1 | T | 28k (26k) | 1 | – | – |
| a) inyectar el resultado en un `exec` nuevo | nuevo | 14k (11k) | 0 | **no** (dijo que no podía consultar el archivo) | **sí** |
| b) `exec fork T` | nuevo | 42k (39k) | 0 | sí, del historial | **no** |
| c) fork + `--disable shell_tool --disable unified_exec` | nuevo | 41k | 0 | sí | no |
| d) fork + `-c sandbox_mode="workspace-write"` | nuevo | 58k | 1 | – | – (**creó el archivo**: el sandbox nuevo se aplica) |
| e) fork desde otro `cwd` | nuevo | 57k | 1 | **no**: intentó releer `inventario.md` en el cwd nuevo y no lo encontró. En la primera pasada respondió desde el historial (42k, 0 comandos). | no |
| f) `exec resume T` | **T** | 42k (39k) | 0 | sí | no |

**Hallazgos:**

1. **Hay fork nativo.** `codex exec fork <id>` crea un thread nuevo, y el rollout nuevo registra `forked_from_id: T`. **El original queda intacto**: mismo sha256 y 20 líneas antes y después. `exec resume` **muta** el original: mismo `thread_id`, de 20 a 31 líneas, `turns` 1 → 2.
2. **Al reanudar o hacer fork, las `developer_instructions` nuevas se ignoran en silencio.** El rollout del fork no tiene ningún mensaje de developer con "REVISOR". Solo se inyectan al crear el thread. Es el mismo problema que el snapshot de system prompt de Claude, pero **no hay un equivalente a `--system-prompt-snapshot off`**. La persona de un nodo reanudado solo puede ir en el prompt.
3. **Al hacer fork se pueden cambiar herramientas y permisos**, a diferencia de Claude. `resume` y `fork` no aceptan `-s` ni `--add-dir`, pero `-c sandbox_mode=…`, `--disable shell_tool` y `-m` funcionan. Sin shell, el nodo respondió igual desde el historial, sin romperse. En Claude, `--tools ""` al reanudar producía respuestas vacías.
4. Fork o resume desde otro directorio: la sesión se encuentra por id, desde cualquier cwd, y **el thread nuevo usa el cwd del proceso nuevo** (`turn_context.cwd`). El historial conserva rutas del cwd viejo, así que el agente puede desorientarse. En la re-ejecución intentó leer el archivo en el cwd nuevo, falló y no dio el dato. Es el mismo problema que con Claude en 001.
5. **Concurrencia sobre el mismo thread:** dos `resume` simultáneos del mismo id hacen que el segundo falle en menos de 1 s con `thread-store conflict: thread … already has an active writer`, exit 1 y sin eventos (Q12). Es un lock real.
6. **Caso cruzado Claude → Codex:** un nodo real de Claude (`claude -p --json-schema`, sonnet) arregló `suma.js` y devolvió su `AgentReport`. El motor armó el handoff `{agent, report, engineStatus, observedFiles}` con `git status --porcelain` del worktree, y un nodo REVISOR de Codex (`read-only`, `--output-schema`) lo recibió como datos.
   - Codex verificó el archivo y devolvió un reporte válido con zod: `DONE`, `filesChanged: []`.
   - El handoff cruzado funciona sin nada específico del agente, porque es JSON más el filesystem.
   - **Re-ejecución (US$ 0,24):** Claude declaró `BLOCKED` porque no tuvo permiso de shell para verificar en runtime, con `filesChanged: ["suma.js"]`. Coincide con lo observado en el worktree (`M suma.js`).
   - **Primera pasada (US$ 0,41):** Claude declaró `DONE` con `blockers` no vacío, y además dejó un archivo temporal `_verify_suma.mjs` que el worktree mostraba como `??`. La regla 6 de FR-036 lo convertiría en BLOCKED, y FR-037 mostraría la discrepancia.
   - El mismo nodo dio dos estados declarados distintos entre corridas. Es otro motivo para que el estado final lo decida el motor.

**Recomendación:** igual que con Claude.

- **Entre agentes distintos:** inyectar el artefacto estructurado (reporte + archivos observados + worktree). Es lo único que respeta la persona.
- **Para reintentar el mismo agente:** `exec fork` (nunca `resume`), con la persona repetida en el prompt. Se puede endurecer el sandbox o quitar herramientas al hacer fork, algo que Claude no permite.

## 6. Salida estructurada

**Existe un mecanismo nativo:** `--output-schema <archivo.json>`. `-o <archivo>` escribe además el último mensaje a disco. Mismo schema y mismo `REPORT` que 001b. Corridas en paralelo con pool de 6 (`samples/q6-structured.json`).

| Caso | Esperado | Resultado | JSON válido (zod `.strict()`) | exit |
|---|---|---|---|---|
| `done` ×5 | DONE | DONE ×5 | **5/5** | 0 |
| `blocked-missing-spec` ×2 | BLOCKED | BLOCKED ×2 | 2/2 | 0 |
| `blocked-permission` ×2 (read-only, `npm install`) | BLOCKED | BLOCKED ×2 (`ENOTCACHED`: el sandbox pone npm en modo offline) | 2/2 | 0 |
| `failed-check` ×2 | FAILED | FAILED ×2 | 2/2 | 0 |
| `failed-bug` ×1 | FAILED | FAILED | 1/1 | 0 |
| `prompt-forbids-json` ×2 ("prohibido responder en JSON") | ? | **JSON igual**: `{"status":"DONE","summary":"Cuatro.",…}` y `"Dos más dos es cuatro."` | 2/2 | 0 |
| `schema-not-strict` (sin `additionalProperties:false`) | ? | **`turn.failed`**, 400 `invalid_json_schema`: *"'additionalProperties' is required to be supplied and to be false"* | – | **1** |
| `enum-only-done` (status solo admite DONE), sin `spec.md` | ? | `DONE` con `blockers: []` y "no había una especificación que implementar" | 1/1 | 0 |
| `impossible-constraints` (`summary` ≤ 3, `filesChanged` ≥ 5) | ? | `summary: "Cre"`, `filesChanged: ["saludo.txt copiar completar?","saludo.txt","saludo.txt ok?","saludo.txt — hola zeko","saludo.txt"]`. En la primera pasada: `["saludo.txt","checks","blockers","summary","status"]`. | **1/1 (basura válida)** | 0 |

**Hallazgos:**

- **Es decodificación restringida (structured outputs de la API), no una herramienta.** El **mensaje final** (`agent_message` en `phase: final_answer`) sale siempre con la forma del schema, incluso contra el prompt. Los mensajes intermedios ("commentary") son texto libre: en las corridas normales hubo 2 `agent_message` y solo el último es JSON.
- **La diferencia clave con Claude:** en Claude, `--json-schema` podía terminar en `success` **sin** `structured_output` (001b §A2). En Codex, si el turno termina con `turn.completed`, el último mensaje cumple el schema. El único modo de no tenerlo es que el turno falle o que el proceso muera.
- **El schema tiene que ser "strict" de OpenAI:** `additionalProperties: false` y todas las propiedades en `required`. Si no, la API lo rechaza y el nodo termina en `turn.failed`, exit 1. Es un error de configuración que el motor debe validar antes de lanzar.
- `minLength`, `maxLength` y `minItems` se aceptan, pero la decodificación restringida **corta o rellena** para cumplirlos (`"Cre"`, nombres de campo como archivos). No hay reintento ni error. Es peor que Claude, que al menos rechazaba y reintentaba: acá la basura pasa directo.
- Un enum que no admite la verdad fuerza la mentira, y esta vez **sin** dejar rastro en `blockers`. En Claude al menos `blockers` quedaba lleno.
- **Con criterios BLOCKED/FAILED bien definidos, la clasificación fue 9/9 correcta en las dos pasadas** (13/13 en 001b con Claude).
- El proceso termina en exit 0 y `turn.completed` en todos los casos de tarea. **El resultado de la tarea solo está en el reporte**, igual que con Claude.

**Recomendación:**

- Usar siempre `--output-schema` con el schema de Zeko en modo strict: los tres estados, listas sin `minItems`/`maxItems`, strings sin `maxLength`. FR-034 ya lo pide, y con Codex además es **obligatorio**, porque un schema con restricciones produce basura válida.
- Validar con zod del lado del motor (defensa en profundidad), con las mismas tres capas de 001b: proceso, contrato y consistencia semántica.
- Para FR-038 (pedir el reporte una vez más): `exec fork <id>` con `--output-schema`.

## 7. Herramientas y terminal (pregunta central)

**Respuesta: en Codex, leer archivos depende de la terminal.** Sin shell, Codex **no tiene ninguna herramienta nativa para leer archivos**, así que un "nodo sin terminal" **no es posible con las herramientas propias de Codex**. Solo se puede con herramientas de archivos provistas por el motor vía MCP (`samples/q7-tools.json`).

**Inventario real de herramientas** (el modelo ejecutó `Object.keys(tools)` en su code mode y la salida se leyó del rollout, no de lo que dijo). Con `--ignore-user-config`:

```
apply_patch, exec_command, write_stdin, view_image, web__run, image_gen__imagegen,
clock__curr_time, create_goal/get_goal/update_goal, request_plugin_install,
list_mcp_resources, list_mcp_resource_templates, read_mcp_resource,
mcp__codex_apps__* (≈80 herramientas: Figma, "sites" con deploy, variables de entorno y dominios,
  documentos, gestión de plugins…)
```

Además hay herramientas de colaboración (`spawn_agent`, `send_message`, …).

- **`--ignore-user-config` no quita los conectores de la cuenta de ChatGPT** (`mcp__codex_apps__*`): el agente de un nodo puede desplegar sitios o tocar variables de entorno de la cuenta. Tampoco quita `web__run` ni la generación de imágenes.
- Con `--disable apps --disable plugins --disable image_generation --disable multi_agent --disable goals --disable browser_use --disable computer_use -c web_search="disabled"` más `--disable shell_tool --disable unified_exec`, queda:

```
apply_patch, clock__curr_time, list_mcp_resource_templates, list_mcp_resources,
read_mcp_resource, view_image, (+ las herramientas MCP que agregue el motor)
```

**Cómo lee y edita Codex:**

| Caso | Cómo lo hizo | Resultado verificado en el filesystem |
|---|---|---|
| Default (`workspace-write`) | **Leer y escribir con PowerShell** (`Get-Content`, `Set-Content`) | `resumen.txt` = "3 lineas" |
| "usá apply_patch" | `tools.apply_patch("*** Begin Patch\n*** Add File…")`, que aparece como ítem `file_change` | creado |
| `read-only` | Leyó con PowerShell (la lectura está permitida) y no pudo escribir | no creado |
| **Sin shell** (`--disable shell_tool --disable unified_exec`) | Buscó una herramienta de lectura y no encontró ninguna. `apply_patch` sigue disponible (**escribe a ciegas, pero no lee**). | no creado: *"no hay una herramienta disponible para acceder al sistema de archivos"* |
| Sin shell y sin code mode (`--disable code_mode_host`) | El modelo intenta igual y recibe `code-mode host is disabled` | no creado |
| **Sin shell + MCP `zekofs`** (`mcp-fs.mjs`: `read_file`, `write_file` y `list_dir` confinados al worktree) | `mcp__zekofs__read_file` + `write_file` | **creado** |
| Superficie mínima + `read-only` + MCP `zekofs` | ídem | **creado**: la escritura del MCP no pasa por el sandbox de Codex |
| MCP con escape por `../outside/secreto.txt` | En la re-ejecución el modelo lo intentó (en la primera pasada se negó solo, sin intentarlo) | **denegado por el MCP**, token no filtrado |
| MCP con escape por junction de nombre neutro (`docs/` → `outside/`) | El modelo intentó `read_file docs/secreto.txt` | **denegado por el MCP** (`DENIED: … resolves to …outside…`), token no filtrado |

Prueba determinística del MCP, sin modelo (`mcpConfinement` en el sample): lectura y escritura por ruta absoluta, `..`, junction y subdirectorio de junction, **8 de 8 correctas**, sin archivos creados fuera.

**Sorpresas:**

- Las herramientas MCP en `exec` fallan con *"MCP tool call requires approval, but approval policy is never"* salvo que se configure `mcp_servers.<id>.default_tools_approval_mode="approve"`. Los valores válidos son `auto | prompt | writes | approve`. Con `required=true`, si el servidor no arranca, `exec` sale con error.
- En el caso `minimal-ro-patch`, el modelo **no intentó** `apply_patch` porque dedujo que el entorno era de solo lectura. No quedó medido si el sandbox deniega `apply_patch` dentro del workspace en `read-only`. En `workspace-write`, `apply_patch` fuera del workspace sí se rechaza (Q8).
- `view_image` sigue disponible y lee imágenes del disco: es un canal de lectura residual no confinado (no probado).

**Recomendación:**

- **Codex no puede confinar un nodo sin terminal con sus herramientas nativas.** La opción nativa más cercana (`read-only` sin shell) deja al agente sin poder leer, así que es inútil.
- Hay una ruta viable, que **garantiza Zeko y no Codex**: shell desactivada, superficie mínima, sandbox `read-only` y un servidor MCP de archivos propio de Zeko, confinado al worktree. Funcionó de punta a punta, pero hay que cerrar dos cosas antes de prometerlo: que `apply_patch` quede denegado en `read-only` y qué pasa con `view_image`.
- Para el MVP, el nodo de Codex sin terminal se marca **"no confinado (por el agente)"** (FR-020/FR-022). El MCP de Zeko queda como mejora con su propio spike corto.

## 8. Permisos y sandbox

**Modos:**

- `-s read-only | workspace-write | danger-full-access`. El default de `exec` es `read-only`.
- En Windows nativo, además `windows.sandbox = unelevated | elevated`.
  - `unelevated`: token restringido derivado del usuario, más ACLs.
  - `elevated`: usuario local dedicado `CodexSandboxOffline`, un servicio `codex-windows-sandbox-service` y reglas de firewall. Requiere un setup previo con administrador, que en esta máquina ya estaba hecho.
- **Approval:** `on-request | never`. En `exec`, **`-c approval_policy="on-request"` se ignora**: el rollout muestra `approval_policy: "never"` en todas las corridas.

**Matriz** (`samples/q8-sandbox.json`). Se verificó en el filesystem, o por la aparición de un token aleatorio en la salida real de un comando.

- *PERMITIDO*: la operación ocurrió.
- *denegado-SO*: el proceso corrió dentro del sandbox y el SO le negó el acceso ("Acceso denegado a la ruta…").
- *rechazado-codex*: Codex no lanzó el proceso o no aplicó el parche.

| Operación | ro-unelev | ww-unelev | ww-elev | full | ww **sin** `windows.sandbox` |
|---|---|---|---|---|---|
| Escribir dentro del cwd | denegado-SO | **PERMITIDO** | **PERMITIDO** | PERMITIDO | **rechazado-codex** |
| Escribir fuera (ruta absoluta) | denegado-SO | **denegado-SO** | **denegado-SO** | error 267¹ (primera pasada: el modelo escribió mal la ruta larga) | – |
| Escribir fuera con `..` | denegado-SO (primera pasada: error 267¹) | **denegado-SO** | **denegado-SO** | PERMITIDO | – |
| Escribir a través de un junction | error 267¹ (primera pasada: denegado-SO) | **denegado-SO** | **denegado-SO** | PERMITIDO | – |
| `apply_patch` fuera (ruta absoluta) | rechazado-codex | **rechazado-codex** (`patch rejected: writing outside of the project`) | rechazado-codex | PERMITIDO | rechazado-codex |
| **Script del proyecto que escribe en `../outside`** | denegado-SO | **denegado-SO** | **denegado-SO** | PERMITIDO | – |
| Leer fuera (ruta absoluta) | **PERMITIDO** | **PERMITIDO** | **PERMITIDO** | PERMITIDO | rechazado-codex |
| Leer a través de un junction | **PERMITIDO** | **PERMITIDO** | **PERMITIDO** (primera pasada: error 267¹) | PERMITIDO | – |
| Escribir en `%TEMP%` | denegado-SO | **PERMITIDO** | **PERMITIDO** | PERMITIDO | – |
| Red (`Invoke-WebRequest` al registro de npm) | denegado | **denegado** | **denegado** | PERMITIDO | – |

¹ Falla esporádica al crear el proceso (error 267), que pasa también sin sandbox. No es una decisión de política (ver Q4). En el sample figura como "rechazado-codex", porque Codex lo informa como `Rejected(…)`.

Variantes adicionales:

- `workspace-write` + `exclude_tmpdir_env_var` + `exclude_slash_tmp`: `%TEMP%` pasa a **denegado**, y escribir dentro sigue permitido.
- `workspace-write` + `sandbox_workspace_write.network_access=true`: la red **sigue denegada**, tanto en unelevated (`ww-net`) como en elevated (`ww-net-elev`). El error es "Se ha terminado la conexión". En una prueba manual, `curl` devolvió `000` y no había variables de proxy.
- `on-request`: igual que `never` (write-in permitido, write-out denegado, red denegada). Nunca se colgó: 8–14 s por corrida.

**Hallazgos:**

1. **La escritura queda confinada por el SO, incluida la shell.** Es la diferencia central con Claude.
   - Rutas absolutas, `..`, junctions y **un script del proyecto que escribe fuera**: todo denegado por el sandbox. En Claude, `--restricted` no cubría la shell (001b §B2).
   - `apply_patch` también respeta las raíces escribibles.
2. **La lectura NO está confinada.** La política efectiva de `workspace-write` (rollout, `file_system_sandbox_policy`) es `root: read`, más escritura en cwd, `%TEMP%` y `/tmp`, más `.git`, `.codex` y `.agents` del cwd en solo lectura. El token del archivo de afuera se leyó en ro, ww-unelev y ww-elev, por ruta absoluta y a través del junction.
   - La documentación de Windows dice *"Cannot read directories outside the workspace without explicit permission"*, pero **no es lo que se observó** en 0.155.1.
   - La configuración documenta `permissions.<perfil>.filesystem` con `deny`, que podría cerrarlo. **No lo probé** (tiempo).
3. **`%TEMP%` es escribible por defecto.** Un worktree bajo `%TEMP%` queda escribible por **todos** los nodos. Además, `%TEMP%` es un canal compartido entre nodos. Hay que usar `exclude_tmpdir_env_var=true` y `exclude_slash_tmp=true`.
4. **La red no se puede habilitar dentro del sandbox en Windows nativo**: `network_access=true` no tiene efecto. Los nodos que necesitan `npm install` solo funcionan con `danger-full-access`, que no tiene ningún confinamiento.
5. **Sin humano no se cuelga nunca.** En `exec`, la approval es `never` sí o sí:
   - lo que el sandbox no permite falla y se devuelve al modelo;
   - `apply_patch` fuera del proyecto se rechaza con `rejected by user approval settings`;
   - el MCP sin `approve` falla;
   - el turno termina con `turn.completed`, exit 0.
6. **Sin `windows.sandbox` configurado, la shell entera se rechaza** (Q4, trampa 1).
7. El modelo a veces se niega solo o escribe mal rutas largas (en la primera pasada inventó `spikes-001c-claude-chain`). Además, entre las dos pasadas cambiaron celdas por el error 267. Igual que en 001b, "no pasó" no es "el sistema lo bloqueó": solo cuenta la verificación en el filesystem, y cada celda se debería repetir más de una vez antes de sacar conclusiones.

**Cómo se ve en los eventos:**

- *denegado-SO*: `command_execution` con `status: failed`, `exit_code: 1` y el texto del SO en `aggregated_output`.
- *rechazado-codex*: **ningún ítem** en el stream; solo stderr (`ERROR codex_core::tools::router: … Rejected(…)`) y la salida de la herramienta en el rollout.
- `apply_patch` rechazado: tampoco genera ítem `file_change`.

**Recomendación:**

- Nodo **con** terminal: `-s workspace-write -c windows.sandbox="elevated"` (o `unelevated` si no hay setup) `-c sandbox_workspace_write.exclude_tmpdir_env_var=true -c sandbox_workspace_write.exclude_slash_tmp=true`. Con eso:
  - la escritura queda confinada al worktree, y ese confinamiento **sí** cubre la shell;
  - la lectura no queda confinada;
  - no hay red.
- Probar los perfiles `permissions.*` con `deny` antes de prometer confinamiento de lectura.
- Los nodos que necesitan red (instalar dependencias) no se pueden confinar con Codex en Windows nativo. Se marcan como "no confinado".

## 9. Cancelación

Tarea: `1..25 | % { Add-Content progreso.txt $_; Start-Sleep 1 }`, cancelada 5 s después de `item.started` con `command_execution` (`samples/q9-cancel.json`).

**Árbol de procesos real:**

```
unelevated:  codex.exe ─┬─ conhost.exe
                        ├─ codex-code-mode-host.exe
                        └─ powershell.exe                (usuario: el mismo)
elevated:    codex.exe ─┬─ conhost.exe
                        ├─ codex-code-mode-host.exe
                        └─ codex-command-runner-0.155.1.exe ── powershell.exe ── conhost.exe
                                                           (usuario: CodexSandboxOffline)
shim npm:    cmd.exe ── node.exe (codex.js) ── codex.exe ── …
app-server:  codex.exe ─┬─ … + powershell.exe (comando) + node_repl.exe / cmd→node (MCP del usuario)
```

| Método | exit / señal | ¿Evento final? | Huérfanos | `progreso.txt` (al cancelar → al salir → +6 s) |
|---|---|---|---|---|
| `child.kill()` sobre `codex.exe` (unelevated) | null / SIGTERM | no | **ninguno** | 5 → 8 → 8 |
| `taskkill /T /F` (unelevated) | 1 | no | ninguno | 4 → 9 → 9 |
| `child.kill()` (elevated) | null / SIGTERM | no | **ninguno**, incluido el `powershell` de `CodexSandboxOffline` | 4 → 7 → 7 |
| `taskkill /T /F` (elevated) | 1 | no | ninguno | 4 → 7 → 7 |
| **`kill` del shim `codex.cmd`** | null / SIGTERM | **sí, `turn.completed`** | **el agente sigue vivo y termina la tarea entera** | 4 → **25** → 25, y **`fin.txt` creado** |
| `taskkill /T /F` del shim | 1 | no | ninguno | 4 → 8 → 8 |
| Cerrar stdin | 0 | `turn.completed` | – | **no cancela nada**: 25 líneas y `fin.txt` |
| **app-server `turn/interrupt`** | – | **sí**: `turn/completed` con `status: "interrupted"` a los **384 ms** (177 ms en la primera pasada) | **el `powershell.exe` del comando siguió corriendo** | 8 → 15 a los 6 s (después lo mató el cleanup) |

Las dos pasadas dieron el mismo resultado en todos los métodos.

El conteo de "al salir" sube 3–5 líneas en todos los casos porque la foto del árbol de procesos, que se toma antes de matar, tarda 2–3 s.

**Hallazgos:**

- **Matar `codex.exe` mata todo su árbol**, con `kill` simple o con `taskkill /T`, en los dos sandboxes. No quedaron huérfanos, ni siquiera los procesos de otro usuario (`CodexSandboxOffline`), probablemente porque Codex usa un job object de Windows. Es mejor que Claude, donde `child.kill()` dejaba `pwsh` vivo.
- **Trampa del shim:** si el motor lanza `codex` (el `.cmd` de npm, con `shell: true`) y mata el proceso lanzado, solo muere `cmd.exe`. `node` y `codex.exe` siguen y **completan la tarea**. Como el pipe de stdout sigue abierto, el motor además recibe `turn.completed` y cree que terminó normal.
- **`codex exec` no tiene interrupción limpia:** no hay canal de control por stdin, y cerrar stdin no hace nada. Matar el proceso no produce ningún evento final. El motor distingue la cancelación porque sabe que la pidió.
- **El app-server (experimental) sí tiene `turn/interrupt`**, con JSON-RPC por stdio: `initialize` → `thread/start {model, cwd, sandbox, approvalPolicy}` → `turn/start` → `turn/interrupt {threadId, turnId}`. Responde rápido y emite `turn/completed` con `status: "interrupted"`, **pero no mata el comando en curso**. Además, lanzado sin flags, el app-server carga la configuración del usuario (se ven `node_repl.exe` y los MCP del usuario).
- Si el proceso se mata, el worktree queda en el estado parcial del comando (7–8 líneas). `fin.txt` nunca se crea.
- Nota de método: el filtro por nombre de proceso y fecha de creación que usaba 001 **mató el propio runner** en este entorno, porque matcheaba `cmd → node npx → node tsx` y terminales de Orca. La versión final solo toma los descendientes del PID lanzado, más los hijos del servicio del sandbox, y verifica PID + hora de creación.

**Recomendación:**

- **Lanzar siempre `codex.exe` directo, nunca el shim.**
- Cancelar = `taskkill /PID <codex.exe> /T /F` en Windows (en Unix: grupo de procesos). Se completa en menos de 1 s, así que cumple NFR-004.
- No hay evento final: el motor registra "cancelado" por su cuenta.
- Si más adelante se usa el app-server por sus ventajas (interrupt, rate limits, aprobaciones), `turn/interrupt` tiene que ir seguido de matar el árbol de los comandos.

## 10. Aislamiento

**Worktree fuera del repo** (`samples/q10-isolation.json`). `git worktree add` en `%TEMP%\zeko-001c-wt-…\node-a`, con `workspace-write` y la tarea "agregá una línea a README.md y hacé commit":

- Worktree: `M README.md`, con la línea agregada.
- Repo principal: `git status` idéntico antes y después, y `README.md` intacto.
- **El commit falló:** `fatal: Unable to create 'C:/Users/Tiago/proyectos/Zeko-Agentic-IDE/.git/worktrees/node-a/index.lock': Permission denied`. El `.git` de un worktree es un archivo que apunta al `.git` del repo principal, que queda **fuera de las raíces escribibles**, y el `.git` local está en solo lectura. **El agente no puede hacer commit, ni `git add`, en un worktree.** Para Zeko es bueno (FR-047: el motor controla las ramas), pero los prompts no deben pedir commits.

**Herencia de instrucciones de directorios superiores.** Estructura: `parent/AGENTS.md` (PELICANO) → `parent/repo/` (git, `AGENTS.md` CANGURO, `.codex/config.toml` con `developer_instructions` GIRAFA) → `repo/sub/` (`AGENTS.md` TORTUGA), con cwd en `sub`.

| Caso | Cargados (según `world_state.agents_md` del rollout) | Respuesta |
|---|---|---|
| `--ignore-user-config` | RAIZ + SUB, concatenados | "hola. CANGURO TORTUGA" |
| `-c project_doc_max_bytes=0` | ninguno | "hola" |
| Con configuración del usuario | RAIZ + SUB | "hola CANGURO TORTUGA" (+3 hooks) |

- `AGENTS.md` se carga **desde la raíz git hasta el cwd**. **No** se carga lo que está por encima de la raíz git (PELICANO). Un worktree fuera del repo no hereda nada del repo del usuario, salvo el `AGENTS.md` versionado dentro del propio worktree.
- `.codex/config.toml` del proyecto **no se cargó** (GIRAFA ausente), ni con ni sin configuración del usuario. El directorio no es *trusted*. Ojo: el usuario tiene `c:\users\tiago` como *trusted* en su config global, así que con su configuración un proyecto bajo su home podría cargarlo. No lo probé.
- `project_doc_max_bytes=0` apaga los `AGENTS.md`. Sirve si Zeko quiere que el nodo solo vea sus propias instrucciones.

**Configuración global del usuario:**

| | Con config del usuario | `--ignore-user-config` | `CODEX_HOME` propio (solo `auth.json` copiado) |
|---|---|---|---|
| Modelo/effort del usuario | se ignoran si se pasan `-m`/`-c` | ignorados | – |
| Hooks del usuario | **3 ejecuciones** | 0 | 0 |
| MCP del usuario (`node_repl`, `chrome-devtools` por npx) | **arrancan** | no | no |
| Skills (`~/.agents/skills` y del sistema) | inyectadas | **inyectadas igual** | inyectadas (las del sistema) |
| Plugins recomendados y conectores de la cuenta (`codex_apps`) | sí | **sí** | sí (descarga su caché: Figma, etc.) |
| Tokens de entrada de "ok" | 14,5k | 14,0k | 14,0k |

El `CODEX_HOME` propio funciona: la sesión y el rollout quedan en ese home y `auth.json` no cambió en esa corrida. **Riesgo:** con ChatGPT, si Codex refresca el token en la copia, el refresh token del home original podría quedar invalidado. Orca hace exactamente esto: copia `auth.json` a su propio home. Por las dudas, se probó una sola vez y se borró.

**Recomendación:**

- Worktrees fuera del repo **y fuera de `%TEMP%`** (Q8), por ejemplo `%LOCALAPPDATA%\Zeko\worktrees\<run>\<node>`. Aislamiento de configuración con `--ignore-user-config --ignore-rules` más los `--disable` de Q7.
- Un `CODEX_HOME` propio aísla más (sesiones de Zeko separadas de las del usuario), pero mueve el problema del refresh token a Zeko. Para el MVP conviene usar el `CODEX_HOME` del usuario y limpiar el entorno heredado (`CODEX_HOME` incluido, si viene de otra app como Orca).
- Zeko hace los commits del nodo desde fuera del sandbox.

## 11. Costo y uso

(`samples/q11-usage.json`)

- **En el stream:** solo `turn.completed.usage` (tokens de entrada, cacheados, de escritura en caché, de salida y de razonamiento). **Ni costo, ni rate limits, ni duración.**
- **En el rollout**, en cada `token_count`:

  ```json
  "rate_limits": { "limit_id": "codex",
    "primary":   { "used_percent": 2,  "window_minutes": 300,   "resets_at": 1790311228 },
    "secondary": { "used_percent": 27, "window_minutes": 10080, "resets_at": 1790624161 },
    "credits": { "has_credits": false, "unlimited": false, "balance": null },
    "plan_type": "team", "rate_limit_reached_type": null, "spend_control_reached": null }
  ```

  Es el **equivalente al `rate_limit_event` de Claude**: ventana de 5 h y ventana semanal con porcentaje de uso y hora de reset. También trae `total_token_usage` y `task_complete{duration_ms, time_to_first_token_ms}`.
- **En el app-server:** `account/rateLimits/read` devuelve lo mismo (`usedPercent`, `windowDurationMins`, `resetsAt`, `planType`, `rateLimitReachedType`), **sin gastar un turno**. Es la mejor forma de consultar el uso antes de lanzar un nodo (FR-053).
- **También en el app-server:** `account/read` devuelve `{type: "chatgpt", email, planType}`. Sirve para mostrar con qué cuenta se autenticó Codex (FR-065). El email es un dato personal: el harness lo redacta en los samples, y Zeko no debería guardarlo en eventos ni en el historial (NFR-007).
- **Costo en dinero:** no existe en ninguna fuente con ChatGPT. Con clave de API no está verificado (Q2).

**Recomendación:**

- Costo de nodos de Codex = "no disponible" (FR-051); el total del run queda "parcial".
- Consumo = tokens del stream.
- Uso de la suscripción: leer `rate_limits` del último `token_count` del rollout al terminar cada nodo, y consultar `account/rateLimits/read` antes de lanzar para aplicar el umbral de FR-053.

## 12. Concurrencia

(`samples/q12-concurrency.json`)

- **8 `exec` en paralelo**, cada uno en su repo y con el mismo `CODEX_HOME`: 8/8 exit 0, los 8 archivos correctos y 8 `thread_id` distintos, todos con su rollout. Sin errores de SQLite ni de locks en stderr, en las dos pasadas.
- **La latencia varía mucho entre pasadas:**
  - re-ejecución: 52,9 s de pared total, 37–52 s cada uno;
  - primera pasada: 13,2 s total, 10–13 s cada uno.

  Los timeouts de nodo tienen que dejar margen amplio.
- En Q6 y Q8 corrieron más de 100 procesos con pool de 6 sin conflictos. La única anomalía es el error esporádico 267 al crear procesos (3 por pasada, ver Q4).
- **Dos `resume` del mismo thread a la vez:** el segundo falla en menos de 1 s con `thread-store conflict: … already has an active writer`, exit 1. Hay un lock por thread en `$CODEX_HOME/thread-writer-locks`. Esto refuerza la recomendación de hacer fork y no resume, y de no compartir sesiones entre nodos.

**Recomendación:** Codex tolera el paralelismo de FR-027. El motor tiene que:

- manejar el conflicto de writer como un error reintentable;
- reintentar una vez los fallos 267 de creación de procesos, detectados en stderr o en el rollout.

---

## Tabla comparativa: Claude Code vs Codex

| Garantía | Claude Code (2.1.280) | Codex (0.155.1) |
|---|---|---|
| **Confinamiento sin terminal** | ✅ `--restricted` + `--add-dir`: Read, Write, Edit, Glob y Grep confinados, incluidos `..` y symlinks/junctions (001b §B1). | ❌ **No nativo.** Sin shell no puede leer; solo le queda `apply_patch`. ⚠️ Posible con un MCP de archivos propio de Zeko + shell desactivada + `read-only` + superficie mínima: probado y funciona, pero el confinamiento lo garantiza Zeko. Quedan abiertos `view_image` y `apply_patch` en `read-only`. |
| **Confinamiento con terminal** | ❌ La shell escapa: un script del proyecto escribe y lee fuera, incluso con `--restricted` (001b §B2). | ⚠️ **Escritura confinada por el SO**, incluida la shell (absoluta, `..`, junction, script del proyecto, `apply_patch`). **Lectura no confinada** (todo el disco). `%TEMP%` escribible salvo `exclude_*`. Red siempre bloqueada; en Windows no se puede habilitar sin `danger-full-access`. |
| **Salida estructurada nativa** | ⚠️ `--json-schema` (herramienta `StructuredOutput`): puede terminar en `success` **sin** salida; valida y reintenta. | ✅/⚠️ `--output-schema` (decodificación restringida): si hay `turn.completed`, el último mensaje **siempre** cumple el schema. Exige schema strict (si no, `turn.failed`). Las restricciones de longitud y cardinalidad producen basura válida sin error. |
| **Reanudación con fork** | ✅ `--resume --fork-session`. System prompt congelado (salvo `--system-prompt-snapshot off`); cambiar herramientas al reanudar lo rompe. | ✅ `exec fork <id>`: original intacto, `forked_from_id`. Permite cambiar sandbox y herramientas. `developer_instructions` nuevas **ignoradas**, sin opción para cambiarlas. |
| **Cancelación limpia** | ✅ `control_request interrupt` por stdin → `result` `error_during_execution` en unos 100 ms. `child.kill()` deja huérfanos. | ⚠️ `exec` **no tiene interrupt**. Matar `codex.exe` (kill o `taskkill /T`) **no deja huérfanos** (job object), en menos de 1 s, **sin evento final**. El shim de npm no cancela. El app-server `turn/interrupt` da evento, pero deja vivo el comando. |
| **Costo en dinero** | ✅ `total_cost_usd` y `modelUsage[].costUSD` (con suscripción: costo equivalente). | ❌ No informado (ChatGPT). Con clave de API no verificado. Solo tokens. |
| **Uso de la suscripción** | ✅ `rate_limit_event` en el stream (ventana de 5 h: utilización y reset). | ⚠️ No en el stream. Sí en el rollout (`token_count.rate_limits`: 5 h + semanal, `used_percent`, `resets_at`, `plan_type`) y en el app-server (`account/rateLimits/read`, sin gastar turno). |
| **Funcionamiento nativo en Windows** | ✅ Binario nativo; herramienta `PowerShell` (no `Bash`). | ⚠️ Nativo, pero **requiere fijar `windows.sandbox`** (si no, rechaza toda la shell en silencio). `elevated` requiere setup con administrador (servicio + usuario `CodexSandboxOffline`). Error esporádico 267 al crear procesos. Shell = Windows PowerShell 5.1. Nada requirió WSL. |

Otras diferencias que afectan al motor:

| | Claude Code | Codex |
|---|---|---|
| Evento de acción denegada | ✅ `system/permission_denied` + `permission_denials[]` | ❌ Ninguno. Hay que inferirlo de `failed` + texto del SO, stderr y rollout. |
| Límite de turnos / presupuesto | `--max-turns`, `--max-budget-usd` | ❌ Ninguno (solo el timeout del motor). |
| Allowlist de comandos | `--allowedTools "PowerShell(git init)"` | No probado. Existen reglas execpolicy (`.rules`) y aprobaciones granulares; en `exec`, approval es siempre `never`. |
| Metadatos en el init | modelo, herramientas, cwd, modo de permisos | solo `thread_id`; el resto está en el rollout |
| Salida en vivo | deltas de texto opcionales | ítems completos (sin deltas) |
| Configuración heredada | `CLAUDE.md` y `.claude/` subiendo directorios | `AGENTS.md` desde la raíz git hasta el cwd; skills y conectores de la cuenta aunque se ignore la configuración |
| Commit desde el agente en un worktree | posible | imposible en `workspace-write` (el gitdir queda fuera) |

---

## Propuesta de interfaz común de adaptador

Tres capas separadas, como pidió 001b: **cómo terminó el proceso**, **qué declara el agente** y **qué observó el motor**. `NodeResult` lo decide el motor con las reglas de FR-036, **nunca** el adaptador.

```ts
// ---------- Capacidades: las declara el adaptador; la UI y el validador las usan (FR-021, NFR-012)
interface AgentCapabilities {
  agent: "claude-code" | "codex";
  confinement: {
    noTerminal: "enforced" | "enforced-by-zeko-mcp" | "none"; // Claude: enforced | Codex: none (o enforced-by-zeko-mcp)
    withTerminal: { write: boolean; read: boolean; network: "blocked" | "allowed" | "configurable" };
    // Claude: {write:false, read:false, network:"allowed"}
    // Codex (sandbox): {write:true, read:false, network:"blocked"}
  };
  structuredOutput: "native-constrained" | "native-tool" | "none"; // codex | claude
  reportsMoneyCost: boolean;        // claude true, codex false
  reportsSubscriptionUsage: "stream" | "post-run" | "none"; // claude stream, codex post-run (rollout/app-server)
  reportsDenials: "typed" | "heuristic";                    // claude typed, codex heuristic
  cleanInterrupt: boolean;          // claude true (stdin), codex false (exec)
  supportsFork: boolean;            // ambos true
  forkCanChangeInstructions: boolean; // claude solo con snapshot off, codex false
  forkCanChangeTools: boolean;        // claude false, codex true
  maxTurns: boolean;                  // claude true, codex false
}

// ---------- Entrada
interface NodeRunSpec {
  runId: string; nodeId: string;
  cwd: string;                      // worktree del nodo (fuera del repo y fuera de %TEMP%)
  prompt: string;                   // instrucciones + criterios + definición de DONE/BLOCKED/FAILED
  instructions?: string;            // persona: Claude --append-system-prompt / Codex developer_instructions (solo en threads nuevos)
  model: string; effort?: string;
  terminal: false | { allowedCommands?: string[] }; // FR-017/018
  extraWritableDirs?: string[];     // Claude --add-dir / Codex writable_roots
  reportSchema: object;             // schema strict de Zeko (FR-034)
  limits: { timeoutMs: number; maxTurns?: number }; // maxTurns se ignora si !caps.maxTurns
  resumeFrom?: { sessionId: string; fork: true }; // siempre fork
  auth?: { mode: "subscription" } | { mode: "api-key"; key: string }; // se inyecta por proceso
}

interface AgentAdapter {
  capabilities(): AgentCapabilities;
  checkInstalled(): Promise<{ installed: boolean; version?: string; detail?: string }>;
  checkAuth(): Promise<{ authenticated: boolean; mode?: "subscription" | "api-key"; detail?: string }>;
  readSubscriptionUsage?(): Promise<SubscriptionUsage | undefined>; // Codex: app-server account/rateLimits/read
  start(spec: NodeRunSpec): RunHandle;
}

interface RunHandle {
  events: AsyncIterable<NormalizedEvent>;
  cancel(): Promise<void>;          // Claude: interrupt + kill árbol | Codex: kill árbol de codex.exe
  done: Promise<RunOutcome>;
}

// ---------- Eventos normalizados (FR-029, FR-063)
type NormalizedEvent =
  | { type: "started"; sessionId: string; model?: string; tools?: string[]; cwd?: string } // Codex: model/tools faltan
  | { type: "text"; text: string; final: boolean; partial?: boolean }                     // Codex: nunca partial
  | { type: "tool_call"; id: string; kind: "shell" | "file_edit" | "file_read" | "mcp" | "web" | "other"; name: string; input: unknown }
  | { type: "tool_result"; id: string; ok: boolean; output?: string; exitCode?: number; files?: { path: string; kind: string }[] }
  | { type: "denied"; source: "agent-policy" | "os-sandbox" | "approval" | "inferred"; tool?: string; target?: string; message: string }
  | { type: "usage"; tokens?: TokenUsage; subscription?: SubscriptionUsage }             // Claude: durante el run; Codex: al final
  | { type: "warning"; message: string }                                                  // item.error de Codex, reintentos
  | { type: "raw"; payload: unknown };

// ---------- 1) Cómo terminó el proceso
interface ProcessOutcome {
  kind: "completed" | "failed" | "cancelled" | "timeout" | "crashed";
  exitCode: number | null; signal: string | null;
  gotFinalEvent: boolean;           // Claude: result | Codex: turn.completed/turn.failed
  errorMessage?: string;            // Claude result.errors / Codex turn.failed.error.message / stderr
  terminalReason?: string;          // Claude terminal_reason (Codex: falta)
  infraErrors: string[];            // Codex: "Rejected(", "failed: 267", sandbox no disponible; Claude: [claude-code:*]
}

// ---------- 2) Lo que declara el agente (FR-033)
interface AgentReport {             // mismo schema para ambos (FR-035)
  status: "DONE" | "BLOCKED" | "FAILED";
  summary: string; filesChanged: string[]; checks: string[]; blockers: string[];
}
interface ReportEnvelope {
  report?: AgentReport;             // falta si el proceso falló o, en Claude, si no llamó a StructuredOutput
  source: "native-schema" | "lenient-parse";
  validationErrors?: string[];      // zod
}

// ---------- 3) Lo que el motor necesita además para decidir NodeResult (FR-036/037)
interface RunOutcome {
  sessionId?: string;               // Claude result.session_id | Codex thread_id
  process: ProcessOutcome;
  report: ReportEnvelope;
  denials: NormalizedEvent & { type: "denied" }[];
  denialsReliability: "typed" | "heuristic"; // Codex: heuristic
  usage: {
    tokens?: TokenUsage;
    costUsd?: number;               // Codex: siempre falta
    costIsEstimate?: boolean;
    subscription?: SubscriptionUsage; // Claude: rate_limit_event | Codex: rollout (post-run)
    durationMs?: number; turns?: number; // Codex: duration del rollout, turns falta
  };
  confinement: { level: "confined" | "write-confined" | "not-confined"; reason: string }; // se muestra en el nodo
}

interface TokenUsage { input: number; cachedInput?: number; cacheWrite?: number; output: number; reasoning?: number }
interface SubscriptionUsage { windows: { name: string; usedPercent: number; windowMinutes?: number; resetsAt?: number }[]; plan?: string }

// El motor (no el adaptador) calcula NodeResult con FR-036, usando:
//   process.kind, report, denials (+ denialsReliability), y los archivos observados en el worktree (git status).
```

**Campos que pueden faltar según el agente:**

| Campo | Claude | Codex |
|---|---|---|
| `started.model`, `started.tools` | ✓ | falta (se puede completar desde el rollout al terminar) |
| `text.partial` | ✓ (opcional) | nunca |
| `denied` tipado | ✓ | solo inferido |
| `usage.costUsd` | ✓ | **siempre falta** |
| `usage.subscription` durante el run | ✓ | falta; solo post-run (rollout) o consultando el app-server |
| `usage.turns` | ✓ | falta |
| `process.terminalReason` | ✓ | falta |
| `report` con `turn.completed` / `result` ok | puede faltar | siempre presente |
| Evento final después de cancelar | ✓ (interrupt) | nunca |

---

## Impacto en la spec 001

**¿Qué formas de autenticación de Codex conviene soportar? (FR-065)**

- **Cuenta de ChatGPT: sí**, como principal. Está probada de punta a punta, informa uso de la suscripción (5 h + semanal) y se detecta sin ejecutar tareas (`codex login status` exit 0/1, `doctor --json`).
- **Clave de API: soportarla como opción, marcada "sin verificar"** hasta probarla con una clave real. El mecanismo está claro: `CODEX_API_KEY` por proceso, que tiene prioridad sobre el login. Pero no se verificó si informa costo (probablemente no) ni qué pasa con las ventanas de uso.
- Requisito derivado: Zeko **siempre** limpia `CODEX_API_KEY` y `OPENAI_API_KEY` del entorno heredado. Si no, `login status` dice ChatGPT y `exec` usa una clave. También limpia `CODEX_HOME` si viene de otra app.

**¿Codex puede confinar un nodo sin terminal? (FR-019)**

- **No con sus herramientas nativas.** Sin shell no puede leer, así que el nodo es inútil. Con shell, la lectura no está confinada.
- Según la clarificación de la spec, el nodo **se permite con advertencia "no confinado (por el agente)"** (FR-020/FR-022).
- Hay una ruta para confinarlo que dependería de Zeko (MCP de archivos propio + shell desactivada + `read-only` + superficie mínima). Funcionó en este spike, pero requiere un spike corto que cierre `apply_patch` en `read-only` y `view_image` antes de declararlo "confinado".

**Requisitos que Codex no puede cumplir tal como están escritos:**

| Requisito | Problema con Codex | Sugerencia |
|---|---|---|
| **FR-017 / FR-019 / NFR-009** (sin terminal = solo archivos del alcance) | No existe un modo "solo archivos" nativo; sin shell no puede leer. | Aceptar "no confinado por el agente" para Codex, o implementar el MCP de Zeko. |
| **FR-020** (con terminal = no confinado) | Es cierto, pero pierde información: Codex con terminal **sí** confina la escritura (incluida la shell), cosa que Claude no hace. | Pasar a niveles: `confinado` / `escritura confinada` / `no confinado`. |
| **FR-018** (lista de comandos permitidos) | `exec` no tiene allowlist por comando. La approval es siempre `never`. Las reglas execpolicy no se probaron. | Marcar FR-018 como no soportado para Codex hasta un spike de execpolicy. |
| **FR-023 / FR-036 regla 4** (toda acción denegada registrada; denegación ⇒ bloqueado) | No hay evento de denegación. Hay tres formas de rechazo; una es invisible en el stream (solo stderr/rollout). | Detección heurística (texto del SO + stderr + rollout), mostrada como "denegación inferida". Aceptar que puede haber falsos negativos. |
| **FR-032 / NFR-008** (límites de turnos) | No hay límite de turnos ni de tokens (`rollout_budget` no funciona). | Para Codex, solo tiempo (lo mata el motor). El límite de turnos queda "no soportado por el agente" o se aproxima contando ítems y matando el proceso. |
| **FR-050 / FR-051** (costo por nodo) | No hay costo en dinero. | "No disponible" y total "parcial" (ya previsto). Mostrar tokens. |
| **FR-052 / FR-053** (uso de la suscripción, no lanzar cerca del límite) | No está en el stream de `exec`. | Leer `rate_limits` del rollout después de cada nodo y/o `account/rateLimits/read` del app-server antes de lanzar. Las dos cosas son posibles, pero dependen de un formato de archivo interno o de una API experimental. |
| **FR-029** (salida en vivo) | Hay ítems en vivo, pero el texto llega completo, sin deltas. | Aceptable. Solo es menos fluido. |
| **FR-030 / NFR-004** (cancelar sin procesos residuales, < 10 s) | Se cumple **solo** si se lanza `codex.exe` directo y se mata el árbol. Con el shim de npm no se cancela nada. | Requisito de implementación: resolver el binario nativo. |
| **Nodos que necesitan red** (por ejemplo `npm install`) con terminal habilitada | En Windows nativo la red dentro del sandbox no se puede habilitar (`network_access=true` sin efecto). | Esos nodos solo corren con `danger-full-access`, que es "no confinado". Documentarlo en la UI. |
| **FR-064 / NFR-001** (Windows y Linux) | En Windows funciona nativo, con las salvedades de arriba (`windows.sandbox` obligatorio, setup elevado, errores 267). **Linux no se probó.** | Repetir Q7–Q9 en Linux antes de congelar las garantías. |
| **FR-043** (worktree con rama propia) | Se cumple, pero el agente **no puede hacer commit** en un worktree bajo `workspace-write`. | Zeko hace los commits y los prompts no los piden. Worktrees fuera de `%TEMP%`. |

---

## Resumen de decisiones para el motor (Codex)

1. **Lanzamiento:** `codex.exe` (nunca el shim) `exec --json --ignore-user-config --ignore-rules -m X -c model_reasoning_effort=… -c windows.sandbox=… -s <modo> --output-schema <schema strict> -`, con el prompt por stdin y stdin cerrado. Entorno sin `CODEX_API_KEY`, `OPENAI_API_KEY` ni `CODEX_HOME` heredados.
2. **Superficie de herramientas:** `--disable apps --disable plugins --disable image_generation --disable multi_agent --disable goals --disable browser_use --disable computer_use -c web_search="disabled"`. En nodos sin terminal, además `--disable shell_tool --disable unified_exec`.
3. **Éxito del proceso:** exit 0 + `turn.completed`, **y** ningún `Rejected(` / `blocked by policy` / error 267 en stderr ni en el rollout.
4. **Reporte:** el último `agent_message` parseado con zod. Si falta o es inválido: `exec fork <id>` con el mismo `--output-schema`, una sola vez.
5. **Denegaciones:** heurísticas, marcadas como tales.
6. **Uso:** tokens del stream; `rate_limits` del rollout; costo "no disponible".
7. **Cancelar:** `taskkill /T /F` del `codex.exe`. El motor registra "cancelado" por su cuenta.
8. **Aislamiento:** worktree fuera del repo y de `%TEMP%`, con `exclude_tmpdir_env_var`/`exclude_slash_tmp`. Zeko hace los commits.
9. **Encadenamiento:** inyectar artefactos entre agentes; `exec fork` (con la persona en el prompt) para reintentar el mismo agente.
10. **Confinamiento que se muestra en la UI:** Codex sin terminal → "no confinado (por el agente)"; Codex con terminal → "escritura confinada, lectura y red no" (sin red); Codex con `danger-full-access` → "no confinado".

**Pendientes para otro spike:**

- clave de API real (costo y ventanas);
- perfiles `permissions.*` con `deny` para confinar la lectura;
- `apply_patch` en `read-only` y `view_image` para la ruta MCP;
- reglas execpolicy para FR-018;
- Linux;
- app-server como transporte alternativo (interrupt, rate limits, aprobaciones).
