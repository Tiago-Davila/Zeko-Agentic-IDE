# Research: Nodos interactivos de agente (005)

**Fecha**: 2026-09-28 | **Actualizado**: 2026-10-16 (comunicación entre agentes: R5-16…R5-23) |
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

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
| `[claude-docs]`, `[codex-docs]`, `[mcp]` | Comportamiento **documentado** por el agente o por la especificación MCP (hooks, `--settings`, `--mcp-config`, `notify`, `mcp_servers`). Documentado no es verificado: si el plan depende de él en la TUI bajo Windows, también figura en §U. |
| `[ref-nodeterm: ruta]` | Diseño observado en `eneskirca/nodeterm` (commit `9ec04ca`, v0.4.4), leído en esta planificación como **referencia de diseño**. Licencia BUSL-1.1: no se copia código (Principio XIV, T5-14). Describe qué hace nodeterm, no qué hace un agente ni Zeko. |

**Regla de esta feature**: ningún spike ejercitó Claude Code ni Codex en modo interactivo (TUI dentro
de un PTY). Todo lo que este documento dice sobre ese modo es `[NO VERIFICADO]` salvo que cite un
hallazgo que no dependa del modo, por ejemplo la forma del rollout de Codex o el árbol de procesos
de `codex.exe`. Lo mismo vale para los hooks, `notify` y los servidores MCP de las decisiones
R5-16…R5-23: están documentados por cada agente, pero ningún spike los ejercitó en la TUI bajo
Windows.

**Origen de R5-16…R5-23**: el rumbo de comunicación entre agentes toma como referencia de diseño el
análisis de `eneskirca/nodeterm` (`[ref-nodeterm]`), que resuelve el mismo problema sobre tmux en
macOS/Linux. Zeko lo adapta a sus restricciones: Windows nativo sin tmux, PTY propio en el engine
host (R5-01), MCP como canal agente ↔ Zeko (Principio VI) y flujos como archivos (Principio V).

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
| R5-16 | Puente agente ↔ Zeko: servidor local en el engine host, ejecutable `zeko-bridge` como cliente (hooks y MCP), credencial por sesión | FR-030, FR-033, FR-055, NFR-008, NFR-009, Principio VI |
| R5-17 | Actividad del agente desde hooks y archivos de sesión, normalizada por el adaptador | FR-030, FR-031, US1-10; mejora R5-04, R5-14 |
| R5-18 | Herramientas MCP de Zeko: catálogo, permisos por nodo y registro en el lanzamiento | FR-033, FR-037, FR-045, FR-050, NFR-006 |
| R5-19 | Enlaces de contexto y lectura bajo demanda | FR-032–035, US4, NFR-010 |
| R5-20 | Mensajes: compuertas, marco, escritura en el PTY, acuse, cola y límites | FR-036–043, US5, NFR-007, SC-008 |
| R5-21 | Orquestación: lotes, validación, confirmación, hijos como NodeRuns y fin del orquestador | FR-044–054, US6, SC-009, SC-010 |
| R5-22 | Archivos: aislamiento sin locks, instantánea del orquestador, integración por el agente y rutas compartidas | FR-049, FR-051, FR-056, SC-006, SC-010, Principio VIII |
| R5-23 | Modelo de amenazas del canal entre agentes | FR-014, FR-039, FR-043, FR-055, NFR-006, SC-007, SC-011 |

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
| Claude Code | `--model <m> --strict-mcp-config --mcp-config <archivo del puente> --settings <archivo de hooks de la sesión> --restricted --tools <set> --allowedTools <reglas, + mcp__zeko__*>` y, si se confirma, `--session-id <uuid>` | R-08, R-10; `[001 §1, §6]`, `[001b §B1]`; `--settings`, `--mcp-config` `[claude-docs]` (R5-16, R5-17, R5-18) | `-p`, `--output-format`, `--verbose`, `--input-format`, `--json-schema`, `--max-turns`, `--permission-mode acceptEdits` (en la TUI el usuario responde las solicitudes; FR-007) | U5-01, U5-02, U5-03, U5-15, U5-17 |
| Codex | `-m <m> -c model_reasoning_effort="<e>" -s workspace-write -c windows.sandbox="<modo>" -c sandbox_workspace_write.exclude_tmpdir_env_var=true -c sandbox_workspace_write.exclude_slash_tmp=true --disable apps --disable plugins --disable image_generation --disable multi_agent --disable goals --disable browser_use --disable computer_use -c web_search="disabled"`, `-c mcp_servers.zeko.command=<zeko-bridge> -c mcp_servers.zeko.args=["mcp"]`, `-c notify=[<zeko-bridge>,"hook","codex"]` y, si la TUI los acepta, `--ignore-user-config --ignore-rules` | R-13; `[001c §1, §4, §7, §8, §10]`; `mcp_servers`, `notify` `[codex-docs]` (R5-17, R5-18) | `exec`, `--json`, `--output-schema`, `-` (stdin) | U5-05, U5-06, U5-16, U5-18 |

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
| `activitySource` (R5-17) | hooks por `--settings` `[claude-docs]` `[NO VERIFICADO: U5-15]` | `notify` al fin de turno `[codex-docs]` + eventos del rollout `[NO VERIFICADO: U5-16]` | `none` → actividad `unknown`: sin mensajes entregados, cierre siempre con confirmación |
| `zekoTools` (R5-18) | servidor MCP stdio por `--mcp-config` con `--strict-mcp-config` `[claude-docs]` `[NO VERIFICADO: U5-17]` | `mcp_servers` por `-c` `[codex-docs]`, compatible o no con `--ignore-user-config` `[NO VERIFICADO: U5-18]` | `false` → sin lectura, mensajes ni orquestación para ese agente (el nodo lo muestra) |
| `messaging.input` (R5-20) | bracketed paste si la TUI activa `DECSET 2004`, Enter aparte tras `submitDelayMs` `[NO VERIFICADO: U5-19]` | ídem `[NO VERIFICADO: U5-19]` | `none` → el nodo no puede ser destino de mensajes ni de avisos (solo se muestran en el nodo) |

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

- **Fuente preferida desde 2026-10-16: el aviso de actividad (R5-17).** El primer hook de Claude
  (`SessionStart`) trae `session_id` y `transcript_path` `[claude-docs]`, y el `notify` de Codex al fin
  de turno trae el `thread-id` y el último mensaje del asistente `[codex-docs]`. Si llegan con la
  credencial de la sesión (R5-16), el motor los guarda como `SessionRef` y ya no necesita buscar. La
  ruta del transcript se valida: tiene que estar dentro del directorio de sesiones del agente
  (`~/.claude/projects/`, `$CODEX_HOME/sessions/`), si no se descarta (R5-23). Los mecanismos de abajo
  quedan como respaldo cuando el agente no emite avisos.
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
| `orchestration` | opcional; `enabled: false` por defecto; reglas en R5-21 | FR-044 |
| (flujo) `communication` y `links` | nivel de flujo; `messaging: false` por defecto; enlaces con mensajes solo entre nodos `interactive` (`MESSAGING_LINK_NOT_INTERACTIVE`) | FR-032, FR-036 |

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
  usuario pega con su propia acción. Desde 2026-10-16, además, el agente puede **pedirlo** con la
  herramienta `zeko_get_context` (R5-18, R5-19): es lectura a pedido, no una escritura de Zeko.
- Se muestra como **datos**, igual que R-23: ningún campo cambia permisos, aprobaciones ni la
  orquestación (FR-014).

**Declaración de fin (FR-018, aclaración 2026-09-28)**:

1. `node.declareEnd {status}` solo se acepta con la sesión **activa**. Con la sesión ya terminada
   (salida normal, corte, tiempo), se rechaza con `SESSION_NOT_ACTIVE` y la regla 2 decide (R5-03).
2. El motor consulta la **actividad** del agente (R5-17): `working` o `waiting_permission` = está
   respondiendo; `waiting_input` = no; `unknown` = no se sabe. Si el adaptador no tiene
   `activitySource`, cae en `interactive.busyDetection` (archivo de sesión) como antes:
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
- **Comunicación (R5-16…R5-23)**, agregado el 2026-10-16:
  - el agente simulado interactivo gana un modo `bridge`. Emite avisos de actividad con
    `zeko-bridge hook fake` en los momentos del guion (`session_started`, `turn_started`,
    `permission_requested`, `turn_ended`), es cliente MCP de `zeko-bridge mcp` para llamar
    herramientas desde el guion, activa y desactiva `DECSET 2004` y registra en un archivo cada
    entrada recibida, separando lo que llegó dentro de un bracketed paste;
  - unit de `core`: `reduceActivity` (cada transición, `unknown` sin avisos verificados, rescate solo
    desde `working`); `decideDelivery` (un caso por compuerta, en orden, y que las compuertas de
    permiso no consumen presupuesto); `reserveFlow` con envíos paralelos; cola (capacidad,
    vencimiento, una entrega por ciclo, misma sesión); `resolveLinks` (declarados, implícitos,
    dirección); `validateSpawnBatch` (contención de alcances con casos que no se pueden probar,
    ciclos, límites, máximo de hijos, superposición); `authorizeTool` por configuración del nodo;
  - propiedades: el saneador nunca deja pasar `ESC`, C0 salvo `\n`/`\t`, ni C1; los campos de una
    sola línea nunca contienen saltos de línea; un cuerpo que contiene un marco completo con otra
    marca no coincide con la expresión del marco de la entrega;
  - puente: credencial ausente, falsificada, de otra sesión o de un segmento cerrado → rechazo sin
    efecto (SC-011); pedidos de más de 1 MiB o lentos → corte;
  - git (integración Windows): la instantánea no cambia `HEAD`, el índice, la rama ni el árbol del
    orquestador (SC-010); borrar un worktree con una ruta compartida (junction) deja intacto el
    destino del junction;
  - punta a punta con el agente simulado: entrega con destino esperando, cola con destino
    trabajando, cola con texto del usuario sin enviar, acuse y «entregado sin acuse», lote
    rechazado sin creación (SC-009) y lote confirmado con dependencia entre hijos.

---

## R5-16 · Puente agente ↔ Zeko

**Problema**: los avisos de actividad (R5-17) y las herramientas de Zeko (R5-18) necesitan que un
proceso lanzado por el agente hable con el motor. El agente no sabe nada de Zeko, corre en Windows
sin garantía de tener Node, curl o una shell POSIX en el `PATH`, y no se puede modificar
(NFR-009).

**Decisión**:

- **Servidor**: un `BridgeServer` en el engine host (`apps/desktop/src/engine-host/bridge/`), el
  mismo proceso que el motor y los PTY (R5-01). Escucha en un **named pipe** de Windows
  `\\.\pipe\zeko-bridge-<instalación>-<pid del host>` con ACL solo para el usuario actual (en Linux,
  un socket Unix en `userData` con modo `0600`). **No** escucha en TCP. Un único servidor atiende
  avisos y herramientas, con una sola compuerta de identidad, igual que el hook server de nodeterm
  `[ref-nodeterm: src/core/agents/hook-server.ts]`.
- **Cliente**: un ejecutable `zeko-bridge` (`apps/bridge`), empaquetado como **Node single executable
  application** con el Node de la app, con dos subcomandos:
  - `zeko-bridge hook <agente>`: lee el JSON del aviso por stdin (≤ 1 MiB), lo envía y **siempre**
    sale con 0 en ≤ 500 ms, aunque el motor no responda (fail-open, NFR-008);
  - `zeko-bridge mcp`: servidor MCP por stdio (R5-18). Cada llamada a herramienta se reenvía al pipe.
- **Entorno de la sesión**: el lanzamiento agrega `ZEKO_BRIDGE_PIPE`, `ZEKO_SESSION_ID` y
  `ZEKO_SESSION_TOKEN_FILE`. El resto de `ZEKO_*` heredado se sigue quitando como en I-12 (C5-14).
  Como una sesión no sobrevive a un reinicio del engine host (R5-09), alcanza con el entorno y no
  hace falta el archivo de endpoint que nodeterm reescribe en cada arranque
  `[ref-nodeterm: canvas-control-core.ts, CONTROL_SHIM_BODY]`.
- **Credencial por sesión (FR-055)**:
  - `token = base64url(HMAC-SHA256(secretoDelHost, "zeko-session-v1:" + sessionId))`. El secreto son
    32 bytes aleatorios por arranque del engine host y solo existe en memoria.
  - El token se escribe en `<userData>/sessions/<sessionId>/token`, con ACL solo para el usuario, al
    abrir el segmento, y se borra al cerrarlo.
  - El servidor compara en tiempo constante y exige que el segmento esté abierto.
  - Va en un archivo y no en el entorno para no copiarlo en volcados de entorno y para poder
    invalidarlo al cerrar. Las dos opciones exponen lo mismo a un proceso del mismo usuario (R5-23).
- **Protocolo**: líneas JSON `{v: 1, kind: 'hook' | 'tool', sessionId, token, agent, payload}` →
  respuesta JSON. Límite de 1 MiB por pedido, 2 s para recibirlo completo y 10 llamadas a
  herramientas por segundo por sesión. Todo rechazo emite `bridge.rejected` sin el contenido del
  pedido.
- **Árbol de procesos**: los procesos de hook y el servidor MCP son hijos del agente, así que entran
  en el árbol adoptado y la cancelación los termina (R5-06). No dejan huérfanos.

**Alternativas descartadas**:

- **HTTP en loopback con curl en el comando del hook** (nodeterm): un puerto abierto a cualquier
  proceso local, y en Windows el quoting depende de la shell con la que cada agente ejecuta sus hooks
  `[NO VERIFICADO: U5-15]`. Pasar el payload por argv expone su contenido a otros procesos y falla
  con payloads grandes `[ref-nodeterm: src/core/agents/hooks/managed-script.ts]`. Además, MCP
  necesita un proceso de todos modos.
- **Electron como Node** (`ELECTRON_RUN_AS_NODE=1` con el binario de la app): exige poner esa
  variable en el entorno del agente, de donde la heredaría cualquier comando de su shell. 001 quita
  `ELECTRON_*` por esa razón (I-12). Queda como respaldo si el ejecutable único falla (U5-20).
- **Un servidor por sesión**: multiplica pipes y compuertas sin aislar nada que la credencial no
  aísle ya.

**Cubre**: FR-030, FR-033, FR-055, NFR-008, NFR-009, Principio VI.

## R5-17 · Actividad del agente

**Decisión**: la actividad de cada sesión se deriva de **avisos del propio agente** (hooks o
`notify`) y, como respaldo, de su **archivo de sesión**. Nunca se interpreta la pantalla (FR-030).
Es el mismo principio de nodeterm, "hook-driven status, no output scraping"
`[ref-nodeterm: README.md]`.

```text
AgentActivity = starting | waiting_input | working | waiting_permission | unknown
```

- **Adaptador** (operación pura nueva `normalizeActivityEvent(raw) → ActivityEvent[]`): traduce el
  aviso nativo a eventos comunes: `session_started{ref}`, `turn_started`, `tool_activity`,
  `permission_requested`, `turn_ended{errored, lastMessage?}`, `session_ended`. Los nombres de cada
  agente viven solo en su adaptador, igual que los normalizadores por CLI de nodeterm
  `[ref-nodeterm: src/shared/agents/normalize.ts]` (Principio III: `core` no conoce ids de agente).
- **Núcleo** (función pura `reduceActivity(estado, evento)`):
  - empieza en `unknown` y solo un evento con credencial válida la cambia (FR-031);
  - `turn_started` y `tool_activity` → `working`; `permission_requested` → `waiting_permission`;
    `turn_ended` y `session_started` → `waiting_input`;
  - una señal de "agente inactivo en el prompt" (por ejemplo `Notification` de tipo `idle_prompt` en
    Claude) solo rescata desde `working`, nunca desde `waiting_permission`. Una solicitud pendiente
    también es "inactivo en el prompt" `[ref-nodeterm: normalize.ts, campo idle]`;
  - sin avisos durante mucho tiempo, `working` se mantiene: el silencio no se toma como espera de
    entrada;
  - cada `turn_started` incrementa `turnSeq`, que usan el acuse de mensajes (R5-20) y el presupuesto
    por turno.

**Fuentes por agente** (todas `[NO VERIFICADO]` en la TUI bajo Windows):

| Agente | Fuente | Mapeo | Pregunta |
|---|---|---|---|
| Claude Code | hooks en un archivo de settings **de la sesión**, pasado con `--settings <archivo>`. Cada evento ejecuta `"<zeko-bridge>" hook claude` con timeout de 5 s `[claude-docs]` | `SessionStart` → `session_started` (con `session_id` y `transcript_path`); `UserPromptSubmit` → `turn_started`; `PreToolUse`/`PostToolUse` → `tool_activity` (solo de la sesión principal, no de subagentes); `Notification` de permiso → `permission_requested`; `Notification` `idle_prompt` → rescate; `Stop` → `turn_ended`; `StopFailure`, si existe en la versión → `turn_ended{errored}`; `SessionEnd` → `session_ended` | U5-15 |
| Codex | `-c notify=[<zeko-bridge>,"hook","codex"]`: Codex ejecuta el programa al final de cada turno con un JSON `agent-turn-complete` (`thread-id`, `cwd`, `last-assistant-message`) `[codex-docs]` | `agent-turn-complete` → `turn_ended` + `session_started{ref}` la primera vez | U5-16 |
| Codex (respaldo) | eventos del rollout leídos en streaming por el engine host una vez localizado el archivo (R5-04) | `task_started` → `turn_started`; pedido de aprobación → `permission_requested`; `task_complete` → `turn_ended` | U5-16 |

- **No se toca la configuración global del usuario** (NFR-009). El archivo de settings y el de MCP
  (R5-18) se generan por sesión en `<userData>/sessions/<sessionId>/` y se borran al cerrar. Si
  Claude mezcla los hooks del usuario con los de `--settings`, se evita con la opción de fuentes de
  configuración que verifique U5-15; mientras no se verifique, el nodo muestra
  `USER_CONFIG_NOT_ISOLATED` como hoy.
- **Lo que mejora en decisiones anteriores**:
  - R5-04: `session_id` y `transcript_path` llegan en el primer aviso, así que no hace falta buscar
    la sesión. En Codex, `last-assistant-message` sirve de recap candidata si el rollout no se puede
    leer.
  - R5-14: la actividad reemplaza a `busyDetection` para "el agente está respondiendo".
  - US1-10 y FR-030: la actividad se ve en el nodo.
- **Persistencia**: solo las transiciones de actividad, como evento `session.activity{from, to, at}`
  sin argumentos de herramientas ni texto (Principio XIII, FR-028).

**Cubre**: FR-030, FR-031, US1-10; mejora R5-04 y R5-14.

## R5-18 · Herramientas MCP de Zeko

**Decisión**: Zeko expone sus herramientas a los agentes interactivos como un servidor **MCP** stdio
llamado `zeko` (`zeko-bridge mcp`, R5-16). Así cumple el Principio VI ("la comunicación entre
agentes y Zeko MUST usar MCP") y cierra la mitad de T5-02. nodeterm usa scripts sh con curl y una
skill que los documenta `[ref-nodeterm: canvas-control-core.ts]`; MCP da los mismos verbos con
schemas tipados y sin depender de la shell.

**Registro en el lanzamiento** (`buildInteractiveLaunch`, R5-02):

- Claude: `--strict-mcp-config --mcp-config <sesión>/mcp.json`, con
  `{"mcpServers": {"zeko": {"command": "<zeko-bridge>", "args": ["mcp"]}}}`. `--strict-mcp-config`
  ya está en 001: ahora carga **solo** el servidor de Zeko. Las herramientas de Zeko se
  preaprueban con `--allowedTools mcp__zeko__*`, porque sus propias compuertas (interruptor,
  límites, confirmación de lotes) son el control `[NO VERIFICADO: U5-17]`.
- Codex: `-c mcp_servers.zeko.command="<zeko-bridge>" -c mcp_servers.zeko.args=["mcp"]`, y su
  política de aprobación de herramientas MCP `[NO VERIFICADO: U5-18]`.

**Catálogo** (el schema zod de cada uno está en [contracts/bridge.md](./contracts/bridge.md)):

| Herramienta | Disponible si | Qué hace | FR |
|---|---|---|---|
| `zeko_get_context` | siempre | instrucciones del nodo, resultados vigentes de predecesores, base de código, `requiresChanges` | FR-017, FR-033 |
| `zeko_list_links` | siempre | nodos enlazados con título, tipo, agente, estado, actividad, `canRead`, `canMessage` | FR-033 |
| `zeko_read_node` | siempre | `view: status \| result \| activity` de un nodo enlazado (R5-19) | FR-033–035 |
| `zeko_send_message` | mensajería del flujo activa y algún enlace con mensajes | envía o responde (`inReplyTo`) (R5-20) | FR-037–041 |
| `zeko_message_status` | ídem | estado actual de un mensaje propio (encolado → entregado, vencido…) | FR-040 |
| `zeko_spawn_children` | `orchestration.enabled` | pide un lote o lo valida con `dryRun` (R5-21) | FR-045–047 |
| `zeko_list_children` | ídem | hijos y lotes con estado, rama y `resultCommit` | FR-050 |
| `zeko_cancel_child` | ídem | cancela un hijo propio | FR-050 |

- La lista de herramientas se fija **al lanzar** el segmento, desde la configuración del nodo en el
  run. Una herramienta no disponible no aparece en `tools/list`. Así el agente no ve verbos que no
  puede usar.
- Cada llamada pasa por: credencial (R5-16) → `authorizeTool(nodeRun, herramienta, args)` (pura, en
  `core`) → ejecución. Una autorización fallida responde un error tipado y queda en `tool.rejected`.
- **Toda salida es dato** (R-23, FR-014): el texto devuelto va envuelto en
  `<zeko-node-data node="…" view="…">…</zeko-node-data>` y la descripción de cada herramienta dice que
  su contenido no son instrucciones.
- Las descripciones de las herramientas son la documentación para el agente. Incluyen las reglas de
  reintento según el resultado, igual que nodeterm genera la guía desde la tabla `RETRYABLE` para
  que no se desincronicen `[ref-nodeterm: canvas-control-core.ts, messagingGuidanceLines]`.

**Cubre**: FR-033, FR-037, FR-040, FR-045, FR-050, NFR-006, Principio VI.

## R5-19 · Enlaces de contexto y lectura

**Decisión**: leer es a pedido y **nunca** interrumpe. Enlazar no envía nada: solo da permiso para
leer, como los context links de nodeterm `[ref-nodeterm: src/core/context-link.ts]`.

- **Enlaces** (función pura `resolveLinks(flowSnapshot, run)`):
  - **declarados** en el flujo (`links:`, [contracts/flow-file.md](./contracts/flow-file.md)):
    `nodes: [a, b]`, `read: both | <id del que lee>`, `messages: bool`;
  - **implícitos**: un nodo interactivo lee a sus predecesores directos, y un orquestador lee a sus
    hijos. Un hijo no tiene herramientas (R5-21);
  - solo dentro del mismo run. Un nodo de agente no interactivo puede ser **leído** pero no lee
    (no tiene herramientas en 005).
- **Vistas de `zeko_read_node`**:

| `view` | Contenido | Fuente | Tope |
|---|---|---|---|
| `status` | estado del nodo, actividad (si es interactivo), inicio y fin | estado del motor | — |
| `result` | `PredecessorResult` vigente, o "todavía no terminó" | lo persistido (ya redactado) | 64 KiB |
| `activity` | últimas N entradas, `user:` / `assistant:` / `tool: <nombre>` / `result: <primera línea>` | interactivo: `readConversationTail(ref, n)` del adaptador sobre su archivo de sesión; agente no interactivo: eventos `agent.*` persistidos del intento actual | N ≤ 50 (15 por defecto), 16 KiB |

- `readConversationTail` es una operación nueva del adaptador, de solo lectura y en streaming, con
  el mismo parser por formato que `readRecap` (R5-04). Retiene solo las últimas N entradas y recorta
  cada resultado de herramienta a su primera línea, como el render de nodeterm
  `[ref-nodeterm: src/core/context-link-render.ts]`. **Lo devuelto pasa por el redactor** antes de
  salir (FR-034, SC-007).
- **Rechazos tipados**: `NOT_LINKED`, `DIRECTION_NOT_ALLOWED`, `NODE_NOT_FOUND`, `NO_ACTIVITY_YET`,
  `SOURCE_UNREADABLE`. Un resultado reemplazado nunca se devuelve como vigente (FR-035).
- **FR-028**: leer no es guardar. Solo se persiste el evento `context.read{reader, target, view,
  bytes}`.

**Cubre**: FR-032–035, US4, NFR-010.

## R5-20 · Mensajes entre agentes

Es la única decisión en la que Zeko **escribe** en la terminal de un agente. Por eso está apagada por
defecto y cada paso tiene una compuerta.

**Compuertas** (función pura `decideDelivery(hechos)`). El orden va de la más barata y permanente a
la más transitoria, como en nodeterm `[ref-nodeterm: src/core/agents/agent-message-decide.ts]`:

| # | Resultado | Tipo | ¿Reintentar sirve? |
|---|---|---|---|
| 1 | `MESSAGING_DISABLED`, `NOT_LINKED_FOR_MESSAGES`, `TARGET_NOT_INTERACTIVE`, `SELF_TARGET` | rechazo | no |
| 2 | `RATE_LIMITED{retryAfterMs}` (par), `TURN_BUDGET_EXHAUSTED`, `NODE_BUDGET_EXHAUSTED`, `MESSAGE_TOO_LARGE` | rechazo | el primero sí, tras la espera; el segundo en el próximo turno; los demás no |
| 3 | `TARGET_NOT_STARTED` (sin sesión abierta), `TARGET_ENDED` | rechazo | el primero sí; el segundo no |
| 4 | `TARGET_INPUT_UNSUPPORTED` (el adaptador no admite entrega o la TUI no activó bracketed paste) | rechazo | no |
| 5 | `TARGET_BUSY`, `TARGET_ACTIVITY_UNKNOWN`, `TARGET_COMPOSER_DIRTY`, `TARGET_PAUSED`, `TARGET_WRITE_IN_PROGRESS` | **se encola** | — |
| 6 | todo lo demás | se escribe | — |

- El presupuesto se **reserva** en un paso atómico al pasar la compuerta 2 y se libera si la entrega
  nunca llega al PTY. Sin reserva, envíos paralelos pasarían el tope antes de que se registrara el
  primero `[ref-nodeterm: agent-messaging.ts, reserveFlow]`.
- **Límites por defecto** (configurables dentro de topes, [data-model.md](./data-model.md)): 1 mensaje
  por par cada 10 s, 4 por turno del remitente, 20 por nodo en el run, cuerpo ≤ 8 KiB.

**Texto sin enviar del usuario (`TARGET_COMPOSER_DIRTY`)**: nodeterm no puede detectarlo y lo deja
como riesgo residual `[ref-nodeterm: agent-message.ts, "hook-idle ≠ nobody typing"]`. Zeko sí, porque
toda la entrada del usuario pasa por el `InteractiveSessionHost` (R5-01):

- cualquier byte del usuario distinto de un `\r` solo marca la sesión como "con texto sin enviar";
- un `\r` del usuario o un `turn_started` la limpia;
- el borrado hasta dejar la entrada vacía no se puede detectar, así que la marca queda hasta el
  próximo envío. El nodo muestra "mensaje en espera: hay texto sin enviar" con la acción "Entregar
  ahora", que es una acción explícita del usuario;
- la comprobación y la escritura corren en el mismo hilo del engine host, así que no hay carrera
  dentro del host. La única ventana son los bytes en tránsito desde el renderer (milisegundos), un
  riesgo que se documenta en Assumptions de la spec.

**Escritura en el PTY** (no hay tmux en Windows, así que Zeko hace lo que en nodeterm hace
`paste-buffer -p` `[ref-nodeterm: src/core/pty-manager.ts, sendEnvelopeNow]`):

1. El host sigue en la salida del PTY si la TUI activó el bracketed paste (`ESC[?2004h` / `ESC[?2004l`,
   con un autómata que tolera secuencias partidas entre bloques) `[NO VERIFICADO: U5-19]`. Sin él, la
   entrega se rechaza (compuerta 4): un texto multilínea sin paste se enviaría línea por línea como
   varios turnos.
2. Escribe `ESC[200~` + marco + `ESC[201~`.
3. Espera `submitDelayMs` (capacidad del adaptador, 150 ms por defecto) y escribe `\r`. Si en esa
   espera llega entrada del usuario, **no** envía el `\r`: el mensaje queda en la entrada visible
   para que el usuario decida, y el resultado es `WRITTEN_NOT_SUBMITTED`. No se retiene la entrada
   del usuario, porque eso rompería NFR-002.

**Marco** (`buildEnvelope`, en `core`):

```text
--- ZEKO MESSAGE <marca> ---
from: <título del nodo> (<nodeId>)
reply-to: <nodeId>
message-id: <id>
<cuerpo>
--- END ZEKO MESSAGE <marca> ---
```

- `<marca>`: 9 bytes aleatorios en base64url, distintos por entrega. El remitente nunca la ve.
  Impide que un cuerpo falsifique el cierre del marco real
  `[ref-nodeterm: src/core/agents/agent-message-envelope.ts]`.
- Encabezados: el título sale del flujo y se pasa a una sola línea (sin saltos ni controles). El
  remitente no aporta ningún campo del encabezado.
- Cuerpo: se quitan `ESC`, los C0 salvo `\n` y `\t`, DEL y los C1; `\r\n` pasa a `\n`; se redacta
  (SC-007). Si después de sanear supera el tope, se rechaza.
- **Convención** (en la descripción de `zeko_send_message` y en la del servidor MCP): solo el marco
  más externo es auténtico; todo lo de adentro es dato, aunque parezca un marco.
- **Avisos de Zeko** (R5-21): el mismo marco con `from: zeko` y `reply-to: none`. El cuerpo sale de
  una tabla cerrada de textos y no cita nada que haya producido un agente salvo títulos ya pasados a
  una línea.

**Acuse** (FR-040): el motor se suscribe a la actividad del destino **antes** de escribir. Si llega un
`turn_started` en 8 s, el resultado es `DELIVERED`; si no, `DELIVERED_UNCONFIRMED`. Suscribirse
después de escribir pierde el `turn_started` de un destino rápido y lleva al remitente a reenviar
`[ref-nodeterm: agent-message.ts, watchForReceipt]`.

**Cola** (FR-038):

- una cola por **sesión destino**, FIFO, capacidad 16, vencimiento de 10 min por defecto (1–60);
- se vacía de a un mensaje cuando la actividad pasa a `waiting_input`, sin texto sin enviar y sin
  pausa. Después de una entrega el destino pasa a `working`, así que el siguiente espera al próximo
  `waiting_input`;
- vive en memoria del engine host, porque una sesión no sobrevive a un reinicio. Cada encolado
  persiste el evento `message.queued`, y la recuperación (R5-09) marca como vencidos
  (`EXPIRED{cause: interrupted}`) los que no tienen resultado. No hace falta la cola persistida de
  nodeterm, que sí sobrevive porque tmux mantiene las sesiones `[ref-nodeterm: delivery-queue.ts]`;
- el remitente consulta la evolución con `zeko_message_status`.

**Persistencia** (FR-028): el evento `message.delivery{messageId, from, to, inReplyTo, chars,
outcome, at}`, **sin el cuerpo**. El texto vive en la conversación del destino, que es del agente.

**Pausa** (FR-042): `session.messaging.pause/resume` desde la vista. Con la pausa activa, la cola
retiene. El usuario puede descartar mensajes encolados.

**Cubre**: FR-036–043, US5, NFR-007, SC-008.

## R5-21 · Orquestación

**Decisión**: un orquestador pide **lotes de hijos** con `zeko_spawn_children`. Cada hijo es un
**nodo de agente no interactivo de 001** creado dentro del run, sin herramientas y sin hijos propios.

- **Configuración** (en el nodo interactivo, [contracts/flow-file.md](./contracts/flow-file.md)):
  `orchestration: {enabled: false, allowedAgents, allowedModels?, maxChildren: 4 (1..16),
  childLimits: {timeoutMinutes, maxTurns, maxRetries}, confirm: true}`.
- **Validación del lote** (pura, `validateSpawnBatch(padre, hijosExistentes, lote)`; el lote completo
  pasa o se rechaza, FR-046):

| Código | Regla |
|---|---|
| `CHILD_SCOPE_EXCEEDS_PARENT` | cada glob del hijo tiene que estar contenido en algún glob del padre |
| `CHILD_SCOPE_UNPROVABLE` | la contención no se puede probar con la regla conservadora (abajo) → se rechaza |
| `AGENT_NOT_ALLOWED`, `MODEL_REQUIRED`, `MODEL_NOT_ALLOWED` | agente en `allowedAgents`; modelo obligatorio y, si existe `allowedModels`, incluido |
| `LIMIT_EXCEEDS_ALLOWED` | límites del hijo ≤ `childLimits`, siempre finitos |
| `TERMINAL_EXCEEDS_PARENT` | un hijo no habilita terminal si el padre no la tiene |
| `MAX_CHILDREN_EXCEEDED`, `BATCH_TOO_LARGE` | total del run ≤ `maxChildren`; ≤ 8 por lote |
| `UNKNOWN_DEPENDENCY`, `DEPENDENCY_CYCLE`, `MULTIPLE_CODE_SOURCES` | dependencias dentro del lote, sin ciclos y con a lo sumo una fuente de código (R-22) |
| `DUPLICATE_KEY` | claves únicas dentro del lote |
| `BATCH_ALREADY_PENDING` | un solo lote esperando confirmación por orquestador |
| advertencia `SCOPES_OVERLAP` | pares de hermanos con alcances que se pueden intersecar |

  **Regla conservadora de contención**: el prefijo literal del glob del hijo (hasta el primer
  comodín) tiene que coincidir con un glob del padre que termine en `/**` o ser igual a un glob del
  padre. Si no se puede probar, se rechaza. El alcance `[]` (solo lectura) siempre está contenido.

- **Confirmación** (FR-047): con `confirm: true`, el agente recibe `{status: pending_confirmation,
  batchId}` de inmediato y sigue trabajando. La vista muestra el lote (agentes, modelos, alcances,
  límites, dependencias, superposiciones) y el usuario decide con `spawn.decide`. La decisión llega
  al orquestador como aviso de Zeko (R5-20). El lote vence si termina la sesión del orquestador
  (`PARENT_ENDED`).
- **Hijos como NodeRuns**: `origin: spawned`, `parentNodeRunId`, `spawnBatchId`, `spawnKey`. El id del
  nodo es `<padre>~<clave>`, único en el run. La definición se guarda en `spawned_nodes`
  ([data-model.md](./data-model.md)), porque no está en el archivo del flujo. Entran al scheduler
  como cualquier nodo de agente:
  - toman lease de concurrencia (R-21);
  - sus dependencias son aristas del run;
  - reciben el `TaskAssignment` de 001 con sus instrucciones y criterios, más el resultado de su
    dependencia si la tienen;
  - la cancelación, los reintentos y el resultado son los de 001.
- **Avisos al orquestador** (FR-050): cuando un hijo llega a un estado terminal, Zeko entrega el aviso
  `Child "<título>" (<id>) finished: <estado>. Read it with zeko_read_node.` con la cola de R5-20. No
  consume el presupuesto de mensajes del nodo (lo acota `maxChildren`) y no requiere el interruptor de
  mensajería: habilitar la orquestación ya es el consentimiento. También se muestra en el nodo.
- **Fin del orquestador** (FR-053):
  - cancelación e interrupción → hijos activos `cancelled` / `interrupted` (`PARENT_CANCELLED`);
  - en los demás casos, la vista pregunta "Cancelar hijos" o "Dejarlos terminar". Mientras no se
    decide, los hijos siguen;
  - el resultado del orquestador lista `children: [{nodeId, title, finalStatus, branch,
    resultCommit?}]` (FR-022) con su estado en el momento del cierre.
- **Reapertura del orquestador**: los hijos terminados conservan su resultado y siguen legibles. Se
  pueden pedir lotes nuevos dentro del `maxChildren` restante.
- **Canvas** (FR-052): los hijos se dibujan dentro del marco de su orquestador, con estilo de nodo del
  run. "Guardar en el flujo" escribe nodos `agent` con sus aristas (padre → hijo y entre hijos) con el
  serializador canónico de 001. Es una edición del flujo hecha por el usuario.
- **Por qué un solo nivel y solo hijos no interactivos**:
  - el confinamiento de los nodos no interactivos está verificado en 001 (R-10, R-13), y el de la TUI
    no lo está (T5-07);
  - un hijo interactivo sumaría esperas humanas fuera de la vista del usuario;
  - la profundidad 1 más `maxChildren` acotan el trabajo total sin recursión (Principio XI).

**Cubre**: FR-044–054, US6, SC-009.

## R5-22 · Distribución de archivos

**Pregunta del usuario**: ¿cómo evitan los agentes pelearse por un mismo archivo? **Respuesta**:
no hay locks de archivos, ni en nodeterm ni en Zeko. La cola de mensajes serializa **escrituras en
una terminal**, no en archivos. El conflicto se evita con **aislamiento** y se resuelve al
**integrar**, que hace una persona o el agente dueño de la copia
`[ref-nodeterm: canvas-control-core.ts, "Each stream now works on its own branch in its own worktree group — no tree conflicts"]`.

1. **Un worktree por nodo** (R-15, Principio VIII), también para cada hijo. Dos agentes nunca
   comparten una copia activa (FR-009).
2. **Instantánea del orquestador** (FR-049). Se toma **en el momento del pedido**, porque entonces el
   agente está esperando la respuesta de la herramienta y no escribe. Comandos `[git]`:

   ```text
   GIT_INDEX_FILE=<tmp> git -C <wt> read-tree HEAD
   GIT_INDEX_FILE=<tmp> git -C <wt> add -A -- . ':(exclude)<permissionPersistencePaths>'
   GIT_INDEX_FILE=<tmp> git -C <wt> write-tree                     → <tree>
   git -C <wt> commit-tree <tree> -p HEAD -m "zeko: snapshot <padre> lote <id>"   → <commit>
   git -C <wt> update-ref refs/zeko/snapshots/<run8>/<padre>/<lote> <commit>
   ```

   Usa un índice temporal y una ref fuera de `refs/heads`, así que **no cambia** `HEAD`, el índice, la
   rama ni el árbol del orquestador (SC-010). Sigue la regla de exclusiones de R5-05. Si alguien
   necesita más que eso, el orquestador hace commit en su copia antes de pedir.
3. **Base de cada hijo**: sin dependencias → la instantánea; con una dependencia de código → el
   `resultCommit` de esa dependencia (R-22). Rama `zeko/<run8>/<padre>/<clave>`.
4. **Superposición**: la validación advierte `SCOPES_OVERLAP`. Si dos hermanos tocan el mismo
   archivo, cada uno lo hace en su copia; el conflicto aparece al integrar.
5. **Integración** (FR-051): Zeko **nunca** hace merge (Principio VIII). El agente orquestador, si
   tiene terminal, o el usuario puede ejecutar `git merge zeko/<run8>/<padre>/<clave>` en la copia
   del orquestador. `zeko_list_children` y `zeko_read_node{view: result}` dan la rama y el
   `resultCommit`. El resultado se observa como cambios del orquestador: el commit del motor de R5-08
   lo incluye y el alcance del orquestador lo valida. Como el alcance del hijo está contenido en el
   del padre, una integración limpia no viola el alcance. Un agente sin terminal no puede integrar:
   el usuario lo hace o lo encarga a un nodo posterior.
6. **Rutas compartidas** (FR-056): `.zeko/config.yaml` → `workspace.sharedPaths: ["node_modules"]`.
   - Al crear cada worktree, para cada entrada que existe en la raíz del repositorio, es un
     directorio, está ignorada (`git check-ignore`) y no tiene `..` ni ruta absoluta, Zeko crea un
     **junction** de directorio (`fs.symlink(destino, ruta, 'junction')`). En Windows un junction no
     requiere permisos de administrador ni modo desarrollador `[node]`.
   - Un archivo suelto se omite con la advertencia `SHARED_PATH_NOT_DIRECTORY`. Es la misma idea que
     los `sharedPaths` de nodeterm, que en macOS usa symlinks
     `[ref-nodeterm: src/core/worktree-shared-paths.ts]`.
   - **No están aisladas**: el nodo muestra `SHARED_PATHS_NOT_ISOLATED`. Las herramientas de
     archivos confinadas ya deniegan escribir y leer a través de junctions (`[001b §B1]`
     `read-junction`, `[001c §8]`), así que para ellas la ruta queda inaccesible o de solo lectura.
     Una shell sin confinar sí escribe a través del junction en la copia original: por eso SC-006
     exceptúa estas rutas.
   - **Limpieza** (cambio a R-15, C5-17): antes de borrar un worktree, Zeko desvincula cada junction
     con `fs.unlink` / `rmdir` **no recursivo**. Nunca borra recursivamente a través de un junction,
     porque eso borraría el contenido del destino `[NO VERIFICADO: U5-24]`.

**Cubre**: FR-049, FR-051, FR-056, SC-006, SC-010, Principio VIII.

## R5-23 · Modelo de amenazas del canal entre agentes

| Amenaza | Mitigación | Riesgo residual |
|---|---|---|
| El remitente falsifica el marco para que su texto parezca de Zeko o de otro nodo | marca por entrega que el remitente no conoce; encabezado compuesto por Zeko; convención "solo el marco externo es auténtico" (R5-20) | un modelo puede confundirse igual. Por eso un mensaje no tiene autoridad (FR-043) |
| Inyección de instrucciones en mensajes, lecturas o resultados de hijos | todo se entrega como dato etiquetado (R-23); jerarquía del Principio X; ninguna herramienta amplía permisos; los lotes se confirman y los hijos están contenidos en el padre | el destino puede ser convencido de hacer algo **dentro** de sus permisos: es el mismo riesgo que leer el repositorio (Principio XI) |
| Otro proceso local se hace pasar por un nodo | pipe con ACL de usuario; token HMAC por sesión que vence al cerrar el segmento (R5-16) | un proceso del mismo usuario que lea el archivo del token. La credencial eleva el costo; no es frontera (Assumptions) |
| Bucles de mensajes entre agentes | límites por par, turno y nodo; avisos acotados por `maxChildren`; profundidad 1 | ninguno sin límite (Principio XI) |
| Fuga de secretos de un agente a otro | redactor (R-28) sobre lecturas, mensajes y avisos antes de salir | lo que el redactor no detecta, igual que en 001 |
| `transcript_path` manipulado en un aviso | solo con credencial válida; tiene que estar dentro del directorio de sesiones del agente; solo lectura | — |
| Secuencias de control en el cuerpo (salir del paste, mover el cursor, cambiar el título) | saneador sin `ESC`/C0/C1; marco dentro de bracketed paste (R5-20) | — |
| Mensaje mezclado con texto del usuario | marca de texto sin enviar; no se envía `\r` si llega entrada durante la entrega | bytes en tránsito del renderer (milisegundos) |
| Saturar el puente | 1 MiB por pedido, 2 s para recibirlo, 10 llamadas/s por sesión | — |
| Hooks que traban al agente | `zeko-bridge hook` siempre termina en ≤ 500 ms con 0 (NFR-008) | un aviso perdido deja la actividad atrasada hasta el próximo |

**Cubre**: FR-014, FR-039, FR-043, FR-055, NFR-006, SC-007, SC-011.

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
| C5-14 | **I-12 / limpieza de entorno**: se siguen quitando los `ZEKO_*` heredados, y el lanzamiento interactivo agrega `ZEKO_BRIDGE_PIPE`, `ZEKO_SESSION_ID` y `ZEKO_SESSION_TOKEN_FILE`. | R5-16. |
| C5-15 | **R-23 (salida de agentes como datos)**: se extiende a lecturas de `zeko_read_node`, mensajes y avisos, con la etiqueta `<zeko-node-data>` y el marco de mensaje. | FR-014, FR-034, FR-043 (R5-18–R5-20). |
| C5-16 | **R-15 / R-22 (copias y linaje)**: un nodo puede tener como base una instantánea `refs/zeko/snapshots/…` de otra copia (hijos), además de un `resultCommit` o el `baseCommit` del run. | FR-049 (R5-22). |
| C5-17 | **R-15 (limpieza)**: antes de borrar un worktree se desvinculan sus junctions de rutas compartidas sin recursión. | FR-056 (R5-22). |
| C5-18 | **Modelo del run**: un `NodeRun` puede originarse en un lote de hijos (`origin: spawned`), con su definición en `spawned_nodes` en lugar del archivo del flujo; las aristas entre hijos son del run. | FR-045–054 (R5-21). |
| C5-19 | **`ProjectConfig`**: se agrega `workspace.sharedPaths`. | FR-056. |
| C5-20 | **R-10 / R-13 (flags)**: Claude agrega `--settings` y `--mcp-config` (con el `--strict-mcp-config` que ya tenía); Codex agrega `-c notify` y `-c mcp_servers.zeko.*`. Solo en lanzamientos interactivos. | R5-17, R5-18. |
| C5-21 | **Stack**: dependencia nueva `@modelcontextprotocol/sdk` (servidor MCP del puente) y empaquetado del ejecutable `zeko-bridge` como Node single executable application. | Complexity Tracking del plan; Principio VI. |

## §T · Tensiones con la constitución y con la spec

| ID | Tensión | Resolución |
|---|---|---|
| T5-01 | **Principio IV** frente a FR-029. | Enmienda MAJOR propuesta en R5-10, a aplicar antes de `/speckit-tasks`. Mientras tanto, Complexity Tracking del plan. |
| T5-02 | **Principio VI** (MCP como canal agente ↔ Zeko). | **Resuelta en parte el 2026-10-16**: lectura, mensajes y orquestación usan MCP (R5-18). Los avisos de actividad usan los hooks nativos de cada agente, que el Principio IX nombra como mecanismo nativo, y no un formato propio. Sigue fuera de alcance el **resultado** estructurado por MCP (aclaración del 2026-09-28): la declaración viene del usuario y la recap de un archivo del agente. Complexity Tracking solo por eso. |
| T5-03 | **Principio IX** (acciones fuera de alcance requieren aprobación). En la TUI el usuario aprueba o rechaza, que es más cercano al principio que 001. Pero la shell de Claude sigue sin confinar `[001b §B2]`, y si una aprobación puede levantar un límite duro (U5-02, U5-06) la acción ocurre con aprobación humana pero fuera del alcance del nodo. | Se muestra como restricción no admitida (FR-016) y la escritura fuera de alcance deja el nodo `blocked` (FR-020). Complexity Tracking, igual que 001. |
| T5-04 | **Principio X**: "una instrucción directa del usuario a un agente MUST notificarse al orquestador". FR-028 prohíbe guardar la transcripción, así que Zeko no conoce el contenido de lo que el usuario escribe. | Lo que se notifica es **que** hubo instrucciones directas: eventos `session.opened/closed`, la declaración y la recap. El orquestador no revierte nada de la sesión: por eso R5-05 excluye en lugar de revertir. Se registra como interpretación, sin cambio constitucional. |
| T5-05 | **Principio XI** (todo run con límites de tiempo). La espera en `waiting_user` no tiene límite (FR-010, US3-3). | Igual que `waiting_approval` en 001: el tiempo de ejecución del agente sí es finito y obligatorio (FR-010); la espera no consume recursos y se puede cancelar. |
| T5-06 | **Principio XIII** (estados visibles `idle/running/waiting approval/failed/done`). | `waiting_user` se mapea a "waiting approval" (espera de intervención humana), como `waiting_approval` en data-model §3 de 001. |
| T5-07 | **FR-016 / FR-015** frente a la falta de evidencia interactiva. | Hasta 005a, valores conservadores: todo nodo interactivo `unconfined` con `INTERACTIVE_CONFINEMENT_UNVERIFIED`. El plan no promete confinamiento en la TUI. |
| T5-08 | **FR-011** (salida normal → completado) frente a U5-04/U5-07. | Hasta verificar los códigos, toda salida sin declaración es `crashed` (R5-03). US2-2 queda bloqueado por la compuerta 005a, no el resto de la feature. |
| T5-09 | **FR-027** pide el costo "si el agente lo informó". En modo interactivo no hay evento `result` `[001 §3]`. | Costo "no disponible" hasta U5-03 (Claude). Para Codex, consumo y uso de la suscripción del rollout si U5-08 lo confirma; costo en dinero ausente como en 001 `[001c §11]`. |
| T5-10 | **Principio X** (jerarquía): un mensaje de otro agente y el plan de un orquestador podrían tomarse como instrucciones. | Un mensaje es dato de otro agente, por debajo de la instrucción del usuario (FR-043). El plan del orquestador es el nivel 6 y se ejecuta solo dentro de su configuración (FR-046). Lo que el usuario dice en la terminal del orquestador manda sobre el plan. Interpretación, sin enmienda. |
| T5-11 | **Principio IX** (la autonomía no amplía permisos): un orquestador crea hijos sin intervención si `confirm: false`. | Los hijos nunca exceden al padre: alcance contenido, agentes y límites permitidos, terminal solo si el padre la tiene (R5-21). `confirm: true` es el valor por defecto, y desactivarlo es una decisión del usuario guardada en el archivo del flujo y visible en el diff. |
| T5-12 | **Principio XI** (sin loops sin límite): mensajes que se responden entre sí y lotes sucesivos. | Límites por par, turno y nodo; `maxChildren` por run; profundidad 1 (R5-20, R5-21). |
| T5-13 | **Principio V** (archivos como verdad; la base solo guarda estado de ejecución): los hijos no están en el archivo del flujo. | Son estado de ejecución del run, como los intentos. Pasan al flujo solo con "Guardar en el flujo", que escribe el archivo (FR-052). |
| T5-14 | **Principio XIV** (referencias, no dependencias): nodeterm es BUSL-1.1. | Se usa solo como referencia de diseño: no se copia código, y las decisiones lo citan como `[ref-nodeterm]`. La atribución MIT del Principio XIV no aplica porque no hay código reutilizado. |
| T5-15 | **Stack**: `@modelcontextprotocol/sdk` está fuera del stack de la constitución. | Complexity Tracking del plan. Es el SDK de referencia del estándar que exige el Principio VI; implementar JSON-RPC y MCP a mano duplicaría el estándar con más riesgo. |

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
| U5-15 | Claude TUI con `--restricted` acepta `--settings <archivo>` con hooks de tipo `command`, los ejecuta en Windows (con qué shell, cómo se citan rutas con espacios), entrega por stdin `session_id`, `transcript_path` y `hook_event_name`, y existe una forma de no mezclar los hooks del usuario. | R5-16, R5-17 | Q16 | `activitySource` de Claude |
| U5-16 | Codex TUI ejecuta `-c notify=[…]` al fin de cada turno con `agent-turn-complete` (`thread-id`, `cwd`, `last-assistant-message`), también con `--ignore-user-config`; el rollout registra inicio de turno y pedidos de aprobación. | R5-17 | Q17 | `activitySource` de Codex |
| U5-17 | Claude TUI con `--strict-mcp-config --mcp-config` carga el servidor `zeko` por stdio; sus herramientas siguen disponibles con `--tools` restringido; `--allowedTools mcp__zeko__*` las preaprueba. | R5-18 | Q18 | `zekoTools` de Claude |
| U5-18 | Codex TUI carga `-c mcp_servers.zeko.*` con `--ignore-user-config`, y qué política de aprobación aplica a herramientas MCP sin abrir el sandbox. | R5-18 | Q19 | `zekoTools` de Codex |
| U5-19 | Bajo ConPTY, cada TUI emite `ESC[?2004h` en su prompt y lo recibe Zeko; un bracketed paste multilínea seguido de `\r` tras `submitDelayMs` se envía como **un** turno; el valor mínimo de `submitDelayMs` por agente. | R5-20 | Q20 | `messaging.input` de cada agente |
| U5-20 | El ejecutable único (Node SEA) de `zeko-bridge` arranca en Windows en ≤ 150 ms y no lo bloquea SmartScreen ni el antivirus cuando lo lanza el agente. | R5-16 | Q21 | Empaquetado del puente (respaldo: Electron como Node) |
| U5-21 | El named pipe con ACL de usuario es accesible desde los procesos del agente, incluido Codex dentro de `windows.sandbox` elevado o no elevado. | R5-16 | Q22 | Puente bajo el sandbox de Codex |
| U5-22 | Formato de las últimas entradas del archivo de sesión de Claude y del rollout de Codex para `readConversationTail` (texto, herramienta y resultado). | R5-19 | Q3, Q9 | Vista `activity` de nodos interactivos |
| U5-23 | La instantánea con índice temporal funciona igual en Windows con `core.autocrlf`, archivos grandes y rutas largas. | R5-22 | Q23 | Instantánea del orquestador |
| U5-24 | `git worktree remove` y el borrado de la carpeta no siguen junctions si se desvinculan antes; un junction dentro del worktree no cambia el diff ni `status` del worktree si la ruta está ignorada. | R5-22 | Q24 | Rutas compartidas |

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
| Q16 | Claude TUI: ¿`--settings` con hooks `command` se ejecuta con `--restricted`? ¿Con qué shell en Windows? ¿Qué campos llegan por stdin en cada evento? ¿Los hooks del usuario se suman, y cómo se evitan? | Un hook de prueba que escribe su stdin y `%COMSPEC%`/`$SHELL` a un archivo; `~/.claude/settings.json` con un hook marcador. |
| Q17 | Codex TUI: ¿`-c notify` se ejecuta al fin de cada turno, con qué JSON, y también con `--ignore-user-config`? ¿El rollout registra `task_started` y los pedidos de aprobación? | Programa de prueba que guarda `argv`; rollout leído durante un turno largo. |
| Q18 | Claude TUI: ¿carga el servidor MCP de `--mcp-config` con `--strict-mcp-config`? ¿Las herramientas `mcp__zeko__*` están disponibles con `--tools` restringido y se preaprueban con `--allowedTools`? | Servidor MCP de prueba que registra cada llamada; pedir al agente que la use. |
| Q19 | Codex TUI: ¿carga `-c mcp_servers.zeko.*` con `--ignore-user-config`? ¿Pide aprobación por cada llamada? ¿El servidor MCP puede abrir el named pipe dentro de `windows.sandbox`? | Igual que Q18, más Q22. |
| Q20 | ¿Cada TUI emite `ESC[?2004h` bajo ConPTY? ¿Un bracketed paste multilínea + `\r` tras N ms produce un solo turno? ¿Cuál es el N mínimo confiable? ¿Qué pasa si el paste llega mientras el agente trabaja? | Harness que escribe el marco y mide los turnos en el archivo de sesión; barrido de N = 0, 50, 150 y 300 ms. |
| Q21 | ¿El ejecutable único de `zeko-bridge` arranca en ≤ 150 ms? ¿SmartScreen o Defender lo bloquean o demoran cuando lo lanza un agente? | 50 lanzamientos medidos; registro de eventos de Defender. |
| Q22 | ¿El pipe con ACL de usuario es accesible desde los hijos del agente, incluido Codex bajo `windows.sandbox` elevado y no elevado? | Cliente de prueba lanzado por el agente. |
| Q23 | ¿La instantánea con índice temporal deja intactos `HEAD`, índice, rama y árbol con `core.autocrlf=true`, rutas largas y archivos binarios grandes? | Hash del índice y del árbol antes y después; `git status --porcelain`. |
| Q24 | ¿Desvincular los junctions y después `git worktree remove --force` deja intacto el destino? ¿Un junction en una ruta ignorada no aparece en `status` ni en el diff del worktree? | Hash del `node_modules` original antes y después; `git status --porcelain --ignored`. |

**Compuerta**: 005a bloquea **solo** las tareas de la columna "Bloquea" de §U. Pueden avanzar antes:
contratos, schemas, validación (incluida FR-029), estados y transiciones, `resolveNodeResult` con la
capa de declaración, invalidación y reejecución de dependientes, tiempo acumulado, eventos,
redacción, la mudanza del transporte de terminal al engine host con el agente simulado, la UI, el
retiro de §I y, de la comunicación:

- el `BridgeServer`, el ejecutable `zeko-bridge` y el servidor MCP probados con el agente simulado;
- `reduceActivity`, `decideDelivery`, la cola, el marco y el saneador;
- `resolveLinks`, `validateSpawnBatch`, los hijos como NodeRuns, la instantánea y las rutas
  compartidas (con integración Windows propia).

Con los valores conservadores de R5-02 la feature es funcional y segura, pero no cumple US2-2 (salida
normal → completado), la recap, la reanudación ni el confinamiento mostrado hasta cerrar 005a. Con
`activitySource = none`, `zekoTools = false` y `messaging.input = none`, los agentes reales tampoco
leen, ni envían o reciben mensajes, ni orquestan hasta cerrar Q16–Q22. El nodo lo muestra como
capacidad no disponible y no como error.
