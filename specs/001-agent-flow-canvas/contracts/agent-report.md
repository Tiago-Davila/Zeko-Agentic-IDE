# Contrato: `AgentReport` (reporte estructurado del agente)

**Cubre**: FR-033, FR-034, FR-035, FR-037, FR-038, FR-042, Principio VII (`WorkReport`).
**Fuente de tipos**: el schema zod `AgentReport` en `packages/contracts`. `WorkReport` es un alias
exportado (research T-11). El JSON Schema de abajo **se genera** desde zod y es exactamente lo que
reciben los agentes: `--json-schema` en Claude `[001 §5]`, `[001b §A]`, y el mecanismo de schema
estricto de Codex `[001c-resumen]`, cuyo flag concreto es P-05.

## JSON Schema entregado al agente

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["status", "summary", "filesChanged", "checks", "blockers", "findings"],
  "properties": {
    "status": {
      "type": "string",
      "enum": ["COMPLETED", "BLOCKED", "FAILED"],
      "description": "COMPLETED: all acceptance criteria met. BLOCKED: could not proceed because something outside your control is missing or was denied. FAILED: you attempted the task and it did not meet the acceptance criteria."
    },
    "summary": {
      "type": "string",
      "description": "What you did and the outcome, in plain language."
    },
    "filesChanged": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Paths you modified, relative to the repository root. Empty if none."
    },
    "checks": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "outcome", "evidence"],
        "properties": {
          "name":     { "type": "string" },
          "outcome":  { "type": "string", "enum": ["PASSED", "FAILED", "NOT_RUN"] },
          "evidence": { "type": "string" }
        }
      },
      "description": "Verifications you performed. Empty if none."
    },
    "blockers": {
      "type": "array",
      "items": { "type": "string" },
      "description": "What prevented completion. Must be empty only if status is COMPLETED and nothing blocked you."
    },
    "findings": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Relevant observations for the next step. Empty if none."
    }
  }
}
```

## Reglas de diseño y su evidencia

| Regla | Por qué | Evidencia |
|---|---|---|
| `status` admite siempre `BLOCKED` y `FAILED` | Con `enum: ["DONE"]` el modelo reportó DONE sin poder hacer nada. | `[001b §A3]` `enum-only-done` |
| Listas sin `minItems`/`maxItems`, strings sin `minLength`/`maxLength` | Con cardinalidad mínima el modelo rellenó con `""` y duplicados, y zod lo aceptó. | `[001b §A3]` `impossible-constraints` |
| Todas las propiedades `required` y `additionalProperties: false` en todos los niveles | Es compatible con el modo estricto de Codex `[001c-resumen]` y con `--json-schema` de Claude `[001 §5]`. Lo opcional se expresa como lista o string vacíos. | |
| Palabras clave permitidas: `type`, `enum`, `properties`, `required`, `items`, `additionalProperties`, `description` | Es el subconjunto común más chico. Se evitan `oneOf`, `$ref`, `pattern`, `format` y `const`. Un test valida el JSON generado (U-10). | research R-06 |
| `findings` | Es un campo del Principio VII ("hallazgos"). Puede estar vacío. | research T-11 |
| Estados en inglés y mayúsculas | Van al agente y a la base. La UI los traduce con el catálogo (NFR-013). | |

## Validación del lado del motor

1. El adaptador obtiene el candidato:
   - Claude: `result.structured_output` `[001 §5]`;
   - Codex: fuente P-05.
2. Lo valida con zod `AgentReport.strict()`. El resultado es `valid`, `invalid` (con errores) o
   `absent`.
3. **No hay fallback silencioso**: nunca se extrae `{…}` del texto libre del `result`. `[001b §A2]`
   muestra que puede terminar con `success` sin `structured_output`.
4. Si el estado es `absent` o `invalid`, se hace **un** pedido adicional (FR-038, research R-16).
   Si persiste, el nodo queda `failed` con `REPORT_MISSING` o `REPORT_INVALID` (FR-036.3). También
   se trata como ausente un estado no válido (casos límite).
5. El motor **no** confía en `filesChanged`: lo compara con `observedFiles` de git (FR-037,
   research R-07).
6. Contenido como dato (FR-042): del reporte, el motor solo lee `status`, el largo de `blockers` y
   `filesChanged` (para comparar). Ningún texto del reporte cambia la ejecución, las aprobaciones ni
   los permisos.

## Instrucciones de reporte en el `TaskAssignment`

El prompt de cada nodo termina con una sección fija, igual para todos los agentes (FR-016). Esa
sección:

- define COMPLETED, BLOCKED y FAILED con las mismas palabras que las `description` de arriba;
- indica que un permiso denegado o un recurso faltante es BLOCKED, y que un criterio no cumplido
  después de intentarlo es FAILED;
- pide evidencia concreta en `checks[].evidence`.

Con definiciones explícitas, la clasificación fue 13/13 `[001b §A1]`.

## Uso posterior: resultado inyectado en el nodo siguiente (FR-040)

El nodo dependiente recibe, por cada predecesor, un objeto `PredecessorResult`:

```json
{
  "nodeId": "implement",
  "agent": "claude-code",
  "finalStatus": "completed",
  "reason": null,
  "report": { "...": "AgentReport completo" },
  "observedFiles": [{ "path": "src/signup/form.ts", "change": "M", "eolOnly": false }],
  "discrepancies": { "undeclared": [], "declaredNotObserved": [], "scopeViolations": [] }
}
```

Va serializado dentro de `<zeko-predecessor-results>`, marcado como datos no confiables
(research R-23). La forma es la misma sin importar qué agente lo produjo (FR-035, FR-014).
