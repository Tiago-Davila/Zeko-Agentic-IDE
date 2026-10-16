# Research: Nodos interactivos de agente (005)

**Fecha**: 2026-09-28 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Este documento extiende el diseño de `specs/001-agent-flow-canvas/` y lo **referencia** en vez de
redefinirlo. Las decisiones de 001 conservan su id (`R-01`…`R-28`, `T-xx`, `U-xx`, `D-xx`). Las de
esta feature usan el prefijo `R5-`. Los cambios explícitos a 001 están en §C, las tensiones en §T,
los supuestos no verificados en §U y el mini-spike que los resuelve en §S.

## Etiquetas de evidencia

| Etiqueta | Significado |
|---|---|
| `[001 §N]`, `[001b §X]`, `[001c §N]` | Hallazgo verificado en el spike correspondiente (ver la tabla de etiquetas de [001 research](../001-agent-flow-canvas/research.md)). **Todos son de modo no interactivo** (`claude -p`, `codex exec`). |
| `[001d U-xx]` | `spikes/001d-claude-gaps/FINDINGS.md` (Windows 11, Claude Code 2.1.283). |
| `[001e T131]` | `spikes/001e-codex-smoke/t131-evidence.md` (Codex 0.155.1). |
| `[sample: ruta]` | Evidencia cruda en `spikes/*/samples/`. |
| `[code: ruta:línea]` | Comportamiento del código actual del repositorio, leído en esta planificación. Describe qué hace Zeko, no qué hace un agente. |
| `[spec-005]` | Requisito o aclaración de [spec.md](./spec.md) (sesiones 2026-09-27 y 2026-09-28). |
| `[NO VERIFICADO]` | Ningún spike lo verificó. Está en §U con la pregunta de 005a que lo cierra. |
| `[git]`, `[node-pty]`, `[electron]` | Comportamiento documentado de esa herramienta, no de un agente. Si el plan depende de él en Windows, también figura en §U. |

**Regla de esta feature**: ningún spike ejercitó Claude Code ni Codex en modo interactivo (TUI dentro
de un PTY). Todo lo que este documento dice sobre ese modo es `[NO VERIFICADO]` salvo que cite un
hallazgo que no dependa del modo, por ejemplo la forma del rollout de Codex o el árbol de procesos
de `codex.exe`.

---

## Índice de decisiones

| ID | Decisión | Cubre |
|---|---|---|
| R5-01 | La sesión interactiva vive en el engine host (`utilityProcess`), no en el proceso principal; datos por un `MessagePort` dedicado | FR-006, FR-008, FR-010, FR-025, FR-026, NFR-002, NFR-003, SC-003, SC-004 |
| R5-02 | Lanzamiento directo del binario del agente, sin shell intermedia, con restricciones duras y matriz de capacidades interactivas | FR-002, FR-007, FR-012, FR-015, FR-016, NFR-006 |
| R5-03 | Clasificación del fin de sesión en `ProcessOutcome` | FR-011, FR-018, FR-019, casos límite |
| R5-04 | La recap se lee de los archivos de sesión del agente; nunca del buffer de la terminal | FR-018, FR-022, FR-027, FR-028 |
| R5-05 | Reglas de permiso persistidas por el agente: verificar, excluir del commit y no heredar | FR-016, FR-020, FR-023 |
| R5-06 | Cancelación en fases con adopción del árbol bajo ConPTY | FR-025, NFR-004, SC-005 |
| R5-07 | Reapertura: reanudar en la misma copia, tiempo acumulado, resultados reemplazados y reejecución confirmada | FR-010, FR-011, FR-023a |
| R5-08 | Resultado: capa de declaración en `resolveNodeResult`, commit del motor al cerrar | FR-019–023, SC-006 |
| R5-09 | Interrupción al cerrar la app, sobre la recuperación de R-20 | FR-026 |
| R5-10 | Enmienda propuesta al Principio IV (FR-029) | FR-029, Principio IV |
| R5-11 | Redacción de recap, eventos e historial con el redactor de R-28 | FR-028, SC-007 |
| R5-12 | Tipo de nodo `interactive` en el archivo de flujo y validación por contexto | FR-001–004, FR-029 |
| R5-13 | Scheduling: `waiting_user`, sin slot de concurrencia, notificación | FR-005, FR-006, FR-024, NFR-005 |
| R5-14 | Contexto mostrado al usuario y declaración de fin con el agente respondiendo | FR-013, FR-014, FR-017, FR-018 |
| R5-15 | Estrategia de tests: agente interactivo simulado y medición de latencia | Principio XVI, NFR-002–004, SC-003–006 |

---

## §I · Inventario del estado actual

Hoy existe una terminal interactiva por nodo en la app de escritorio. La implementan
`apps/desktop/src/main/pty-manager.ts`, `apps/desktop/src/renderer/terminal/node-terminal.tsx`,
`apps/desktop/src/renderer/panels/node-dock.tsx` y el cableado de `apps/desktop/src/main/index.ts`.
Se usa **mientras se edita el flujo**, no dentro de un run: no hay `NodeRun`, estado, límite de
tiempo ni resultado. La tabla compara cada comportamiento con la spec 005.

| # | Comportamiento actual | Evidencia | Requisito afectado | Veredicto | Por qué |
|---|---|---|---|---|---|
| I-01 | El agente se lanza **dentro de una shell**: en Windows `pwsh.exe -NoLogo -NoExit -Command "& claude …"`; en Unix `$SHELL -l -i -c "claude …; exec $SHELL -l -i"`. Al salir el agente queda un prompt de shell. | `[code: apps/desktop/src/main/pty-manager.ts:160-171]` | FR-011 (la salida normal finaliza el nodo), FR-016 (restricciones del nodo), NFR-006 | **Se reemplaza** | Con la shell, la salida del agente no termina el proceso raíz del PTY: Zeko no puede detectar la salida normal, y el prompt restante deja ejecutar cualquier comando fuera de las restricciones y del registro del nodo. El agente pasa a ser la raíz del PTY (R5-02). |
| I-02 | La terminación usa `pty.kill()` al reiniciar o al salir de la app. | `[code: pty-manager.ts:124-131]`, `[code: apps/desktop/src/main/index.ts:50]` | NFR-004, FR-025, FR-026; R-14 de 001 | **Se reemplaza** | `[001 §7]`: matar solo la raíz deja vivo a `pwsh.exe`, que siguió escribiendo. R-14 exige terminar el árbol registrado con `(pid, creationTime)` y verificarlo. La cancelación pasa por el supervisor (R5-06). |
| I-03 | El modelo es **opcional**: si el nodo no tiene entrada en `models` ni hay default, se lanza sin `--model`/`-m`. | `[code: pty-manager.ts:151-158]`, `[code: node-dock.tsx:27]` | FR-002 ("modelo explícito"; "MUST NOT heredar el modelo elegido por el propio agente"), R-27 | **Se modifica** | Sin `--model` Claude hereda el modelo del usuario `[001 §1]`, y el default de Codex cambia sin que cambie la configuración `[001c §1]`. El modelo pasa a ser obligatorio en el nodo interactivo (R5-12) y el adaptador siempre lo traduce (R5-02). |
| I-04 | `codex` se resuelve por `PATH` como comando de shell, así que en Windows ejecuta el shim `codex.cmd` de npm. | `[code: pty-manager.ts:154]` | NFR-004, FR-025; R-13 de 001 | **Se reemplaza** | `[001c §9]`: matar el shim deja vivos a `node` y `codex.exe`, que completan la tarea. El adaptador de 001 ya resuelve solo el binario nativo y rechaza `.cmd`/`.ps1` `[code: packages/adapters/src/codex/binary.ts:20-53]`; el lanzamiento interactivo reutiliza esa resolución. |
| I-05 | No se aplica ninguna restricción: ni `--restricted`, `--tools`, `--allowedTools`, `--strict-mcp-config` (Claude), ni `--ignore-user-config`, `--ignore-rules`, `--disable …`, sandbox `workspace-write` o `windows.sandbox` (Codex). El entorno hereda **todo** `process.env`, incluidos `CODEX_API_KEY`, `OPENAI_API_KEY` y `CODEX_HOME`. | `[code: pty-manager.ts:151-183]` | FR-015, FR-016, FR-003; R-10, R-13, R-19 de 001 | **Se reemplaza** | Sin `--strict-mcp-config` se cargan los MCP del usuario `[001 §1]`; sin `--ignore-user-config` y los `--disable` quedan los conectores de la cuenta y los hooks del usuario `[001c §7, §10]`; sin `windows.sandbox` Codex rechaza toda la shell `[001c §4]`; con `CODEX_API_KEY` heredada `exec` usa la clave aunque `login status` diga ChatGPT `[001c §2]`. Qué flags acepta cada agente **en modo interactivo** es `[NO VERIFICADO]` (U5-01, U5-05). |
| I-06 | El PTY vive en el **proceso principal** de Electron. El motor corre en el `utilityProcess` (R-01) y no se entera de nada: no controla ciclo de vida, límite de tiempo, cancelación, estado ni interrupción. | `[code: apps/desktop/src/main/index.ts:33-50]` | FR-005, FR-006, FR-010, FR-019, FR-025, FR-026; Principio IV | **Se reemplaza** | Las reglas de estado, tiempo y cancelación tienen que vivir en el núcleo (Principio IV) y aplicarse al proceso real. La sesión pasa al engine host (R5-01). |
| I-07 | La sesión se identifica por `projectRoot\0nodeId\0kind`, no por run ni intento. El selector de `kind` permite abrir **Claude, Codex y una shell** para el mismo nodo, al mismo tiempo, en el mismo directorio. | `[code: node-dock.tsx:20-34, 53-57]` | FR-009 (una sesión por copia aislada), FR-012, FR-063 de 001 (correlación por run) | **Se reemplaza** | La identidad pasa a ser `(runId, nodeRunId, attemptId)` (R5-07, data-model). El agente es el de la definición del nodo; no hay selector. |
| I-08 | El `cwd` de la terminal es **la raíz del repositorio del usuario**, no una copia aislada. | `[code: node-dock.tsx:30]` | FR-012, US2-11, SC-006 | **Se reemplaza** | Es la contradicción más grave: el agente escribe directamente en el repositorio original. El `cwd` pasa a ser el worktree del nodo (R-15, R5-07). |
| I-09 | Existe un tipo de terminal `shell` suelta en el dock del nodo. | `[code: pty-manager.ts:5]`, `[code: node-dock.tsx:56]` | Out of Scope de 005 ("Crear terminales sueltas fuera de un nodo de flujo"); FR-012; Principio I | **Se retira** | Ver la decisión en el párrafo siguiente a esta tabla. |
| I-10 | El botón "Pegar instrucciones" escribe las instrucciones del nodo en la entrada del agente con bracketed paste. | `[code: node-dock.tsx:36-41, 59]` | FR-017 ("sin enviarlos al agente"), NFR-006 | **Se reemplaza** | Zeko escribiría bytes en la entrada del agente. FR-017 exige que solo llegue lo que el usuario escribe. Se reemplaza por "Copiar al portapapeles" en el panel de contexto (R5-14): el usuario pega con su propia acción en xterm. |
| I-11 | Salida agrupada cada 8 ms y buffer de reenganche de 512 KiB **en memoria**; al reabrir el panel se reproduce. | `[code: pty-manager.ts:38-39, 102-122]` | FR-008, NFR-002, FR-028 | **Se conserva** (se muda al engine host) | Cumple FR-008 sin persistir la transcripción (FR-028). 8 ms es compatible con NFR-002. |
| I-12 | `useConptyDll: true` en Windows y `TERM=xterm-256color`; se quitan del entorno `ELECTRON_*`, `ZEKO_*` y los marcadores de sesión de Claude heredados. | `[code: pty-manager.ts:40-41, 96-97, 173-183]` | NFR-001, FR-007 | **Se conserva** y se amplía | Se agrega la limpieza de entorno de R-13/R-19 (`CODEX_API_KEY`, `OPENAI_API_KEY`, `CODEX_HOME`). |
| I-13 | Validación de dimensiones (`dimension`) y de pedidos del renderer (`parseOpenRequest`, patrón de modelo). | `[code: pty-manager.ts:134-148]` | Principio VII | **Se modifica** | Pasa a schemas zod en `contracts` (ipc de sesión). El renderer ya no manda `cwd`, `kind` ni modelo: el motor los toma del NodeRun. |
| I-14 | xterm en el renderer: Ctrl+C copia con selección, Ctrl+V pega, `FitAddon`, `ResizeObserver`. | `[code: node-terminal.tsx:35-113]` | FR-007, FR-008 | **Se conserva** | Cambia solo el transporte: del `ipcRenderer` al puerto de terminal (R5-01). |
| I-15 | Datos y salida se difunden a **todas** las ventanas desde el main (`sendToWindows`). | `[code: apps/desktop/src/main/index.ts:37-40]` | FR-009 | **Se reemplaza** | Con el puerto dedicado, cada ventana recibe solo las sesiones a las que está enganchada. |
| I-16 | Test `pty-manager.test.ts`: espera `["codex", "-m", …]` resuelto por PATH y valida el `kind: "shell"`. | `[code: apps/desktop/test/pty-manager.test.ts:10-14]` | — | **Se reemplaza** | Los tests nuevos cubren la traducción por adaptador (sin PATH ni shim) y la sesión con un agente simulado (R5-15). |

**Decisión sobre la terminal `shell` (I-09): se retira en esta feature.** Motivos:

1. La spec la excluye de forma explícita ("Crear terminales sueltas fuera de un nodo de flujo",
   Out of Scope). Aunque aparece dentro del dock de un nodo, no pertenece a ningún run ni a ninguna
   copia aislada: es una terminal suelta con otro marco.
2. Corre en la raíz del repositorio del usuario (I-08), así que contradice FR-012 y SC-006 dentro de
   la misma vista que ahora representa un nodo aislado.
3. Mantenerla obliga a conservar un segundo dueño de PTY en el proceso principal (I-06), fuera del
   motor y del supervisor. Ocultarla detrás de una opción no resuelve ninguno de los dos problemas.
4. Principio I: lo que no está en la spec va al backlog. Si hace falta una terminal de proyecto,
   se especifica aparte.

Con el mismo razonamiento, **la terminal de agente del modo edición también se retira**: abrir un
nodo de agente no interactivo durante la edición ya no lanza su CLI (Out of Scope: "Tomar el control
de un nodo de agente no interactivo"). El dock de un nodo de agente muestra su configuración y, en un
run, la salida de solo lectura de 001 (R-25).

---

## R5-01 · Dueño de la sesión y camino de los datos

**Decisión**: el PTY de cada sesión interactiva vive en el **engine host** (`utilityProcess`, R-01),
dentro de un componente `InteractiveSessionHost` de `apps/desktop/src/engine-host/`. El núcleo lo
usa a través de un puerto (`TerminalPort`, definido en `contracts`) y conserva todas las reglas:
estados, temporizador, cancelación, declaración, resultado. `node-pty` solo se carga en el engine
host de escritorio; `packages/core`, `packages/runtime` y la CLI no lo importan.

**Camino de los datos** (sin pasar por el proceso principal, igual que R-01):

```text
tecla en xterm (renderer)
  → terminal port (MessagePort dedicado, creado por main junto al puerto de control)
  → InteractiveSessionHost.write(sessionId, data)          [engine host]
  → node-pty → ConPTY → agente
agente → ConPTY → node-pty.onData
  → coalescido ≤ 8 ms por sesión (I-11)
  → terminal port → xterm.write (renderer)
```

- El **puerto de terminal es distinto del puerto de control** de ipc.md. Así la salida del PTY no
  compite con los lotes de 50 ms de `node.output` (R-25) ni con eventos de estado, y el eco de tecleo
  no espera a un lote.
- La salida del PTY **no** se persiste, no se redacta y no pasa por `events` (FR-028, R5-11). Solo
  se guarda en el buffer de reenganche en memoria (I-11).
- Los mensajes del puerto de terminal se validan con zod (Principio VII) pero con un schema mínimo
  (`sessionId` + `string`) para no agregar costo por tecla.

**Por qué el engine host y no el proceso principal**:

- El motor tiene que controlar el ciclo de vida, el límite de tiempo que sigue corriendo con la
  vista cerrada (FR-010), la cancelación verificada (FR-025) y la interrupción (FR-026). Con el PTY en
  el main, cada una de esas reglas necesitaría un protocolo main ↔ engine y el estado quedaría
  partido en dos procesos (I-06).
- El supervisor de procesos (R-14) ya corre en el engine host y es quien termina árboles.
- Si el engine host se cae, el main relanza el host y la recuperación (R-20, R5-09) marca las
  sesiones como interrumpidas. Con el PTY en el main, un agente podría seguir vivo sin motor.

**Alternativas descartadas**:

- **Proceso principal (estado actual)**: ver I-06. Además el main atiende las ventanas: un PTY con
  mucha salida compite con la UI.
- **Un `utilityProcess` aparte solo para PTYs ("terminal host")**: aísla el eco de tecleo de la carga
  del motor, pero `utilityProcess.fork` solo existe en el main `[electron]`: el motor no podría
  crearlo ni matarlo por su cuenta, y cada regla de ciclo de vida cruzaría tres procesos. **Queda
  como alternativa diseñada** si la medición de NFR-002 falla (abajo).
- **Renderer**: viola el Principio IV y el sandbox del renderer.

**Riesgo principal y cómo se mide**: el event loop del engine host también atiende escrituras
SQLite síncronas con `synchronous=FULL` (R-03), el parseo de hasta 8 streams (R-25) y git. Un bloqueo
largo retrasa el eco. Mitigaciones de diseño:

- los eventos persistidos ya van en lotes de ≤ 50 ms (R-20), no por evento;
- las instantáneas de procesos de Windows ya se consultan a un proceso PowerShell persistente aparte (`WindowsSnapshotWorker`) `[code: packages/adapters/src/process/process-table.ts:103-119]`, así que el engine host solo espera la respuesta de forma asíncrona;
- ningún trabajo del motor por sesión corre en el camino de una tecla.

**Medición (NFR-002, SC-003)**: latencia = tiempo desde el `keydown` en el renderer hasta que xterm
termina de parsear el byte de eco correspondiente (`Terminal.onWriteParsed`). Se mide con un agente
interactivo simulado que hace eco inmediato (R5-15), para medir solo a Zeko. Carga: 4 sesiones
interactivas con eco y 8 nodos no interactivos del agente simulado emitiendo a la tasa de
`spikes/001-claude-chain/samples/q1-verbose-raw.jsonl` ×10 (la misma carga de R-25). Criterio:
**todas** las pulsaciones medidas < 100 ms (SC-003 dice "todas", no un percentil). La sonda es solo
de desarrollo y no se incluye en el build de producción. Si falla, se pasa a la alternativa del
"terminal host".

**Supuestos**: que `node-pty` carga y funciona en un `utilityProcess` empaquetado es `[NO
VERIFICADO]` (U5-10). Hoy funciona en el main `[code: pty-manager.ts:3]`, que usa el mismo ABI de
Electron.

**Cubre**: FR-006, FR-008, FR-009, FR-010, FR-025, FR-026, NFR-002, NFR-003, SC-003, SC-004.

## R5-02 · Lanzamiento directo del agente y capacidades interactivas

**Decisión**:

- El engine host lanza **el binario del agente como raíz del PTY**, sin shell intermedia (I-01).
  Claude: `claude.exe`, que es nativo `[001 §1]`. Codex: `codex.exe` nativo, nunca el shim
  `[001c §9]`, con la misma resolución que 001 `[code: packages/adapters/src/codex/binary.ts]`.
- El **adaptador** arma la línea de comando con una operación pura nueva,
  `buildInteractiveLaunch(spec)` ([contracts/adapter.md](./contracts/adapter.md)). No lanza el
  proceso: lo lanza el `InteractiveSessionHost` con `node-pty` y lo **adopta** el supervisor (R5-06).
  Así ningún paquete compartido con la CLI depende de `node-pty`.
- `cwd` = el worktree del nodo, creado con la misma regla de R-15 y R-22: fuera del repositorio y de
  `%TEMP%`, rama `zeko/<run8>/<node>`, base = `resultCommit` de la única fuente de código del nodo o
  `baseCommit` del run (FR-012, FR-013).
- Entorno: el de 001 (I-12 más la limpieza de `CODEX_API_KEY`, `OPENAI_API_KEY` y `CODEX_HOME`
  heredados, R-13 y R-19), más `TERM`/`COLORTERM` para la TUI.
- El modelo va **siempre** por flag (R-27, FR-002).

**Flags por agente en modo interactivo**. Parten de los flags verificados en modo no interactivo y se
quitan los que solo tienen sentido con stream JSON. Que cada flag sea aceptado y tenga el mismo
efecto **en la TUI** es `[NO VERIFICADO]`:

| Agente | Candidatos | De dónde salen | Qué se quita respecto de 001 | Pendiente |
|---|---|---|---|---|
| Claude Code | `--model <m> --strict-mcp-config --restricted --tools <set> --allowedTools <reglas>` y, si se confirma, `--session-id <uuid>` | R-08, R-10; `[001 §1, §6]`, `[001b §B1]` | `-p`, `--output-format`, `--verbose`, `--input-format`, `--json-schema`, `--max-turns`, `--permission-mode acceptEdits` (en la TUI el usuario responde las solicitudes; FR-007) | U5-01, U5-02, U5-03 |
| Codex | `-m <m> -c model_reasoning_effort="<e>" -s workspace-write -c windows.sandbox="<modo>" -c sandbox_workspace_write.exclude_tmpdir_env_var=true -c sandbox_workspace_write.exclude_slash_tmp=true --disable apps --disable plugins --disable image_generation --disable multi_agent --disable goals --disable browser_use --disable computer_use -c web_search="disabled"` y, si la TUI los acepta, `--ignore-user-config --ignore-rules` | R-13; `[001c §1, §4, §7, §8, §10]` | `exec`, `--json`, `--output-schema`, `-` (stdin) | U5-05, U5-06 |

**Restricciones duras frente a solicitudes de permiso (FR-016)**. En la TUI el usuario responde las
solicitudes del agente, y esa respuesta no puede ampliar lo que Zeko fijó. Por eso el adaptador
distingue dos tipos de flag:

- **Límites que una solicitud no puede levantar**: el conjunto de herramientas (`--tools` quita la
  herramienta; sin ella no hay nada que aprobar `[001 §6]`), el confinamiento de las herramientas de
  archivos de Claude (`--restricted`, verificado solo en modo print `[001b §B1]`) y el sandbox de
  escritura de Codex (`workspace-write`, verificado en `exec` `[001c §8]`).
- **Pre-aprobaciones** (`--allowedTools`): solo evitan preguntar. Lo que queda fuera de ellas y dentro
  del conjunto de herramientas lo decide el usuario en la TUI.

Si en la TUI una aprobación del usuario **puede** levantar alguno de los límites duros (por ejemplo,
aprobar una escritura fuera del worktree con `--restricted`, o aprobar en Codex la ejecución de un
comando fuera del sandbox), ese agente no cumple FR-016 en esa dimensión. Entonces el adaptador
declara la restricción como **no admitida** en modo interactivo, el nodo la muestra (FR-016, "Zeko
MUST mostrar las restricciones que el agente no admite") y el confinamiento se muestra como
`unconfined` para esa dimensión (FR-015). Qué pasa en cada caso es `[NO VERIFICADO]` (U5-02, U5-06).

**Matriz de capacidades interactivas**. Se agrega un bloque `interactive` a `AgentCapabilities`
(ver [contracts/adapter.md](./contracts/adapter.md)). **Mientras 005a no cierre las preguntas, cada
adaptador declara el valor conservador de la última columna**, y el plan no promete más que eso:

| Capacidad | Claude Code — Windows | Codex — Windows | Valor conservador hasta 005a |
|---|---|---|---|
| `supported` | sí `[spec-005]` | sí `[spec-005]` | sí |
| `confinement.fileTools` | `full` si `--restricted` funciona igual en la TUI `[NO VERIFICADO: U5-02]` | n/a (Codex no tiene herramientas de archivos sin shell `[001c §7]`) | `none` |
| `confinement.shell` | `none` `[001b §B2]` (la shell no está confinada tampoco en print) | `write_only` si `workspace-write` rige en la TUI `[NO VERIFICADO: U5-06]` | `none` |
| `toolRestriction` | `--tools` / `--allowedTools` `[NO VERIFICADO: U5-01]` | ninguna por comando (en `exec` no hay allowlist `[001c §8]`) | `none` |
| `approvalCanWiden` | ¿una aprobación levanta `--restricted`? `[NO VERIFICADO: U5-02]` | ¿una aprobación ejecuta fuera del sandbox? `[NO VERIFICADO: U5-06]` | `true` (se asume que sí) |
| `userConfigIsolation` | `--strict-mcp-config` + `--restricted` `[NO VERIFICADO: U5-01]` | `--ignore-user-config` + `--disable` `[NO VERIFICADO: U5-05]` | `false` (se muestra advertencia) |
| `normalExit` | códigos de salida normal `[NO VERIFICADO: U5-04]` | `[NO VERIFICADO: U5-07]` | ninguno: toda salida sin declaración es `crashed` |
| `sessionRef` | `--session-id` fijado por Zeko `[NO VERIFICADO: U5-03]` | rollout localizado por `cwd` `[NO VERIFICADO: U5-08]` | `none` |
| `recap` | último mensaje del asistente en el archivo de sesión `[NO VERIFICADO: U5-03]` | `task_complete.last_agent_message` del rollout (verificado en `exec` `[sample: 001c/q4-termination.json]`, `[sample: 001c/q11-usage.json]`; en la TUI `[NO VERIFICADO: U5-08]`) | `none` → "recap no disponible" |
| `resume` | `--resume <id>` (con `--fork-session` si se usa fork) desde el mismo `cwd`, verificado solo en print `[001 §4]` | fork/resume, verificado solo en `exec` `[001c §5]` | `none` → conversación nueva con aviso |
| `busyDetection` | `[NO VERIFICADO: U5-13]` | turno abierto en el rollout (`task_complete` ausente) `[NO VERIFICADO: U5-13]` | `none` → siempre se pide confirmación |
| `orderlyExit` | secuencia de teclas `[NO VERIFICADO: U5-09]` | `[NO VERIFICADO: U5-09]` | `none` → solo fase 2 |
| `permissionPersistence` | `[NO VERIFICADO: U5-04b]` | `[NO VERIFICADO: U5-11]` | rutas desconocidas → advertencia |
| `reportsDenials` | no: sin stream JSON no hay `permission_denials` | no | `false` |
| `reportsCost` / `reportsConsumption` | `[NO VERIFICADO: U5-03]` | consumo y uso de la suscripción del rollout (verificado en `exec` `[001c §11]`) | `false` → "no disponible" |
| `processTree` | `claude.exe → cmd.exe → pwsh.exe` en print `[001 §7]`; bajo ConPTY `[NO VERIFICADO: U5-12]` | matar `codex.exe` mata todo el árbol en `exec` `[001c §9]`; bajo ConPTY `[NO VERIFICADO: U5-12]` | se sigue el árbol completo (R-14) |

La función de confinamiento de `core` (data-model §1 de 001) se extiende a nodos interactivos
leyendo **solo** este bloque, nunca el id del agente (FR-016 de 001). Con los valores
conservadores, todo nodo interactivo se muestra `unconfined` con el motivo
`INTERACTIVE_CONFINEMENT_UNVERIFIED`, y las restricciones configuradas que el agente no admite se
listan (FR-015, FR-016).

**Cubre**: FR-002, FR-007, FR-012, FR-013, FR-015, FR-016, NFR-006.

## R5-03 · Fin de sesión: salida normal, corte, autenticación y tiempo

**Decisión**: el adaptador clasifica el fin de cada segmento de sesión en el mismo
`ProcessOutcome` de 001 ([contracts/adapter.md de 001](../001-agent-flow-canvas/contracts/adapter.md#processoutcome)),
con una operación pura `classifyInteractiveExit`:

| Condición observada | `ProcessOutcome.kind` | Qué hace el motor |
|---|---|---|
| Zeko pidió terminar (cancelación, tiempo, cierre de la app, cierre tras declaración) | `killed{by: user \| timeout \| shutdown \| declaration}` | Lo sabe porque lo pidió, como en 001 `[001 §3, §7]`, `[001c §9]`. |
| La raíz terminó sola con un código de `interactive.normalExit.codes` y sin kill | `exited` | FR-011: declaración provisional `COMPLETED` con origen `normal_exit`. |
| La raíz terminó sola con otro código o por señal | `crashed` | Fallo (FR-011: "un corte inesperado MUST tratarse como fallo"). |
| La verificación de autenticación previa a abrir la sesión falla | `spawn_failed{cause: not_authenticated}` | El nodo queda `failed` con `AGENT_NOT_AUTHENTICATED` sin lanzar la TUI (supuesto de la spec). |
| El binario no existe o `node-pty` no puede lanzarlo | `spawn_failed{cause: not_found \| other}` | `failed` con `AGENT_UNAVAILABLE`. |

- Se agrega el valor `declaration` a `killed.by`: el proceso lo terminó Zeko **después** de una
  declaración válida del usuario (R5-14). No es una cancelación y no es un fallo.
- **Autenticación antes de abrir**: se reutiliza `detect()` de 001 en el momento de abrir la sesión.
  Claude: `claude auth status`, que no llama al modelo y del que solo se leen `loggedIn` y
  `authMethod` `[001d U-03]`. Codex: `codex login status` con el mismo entorno del lanzamiento
  (exit 0/1) `[001c §2]`. Así el caso "falla la autenticación al abrir" no depende de cómo la TUI
  informa el error.
- **Un fallo de autenticación durante la sesión** (token vencido) solo se puede distinguir si el
  agente sale con un código propio. Si sale con un código de salida normal, se registra como salida
  normal y el usuario lo ve en la terminal; esa ambigüedad queda documentada como riesgo hasta
  U5-04/U5-07.
- **ConPTY**: el código de salida se toma de `node-pty` (`onExit`), que en Windows lo obtiene del
  proceso lanzado `[node-pty]`. Como el agente es la raíz (R5-02), el código es el del agente. Que
  sea confiable bajo ConPTY con `useConptyDll` es `[NO VERIFICADO]` (U5-12).
- **Por qué el conjunto de códigos es una capacidad y no una regla del motor**: cambia por agente y
  no está verificado. Con el valor conservador (sin códigos normales), toda salida sin declaración
  previa se clasifica `crashed` → "fallido". Es seguro: el usuario siempre puede declarar el fin
  desde Zeko (FR-018).

**Precedencia (caso límite de la spec)**: si el agente termina inesperadamente, falla la
autenticación o vence el tiempo **antes** de un cierre válido, el nodo queda fallido y una
declaración posterior no cambia nada: la declaración solo se acepta con la sesión activa (R5-14) y la
regla 2 de `resolveNodeResult` precede a la declaración (R5-08).

**Cubre**: FR-011, FR-018, FR-019, casos límite de la spec.

## R5-04 · Recap del modelo como resumen

**Decisión**: la recap es "la última respuesta completa del agente antes del cierre, tomada de las
funciones de conversación del propio agente" `[spec-005]`. El adaptador la obtiene con
`readRecap(sessionRef, workspacePath)` **leyendo el archivo de sesión que el agente ya escribe**. La
salida de la terminal nunca se interpreta.

| Agente | Fuente | Evidencia |
|---|---|---|
| Codex | Rollout `$CODEX_HOME/sessions/AAAA/MM/DD/rollout-<ts>-<thread_id>.jsonl`, registro `task_complete` del **último turno**, campo `last_agent_message`. Si es `null` (turno fallido), no hay recap. | Formato verificado en `exec`: `[sample: 001c/q4-termination.json]` (`last_agent_message: "ok"`, `null` con modelo inválido), `[sample: 001c/q11-usage.json]`; ruta del rollout `[001c §3]`. Que la TUI escriba el mismo rollout: `[NO VERIFICADO: U5-08]`. |
| Claude Code | Archivo de sesión del agente, último mensaje del asistente con texto del último turno terminado. La ruta y el formato no se verificaron. Con `--session-id <uuid>` fijado por Zeko, la sesión se localiza sin buscar. | `[001 §1]` lista `--session-id` sin ejercitarlo. Todo lo demás: `[NO VERIFICADO: U5-03]`. |

**Cómo se localiza la sesión sin buscar por patrón de proceso**:

- Claude: Zeko genera el UUID y lo pasa con `--session-id` (si U5-03 lo confirma para la TUI).
- Codex: al cerrar el segmento, el adaptador busca en `sessions/` **solo** los rollouts creados
  después de la apertura del segmento cuyo `turn_context.cwd` es el worktree del nodo (el rollout
  registra el `cwd` `[001c §5]` hallazgo 4). FR-009 garantiza una sola sesión por worktree, así que
  hay a lo sumo un candidato. Es una lectura de archivos, no una identificación de procesos, así que
  no choca con la prohibición de R-14. El `thread_id` que se encuentra se guarda como `sessionRef`.

**Qué cuenta como "recap disponible"**: el adaptador devuelve `{state: 'available', text}` solo si
encuentra el archivo, lo puede parsear y el último turno **terminó** con un mensaje del agente no
vacío. En cualquier otro caso devuelve `{state: 'unavailable', cause}` con `cause ∈ {no_session_ref,
file_not_found, unreadable, turn_incomplete, no_agent_message}`, y el resultado muestra
"recap no disponible" en el resumen y en el nodo (FR-018, US2-6). Si el usuario cerró el agente a
mitad de una respuesta (R5-14), el último turno está incompleto: se toma la última respuesta completa
anterior si existe; si no, "recap no disponible" `[spec-005]`.

**Qué se descarta y por qué**:

- **Leer el buffer de la terminal**: es la TUI renderizada, con secuencias de control, redibujos,
  cortes de línea por el ancho y fragmentos de la entrada del usuario. Cualquier parser sería
  heurístico y distinto por versión de la TUI. Hay una alternativa estructurada (el archivo de
  sesión), así que se rechaza.
- **Pedirle la recap al agente** o inyectar un mensaje: lo prohíbe la aclaración (sin solicitarla) y
  FR-017.
- **Interpretar JSON dentro de la recap**: lo prohíbe la aclaración del 2026-09-28; la recap se
  conserva como texto (FR-018). Un resultado estructurado por MCP está fuera de alcance.

**Sin copia de la transcripción (FR-028)**:

- El adaptador lee el archivo en streaming y retiene solo el último candidato; no lo copia ni guarda
  otras partes.
- La recap pasa por el redactor (R5-11) antes de persistirse, con un tope de 64 KiB y marca de
  truncado, igual que `agent.tool_result` en 001.
- Del mismo archivo, en Codex, se leen además `token_count.rate_limits` y el consumo, como en 001
  `[001c §11]`. Nada más.

**Cubre**: FR-018, FR-022, FR-027, FR-028, US2-5, US2-6, US4-3.

## R5-05 · Permisos concedidos durante la sesión

**Pregunta**: al aprobar una solicitud con una opción del tipo "permitir siempre", ¿el agente
persiste reglas en archivos dentro de la copia aislada? Ningún spike lo verificó: en modo print no
hay superficie de aprobación `[001 §6]`, y en `exec` la approval es siempre `never` `[001c §8]`.
`[NO VERIFICADO: U5-04b, U5-11]`.

**Decisión**, en capas, para que ninguna respuesta posible de 005a rompa FR-016:

1. **Las reglas persistidas no pueden ampliar el alcance** porque los límites duros no dependen de
   archivos de configuración del proyecto: se pasan por flags en cada lanzamiento (R5-02). Además, en
   Codex, `.codex/config.toml` del proyecto no se carga `[001c §10]`; en Claude, `--restricted`
   declara ignorar la configuración del proyecto según `--help` `[001b §B1]`, aunque `CLAUDE.md` sí
   se sigue leyendo `[001d U-07]`, así que esa afirmación no se da por buena hasta U5-04b.
2. **No aparecen en el diff como cambios del usuario ni se heredan**: el adaptador declara
   `interactive.permissionPersistencePaths` (rutas relativas al worktree que 005a encuentre). El
   commit del motor las **excluye** con un pathspec de exclusión en `git add` `[git]`. No se revierten
   ni se borran: el archivo queda en el worktree del nodo, fuera de `resultCommit`. Consecuencias:
   - los dependientes arrancan desde `resultCommit`, así que no las ven (FR-023);
   - al reabrir, el mismo nodo sigue viéndolas en su propio worktree: son aprobaciones del mismo
     usuario para el mismo nodo, siempre dentro de los límites duros del punto 1;
   - el nodo muestra la advertencia `AGENT_PERMISSION_FILES_EXCLUDED` con la lista, y se emite
     `session.permission_files_excluded` (FR-020: el usuario ve qué quedó fuera).
3. **Excluir, no revertir**: revertir cambiaría el trabajo de la sesión por decisión del orquestador,
   y el Principio X dice que el orquestador no revierte instrucciones del usuario. Excluir solo
   decide qué entra en el commit del motor, que ya es responsabilidad del motor (R-15).
4. Si 005a encuentra que las reglas se persisten **fuera** del worktree (configuración global del
   usuario), Zeko no las toca. Las sesiones de Zeko no las cargan si el aislamiento de configuración
   funciona en la TUI (U5-01, U5-05); si no funciona, el nodo ya muestra `userConfigIsolation: false`
   como advertencia (R5-02).
5. Si una sesión escribe en esas rutas algo que **no** es una regla de permisos (por ejemplo, la tarea
   era editar la configuración del agente), igual queda excluido y visible con la advertencia. Es un
   caso raro y se prefiere la visibilidad a heredar reglas en silencio.

**Cubre**: FR-016, FR-020, FR-023.

## R5-06 · Cancelación en fases

En modo interactivo no hay protocolo de control por stdin: el `interrupt` de R-12 existe solo con
`--input-format stream-json` `[001 §7]`, y `codex exec` no tiene interrupt `[001c §9]`.

**Adopción del árbol**: el proceso raíz lo crea `node-pty`, no `child_process.spawn`. El supervisor
de R-14 gana una operación `adopt(pid)`: toma una instantánea, registra la raíz con su
`creationTime` (el mismo mecanismo de `#waitForRoot` `[code: packages/adapters/src/process/supervisor.ts]`),
la persiste en `process_tree` con el `attemptId` del segmento y sigue a sus descendientes cada 2 s,
como en 001. Bajo ConPTY también existe el proceso host del pseudoconsola (`OpenConsole.exe` con
`useConptyDll`) `[node-pty]`; si es hijo del engine host, no es descendiente del agente y se libera
con `pty.kill()` al final. Que `pty.pid` sea el PID del agente y cómo queda el árbol real es `[NO
VERIFICADO]` (U5-12).

**Fases** (presupuesto total < 10 s, NFR-004):

| Fase | Qué hace | Tiempo | Condición |
|---|---|---|---|
| 1. Salida ordenada | Escribe en el PTY la secuencia `interactive.orderlyExit.sequence` del adaptador y espera la salida de la raíz. | hasta 3 s | Solo si la capacidad está verificada (U5-09). Con el valor conservador se omite. Nunca con `shutdown`. |
| 2. Terminación del árbol | Supervisor: confirma raíz viva con su `creationTime` → `taskkill /PID <raíz> /T /F`; después termina cada PID registrado vivo con `creationTime` coincidente. | < 2 s (`[001 §7]`, `[001c §9]`: menos de 1 s) | Siempre que la fase 1 no alcanzó. |
| 3. Cierre del PTY | `pty.kill()` para liberar el pseudoconsola. **Nunca** es el mecanismo de terminación del agente (I-02). | inmediato | Siempre. |
| 4. Verificación | Instantánea: ningún `(pid, creationTime)` registrado del segmento sigue vivo. | < 1 s | Siempre. Si falla, evento `error` con los PIDs y reintento de la fase 2. |

- **Prohibido** terminar por nombre, fecha o patrón (R-14, `[001c §9]`).
- El nodo queda `cancelled` con el worktree `untrusted` y sin commit (FR-025, FR-049 de 001), igual
  que R-12. Si la cancelación llega mientras el motor está commiteando, prevalece "cancelado": el
  commit que termine no se registra como `resultCommit`, el worktree queda `untrusted` y no arranca
  ningún dependiente (caso límite de la spec).
- Los dependientes quedan `skipped` con `UPSTREAM_NOT_SUCCEEDED` (FR-024, propagación de 001).

**Cubre**: FR-024, FR-025, NFR-004, SC-005.

## R5-07 · Reapertura

**Reanudar la conversación**:

- La reapertura continúa **en la misma copia aislada** del nodo (FR-011). Es el único caso en que el
  motor relanza un agente sobre un worktree ya usado (§C, C5-03).
- El adaptador arma el relanzamiento con `buildInteractiveLaunch(spec)` más `resume: {sessionRef}`.
  El `cwd` es el mismo worktree, que es la única condición en que 001 considera confiable reanudar
  `[001 §4]` hallazgo 6, `[001c §5]` hallazgo 4, R-16.
- **Mismo perfil de lanzamiento**: el relanzamiento usa exactamente el mismo conjunto de herramientas
  y permisos que el segmento original. `[001 §4]` hallazgo 4: cambiar las herramientas al reanudar en
  Claude produjo respuestas vacías. El perfil se guarda en el segmento (hash del perfil en
  `attempts`, data-model) y se compara antes de relanzar.
- **Fork o reanudación directa**: R-16 prohíbe reanudar sin fork porque muta la sesión original
  `[001 §4]`, `[001c §5]`. Para la reapertura se prefiere el **fork** si la TUI lo ofrece: la
  conversación continúa con todo el historial y la sesión anterior queda intacta. Si la TUI solo
  ofrece reanudación directa, se permite **solo** para reabrir un nodo interactivo, porque FR-009
  garantiza un único escritor sobre esa sesión y esa copia; el lock de escritura de Codex
  `[001c §12]` no puede chocar. Lo que acepta cada TUI es `[NO VERIFICADO: U5-03, U5-08]`.
- **Si no se puede reanudar** (capacidad `none`, sesión no encontrada o el agente rechaza el id): se
  abre una conversación nueva en la misma copia, el nodo muestra `RESUME_UNAVAILABLE` y se emite el
  evento correspondiente (aclaración 2026-09-28, caso límite).

**Tiempo acumulado (FR-010)**:

- Cada segmento registra `activeMs` = tiempo con el proceso vivo, medido por el motor desde que la
  raíz queda adoptada hasta que se verifica su fin. La espera en `waiting_user` no cuenta.
- El temporizador de un segmento se arma con `remainingMs = timeoutMinutes·60 000 − Σ activeMs` de los
  segmentos anteriores del mismo NodeRun.
- Si `remainingMs ≤ 0`, la reapertura se rechaza con `REOPEN_TIME_EXHAUSTED`. Un nodo que terminó por
  tiempo queda así sin reapertura posible.

**Qué se puede reabrir**:

| Estado del nodo | Copia aislada | Run | ¿Reabrir? |
|---|---|---|---|
| `completed`, `blocked`, `failed` | `trusted` | `running` o `finished` | sí |
| `failed` por `TIME_LIMIT_EXCEEDED` | `trusted` | cualquiera | no (`REOPEN_TIME_EXHAUSTED`) |
| `cancelled`, `interrupted` | `untrusted` | cualquiera | no (`WORKSPACE_UNTRUSTED`, FR-011, caso límite) |
| cualquiera | cualquiera | `cancelled` o `interrupted` | no (`RUN_NOT_REOPENABLE`) |

**Resultados reemplazados y dependientes (FR-023a)**:

1. Al reabrir: el `NodeResult` vigente del nodo pasa al historial como **reemplazado** (tabla
   `node_results`, data-model §2) y el NodeRun incrementa `generation`.
2. Los dependientes **directos e indirectos** (descendientes en el DAG) que estén `running` se
   **cancelan** con la cancelación de R5-06/R-12, con motivo `UPSTREAM_REOPENED`, y su worktree queda
   `untrusted`.
3. El resultado vigente de cada descendiente terminal se marca **reemplazado** con el mismo motivo.
   Los descendientes vuelven a `pending` con `hold: RERUN_CONFIRMATION`. Una aprobación ya decidida
   también se reemplaza y vuelve a pedirse.
4. Las ramas independientes conservan sus resultados.
5. Si el run estaba `finished`, vuelve a `running` (transición nueva, data-model §3).
6. Al cerrarse otra vez el nodo:
   - si termina `completed`, el motor emite `rerun.confirmation_requested` con la lista de
     dependientes. Si el usuario confirma, se levanta el `hold` y el scheduler los ejecuta como
     intentos nuevos, en worktrees nuevos desde el nuevo `resultCommit` (R-15, R-22). Si rechaza,
     pasan a `skipped` con `RERUN_DECLINED`;
   - si termina `blocked` o `failed`, los dependientes pasan a `skipped` con
     `UPSTREAM_NOT_SUCCEEDED`, como siempre.
7. Ningún dependiente consume un resultado reemplazado: el bloque `<zeko-predecessor-results>`
   (R-23) y el `PredecessorResult` mostrado al usuario (R5-14) se arman solo con resultados vigentes.

**Cubre**: FR-010, FR-011, FR-023a, US2-3, US2-4.

## R5-08 · Resultado del nodo y commit

**Decisión**: se reutiliza `resolveNodeResult` de 001 (R-05) agregando una **capa de declaración**,
no una función nueva. Hoy la función lee `report.status` y `report.blockers` en las reglas 5 y 6
`[code: packages/core/src/result/resolve-node-result.ts]`. Esas dos reglas pasan a leer una
`Declaration` que tiene dos orígenes posibles:

- `agent_report`: el `AgentReport` de 001, con `reportState` (nodos de agente, sin cambios);
- `user` o `normal_exit`: la declaración de fin del nodo interactivo (`status`, `blockers: []`).

Orden resultante, con los números de FR-036 de 001 (la primera regla que coincide decide):

| # | Condición | Estado | `reason.code` | Aplica a interactivos |
|---|---|---|---|---|
| 1 | `cancelledByUser` | `cancelled` | `CANCELLED_BY_USER` | sí (FR-025) |
| 2a–2e | `killed{timeout}`, `turn_limit`, `agent_error`, `crashed`, `infra_failure`, `spawn_failed` | `failed` | los de 001 | sí; `killed{declaration}` no es fallo (FR-019) |
| 3 | `reportState ∈ {absent, invalid}` | `failed` | `REPORT_MISSING` / `REPORT_INVALID` | **no**: solo con origen `agent_report`. La falta de recap no falla el nodo (FR-018) |
| 4a | denegaciones informadas | `blocked` | `ACTION_DENIED` | no aplica: en modo interactivo `reportsDenials = false` (R5-02) |
| 4b | `scopeViolations` | `blocked` | `WRITE_OUTSIDE_SCOPE` | **sí**, con cualquier declaración (FR-020, US2-10) |
| 5a | declaración `FAILED` | `failed` | `AGENT_REPORTED_FAILED` o `USER_DECLARED_FAILED` según el origen | sí |
| 5b | declaración `BLOCKED` | `blocked` | `AGENT_REPORTED_BLOCKED` o `USER_DECLARED_BLOCKED` | sí |
| 6 | declaración `COMPLETED` con `blockers` | `blocked` | `REPORTED_COMPLETED_WITH_BLOCKERS` | no aplica (`blockers` vacío) |
| 7 | resto | `completed` | — | sí |

Calculado aparte, sin cambiar el estado (FR-021): si el nodo tiene `requiresChanges = true`, la
declaración es `COMPLETED` y `observedFiles` está vacío, el resultado lleva la inconsistencia
`COMPLETED_WITHOUT_CHANGES`, visible en el nodo y en el historial. Por la aclaración, la regla solo
aplica con la opción activada.

**Discrepancias (FR-020)**: el usuario no declara archivos, así que `undeclared` y
`declaredNotObserved` solo se calculan cuando existe una lista declarada (origen `agent_report`).
`scopeViolations` se calcula siempre desde git (R-07, R-10).

**Forma del resultado (FR-022, Principio VII)**: el `NodeRun` interactivo guarda la declaración, el
resumen (`{state: 'recap', text}` o `{state: 'recap_unavailable'}`), `observedFiles`,
`discrepancies`, `checks: []`, `findings: []`, `blockers: []`, estado final y motivo. El
`PredecessorResult` que reciben los dependientes y el usuario tiene la **misma forma** que el de un
nodo de agente ([contracts/ipc.md](./contracts/ipc.md#predecessorresult-de-un-nodo-interactivo)),
así que el prompt de un sucesor no agente-específico no cambia (FR-023).

**Commit (quién y cuándo)**: lo hace **el motor**, como R-15, con el mismo comando (`git add -A` con
las exclusiones de R5-05, autor `Zeko <zeko@localhost>`, `core.hooksPath` vacío, `--no-verify`):

1. después de que el segmento terminó **y** el supervisor verificó que no queda ningún proceso del
   árbol (R5-06 fase 4);
2. si el resultado no es `cancelled` ni `interrupted` (esos casos no commitean, R-15);
3. antes de `resolveNodeResult`, porque `observedFiles` sale del diff `baseCommit..resultCommit`
   (R-07). Con reaperturas, el commit nuevo va **encima** del anterior y el diff se sigue calculando
   desde la base del nodo, así que `observedFiles` es acumulado.

**Cubre**: FR-018–023, US2-1, US2-8–11, SC-006.

## R5-09 · Interrupción al cerrar la app

Se reutiliza R-20 sin cambiar su mecanismo:

- **Cierre ordenado**: `before-quit` → `shutdown` al engine host `[code: apps/desktop/src/main/engine-host-lifecycle.ts:31-48]`.
  El motor termina cada sesión con la fase 2 de R5-06 (sin fase 1), marca los nodos con sesión activa
  `interrupted`, sus worktrees `untrusted`, y el run `interrupted`. El `terminals.closeAll()` del main
  desaparece (I-02, I-06).
- **Cierre abrupto** (crash del main, del engine host o corte de energía): al arrancar el próximo
  host corre `recoverInterruptedRuns` `[code: packages/runtime/src/recovery.ts]`. Como cada segmento
  interactivo es un `attempt` con sus filas en `process_tree` (R5-06), la recuperación termina
  **solo** los `(pid, creationTime)` registrados que siguen vivos. No hace falta código nuevo de
  recuperación: solo que la adopción registre el árbol.
- **Estados**: un nodo `running` (sesión activa) pasa a `interrupted`; un nodo `waiting_user` también
  pasa a `interrupted`, igual que `waiting_approval` hoy
  `[code: packages/runtime/src/recovery.ts:44-46]` (todo estado no terminal distinto de `pending`).
  Los `pending` pasan a `skipped`.
- **Garantía de "sin procesos del agente"**: si el engine host muere, el pseudoconsola se cierra y el
  agente normalmente termina, pero no es una garantía `[NO VERIFICADO: U5-14]`. La garantía la da la
  recuperación, que usa el árbol registrado. La ventana de riesgo es entre el crash y el próximo
  arranque del host: si el main sigue vivo, lo relanza de inmediato (`engine.restart`).

**Cubre**: FR-026, US3-6, caso límite "varias sesiones activas".

## R5-10 · Tensión con el Principio IV y enmienda propuesta

**Tensión**: el Principio IV dice "Todo flujo ejecutable desde el canvas MUST poder ejecutarse desde
la CLI de Zeko". FR-029 exige que la CLI **rechace** los flujos con nodos interactivos. No hay forma
de cumplir las dos: un nodo interactivo necesita un humano en una terminal gráfica, y la CLI de 001
solo tiene TTY para aprobaciones (contracts/cli.md de 001).

**Lo que sí se conserva del principio**: el motor sigue siendo headless. Todas las reglas del nodo
interactivo (validación, estados, tiempo, declaración, resultado, reapertura) viven en `core` y se
prueban sin UI; la CLI usa el mismo `runtime` y detecta el nodo con la misma validación. Lo único que
falta en la CLI es la superficie de terminal.

**Enmienda propuesta** (se aplica con `/speckit-constitution` **antes** de `/speckit-tasks`):

> ### IV. Núcleo headless
>
> - El motor de orquestación MUST ser independiente de la interfaz.
> - Todo flujo ejecutable desde el canvas MUST poder ejecutarse desde la CLI de Zeko, **salvo los
>   flujos que contienen nodos cuya definición exige interacción directa del usuario con un agente
>   en una terminal (nodos interactivos). La CLI MUST rechazar esos flujos durante la validación,
>   antes de iniciar el run, e identificar los nodos que requieren interfaz.**
> - **Las reglas de esos nodos (validación, estados, límites, resultado) MUST vivir en el núcleo
>   headless igual que las demás; solo la superficie de interacción puede depender de la interfaz.**
> - La UI MUST NOT contener reglas de negocio, de orquestación ni de seguridad.

- **Tipo de versión: MAJOR (1.0.0 → 2.0.0)**. La gobernanza define MAJOR como "redefinición
  incompatible de principios". La enmienda **quita una garantía** que alguien pudo asumir ("todo flujo
  corre en la CLI"). MINOR se descarta porque no agrega guía: restringe una existente.
- **Sync Impact Report esperado**: `plan-template.md` (el gate IV del Constitution Check agrega "o
  rechazo en CLI de nodos interactivos") y `contracts/cli.md` de 001 (el código de salida 2 incluye
  este rechazo). La spec 001 no cambia: no tiene nodos interactivos.

**Cubre**: FR-029, US3-7, Principio IV.

## R5-11 · Redacción

Se aplica el redactor de R-28 `[code: packages/storage/src/redactor.ts]` sin cambios de mecanismo:

| Dato | Cuándo se redacta | Nota |
|---|---|---|
| Recap | antes de guardarla en `node_runs` y en `node.result` | Con tope de 64 KiB (R5-04). |
| Eventos nuevos (`session.*`, `node.declared`, `node.reopened`, `rerun.*`, `node.result_superseded`) | antes de toda escritura, como todo evento (R-28) | Sus payloads no llevan texto del agente salvo la recap. |
| Resultados reemplazados (`node_results`) | ya redactados: se copian de lo persistido | |
| Lo que se muestra desde el historial | se lee de lo persistido, que ya está redactado | FR-028 "antes de guardarlo o volver a mostrarlo". |
| Contexto mostrado al abrir (FR-014/017) | se arma desde lo persistido (redactado) | Nunca desde memoria sin redactar. |
| Salida en vivo del PTY | **no se redacta ni se persiste** | Es la TUI del propio agente en vivo; redactarla la corrompería y no es "contenido persistible". El buffer de reenganche vive solo en memoria (I-11). |
| Credenciales inyectadas (`CODEX_API_KEY`) | `sensitiveValues` registrados en el redactor (R-28) | Igual que 001. |

La salida cruda del agente **no** se escribe en `logs/<run>/<node>-<attempt>.jsonl` para los
segmentos interactivos (§C, C5-07): sería una copia de la transcripción (FR-028).

**Cubre**: FR-028, US4-2, SC-007.

## R5-12 · Definición del nodo y validación

**Decisión**: tipo nuevo `type: interactive` en el archivo de flujo, **no** una opción del nodo
`agent`. FR-001 lo pide como tipo distinguible, y sus campos difieren: no tiene criterios de
aceptación, turnos ni reintentos, y tiene `requiresChanges`. Detalle en
[contracts/flow-file.md](./contracts/flow-file.md).

| Campo | Regla | Origen |
|---|---|---|
| `agent` | `claude-code` \| `codex`; el adaptador debe declarar `interactive.supported` | FR-002, FR-004 |
| `models` | **obligatorio** para el agente del nodo; sin él, `SCHEMA_ERROR` (no `MODEL_DEFAULTED`) | FR-002 ("modelo explícito") |
| `instructions` | opcional (puede faltar o estar vacío) | FR-002 |
| `writeScope` | mismas reglas que el nodo de agente | FR-002, FR-020 |
| `terminal` | `{enabled, allowedCommands}` igual que el nodo de agente; es la restricción de herramientas y comandos de FR-016 | FR-016 |
| `requiresChanges` | booleano, `false` por defecto | FR-021, aclaración 2026-09-28 |
| `limits.timeoutMinutes` | obligatorio, 1..1440 | FR-002, FR-010 |

- **Linaje (R-22)**: `codeSource(interactive)` = `{n}` si `writeScope ≠ []`, si no `∅`, igual que un
  nodo de agente. `MULTIPLE_CODE_SOURCES` aplica igual (caso límite "estados de código
  incompatibles").
- **Por qué el modelo es obligatorio aquí y no en el nodo de agente**: FR-011a de 001 permite el
  default del proyecto con advertencia; FR-002 de 005 dice "modelo explícito" sin esa salvedad. El
  editor lo copia del default del proyecto al crear el nodo, como en 001.
- **Validación por contexto (FR-029)**: `validateFlow` recibe `host: 'desktop' | 'cli'`. En `cli`,
  cada nodo interactivo produce el error `INTERACTIVE_NODE_REQUIRES_DESKTOP` con su `nodeId`, esté
  donde esté en el grafo (caso límite "rama posterior"). En `desktop` no hay error. Es la misma
  función para los dos hosts (Principio IV).

**Cubre**: FR-001–004, FR-029.

## R5-13 · Scheduling, espera y notificación

- **Estado nuevo `waiting_user`** (no terminal). Cuando los predecesores de un nodo interactivo
  terminan `completed` o `approved`, el scheduler (función pura `nextActions`, R-17) emite
  `await_user` en lugar de `run_agent`, y el nodo pasa a `waiting_user` (FR-005). Iniciar el run
  **nunca** lanza la sesión (FR-006, NFR-006).
- **Sin slot de concurrencia**: una sesión interactiva no toma un lease de `concurrencyLimit` (R-21).
  NFR-003 cuenta 4 sesiones interactivas **además** de 8 nodos no interactivos, así que el límite
  global de 8 no puede incluirlas. No hay tope propio de sesiones: cada una requiere una acción
  explícita del usuario y FR-009 fija solo un mínimo de 4.
- **Retención por uso (FR-053 de 001)**: no aplica a la apertura, que es una acción explícita del
  usuario. Si la última lectura de uso del agente supera el umbral, la vista del nodo lo muestra como
  advertencia. Los nodos no interactivos siguen su regla.
- **Espera sin límite de tiempo**: el tiempo en `waiting_user` no consume el límite del nodo (FR-010,
  US3-3). El run puede quedar esperando indefinidamente, igual que con `waiting_approval` en 001. El
  usuario puede cancelar el nodo o el run (§T, T5-05).
- **Notificación (FR-005, NFR-005)**: el motor emite `node.state` con `waiting_user` de inmediato
  (NFR-003 de 001). El renderer muestra el estado y la acción "Abrir sesión" en el nodo sin menús
  (NFR-005) y, si la ventana no tiene foco, una notificación del sistema con la API web
  `Notification` del renderer. La notificación es presentación: no decide nada.
- **Ramas independientes** siguen ejecutándose y los dependientes esperan (FR-024, US3-1): no
  requiere cambios, porque `nextActions` solo habilita nodos cuyos predecesores están `completed` o
  `approved`.
- **Abrir antes de tiempo** (caso límite): `session.open` sobre un nodo `pending` responde
  `NODE_NOT_READY` con la lista de predecesores que faltan.

**Cubre**: FR-005, FR-006, FR-024, NFR-003, NFR-005, US1-2, US3-1, US3-3.

## R5-14 · Contexto mostrado y declaración de fin

**Contexto (FR-013, FR-014, FR-017)**:

- Al abrir la sesión, el motor entrega a la vista un `NodeContext`: las instrucciones iniciales del
  nodo y los `PredecessorResult[]` **vigentes** de sus predecesores (declaración, estado final,
  motivo, archivos observados, verificaciones, hallazgos, bloqueos, resumen o recap). Se arma desde
  lo persistido y redactado (R5-11).
- Nada de eso se escribe en el PTY (FR-017, NFR-006). El panel ofrece "Copiar" por bloque (I-10): el
  usuario pega con su propia acción.
- Se muestra como **datos**, igual que R-23: ningún campo cambia permisos, aprobaciones ni la
  orquestación (FR-014).

**Declaración de fin (FR-018, aclaración 2026-09-28)**:

1. `node.declareEnd {status}` solo se acepta con la sesión **activa**. Con la sesión ya terminada
   (salida normal, corte, tiempo), se rechaza con `SESSION_NOT_ACTIVE` y la regla 2 decide (R5-03).
2. El motor consulta `interactive.busyDetection` del adaptador:
   - si el agente **no** está respondiendo, cierra el agente (fase 2 de R5-06 con `by: declaration`,
     o la fase 1 si está verificada), registra la declaración y sigue con R5-08;
   - si **está** respondiendo, responde `AGENT_RESPONDING` y la vista ofrece "Cerrar ahora" o
     "Esperar a que termine". Con "esperar", el motor cierra cuando el adaptador informa el fin del
     turno (el temporizador del nodo sigue corriendo);
   - si la detección no está disponible (valor conservador), el motor responde siempre
     `CONFIRM_CLOSE`: la vista pide confirmar el cierre inmediato y avisa que la última respuesta
     podría quedar incompleta. No se ofrece "esperar" porque no hay señal de fin de turno.
3. La recap es la última respuesta **completa** antes del cierre (R5-04).

**Cubre**: FR-013, FR-014, FR-017, FR-018, US1-9, US2-7, casos límite.

## R5-15 · Estrategia de tests

Extiende R-26 sin llamar a proveedores reales (Principio XVI):

- **Unit (core)**: `resolveNodeResult` con la capa de declaración (un caso por fila de R5-08 más la
  precedencia "corte antes de declaración" y `COMPLETED_WITHOUT_CHANGES` con y sin
  `requiresChanges`); máquinas de estado nuevas (`waiting_user`, reapertura, `finished → running`,
  `RERUN_CONFIRMATION`); invalidación transitiva de dependientes con ramas independientes intactas;
  tiempo acumulado y `REOPEN_TIME_EXHAUSTED`; validación `INTERACTIVE_NODE_REQUIRES_DESKTOP` en `cli`
  y no en `desktop`; confinamiento interactivo derivado solo de capacidades.
- **Adaptadores**: `buildInteractiveLaunch` y `classifyInteractiveExit` son funciones puras con
  snapshots de argumentos por agente y plataforma (reemplaza I-16). `readRecap` se prueba contra
  fixtures: para Codex, los `task_complete` reales de `[sample: 001c/q4-termination.json]`; para
  Claude, fixtures que se agregan cuando 005a capture un archivo de sesión real (redactado).
- **Agente interactivo simulado** (`packages/adapters/test/fake-agent`, modo `interactive`): un
  ejecutable Node que lee del TTY en modo raw, hace eco inmediato, sale con un código configurable,
  escribe un archivo de sesión simulado con una recap y puede lanzar nietos `cmd.exe → powershell.exe`
  para reproducir el árbol de `[001 §7]`.
- **Integración Windows** (`pnpm test:win`), siempre verificando procesos y filesystem, nunca lo que
  diga el agente `[001b §B]`:
  - cancelación: ningún `(pid, creationTime)` del segmento vivo en < 10 s y el archivo del nieto deja
    de crecer (SC-005);
  - aislamiento: hash del árbol, `HEAD` y `status --porcelain` del repositorio original iguales antes
    y después (SC-006);
  - interrupción: matar el engine host con sesiones activas y verificar `interrupted`, `untrusted` y
    cero procesos tras la recuperación (FR-026);
  - latencia: la medición de R5-01 con 4 sesiones y 8 nodos simulados (SC-003, SC-004).

---

## §C · Cambios explícitos a 001

| ID | Qué cambia de 001 | Motivo |
|---|---|---|
| C5-01 | **R-25**: "no se usa `node-pty`; las terminales interactivas están fuera de alcance". Pasa a: `node-pty` se usa **solo** en el engine host de escritorio para nodos interactivos. La salida de nodos no interactivos sigue sin pty. | FR-007 de 005. `node-pty` está en el stack de la constitución, así que no requiere justificación. |
| C5-02 | **R-16**: "nunca se reanuda sin fork". Pasa a: la reapertura de un nodo interactivo prefiere fork; si la TUI solo ofrece reanudación directa, se permite **solo** ahí, en el mismo worktree y con escritor único (R5-07). | FR-011 y aclaración 2026-09-28 (retomar la conversación). |
| C5-03 | **R-15**: "una copia por nodo y por intento". Pasa a: un nodo interactivo tiene **una** copia por NodeRun, compartida por todos sus segmentos (aperturas y reaperturas). | FR-011: la reapertura continúa en la misma copia. |
| C5-04 | **data-model §3**: se agrega `waiting_user` a `NodeStatus`, las transiciones de reapertura y `finished → running` en `RunStatus`; se agrega `RERUN_CONFIRMATION` a `hold`. | FR-005, FR-023a. Ver [data-model.md](./data-model.md). |
| C5-05 | **R-05 / `resolveNodeResult`**: las reglas 5 y 6 leen una `Declaration` con origen (`agent_report`, `user`, `normal_exit`); la regla 3 aplica solo al origen `agent_report`. Sin reglas duplicadas. | FR-019, FR-022 (R5-08). |
| C5-06 | **R-20**: sin cambio de mecanismo; `waiting_user` se trata como `waiting_approval`. | FR-026 (R5-09). |
| C5-07 | **R-28 / logs crudos**: los segmentos interactivos **no** escriben `logs/<run>/<node>-<attempt>.jsonl`. | FR-028: sería una copia de la transcripción. |
| C5-08 | **R-21**: las sesiones interactivas no toman lease de `concurrencyLimit`. | NFR-003 (R5-13). |
| C5-09 | **contracts/cli.md**: el código de salida 2 incluye `INTERACTIVE_NODE_REQUIRES_DESKTOP`. | FR-029 (R5-10). |
| C5-10 | **contracts/ipc.md**: un segundo `MessagePort` (terminal) creado por el main junto al de control; el main sigue sin reenviar mensajes. | NFR-002 (R5-01). |
| C5-11 | **contracts/adapter.md**: bloque `interactive` en `AgentCapabilities`; operaciones puras `buildInteractiveLaunch`, `classifyInteractiveExit`, `readRecap`, `locateSession`, `isBusy?`; `killed.by` admite `declaration`; supervisor con `adopt(pid)`. | R5-02–R5-06. |
| C5-12 | **R-10 (Claude)**: el nodo interactivo no usa `--permission-mode acceptEdits`; las solicitudes las responde el usuario. | FR-007, FR-016. |
| C5-13 | **Implementación de escritorio**: se eliminan `PtyManager` del main, el selector de `kind`, la terminal `shell` y la terminal de agente en modo edición (§I). | I-01–I-10. |

## §T · Tensiones con la constitución y con la spec

| ID | Tensión | Resolución |
|---|---|---|
| T5-01 | **Principio IV** frente a FR-029. | Enmienda MAJOR propuesta en R5-10, a aplicar antes de `/speckit-tasks`. Mientras tanto, Complexity Tracking del plan. |
| T5-02 | **Principio VI** (MCP como canal agente ↔ Zeko). El nodo interactivo no tiene ningún canal estructurado con el agente: la declaración viene del usuario y la recap de un archivo del agente. | Continúa T-09 de 001. La aclaración del 2026-09-28 deja el resultado estructurado por MCP fuera de alcance. Complexity Tracking. |
| T5-03 | **Principio IX** (acciones fuera de alcance requieren aprobación). En la TUI el usuario aprueba o rechaza, que es más cercano al principio que 001. Pero la shell de Claude sigue sin confinar `[001b §B2]`, y si una aprobación puede levantar un límite duro (U5-02, U5-06) la acción ocurre con aprobación humana pero fuera del alcance del nodo. | Se muestra como restricción no admitida (FR-016) y la escritura fuera de alcance deja el nodo `blocked` (FR-020). Complexity Tracking, igual que 001. |
| T5-04 | **Principio X**: "una instrucción directa del usuario a un agente MUST notificarse al orquestador". FR-028 prohíbe guardar la transcripción, así que Zeko no conoce el contenido de lo que el usuario escribe. | Lo que se notifica es **que** hubo instrucciones directas: eventos `session.opened/closed`, la declaración y la recap. El orquestador no revierte nada de la sesión: por eso R5-05 excluye en lugar de revertir. Se registra como interpretación, sin cambio constitucional. |
| T5-05 | **Principio XI** (todo run con límites de tiempo). La espera en `waiting_user` no tiene límite (FR-010, US3-3). | Igual que `waiting_approval` en 001: el tiempo de ejecución del agente sí es finito y obligatorio (FR-010); la espera no consume recursos y se puede cancelar. |
| T5-06 | **Principio XIII** (estados visibles `idle/running/waiting approval/failed/done`). | `waiting_user` se mapea a "waiting approval" (espera de intervención humana), como `waiting_approval` en data-model §3 de 001. |
| T5-07 | **FR-016 / FR-015** frente a la falta de evidencia interactiva. | Hasta 005a, valores conservadores: todo nodo interactivo `unconfined` con `INTERACTIVE_CONFINEMENT_UNVERIFIED`. El plan no promete confinamiento en la TUI. |
| T5-08 | **FR-011** (salida normal → completado) frente a U5-04/U5-07. | Hasta verificar los códigos, toda salida sin declaración es `crashed` (R5-03). US2-2 queda bloqueado por la compuerta 005a, no el resto de la feature. |
| T5-09 | **FR-027** pide el costo "si el agente lo informó". En modo interactivo no hay evento `result` `[001 §3]`. | Costo "no disponible" hasta U5-03 (Claude). Para Codex, consumo y uso de la suscripción del rollout si U5-08 lo confirma; costo en dinero ausente como en 001 `[001c §11]`. |

## §U · Supuestos no verificados

Cada fila se cierra con la pregunta de 005a indicada (§S). Ninguno bloquea el plan; bloquean las
tareas marcadas en la columna "Bloquea".

| ID | Supuesto | Afecta | Pregunta 005a | Bloquea |
|---|---|---|---|---|
| U5-01 | La TUI de Claude acepta `--model`, `--strict-mcp-config`, `--restricted`, `--tools` y `--allowedTools` con el mismo efecto que en print. | R5-02 | Q1 | Adaptador Claude interactivo (args) |
| U5-02 | En la TUI de Claude, una aprobación del usuario no levanta `--restricted` ni agrega herramientas quitadas con `--tools`. | R5-02, FR-016 | Q2 | Declarar `confinement.fileTools = full` y `approvalCanWiden = false` para Claude |
| U5-03 | Claude: `--session-id` en la TUI; ruta y formato del archivo de sesión; último mensaje del asistente; costo o consumo en ese archivo; reanudación (`--resume`, `--fork-session`) en la TUI desde el mismo `cwd`. | R5-04, R5-07 | Q3 | `readRecap` y `resume` de Claude |
| U5-04 | Claude: código de salida de una salida normal (`/exit`, Ctrl+D, doble Ctrl+C), de un crash y de un fallo de autenticación en la TUI. | R5-03 | Q4 | `normalExit` de Claude (US2-2) |
| U5-04b | Claude: dónde persiste "permitir siempre" en la TUI con `--restricted`, y si una regla persistida en el worktree se carga en un relanzamiento con `--restricted`. | R5-05 | Q5 | `permissionPersistencePaths` de Claude |
| U5-05 | La TUI de Codex acepta `-m`, `-c model_reasoning_effort`, `-s workspace-write`, `-c windows.sandbox`, los `exclude_*`, los `--disable`, `web_search="disabled"`, `--ignore-user-config` e `--ignore-rules`. | R5-02 | Q6 | Adaptador Codex interactivo (args) |
| U5-06 | En la TUI de Codex, qué política de aprobación permite responder solicitudes sin que una aprobación ejecute fuera del sandbox `workspace-write`. | R5-02, FR-016 | Q7 | Declarar `confinement.shell = write_only` y `approvalCanWiden = false` para Codex |
| U5-07 | Codex: código de salida normal, crash y fallo de autenticación en la TUI. | R5-03 | Q8 | `normalExit` de Codex (US2-2) |
| U5-08 | Codex: la TUI escribe el rollout con `turn_context.cwd`, `task_complete.last_agent_message` y `token_count`; reanudación o fork en la TUI desde el mismo `cwd`. | R5-04, R5-07 | Q9 | `readRecap`, `locateSession` y `resume` de Codex |
| U5-09 | Una secuencia de teclas escrita en el PTY hace que cada TUI salga de forma ordenada en ≤ 3 s y deja el archivo de sesión completo. | R5-06 | Q10 | Fase 1 de la cancelación (la fase 2 no se bloquea) |
| U5-10 | `node-pty` con `useConptyDll` carga y funciona en un `utilityProcess` empaquetado. | R5-01 | Q11 | Mudanza del PTY al engine host |
| U5-11 | Codex: dónde persiste una aprobación "para la sesión" o "siempre" en la TUI. | R5-05 | Q12 | `permissionPersistencePaths` de Codex |
| U5-12 | Bajo `node-pty` + ConPTY: `pty.pid` es el PID del agente; árbol real de cada agente; `OpenConsole.exe` no es descendiente del agente; `taskkill /T /F` del agente no deja huérfanos ni afecta al engine host; el código de salida de `onExit` es el del agente. | R5-03, R5-06 | Q13 | Adopción del supervisor y verificación de cancelación |
| U5-13 | Existe una señal estructurada (archivo de sesión) de "turno en curso" para cada agente. | R5-14 | Q14 | Opción "Esperar a que termine" (sin ella se pide siempre confirmación) |
| U5-14 | Si el engine host muere, el agente bajo ConPTY termina solo. | R5-09 | Q15 | Nada: la recuperación ya lo cubre. Solo informa la ventana de riesgo. |

## §S · Mini-spike 005a (propuesto)

**Ubicación**: `spikes/005a-interactive-agents/`, con `FINDINGS.md` y `samples/` como los spikes
anteriores. **Entorno**: solo Windows nativo (10 u 11), sin WSL; Claude Code y Codex en las versiones
instaladas, registradas en el encabezado. **Método** (igual que 001b y 001c):

- se verifica en la **tabla de procesos** y en el **filesystem**, nunca por lo que diga el agente;
- la TUI se maneja desde un harness con `node-pty` y `useConptyDll: true`, como hará Zeko;
- cada caso de confinamiento se repite al menos 2 veces, con token aleatorio en `outside/`;
- los samples se redactan (email, `account_id`, tokens) antes de versionarse (R-28);
- el harness no mata procesos por nombre ni por fecha (R-14): solo el árbol que lanzó.

**Preguntas**:

| # | Pregunta | Verificación |
|---|---|---|
| Q1 | ¿La TUI de Claude arranca con `--model X --strict-mcp-config --restricted --tools "Read,Write,Edit,Glob,Grep" --allowedTools "Read Glob Grep"` (y variantes con `PowerShell`) sin error, y con esos efectos? | Proceso vivo tras 5 s; `/status` o el archivo de sesión muestran el modelo; herramienta quitada ausente (pedir usarla y verificar en fs que no ocurrió). |
| Q2 | Con `--restricted`, ¿aprobar en la TUI una escritura o lectura fuera del `cwd` (ruta absoluta, `..`, junction) la permite? ¿Aprobar una herramienta quitada con `--tools` la habilita? | Archivo en `outside/` creado o no; token de `outside/secreto.txt` presente o no en la respuesta visible y en el archivo de sesión. |
| Q3 | ¿`--session-id <uuid>` funciona en la TUI? ¿Dónde queda el archivo de sesión, en qué formato, y cómo se identifica el último mensaje completo del asistente? ¿Trae costo o tokens? ¿`--resume <id>` (con y sin `--fork-session`) desde el mismo `cwd` y los mismos flags retoma la conversación en la TUI? | Archivo en disco (ruta, líneas antes y después del resume); el agente reanudado responde un dato que solo está en el historial. |
| Q4 | Códigos de salida de Claude en la TUI: `/exit`, Ctrl+D, doble Ctrl+C, proceso matado, y sin autenticación (`CLAUDE_CONFIG_DIR` vacío o equivalente aislado). | `onExit` de node-pty y `GetExitCodeProcess` comparados. |
| Q5 | En la TUI de Claude con `--restricted`, ¿qué opciones ofrece una solicitud de permiso y dónde se persiste "no volver a preguntar"? ¿Se carga en un relanzamiento con los mismos flags? | Diff del worktree y de la configuración del usuario antes y después; comportamiento del relanzamiento. |
| Q6 | ¿La TUI de Codex acepta los flags de U5-05? ¿`--ignore-user-config` evita hooks y MCP del usuario también en la TUI? | Exit y stderr al arrancar; `turn_context` del rollout; marca de hook como en `[001c §10]`. |
| Q7 | En la TUI de Codex con `-s workspace-write`, ¿qué políticas de aprobación existen y cuál permite responder solicitudes sin que aprobar ejecute fuera del sandbox? Repetir la matriz de escritura de `[001c §8]` aprobando cada solicitud. | Filesystem, como `[001c §8]`. |
| Q8 | Códigos de salida de Codex en la TUI: salida normal (comando de salida y Ctrl+C/Ctrl+D), proceso matado y sin autenticación (`CODEX_HOME` vacío). | Igual que Q4. |
| Q9 | ¿La TUI de Codex escribe el rollout con `turn_context.cwd`, `task_complete.last_agent_message` y `token_count.rate_limits`? ¿Cómo se reanuda o se hace fork en la TUI desde el mismo `cwd`, y el original queda intacto? | Rollout en disco (sha256 antes y después, como `[001c §5]`). |
| Q10 | ¿Qué secuencia escrita en el PTY hace salir a cada TUI de forma ordenada, en cuánto tiempo, y el archivo de sesión queda completo? | Tiempo hasta `onExit`; archivo parseable. |
| Q11 | ¿`node-pty` con `useConptyDll` carga en un `utilityProcess` de la app empaquetada y lanza un proceso? | Test de humo del engine host empaquetado, como el de U-01. |
| Q12 | En la TUI de Codex, ¿dónde persiste una aprobación "para la sesión" o "siempre"? | Diff del worktree y de `$CODEX_HOME` antes y después. |
| Q13 | Árbol real bajo node-pty + ConPTY para cada agente con un comando de shell en curso: ¿`pty.pid` es el agente? ¿Dónde cuelga `OpenConsole.exe`? ¿`taskkill /PID <agente> /T /F` deja huérfanos o afecta al harness? | Instantáneas `Win32_Process` antes, durante y después; archivo del nieto deja de crecer. |
| Q14 | ¿El archivo de sesión de cada agente permite saber si hay un turno en curso (por ejemplo, turno iniciado sin `task_complete`)? | Leer el archivo durante una respuesta larga y después. |
| Q15 | Si se mata el proceso dueño del PTY (el harness), ¿el agente termina solo? ¿En cuánto tiempo? | Tabla de procesos durante 30 s. |

**Compuerta**: 005a bloquea **solo** las tareas de la columna "Bloquea" de §U. Pueden avanzar antes:
contratos, schemas, validación (incluida FR-029), estados y transiciones, `resolveNodeResult` con la
capa de declaración, invalidación y reejecución de dependientes, tiempo acumulado, eventos,
redacción, la mudanza del transporte de terminal al engine host con el agente simulado, la UI y el
retiro de §I. Con los valores conservadores de R5-02 la feature es funcional y segura, pero no
cumple US2-2 (salida normal → completado), la recap, la reanudación ni el confinamiento mostrado
hasta cerrar 005a.
