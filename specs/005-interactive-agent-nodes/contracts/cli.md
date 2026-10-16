# Contrato: CLI `zeko` — cambios de 005

**Cubre**: FR-029, US3-7, caso límite "nodos interactivos en una rama posterior".
**Base**: [contracts/cli.md de 001](../../001-agent-flow-canvas/contracts/cli.md). Comandos,
argumentos, salida NDJSON y equivalencia con el escritorio (SC-008 de 001) rigen sin cambios, salvo
lo que sigue.

## Regla

La CLI **no ejecuta** flujos que contienen nodos interactivos. Los rechaza durante la validación,
antes de iniciar el run, e identifica cada nodo que requiere la interfaz (FR-029). La detección la
hace `validateFlow` de `core` con `host = cli` (research R5-12); la CLI no tiene lógica propia.

| Comando | Comportamiento con uno o más nodos `type: interactive` |
|---|---|
| `zeko validate <flow>` | Informa un error `INTERACTIVE_NODE_REQUIRES_DESKTOP` por nodo (archivo, línea, columna y `nodeId`) y sale con **2**. Los demás diagnósticos se informan igual. |
| `zeko run <flow>` | Paso 1 de 001 (carga y validación): mismo error, sale con **2**. No crea el run, no hace la verificación del repositorio ni la previa de agentes, y no lanza ningún nodo, aunque el nodo interactivo esté en una rama posterior. |
| `zeko runs list` / `zeko runs show <runId>` | Sin cambios. Un run iniciado en el escritorio que contiene nodos interactivos se muestra con sus estados, declaraciones, recaps (redactadas) y resultados reemplazados, igual que en el historial del escritorio (US4). |
| `zeko workspaces delete <runId>` | Sin cambios. |

**Por qué el código 2 y no el 3**: 001 reserva el 3 para "no se puede iniciar por el entorno" (repo,
agentes, TTY). Un nodo interactivo es una propiedad del flujo, detectable sin mirar el entorno, y
FR-029 dice "durante la validación". Es la misma familia que los errores de grafo.

**Diferencia con `APPROVAL_REQUIRES_TTY`** (001, código 3): los nodos de aprobación se pueden atender
desde la TTY de la CLI; los interactivos no, porque requieren la terminal del agente dentro de la
interfaz. Por eso uno depende del entorno y el otro no.

## Salida para humanos (stderr)

```text
error INTERACTIVE_NODE_REQUIRES_DESKTOP .zeko/flows/implement-adjust-review.flow.yaml:38:5 node "adjust"
  This flow contains interactive nodes. Run it from the Zeko desktop app.
```

El texto sale de `packages/i18n` (NFR-013 de 001).

## Salida `--json` (NDJSON)

El objeto `validation` de 001 lleva el diagnóstico con la misma forma que los demás:

```json
{"type":"validation","ok":false,"diagnostics":[{"code":"INTERACTIVE_NODE_REQUIRES_DESKTOP","severity":"error","nodeId":"adjust","file":".zeko/flows/implement-adjust-review.flow.yaml","line":38,"column":5}]}
```

No se emite `preflight` ni `run.started`.

## Códigos de salida

Sin códigos nuevos. Cambia la descripción del 2:

| Código | Significado |
|---|---|
| 2 | Flujo inválido para la CLI: parseo, schema, reglas de grafo **o nodos interactivos** (`INTERACTIVE_NODE_REQUIRES_DESKTOP`). |

## Equivalencia con el escritorio (SC-008 de 001)

La prueba de SC-008 sigue comparando flujos **sin** nodos interactivos. Para los interactivos se
agrega un test de `core`: el mismo flujo validado con `host = desktop` no tiene el error y con
`host = cli` lo tiene una vez por nodo.
