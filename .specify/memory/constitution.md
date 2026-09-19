<!--
Informe de impacto de sincronización
Versión: plantilla sin ratificar ni versión → 1.0.0 (primera adopción normativa).
Ratificación y última enmienda: 2026-09-13; no existe adopción previa documentada.
Principios: los cinco espacios genéricos se sustituyen por I. Spec-first / SDD;
II. Decisiones verificables antes de código; III. Implementación controlada;
IV. MVP estricto; V. Local-first, observable y seguro.
Secciones añadidas: alcance y stack; arquitectura; modelo y memoria; permisos y
autonomía; flujo SDD y verificaciones; calidad; seguridad; UX; gobierno multi-agent;
Git y trazabilidad; Definition of Done; gobierno y enmiendas.
Secciones eliminadas: únicamente ejemplos y espacios sin completar de la plantilla.
Revisión de dependencias:
- ✅ .specify/memory/constitution.md: completada y validada.
- ⚠ .specify/templates/plan-template.md: pendiente concretar Constitution Check,
  stack y capas; justificar complejidad no autoriza una infracción.
- ⚠ .specify/templates/spec-template.md: pendiente sustituir ejemplos de cuentas,
  autenticación y multiusuario, y explicitar alcance, modelo, permisos y canvases.
- ⚠ .specify/templates/tasks-template.md: pendiente eliminar tests críticos
  opcionales y commits por grupos; exigir dependencias, trazabilidad, archivos,
  aislamiento y checks por task; retirar ejemplos ajenos al MVP.
- ⚠ .specify/templates/checklist-template.md: pendiente reflejar revisión de
  requisitos antes de plan/tasks sin exigir artefactos de fases futuras.
- ✅ .specify/templates/constitution-template.md: revisada; plantilla genérica
  sin autoridad para sustituir esta constitución, sin cambios necesarios.
- ✅ .specify/templates/commands/*.md: ruta inexistente; sin comandos que revisar.
- ✅ README.md: revisado; nombre compatible y sin instrucciones contradictorias.
- ⚠ AGENTS.md: pendiente actualizar el nombre heredado AgentStudio a Zeko Agentic IDE.
- ✅ docs/quickstart.md: inexistente; no se crea en esta fase.
Decisiones y overrides del usuario (2026-09-13):
- La solicitud «Crear o actualizar constitution.md para Zeko Agentic IDE» fija
  Zeko Agentic IDE como nombre normativo frente al nombre heredado de AGENTS.md.
- La instrucción «No generar [...] artefactos fuera de la constitución» limita
  este cambio a este archivo y prevalece sobre la propagación de la skill
  .agents/skills/speckit-constitution/SKILL.md. Se revisan las dependencias, pero
  su edición queda pendiente para una tarea documental posterior.
Seguimiento: resolver las cinco dependencias pendientes en una fase documental
autorizada. Mientras tanto, los artefactos derivados MUST cumplir esta constitución;
los ejemplos de las plantillas no constituyen excepciones.
No quedan valores constitucionales ni fechas diferidos.
-->

# Constitución de Zeko Agentic IDE

Los términos **MUST**, **MUST NOT** y **SHOULD** expresan obligación, prohibición y
recomendación, respectivamente. Toda desviación de un SHOULD MUST justificar su
motivo en una decisión trazada. MUST NOT utilizarse un SHOULD para eludir una obligación.

## Principios fundamentales

### I. Spec-first / SDD

La especificación es la fuente de verdad del producto. Toda funcionalidad, endpoint,
UI, cambio de datos, configuración de ejecución o cambio arquitectónico MUST estar
trazado a una `spec.md`, un `plan.md` y una task aprobados antes de implementarse.
La aprobación MUST identificar el artefacto o revisión y la decisión correspondiente.
El código y sus comentarios MUST NOT redefinir requisitos ni justificar decisiones
retroactivamente. La revisión MUST poder identificar por qué existe cada cambio.

### II. Decisiones verificables antes de código

El flujo MUST ser `constitution -> specify -> clarify -> checklist -> plan -> tasks -> analyze -> implement`.
Durante las siete primeras fases MUST NOT escribirse código de producción, tests
de implementación, migraciones, scaffolding ni UI. Solo se crean o actualizan los
documentos propios de cada fase; `analyze` se limita a un informe no destructivo.
Los conflictos y ambigüedades MUST resolverse en la fase SDD correspondiente antes
de continuar el trabajo afectado.

### III. Implementación controlada

Cada task MUST tener ID único, dependencias explícitas, requisitos y plan asociados,
archivos concretos y verificaciones aplicables. La marca `[P]` significa trabajo
realmente paralelizable; MUST NOT asignarse si existen dependencias pendientes o
archivos solapados entre tareas concurrentes. `analyze` MUST verificar cobertura,
consistencia, granularidad y pruebas planificadas antes de implementar.

La regla es **una tarea, un diff, un commit**. Una implementación MUST NOT agrupar
tareas, adelantar trabajo futuro ni añadir refactors ajenos al alcance aprobado.
La unidad de revisión y reversión MUST quedar vinculada a la task correspondiente.

### IV. MVP estricto

Cada spec, plan, task y revisión MUST contrastar su alcance con las capacidades
permitidas y las prohibiciones de esta constitución. Una dependencia, ejemplo de
plantilla o extensión pequeña MUST NOT habilitar una capacidad excluida.
Las capacidades futuras MUST especificarse separadamente y MUST NOT implementarse
en el MVP. El stack y la arquitectura MUST NOT cambiarse por iniciativa de un agente.

### V. Local-first, observable y seguro

El producto MUST permitir diseñar, configurar, ejecutar, aprobar y observar agentes
localmente. Las decisiones de permisos, autonomía, ejecución y cambio del workspace
MUST ser visibles y auditables localmente, con ownership, alcance y resultado
identificables. Permisos y autonomía MUST permanecer independientes. Las ejecuciones
concurrentes MUST preservar el aislamiento de repositorios y tareas.
La observabilidad MUST respetar la protección de secretos.

## Alcance y stack del MVP

Zeko Agentic IDE es un ADE/Agentic IDE local-first y un monolito modular. Un `Project`
MUST admitir múltiples repositorios. El MVP abarca agentes y skills de proyecto,
ejecuciones locales, approvals, Git worktrees y memoria/RAG local, con trazabilidad
de requisitos a cambios. MUST NOT convertirse en un servicio cloud o multiusuario.

| Área | Tecnología obligatoria |
|---|---|
| Backend | Java 21 o 25, Spring Boot |
| Arquitectura y tiempo real | Monolito modular, WebSocket |
| Frontend | React, TypeScript, Vite, XYFlow |
| Metadata | SQLite |
| RAG y búsqueda local | Lucene |
| Repositorios y ejecución local | Git worktrees, Docker, Ollama local |

El plan MUST documentar la elección entre Java 21 y 25. Cualquier sustitución o
ampliación del stack MUST contar con decisión explícita, trazada y aprobada en la
fase SDD correspondiente antes de implementarse. Si altera esta constitución,
MUST aprobarse también su enmienda; una justificación técnica aislada no basta.

MUST NOT introducirse en el MVP: MCP; custom tools creadas por usuarios;
Architecture/Draw.io canvas; architecture-to-code; marketplace; team/server mode;
ejecución remota; cloud sync; multiusuario; RBAC; ni infraestructura de colaboración
cloud. Si se necesitan, MUST abrirse una especificación futura sin implementación
en el MVP. Una spec de feature MUST NOT levantar por sí sola estas prohibiciones.

## Arquitectura obligatoria

- El backend MUST mantener un monolito modular con contratos explícitos entre módulos.
  MUST NOT descomponerse en microservicios durante el MVP.
- Cada módulo MUST separar `domain`, `application`, `infrastructure` y `api`.
  `domain` MUST contener invariantes y reglas de negocio; MUST NOT delegarlas a
  controllers, handlers WebSocket o componentes de presentación.
- `application` MUST coordinar casos de uso; `infrastructure` MUST implementar los
  adaptadores locales de SQLite, Lucene, filesystem, Git, Docker y Ollama; `api`
  MUST contener transporte, controllers y DTOs de sus boundaries.
- Los boundaries HTTP, WebSocket y de persistencia/adaptadores MUST utilizar DTOs.
  Las entidades de dominio MUST NOT exponerse directamente por esas fronteras.
  Los DTOs MUST NOT sustituir el modelo de dominio que expresa reglas de negocio.
- El frontend MUST organizarse por `features` y `components`, con estado y efectos
  de infraestructura aislados de la presentación. Los componentes de UI MUST NOT
  contener lógica de negocio.
- Los dominios cerrados MUST usar enums o value objects. La revisión MUST detectar
  duplicación de reglas, métodos que mezclan responsabilidades, modelos anémicos
  pese a tener invariantes e `instanceof` evitables. El diseño SHOULD preferir
  métodos de una responsabilidad y soluciones simples para facilitar verificación;
  todo patrón introducido MUST explicar qué complejidad reduce.
- Cambiar arquitectura, contratos o estructura de módulos MUST pasar por la fase
  SDD correspondiente y su aprobación. MUST NOT hacerse oportunísticamente.
- En Java MUST NOT usarse bloques Javadoc ni etiquetas `@param`, `@return` o `@throws`.
  Un comentario de método MUST limitarse a una oración en una línea `//`; si el
  nombre basta, MUST omitirse. Dentro del cuerpo solo se admite una línea breve
  para comportamiento intencionalmente contraintuitivo. Los IDs de requisitos
  y decisiones MUST mantenerse en `specs/`, no en el código.

## Modelo de producto y memoria

- `AgentTemplate` MUST representar una definición reutilizable y `AgentInstance`
  una instancia concreta. MUST NOT usarse como sinónimos ni fundirse en una entidad
  que cumpla ambos roles.
- `SkillDefinition` MUST representar la definición de una skill y `AgentSkillBinding`
  su vinculación a un agente. MUST NOT usarse como sinónimos ni unificarse sus roles.
- La memoria MUST distinguir `global`, `project`, `agent` y `conversation`, con ownership
  y alcance explícitos. Las specs y el modelo de datos MUST definir esos límites
  antes de implementar acceso o modificación de memoria.
- SQLite MUST almacenar metadata y Lucene MUST proporcionar RAG/búsqueda local.
- Agentes, skills y sus `SKILL.md` MUST crearse dentro del proyecto por defecto.
  Su promoción a global MUST requerir instrucción explícita del usuario y registro
  de la decisión. MUST NOT crearse agentes, skills ni configuraciones globales
  automáticamente; disponer de memoria global no autoriza esa creación.

## Permisos y autonomía

El dominio, los contratos y la UI MUST modelar estas dimensiones por separado:

| Dimensión | Valores |
|---|---|
| Permisos | `Ask Approval`, `Auto Approve`, `Full Access` |
| Autonomía | `Manual`, `Assisted`, `Autonomous` |

`Full Access` MUST NOT implicar autonomía `Autonomous`. `Autonomous` MUST NOT anular
límites de permisos ni restricciones de seguridad. Las specs MUST definir el
comportamiento de las combinaciones relevantes y sus criterios de prueba.
La implementación MUST NOT deducir una dimensión de la otra.

Los approval prompts MUST describir acción, recursos afectados, alcance, impacto,
resultado esperado y alternativas de forma legible. La decisión y su resultado
MUST vincularse a la ejecución correspondiente en la trazabilidad local.

## Flujo SDD y verificaciones

La fuente de verdad de producto MUST respetar este orden: esta constitución;
`spec.md`; aclaraciones, checklist y `plan.md`; `research.md`, `data-model.md`, contratos
y `quickstart.md`; finalmente `tasks.md`. Ante incompatibilidad o ambigüedad MUST
detenerse el trabajo afectado y volver a la fase adecuada. MUST NOT adivinarse ni
reescribirse la historia para justificar código existente.

Cada fase MUST dejar evidencia documental de su comprobación:

| Fase | Evidencia exigida antes de avanzar |
|---|---|
| `constitution` | Reglas normativas, versión, fechas, impacto y decisiones trazadas. |
| `specify` | Requisitos y aceptación verificables, alcance y exclusiones; distinciones de entidades, memoria, canvases, permisos y autonomía afectadas por la feature. |
| `clarify` | Resoluciones trazadas de ambigüedades y conflictos; si no los hay, constancia de la revisión. |
| `checklist` | Claridad, completitud y consistencia de requisitos con los cinco principios y reglas aplicables; sin exigir código ni artefactos de fases futuras. |
| `plan` | Constitution Check antes de investigación y después de diseño: stack, capas, contratos, datos, UX, permisos, seguridad, aislamiento y estrategia de verificación consistentes con la spec. |
| `tasks` | Cobertura requisito → task, dependencias, rutas concretas por repositorio, granularidad de un diff/commit y checks, incluidos tests críticos y de boundaries. |
| `analyze` | Informe no destructivo de cobertura y coherencia entre spec, plan, tasks y diseño; resolución de hallazgos bloqueantes antes de implementar. |
| `implement` | Diff limitado a la task aprobada, evidencia de checks y revisión de la Definition of Done. |

Las comprobaciones MUST cubrir los cinco principios y las reglas aplicables.
Toda no aplicabilidad MUST justificarse en el artefacto de la fase. Una plantilla
genérica MUST NOT sustituir estos criterios ni convertir obligaciones en opciones.

`tasks.md` MUST usar IDs únicos como `T001` y `T002`, declarar dependencias por ID o
su ausencia, requisitos cubiertos, referencias al plan y rutas concretas con su
repositorio. La aprobación MUST ser verificable antes de ejecutar. Una tarea
demasiado grande para un diff/commit coherente MUST dividirse durante planificación,
conservando cobertura y dependencias.

`analyze` MUST detectar requisitos sin tarea, tareas sin requisito, dependencias
faltantes o cíclicas, incompatibilidades contrato/frontend/plan, responsabilidades
mal ubicadas, tareas demasiado grandes, paralelismo con solapamientos y reglas
críticas sin tests planificados. MUST NOT aprobar implementación con esas brechas
sin resolver. La corrección MUST realizarse en la fase documental responsable.

## Calidad y testing

Las reglas críticas de dominio, permisos, approvals, autonomía, ejecución, aislamiento
de worktrees y trazabilidad MUST tener tests. Los cambios de interfaces públicas y
boundaries MUST tener pruebas apropiadas de integración o contrato. Estas pruebas
MUST planificarse antes de `implement` y escribirse solo durante implementación.

Antes de cerrar cada task MUST ejecutarse los checks aplicables al módulo: formatter,
lint, build, tests unitarios, integración/contrato y E2E o validaciones de quickstart
cuando correspondan. Los resultados MUST registrarse y enlazarse a la task y al
cambio. Una tarea MUST NOT declararse terminada si falla un check requerido o falta
evidencia de su ejecución. La no aplicabilidad MUST justificarse; no es un resultado
exitoso. MUST NOT desactivarse, eliminarse ni degradarse un control para pasar pruebas.

Las tareas exclusivamente documentales MUST validar alcance, coherencia, enlaces,
formato y datos normativos aplicables; MUST NOT crear tests de implementación para
sortear la prohibición de código durante las fases de diseño.

## Seguridad y ejecución local

- Secretos, tokens, claves y credenciales MUST NOT exponerse en código, commits,
  logs, issues o prompts. Archivos `.env` y credenciales MUST NOT commitearse.
- Las acciones MUST respetar permisos de filesystem, terminal y red configurados
  por el usuario y por el producto.
- Una acción destructiva, irreversible o masiva, incluidos borrados, operaciones
  masivas de Git y migraciones peligrosas, MUST NOT ejecutarse sin autorización
  explícita y target confirmado.
- Telemetría y llamadas a red externa MUST NOT agregarse fuera de una especificación
  aprobada. Esa aprobación MUST respetar el alcance local-first y las exclusiones
  del MVP: ejecución remota y sync cloud siguen prohibidas en esta versión.
- Las decisiones de ejecución y cambio de workspace MUST registrar localmente
  acción, ownership, recursos/alcance, permiso y aprobación cuando aplique, resultado
  y vínculos de trazabilidad, sin almacenar secretos en esa evidencia.

## UX y superficies separadas

**Agents Canvas** MUST dedicarse a diseño, configuración, relaciones y preparación
de agentes. **Runtime Canvas** MUST dedicarse a observabilidad, control de ejecuciones,
estados, resultados y approvals. MUST permanecer como tabs o superficies separadas,
con objetivos y estados propios, identificables sin confusión. MUST NOT fusionarse
ni introducirse un Architecture/Draw.io canvas.

La UI MUST hacer visibles estado, error, permiso, aprobación, ownership y resultado
de cada ejecución. La spec MUST incluir criterios de aceptación para los estados
relevantes y prompts comprensibles. La revisión de UX MUST comprobar la separación
de canvases y de permisos/autonomía mediante los escenarios definidos.

## Gobierno multi-agent y worktrees

- En trabajo concurrente MUST existir un worktree por combinación **repositorio +
  task**. Dos agentes MUST NOT trabajar sobre el mismo worktree. El plan MUST
  identificar los repositorios, tasks y worktrees correspondientes.
- Antes de iniciar tareas `[P]` MUST comprobarse que sus dependencias están satisfechas
  y sus archivos no se solapan. Los conflictos MUST reportarse y resolverse
  explícitamente; MUST NOT pisarse cambios ni forzarse integraciones.
- El Project Manager (PM) MUST coordinar dependencias y reportar progreso, resultados
  y bloqueos al usuario. MUST NOT ser el único punto de entrada: el usuario puede
  dar instrucciones directas a cualquier agente.
- La jerarquía MUST ser **User > Project Rules > Project Manager > Agent > Skill > default behavior**.
  Project Rules incluye `AGENTS.md`, `.specify/` y documentos normativos del repositorio.
- Un override explícito del usuario prevalece y MUST registrarse en el artefacto
  de trazabilidad de la tarea o decisión, con instrucción, fecha, regla afectada,
  alcance y motivo disponible. MUST NOT inferirse del silencio ni de una
  recomendación de una skill.

## Git, commits y trazabilidad

- Las ramas MUST seguir la convención aprobada para la feature o task; cuando no
  exista, MUST ser descriptivas y basadas en la tarea, conforme a `AGENTS.md`.
- Los commits MUST usar Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`,
  `docs:`, `chore:`, `build:`, `ci:`, `perf:`, `style:` o `revert:`, con scope opcional
  y mensaje imperativo y conciso. Cada commit MUST corresponder a una sola task
  y referenciar su ID cuando aplique; por ejemplo,
  `feat(agent-runtime): T023 add approval workflow`.
- MUST NOT incluirse `Co-authored-by`, firmas como IA ni trailers automáticos de
  asistentes. MUST NOT mezclarse formateos, refactors o cambios de otras tareas.
- Una implementación MUST NOT modificar specs generadas ni archivos de `specs/`,
  cambiar stack/arquitectura por iniciativa propia, tocar archivos fuera del scope
  aprobado o adelantar trabajo que no figure en `tasks.md`. Si hacen falta archivos
  adicionales, MUST detenerse el trabajo afectado y actualizar la planificación
  en su fase antes de continuar.
- Requisito, decisión, aprobación, task, diff, commit, pruebas y overrides MUST
  conservar enlaces trazables entre sí. La planificación MUST identificar dónde
  registrar evidencia de implementación sin editar specs desde `implement`.
- Para preservar un diff/commit por task, una implementación en varios repositorios
  MUST descomponerse en tasks por repositorio, vinculadas por dependencias y por
  el requisito común antes de comenzar.

## Definition of Done por task

Una task MUST declararse terminada únicamente cuando cumple todos estos puntos:

1. Tiene trazabilidad completa a requisitos y plan aprobados, decisiones, aprobación
   y overrides aplicables, con enlaces a su cambio y verificaciones.
2. Se respetó el scope y se comparó el diff con los archivos declarados; no contiene
   adelantos ni cambios de otras tareas.
3. Existe un único diff coherente y un único Conventional Commit de esa task, con
   su ID cuando aplica, sin coautoría, firmas como IA ni trailers de asistentes.
4. Formatter/lint, build, tests y validaciones E2E/quickstart aplicables pasan y
   tienen evidencia registrada; toda no aplicabilidad está justificada.
5. Documentación, contratos y quickstart requeridos están actualizados en la fase
   autorizada; no se modificaron specs desde implementación.
6. Las reglas críticas y boundaries modificados tienen las pruebas exigidas; el
   aislamiento, permisos, autonomía, seguridad y observabilidad aplicables fueron
   verificados sin degradar controles.
7. No se incorporaron capacidades fuera del MVP ni cambios no aprobados de stack,
   arquitectura, modelo o separación de canvases.

## Gobierno y enmiendas

Esta constitución MUST gobernar las decisiones de producto, revisiones SDD e
implementación, conforme a la jerarquía de instrucciones indicada. Cada revisión
MUST identificar incumplimientos y evidencia; MUST NOT aprobar un cambio por una
simple declaración de conformidad ni por una justificación de complejidad.

Una enmienda MUST documentar motivo, reglas afectadas, impacto sobre specs, planes,
tareas y plantillas, y ajustes o transición necesarios. MUST contar con aprobación
explícita y trazada del usuario antes de adquirir vigencia. MUST realizarse en fase
`constitution` y preservar historial de decisiones, fecha original de ratificación
y fecha de última enmienda. Los principios del MVP MUST NOT relajarse mediante una
task, un plan o una excepción informal; cambiar el alcance requiere una decisión
de gobierno explícita y revisión de los artefactos afectados.

La versión MUST seguir `MAJOR.MINOR.PATCH`: MAJOR para eliminación o redefinición
incompatible de principios o gobierno; MINOR para nuevos principios/secciones o
ampliaciones normativas compatibles; PATCH para aclaraciones sin cambio normativo.
Cada enmienda MUST incluir al inicio un informe de impacto de sincronización con
versión anterior/nueva, principios y secciones afectados, dependencias revisadas y
pendientes. Las fechas MUST usar `YYYY-MM-DD`.

La versión inicial `1.0.0` adopta esta constitución el 2026-09-13 a partir de la
solicitud explícita del usuario y de una plantilla sin ratificación anterior.
La revisión actual se limita a este archivo por instrucción del usuario; las
actualizaciones documentales pendientes constan en el informe de impacto y MUST NOT
interpretarse como permiso para generar artefactos incompatibles.

**Versión**: 1.0.0 | **Ratificada**: 2026-09-13 | **Última enmienda**: 2026-09-13
