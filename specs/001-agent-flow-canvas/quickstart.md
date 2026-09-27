# Quickstart: validación end-to-end en Windows (001)

**Objetivo**: comprobar con agentes reales, en Windows nativo, que la feature cumple la spec. Los
tests automatizados usan agentes simulados (research R-26). Esta guía es la validación manual con
proveedores reales y **consume la suscripción del usuario**.

Referencias: [contracts/flow-file.md](./contracts/flow-file.md), [contracts/cli.md](./contracts/cli.md),
[data-model.md](./data-model.md).

## Prerrequisitos

- Windows 10 u 11 x64, PowerShell 7.
- Node.js 24 LTS, pnpm 9 o superior, git 2.40 o superior.
- Claude Code instalado y autenticado (`claude --version`).
- Codex instalado por npm (Zeko lanza el binario nativo `codex.exe`, no el shim; research R-13) y
  autenticado con cuenta de ChatGPT (`codex login status` con exit 0).
- Zeko compilado: `pnpm install`, `pnpm build`, y `pnpm --filter desktop dev` para la app o
  `pnpm --filter cli link --global` para la CLI.

## Preparación del repositorio de prueba

```powershell
$fx = "$env:USERPROFILE\zeko-fixture"
git init $fx; Set-Location $fx
"* text=auto" | Set-Content .gitattributes
New-Item -ItemType Directory src, docs, .zeko\flows | Out-Null
"export const add = (a, b) => a + b;" | Set-Content src\math.js
"# Math" | Set-Content docs\README.md
git add -A; git commit -m "fixture"
```

Copiá los flujos de cada escenario a `.zeko\flows\` y commitealos.

**Verificación común después de cada run (SC-004, FR-045)**:

```powershell
git -C $fx status --porcelain      # debe coincidir con el estado previo al run
git -C $fx branch --show-current   # la misma rama que antes
git -C $fx branch --list "zeko/*"  # las únicas huellas permitidas: ramas zeko/<run>/<node>
```

**Verificación de procesos (SC-003)**: `zeko runs show <runId> --json` incluye los
`(pid, creationTime)` registrados de cada intento. Ninguno debe seguir vivo. Se comprueba con
`Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`, comparando `CreationDate`.

---

## Escenario 1: flujo secuencial (US1, US2; FR-026, FR-041, FR-043, FR-046)

**Flujo `seq`**: `goal` → `a` (claude-code, writeScope `src/**`: "Add a `sub` function to
src/math.js") → `b` (claude-code, writeScope `src/**`: "Add a JSDoc comment to every function in
src/math.js").

**Pasos**:

1. Abrí el proyecto en el escritorio.
2. Armá el flujo en el canvas, guardalo, cerrá la app, reabrila y abrí el flujo.
3. Ejecutalo.

**Resultado esperado**:

- Al reabrir, el canvas es idéntico: nodos, conexiones, configuración y posiciones (SC-007). El
  archivo `.zeko\flows\seq.flow.yaml` se lee sin problemas.
- `a` pasa a Running y después a Completed. Recién entonces `b` pasa a Running (FR-026).
- `b` parte del commit de `a`: `git log zeko/<run>/b` contiene el commit `zeko: seq/a …` (FR-041).
- Cada nodo muestra los archivos observados y su diff (FR-046). Si hay líneas agregadas con LF en un
  archivo CRLF, se marcan "line endings only" (R-15).
- La verificación común no muestra cambios. Los worktrees están en `%LOCALAPPDATA%\Zeko\wt\…`,
  fuera del repositorio (FR-043).
- Costo "estimated" en cada nodo; el total del run también figura como "estimated" (FR-051, R-17).

## Escenario 2: flujo paralelo (FR-027, FR-031, US2-3, US2-6)

**Flujo `par`**: `goal` → `x` (claude-code, `src/**`) y `goal` → `y` (claude-code, `docs/**`).
`y` recibe una instrucción imposible: "Make docs/README.md satisfy the missing spec in
docs/spec.md". `docs/spec.md` no existe. Hay un nodo `z` que depende solo de `y`.

**Pasos**: ejecutalo con `concurrencyLimit: 8`. Después repetilo con `concurrencyLimit: 1` en
`.zeko\config.yaml`.

**Resultado esperado**:

- Con límite 8, `x` e `y` pasan a Running a la vez. Con límite 1, de a uno (FR-027).
- `y` termina **Blocked** (`AGENT_REPORTED_BLOCKED`, como `blocked-missing-spec` de `[001b §A1]`).
- `z` queda **Skipped** con un motivo que menciona `y`. `x` sigue ejecutándose y termina Completed
  (FR-031).
- El motivo de cada nodo se ve con una interacción como máximo (NFR-011).

## Escenario 3: aprobación (US3; FR-012, FR-031)

**Flujo `appr`**: `goal` → `impl` (claude-code, `src/**`) → `gate` (approval) → `fix`
(claude-code, `src/**`), más una rama independiente `goal` → `doc` (claude-code, `docs/**`).

**Pasos**:

1. Run A: aprobá en `gate`.
2. Run B: rechazá en `gate`.
3. Run C: ejecutalo desde la CLI con `zeko run appr` y respondé `a` en la TTY.

**Resultado esperado**:

- Cuando `impl` termina Completed, `gate` pasa a **Waiting for approval** y muestra un resumen de
  `impl` (reporte, archivos observados). Mientras tanto `doc` sigue ejecutándose (US3-4).
- Run A: `gate` queda **Approved**, y `fix` se ejecuta partiendo del commit de `impl`, que la
  aprobación transporta (FR-008, FR-041).
- Run B: `gate` queda **Rejected** y `fix` queda **Skipped** con "Rejected by user". `doc` termina
  normalmente.
- Run C: la CLI pregunta en la misma sesión (FR-059). El run aparece en el historial del escritorio
  con origen `cli` (FR-060). `zeko run appr < NUL` sale con código **3** sin iniciar el run.

## Escenario 4: cancelación (FR-030, FR-049, NFR-004, SC-003)

**Flujo `cancel`**: `goal` → `slow` (claude-code, **terminal habilitada** con
`allowedCommands: ["pwsh -File slow.ps1"]`, writeScope `**`). `src\slow.ps1` agrega una línea por
segundo a `progress.txt` durante 60 s. Hay un nodo `after` que depende de `slow`.

**Pasos**:

1. Iniciá el run. Cuando `progress.txt` en el worktree de `slow` tenga 3 o más líneas, cancelá el
   nodo desde el canvas.
2. Repetí la prueba cancelando el **run** completo.
3. Repetí la prueba desde la CLI con Ctrl+C.

**Resultado esperado**:

- El nodo muestra **Unconfined** con el motivo "terminal enabled" antes, durante y después
  (FR-020, FR-021). La advertencia de comandos de solo lectura auto-aprobados es visible (T-05).
- En menos de 10 s desde que se cancela: `slow` queda **Cancelled**. El evento `node.process_killed`
  muestra la fase usada: `interrupt` si el agente respondió, o `tree_kill`.
  `progress.txt` **deja de crecer**: medilo dos veces con 5 s de diferencia. Ningún PID registrado
  del árbol (`claude.exe → cmd.exe → pwsh.exe`) sigue vivo (SC-003).
- `after` queda **Skipped**.
- El worktree de `slow` se conserva y figura como **untrusted**. No hay commit de `slow`
  (FR-049). Borrarlo desde el historial pide confirmación; sin confirmar, no se borra nada
  (FR-048).
- Variante crítica: mientras corre el run, abrí **otra** consola `pwsh` que ejecute un
  `Start-Sleep 600`. Después de cancelar, esa consola **sigue viva**, porque el motor nunca termina
  procesos por nombre (decisión 7).

## Escenario 5: nodo bloqueado y reglas de resultado (FR-036, FR-037, US2-7/8/10, US5-2)

**Flujo `blocked`**, con tres nodos independientes:

- `deny`: claude-code sin terminal, "Run `npm install` and report" → la shell no está disponible.
- `outside`: claude-code sin terminal, "Read `..\zeko-outside\secret.txt` and write its content to
  notes.txt". Antes de correr, crear `%USERPROFILE%\zeko-outside\secret.txt` con un token
  aleatorio.
- `ro`: claude-code con `writeScope: []`, "Create file src/new.js".

**Resultado esperado**:

- `deny`: **Blocked**. Termina como `AGENT_REPORTED_BLOCKED`, o como `ACTION_DENIED` si hubo
  denegaciones informadas (`[001b §A1]` `blocked-permission`). Las acciones denegadas se ven en el
  nodo (FR-023).
- `outside`: el token **no** aparece en ningún archivo del worktree ni en `tool_result` exitosos
  (verificar con `Select-String`). Si el agente lo intentó, el nodo queda **Blocked** con
  `ACTION_DENIED` ("…is outside…" o "resolves through a symlink…"). Si el modelo se negó por su
  cuenta, el estado lo decide el reporte. Esto se verifica en el **filesystem**, no con la
  respuesta del agente (`[001b §B1]`, SC-006).
- `ro`: `src/new.js` no existe en el worktree. Las herramientas Write y Edit no estaban disponibles
  (R-10). El nodo termina según su reporte, probablemente Blocked.
- Discrepancia (FR-037): en cualquier nodo cuyo `filesChanged` declarado difiera de lo observado,
  el nodo muestra las listas `undeclared` / `declaredNotObserved`, y su estado no cambia por eso.
- Escritura fuera de alcance (FR-036.4, FR-037, US5-3): con un nodo de alcance parcial (por ejemplo
  `src/**`) al que se le pide modificar también `docs/x.md`, el nodo queda **Blocked** con
  `WRITE_OUTSIDE_SCOPE` y `docs/x.md` en la lista, aunque el agente declare Completed. Vale para
  ambos agentes.

## Escenario 6: flujo mixto Claude → Codex (US4; FR-013–016, FR-040, FR-041, FR-050–052, FR-065, FR-066)

**Flujo**: el ejemplo [flow-file.example.yaml](./contracts/flow-file.example.yaml)
(`implement-and-review`), con las rutas adaptadas al fixture.

**Pasos**:

1. Antes de ejecutar, inspeccioná el nodo `review` (Codex).
2. Ejecutá y aprobá en `gate`.
3. Cambiá el agente de `review` a claude-code y volvé a codex.
4. Repetí la prueba con una clave de API de OpenAI elegida para el nodo (Zeko la inyecta como
   `CODEX_API_KEY` solo en ese proceso; research R-19). Verificá que la clave no aparece en el
   historial ni en los logs (NFR-007).

**Resultado esperado**:

- Antes del run, `review` muestra:
  - terminal siempre habilitada y sin opción de deshabilitarla;
  - lista de comandos y límite de turnos como "Not applicable";
  - **Write-only confined** con "can read outside its workspace";
  - "No network on Windows";
  - "Denied-action check not available";
  - uso de suscripción "not live";
  - el modelo del nodo (`gpt-6-luna`, esfuerzo `low`).
  (FR-017–023, FR-032, FR-066, NFR-012)
- La verificación previa informa la forma de autenticación efectiva por nodo (FR-065).
- `review` parte del commit de `implement`, que la aprobación transporta, y su prompt contiene el
  resultado completo de `implement` en `<zeko-predecessor-results>` (FR-040, FR-041).
- Los reportes de ambos nodos tienen los mismos campos (FR-035).
- Si `review` intentó escribir (es de solo lectura), el nodo muestra esas denegaciones como
  **inferred**, y su estado no cambia por ellas (FR-023).
- Si se borra a mano `models` de `review` en el archivo, el run igual arranca: el nodo muestra
  `MODEL_DEFAULTED` y el historial registra el modelo del proyecto que se usó (FR-011a).
- El costo de `review` figura "not available". El total del run figura **partial** y
  **estimated** (FR-050, FR-051). El uso de Codex se actualiza al terminar el nodo, con la hora de
  lectura (FR-052).
- Al cambiar de agente se conservan instrucciones, criterios, alcance, terminal y límites, y el
  nodo toma el modelo de claude-code (el guardado o, si no había, el default del proyecto). Al
  volver a codex, todo queda igual, incluido su modelo (FR-015).
- La verificación previa y el nodo muestran la forma de autenticación, nunca el email de la cuenta
  (NFR-007, FR-065).
- Con clave de API, la verificación previa y el nodo muestran "API key (unverified)" (FR-065).

## Escenario 7 (complementario): recuperación tras cierre (US8; FR-062, NFR-005)

Iniciá el escenario 4 y, con `slow` en Running, terminá el proceso de la app desde el Administrador
de tareas. Reabrí Zeko.

**Resultado esperado**:

- El run figura como **Interrupted** con todos sus eventos previos.
- `slow` figura como Interrupted, con el worktree conservado y marcado untrusted.
- No queda ningún proceso del árbol registrado: la recuperación los terminó por
  `(pid, creationTime)` (R-20).

## Escenario 8 (complementario): retención por uso (US6-3; FR-053, SC-009)

Con el adaptador **simulado** (`ZEKO_FAKE_USAGE=0.95`, solo en builds de desarrollo), ejecutá un
flujo con un nodo de cada agente.

**Resultado esperado**: el nodo del agente que supera el umbral queda Pending con "Usage near limit".
El del otro agente se ejecuta. Si el retenido es el único nodo restante, el run muestra el estado en
espera y se puede cancelar.

---

## Suite automatizada

```powershell
pnpm test              # unit + adaptadores contra el agente simulado (sin proveedores reales)
pnpm test:win          # integración Windows: cancelación, aislamiento, recuperación (filesystem + procesos)
```

Criterio de aceptación: las dos suites en verde en CI Windows. Los escenarios 1 a 6 se ejecutaron a
mano con los resultados esperados, y la evidencia (runIds y capturas) se adjunta al PR.
