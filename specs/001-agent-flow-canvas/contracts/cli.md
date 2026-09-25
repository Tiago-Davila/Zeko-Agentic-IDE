# Contrato: CLI `zeko`

**Cubre**: FR-059, FR-060, FR-024, FR-025, FR-030, FR-048, FR-050, FR-051, US7, SC-008, NFR-006,
NFR-013.
**Implementación**: `apps/cli`. Usa **el mismo** `packages/runtime` que el escritorio (research
R-01), con las mismas validaciones, reglas y estados. Todos los textos vienen de `packages/i18n` y
están en inglés.

## Comandos

```text
zeko validate <flow> [--project <dir>] [--json]
zeko run <flow> [--project <dir>] [--json] [--no-color]
zeko runs list [--project <dir>] [--flow <flowId>] [--limit <n>] [--json]
zeko runs show <runId> [--json]
zeko workspaces delete <runId> [--yes]
zeko agents check [--project <dir>] [--json]
```

| Argumento | Semántica |
|---|---|
| `<flow>` | Id del flujo (`implement-and-review`) o ruta a un `.flow.yaml` dentro de `<repo>/.zeko/flows/`. |
| `--project <dir>` | Raíz del repositorio. Por defecto, el directorio actual. Debe ser un repositorio git (FR-002). |
| `--json` | Salida NDJSON a stdout, un objeto por línea, con los schemas `CliEvent` de `contracts`. Los mensajes para humanos van a stderr. |
| `--yes` | Confirma la eliminación de copias aisladas (FR-048). Sin `--yes` y con TTY, se pregunta; sin TTY y sin `--yes`, no se elimina nada y sale con 64. |

## `zeko run`: comportamiento

1. Carga y valida el flujo (FR-009). Si hay errores, los imprime con archivo, línea, columna y
   nodo, y sale con **2**.
2. Verificación del repositorio: sin commits, sale con **3**. Si hay cambios sin confirmar, avisa
   `UNCOMMITTED_CHANGES_EXCLUDED` y sigue.
3. Verificación previa de agentes (FR-025, FR-065): informa el estado y la forma de autenticación
   efectiva por nodo. Si falta algún agente, sale con **3** sin crear el run.
4. **Aprobaciones (FR-059, US7-3)**: si el flujo tiene nodos de aprobación y stdin **no** es una
   TTY, sale con **3** (`APPROVAL_REQUIRES_TTY`) **antes** de iniciar. Nunca aprueba ni rechaza
   solo (NFR-006).
5. Ejecución con el motor compartido. Cada cambio de estado se imprime como
   `[hh:mm:ss] <nodeId> <Status> <reason>`. La salida en vivo de los agentes **no** se imprime por
   defecto; se ve con `zeko runs show <runId>` o en el escritorio.
6. Cuando un nodo pasa a `waiting_approval`, se imprime el resumen de los predecesores y se pregunta
   `Approve node "<id>"? [a]pprove / [r]eject`. Mientras tanto, las ramas independientes siguen
   ejecutándose (US3-4).
7. **Ctrl+C**:
   - el primero cancela el run (FR-030) con cancelación en dos fases por nodo;
   - el segundo, dentro de los 3 s siguientes, fuerza la terminación inmediata de los árboles.
   - En los dos casos el proceso espera a que el supervisor confirme que no queda ningún proceso y
     sale con **4**.
8. Resumen final (US7-2): una tabla por nodo con estado, motivo, agente, costo (`n/a` si falta,
   `~` si es estimado) y tokens. Después, el total del run marcado `(partial)` o `(estimated)` según
   FR-051, y el `runId`. El run queda en el historial compartido con el escritorio (FR-060).

## Códigos de salida

| Código | Significado |
|---|---|
| 0 | Run `finished` y todos los nodos `completed` o `approved`. También: `validate` sin errores, `agents check` con todo disponible. |
| 1 | Run `finished` con algún nodo `blocked`, `failed`, `rejected` o `skipped`. |
| 2 | Flujo inválido: parseo, schema o reglas de grafo. |
| 3 | No se puede iniciar: no es un repositorio git, no tiene commits, falta un agente o no está autenticado, o hay aprobaciones sin TTY. |
| 4 | Run `cancelled` por el usuario. |
| 5 | Error interno del motor (con código en stderr y en la base). |
| 64 | Uso incorrecto: argumentos inválidos, o falta confirmación en una acción destructiva. |

## Salida `--json` (NDJSON)

Un objeto por línea, validado con zod. Los tipos son un subconjunto de los eventos de IPC con la
misma forma ([ipc.md](./ipc.md)):

- `validation`
- `preflight`
- `run.started`
- `node.state`
- `approval.requested`
- `node.result`
- `run.finished`

`approval.requested` se emite en NDJSON y la pregunta va por stderr y la TTY. Sin TTY se aplica el
punto 4. Ejemplo de la línea final:

```json
{"type":"run.finished","runId":"0192f3…","status":"finished","outcome":"some_not_succeeded","totals":{"amountUsd":0.41,"partial":true,"estimated":true},"nodes":[{"nodeId":"implement","agent":"claude-code","status":"completed","cost":{"amountUsd":0.41,"basis":"list_price_estimate"}},{"nodeId":"review","agent":"codex","status":"blocked","reason":{"code":"AGENT_REPORTED_BLOCKED"}}]}
```

## Equivalencia con el escritorio (SC-008)

- La CLI y el escritorio llaman a la misma función `runtime.startRun` con la misma base SQLite.
  Lo único que cambia es el valor de `origin`.
- La prueba de SC-008 corre el mismo flujo contra el agente simulado desde los dos orígenes y
  compara los `NodeResult` finales.
