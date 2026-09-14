# Contrato WebSocket local

## Alcance

El WebSocket local publica observabilidad; los comandos sensibles siguen HTTP y se
revalidan en backend. La conexión se abre en `ws://127.0.0.1:<puerto>/api/ws/events`,
solo desde loopback, con la cookie `zeko_local_session` emitida por `POST /api/session/bootstrap`.
El handshake rechaza origen, host o sesión inválidos. No representa acceso remoto,
cuentas, colaboración cloud ni RBAC.

## Envelope común

Cada evento contiene `eventId`, `eventType`, `occurredAt`, `correlationId`, `sequence`,
`projectId` y `payload`. `sequence` aumenta por Execution o recurso emitido; el cliente
deduplica por `eventId` y, tras reconectar, solicita por HTTP el estado actual antes de
considerar completa la secuencia. Un evento no constituye autorización para ejecutar.

```json
{
  "eventId": "uuid",
  "eventType": "execution.state.changed",
  "occurredAt": "2026-09-13T00:00:00Z",
  "correlationId": "uuid",
  "sequence": 18,
  "projectId": "uuid",
  "payload": { "executionId": "uuid", "taskId": "uuid", "state": "WAITING_APPROVAL" }
}
```

## Eventos de servidor

| Event type | Payload mínimo | Garantía visible |
|---|---|---|
| `execution.state.changed` | executionId, taskId, state, knownState, provider? | Comunica PENDING, RUNNING, WAITING_APPROVAL, COMPLETED, FAILED o CANCELLED. |
| `execution.effect.recorded` | executionId, effectId, type, resource, confirmed | Muestra solo efectos confirmados y redactados. |
| `approval.requested` | approvalId, actionRevision, agent, task, resource, action, scope, expectedEffects | Runtime Canvas puede mostrar el prompt legible. |
| `approval.invalidated` | approvalId, oldRevision, newRevision, reason | Una respuesta tardía no autoriza la revisión nueva. |
| `approval.decided` | approvalId, state, decisionAt | Expone aprobación o denegación vinculada. |
| `worktree.reserved` | worktreeId, repositoryId, taskId, path | Informa ownership exclusivo. |
| `task.blocked` | taskId, conflictId, conflictType, resolutionOptions | Expone cancelar, reasignar o resolver manualmente. |
| `task.conflict.resolved` | taskId, conflictId, resolution | Indica resolución explícita; nunca merge automático. |
| `provider.unavailable` | provider, executionId?, knownState, retryAllowed | Docker u Ollama identificados; no informa éxito falso. |
| `memory.index.changed` | projectId, sourceId, state | Indica CURRENT, STALE, UNAVAILABLE o EXCLUDED sin exponer contenido secreto. |
| `trace.link.created` | traceLinkId, source, target, relation | Permite refrescar evidencia de trazabilidad. |
| `pm.reported` | conversationId, instructionId?, kind, summary, relatedResourceIds | Comunica avance, bloqueo o resultado del PM con trazabilidad. |
| `follow-up.proposed` | proposalId, instructionId, agentInstanceId, state, summary | Muestra propuesta de `ASSISTED`; no crea una Task por sí mismo. |
| `follow-up.decided` | proposalId, state, taskId? | Expone confirmación, rechazo o expiración de la propuesta. |

## Reconexión y orden

La pérdida de socket no cambia el estado de Execution. Tras reconectar, el cliente usa
`GET /api/projects/{projectId}/runtime-snapshot` y, cuando necesita detalle, `GET
/api/tasks/{taskId}`, `GET /api/executions/{executionId}` o `GET
/api/approvals/{approvalId}`. No solicita reanudar una ejecución. Si llega un evento con
secuencia anterior, se conserva el estado ya confirmado. Si hay hueco de secuencia, el
cliente vuelve a consultar el recurso y muestra el estado conocido, no una conclusión
inferida.

## Eventos de cliente permitidos

El cliente solo puede enviar `subscribe` y `unsubscribe` con `projectId` y filtros de
Execution/Task. El primer frame de la conexión MUST ser `subscribe`; el servidor valida
que Project, filtros y sesión están dentro del alcance local antes de confirmar la
suscripción. La suscripción no permite cambiar permisos, iniciar acciones, cancelar,
aprobar ni resolver conflictos; esas mutaciones se realizan mediante HTTP autenticado
por sesión local y validado por el dominio.
