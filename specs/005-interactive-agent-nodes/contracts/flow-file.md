# Contrato: archivo de flujo — cambios de 005

**Cubre**: FR-001, FR-002, FR-003, FR-004, FR-016, FR-021, FR-029, SC-001.
**Base**: [contracts/flow-file.md de 001](../../001-agent-flow-canvas/contracts/flow-file.md). Todo
lo que no se menciona aquí (ubicación, `schemaVersion: 1`, serialización canónica, errores de carga,
conflictos de edición externa, `.zeko/config.yaml`) rige sin cambios.
**Fuente de tipos**: el schema zod `FlowFile` en `packages/contracts`, con un miembro nuevo en la unión
`FlowNode`.

## `schemaVersion`

Sigue siendo `1`. El cambio es aditivo: un archivo de 001 sigue siendo válido. Un Zeko anterior a
esta feature rechaza un archivo con `type: interactive` con `SCHEMA_ERROR` en esa línea (FR-057 de
001), sin modificarlo.

## Nodo interactivo (vista JSON Schema)

Se agrega a `$defs.node.oneOf`:

```json
{
  "interactiveNode": {
    "type": "object", "additionalProperties": false,
    "required": ["id", "type", "position", "agent", "models", "writeScope", "terminal",
                 "requiresChanges", "limits"],
    "properties": {
      "id": { "$ref": "#/$defs/nodeId" }, "type": { "const": "interactive" },
      "label": { "type": "string" }, "position": { "$ref": "#/$defs/position" },
      "agent": { "enum": ["claude-code", "codex"] },
      "models": {
        "type": "object", "additionalProperties": false,
        "description": "Igual que agentNode.models. La entrada del agente actual es obligatoria (regla de core, FR-002)",
        "properties": {
          "claude-code": { "$ref": "#/$defs/claudeModel" },
          "codex": { "$ref": "#/$defs/codexModel" }
        }
      },
      "instructions": {
        "type": "string",
        "description": "Opcional. Zeko la muestra al usuario al abrir la sesión y nunca la envía al agente (FR-017)"
      },
      "writeScope": { "$ref": "#/$defs/writeScope" },
      "terminal": { "$ref": "#/$defs/terminal" },
      "requiresChanges": {
        "type": "boolean",
        "description": "Si es true, declarar COMPLETED sin cambios observados es una inconsistencia visible (FR-021)"
      },
      "limits": {
        "type": "object", "additionalProperties": false,
        "required": ["timeoutMinutes"],
        "properties": { "timeoutMinutes": { "type": "integer", "minimum": 1, "maximum": 1440 } }
      }
    }
  }
}
```

`claudeModel`, `codexModel`, `writeScope` y `terminal` son las mismas definiciones que usa
`agentNode` en 001; en el JSON Schema generado se extraen a `$defs` para no duplicarlas (una sola
fuente zod).

Notas:

- **Modelo explícito (FR-002)**: el schema exige `models`, y `core` exige además que tenga la entrada
  del `agent` actual. Si falta, el error es `SCHEMA_ERROR` en `nodes[i].models`, con línea y columna.
  A diferencia del nodo de agente (FR-011a de 001), **no** se usa el default del proyecto como último
  recurso. El editor copia `defaultModels` del proyecto al crear el nodo o al cambiar de agente, igual
  que en 001, y conserva las entradas de otros agentes (FR-015 de 001).
- **Sin campos de ejecución de agente no interactivo**: `acceptanceCriteria`, `limits.maxTurns` y
  `limits.maxRetries` no existen en este tipo y producen `SCHEMA_ERROR`.
- **Sin secretos (FR-003)**: `additionalProperties: false` en todos los niveles, igual que 001. La
  definición no guarda cuentas, tokens, `CODEX_HOME` ni rutas de sesión del agente.
- **Límite finito (FR-002, FR-010)**: no existe un valor "sin límite"; falta o fuera de rango es
  `SCHEMA_ERROR` / `INVALID_LIMIT`.
- **Tipo visible (FR-001)**: el canvas distingue los nodos por `type`. Pasar un nodo de `agent` a
  `interactive` o al revés es un cambio de tipo en el editor: los campos compartidos (`agent`,
  `models`, `instructions`, `writeScope`, `terminal`, `limits.timeoutMinutes`) se conservan; los
  exclusivos se descartan con confirmación.

## Reglas de validación agregadas

Ver [data-model.md §1](../data-model.md#validación--agregados). La relevante para este contrato:

| Código | Contexto | Efecto |
|---|---|---|
| `INTERACTIVE_NODE_REQUIRES_DESKTOP` | `host = cli` (`zeko validate`, `zeko run`) | Error por cada nodo interactivo, con `nodeId` y línea. El archivo sigue siendo válido para el escritorio. |
| `INTERACTIVE_AGENT_UNSUPPORTED` | cualquiera | Error si el adaptador no declara `interactive.supported`. |

## Serialización canónica

Sin cambios: claves en el orden del schema de arriba. `instructions` vacío se omite del archivo; si
está, va como block scalar `|`. `requiresChanges` se escribe siempre (también `false`) para que el
diff muestre cuándo cambia.

## Ejemplo

[flow-file.example.yaml](./flow-file.example.yaml): entrada → implementación (Claude Code, no
interactivo) → ajuste interactivo (Codex) → revisión (Claude Code), con una rama independiente de
documentación. Es el flujo del escenario 1 de [quickstart.md](../quickstart.md).
