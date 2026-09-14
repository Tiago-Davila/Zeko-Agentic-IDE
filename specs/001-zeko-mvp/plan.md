# Plan de implementación: Zeko Agentic IDE - MVP local-first

**Branch**: `feature/001-zeko-mvp` | **Fecha**: 2026-09-13 | **Spec**: [spec.md](spec.md)
**Feature**: `001-zeko-mvp` | **Estado**: Plan técnico completo; listo para generar
`tasks.md`.

## Resumen

El MVP entrega un ciclo local y trazable: proyecto con múltiples repositorios,
configuración de agentes y skills, instrucciones al PM o a un agente, autorización
de acciones, ejecución aislada mediante worktrees, observabilidad y revisión de diff.
Se propone un monolito modular Spring Boot y una SPA local React. SQLite conserva
metadata y trazabilidad; Lucene conserva el índice reconstruible de búsqueda local.

El diseño preserva Agents Canvas y Runtime Canvas como superficies separadas. Los
permisos se aplican en el límite de ejecución, las aprobaciones quedan ligadas a una
revisión exacta de acción y las ejecuciones usan un snapshot inmutable de la
configuración de agente seleccionada al iniciarse.

## Contexto técnico

| Aspecto | Decisión |
|---|---|
| Lenguaje | Java 21 LTS para backend; TypeScript para frontend. |
| Backend | Spring Boot 3.5.16, Spring MVC y WebSocket en monolito modular. |
| Build backend | Gradle Wrapper 8.14.3, compatible con Java 21 y Spring Boot 3.5.16. |
| Frontend | React 19.3.0, Vite 8.1.0 y `@xyflow/react` 12.x compatibles con Node.js 22.12+. |
| Paquetes frontend | npm; `package-lock.json` conserva versiones exactas, sin rangos flotantes, como fuente reproducible de dependencias frontend. |
| Persistencia | SQLite local con Xerial JDBC, Spring JDBC y Flyway para migraciones SQL versionadas. |
| Búsqueda | Lucene 10.5.x, índice local reconstruible y metadata de indexación en SQLite. |
| Modelos | Ollama local por su API de loopback; no se usa su endpoint cloud. |
| Ejecución | Git CLI/worktrees, Docker local y adaptadores aislados de filesystem, terminal y Ollama. |
| Testing previsto | JUnit 5, Spring Boot Test, pruebas de contrato HTTP/WebSocket, repositorios Git temporales, Vitest/Testing Library y Playwright. |
| Plataforma inicial | Windows con PowerShell; soporte de producto no se declara exclusivo de Windows ni multiplataforma completo. |
| Acceso local | Backend enlazado a loopback y UI servida desde el mismo origen local; sesión local efímera para proteger mutaciones contra orígenes no autorizados. |

Spring Boot 3.5.16 admite Java 17 a 25 y Gradle 8.4+; Java 21 y Gradle 8.14.3 se
seleccionan por estabilidad LTS y compatibilidad explícita. Flyway soporta SQLite con
Xerial JDBC, pero SQLite no permite migraciones concurrentes; el proceso de migración
debe ser exclusivo. Vite requiere Node 20.19+ o 22.12+ y React Flow se integra como
`@xyflow/react`. Las fuentes y alternativas están registradas en [research.md](research.md).

### Convenciones reproducibles y evidencia

El build backend es independiente bajo `backend/`, con namespace raíz `com.zeko`.
Desde la raíz del repositorio, los comandos previstos son `./backend/gradlew.bat check
build`, `./backend/gradlew.bat integrationTest` y `./backend/gradlew.bat contractTest`;
no existe un proyecto Gradle raíz ni un subproyecto `:backend`. El frontend usa
`npm --prefix frontend` y el lockfile versionado fija sus paquetes exactos.

Cada tarea de implementación registra comandos, salidas redactadas y resultado en
`work/evidence/<task-id>/`. Ese directorio es evidencia local de desarrollo, queda
fuera de `specs/`, no contiene secretos y no sustituye la trazabilidad de producto.

## Constitution Check

### Evaluación antes de research

| Principio o regla | Estado | Evidencia | Limitación |
|---|---|---|---|
| I. Spec-first / SDD | Cumple | `spec.md`, clarificaciones y checklists activos; este plan no crea código. | Ninguna. |
| II. Decisiones antes de código | Cumple | Solo se generan artefactos de plan, datos, contratos y guía. | Ninguna. |
| III. Implementación controlada | Cumple | La matriz de requisitos y estrategia de pruebas permiten generar tasks por repositorio. | Ninguna. |
| IV. MVP estricto | Cumple | Arquitectura local, sin cloud, MCP, custom tools, marketplace, multiusuario ni RBAC. | Ninguna. |
| V. Local-first, observable y seguro | Cumple | Trazabilidad, snapshots, approvals revisables, worktrees exclusivos, eventos locales y límites explícitos de iniciativa. | Ninguna. |
| Stack y capas | Cumple | Java 21/Spring, React/Vite/XYFlow, SQLite/Lucene, Docker/Ollama y separación de capas. | Ninguna. |
| Worktrees y Git | Cumple | `execution-control` reserva por repositorio + task; no hay merge, push ni commit automático. | Ninguna. |

### Reconciliación documental

| Fuente | Hallazgo | Tratamiento en este plan |
|---|---|---|
| `spec.md` | Las nueve clarificaciones registradas están incorporadas, incluida la iniciativa por autonomía en FR-044. | Se trasladan a datos, contratos, UI y pruebas. |
| `checklists/requirements.md` | Las notas fueron alineadas con las aclaraciones vigentes. | Revisión documental completada. |
| `checklists/functional-quality.md` | Las 38 preguntas fueron contrastadas con la spec y el diseño; CHK029 queda respaldado por la política de memoria. | Revisión documental completada. |
| `AGENTS.md` | Usa el nombre heredado AgentStudio. | Se interpreta como el mismo producto; los artefactos nuevos usan Zeko Agentic IDE. |
| Sincronización de contexto de agente | No hay script de actualización de contexto en `.specify/scripts/powershell/`. | No se modifica `AGENTS.md` ni reglas compartidas, conforme al límite de esta fase. |

### Evaluación después de diseño

| Control | Estado | Evidencia de diseño |
|---|---|---|
| Plantilla, instancia y snapshots | Cumple | [data-model.md](data-model.md) define versión seleccionada y snapshot por Execution; contratos exponen revisión sin overrides. |
| Permiso, aprobación y acción obsoleta | Cumple | `ActionRevision` identifica cada revisión de una acción, `Approval` es invalidable y el contrato expone `409 approval-stale`. |
| Recuperación y proveedores locales | Cumple | Estado conocido, efecto registrado y reintento manual; Docker/Ollama usan el mismo contrato de indisponibilidad con responsabilidad técnica propia. |
| Concurrencia de worktree | Cumple | La reserva exige repository + task, ruta física normalizada y dueño activo; las tareas quedan bloqueadas en conflicto. |
| Memoria y RAG | Cumple | Alcance se filtra antes de consultar; SQLite contiene metadata y Lucene usa índices project y global reconstruibles. |
| Iniciativa por autonomía | Cumple | FR-044 define `Manual`, `Assisted` y `Autonomous`; los tres conservan política de permisos y approvals. |

No hay violaciones justificadas mediante Complexity Tracking.

## Decisiones y arquitectura

### Mapa de módulos backend

| Módulo | Responsabilidad y ownership | Dependencias permitidas |
|---|---|---|
| `project-catalog` | Project, Repository y rutas locales validadas. | `traceability` y puertos de filesystem/Git. |
| `agent-design` | AgentTemplate, AgentInstance, SkillDefinition, AgentSkillBinding y versiones de plantilla. | `project-catalog`, `traceability`. |
| `coordination` | Conversation, instrucciones, PM, precedencia y override del usuario. | `agent-design`, `traceability`, puerto de ejecución. |
| `execution-control` | Task, Execution, ActionProposal, Approval, Worktree, cancelación y conflictos. | `project-catalog`, `agent-design`, `traceability` y puertos locales. |
| `memory-search` | MemoryEntry, alcance, documentos autorizados y consulta Lucene. | `project-catalog`, `agent-design`, `coordination`; puertos SQLite/Lucene/filesystem. |
| `traceability` | TraceLink, eventos de dominio y evidencia de cambios/decisiones. | No depende de módulos de producto. |
| `shared-kernel` | IDs, estados cerrados, errores de dominio y clock. | No depende de módulos de producto. |

Cada módulo separa `domain`, `application`, `infrastructure` y `api`. Los contratos
entre módulos son puertos y eventos de dominio explícitos; no hay ciclos. Controllers
y handlers WebSocket convierten DTOs y delegan casos de uso. `infrastructure` adapta
SQLite, Lucene, filesystem, Git, Docker, Ollama y WebSocket sin trasladar reglas al
transporte.

### Frontend y UI local

`frontend/src/features` agrupa `projects`, `agents`, `skills`, `conversations`,
`approvals`, `runtime`, `memory` y `traceability`. `frontend/src/components` contiene
presentación reutilizable. El estado de servidor y WebSocket queda en adaptadores de
feature; el estado visual de XYFlow queda aislado del estado de dominio.

La navegación conserva dos tabs: **Agents Canvas** para definiciones, asociaciones y
actualización seleccionable de plantillas; **Runtime Canvas** para ejecuciones,
approvals, conflicto, cancelación, resultados y diff. Ninguna arista visual inicia un
workflow. La UI siempre muestra el contexto disponible: proyecto, repositorio, task,
agente, permiso y autonomía cuando la acción lo requiera.

### Flujo de ejecución autorizado

1. Una instrucción se vincula a Conversation, actor de origen y precedencia.
2. El PM o agente propone una Task y una `ActionProposal` canónica; cada cambio
   material crea una `ActionRevision` inmutable de esa acción.
3. `execution-control` normaliza ruta, directorio de trabajo, recurso, comando y
   argumentos; clasifica la acción antes de que un adaptador externo la ejecute.
4. La política de permiso decide prohibir, requerir Approval o permitir. Una acción
   destructiva siempre exige autorización explícita.
5. La aprobación se vincula a una revisión de acción. Un cambio invalida la aprobación;
   respuestas duplicadas, tardías o con revisión distinta no autorizan la acción.
6. Tras revalidar permiso, reserva de worktree y revisión de acción, el adaptador local
   ejecuta la operación. La denegación no puede reutilizarse mediante otro adaptador.
7. Execution registra estados y efectos confirmados; Runtime Canvas recibe eventos
   correlacionados. Un reintento manual crea una nueva Execution, nunca reanuda otra.

### Matriz de iniciativa por autonomía

`coordination` aplica la iniciativa antes de crear una Task de seguimiento: `Manual`
solo actúa ante una instrucción explícita vigente y no crea follow-ups; `Assisted`
presenta el follow-up y espera confirmación del usuario antes de crearlo; `Autonomous`
puede crear y continuar follow-ups relacionados con la instrucción vigente. La UI
muestra el modo, las propuestas pendientes y su vínculo con la instrucción de origen.
Cada acción de un follow-up pasa por la misma clasificación, PermissionPolicy y
Approval que cualquier otra acción; la autonomía no concede autorización adicional.

### Límites de concurrencia, memoria y contratos

Una reserva activa de worktree se identifica por `repository_id`, `task_id`, ruta física
normalizada y owner de Execution. SQLite impone unicidad parcial sobre una ruta física
mientras la reserva esté activa o en conflicto; liberar una reserva conserva cambios y
habilita una reserva posterior mediante acción trazada.

`MemoryEntry` expresa `GLOBAL`, `PROJECT`, `AGENT` o `CONVERSATION`. Una entrada global
no tiene `project_id`, exige promoción explícita y se indexa en un índice global separado;
las entradas de proyecto se indexan por Project. El filtro de ownership y alcance ocurre
antes de seleccionar índice, leer contenido o rankear resultados.

HTTP sirve snapshots de recursos y Runtime Canvas los consulta después de reconectar;
WebSocket solo publica observabilidad. La sesión local se inicia en loopback, se mantiene
en cookie efímera y se revalida en cada mutación o suscripción.

## Estructura propuesta

La estructura es una propuesta inicial, ya que el repositorio no contiene código.
No se crean directorios de código en esta fase.

```text
backend/
├── build.gradle.kts
├── settings.gradle.kts
├── src/main/java/.../
│   ├── sharedkernel/{domain,application,infrastructure,api}/
│   ├── traceability/{domain,application,infrastructure,api}/
│   ├── projectcatalog/{domain,application,infrastructure,api}/
│   ├── agentdesign/{domain,application,infrastructure,api}/
│   ├── coordination/{domain,application,infrastructure,api}/
│   ├── executioncontrol/{domain,application,infrastructure,api}/
│   └── memorysearch/{domain,application,infrastructure,api}/
└── src/test/java/.../{unit,integration,contract}/

frontend/
├── package.json
├── src/{features,components,app}/
└── tests/{unit,e2e}/

specs/001-zeko-mvp/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/{openapi.yaml,websocket.md}
└── checklists/{requirements.md,functional-quality.md}
```

## Estrategia de verificación

- **Dominio**: invariantes de plantillas/snapshots, permisos, acciones obsoletas,
  estados, precedencia, worktree y trazabilidad.
- **Integración**: SQLite real y migraciones exclusivas; Lucene temporal; Git en
  repositorios temporales; adaptadores Docker/Ollama disponibles e indisponibles.
- **Contrato**: HTTP y WebSocket, incluida aprobación tardía/invalidada, correlación,
  deduplicación de evento y protección de mutaciones locales.
- **Concurrencia**: dos tasks con worktrees distintos, segundo escritor rechazado y
  tareas bloqueadas hasta decisión manual.
- **E2E**: US-001 a US-007, SC-001 a SC-007, cancelación, fallo, reconexión, reintento
  manual, memoria aislada y diff que preserva cambios previos del usuario.
- **Calidad**: formatter, lint, build, unitarias, integración/contrato y E2E aplicables
  por task. La evidencia se registra fuera de `specs/` durante implementación, enlazada
  desde el registro de task/diff/commit definido por `traceability`.

NFR-007 se mide desde la confirmación de una capacidad local hasta que Runtime Canvas
presenta el evento correspondiente; excluye generación del modelo. NFR-008 requiere
una matriz de carga que varie agentes, tamaño de repositorio y hardware, con resultados
registrados antes de aceptar una capacidad. SC-007 requiere protocolo de usabilidad,
muestra y criterio de 9/10; no se considera realizado en este plan.

## Matriz de trazabilidad de requisitos

| Requisito | Módulo o sección | Contrato / verificación prevista |
|---|---|---|
| FR-001 | project-catalog | HTTP Projects; integración SQLite |
| FR-002 | project-catalog | HTTP Projects; integración SQLite |
| FR-003 | project-catalog | Persistencia Project; E2E US-001 |
| FR-004 | project-catalog | HTTP Repositories; integración Git |
| FR-005 | project-catalog | Validación de ruta; unidad/integración |
| FR-006 | project-catalog | Error de ruta; contrato HTTP |
| FR-007 | project-catalog, traceability | DTOs Task/Execution; E2E |
| FR-008 | project-catalog, memory-search | filtros de ownership; integración |
| FR-009 | agent-design | HTTP Agents; E2E US-002 |
| FR-010 | agent-design | modelo y contrato; unidad |
| FR-011 | agent-design | modelo AgentInstance; unidad |
| FR-012 | agent-design, frontend agents | HTTP/Agents Canvas; E2E |
| FR-013 | agent-design, frontend agents | DTO de relación; revisión UI |
| FR-014 | frontend agents | prueba UI de no ejecución por arista |
| FR-015 | agent-design | HTTP Skills; integración filesystem |
| FR-016 | agent-design | modelo binding; unidad |
| FR-017 | agent-design | HTTP Bindings; integración |
| FR-018 | agent-design, frontend agents | DTO alcance; E2E |
| FR-019 | agent-design, traceability | comando de promoción y audit trail |
| FR-020 | agent-design, execution-control | invariantes de alcance/capacidad |
| FR-021 | agent-design, execution-control | versiones/snapshot; unidad e integración |
| FR-022 | coordination | HTTP Conversations; integración |
| FR-023 | coordination | HTTP Messages; E2E |
| FR-024 | coordination, traceability | eventos PM; WebSocket |
| FR-025 | coordination | permiso de instrucción directa; E2E |
| FR-026 | coordination | evaluador de precedencia; unidad |
| FR-027 | coordination, traceability | Override/TraceLink; integración |
| FR-028 | coordination, execution-control | revalidación de permiso; contrato |
| FR-029 | coordination | bloqueo SDD y audit trail; unidad |
| FR-030 | execution-control, frontend approvals | DTO PermissionMode; E2E |
| FR-031 | coordination, frontend agents | DTO AutonomyMode visible y persistido; contrato/E2E |
| FR-032 | coordination | invariante de independencia; unidad |
| FR-033 | coordination | invariante de independencia; unidad |
| FR-034 | execution-control | clasificador de acción; unidad |
| FR-035 | execution-control | Approval pendiente; integración |
| FR-036 | execution-control | política Auto Approve; unidad |
| FR-037 | execution-control | reglas prohibitivas; unidad |
| FR-038 | execution-control, traceability | revisión/invalidación; contrato |
| FR-039 | execution-control | denegación no eludible; integración |
| FR-040 | frontend approvals | schema Approval; E2E |
| FR-041 | execution-control | clasificador y política; unidad |
| FR-042 | execution-control | política explícita; unidad |
| FR-043 | execution-control | límite de permiso; unidad |
| FR-044 | coordination, execution-control, frontend agents | matriz de iniciativa y pruebas de independencia; contrato/E2E |
| FR-045 | execution-control | adaptadores locales; integración |
| FR-046 | execution-control, traceability | schema Execution; contrato |
| FR-047 | execution-control, runtime UI | estado/eventos; contrato WS |
| FR-048 | runtime UI, traceability | eventos correlacionados; E2E |
| FR-049 | execution-control | solicitud cancelación; HTTP |
| FR-050 | execution-control | resultado real; WS/integración |
| FR-051 | execution-control | invariante cancelación; unidad |
| FR-052 | execution-control | efectos no revertidos; E2E |
| FR-053 | execution-control | reserva Worktree; concurrencia |
| FR-054 | execution-control | segundo escritor rechazado; concurrencia |
| FR-055 | execution-control, runtime UI | Task bloqueada; contrato/E2E |
| FR-056 | execution-control, traceability | diff atribuible; integración Git |
| FR-057 | traceability | enlaces y consulta; integración |
| FR-058 | planificación posterior | división por repositorio; tasks |
| FR-059 | execution-control | formato commit; integración Git |
| FR-060 | execution-control | invariante de trailers; integración Git |
| FR-061 | execution-control | ausencia de mutación Git automática; unidad |
| FR-062 | execution-control, runtime UI | estado conocido/proveedor; WS/E2E |
| FR-063 | execution-control | reintento explícito; integración |
| FR-064 | memory-search | scope MemoryEntry; unidad |
| FR-065 | memory-search | fuente/ownership; contrato |
| FR-066 | memory-search | filtro antes de búsqueda; integración |
| FR-067 | memory-search, coordination | contexto sin autoridad; unidad |
| FR-068 | memory-search | vacío vs error; contrato |
| FR-069 | memory-search | metadata/índice; integración |
| FR-070 | memory-search | exclusiones de proveedor; revisión |
| FR-071 | frontend agents, runtime UI | tabs separadas; E2E |
| FR-072 | frontend features | contexto visible; E2E |
| FR-073 | frontend features | estados de UI; E2E |
| FR-074 | frontend features | error/acción disponible; revisión UI |
| FR-075 | runtime UI, traceability | resultado/diff; E2E |
| FR-076 | todos | revisión de alcance MVP |
| NFR-001 | project-catalog, traceability | reinicio local; integración |
| NFR-002 | todos | tests de aislamiento |
| NFR-003 | execution-control, runtime UI | fallo/estado conocido; E2E |
| NFR-004 | memory-search, traceability | escaneo de secretos; integración |
| NFR-005 | execution-control | approval obligatorio; unidad/contrato |
| NFR-006 | frontend features | evaluación de recorridos |
| NFR-007 | runtime UI | medición futura de 5 s |
| NFR-008 | todos | protocolo de capacidad futuro |
| SC-001 | proyecto a diff | E2E ciclo principal |
| SC-002 | execution-control | concurrencia worktree |
| SC-003 | approvals | contrato/E2E denegación |
| SC-004 | permisos/autonomía | matriz de combinaciones e iniciativa por modo |
| SC-005 | memory-search | dos proyectos aislados |
| SC-006 | ejecución/runtime | proveedor/interrupción |
| SC-007 | frontend features | estudio de usabilidad futuro |

## Riesgos y dependencias de secuencia

1. SQLite permite el alcance local, pero exige serializar migraciones y escrituras de
   reserva de worktree; las operaciones externas no comparten transacción con SQLite.
2. Docker, Ollama y Git son dependencias del host. Sus fallas se representan como
   estado conocido y recuperación manual, sin declarar éxito ni reanudación automática.
3. Los cambios de worktree, filesystem, terminal o red deben atravesar el evaluador
   de permiso. Ningún prompt o evento de UI es autoridad suficiente para ejecutarlos.
4. Las tasks posteriores se dividirán por repositorio y módulo, con archivos concretos,
   dependencias y un diff/commit por task; no se asignan worktrees reales en este plan.

## Complexity Tracking

No se proponen excepciones constitucionales.
