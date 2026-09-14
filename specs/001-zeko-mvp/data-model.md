# Modelo de datos: Zeko Agentic IDE - MVP local-first

## Límites de almacenamiento

SQLite es la fuente de verdad para metadata, configuración, estados y trazabilidad.
Lucene guarda un índice reconstruible; sus documentos incluyen referencias a metadata,
pero nunca conceden permisos. Archivos `SKILL.md`, repositorios y worktrees siguen
siendo recursos del filesystem y se registran por ruta normalizada, huella y ownership.

Cada tabla incluye `id`, timestamps de creación/actualización cuando correspondan y
un `version` para control optimista donde haya decisiones concurrentes. Los valores de
estado son enums de dominio, no texto libre.

## Entidades de producto

| Entidad | Atributos principales | Ownership y relaciones |
|---|---|---|
| Project | id, nombre, raíz local, estado de acceso | Raíz de Repository, agentes, conversaciones, memoria project y trazabilidad. |
| Repository | id, project_id, ruta_normalizada, git_root, estado_acceso, huella | Pertenece a un Project; destino de Task y Worktree. Ruta única por Project. |
| AgentTemplate | id, project_id, nombre, versión_actual, estado | Definición reutilizable de configuración; tiene TemplateVersion. |
| TemplateVersion | id, template_id, número, configuración_inmutable, creado_en | Snapshot de plantilla; una versión no se modifica. |
| AgentInstance | id, project_id, template_id, versión_seleccionada, identidad, contexto, estado | Instancia concreta; no posee overrides configurables de plantilla. |
| AgentRuntimeSettings | id, instance_id, permission_mode, autonomy_mode, version, estado | Configuración operativa independiente de la plantilla; cambiar una dimensión no modifica la otra. |
| TemplateUpdateDecision | id, instance_id, versión_propuesta, versión_previa, decisión, decidido_en | Aceptar aplica una versión a futuras Execution; no muta ejecución activa. |
| SkillDefinition | id, project_id, nombre, ruta_skill_md, huella, alcance | Definición de skill local por defecto. |
| AgentSkillBinding | id, instance_id, skill_id, estado | Asociación explícita; no es SkillDefinition. |
| Conversation | id, project_id, interlocutor_tipo, interlocutor_id, estado | Contexto e historial de instrucciones. |
| Instruction | id, conversation_id, origen, contenido, precedencia, override_de, trazabilidad | Entrada de usuario, PM, agente o skill; conserva origen y precedencia. |
| FollowUpProposal | id, instruction_id, agent_instance_id, propuesta, estado, confirmado_por, task_id | Seguimiento propuesto por `ASSISTED`; una confirmación puede crear una única Task vinculada. |
| Task | id, project_id, repository_id, origen_instrucción, follow_up_proposal_id, estado, agente_asignado, motivo_bloqueo | Unidad de trabajo; puede tener varias Execution. |
| Execution | id, task_id, intento, estado, template_version_snapshot, instance_snapshot, reintento_de, estado_conocido, efecto_resumen | Intento trazable; reintento manual crea fila nueva. |
| ActionProposal | id, execution_id, tipo | Identidad estable de una acción propuesta; una Execution puede tener varias. |
| ActionRevision | id, action_proposal_id, número, recurso_normalizado, directorio_trabajo, comando, argumentos, red_destino, efectos_esperados, clasificación | Versión inmutable de una acción que se clasifica, aprueba y ejecuta. |
| Approval | id, action_revision_id, estado, decidido_por, decidido_en, motivo | Pendiente, aprobada, denegada o invalidada; decisión coincide con una revisión inmutable. |
| PermissionPolicy | id, runtime_settings_id, reglas_autoapprove, estado | Reglas explícitas para `AUTO_APPROVE`; no representa autonomía ni configuración de plantilla. |
| Worktree | id, repository_id, task_id, ruta_lógica, ruta_física_normalizada, estado, propietario_execution | Reserva exclusiva mientras está activa; identifica ruta y dueño reales. |
| ConflictRecord | id, task_id, tipo, recursos, estado, detectado_en, resolución_usuario | Explica conflicto de asignación/integración y bloqueo manual. |
| EffectRecord | id, execution_id, secuencia, tipo, recurso, estado_confirmado, detalle_seguro | Efectos confirmados; no almacena secretos. |
| MemoryEntry | id, nivel, owner_type, owner_id, fuente, ruta, huella, estado_indexación, clasificación_sensible | Metadata de contexto global/project/agent/conversation. |
| TraceLink | id, tipo_origen, id_origen, tipo_destino, id_destino, relación, creado_en | Enlaza requisito, decisión, task, ejecución, diff, commit y evidencia. |

## Invariantes y claves

- `Project.root` y `Repository.ruta_normalizada` se validan antes de persistir; la
  ruta se normaliza contra el host y se vuelve a validar en el adaptador de ejecución.
- `AgentTemplate` y `AgentInstance` son entidades diferentes. Una instancia referencia
  su plantilla y versión seleccionada, pero no contiene campos de override configurables.
- `SkillDefinition` y `AgentSkillBinding` son diferentes. Una binding requiere una
  instancia y una skill existentes del mismo Project.
- `TemplateVersion(template_id, número)` es única e inmutable. `Execution` conserva
  snapshot o referencia inmutable de la versión e identidad efectiva al comenzar.
- `TemplateUpdateDecision` aceptada actualiza solo `versión_seleccionada` de futuras
  Execution. Una Execution ya iniciada no cambia su snapshot.
- `AgentRuntimeSettings(instance_id)` es único y contiene `permission_mode` y
  `autonomy_mode` como valores independientes. No es un override de TemplateVersion;
  cambiar uno conserva el otro. Una Task de seguimiento conserva la Instruction vigente
  de la que deriva.
- `FollowUpProposal` solo se crea en `ASSISTED`; su decisión aprobada crea como máximo
  una Task y la rechazada no puede crear ninguna. Las Tasks de `AUTONOMOUS` se vinculan
  directamente con su Instruction de origen; `MANUAL` no crea Tasks de seguimiento.
- `ActionRevision(action_proposal_id, número)` es única e inmutable. Approval decide
  una revisión exacta; una revisión nueva de la misma acción invalida Approval pendiente
  anterior. Acciones distintas de la misma Execution no comparten identidad ni revisión.
- `Worktree(repository_id, task_id)` es única. Además, una restricción parcial de SQLite
  mantiene `ruta_física_normalizada` única mientras Worktree esté `RESERVED`, `ACTIVE`,
  `RELEASE_PENDING` o `CONFLICTED`, y `propietario_execution` es único mientras esté
  activo. La reserva y el cambio de Task a ejecutable usan una transacción SQLite corta.
- Una Task `BLOCKED` requiere `ConflictRecord` abierto. No se la representa como
  Execution cancelada, fallida o esperando aprobación.
- MemoryEntry filtra ownership antes de abrir Lucene. El resultado debe referenciar
  la fuente y su nivel; un documento indexado nunca es instrucción ni permiso.
- Secretos, tokens y credenciales no se persisten en EffectRecord, TraceLink,
  ActionProposal de auditoría ni contenido indexado.

## Estados y transiciones

### Task

`DRAFT → READY → RUNNING → COMPLETED | FAILED | CANCELLED | BLOCKED`.

`BLOCKED` se alcanza por conflicto. Una cancelación explícita lleva la Task a
`CANCELLED`; solo reasignación o resolución manual registrada puede devolverla a
`READY`. El plan no define automatismos de resolución.

### FollowUpProposal

`PENDING_CONFIRMATION → ACCEPTED | REJECTED | EXPIRED`.

Solo una confirmación explícita del usuario puede llevar una propuesta `PENDING_CONFIRMATION`
a `ACCEPTED` y crear su Task vinculada. Si la Instruction de origen deja de estar vigente,
la propuesta pasa a `EXPIRED` y no puede crear trabajo.

### Execution

`PENDING → RUNNING → WAITING_APPROVAL → RUNNING → COMPLETED | FAILED | CANCELLED`.

Una solicitud de cancelación no cambia por sí sola a `CANCELLED`; el adaptador confirma
detención. Tras interrupción se conserva último estado conocido. Un reintento manual
crea otra Execution con `reintento_de`; no hay transición de reanudación automática.

### Approval

`PENDING → APPROVED | DENIED | INVALIDATED`.

Solo la decisión vinculada a la misma `ActionRevision` puede cambiar PENDING. Un cambio
de acción, recurso, alcance o efecto esperado crea revisión nueva e invalida la pendiente
de esa acción. Respuestas duplicadas o tardías devuelven conflicto y no autorizan nada.

### Worktree y conflicto

`RESERVED → ACTIVE → RELEASE_PENDING → RELEASED`, o `CONFLICTED` si hay conflicto
de integración/asignación. Liberar un worktree nunca implica borrar cambios; una acción
destructiva posterior requerirá autorización independiente.

## Política de permiso y autonomía

PermissionMode es `ASK_APPROVAL`, `AUTO_APPROVE` o `FULL_ACCESS`; AutonomyMode es
`MANUAL`, `ASSISTED` o `AUTONOMOUS`. Se persisten en `AgentRuntimeSettings` como
dimensiones independientes de TemplateVersion.
Antes de todo adaptador se evalúan, en orden: prohibiciones constitucionales, límites
de host y Project, tipo de acción, revisión válida, PermissionPolicy y Approval.

La clasificación inicial de ActionProposal es `READ_LOCAL`, `WRITE_LOCAL`,
`EXECUTE_LOCAL`, `NETWORK`, `DESTRUCTIVE` o `PROHIBITED`. `Ask Approval` exige
Approval para mutante, red o destructiva; `Auto Approve` solo permite reglas locales no
destructivas declaradas; `Full Access` no elimina prohibiciones. `MANUAL` solo permite
trabajo nacido de una instrucción explícita vigente y no crea follow-ups; `ASSISTED`
persiste cada propuesta de follow-up en espera de confirmación antes de crear la Task;
`AUTONOMOUS` puede crear y continuar follow-ups vinculados con la instrucción vigente.
En los tres modos, cada ActionProposal se evalúa con la misma política de permisos y
Approval antes de invocar un adaptador.

## Transacciones, contención y fallos

SQLite no puede hacer atómicas las operaciones externas de Git, Docker, Ollama o
filesystem. Las transacciones solo contienen cambios de metadata: reservar worktree,
crear revisión, invalidar approval y registrar transición. La acción externa ocurre
fuera de la transacción y luego genera EffectRecord y estado confirmado.

Las escrituras se mantienen cortas y se reintentan solo ante contención de SQLite con
backoff acotado. Las migraciones Flyway se ejecutan con exclusión de proceso al iniciar;
no se corren concurrentemente. La compatibilidad de esquema usa migraciones SQL
incrementales y nunca edición destructiva silenciosa de datos.

## Índices y consultas previstas

- Índices SQLite: Repository(project_id, ruta_normalizada), AgentInstance(project_id),
  AgentRuntimeSettings(instance_id), FollowUpProposal(instruction_id, estado),
  Task(repository_id, estado), Execution(task_id, intento),
  ActionRevision(action_proposal_id, número), Approval(action_revision_id, estado),
  Worktree(repository_id, task_id), la unicidad parcial de ruta/owner activo,
  MemoryEntry(nivel, owner_type, owner_id) y TraceLink por ambos extremos.
- Lucene: un índice por Project y un índice global separado, ambos con campos de nivel,
  ownership, fuente, huella, contenido autorizado y versión. La consulta filtra alcance
  y owner antes de seleccionar índice, ranking textual o lectura de snippets.
- Metadata de indexación almacena huella y estado `CURRENT`, `STALE`, `UNAVAILABLE` o
  `EXCLUDED`. Sin resultados y error de búsqueda se devuelven como resultados distintos.

## Ownership de archivos

Project es propietario de metadatos y rutas de sus Repository. SkillDefinition referencia
un `SKILL.md` dentro del alcance de Project; cualquier promoción global exige decisión
trazada y no duplica silenciosamente el archivo. Una MemoryEntry `GLOBAL` tiene
`owner_type=GLOBAL`, `owner_id` y `project_id` nulos, y requiere esa promoción explícita;
los índices Lucene de Project y global viven en áreas locales separadas. Logs y artefactos de ejecución se vinculan a Execution y
se redactan antes de registrarse.
