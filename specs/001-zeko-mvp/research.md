# Investigación técnica: Zeko Agentic IDE - MVP local-first

## Alcance de la investigación

Esta investigación resuelve decisiones técnicas dentro del stack fijado por la
constitución. No cambia decisiones de producto ni incorpora capacidades fuera del MVP.
Las fuentes enlazadas son documentación primaria o del mantenedor de la tecnología.

## Decisiones

### D-001 — Java 21 y Spring Boot 3.5.16

**Decisión**: usar Java 21 y Spring Boot 3.5.16 para el backend.

**Rationale**: Java 21 satisface la restricción constitucional y ofrece una base LTS
estable. La documentación de Spring Boot 3.5.16 indica compatibilidad desde Java 17
hasta Java 25, por lo que Java 21 y la línea 3.5 están explícitamente soportados.

**Alternativas consideradas**: Java 25 es permitido, pero no aporta un requisito del
MVP que justifique cambiar de línea LTS. Spring Boot 4 no se adopta sin que el plan
disponga de una compatibilidad equivalente con las dependencias seleccionadas.

**Requisitos afectados**: arquitectura obligatoria, FR-001–FR-076, NFR-001–NFR-005.

**Fuente**: [Spring Boot 3.5 System Requirements](https://docs.spring.io/spring-boot/3.5/system-requirements.html).

### D-002 — Gradle Wrapper 8.14.3 y Kotlin DSL

**Decisión**: usar Gradle Wrapper 8.14.3 con Kotlin DSL para el backend.

**Rationale**: Spring Boot 3.5 admite Gradle 8.4 o posterior y la matriz de Gradle
indica que Java 21 puede ejecutar Gradle desde 8.5. Gradle 8.14.3 es compatible con
ambos y evita asumir soporte de Gradle 9 en Spring Boot 3.5.

**Alternativas consideradas**: Maven 3.6.3+ es compatible, pero Gradle centraliza
wrapper reproducible, calidad y test suites sin añadir otra herramienta. Gradle 9 se
descarta mientras el soporte explícito de la línea Spring elegida no sea necesario.

**Requisitos afectados**: calidad y checks de todos los módulos.

**Fuentes**: [Spring Boot Gradle Plugin](https://docs.spring.io/spring-boot/gradle-plugin/introduction.html), [Gradle compatibility matrix](https://docs.gradle.org/current/userguide/compatibility.html), [Gradle 8.14.3 release notes](https://docs.gradle.org/8.14.3/release-notes.html).

### D-003 — Spring JDBC, Xerial SQLite y Flyway SQL versionado

**Decisión**: persistir metadata con Spring JDBC, Xerial SQLite JDBC y migraciones
SQL versionadas mediante Flyway. La aplicación serializa escrituras de reserva y el
proceso de migración es exclusivo al iniciar.

**Rationale**: el modelo local-first no necesita un servidor de base de datos ni JPA.
Flyway documenta URL JDBC de SQLite, el driver Xerial y la limitación de que SQLite no
soporta migraciones concurrentes. Spring JDBC mantiene las transacciones del caso de
uso explícitas y evita forzar semántica de ORM sobre worktrees, approvals y eventos.

**Alternativas consideradas**: JPA se descarta porque no es requisito y ocultaría
límites de concurrencia. PostgreSQL y cualquier servicio remoto violarían el alcance
local-first. Archivos JSON se descartan para trazabilidad relacional y exclusividad.

**Requisitos afectados**: FR-001–FR-008, FR-021, FR-027, FR-038, FR-053–FR-058,
FR-062–FR-069, NFR-001–NFR-005.

**Fuente**: [Flyway SQLite driver reference](https://documentation.red-gate.com/flyway/reference/database-driver-reference/sqlite).

### D-004 — Lucene local con índice reconstruible

**Decisión**: usar Lucene 10.5.x para índice y consulta de contexto local; SQLite
conserva metadata de fuente, alcance, versión e indexación. El índice se puede
reconstruir desde fuentes autorizadas y no es fuente de verdad para permisos.

**Rationale**: Lucene es una biblioteca Java de búsqueda e indexación local. Separar
índice reconstruible de metadata permite invalidar resultados cuando una fuente cambia
o se vuelve inaccesible, y filtrar ownership antes de consultar.

**Alternativas consideradas**: base vectorial externa, embeddings obligatorios y
proveedores cloud están fuera del MVP. Guardar documentos sin índice no satisface RAG
local. El ranking inicial usa búsqueda textual; no se compromete una estrategia vectorial.

**Requisitos afectados**: FR-064–FR-070, NFR-002, NFR-004, SC-005.

**Fuente**: [Apache Lucene Core](https://lucene.apache.org/core/).

### D-005 — React 19.3.0, Vite 8.1.0 y XYFlow en una SPA local

**Decisión**: usar React 19.3.0, Vite 8.1.0 y `@xyflow/react` 12.x. npm mantiene
versiones exactas en `package-lock.json`; Node.js 22.12+ es el entorno inicial mínimo
de validación.

**Rationale**: Vite requiere Node 20.19+ o 22.12+, y React Flow se distribuye como
`@xyflow/react` para una aplicación React. La SPA se sirve localmente junto al backend;
no se añade Electron, Tauri ni un empaquetador de escritorio.

**Alternativas consideradas**: empaquetado de escritorio y una segunda aplicación
serían alcance adicional. Dibujar un canvas propio no aporta ventaja frente a XYFlow.

**Requisitos afectados**: FR-012–FR-014, FR-040, FR-047–FR-048, FR-071–FR-075,
NFR-003, NFR-006, SC-001, SC-007.

**Fuentes**: [Vite Getting Started](https://vite.dev/guide/), [Vite 8.1](https://vite.dev/blog/announcing-vite8-1), [React 19.3](https://react.dev/blog/2026/09/09/react-19-3), [React Flow concepts](https://reactflow.dev/learn/concepts/building-a-flow).

### D-006 — API HTTP local y WebSocket de eventos

**Decisión**: HTTP local gestiona comandos y consultas con validación de DTOs;
WebSocket transmite eventos de ejecución y estado visible. Ambos requieren identidad
de correlación. El backend se enlaza a loopback y el frontend usa el mismo origen
local con una sesión efímera emitida al iniciar.

**Rationale**: HTTP aporta comandos idempotentes y errores explícitos; WebSocket
permite actualizaciones sin sondeo. La sesión local no crea usuarios ni RBAC: limita
mutaciones de orígenes no autorizados en la máquina local.

**Alternativas consideradas**: polling no cumple bien NFR-007; exponer una interfaz
en red o usar un proveedor cloud viola el MVP. No se añade autenticación multiusuario.

**Requisitos afectados**: FR-022–FR-025, FR-038–FR-040, FR-046–FR-050, FR-062,
FR-071–FR-075, NFR-003, NFR-005.

### D-007 — Adaptadores de ejecución local con catálogo cerrado

**Decisión**: encapsular filesystem, terminal, Git, Docker y Ollama detrás de puertos
de `execution-control`. Solo un catálogo cerrado de capacidades integradas puede
proponer acciones; la evaluación de permisos se ejecuta inmediatamente antes del
adaptador real.

**Rationale**: el dominio conserva el contexto, la revisión y la decisión de permiso;
la infraestructura normaliza rutas, directorios de trabajo, comandos y argumentos.
No se permite que un prompt, un canvas o una skill invoquen un adaptador directamente.

**Alternativas consideradas**: MCP y API de custom tools están prohibidos. Delegar
permisos a frontend o modelo permite bypasses. Hash de texto solo no prueba equivalencia
semántica, por lo que la revisión protege la acción exacta documentada.

**Requisitos afectados**: FR-020, FR-034–FR-043, FR-045, FR-053–FR-063, NFR-005.

**Fuente de dependencia local**: [Ollama API introduction](https://docs.ollama.com/api/introduction) documenta su API local por defecto en loopback.

### D-008 — Worktrees reservados y conflicto manual

**Decisión**: modelar la reserva de worktree como registro único por `repository_id`
y `task_id`; las solicitudes concurrentes se serializan en SQLite. Si el destino o la
integración entra en conflicto, la Task queda `BLOCKED`, se preservan cambios y el
usuario resuelve manualmente.

**Rationale**: satisface un worktree por repositorio + task y evita dos escritores.
El resultado externo de Git no participa en una transacción SQLite; se registra el
efecto confirmado y se compensa solo mediante una acción nueva autorizada, no rollback
automático.

**Alternativas consideradas**: locks solo en memoria no sobreviven proceso; merges,
limpieza destructiva o resolución automática contradicen FR-055 y la constitución.

**Requisitos afectados**: FR-053–FR-058, NFR-001–NFR-003, SC-002.

### D-009 — Recuperación manual y snapshots inmutables

**Decisión**: cada reintento manual crea una Execution nueva que referencia la Task,
el snapshot de plantilla y el intento previo. El sistema muestra último estado y efectos
confirmados, pero no reanuda ni repite acciones automáticamente.

**Rationale**: operaciones de filesystem, Git, Docker y Ollama pueden tener efectos
parciales. Un nuevo intento hace auditable la decisión del usuario y evita afirmar
idempotencia que el MVP no puede probar de forma general.

**Alternativas consideradas**: reanudación automática y rollback universal violan
FR-052 y FR-063. Sobrescribir una ejecución anterior pierde trazabilidad.

**Requisitos afectados**: FR-021, FR-047–FR-052, FR-062–FR-063, NFR-003, SC-006.

### D-010 — Estrategia de pruebas por frontera

**Decisión**: probar invariantes en unidad; SQLite, Lucene, Git y adaptadores locales
en integración; OpenAPI/WebSocket en contrato; recorridos completos en E2E. Docker y
Ollama se validan tanto con dobles deterministas como con verificación local opcional
cuando estén disponibles.

**Rationale**: separar dobles de verificaciones reales evita falsos éxitos y mantiene
pruebas reproducibles. Las reglas críticas constitucionales requieren pruebas; los
checks no se desactivan por ausencia de un proveedor local.

**Alternativas consideradas**: solo E2E sería lento y poco diagnosticable; solo mocks
no demuestra límites reales de SQLite, Git o proveedor.

**Requisitos afectados**: todos; en especial FR-021, FR-034–FR-043, FR-053–FR-063,
FR-064–FR-070 y NFR-001–NFR-005.

## Decisión de producto incorporada

### D-011 — Semántica de iniciativa de autonomía

**Decisión**: `Manual` ejecuta solo una instrucción explícita vigente del usuario y no
crea follow-ups; `Assisted` propone cada follow-up y espera confirmación antes de
crearlo; `Autonomous` puede crear y continuar follow-ups relacionados con la instrucción
vigente. Ninguna de estas modalidades modifica la evaluación de permisos o approvals.

**Rationale**: la decisión define una iniciativa observable y comprobable para cada
modo, conserva la autoridad del usuario y evita que autonomía se interprete como una
autorización para efectos locales, de red o destructivos.

**Alternativas consideradas**: dejar la semántica para la implementación habría
permitido comportamientos no trazados a la spec. Tratar los modos como permisos
duplicaría PermissionMode y debilitaría la separación exigida por el MVP.

**Requisitos afectados**: FR-031, FR-032–FR-044, US-003, US-004 y SC-004.

### D-012 — Invariantes de ejecución y recuperación

**Decisión**: `ActionProposal` es la identidad estable de una acción y
`ActionRevision(action_id, número)` conserva cada versión evaluable. Una reserva de
Worktree activa es única por ruta física normalizada y owner de Execution, además de
su combinación Repository + Task. Cancelar una Task `BLOCKED` termina en `CANCELLED`;
solo la reasignación o resolución manual registrada puede devolverla a `READY`.

**Rationale**: dos acciones de la misma Execution no deben competir por una revisión,
y dos Tasks distintas no pueden escribir una misma ubicación física bajo nombres de
Repository distintos. La cancelación no debe hacer ejecutable un conflicto sin una
decisión explícita.

**Alternativas consideradas**: una revisión global por Execution y unicidad solo por
Repository + Task dejan carreras que el MVP debe rechazar. Tratar la cancelación como
reasignación confunde intención y estado observable.

**Requisitos afectados**: FR-038, FR-053–FR-055, FR-062–FR-063 y SC-002.

### D-013 — Alcance global de memoria y sesión local

**Decisión**: una fuente global requiere promoción explícita y se guarda sin
`project_id` en un índice Lucene global separado. Las fuentes de Project conservan
`project_id` y un índice por Project; el filtro de alcance ocurre antes de elegir índice.
La API inicia una sesión efímera solo desde loopback y la representa mediante cookie
local; HTTP expone snapshots y WebSocket usa esa sesión únicamente para observación.

**Rationale**: separar físicamente los índices evita que global se interprete como
compartir todo el contenido de un Project. El mismo boundary de sesión protege las
mutaciones HTTP y la suscripción WebSocket sin crear cuentas, roles ni acceso remoto.

**Alternativas consideradas**: copiar fuentes de Project a un índice global rompe el
ownership. Usar el socket para mutaciones evita revalidación de dominio y no cumple el
límite de observabilidad.

**Requisitos afectados**: FR-019, FR-057, FR-064–FR-070, NFR-002, NFR-004 y NFR-005.
