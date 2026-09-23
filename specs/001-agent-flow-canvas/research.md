# Research: Canvas de flujos de agentes CLI (001)

**Fecha**: 2026-09-23 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Este documento justifica cada decisión técnica del plan. Para cada una indica la evidencia y los
requisitos que cubre. Usa estas etiquetas de evidencia:

| Etiqueta | Significado |
|---|---|
| `[001 §N]` | Verificado en `spikes/001-claude-chain/FINDINGS.md`, sección N (Windows 10, Claude Code 2.1.280). |
| `[001b §X]` | Verificado en `spikes/001b-claude-edges/FINDINGS.md`, sección X. |
| `[sample: ruta]` | Evidencia cruda en `spikes/*/samples/`. |
| `[spec-clar]` | Aclaración registrada en `spec.md` (sesión 2026-09-23, revisión tras el spike de Codex). |
| `[001c-resumen]` | Decisión de diseño 5 del pedido de planificación, que resume el spike 001c. **El archivo `spikes/001c-*/FINDINGS.md` no está en el repositorio ni en ninguna rama** (verificado el 2026-09-23 con `git log --all`). El comportamiento se toma como decidido, pero ningún flag, ruta, variable ni patrón concreto de Codex se puede citar. Esos datos quedan como `[PENDIENTE-001c]`. |
| `[NO VERIFICADO]` | Supuesto que ningún spike verificó. Está listado en la §U con cómo verificarlo. |
| `[git]` | Comportamiento documentado y estándar de la CLI de git. No es comportamiento de un agente. |

> **Bloqueante para `/speckit-tasks`**: hay que incorporar al repositorio
> `spikes/001c-codex/FINDINGS.md` y sus `samples/`, o el nombre real que tenga ese spike. Sin ellos,
> el adaptador de Codex no se puede especificar a nivel de flags ni probar contra eventos reales,
> como exige el Principio XVI. Ver §P.

---

## Índice de decisiones

| ID | Decisión | Cubre |
|---|---|---|
| R-01 | El motor corre en un `utilityProcess` de Electron, detrás de un paquete `runtime` compartido con la CLI | FR-059, NFR-002, NFR-003, NFR-005, SC-008 |
| R-02 | Estructura del monorepo, con `runtime` e `i18n` agregados | FR-016, FR-059, NFR-013 |
| R-03 | SQLite con `node:sqlite` detrás de un driver mínimo; `better-sqlite3` como alternativa | FR-060–063, NFR-005 |
| R-04 | Archivo de flujo en YAML | FR-054–058, SC-007 |
| R-05 | Resultado en tres capas y función pura `resolveNodeResult` | FR-033–039, FR-016, SC-005 |
| R-06 | Schema de `AgentReport` | FR-033–035 |
| R-07 | `filesChanged` observado desde git | FR-037, FR-046 |
| R-08 | Invocación de Claude Code | FR-011, FR-017, FR-029 |
| R-09 | Detección de éxito en Claude Code | FR-036 |
| R-10 | Permisos y confinamiento en Claude Code | FR-017–023, NFR-009, SC-006 |
| R-11 | Límites de turnos, tiempo y presupuesto | FR-032, NFR-008 |
| R-12 | Cancelación de Claude Code en dos fases | FR-030, NFR-004, SC-003 |
| R-13 | Adaptador de Codex | FR-017–023, FR-030, FR-050–053, FR-065, FR-066 |
| R-14 | Seguimiento y terminación del árbol de procesos | FR-030, FR-062, NFR-004 |
| R-15 | Copias aisladas: worktrees, commits del motor, bases, CRLF/LF | FR-041, FR-043–049, SC-004 |
| R-16 | Paso de resultados entre nodos: inyectar, y reanudar solo para pedir el reporte | FR-038, FR-040–042 |
| R-17 | Costo, consumo, uso de la suscripción y retención del scheduler | FR-050–053, SC-009 |
| R-18 | Reintentos del nodo y reintentos de infraestructura | FR-032, FR-036 |
| R-19 | Verificación previa: instalación y autenticación | FR-025, FR-065 |
| R-20 | Recuperación tras cierre y estado "interrumpido" | FR-049, FR-061, FR-062, NFR-005 |
| R-21 | Límite de concurrencia global por proyecto, entre procesos | FR-027 |
| R-22 | Linaje de código y regla de un solo predecesor que modifica código | FR-008, FR-041 |
| R-23 | Salida de agentes como datos, nunca como instrucciones | FR-042, NFR-007 |
| R-24 | Textos visibles desde un catálogo único | NFR-013 |
| R-25 | IPC y performance de la UI | NFR-002, NFR-003, FR-028, FR-029 |
| R-26 | Estrategia de tests con agentes simulados | Principio XVI, SC-003, SC-005, SC-006 |

---

## R-01 · Dónde corre el motor en la app de escritorio

**Decisión**: el motor, que es el paquete `packages/runtime` montado sobre `packages/core`, corre
en un **`utilityProcess` de Electron** (el proceso "engine host"). El proceso principal solo
gestiona ventanas, diálogos nativos y el ciclo de vida del engine host. También crea un
`MessageChannelMain` y entrega un extremo al renderer y el otro al engine host, así que la UI y el
motor hablan **directo**, sin pasar por el main. La CLI (`apps/cli`) importa **el mismo
`packages/runtime`** y lo ejecuta en su proceso Node.

**Justificación**:

- La ejecución de un run tiene trabajo síncrono y pesado: escrituras SQLite síncronas (R-03), parseo
  de JSONL de hasta 8 agentes en paralelo y comandos git. En el proceso principal ese trabajo
  bloquearía el event loop que atiende las ventanas (NFR-002, < 200 ms).
- `utilityProcess` es un entorno Node completo: tiene `child_process` y módulos nativos, y es lo que
  necesita el supervisor de procesos (R-14).
- Aislamiento de fallos: si el motor se cae, el main sigue vivo, muestra el error y puede relanzar el
  host. Al relanzarlo corre la recuperación (R-20).
- Un único punto de entrada (`createZekoRuntime`) para escritorio y CLI garantiza el mismo motor
  (FR-059, SC-008, Principio IV). La diferencia entre los dos queda en el adaptador de
  entrada/salida: MessagePort en escritorio, TTY y `stdout` en la CLI.

**Alternativas descartadas**:

- **Proceso principal**: bloquea la UI y un fallo del motor tira la aplicación.
- **`worker_threads` dentro del main**: comparte el proceso, así que un crash de un módulo nativo
  mata la app. Además, spawnear procesos desde un worker no aporta nada frente a `utilityProcess`.
- **Proceso Node externo (`child_process.fork` con un `node` del sistema)**: obliga a distribuir o
  exigir un runtime Node aparte. `utilityProcess` usa el Node embebido en Electron.
- **Motor dentro del renderer**: viola el Principio IV y el sandbox del renderer.

**Consecuencia**: el engine host usa el ABI de Electron y la CLI el de Node LTS. Cualquier módulo
nativo necesita dos builds, y ese es el motivo principal de R-03.

## R-02 · Estructura del monorepo

**Decisión**: la estructura del pedido, con dos paquetes más: `packages/runtime` y `packages/i18n`.
El supervisor de procesos va dentro de `packages/adapters` como módulo compartido (ver
[plan.md](./plan.md#project-structure)).

- `packages/runtime`: raíz de composición. Conecta `core` con los adaptadores, `git` y `storage`, y
  expone la API del motor. Sin este paquete, escritorio y CLI tendrían que armar el motor cada uno
  por su lado, con el riesgo de que difieran (SC-008). `core` no depende de ningún paquete de
  infraestructura: los usa a través de puertos (interfaces definidas en `contracts`).
- `packages/i18n`: catálogo único de textos en inglés, usado por el renderer y por la CLI
  (NFR-013). El motor emite **códigos** de motivo y de estado con parámetros, nunca texto.
- El supervisor de procesos (R-14) lo usan los dos adaptadores. No va en `core` porque es código de
  sistema operativo, y no justifica un paquete propio.

**Alternativas**: poner el catálogo en `contracts` mezcla textos de presentación con schemas. Poner
la composición en `core` lo acopla a la infraestructura, en contra del Principio IV y del stack de
la constitución.

## R-03 · Librería SQLite y empaquetado con Electron

**Decisión**:

- `node:sqlite` (`DatabaseSync`), el módulo integrado de Node, detrás de una interfaz mínima
  `SqlDriver` en `packages/storage` (`exec`, `prepare`, `transaction`).
- Modo WAL, `synchronous=FULL` y `busy_timeout`.
- Una base por usuario en `%LOCALAPPDATA%\Zeko\zeko.db`, o `$XDG_STATE_HOME/zeko/zeko.db` en Linux.
- **Alternativa ya diseñada**: `better-sqlite3` detrás de la misma interfaz.

**Evaluación**:

| Opción | Módulo nativo | Escritorio (utilityProcess) | CLI (Node LTS) | Durabilidad | Veredicto |
|---|---|---|---|---|---|
| `node:sqlite` | No | Depende de la versión de Node embebida en Electron `[NO VERIFICADO]` | Sí en Node 24 LTS, sin flag | WAL y API síncrona | **Elegida**, condicionada a la verificación U-01 |
| `better-sqlite3` | Sí | Requiere `electron-rebuild` o prebuild para el ABI de Electron, y `asarUnpack` del `.node` | Requiere otro binario para el ABI de Node | WAL y API síncrona | Alternativa: madura, pero duplica builds y complica el instalador de Windows |
| `sql.js` (WASM) | No | Sí | Sí | Base en memoria que se exporta: pierde eventos en un crash | Descartada por NFR-005 |
| `libsql` / otros | Sí | Mismos problemas que better-sqlite3 | | | Descartada: no mejora nada |

**Impacto en el empaquetado**: con `node:sqlite` no hay binarios nativos, ni rebuild, ni
`asarUnpack`, y el mismo artefacto sirve para escritorio y CLI. Si U-01 falla,
`better-sqlite3` necesita: prebuild por ABI en CI (Windows x64 y Linux x64), `asarUnpack` en la
configuración de electron-builder, y un test de humo que abra la base desde el engine host
empaquetado.

**Por qué una sola base por usuario y no una por repositorio**: la CLI y el escritorio registran
runs en el mismo historial (FR-060), y el límite de concurrencia se coordina entre procesos (R-21).
Además, así nada de estado de ejecución se escribe dentro del repositorio del usuario (FR-045,
Principio V).

**Cubre**: FR-060, FR-061, FR-062, FR-063, NFR-005.

## R-04 · Formato del archivo de flujo: YAML

**Decisión**:

- **YAML 1.2**, con la librería `yaml` (eemeli), en `.zeko/flows/<flowId>.flow.yaml`.
- La configuración del proyecto va en `.zeko/config.yaml`.
- Los schemas son zod y los tipos se infieren de ellos.
- El JSON Schema publicado se genera desde zod.

**Justificación**:

- **Editable a mano (FR-056)**: las instrucciones y los criterios de un nodo son texto de varias
  líneas. En YAML son block scalars (`|`) legibles; en JSON son strings con `\n` escapados.
- **Comentarios**: YAML los admite; JSON no.
- **Diffs revisables (FR-054, Principio V)**: una línea por campo y texto multilínea sin escapes.
- **Errores con ubicación (FR-057)**: la librería `yaml` da línea y columna para errores de
  sintaxis. Para errores de schema, zod da el `path`, que se mapea a línea y columna usando los
  nodos del `Document` de `yaml`.
- **Reconstrucción idéntica (FR-055, SC-007)**: se serializa de forma canónica, con orden de claves
  fijo, posiciones redondeadas a enteros e indentación de 2. La prueba es de ida y vuelta:
  `parse(serialize(flow))` tiene que ser igual a `flow`. Al guardar un archivo que el usuario editó,
  se reescribe en forma canónica y los comentarios se conservan (`Document` API) `[NO VERIFICADO]`
  (U-09).

**Alternativas**:

- JSON: sin dependencias, pero falla en legibilidad y en comentarios.
- TOML: anida mal las listas de nodos.
- Un formato propio: prohibido por el Principio VI.

**Costo**: dependencia de runtime fuera del stack (`yaml`). Está justificada en Complexity Tracking
del plan.

## R-05 · Resultado en tres capas

**Decisión** (tomada de antemano; aquí se desarrolla):

1. **`ProcessOutcome`**: cómo terminó el proceso. Lo produce el adaptador. Unión discriminada:
   `exited`, `agent_error`, `turn_limit`, `killed`, `crashed`, `infra_failure`, `spawn_failed`
   ([contracts/adapter.md](./contracts/adapter.md)).
2. **`AgentReport`**: lo que declara el agente, validado con zod. Lo entrega el adaptador como
   `valid`, `invalid` (con errores zod) o `absent`.
3. **`NodeResult`**: lo decide el motor con la función pura
   `resolveNodeResult(input) → NodeResult` en `packages/core`. Recibe: `ProcessOutcome` final,
   estado del reporte tras el pedido adicional, denegaciones (si el agente las informa), la
   observación de git (archivos) y la marca de cancelación del usuario.

**Por qué**:

- `[001b §A1]`: en las 13 corridas BLOCKED y FAILED reales, el proceso terminó con `success`,
  `is_error: false` y exit 0. El resultado del proceso y el de la tarea son ejes distintos.
- `[001 §3]`: con modelo inválido, el proceso reporta `subtype: success` e `is_error: true`.
- `[001 §6]`: una tarea con acciones denegadas termina con `is_error: false`.

Si esas capas se mezclan, se producen éxitos falsos.

**Reglas**: FR-036 se implementa **solo** en `resolveNodeResult`, en el orden exacto de la spec.
La tabla completa está en [data-model.md §NodeResult](./data-model.md#noderesult). La función no
conoce el id del agente, solo sus capacidades (`reportsDenials`, `supportsTurnLimit`). Así se
cumple FR-016: un agente nuevo no cambia las reglas.

**Diferencias con la recomendación de 001b** (manda la spec):

- `[001b §A]` proponía "FAILED (inconsistent)" para `DONE` con bloqueos. FR-036.6 dice
  **"bloqueado"** mostrando la inconsistencia.
- `[001b §A]` proponía fallar si `filesChanged ⊄ git`. FR-037 dice **mostrar la discrepancia**, sin
  cambiar el estado.
- `[001b §A]` proponía nunca parsear `result` como fallback. Se adopta: un reporte ausente o
  inválido dispara el pedido adicional (FR-038) y **nunca** se extrae JSON de texto libre.

**Campos ausentes**: costo en dinero, turnos y denegaciones son **opcionales sin valor por
defecto**. `denials: undefined` significa "el agente no informa"; `denials: []` significa "informa,
y no hubo ninguna". Esa diferencia decide si se aplica la regla 4 (FR-023, FR-036.4) y qué muestra
la UI ("not available").

## R-06 · Schema del `AgentReport`

**Decisión**: [contracts/agent-report.md](./contracts/agent-report.md). Campos obligatorios:
`status` (`COMPLETED` | `BLOCKED` | `FAILED`), `summary`, `filesChanged`, `checks[]`
(`name`, `outcome`, `evidence`), `blockers[]`, `findings[]`.

- **Siempre admite BLOCKED y FAILED y listas vacías, sin límites de largo ni de cantidad**
  (FR-034). Evidencia `[001b §A3]`: con `status` restringido a `DONE`, el modelo reportó `DONE`
  aunque no pudo hacer nada. Con cardinalidad o longitud mínimas, **rellenó con basura** que igual
  pasó la validación.
- **Compatibilidad con schema estricto**:
  - Todas las propiedades son `required` (lo opcional se expresa como lista vacía o string vacío).
  - `additionalProperties: false` en todos los objetos.
  - Solo se usan `type`, `enum`, `properties`, `required`, `items` y `additionalProperties`; no hay
    `minLength`, `maxItems`, `pattern`, `format`, `oneOf` ni `$ref`.
  - `[001 §5]`, `[001b §A]` verificaron `--json-schema` de Claude con un schema de esta forma.
  - Que Codex acepte exactamente este subconjunto viene de `[001c-resumen]`. Las restricciones
    precisas de su modo estricto son `[PENDIENTE-001c]`: se mantiene el subconjunto mínimo para no
    depender de ellas.
- **Campo `findings`**: no está en FR-033, pero sí en el Principio VII ("hallazgos"). Se agrega
  como lista que puede estar vacía. Así se cumple la constitución sin contradecir la spec, que fija
  mínimos y no prohíbe campos extra, y sin inducir relleno.
- **Una sola fuente**: el schema zod del reporte está en `packages/contracts`. El JSON Schema que
  se pasa a los agentes se **genera** desde zod en el build y se versiona como snapshot en los
  tests. Un test verifica que el JSON generado solo usa las palabras clave permitidas.
- **Reglas del motor, no del schema**: duplicados o strings vacíos en `filesChanged` no invalidan el
  reporte. Se reflejan como discrepancia contra git (R-07).
- **Prompt**: el `TaskAssignment` define BLOCKED y FAILED de forma explícita, como la constante
  `REPORT` de 001b. Con esas definiciones, la clasificación fue 13/13 `[001b §A1]`.

## R-07 · `filesChanged` lo determina el motor desde git

**Decisión**: `observedFiles` = `git diff --name-status -z <baseCommit> <resultCommit>` después de
que el motor commitea (R-15). También incluye archivos sin trackear, porque el commit del motor
hace `add -A`. El `filesChanged` declarado se compara con `observedFiles` y produce:

- `undeclared`: archivos observados que el agente no declaró;
- `declaredNotObserved`: archivos declarados que no cambiaron.

Las dos listas se muestran en el nodo (FR-037) y no cambian el estado (FR-036).

**Evidencia**: `[001 §8]` recomienda usar el diff del worktree como fuente de verdad. En
`[001b §A3]` el modelo inventó entradas en `filesChanged`.

**Detalle**: las rutas se normalizan a separador `/` y relativas a la raíz del repositorio. Si
cambió el modo de un archivo o solo sus finales de línea, figura como cambiado y lleva la marca
`eolOnly` (R-15).

## R-08 · Invocación de Claude Code

**Decisión**: el adaptador lanza `claude` como binario nativo, sin shell. El `cwd` es el worktree
del nodo. Siempre pasa:

`-p --output-format stream-json --verbose --input-format stream-json --strict-mcp-config --restricted --json-schema <schema> --max-turns <n>`

y agrega los flags de permisos de R-10.

| Elemento | Evidencia |
|---|---|
| `-p --output-format stream-json --verbose` (sin `--verbose` → exit 1) | `[001 §1]`, `[sample: 001/q1-no-verbose.txt]` |
| `spawn` sin `shell: true` (claude.exe es nativo) | `[001 §1]` |
| Prompt como mensaje `user` por stdin con `--input-format stream-json`: evita el quoting de Windows y permite el interrupt | `[001 §1]`, `[001 §7]` |
| `--strict-mcp-config`: sin él se cargan 6 MCP del usuario | `[001 §1]` |
| `--restricted`: confina las herramientas de archivos, ignora la config del usuario y del proyecto, rechaza bypass | `[001b §B1]` |
| `--json-schema`: salida estructurada validada por el CLI | `[001 §5]`, `[001b §A]` |
| `--max-turns` | `[001b §A2]` |
| 15 procesos concurrentes sin problemas (relevante para el límite de 8) | `[001 §5]` |

**Qué no se usa**:

- `--session-id`: está listado en `[001 §1]` pero no se ejercitó. El `session_id` se lee de
  cualquier evento, porque todos lo traen `[001 §2]`.
- `--include-partial-messages`: la salida en vivo por mensaje `assistant` alcanza para FR-029, y los
  deltas triplican el volumen de eventos (NFR-002).
- `--model`: FR-011 no incluye selección de modelo, así que no se pasa y se hereda el modelo por
  defecto del usuario `[001 §1]`. Queda en backlog (Principio I).
- `--max-budget-usd`: `[001 §3]` muestra que se controla **después** de gastar, así que no es un
  límite duro. Además la spec no define límite de gasto.

**Cierre de stdin**: al recibir el evento `result`, el adaptador cierra stdin.
`[NO VERIFICADO]` (U-04): si el proceso termina solo con stdin abierto después de `result`. Cerrar
stdin evita depender de eso.

**Eventos** `[001 §2]`, `[sample: 001/events/*]`: se normalizan a `session_started`,
`assistant_text`, `tool_call`, `tool_result`, `permission_denied`, `usage`, `subscription_usage` y
`raw` ([contracts/adapter.md](./contracts/adapter.md)). Los `assistant` que comparten `message.id`
se tratan como bloques sueltos. El thinking llega redactado y no se muestra. Los eventos con
`parent_tool_use_id` se etiquetan como subagente.

## R-09 · Detección de éxito en Claude Code

**Decisión**: el adaptador espera **el evento `result` y el `close` del proceso**. No usa `exit`,
porque `close` garantiza que stdout se drenó `[001 §3]`. Así construye el `ProcessOutcome`:

| Condición | `ProcessOutcome.kind` | Evidencia |
|---|---|---|
| `result` presente, `is_error: false`, exit 0 | `exited` (limpio) | `[001 §3]`, `[sample: 001/events/result.success.json]` |
| `result.subtype == error_max_turns` | `turn_limit` | `[001b §A2]` |
| `result` con `is_error: true` (incluye `subtype: success` con modelo inválido) | `agent_error`, con `terminal_reason`, `errors[]` y el código de stderr `[claude-code:…]` | `[001 §3]`, `[sample: 001/q3-error-bad-model.json]` |
| `close` sin `result` | `killed` si el motor lo mató (cancelación, tiempo, cierre de la app); `crashed` en otro caso | `[001 §3]`, `[001 §7]` |
| Error de spawn (ENOENT) | `spawn_failed` | — |

**Nunca se decide por `subtype`**: con modelo inválido reporta `success` `[001 §3]`.

**Denegaciones**: se toman de `result.permission_denials[]` y de los eventos
`system/permission_denied`, sin duplicar por `tool_use_id` `[001 §6]`,
`[sample: 001/events/system.permission_denied.json]`. Las denegaciones de `--restricted` (fuera del
worktree, `..`, junctions) también aparecen en `permission_denials` `[sample: 001b/b-restricted.json]`,
por ejemplo en `write-out` y `read-junction`.

**Reporte**: `result.structured_output`, validado con zod `.strict()`. `[001b §A2]`: puede faltar
aunque el proceso termine con `success`, y en ese caso se reporta `absent`.

## R-10 · Permisos y confinamiento en Claude Code

**Decisión**: una allowlist explícita por nodo, generada por el adaptador a partir de la
configuración del nodo y de la plataforma:

| Configuración del nodo | Flags | Nivel de confinamiento (FR-021) | Evidencia |
|---|---|---|---|
| Sin terminal, alcance de escritura no vacío (default) | `--restricted --permission-mode acceptEdits --tools "Read,Write,Edit,Glob,Grep" --allowedTools "Read Write Edit Glob Grep"` | `confined` | `[001b §B1]`: 8 de 8 intentos de salir denegados, incluidos `..` y junction. Con `--restricted` la shell se quita por defecto. |
| Sin terminal, alcance vacío | `--restricted --tools "Read,Glob,Grep" --allowedTools "Read Glob Grep"` | `confined` (solo lectura) | `[001 §6]`: `--tools` quita herramientas; no existen, así que no hay denials. |
| Con terminal, sin lista de comandos | igual al default, con `PowerShell` (Windows) o `Bash` (Linux) agregado a `--tools` y `--allowedTools` | `unconfined` (motivo: `TERMINAL_ENABLED`) | `[001b §B2]`: con `--restricted` la shell **no** está confinada. |
| Con terminal y lista de comandos | igual, con `--allowedTools "PowerShell(<cmd>)" …` por comando | `unconfined` (motivo: `TERMINAL_ENABLED`) | `[001 §6]`: `PowerShell(git init)` permitido, y el resto denegado y registrado. |

**Detalles con evidencia**:

- En Windows la herramienta de shell es **`PowerShell`**, no `Bash`. `--disallowedTools Bash` no
  bloquea nada `[001 §6]`. Las reglas se generan según la plataforma. Las reglas `Bash(...)` en
  Linux son `[NO VERIFICADO]` (U-06).
- **No se usa `dontAsk`**: el mensaje de denegación invita al modelo a buscar rutas alternativas
  `[001 §6]`. `acceptEdits` con `--restricted` es la combinación verificada `[001b §B]`.
- Se deja `--restricted` también en los nodos con terminal: sigue confinando las herramientas de
  archivos `[001b §B1]` e ignorando la config del usuario, aunque el nodo se muestre como no
  confinado por la shell. Es compatible con la decisión 4: `--restricted` es obligatorio en los
  nodos sin terminal y se mantiene como defensa en los demás.
- Nunca se genera `--disallowedTools StructuredOutput` ni se lista en `--allowedTools`
  `[001b §A2]`.
- Nunca se usa `--dangerously-skip-permissions`: `--restricted` lo rechaza `[001b §B1]`.
- Sin herramientas de red: `WebFetch` y `WebSearch` nunca entran en `--tools`.

**Limitaciones conocidas que la UI muestra** (NFR-012):

1. **Los comandos de solo lectura pasan aunque no estén en la lista.** El clasificador los
   auto-aprueba, por ejemplo `git --version` o `echo` `[001 §6]`. FR-018 ("los demás comandos se
   deniegan") no se cumple para ellos. Es una tensión con la spec (ver §T-05), y el nodo con lista
   de comandos muestra la advertencia `READONLY_COMMANDS_AUTO_APPROVED`.
2. **Alcance de rutas dentro del worktree (FR-017, US5-3)**:
   - `--restricted` confina a *todo* el worktree `[001b §B]`.
   - Limitar la escritura a un subconjunto (`src/**`) necesitaría reglas de permiso con
     especificador de ruta (`Edit(<glob>)`, `Write(<glob>)`), y eso **no se verificó** (U-02).
   - Hasta verificarlo, el adaptador:
     - (a) aplica prevención verificada para los dos extremos: alcance vacío (sin Write ni Edit) y
       alcance total (todo el worktree);
     - (b) para un alcance parcial, genera las reglas con especificador **solo si U-02 las
       confirma**;
     - (c) en todos los casos, el motor **detecta después** las escrituras fuera de alcance
       comparando `observedFiles` con `writeScope`, y lo registra como `scopeViolations`. Eso es
       detección, no prevención (ver §T-04).
3. **El modelo a veces se niega solo, sin llamar a la herramienta** `[001b §B1]`. Por eso los tests
   de confinamiento verifican el filesystem y nunca la respuesta del agente (R-26).

## R-11 · Límites de turnos, tiempo y presupuesto

- **Turnos (FR-032)**: se pasa `--max-turns <maxTurns + 2>`. Los 2 turnos de reserva son para
  la llamada a `StructuredOutput` `[001b §A2]`, que recomienda reservar 1 o 2. Al superarlo, el
  resultado es `error_max_turns` y el nodo queda `turn_limit` → "fallido" (FR-036.2). La UI muestra
  el límite configurado y aclara que incluye la reserva para el reporte. Codex no admite límite de
  turnos `[spec-clar]`, así que el campo se muestra como no aplicable (FR-011, FR-032).
- **Tiempo (FR-032, NFR-008)**: lo aplica el motor, igual para todos los agentes. Es un
  temporizador por intento; al vencer, `adapter.cancel('timeout')`. Si el `ProcessOutcome` es
  `killed{by:'timeout'}`, el nodo queda "fallido" (FR-036.2), no "cancelado". El schema del archivo
  de flujo exige un valor finito entre 1 y 1440 minutos, así que no existe "sin límite".
- **Presupuesto**: no se usa `--max-budget-usd` (R-08). La spec no define límite de gasto.

## R-12 · Cancelación de Claude Code en dos fases

**Decisión**:

1. Fase 1: `control_request {subtype:"interrupt"}` por stdin. Se espera el `result` hasta 5 s.
2. Fase 2: si no llega, se mata el árbol completo con `taskkill /PID <pid-raíz> /T /F` en Windows.
   Después se verifica con el supervisor (R-14) que no quede ningún proceso del árbol registrado.

**Evidencia** `[001 §7]`, `[sample: 001/q7-cancel.json]`:

- El interrupt produce `result` (`error_during_execution`, `aborted_tools`) en unos 100 ms, trae el
  costo hasta ese momento y no deja huérfanos.
- `child.kill()` deja vivo a `pwsh.exe`, que siguió escribiendo. Por eso **nunca se usa**.
- `taskkill /T /F` no dejó huérfanos.
- El árbol real es `claude.exe → cmd.exe → pwsh.exe (+conhost.exe)`, así que la shell no es hija
  directa.

**Presupuesto de tiempo**: 5 s (fase 1) + menos de 2 s (fase 2) + verificación, contra los 10 s de
NFR-004.

**Resultado**: si fue una cancelación del usuario, el nodo queda "cancelado" (FR-036.1) aunque
llegue un `result` o un reporte. El worktree se conserva y se marca como no confiable (FR-049),
porque puede tener escrituras a medias `[001 §7]`.

**Linux**: el spawn es `detached: true` y se mata el grupo con `process.kill(-pgid, 'SIGKILL')`. Es
una recomendación de `[001 §7]`, pero **no se verificó en Linux** (U-06).

## R-13 · Adaptador de Codex

> Todo lo de esta sección viene de `[001c-resumen]` y `[spec-clar]`. **Ningún flag, clave de
> configuración, variable de entorno, ruta ni patrón de stderr está verificado en un documento del
> repositorio.** Los valores concretos quedan como `[PENDIENTE-001c]` y **no se inventan**.

| Aspecto | Decisión | Respaldo | Concreto pendiente |
|---|---|---|---|
| Qué binario se lanza | El **binario real** de Codex, nunca el shim de npm. El adaptador resuelve la ruta del ejecutable nativo; si solo encuentra el shim, falla la verificación previa. | `[001c-resumen]`: matar el shim no cancela la tarea. | P-01: cómo resolver la ruta del binario real en Windows y Linux. |
| Terminal | Siempre habilitada; no hay modo sin terminal. | `[spec-clar]` (FR-017) | — |
| Confinamiento | `write_only`: no escribe fuera del worktree y puede leer fuera. | `[spec-clar]` (FR-019, FR-020) | P-02: flags o config del sandbox de Windows que se fijan de forma explícita. |
| Rechazos del sandbox | Se detectan en **stderr**, porque terminan con exit 0. Se emiten como evento `sandbox_rejection` (se persisten y se muestran; FR-063). **No** activan la regla 4: Codex no informa denegaciones `[spec-clar]` y la detección es heurística. Ver §T-06. | `[001c-resumen]` | P-03: patrón de stderr. |
| Config del usuario | Se ignora la config del usuario y se **deshabilitan explícitamente los conectores de la cuenta**. | `[001c-resumen]` | P-04: flags o claves para ignorar la config y deshabilitar los conectores. |
| Red en Windows | Sin red; se muestra antes, durante y después (FR-066). | `[spec-clar]` | Viene de P-02. |
| Lista de comandos | No aplica. | `[spec-clar]` (FR-018) | — |
| Denegaciones | No se informan: `denials: undefined` y el nodo muestra "Denied-action check not available". | `[spec-clar]` (FR-023) | — |
| Límite de turnos | No aplica; solo tiempo y reintentos. | `[spec-clar]` (FR-032) | — |
| Cancelación | Sin interrupt ordenado: **se mata el árbol completo de forma forzada** con el supervisor (R-14) y el nodo queda "cancelado" sin esperar reporte. | `[spec-clar]` (FR-030) | — |
| Salida estructurada | El schema de R-06 se pasa por el mecanismo de schema estricto de Codex, y se valida igual con zod. | `[001c-resumen]` | P-05: flag del schema de salida y dónde llega el resultado (evento o archivo). |
| Eventos | Se normalizan a los mismos `NormalizedEvent`. | `[001c-resumen]` | P-06: mapeo de eventos JSON de Codex (se necesitan samples). |
| Autenticación | Se detecta la forma **real**, teniendo en cuenta las variables de entorno y no solo el estado de login. Cuenta ChatGPT = `subscription`; clave de API = `api_key` marcada "unverified" (FR-065). La verificación previa informa la forma efectiva por nodo. | `[001c-resumen]`, `[spec-clar]` | P-07: variables de entorno y precedencia frente al login. |
| Uso de la suscripción | Se lee de la **fuente donde el spike lo encontró, no de los eventos**. Se actualiza al terminar cada nodo de Codex y antes de lanzar uno; la UI lo marca como "not live" (FR-052). | `[001c-resumen]`, `[spec-clar]` | P-08: fuente y formato. |
| Costo y consumo | Consumo (tokens) sí; costo en dinero **ausente** con cualquier forma de autenticación (FR-050). | `[spec-clar]` | P-06 (campos de uso en los eventos). |
| Fallos del lanzador del sandbox | Se clasifican como `infra_failure`. Tienen su propia política de reintento (R-18) y **no consumen** los reintentos del nodo. | `[001c-resumen]` | P-09: firma del fallo (código, stderr). |
| Reanudar para pedir el reporte | Si falta el reporte, se reanuda la sesión (fork) para pedirlo una vez (FR-038). | Decisión 8 del pedido | P-10: si Codex permite reanudar o hacer fork, y cómo. Si no lo permite, FR-038 se cumple con un **segundo lanzamiento** en el mismo worktree con un prompt que solo pide el reporte (ver U-08). |

## R-14 · Seguimiento y terminación del árbol de procesos

**Decisión** (decisión 7): el motor **solo** termina procesos que pertenecen al árbol de un agente
que él lanzó. Los identifica siguiendo el árbol desde el lanzamiento. **Está prohibido terminar
procesos por nombre, fecha o patrón**: `[001c-resumen]` lo hizo y mató procesos ajenos.

**Diseño del supervisor** (`packages/adapters/src/process/`):

1. **Lanzamiento**: `spawn` sin shell. Se registra la raíz como `(pid, creationTime)`. En Windows
   `creationTime` viene de la tabla de procesos del SO; en Linux, de `starttime` en
   `/proc/<pid>/stat`. La tupla evita confundir un PID reutilizado.
2. **Seguimiento**: cada 2 s, y además justo antes de cancelar, se toma una **instantánea** de la
   tabla de procesos y se calcula el cierre transitivo de descendientes desde la raíz, siguiendo
   `ParentProcessId`. Los descendientes nuevos se registran con su `(pid, creationTime)` en la
   tabla `process_tree`, que es persistente.
   - Un descendiente registrado sigue siendo del árbol aunque su padre intermedio muera. Así se cubre
     el caso `cmd.exe` intermedio `[001 §7]`, donde buscar por `ParentProcessId == pid de claude`
     falla.
   - No se usa la línea de comandos para identificar: la herramienta PowerShell no pasa el comando
     por argv `[001 §7]`.
3. **Terminación**:
   - Primero, `taskkill /PID <raíz> /T /F`, verificado en `[001 §7]`.
   - Después, cada PID registrado que siga vivo **y cuyo `creationTime` coincida** se termina de a
     uno con `taskkill /PID <pid> /F`.
   - Por último, una instantánea confirma que no queda ninguno.
4. **Nunca** `child.kill()` solo `[001 §7]`, ni `taskkill /IM`, ni filtros por nombre o fecha.

**Cómo se toma la instantánea en Windows**: consultando `Win32_Process` (PID, PPID,
`CreationDate`). El mecanismo concreto es `[NO VERIFICADO]` en rendimiento (U-05): lanzar
`powershell Get-CimInstance` cada 2 s por nodo es caro. Por eso se toma **una sola instantánea para
todos los nodos activos** en cada tick.

**Camino más robusto, diferido**: Windows Job Objects con `KILL_ON_JOB_CLOSE`. Los descendientes
heredan el job automáticamente y el SO los mata al cerrar el handle, incluso si el motor se cae.
Requiere un addon nativo, lo que va en contra de R-03, y nunca se probó (§D-05).

**Cubre**: FR-030, FR-062, NFR-004, SC-003.

## R-15 · Copias aisladas

**Decisión** (decisión 6, desarrollada):

- **Mecanismo: `git worktree`**, porque lo exige el Principio VIII y se verificó en `[001 §8]`: el
  repositorio principal quedó idéntico antes y después.
- **Ubicación**: fuera del repositorio, en `%LOCALAPPDATA%\Zeko\wt\<runId8>\<nodeKey>`, o en
  `$XDG_DATA_HOME/zeko/wt/...` en Linux.
  - `[001 §8]`: un worktree anidado **hereda** `CLAUDE.md` y `.claude/` del repositorio padre porque
    Claude busca subiendo por los directorios.
  - Los ids se acortan para no pasar `MAX_PATH`, y los comandos de worktree usan
    `-c core.longpaths=true` `[git]`.
- **Una por nodo de agente y por intento**. Todo nodo de agente tiene su copia, aunque su alcance
  sea vacío: así ningún nodo lee el repositorio del usuario mientras se edita (FR-043, FR-044).
- **Rama**: `zeko/<runId8>/<nodeId>`. Las ramas y los metadatos de worktree en `.git/worktrees/`
  son la única huella en el repositorio del usuario (FR-045). Nunca se cambia la rama actual ni se
  toca el árbol de trabajo del usuario.
- **Base de un nodo**:
  - Sin predecesor de código: el `baseCommit` del run, que es `HEAD` capturado al inicio.
  - Con predecesor de código: el `resultCommit` de su única fuente de código, según R-22 (FR-041).
  - El comando es `git worktree add -b <rama> <ruta> <sha>` `[001 §8]`.
- **Commits los hace el motor, no el agente**, al terminar cada intento con resultado completado,
  bloqueado o fallido:
  - Comando: `git -C <wt> add -A` y luego `git -C <wt> -c user.name=Zeko -c user.email=zeko@localhost -c core.hooksPath=<dir vacío de Zeko> commit --no-verify --allow-empty -m "zeko: <flow>/<node> run <id> → <status>"` `[git]`.
  - `core.hooksPath` vacío y `--no-verify` evitan ejecutar hooks del repositorio con los permisos
    del motor.
  - El commit es la frontera que usa el nodo siguiente y permite ver los cambios (FR-046).
  - Si el agente hizo commits propios (con terminal), el motor commitea encima.
  - Si `HEAD` ya no desciende de `baseCommit` (el agente reescribió historia), queda la
    discrepancia `HISTORY_REWRITTEN` y el nodo se muestra con advertencia.
- **Cancelado o interrumpido**: **sin commit**. El worktree se conserva con `trust = untrusted`,
  guardado en la base y no en el worktree para no alterarlo (FR-049). Solo se elimina con
  confirmación (FR-048).
- **Reintento**: el intento nuevo usa un worktree nuevo desde la misma base. El worktree del
  intento anterior, que terminó con error y no fue cancelado, se descarta
  (`git worktree remove --force` y borrado de la rama del intento), como dice el supuesto de la
  spec. Su diff resumido queda en los eventos.
- **Borrado (FR-048)**: `git worktree remove --force` y `git branch -D` de las ramas del run, solo
  después de la confirmación explícita en la UI o de `--yes` en la CLI.
- **Cambios sin confirmar en el repo del usuario**: al iniciar se consulta `git status --porcelain`.
  Si hay cambios, se muestra el aviso `UNCOMMITTED_CHANGES_EXCLUDED`. Si no hay commits
  (`rev-parse HEAD` falla), no se inicia el run (casos límite de la spec).
- **Disco lleno** al crear el worktree: el nodo queda "fallido" con `WORKSPACE_CREATE_FAILED`.

**Finales de línea (CRLF/LF)**:

- **Evidencia** `[001 §8]`: el `README.md` con CRLF recibió una línea con LF escrita por el agente.
- **Decisión**: el motor **no reescribe** finales de línea ni fuerza `core.autocrlf`. El worktree
  hereda la configuración y el `.gitattributes` del repositorio del usuario, así que el commit del
  motor normaliza igual que lo haría el propio usuario `[git]`.
- Para el diff mostrado (FR-046) se calcula además `git diff --ignore-cr-at-eol --name-only`. Un
  archivo que aparece en `observedFiles` pero no en esa lista lleva la marca `eolOnly`, y la UI lo
  muestra como "line endings only".
- Las advertencias de git sobre conversión de fin de línea (`LF will be replaced by CRLF`) se
  registran como eventos de diagnóstico, no como errores.
- Se recomienda que el usuario tenga `.gitattributes`, y el quickstart lo incluye. Zeko no lo crea
  (FR-045).

## R-16 · Paso de resultados entre nodos

**Decisión** (decisión 8):

- **Siempre se inyecta** el resultado estructurado completo de los predecesores en el prompt del
  nodo siguiente (FR-040): `AgentReport` + estado final + motivo + `observedFiles` + discrepancias.
  Para un predecesor de aprobación, los resultados de *sus* predecesores. La forma es la misma para
  cualquier agente (FR-014, FR-035).
- **Reanudar una sesión con fork** se usa **solo** para pedirle el reporte faltante al mismo agente
  (FR-038). Se hace una sola vez, con el mismo toolset y el mismo `cwd`:
  `--resume <sessionId> --fork-session` más los mismos flags de R-08 y R-10.

**Evidencia** `[001 §4]`:

- Inyectar es el único modo que respeta la persona y las herramientas del nodo nuevo.
- Al reanudar, un system prompt distinto **se ignora en silencio**, y cambiar el set de
  herramientas lo rompe (respuestas vacías, `samples/q4-chain-run2-tools-empty.json`).
- `--fork-session` no muta la sesión original.
- Reanudar desde otro `cwd` desorienta al agente.

**Relación con el código**: el "resultado completo" en texto no transporta el código. El código
viaja por la base de git (R-15), y el agente puede releerlo `[001 §4]`, hallazgo 5.

**Pedido del reporte faltante**: en el mismo worktree y sin commit intermedio. El proceso reanudado
es un segundo intento de reporte, no un reintento del nodo: no consume `maxRetries`. Sus eventos y
su costo se suman al nodo. Codex: ver R-13, P-10.

## R-17 · Costo, consumo, uso de la suscripción y retención

**Claude Code**:

- **Costo**: `result.total_cost_usd`, con `modelUsage.*.costBasis`.
  `[sample: 001/events/result.success.json]` muestra `costBasis: "list"`: es un **costo equivalente
  a precio de lista**, no un monto cobrado. Por FR-051 ("nunca se muestra un valor estimado sin
  marcarlo"), se guarda como `{amountUsd, basis: 'list_price_estimate'}` y la UI lo muestra
  "estimated". Si falta `costBasis`, se usa `basis: 'unknown'` y también se marca.
- **Consumo**: `result.usage` (tokens de entrada, salida y caché) `[001 §3]`.
- **Uso de la suscripción**: el evento `rate_limit_event`, en
  `rate_limit_info.unifiedWindows.{five_hour,seven_day}.utilization` (0..1) con `resetsAt`
  `[001 §2]`, `[sample: 001/events/rate_limit_event.json]`. Llega después de cada request, así que
  es un **valor en vivo** mientras algún nodo de Claude corre. El nivel efectivo es el **máximo**
  entre las ventanas. Una lectura con `resetsAt` vencido se descarta.
- **Tras un interrupt**, el `result` trae el costo hasta ese momento `[001 §7]`. Tras un kill
  forzado no hay `result`, así que el costo del nodo queda "not available" y el total, parcial.

**Codex**: consumo sí; costo ausente; uso de la suscripción desde la fuente de P-08, no en vivo
(R-13).

**Totales del run (FR-050, FR-051)**:

- Es la suma de los nodos con dato.
- Lleva `partial: true` si algún nodo tiene costo ausente, y `estimated: true` si alguno es
  estimado.
- Nunca se imputa un valor a un dato faltante.

**Retención (FR-053, decisión 9)**:

- Antes de lanzar un nodo, el scheduler consulta `usageGate(agentId)`. Si la última lectura válida
  es mayor o igual al umbral (0,9 por defecto, configurable en `.zeko/config.yaml`), el nodo queda
  `pending` con `hold = USAGE_NEAR_LIMIT` y no toma slot. Los nodos de otros agentes siguen.
- Para Codex, la consulta previa al lanzamiento refresca la lectura (FR-052).
- Sin lectura (agente que no informa, o Claude antes de su primer request), no hay retención. Es el
  supuesto de la spec: la retención solo aplica a agentes que informan uso.
- Si todos los nodos listos están retenidos y no hay nada corriendo, el run muestra
  `held: USAGE_NEAR_LIMIT` y el usuario puede cancelarlo (caso límite).
- Un nodo en curso que cruza el umbral termina normalmente (caso límite).
- El scheduler revalúa la retención ante cada lectura nueva y ante `resetsAt`.
- **SC-009**: como la lectura de Claude llega después de cada request, dos nodos lanzados en el
  mismo tick pueden pasar el umbral con la misma lectura. Para cumplir SC-009 de forma
  conservadora, el scheduler lanza **como máximo un nodo nuevo por agente por lectura** cuando la
  utilización supera `umbral − 0,10`, o sea en la franja de 80 a 90 %.

## R-18 · Reintentos del nodo y de infraestructura

**Decisión**:

- **Reintentos del nodo (`maxRetries`, FR-032)**: se aplican **solo** cuando el `ProcessOutcome` es
  `agent_error` o `crashed`, es decir, cuando "la ejecución termina con error".
- **No** se reintenta:
  - cuando se superan límites (`turn_limit`, `killed{timeout}`): repetir un timeout solo gasta
    suscripción;
  - cuando el reporte declara FAILED o BLOCKED: es el resultado de la tarea, no un error de
    ejecución `[001b §A1]`;
  - cuando falta el reporte: tiene su propio mecanismo (FR-038);
  - cuando hay cancelación: el nodo queda "cancelado" y no hay más reintentos (caso límite).
- **Reintentos de infraestructura**: solo para `infra_failure` (el lanzador del sandbox de Codex,
  `[001c-resumen]`). Hasta 2 relanzamientos con espera de 2 y 5 s, en un worktree nuevo desde la
  misma base, **sin consumir `maxRetries`**. Si se agotan, `failed` con motivo
  `INFRA_FAILURE_EXHAUSTED`. Los valores 2, 2 s y 5 s son de diseño `[NO VERIFICADO]`; se
  calibrarán con P-09.
- `spawn_failed`, por ejemplo un agente desinstalado durante el run (caso límite), no se reintenta:
  el nodo queda `failed` con `AGENT_UNAVAILABLE`.

**Cubre**: FR-032, FR-036.2, NFR-008.

## R-19 · Verificación previa (instalación y autenticación)

**Decisión**: cada adaptador implementa `detect() → AgentAvailability`, con `installed`, `version`,
`auth: {state, mode, verified}` y `problems[]`. El motor la llama antes de crear el run, solo para
los agentes que usa el flujo (FR-025).

- **Claude Code, instalación**: se resuelve `claude` en `PATH` y se ejecuta `claude --version`. El
  spike confirmó que `claude.exe` es nativo en Windows `[001 §1]`, y la versión aparece en `init`.
- **Claude Code, autenticación**: `[NO VERIFICADO]` (U-03). Ningún spike probó un comando de estado
  de autenticación. Hasta verificarlo:
  - la verificación previa informa `auth.state = 'unknown'` y deja iniciar el run;
  - si el primer evento es un error de autenticación, el nodo queda "fallido" con
    `AGENT_NOT_AUTHENTICATED`, como el caso límite "se desautentica durante un run".
  - Esto relaja FR-025 hasta cerrar U-03 (ver §T-07).
- **Codex**: binario real (P-01) y forma de autenticación efectiva considerando las variables de
  entorno (P-07). Una clave de API se marca `verified: false` (FR-065).

## R-20 · Recuperación tras cierre y estado "interrumpido"

**Decisión**:

- **Cierre ordenado**: en `before-quit` con runs activos, el main le pide al engine host
  `shutdown`. El motor:
  - mata de forma forzada cada árbol (R-14), sin fase 1, para no pasarse de tiempo;
  - marca los nodos en curso como `interrupted` con el worktree `untrusted`;
  - marca el run como `interrupted`.
- **Cierre abrupto** (crash, taskkill, corte de luz), al iniciar el próximo host (escritorio o CLI):
  1. Los runs con `status = running` cuyo `host_pid` y `host_started_at` ya no corresponden a un
     proceso vivo pasan a `interrupted`. Sus nodos no terminales, a `interrupted` o `skipped`.
  2. Para cada `process_tree` registrado de esos runs, se termina **solo** el PID vivo cuyo
     `creationTime` coincide con el registrado. Es seguimiento de árbol, no patrón (R-14, decisión
     7).
  3. Los worktrees de esos nodos quedan `untrusted` y se conservan (FR-049, FR-062).
- **Durabilidad (NFR-005)**: cada evento se escribe en una transacción SQLite (WAL,
  `synchronous=FULL`). Por rendimiento se agrupa en lotes de 50 ms como máximo: "registrado" es
  "commiteado". Se pierden como mucho los eventos de los últimos 50 ms antes de un corte de energía,
  que nunca figuraron como registrados.
- **Estado de nodo `interrupted`**: la lista de FR-028 no lo incluye, pero US8-2 y FR-049 hablan de
  "nodos interrumpidos". Se agrega como estado terminal que solo aparece en el historial (§T-03).

## R-21 · Concurrencia global por proyecto entre procesos

**Decisión**:

- El límite (8 por defecto, en `.zeko/config.yaml`) se aplica con **leases en SQLite**. La tabla es
  `slot_leases`, con clave por proyecto.
- Cada lease se toma en una transacción `BEGIN IMMEDIATE`, lleva heartbeat cada 5 s y se considera
  vencido si su host no está vivo (`pid` + `started_at`).
- Así, dos runs del mismo proyecto, incluso uno desde la CLI y otro desde el escritorio, comparten
  el límite (caso límite de la spec, FR-027).
- No hay sub-límites por agente (FR-027).
- Los nodos de aprobación y de entrada **no** consumen slot.

**Alternativa descartada**: un semáforo en memoria. No coordina procesos distintos.

## R-22 · Linaje de código y regla de un solo predecesor

**Decisión**: se define `codeSource(n)`, calculado en `core` sobre el grafo:

- nodo de entrada: `null` (base del run);
- nodo de agente con `writeScope` no vacío: `n` mismo (modifica código);
- nodo de aprobación, o nodo de agente con `writeScope` vacío: el conjunto de `codeSource` de sus
  predecesores (**transporta** el linaje).

**Validación (FR-008)**:

- Un nodo de agente cuyos predecesores aportan **más de una** fuente de código distinta es un
  error, explicado en el nodo.
- Un nodo de aprobación con más de una fuente distinta es un error si tiene algún dependiente de
  agente.

**Base del nodo (FR-041)**: el `resultCommit` de su única fuente de código, o `baseCommit` del run
si no tiene.

**Interpretación**: FR-008 solo nombra la herencia "a través de un nodo de aprobación". Si un nodo
de agente de solo lectura (una revisión) no transportara linaje, en `A (escribe) → B (revisa) →
C (corrige)` el nodo C arrancaría sin los cambios de A, lo cual contradice la intención de US4. La
regla extendida es más conservadora: solo agrega errores, nunca los quita. Queda registrada como
tensión §T-02 para confirmar en `/speckit-clarify`.

## R-23 · Salida de agentes como datos

**Decisión (FR-042, NFR-007, Principios X y XI)**:

- **Ningún campo del reporte ni de la salida se interpreta como control.** El motor solo lee
  `status`, `blockers.length` y `filesChanged` para las reglas de FR-036/FR-037.
- Las aprobaciones solo entran por IPC o por la TTY de la CLI, nunca desde el contenido de un
  agente.
- **Los resultados inyectados van delimitados** en un bloque
  `<zeko-predecessor-results>…</zeko-predecessor-results>`, serializados como JSON, con una
  instrucción previa que los declara **datos no confiables**. El orden del prompt sigue el Principio
  X: restricciones de Zeko → política del proyecto → tarea del usuario → criterios → resultados de
  predecesores (datos).
- **Secretos**:
  - El archivo de flujo no tiene ningún campo para credenciales (schema estricto, FR-058).
  - Nunca se persisten variables de entorno ni argumentos con credenciales.
  - Los eventos persistidos pasan por un redactor de patrones de credenciales conocidos antes de
    guardarse. Es una mitigación heurística: lo que un agente lee del repositorio puede contener
    secretos (NFR-007, §T-08).

## R-24 · Textos visibles desde un catálogo único

**Decisión**:

- `packages/i18n` tiene `en.json` (clave → mensaje con parámetros) y una función `t(key, params)`
  sin dependencias externas.
- El motor emite `ReasonCode` y `WarningCode` tipados en `contracts`. El renderer y la CLI los
  traducen con el mismo catálogo.
- Un test falla si hay un `ReasonCode` sin entrada en el catálogo, y la regla de lint prohíbe
  strings literales en JSX.
- No hay selector de idioma (NFR-013).

## R-25 · IPC y performance de la UI

**Decisión** ([contracts/ipc.md](./contracts/ipc.md)):

- Todos los mensajes van por el MessagePort renderer ↔ engine host, validados con zod en ambos
  extremos.
- **Estados**: se envían al instante (NFR-003, < 1 s).
- **Salida**: se agrupa por nodo en frames de 50 ms. Hay un ring buffer por nodo en el renderer, y
  **un único** `@xterm/xterm` montado para el nodo seleccionado; al cambiar de nodo se rehidrata
  desde el buffer y, si hace falta, desde `node.output.page`.
- `@xyflow/react` solo se re-renderiza con cambios de estado, no con salida.
- El `xterm` se usa como visor de solo lectura: los agentes corren sin pty (modo print). Por eso
  **no se usa `node-pty`**, aunque está en el stack; las terminales interactivas están fuera de
  alcance.

**Validación**: test de carga con 8 agentes simulados emitiendo a la tasa de
`samples/q1-verbose-raw.jsonl` acelerada ×10, midiendo la latencia de interacción (NFR-002).

## R-26 · Estrategia de tests

- **Unit (core)**:
  - validación de flujos, con un caso por regla: ciclo, sin entrada, desconectado, más de un
    predecesor de código directo, a través de aprobación y a través de solo lectura, límites
    infinitos, alcance inexistente como advertencia;
  - scheduler: paralelismo, límite global, omisión en cascada, rechazo de rama, retención por uso,
    cancelación durante aprobación y durante un reintento;
  - `resolveNodeResult`: **un caso por regla de FR-036 y por cada combinación de precedencia**, más
    FR-037 y la diferencia `denials` ausente o vacío;
  - confinamiento, linaje, totales de costo.
- **Adaptadores**:
  - un **agente simulado** (`packages/adapters/test/fake-agent`) es un ejecutable Node que
    **reproduce** JSONL de `spikes/*/samples/` según un guion. Responde a `control_request` de
    interrupt como en `q7-cancel.json`, puede terminar sin `result`, y puede lanzar
    `cmd.exe → powershell.exe` hijos para reproducir el árbol de `[001 §7]`;
  - los tests nunca invocan `claude` ni `codex` reales (Principio XVI);
  - para Codex, los guiones dependen de P-06 (samples de 001c).
- **Integración Windows** (`pnpm test:win`, solo en CI Windows):
  - cancelación: el fake lanza un nieto que escribe una línea por segundo. Después de cancelar, el
    archivo deja de crecer y ningún `(pid, creationTime)` registrado sigue vivo, en menos de 10 s
    (SC-003);
  - aislamiento: el hash del árbol de trabajo, `HEAD` y `status --porcelain` del repositorio
    original son iguales antes y después (SC-004);
  - recuperación: se mata el host a mitad de un run y se verifica el estado `interrupted`, los
    procesos terminados y los worktrees conservados.
  - Todo se verifica en el filesystem y en la tabla de procesos, **nunca por lo que declara el
    agente** `[001b §B]`.
- **Confinamiento real con Claude (SC-006)**: se valida manualmente con el quickstart. Un test
  automatizado necesitaría el proveedor real.

---

## §T · Tensiones con la constitución y con la spec

| ID | Tensión | Resolución en este plan |
|---|---|---|
| T-01 | **Plataformas**. FR-064 y NFR-001 hacen obligatorio Linux además de Windows. El pedido de planificación dice "Plataforma obligatoria: Windows nativo", y los spikes solo se corrieron en Windows. | El diseño cubre ambos: reglas de shell por plataforma y kill por grupo en Linux. La validación y la CI de integración empiezan por Windows. Todo lo de Linux es `[NO VERIFICADO]` (U-06) hasta un spike o una ejecución del quickstart en Linux. Si Linux sale del alcance, hay que enmendar la spec. |
| T-02 | **FR-008** solo nombra la herencia de código a través de aprobación. | R-22 extiende el linaje a nodos de agente de solo lectura. Es más conservador. Confirmar con `/speckit-clarify`. |
| T-03 | **Estados**. FR-028 no incluye "rechazado" ni "interrumpido", pero FR-031, US8-2 y FR-049 los usan. El Principio XIII usa `idle/running/waiting approval/failed/done`. | Se agregan `rejected` (solo nodos de aprobación) e `interrupted` (solo historial) como estados terminales. En [data-model.md](./data-model.md#estados-de-nodo) está el mapeo a los estados del Principio XIII. |
| T-04 | **Alcance de rutas dentro del worktree** (FR-017, US5-3: "la acción se deniega"). La prevención de un alcance parcial depende de U-02. | Mientras U-02 esté abierto, solo hay prevención para alcance vacío y total, más detección posterior (`scopeViolations`), que se muestra en el nodo pero no altera FR-036. Si U-02 falla, habrá que decidir en clarify si una escritura fuera de alcance detectada cuenta como denegación (regla 4). |
| T-05 | **FR-018** ("los demás comandos se deniegan") frente a la auto-aprobación de comandos de solo lectura `[001 §6]`. | Se muestra la advertencia `READONLY_COMMANDS_AUTO_APPROVED` en el nodo. No hay forma verificada de evitarlo. |
| T-06 | Los **rechazos del sandbox de Codex** en stderr parecen denegaciones, pero la spec dice que Codex no las informa (FR-023). | Se registran y se muestran como eventos `sandbox_rejection` (FR-063) sin aplicar la regla 4. Si la spec quiere que cuenten, se habilita con una capacidad `reportsDenials: 'heuristic'`, sin cambiar `resolveNodeResult`. |
| T-07 | **FR-025** pide verificar la autenticación de Claude antes del run, y no hay un mecanismo verificado (U-03). | `auth.state = 'unknown'` permitido hasta cerrar U-03. El fallo de autenticación se detecta en el nodo. |
| T-08 | **NFR-007** ("ningún evento contiene secretos") no se puede garantizar si un agente imprime un secreto que leyó del repositorio. | Hay un redactor heurístico. Se documenta como riesgo residual. |
| T-09 | **Principio VI**: la comunicación agente ↔ Zeko MUST usar MCP. El plan usa stdout JSON + schema de salida, que es lo verificado en `[001]`/`[001b]`. | Justificado en Complexity Tracking. El servidor MCP de Zeko está diferido (D-01). |
| T-10 | **Principio IX**: acciones fuera de alcance MUST requerir aprobación humana. En modo print no hay superficie de aprobación: se **deniegan** `[001 §6]`. | Denegar es más estricto que pedir aprobación. La aprobación interactiva (`--permission-prompts host`) no está verificada y queda diferida (D-04). |
| T-11 | **Principio VII**: nombres `TaskAssignment`/`WorkReport` y campo "hallazgos". | `TaskAssignment` se usa tal cual. `AgentReport` es el `WorkReport` de la constitución (alias en `contracts`). Se agrega `findings` (R-06). |
| T-12 | **Principio V**: la base de datos guarda solo runs, eventos y aprobaciones. El run guarda una **instantánea** del flujo ejecutado. | Es estado de ejecución (qué se ejecutó), no un almacén editable paralelo. El canvas nunca lee flujos de la base. |
| T-13 | **Stack**: `node-pty` está en la constitución y no se usa; `yaml` y el posible `better-sqlite3` no están. | No usar una dependencia del stack no es una violación. `yaml` se justifica en Complexity Tracking. |

## §U · Supuestos no verificados

Ninguno de estos puntos se probó en un spike. Cada uno se verifica en una tarea de investigación
antes de implementar la parte afectada.

| ID | Supuesto | Afecta | Cómo verificarlo |
|---|---|---|---|
| U-01 | `node:sqlite` está disponible y es estable en la versión de Node embebida en Electron (utilityProcess) y en Node 24 LTS, con WAL. | R-03 | Test de humo en el engine host empaquetado en Windows. Si falla, usar `better-sqlite3`. |
| U-02 | Las reglas de permiso de Claude con especificador de ruta (`Edit(<glob>)`, `Write(<glob>)`) limitan la escritura a un subconjunto del worktree, y las violaciones aparecen en `permission_denials`. | R-10, FR-017, US5-3 | Mini-spike 001d con la metodología de `[001b §B]`, verificando en el filesystem. |
| U-03 | Existe una forma de verificar la autenticación de Claude sin costo. | R-19, FR-025 | Mini-spike 001d: revisar `claude --help` o los subcomandos de auth. |
| U-04 | Con `--input-format stream-json`, el proceso termina después de `result` con stdin abierto (o al cerrarlo). | R-08 | 001d: medir `close` con stdin abierto y cerrado. |
| U-05 | Una instantánea de procesos en Windows (`Win32_Process`) cada 2 s tiene costo aceptable con 8 árboles activos. | R-14, NFR-002 | Medición en el test de integración de Windows. |
| U-06 | En Linux: reglas `Bash(...)`, kill por grupo (`detached` + `-pgid`), `--restricted` equivalente. | R-10, R-12, T-01 | Repetir `[001 §6-7]` y `[001b §B]` en Linux. |
| U-07 | `--restricted` ignora `CLAUDE.md` del proyecto, o no lo hace. `[001b §B1]` solo dice "configuración" según `--help`. | Contexto del agente | 001d: comprobar si el agente ve instrucciones de un `CLAUDE.md` en el worktree. |
| U-08 | Codex permite reanudar o hacer fork de una sesión para pedir el reporte (P-10). Si no, el segundo pedido es un lanzamiento nuevo en el mismo worktree. | R-13, FR-038 | Leer los FINDINGS de 001c. |
| U-09 | La API `Document` de `yaml` conserva los comentarios al reescribir un archivo editado a mano. | R-04 | Test de ida y vuelta con fixtures. |
| U-10 | `z.toJSONSchema` (zod 4) genera el schema del `AgentReport` usando solo las palabras clave del subconjunto de R-06. | R-06 | Test de snapshot, y ajustar el generador si no. |

## §P · Datos pendientes de 001c (no inventados)

`spikes/001c-*/FINDINGS.md` y sus samples deben incorporarse al repositorio. Hasta entonces, el
contrato del adaptador de Codex define **el comportamiento**, y estos valores quedan abiertos:

| ID | Dato |
|---|---|
| P-01 | Resolución de la ruta del binario real de Codex (no el shim de npm) en Windows y Linux. |
| P-02 | Configuración explícita del sandbox de Windows (confinamiento de escritura, sin red). |
| P-03 | Patrón de stderr de los rechazos de comandos del sandbox (terminan con exit 0). |
| P-04 | Cómo ignorar la configuración del usuario y deshabilitar los conectores de la cuenta. |
| P-05 | Mecanismo de schema de salida estricto y dónde se recibe la salida estructurada. |
| P-06 | Tipos de eventos JSON, correlación de herramientas y campos de consumo. Samples reales para los tests. |
| P-07 | Variables de entorno de autenticación y su precedencia frente al login de ChatGPT. |
| P-08 | Fuente y formato de la lectura del uso de la suscripción. |
| P-09 | Firma del fallo esporádico del lanzador del sandbox. |
| P-10 | Reanudación y fork de sesión. |

## §D · Caminos diferidos (fuera de este plan)

| ID | Camino | Por qué se difiere | Qué resolvería |
|---|---|---|---|
| D-01 | **Servidor MCP de archivos de Zeko** para confinar nodos de Codex sin terminal. | Decisión 10. Requiere diseñar e implementar un servidor MCP y verificar que Codex funcione sin shell. | Habilitaría nodos de Codex `confined` y el Principio VI (MCP como canal agente ↔ Zeko). |
| D-02 | **Perfiles de permisos con deny** (Claude). | Decisión 10. `[001 §6]` mostró que `--disallowedTools` quita la herramienta, pero no probó perfiles. | Políticas de proyecto reutilizables (Principio IX). |
| D-03 | **Reglas `execpolicy` de Codex**. | Decisión 10. | Una lista de comandos permitidos para Codex (hoy no aplica, FR-018). |
| D-04 | Aprobaciones interactivas de herramientas (`--permission-prompts host` + protocolo de control) | `[001 §6]`: mencionado, no probado. | Aprobación humana de acciones fuera de alcance en lugar de denegarlas (Principio IX, T-10). |
| D-05 | Windows Job Objects para los árboles de procesos | Requiere un módulo nativo (R-03) y no se probó. | Terminación garantizada por el SO aunque el motor se caiga. |
| D-06 | Selección de modelo por nodo (`--model`) | No está en FR-011 (Principio I). | Control de costo `[001 §1]`: opus costó 0,063 USD por un "di hola". |
| D-07 | Confinamiento de nodos con terminal a nivel de SO (contenedor, usuario restringido) | Fuera de alcance según la spec. `[001b §B2]`: `--restricted` no confina la shell. | Nodos con terminal `confined`. |
