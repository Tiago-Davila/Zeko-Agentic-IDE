# Feature Specification: Terminal interactiva del agente en cada nodo (chat con el agente)

**Feature Branch**: `feature/chat`

**Created**: 2026-09-27

**Status**: Implemented (especificación retroactiva de lo construido en la rama)

**Input**: User description: "Al abrir un nodo de agente en el canvas quiero hablar directamente con
ese agente en su propia CLI, como una pestaña de terminal de Orca, en lugar de ver solo una salida
de solo lectura."

## Objetivo

El usuario necesita conversar con el agente de un nodo mientras diseña o revisa el flujo: probar
instrucciones, pedir aclaraciones o terminar a mano una tarea. Hasta ahora el nodo solo mostraba la
salida del run en un panel de solo lectura. Esta feature reemplaza ese panel por una terminal real
e interactiva, embebida en el canvas, donde corre la CLI del agente (Claude Code o Codex) con el
modelo configurado en el nodo, o una shell común.

**Actores**

- **Usuario desarrollador**: abre un nodo de agente, conversa con el agente en la terminal, pega
  las instrucciones del nodo, reinicia la sesión o cambia a una shell.
- **Agente CLI**: la CLI instalada y autenticada por el usuario (`claude` o `codex`), ejecutada tal
  cual, con su propia interfaz de terminal.
- **Sistema Zeko**: crea y mantiene la pseudoterminal en el proceso principal, valida cada pedido
  del renderer y reenvía entrada, salida y tamaño.

**Relación con la spec 001**: esta terminal es una sesión interactiva del usuario, separada de la
ejecución de runs. No pasa por el motor, no usa las copias aisladas de los nodos y no produce
resultados de nodo. La ejecución de flujos de la spec 001 no cambia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conversar con el agente de un nodo (Priority: P1)

El usuario selecciona un nodo de agente en el canvas. Se abre un panel lateral (dock) con la
pestaña "Terminal" activa, donde arranca la CLI del agente del nodo en la raíz del proyecto, con el
modelo y el nivel de razonamiento configurados en el nodo. El usuario escribe y el agente responde
en su propia interfaz, igual que en una terminal externa.

**Why this priority**: es el valor central de la feature; sin terminal interactiva no hay chat.

**Independent Test**: abrir un proyecto, crear un nodo de Claude Code con modelo `sonnet`,
seleccionarlo y comprobar que la terminal muestra la interfaz de `claude --model sonnet` y responde
a lo que se escribe.

**Acceptance Scenarios**:

1. **Dado** un nodo de agente de Claude Code, **Cuando** el usuario lo selecciona, **Entonces** se
   abre el dock con la terminal ejecutando `claude` con el modelo del nodo en la raíz del proyecto.
2. **Dado** un nodo de Codex con modelo y nivel de razonamiento, **Cuando** el usuario lo
   selecciona, **Entonces** la terminal ejecuta `codex -m <modelo> -c model_reasoning_effort=<nivel>`.
3. **Dado** un nodo sin modelo propio, **Cuando** se abre la terminal, **Entonces** se usa el modelo
   por defecto del proyecto para ese agente.
4. **Dado** que el agente termina (por ejemplo, el usuario sale de la CLI), **Cuando** el proceso
   finaliza, **Entonces** el usuario queda en el prompt de su shell dentro de la misma terminal.

### User Story 2 - Retomar la sesión al volver al nodo (Priority: P1)

El usuario cierra el dock o selecciona otro nodo y luego vuelve. La sesión sigue viva y la terminal
muestra lo que había pasado, sin relanzar el agente.

**Why this priority**: sin persistencia, cada clic en el canvas perdería la conversación.

**Independent Test**: conversar con el agente, cerrar el dock, reabrir el nodo y comprobar que la
conversación sigue y el proceso es el mismo.

**Acceptance Scenarios**:

1. **Dado** una sesión abierta en un nodo, **Cuando** el usuario cierra y reabre el dock,
   **Entonces** la terminal se reconecta a la misma sesión y reproduce su salida reciente.
2. **Dado** un proceso que terminó mientras el dock estaba cerrado, **Cuando** el usuario reabre el
   nodo, **Entonces** la terminal muestra la salida y un aviso con el código de salida.
3. **Dado** que la ventana cambia de tamaño, **Cuando** el dock se redimensiona, **Entonces** la
   terminal ajusta columnas y filas y el proceso recibe el nuevo tamaño.

### User Story 3 - Controlar la sesión desde el dock (Priority: P2)

Desde la barra del dock el usuario cambia el programa de la terminal (Claude Code, Codex o Shell),
pega las instrucciones del nodo en el agente, reinicia la sesión o pasa a la pestaña "Settings" para
editar la configuración del nodo.

**Why this priority**: mejora el flujo de trabajo, pero la conversación básica funciona sin esto.

**Independent Test**: con un nodo con instrucciones, pulsar "Paste instructions" y comprobar que el
agente recibe el texto como un bloque sin enviarlo; pulsar "Restart" y comprobar que arranca un
proceso nuevo.

**Acceptance Scenarios**:

1. **Dado** un nodo con instrucciones, **Cuando** el usuario pulsa "Paste instructions",
   **Entonces** el texto se envía como pegado entre corchetes (bracketed paste) y el agente espera
   que el usuario confirme con Enter.
2. **Dado** una sesión activa, **Cuando** el usuario pulsa "Restart", **Entonces** el proceso actual
   se cierra y arranca uno nuevo con la configuración vigente del nodo.
3. **Dado** el selector en "Shell", **Cuando** se abre la terminal, **Entonces** arranca la shell del
   usuario sin agente; "Paste instructions" queda deshabilitado.
4. **Dado** la pestaña "Settings", **Cuando** el usuario edita el nodo, **Entonces** ve el mismo
   inspector de nodo de la spec 001, embebido en el dock y sin título ni botón de cierre duplicados.
5. **Dado** texto seleccionado en la terminal, **Cuando** el usuario pulsa Ctrl+C (o Ctrl+Shift+C),
   **Entonces** se copia la selección; sin selección, Ctrl+C se envía al proceso como interrupción.

### Edge Cases

- La carpeta del proyecto ya no existe: la terminal no arranca y el dock muestra el error.
- La CLI del agente no está instalada: la shell informa el comando inexistente y queda en el prompt.
- El renderer envía un modelo, nivel de razonamiento, tipo de terminal o directorio inválido: el
  proceso principal rechaza el pedido sin lanzar nada.
- Zeko se inició desde una sesión de Claude Code: las variables que marcan una sesión hija no se
  heredan, para que la terminal del nodo sea una sesión de nivel superior.
- La salida es muy grande: se conserva un búfer de reproducción acotado (512 KB) por sesión.
- La aplicación se cierra: todas las sesiones de terminal se terminan.
- Cambios de modelo en el nodo con una sesión abierta: no la interrumpen; aplican en el próximo
  lanzamiento o al pulsar "Restart".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Al seleccionar un nodo de agente, el canvas MUST mostrar un dock lateral con pestañas
  "Terminal" y "Settings", con "Terminal" activa por defecto.
- **FR-002**: La terminal MUST ser una pseudoterminal real (node-pty en el proceso principal,
  xterm.js en el renderer) donde la interfaz del agente se ve sin modificaciones.
- **FR-003**: El programa lanzado MUST ser la CLI del agente del nodo (`claude` o `codex`) con el
  modelo y el nivel de razonamiento del nodo o, si faltan, los valores por defecto del proyecto; o
  la shell del usuario si se elige "Shell".
- **FR-004**: El agente MUST ejecutarse dentro de la shell del usuario (PowerShell en Windows, la
  shell de login en Linux/macOS), en la raíz del proyecto, dejando al usuario en el prompt al salir.
- **FR-005**: Cada combinación proyecto + nodo + programa MUST tener una única sesión, que sobrevive
  al cierre del dock y se reconecta reproduciendo su salida reciente.
- **FR-006**: El dock MUST permitir cambiar de programa, pegar las instrucciones del nodo mediante
  bracketed paste y reiniciar la sesión.
- **FR-007**: El proceso principal MUST validar cada pedido del renderer: clave de sesión, directorio,
  tipo de terminal (solo `claude-code`, `codex` o `shell`), modelo (patrón seguro de hasta 80
  caracteres), nivel de razonamiento (solo letras minúsculas) y dimensiones (enteros entre 2 y 1000).
- **FR-008**: Los argumentos del comando MUST citarse para la shell de destino y MUST NOT permitir
  inyectar sintaxis de shell.
- **FR-009**: El entorno de la terminal MUST excluir las variables `ELECTRON_*`, `ZEKO_*` y los
  marcadores de sesión heredada de Claude Code, y definir `TERM=xterm-256color`,
  `COLORTERM=truecolor` y `TERM_PROGRAM=Zeko`.
- **FR-010**: La salida MUST enviarse al renderer en lotes cortos (8 ms) y en streaming.
- **FR-011**: Al terminar el proceso, la terminal MUST mostrar el código de salida y cómo relanzarlo.
- **FR-012**: El panel de salida de solo lectura de la spec 001 queda reemplazado por el dock; los
  resultados del nodo (panel de resultado) siguen disponibles.
- **FR-013**: Todos los textos de la interfaz MUST salir del catálogo de i18n.

### Non-Functional Requirements

- **NFR-001**: La interfaz MUST NOT bloquearse con varias terminales abiertas (constitución XVII).
- **NFR-002**: Cerrar una terminal cierra su pseudoconsola, lo que termina los procesos adjuntos a
  ella; es la única excepción, acotada a `pty-manager.ts`, a la regla de lint que restringe
  terminar procesos fuera del supervisor.
- **NFR-003**: En Windows se usa la ConPTY empaquetada con node-pty para que el ajuste de líneas sea
  el que xterm.js espera.

### Key Entities

- **Sesión de terminal**: identificador, clave (proyecto + nodo + programa), proceso de la
  pseudoterminal, búfer de reproducción acotado y código de salida si terminó.
- **Pedido de apertura**: clave de sesión, directorio, programa, modelo, nivel de razonamiento,
  columnas y filas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Seleccionar un nodo de agente muestra la interfaz de su CLI sin pasos manuales.
- **SC-002**: Cerrar y reabrir el dock conserva la conversación en el 100 % de los casos mientras la
  aplicación siga abierta.
- **SC-003**: Ningún valor enviado por el renderer puede ejecutar un comando distinto del programa
  elegido (cubierto por tests de validación de pedidos).

## Implementación

- `apps/desktop/src/main/pty-manager.ts`: sesiones PTY, validación de pedidos, comando por agente,
  entorno y citado para PowerShell/POSIX.
- `apps/desktop/src/main/index.ts` y `apps/desktop/src/preload/index.ts`: canales
  `terminal.open`, `terminal.restart`, `terminal.write`, `terminal.resize`, `terminal.data` y
  `terminal.exit`, fuera del puerto del motor.
- `apps/desktop/src/renderer/terminal/node-terminal.tsx`: terminal xterm.js con ajuste de tamaño,
  copiar/pegar y reconexión.
- `apps/desktop/src/renderer/panels/node-dock.tsx`: dock con pestañas y barra de control; el
  inspector de nodo se embebe en "Settings".
- Se eliminó `run/output-panel.tsx`. Dependencias nuevas: `node-pty` y `@xterm/addon-fit`.
- Tests: `apps/desktop/test/pty-manager.test.ts` (comandos por agente, rechazo de entradas con
  sintaxis de shell, límites de dimensiones).

## Assumptions

- El usuario ya instaló y autenticó las CLIs de los agentes (igual que en la spec 001).
- La terminal es una herramienta del usuario, no un paso del flujo: lo que el agente haga en ella se
  hace sobre el repositorio real, bajo responsabilidad del usuario, sin copia aislada.
- El diseño toma como referencia el proveedor de PTY local de Orca (MIT), sin usarlo como
  dependencia (constitución XIV).

## Out of Scope

- Vincular la conversación de la terminal con los runs, resultados o eventos del nodo.
- Ejecutar la terminal dentro de la copia aislada del nodo.
- Varias pestañas de terminal por nodo.

## Pendientes conocidos

- El test `packages/adapters/test/process/no-kill-by-name.test.ts` falla porque encuentra
  terminaciones de procesos en `apps/desktop/src/main/index.ts` y `pty-manager.ts`. La excepción se
  agregó en ESLint, pero no en ese test.
- La feature se implementó sin spec previa; esta spec la registra para cumplir el principio I de la
  constitución.
