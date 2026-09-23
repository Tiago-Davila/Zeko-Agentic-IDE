# Contrato: archivo de flujo (`.zeko/flows/<flowId>.flow.yaml`)

**Cubre**: FR-004–012, FR-015, FR-017, FR-018, FR-032, FR-054–058, SC-007, NFR-007, NFR-008.
**Formato**: YAML 1.2. La justificación está en [research.md R-04](../research.md#r-04--formato-del-archivo-de-flujo-yaml).
**Fuente de tipos**: el schema zod `FlowFile` en `packages/contracts`. El JSON Schema de abajo es
una vista de ese schema; en el build se genera desde zod y el repositorio versiona una copia en
`packages/contracts/generated/flow.schema.json`.

## Ubicación y nombre

- Un archivo por flujo, en `<repo>/.zeko/flows/` (FR-054, Principio V).
- Nombre del archivo: `<id>.flow.yaml`. El campo `id` tiene que coincidir con el nombre; si no
  coincide, el error es `SCHEMA_ERROR` y apunta a `id`.
- Configuración del proyecto: `<repo>/.zeko/config.yaml`, al final de este documento.
- Codificación UTF-8 sin BOM. Zeko escribe siempre con finales de línea LF.

## Schema (vista JSON Schema)

```json
{
  "$id": "https://zeko.dev/schema/flow/1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "id", "name", "nodes", "edges"],
  "properties": {
    "schemaVersion": { "const": 1 },
    "id":   { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]{0,39}$" },
    "name": { "type": "string", "minLength": 1 },
    "nodes": { "type": "array", "items": { "$ref": "#/$defs/node" } },
    "edges": { "type": "array", "items": { "$ref": "#/$defs/edge" } }
  },
  "$defs": {
    "nodeId":   { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]{0,39}$" },
    "position": {
      "type": "object", "additionalProperties": false, "required": ["x", "y"],
      "properties": { "x": { "type": "integer" }, "y": { "type": "integer" } }
    },
    "node": { "oneOf": [
      { "$ref": "#/$defs/inputNode" }, { "$ref": "#/$defs/agentNode" }, { "$ref": "#/$defs/approvalNode" }
    ]},
    "inputNode": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "type", "position", "objective"],
      "properties": {
        "id": { "$ref": "#/$defs/nodeId" }, "type": { "const": "input" },
        "label": { "type": "string" }, "position": { "$ref": "#/$defs/position" },
        "objective": { "type": "string", "minLength": 1 }
      }
    },
    "agentNode": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "type", "position", "agent", "instructions", "acceptanceCriteria",
                   "writeScope", "terminal", "limits"],
      "properties": {
        "id": { "$ref": "#/$defs/nodeId" }, "type": { "const": "agent" },
        "label": { "type": "string" }, "position": { "$ref": "#/$defs/position" },
        "agent": { "enum": ["claude-code", "codex"] },
        "instructions": { "type": "string", "minLength": 1 },
        "acceptanceCriteria": { "type": "array", "items": { "type": "string" } },
        "writeScope": {
          "type": "array",
          "items": { "type": "string", "minLength": 1,
                     "description": "Glob relativo a la raíz del repo, separador '/', sin '..' ni ruta absoluta" }
        },
        "terminal": {
          "type": "object", "additionalProperties": false, "required": ["enabled", "allowedCommands"],
          "properties": {
            "enabled": { "type": "boolean" },
            "allowedCommands": { "type": "array", "items": { "type": "string", "minLength": 1 } }
          }
        },
        "limits": {
          "type": "object", "additionalProperties": false,
          "required": ["timeoutMinutes", "maxTurns", "maxRetries"],
          "properties": {
            "timeoutMinutes": { "type": "integer", "minimum": 1, "maximum": 1440 },
            "maxTurns":       { "type": "integer", "minimum": 1, "maximum": 500 },
            "maxRetries":     { "type": "integer", "minimum": 0, "maximum": 5 }
          }
        }
      }
    },
    "approvalNode": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "type", "position"],
      "properties": {
        "id": { "$ref": "#/$defs/nodeId" }, "type": { "const": "approval" },
        "label": { "type": "string" }, "position": { "$ref": "#/$defs/position" }
      }
    },
    "edge": {
      "type": "object", "additionalProperties": false, "required": ["from", "to"],
      "properties": { "from": { "$ref": "#/$defs/nodeId" }, "to": { "$ref": "#/$defs/nodeId" } }
    }
  }
}
```

Notas:

- **Sin campos para secretos (FR-058, NFR-007)**: `additionalProperties: false` en todos los
  niveles. Un campo desconocido es `SCHEMA_ERROR`, así que no se puede agregar `env`, `apiKey` ni
  nada parecido.
- **Límites obligatorios y finitos (NFR-008)**: no existe un valor para "sin límite".
- **Campos conservados entre agentes (FR-015)**: `terminal`, `allowedCommands` y `maxTurns` se
  guardan siempre, aunque el agente actual no los use. El editor los muestra como "Not applicable
  for Codex" sin borrarlos.
- **Reglas de grafo**: el schema no expresa ciclos, fuentes de código, conectividad ni que los
  endpoints existan. Esas reglas las valida `core` (ver
  [data-model.md §Reglas de validación](../data-model.md#reglas-de-validación-del-flujo-packagescorevalidation)).

## Serialización canónica (SC-007)

Zeko escribe el archivo de forma determinista:

- Claves en el orden del schema.
- `nodes` en el orden en que se crearon y `edges` ordenadas por `(from, to)`.
- Posiciones redondeadas a entero.
- Indentación de 2 espacios.
- Strings multilínea como block scalar `|`.

Garantía: `parse(serialize(f)) == f`. Los comentarios de un archivo editado a mano se conservan al
reescribirlo, si se confirma U-09.

## Errores de carga (FR-057)

| Código | Ubicación informada | Efecto |
|---|---|---|
| `FILE_PARSE_ERROR` | línea y columna de `yaml` | El flujo se lista como inválido. El archivo **no se modifica** y la app sigue funcionando. |
| `SCHEMA_ERROR` | path zod (`nodes[2].limits.timeoutMinutes`) → línea y columna | Igual al anterior. |
| Errores de grafo | `nodeId` / `edge` (+ línea) | El flujo se abre en el canvas con los errores marcados en cada nodo (FR-009). |

## Conflictos de edición externa (casos límite)

`flow.save` lleva `expectedHash`, que es el sha256 del contenido leído. Si el archivo en disco
cambió, el guardado se rechaza con `FILE_CHANGED_ON_DISK` y la UI ofrece recargar o conservar la
versión propia, sin sobrescribir en silencio. Ver [ipc.md](./ipc.md).

## Configuración del proyecto: `.zeko/config.yaml`

```yaml
schemaVersion: 1
concurrencyLimit: 8            # FR-027, 1..64, global por proyecto, sin sub-límite por agente
usageNearLimitThreshold: 0.9   # FR-053, 0.5..1.0, fracción del uso informado por el agente
```

Todos los campos son opcionales, con esos defaults; se usa `additionalProperties: false`.

## Ejemplo

[flow-file.example.yaml](./flow-file.example.yaml) es un flujo mixto: entrada → implementación
(Claude Code) → aprobación → revisión (Codex, solo lectura), con una rama paralela de documentación.
