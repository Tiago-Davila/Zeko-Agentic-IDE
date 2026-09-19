# Backlog de huecos funcionales del frontend

Producido por la tarea `UI-014` del trabajo de diseño UI/UX autorizado por
`UX-OVERRIDE-20260915`. Documento; no cambia código ni contratos.

## Para qué sirve

El rediseño de UI-001 a UI-013 dejó reservado en pantalla el lugar de varias capacidades que
el backend ya tiene o que le faltan. Este documento traza cada hueco a su endpoint y su
pantalla, para que se implementen por SDD (`specify → clarify → checklist → plan → tasks →
analyze → implement`) y no por conveniencia desde un componente.

**Nada de lo que está acá se implementó.** El diseño muestra estados vacíos honestos, no
simula datos ni confirma acciones que no ocurrieron.

## 1. Capacidades sin superficie HTTP

Lo más importante de esta lista. Son comportamientos implementados en el backend que **ningún
controller expone**, así que la UI no puede alcanzarlos por más que se diseñe la pantalla.

| Capacidad | Dónde vive hoy | Qué reserva el diseño | Severidad |
|---|---|---|---|
| **Publicación de eventos** | `LocalEventSocket.publish` no tiene ningún llamador de producción; solo lo invoca `WebSocketContractTest` | Todo el Runtime Canvas: LED pulsante, reconciliación por secuencia, estado de proveedores | **Alta.** El socket se conecta y nunca recibe nada. La UI muestra «se conserva el último snapshot», que es literalmente el estado real |
| **Despacho de acción autorizada** | `AuthorizedActionDispatcher.dispatch` y `ExecutionActivationService.dispatch` sin controller | Nada puede ejecutarse desde la UI | **Alta** |
| **Creación de `ActionProposal` y `Approval`** | `ApprovalRepository.saveAction` / `Approval.pending` solo se llaman desde tests | `ApprovalPrompt` en el inspector de Runtime | **Alta.** `GET /api/projects/{id}/approvals` no puede devolver nada en una corrida real |
| **Terminal** | `LocalTerminalAdapter` con capacidad `EXECUTE_LOCAL`, sin endpoint | `TerminalPanel`, hoy marcado con `DemoBadge` y sin input ejecutable | Media |
| **Estado de proveedores** | `CapabilityRegistry.supports` sin endpoint | `ProviderStatusPanel`; hoy adivina Docker/Ollama desde eventos que nunca llegan | Media |
| **Commit autorizado** | `AuthorizedCommitService` + `GitCommitAdapter` sin controller | Sin superficie reservada | Media |
| **Creación de follow-ups** | `InitiativePolicy` no se referencia en ningún lado | Tarjeta de follow-up en el chat | Media |
| **Listado de conversaciones** | `ConversationRepository.findByProjectId` implementado y sin usar | Historial en la pestaña Chat del dock | Baja |
| **Modelos de Ollama** | `LocalModelGateway` fija el modelo `"local"` | Selector «Modelo local» en el alta de plantilla, hoy con una sola opción | Baja |
| **Worktrees** | Sin endpoints de listado, liberación ni reasignación | Solo observables indirectamente vía conflictos | Baja |

## 2. Endpoints existentes sin llamador en el frontend

Estos ya tienen contrato HTTP. Conectarlos es capacidad funcional nueva —queda fuera del
alcance de diseño— pero no requiere trabajo de backend.

| Endpoint | Pantalla que reserva el diseño |
|---|---|
| `POST /api/tasks` · `POST /api/tasks/{id}/executions` | Acción «Nueva tarea» en Runtime Canvas |
| `GET /api/tasks/{taskId}` | Detalle de nodo de tarea en el inspector de Runtime |
| `POST /api/executions/{id}/cancel-confirmations` | Confirmación en `ExecutionControls`, que hoy solo solicita la cancelación |
| `POST /api/follow-up-proposals/{id}/decisions` | Tarjeta de follow-up en el chat |
| `POST /api/agent-instances/{id}/template-updates` | Aviso de versión nueva en el inspector de agentes |
| `GET /api/agent-instances/{instanceId}` | Detalle de instancia al seleccionar su nodo |
| `POST /api/agent-templates/{id}/global-promotions` · `POST /api/skills/{id}/global-promotions` | Acción «Promover a global» en la Librería |
| `POST /api/projects/{projectId}/memory-sources` | Acción «Indexar fuente» en la Librería |
| `GET /api/conversations/{conversationId}` | Recuperar una conversación existente al reabrir el proyecto |
| `GET /api/projects/{projectId}` | Refrescar el proyecto activo sin volver al launcher |
| `GET /api/session` | Verificar la sesión sin re-bootstrap |

## 3. Huecos de escritura en modelos de solo lectura

Sin endpoint y sin superficie: se listan para que no se descubran tarde.

- No hay actualización ni borrado de proyecto o repositorio.
- No hay desvinculación ni desactivación de una skill ya asociada (`AgentSkillBinding.State`
  tiene `DISABLED` y nada lo produce).
- No hay listado de versiones de plantilla: `TemplateResponse` solo devuelve la vigente, así
  que el inspector no puede ofrecer elegir entre versiones.
- No hay borrado de instancia de agente.
- No hay listado, borrado ni reindexado de memory sources; `ContextIndex.rebuild` y los
  estados `STALE` y `EXCLUDED` no tienen API.

## 4. Observaciones de contrato encontradas durante el diseño

No son huecos de UI, pero se detectaron leyendo el backend para diseñar y conviene no
perderlas:

- `GET /api/runtime/snapshot` devuelve **todas** las ejecuciones sin filtro de proyecto ni
  paginación. La variante por proyecto existe aparte. El frontend usa la global cuando no hay
  proyecto seleccionado.
- La migración `V012` agrega `executions.provider` **sin `CHECK`**, a diferencia de todas las
  demás columnas de enum del schema.
- Los seis módulos de API del frontend duplican el helper `session()` de bootstrap.
  Consolidarlo es refactor, no diseño.

## 5. Deuda de pruebas declarada

Durante el rediseño se ajustaron pruebas por cambios de navegación o de ubicación, siempre
agregando pasos y **sin relajar ninguna aserción**. Quedan registradas acá para revisión:

| Prueba | Ajuste | Motivo |
|---|---|---|
| `tests/unit/app.test.tsx` | Entra al workspace desde el launcher; cuenta las tabs dentro del tablist de superficies; espera 3 superficies | El launcher pasó a ser la pantalla inicial y se agregó la superficie de arquitectura |
| `tests/e2e/state-latency.spec.ts` | Usa «Abrir workspace sin proyecto» | Mide el snapshot global sin proyecto y el launcher es la pantalla inicial |
| `tests/e2e/memory-scope.spec.ts` | Abre la pestaña Librería | La búsqueda de contexto se mudó al dock |
| `tests/unit/workspace-shell.test.tsx` | Aserción invertida | Architecture Canvas autorizado por `UX-ARCH-20260915` |

Se corrigió además un fallo **preexistente** en `memory-scope.spec.ts` (`UI-009a`), causado por
dos instancias de `MemoryPanel` con el mismo `id` y el mismo nombre accesible. La afirmación de
`docs/validation/mvp-audit-2026-09-15.md` de que «13 pruebas simuladas pasan» no se sostenía
antes de ese arreglo: eran 12 de 13.
