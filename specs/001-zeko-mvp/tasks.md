# Tasks - Zeko Agentic IDE - 001-zeko-mvp

**Fecha**: 2026-09-13  
**Repositorio**: `Zeko-Agentic-IDE` (`C:/Users/Tiago/proyectos/Zeko-Agentic-IDE`)  
**Rama de feature**: `feature/001-zeko-mvp`  
**Estado**: Implementación y checks automatizados completados; la aceptación del MVP permanece pendiente de mediciones y evaluación reales.
**Cantidad**: 93 tareas completadas: T001–T006 son trabajo SDD documental; T007–T093 cubren setup, producto, validación y corrección del quality gate.


## Fuentes y decisión vigente

Fuentes: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [OpenAPI](contracts/openapi.yaml), [WebSocket](contracts/websocket.md), [quickstart.md](quickstart.md), [constitución](../../.specify/memory/constitution.md) y [AGENTS.md](../../AGENTS.md). Se consultó la skill local `speckit-tasks` y su plantilla; las reglas constitucionales prevalecen sobre ejemplos genéricos de tests opcionales o commits por grupos.

La autonomía vigente está resuelta en Clarificaciones, US-003, FR-044, plan, research y data model:

- Manual actúa dentro de una instrucción explícita vigente y no crea follow-ups.
- Assisted propone follow-ups y espera confirmación antes de crearlos.
- Autonomous puede crear y continuar follow-ups relacionados con la instrucción vigente.
- Toda acción conserva los permisos y approvals aplicables.

La resolución no limita Manual a una sola acción y no permite que autonomía amplíe permisos.

## Mapa de issues publicados

Los issues publicados mantienen la trazabilidad de una tarea por issue; este mapa se
generó a partir de `work/task-to-issues/publish-results.json`. Las correcciones
documentales vigentes de este archivo son la fuente de planificación para continuar
el flujo SDD.

| Tarea | Issue |
|---|---|
| T001 | [#1](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/1) |
| T002 | [#2](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/2) |
| T003 | [#3](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/3) |
| T004 | [#4](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/4) |
| T005 | [#5](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/5) |
| T006 | [#6](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/6) |
| T007 | [#7](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/7) |
| T008 | [#8](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/8) |
| T009 | [#10](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/10) |
| T010 | [#11](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/11) |
| T011 | [#9](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/9) |
| T012 | [#12](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/12) |
| T013 | [#13](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/13) |
| T014 | [#14](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/14) |
| T015 | [#16](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/16) |
| T016 | [#15](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/15) |
| T017 | [#17](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/17) |
| T018 | [#18](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/18) |
| T019 | [#19](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/19) |
| T020 | [#20](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/20) |
| T021 | [#21](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/21) |
| T022 | [#23](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/23) |
| T023 | [#24](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/24) |
| T024 | [#27](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/27) |
| T025 | [#34](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/34) |
| T026 | [#43](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/43) |
| T027 | [#25](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/25) |
| T028 | [#28](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/28) |
| T029 | [#29](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/29) |
| T030 | [#35](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/35) |
| T031 | [#36](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/36) |
| T032 | [#44](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/44) |
| T033 | [#51](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/51) |
| T034 | [#45](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/45) |
| T035 | [#56](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/56) |
| T036 | [#61](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/61) |
| T037 | [#30](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/30) |
| T038 | [#37](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/37) |
| T039 | [#38](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/38) |
| T040 | [#46](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/46) |
| T041 | [#52](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/52) |
| T042 | [#62](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/62) |
| T043 | [#57](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/57) |
| T044 | [#22](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/22) |
| T045 | [#26](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/26) |
| T046 | [#31](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/31) |
| T047 | [#32](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/32) |
| T048 | [#39](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/39) |
| T049 | [#53](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/53) |
| T050 | [#47](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/47) |
| T051 | [#58](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/58) |
| T052 | [#63](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/63) |
| T053 | [#33](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/33) |
| T054 | [#48](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/48) |
| T055 | [#40](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/40) |
| T056 | [#54](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/54) |
| T057 | [#59](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/59) |
| T058 | [#41](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/41) |
| T059 | [#64](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/64) |
| T060 | [#65](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/65) |
| T061 | [#67](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/67) |
| T062 | [#49](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/49) |
| T063 | [#69](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/69) |
| T064 | [#70](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/70) |
| T065 | [#72](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/72) |
| T066 | [#73](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/73) |
| T067 | [#71](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/71) |
| T068 | [#76](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/76) |
| T069 | [#74](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/74) |
| T070 | [#77](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/77) |
| T071 | [#78](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/78) |
| T072 | [#75](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/75) |
| T073 | [#81](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/81) |
| T074 | [#79](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/79) |
| T075 | [#82](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/82) |
| T076 | [#84](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/84) |
| T077 | [#42](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/42) |
| T078 | [#50](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/50) |
| T079 | [#55](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/55) |
| T080 | [#60](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/60) |
| T081 | [#66](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/66) |
| T082 | [#80](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/80) |
| T083 | [#68](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/68) |
| T084 | [#85](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/85) |
| T085 | [#83](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/83) |
| T086 | [#86](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/86) |
| T087 | [#87](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/87) |
| T088 | [#88](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/88) |
| T089 | [#89](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/89) |
| T090 | [#90](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/90) |
| T091 | [#91](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/91) |
| T092 | [#92](https://github.com/Tiago-Davila/Zeko-Agentic-IDE/issues/92) |
| T093 | No publicado; corrección local autorizada por el usuario el 2026-09-15 |

## Override del usuario

El 2026-09-15 el usuario autorizó crear y ejecutar T093 para restaurar el quality gate
backend, y marcar T087–T092 como implementación completada. Este override no declara
aceptado el MVP: NFR-007, NFR-008 y SC-007 conservan sus evaluaciones reales pendientes.

## Cierre documental completado

T001–T006 cerraron estas diferencias antes de analizar o implementar:

1. Plan, research y data model ya incorporan la decisión vigente de autonomía.
2. El árbol ubica el build y settings en backend/, pero quickstart llama a un wrapper raíz y al subproyecto :backend. Se concreta un build independiente en backend/ coherente con el árbol.
3. OpenAPI carece de operaciones necesarias para crear/leer instancias y conversaciones, promover a global, configurar modos y consultar detalle de ejecución/diff. WebSocket exige recuperar un snapshot HTTP sin definir todavía ese endpoint.
4. La reserva única repository+task no basta para impedir que dos tasks usen una misma ruta física o dos executions escriban a la vez; el diseño debe expresar también esas invariantes ya exigidas por la spec.
5. La transición descrita desde BLOCKED por cancelación no puede devolver la Task a READY. El modelo tampoco debe reducir varias acciones de una ejecución a una sola identidad versionada.
6. Ownership global, contexto global frente a índice por proyecto, protocolo de sesión y follow-ups requieren contratos/datos concretos para implementar sin improvisar.

T001–T006 fueron trabajos en clarify/plan/checklist, **no implementación de producto**. Su evidencia es revisión documental y validación declarativa de contratos; no sustituye pruebas de implementación.

## Convenciones operativas

- Todas las tareas pertenecen al repositorio Zeko-Agentic-IDE; backend y frontend son carpetas del mismo repo. Los repositorios que abrirá el producto son datos de usuario, no repos de desarrollo adicionales.
- Las rutas de cada tarea son relativas a la raíz del repo y delimitan su escritura. Las clases/archivos aún no existentes son destinos planificados; no se han creado.
- Se concreta el namespace `com.zeko` dentro del árbol modular del plan. T002 registra esta convención y los comandos definitivos.
- Cada task incluye resultado, dependencias por ID, trazabilidad y checks. Una tarea, un diff, un commit; no agrupar otras tareas ni refactors incidentales.
- En una tarea de comportamiento, escribir primero la prueba pertinente y después la implementación; el commit solo se cierra con checks verdes. No dejar un commit deliberadamente rojo como tarea terminada.
- `[US1]` a `[US7]` corresponden a US-001 a US-007. La organización por historia no elimina sus dependencias reales.
- `[P]` indica una oportunidad condicional: solo se activa cuando todas las dependencias están completas y los archivos de los participantes no se solapan. No todas las tareas marcadas pueden correr entre sí. Ver pares revisados al final.
- Cada agente concurrente utiliza su propio worktree por repositorio+task; nunca dos agentes en el mismo. Resolver conflictos explícitamente y preservar cambios del usuario.
- No implementar MCP, custom tools de usuario, Architecture/Draw.io, architecture-to-code, marketplace, team/server mode, ejecución remota, cloud sync, multiusuario ni RBAC.
- Sin Javadoc ni etiquetas @param/@return/@throws. Los IDs FR/SC/D no se escriben en Java; viven en documentación de trazabilidad.
- Conventional Commits con task ID: `feat(execution-control): T063 enforce action authorization`. Nunca `Co-authored-by`, firmas IA ni trailers automáticos de asistentes.

## Perfiles de verificación por tarea

Los comandos son **previstos**, no resultados ejecutados. T002 los alinea con el diseño; T007–T010 los implementan. No usar un comando inexistente como prueba exitosa.

| Perfil | Checks desde la raíz del repositorio |
|---|---|
| DOC | Revisar formato, enlaces, referencias, cambios normativos y alcance; validar contratos declarativos cuando se modifiquen. Sin tests de implementación. |
| BE | `.\\backend\\gradlew.bat check build`, con formatter/lint y unitarias aplicables dentro de check. |
| BEI | BE + `.\\backend\\gradlew.bat integrationTest`, incluyendo la prueba indicada. |
| BEC | BE + `.\\backend\\gradlew.bat contractTest`; integración adicional si la prueba usa persistencia/procesos. |
| FE | `npm --prefix frontend ci`, `run lint`, `run build`, `run test -- --run` con el mismo prefijo. |
| E2E | FE + `npm --prefix frontend run test:e2e`, con backend y fixtures de la suite disponibles. |
| ALL | BE, BEI, BEC, FE, E2E y revisión documental del resultado final. |

Toda tarea añade las comprobaciones de aceptación indicadas a su perfil. Docker/Ollama reales se distinguen de dobles deterministas; ausencia del proveedor no convierte una verificación real en aprobada ni permite apagar controles. Las mediciones y el estudio de usuarios requieren evidencia real; no hay resultados anticipados.

Evidencia de implementación: `work/evidence/<task-id>/` con comandos, salidas relevantes redactadas, resultados y revisión/commit verificados; no contiene secretos ni se comparte entre tareas. Esta ubicación es registro de desarrollo, distinta del módulo traceability del producto. El estado de tareas y las matrices en specs se revisan en fases documentales; implement no edita specs para marcarse aprobado.

## Fase 0 - Cierre documental previo (clarify/plan/checklist)

Estas seis tareas documentales se completaron en la fase SDD propietaria antes de analyze/implement. No son encargos para que implement modifique specs.

### Correctivo de verificación local (2026-09-14)

- [x] T093 Reparar la reproducibilidad de los quality gates locales — `.gitattributes`, `backend/src/test/java/com/zeko/agentdesign/AgentApiContractTest.java`, `backend/src/test/java/com/zeko/agentdesign/SkillApiContractTest.java`, `backend/src/test/java/com/zeko/coordination/ConversationContractTest.java`, `backend/src/test/java/com/zeko/coordination/ModeSettingsContractTest.java`, `backend/src/test/java/com/zeko/executioncontrol/ApprovalContractTest.java`, `backend/src/test/java/com/zeko/projectcatalog/ProjectApiContractTest.java`, `backend/src/test/java/com/zeko/sharedkernel/HttpErrorsContractTest.java`, `backend/src/test/java/com/zeko/sharedkernel/LocalSessionContractTest.java`, `backend/src/test/java/com/zeko/sharedkernel/SqliteBootstrapIntegrationTest.java`.

  **Dependencias**: ninguna; correctivo bloqueante encontrado durante la verificación de T083. **Traza**: constitución §7, D-010, perfiles BE/BEC. **Checks**: BEC.

  **Aceptación**: Java se conserva como LF en checkout y Checkstyle no informa una violación de line endings ni de longitud de línea en las fuentes alcanzadas. Cada contexto Spring que usa SQLite temporal se cierra antes de que JUnit elimine sus archivos; `contractTest` pasa sin desactivar la limpieza de temporales ni suprimir fallas.

- [x] T001 Sincronizar la resolución de autonomía ya aprobada con el diseño — `specs/001-zeko-mvp/plan.md`, `specs/001-zeko-mvp/research.md`, `specs/001-zeko-mvp/data-model.md`.

  **Dependencias**: ninguna. **Traza**: FR-031–FR-033, FR-044; spec §Clarificaciones; plan §Matriz de iniciativa. **Checks**: DOC.

  **Aceptación**: Registrar Manual sin follow-ups, Assisted con confirmación previa y Autonomous dentro de la instrucción vigente; modelar propuesta/confirmación y origen del follow-up, conservando permisos. Retirar solo las notas obsoletas de bloqueo. No sustituir la decisión del usuario.

- [x] T002 Concretar rutas de build y de evidencia de implementación — `specs/001-zeko-mvp/plan.md`, `specs/001-zeko-mvp/quickstart.md`, `specs/001-zeko-mvp/research.md`.

  **Dependencias**: T001. **Traza**: D-001, D-002, D-005, D-010; constitución §Calidad y testing. **Checks**: DOC.

  **Aceptación**: Alinear Gradle independiente en backend/ y sus comandos con el árbol del plan; fijar namespace com.zeko, versiones patch reproducibles y scripts de calidad. Definir work/evidence/<task-id>/ como evidencia local externa a specs. No inventar resultados de checks ni nuevas tecnologías.

- [x] T003 Cerrar invariantes de datos que afectan concurrencia y alcance — `specs/001-zeko-mvp/data-model.md`, `specs/001-zeko-mvp/research.md`, `specs/001-zeko-mvp/plan.md`.

  **Dependencias**: T002. **Traza**: FR-019, FR-038, FR-044, FR-053–FR-055, FR-064–FR-069; D-003, D-004, D-008, D-009. **Checks**: DOC.

  **Aceptación**: Definir unicidad de ruta física y dueño activo además de repository+task; corregir cancelación de Task bloqueada (CANCELLED, no READY); diferenciar varias acciones y revisión por acción; definir propietario global frente a project_id y almacenamiento independiente de permiso/autonomía sin overrides de plantilla. Resolver global memory frente a índice por Project, fuentes/update/ranking mínimo y puertos entre módulos sin ciclos.

- [x] T004 Completar contratos HTTP necesarios para los recorridos aprobados — `specs/001-zeko-mvp/contracts/openapi.yaml`.

  **Dependencias**: T003. **Traza**: FR-001–FR-075; plan §Contratos/verificación; D-006. **Checks**: DOC.

  **Aceptación**: Definir seguridad de sesión local y errores; completar alta/consulta de instancias y conversaciones, configuración de modos, promoción global, confirmación de follow-ups, consultas de tareas/ejecuciones/approvals/efectos/diff/trazas y carga de contexto. Completar DTOs, detalle de proveedor, alcance y reasignación. Solo operaciones trazadas; validar referencias y ejemplos.

- [x] T005 Alinear contrato de eventos y recuperación de UI — `specs/001-zeko-mvp/contracts/websocket.md`.

  **Dependencias**: T004. **Traza**: FR-024, FR-044, FR-047–FR-048, FR-062; D-006. **Checks**: DOC.

  **Aceptación**: Fijar ruta/handshake, correlación de secuencia por recurso, payloads y validación de suscripción; documentar reportes PM y propuesta/confirmación de follow-ups y enlazar endpoints reales de snapshot. Recuperar UI nunca reanuda trabajo.

- [x] T006 Revisar cierre documental y actualizar guía de validación — `specs/001-zeko-mvp/quickstart.md`, `specs/001-zeko-mvp/plan.md`, `specs/001-zeko-mvp/checklists/functional-quality.md`, `specs/001-zeko-mvp/checklists/requirements.md`.

  **Dependencias**: T005. **Traza**: US-001–US-007; NFR-007–NFR-008; SC-001–SC-007; constitución §Flujo SDD. **Checks**: DOC.

  **Aceptación**: Revisar cada marca con evidencia de la spec/diseño vigente, sin aprobar por ausencia de marcadores. Verificar cobertura y Constitution Check. Mantener rendimiento/usabilidad como validación futura. Ante nueva decisión de producto devolver el punto a clarify, sin implementar supuestos.

## Fase 1 - Setup reproducible

Builds reproducibles y checks definidos sin adelantar funcionalidades.

- [x] T007 [P] Crear build reproducible y arranque mínimo Java 21/Spring Boot — `backend/settings.gradle.kts`, `backend/build.gradle.kts`, `backend/gradlew`, `backend/gradlew.bat`, `backend/gradle/wrapper/gradle-wrapper.jar`, `backend/gradle/wrapper/gradle-wrapper.properties`, `backend/src/main/java/com/zeko/ZekoApplication.java`, `backend/src/test/java/com/zeko/ZekoApplicationTest.java`.

  **Dependencias**: T006. **Traza**: D-001, D-002; plan §Contexto técnico. **Checks**: BE.

  **Aceptación**: Wrapper con checksum y versiones fijadas; arranque vacío probado, sin entidades ni endpoints de features. Limitar dependencias a las decisiones aprobadas.

- [x] T008 [P] Crear base React/TypeScript/Vite y herramientas de pruebas — `frontend/package.json`, `frontend/package-lock.json`, `frontend/index.html`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/vite.config.ts`, `frontend/vitest.config.ts`, `frontend/eslint.config.js`, `frontend/src/main.tsx`, `frontend/src/app/App.tsx`, `frontend/tests/unit/app.test.tsx`.

  **Dependencias**: T006. **Traza**: D-005, D-010; plan §Frontend y UI local. **Checks**: FE.

  **Aceptación**: npm ci reproducible; scripts build/lint/test; arranque mínimo sin pantallas de negocio. No agregar otro framework de aplicación.

- [x] T009 [P] Configurar suites y checks backend obligatorios — `backend/build.gradle.kts`, `backend/config/checkstyle/checkstyle.xml`, `backend/src/test/java/com/zeko/ArchitectureBoundariesTest.java`.

  **Dependencias**: T007. **Traza**: D-010; constitución §Arquitectura, §Calidad. **Checks**: BE.

  **Aceptación**: check ejecuta reglas de formato, unidad y límites de módulos; integrationTest/contractTest son suites explícitas. Respetar no Javadoc/IDs de requisito en Java; no apagar checks.

- [x] T010 [P] Preparar harness E2E local y fixtures aisladas — `frontend/playwright.config.ts`, `frontend/tests/e2e/fixtures/localWorkspace.ts`, `frontend/tests/e2e/app-shell.spec.ts`, `frontend/package.json`, `frontend/package-lock.json`.

  **Dependencias**: T008. **Traza**: D-010; quickstart §Preparación de datos. **Checks**: FE.

  **Aceptación**: Repositorios temporales de prueba validados dentro del directorio de la suite; no reutilizar datos del usuario. Comandos E2E separan proveedor simulado y real.

- [x] T011 [P] Definir exclusiones de secretos y artefactos de desarrollo — `.gitignore`, `.editorconfig`.

  **Dependencias**: T006. **Traza**: NFR-004; constitución §Seguridad, §Git. **Checks**: DOC.

  **Aceptación**: Ignorar .env/credenciales, DB/índices/logs y work/evidence, pero conservar wrappers, locks y fixtures no secretas. Ningún borrado de archivos existentes.

## Fase 2 - Fundaciones compartidas

Persistencia, errores, seguridad local, trazabilidad, eventos y shell disponibles. Las historias dependen explícitamente de estas bases.

- [x] T012 Definir IDs, clock y errores compartidos mínimos — `backend/src/main/java/com/zeko/sharedkernel/domain/ResourceId.java`, `backend/src/main/java/com/zeko/sharedkernel/domain/DomainError.java`, `backend/src/main/java/com/zeko/sharedkernel/application/ClockPort.java`, `backend/src/test/java/com/zeko/sharedkernel/SharedTypesTest.java`.

  **Dependencias**: T009, T010, T011. **Traza**: plan §shared-kernel; D-010. **Checks**: BE.

  **Aceptación**: Tipos cerrados y clock determinista; no introducir dependencias del shared-kernel hacia módulos de producto.

- [x] T013 [P] Configurar SQLite y exclusión de migraciones — `backend/src/main/java/com/zeko/sharedkernel/infrastructure/SqliteConfiguration.java`, `backend/src/main/java/com/zeko/sharedkernel/infrastructure/MigrationLock.java`, `backend/src/main/resources/application.yml`, `backend/src/main/resources/db/migration/V001__metadata_bootstrap.sql`, `backend/src/test/java/com/zeko/sharedkernel/SqliteBootstrapIntegrationTest.java`.

  **Dependencias**: T012. **Traza**: D-003; NFR-001; data-model §Transacciones. **Checks**: BEI.

  **Aceptación**: Migraciones exclusivas, claves foráneas y contención acotada verificadas con SQLite real. Sin servidor de BD ni operaciones externas dentro de transacciones de metadata.

- [x] T014 [P] Implementar transporte de errores y correlación HTTP — `backend/src/main/java/com/zeko/sharedkernel/api/ErrorResponse.java`, `backend/src/main/java/com/zeko/sharedkernel/api/DomainExceptionHandler.java`, `backend/src/main/java/com/zeko/sharedkernel/api/CorrelationFilter.java`, `backend/src/test/java/com/zeko/sharedkernel/HttpErrorsContractTest.java`.

  **Dependencias**: T012, T004. **Traza**: D-006; contracts/openapi.yaml §Error. **Checks**: BEC.

  **Aceptación**: DTOs y códigos acordados, sin secretos ni stacktraces expuestos. Controladores delegan negocio.

- [x] T015 [P] Proteger acceso loopback y mutaciones por sesión local — `backend/src/main/java/com/zeko/sharedkernel/infrastructure/LocalSessionStore.java`, `backend/src/main/java/com/zeko/sharedkernel/api/LocalSessionFilter.java`, `backend/src/main/java/com/zeko/sharedkernel/api/LocalSessionController.java`, `backend/src/main/resources/application.yml`, `backend/src/test/java/com/zeko/sharedkernel/LocalSessionContractTest.java`.

  **Dependencias**: T013, T014. **Traza**: D-006; NFR-004–NFR-005; contrato sesión T004. **Checks**: BEC.

  **Aceptación**: Validar bootstrap, sesión efímera, origen/host y mutaciones conforme al contrato; rechazar origen no autorizado sin añadir cuentas/RBAC ni registrar el token.

- [x] T016 [P] Implementar proyección segura de datos de auditoría — `backend/src/main/java/com/zeko/traceability/domain/SafeDetail.java`, `backend/src/main/java/com/zeko/traceability/application/SensitiveDataFilter.java`, `backend/src/test/java/com/zeko/traceability/SensitiveDataFilterTest.java`.

  **Dependencias**: T012. **Traza**: NFR-004; data-model §EffectRecord/TraceLink. **Checks**: BE.

  **Aceptación**: Separar datos operativos de detalle publicable; excluir secretos identificados y campos sensibles. Pruebas con secretos ficticios en argumentos/errores; no afirmar detección universal.

- [x] T017 [P] Persistir vínculos y eventos de trazabilidad — `backend/src/main/java/com/zeko/traceability/domain/TraceLink.java`, `backend/src/main/java/com/zeko/traceability/application/TraceRecorder.java`, `backend/src/main/java/com/zeko/traceability/application/TraceRepository.java`, `backend/src/main/java/com/zeko/traceability/infrastructure/JdbcTraceRepository.java`, `backend/src/main/resources/db/migration/V002__traceability.sql`, `backend/src/test/java/com/zeko/traceability/TraceRepositoryIntegrationTest.java`.

  **Dependencias**: T013, T016. **Traza**: FR-027, FR-057; NFR-001–NFR-004; D-003. **Checks**: BEI.

  **Aceptación**: Enlaces navegables y eventos correlacionados persistidos con detalles seguros y orden por recurso; independencia respecto de entidades concretas de otros módulos.

- [x] T018 [P] Publicar eventos locales con suscripción validada — `backend/src/main/java/com/zeko/traceability/api/EventEnvelope.java`, `backend/src/main/java/com/zeko/traceability/api/LocalEventSocket.java`, `backend/src/main/java/com/zeko/traceability/infrastructure/LocalWebSocketConfiguration.java`, `backend/src/test/java/com/zeko/traceability/WebSocketContractTest.java`.

  **Dependencias**: T015, T017, T005. **Traza**: D-006; FR-048, FR-062; contracts/websocket.md. **Checks**: BEC.

  **Aceptación**: Sesión/origen válidos, filtros por alcance y eventos sin secretos. subscribe/unsubscribe nunca ejecutan comandos sensibles.

- [x] T019 [P] Crear cliente HTTP y recuperación de errores de sesión — `frontend/src/app/api/httpClient.ts`, `frontend/src/app/api/httpClient.test.ts`, `frontend/src/app/api/errors.ts`.

  **Dependencias**: T008, T014, T015. **Traza**: D-005, D-006; FR-074. **Checks**: FE.

  **Aceptación**: Cliente usa same-origin, sesión y correlación según contrato; distingue error de red/validación/conflicto sin convertirlo en éxito.

- [x] T020 [P] Crear shell local con tabs Agents y Runtime — `frontend/src/app/App.tsx`, `frontend/src/app/WorkspaceShell.tsx`, `frontend/src/components/StatusPanel.tsx`, `frontend/src/components/WorkspaceContext.tsx`, `frontend/tests/unit/workspace-shell.test.tsx`.

  **Dependencias**: T019. **Traza**: FR-071–FR-074; US-007; D-005. **Checks**: FE.

  **Aceptación**: Tabs separadas y contexto accesible; estados vacíos/carga/error compartidos. Sin canvas de arquitectura ni workflows implícitos.

## Fase 3 - US-001: proyecto con varios repositorios (P1)

Verificación independiente: crear y reabrir Project con dos repositorios y una ruta inaccesible; conservar configuración y contexto. SC-001 se completa después con ejecución.

- [x] T021 [US1] Modelar Project y Repository con validación de pertenencia — `backend/src/main/java/com/zeko/projectcatalog/domain/Project.java`, `backend/src/main/java/com/zeko/projectcatalog/domain/Repository.java`, `backend/src/main/java/com/zeko/projectcatalog/domain/RepositoryAccessState.java`, `backend/src/test/java/com/zeko/projectcatalog/ProjectTest.java`.

  **Dependencias**: T012, T020, T018. **Traza**: FR-001–FR-008; data-model §Project/Repository. **Checks**: BE.

  **Aceptación**: Identidad/ruta por Project, asociación múltiple y estados inválido/inaccesible sin pérdida de configuración.

- [x] T022 [P] [US1] Persistir proyectos y repositorios con SQLite — `backend/src/main/java/com/zeko/projectcatalog/application/ProjectRepository.java`, `backend/src/main/java/com/zeko/projectcatalog/infrastructure/JdbcProjectRepository.java`, `backend/src/main/resources/db/migration/V003__projects_repositories.sql`, `backend/src/test/java/com/zeko/projectcatalog/ProjectRepositoryIntegrationTest.java`.

  **Dependencias**: T021, T013, T020, T018. **Traza**: FR-001–FR-004, FR-007–FR-008; NFR-001–NFR-002. **Checks**: BEI.

  **Aceptación**: Reapertura conserva configuración; unicidad por proyecto y lectura sin cruces de ownership.

- [x] T023 [P] [US1] Validar rutas de repositorios mediante filesystem y Git — `backend/src/main/java/com/zeko/projectcatalog/application/RepositoryInspector.java`, `backend/src/main/java/com/zeko/projectcatalog/infrastructure/GitRepositoryInspector.java`, `backend/src/test/java/com/zeko/projectcatalog/GitRepositoryInspectorIntegrationTest.java`.

  **Dependencias**: T021, T020, T018. **Traza**: FR-005–FR-006; D-007; US-001. **Checks**: BEI.

  **Aceptación**: Rutas Windows normalizadas, accesibilidad y raíz Git verificadas con repos temporales; paths con espacios y rutas inválidas no ejecutan comandos interpolados.

- [x] T024 [US1] Exponer casos de uso y contratos de proyectos/repositorios — `backend/src/main/java/com/zeko/projectcatalog/application/ProjectService.java`, `backend/src/main/java/com/zeko/projectcatalog/api/ProjectController.java`, `backend/src/main/java/com/zeko/projectcatalog/api/ProjectDtos.java`, `backend/src/test/java/com/zeko/projectcatalog/ProjectApiContractTest.java`.

  **Dependencias**: T022, T023, T015, T017, T020, T018. **Traza**: FR-001–FR-008; contracts/openapi.yaml §projects. **Checks**: BEC.

  **Aceptación**: Listar/crear/abrir y asociar según contrato; errores 400/404/409/422 cuando apliquen; ninguna regla de negocio en controller.

- [x] T025 [US1] Implementar creación/apertura y asociación de repositorios en UI — `frontend/src/features/projects/projectApi.ts`, `frontend/src/features/projects/ProjectPicker.tsx`, `frontend/src/features/projects/RepositoryList.tsx`, `frontend/tests/unit/projects.test.tsx`, `frontend/src/app/WorkspaceShell.tsx`.

  **Dependencias**: T024, T020, T018. **Traza**: FR-001–FR-008, FR-072–FR-074; US-001. **Checks**: FE.

  **Aceptación**: Dos repositorios visibles con contexto; reapertura y errores sin perder selección válida. El proyecto activo alimenta el shell.

- [x] T026 [US1] Validar persistencia y aislamiento de un proyecto multi-repo — `frontend/tests/e2e/projects.spec.ts`.

  **Dependencias**: T025, T010, T020, T018. **Traza**: US-001; SC-001 parcial; NFR-001–NFR-002. **Checks**: E2E.

  **Aceptación**: Crear dos repos, reabrir proyecto y hacer inaccesible una ruta de fixture; comprobar preservación y mensajes. No declarar completado SC-001 hasta ciclo con ejecución.

## Fase 4 - US-002: agentes, plantillas y skills (P1)

Verificación independiente: plantilla, instancia, SKILL.md, binding y promoción explícita, sin ejecución por arista. El snapshot durante ejecución se verifica también en fase 7.

- [x] T027 [US2] Modelar plantilla versionada e instancia sin overrides configurables — `backend/src/main/java/com/zeko/agentdesign/domain/AgentTemplate.java`, `backend/src/main/java/com/zeko/agentdesign/domain/TemplateVersion.java`, `backend/src/main/java/com/zeko/agentdesign/domain/AgentInstance.java`, `backend/src/main/java/com/zeko/agentdesign/domain/TemplateUpdateDecision.java`, `backend/src/test/java/com/zeko/agentdesign/AgentTemplateTest.java`.

  **Dependencias**: T021, T020, T018. **Traza**: FR-009–FR-011, FR-021; data-model §Agentes. **Checks**: BE.

  **Aceptación**: Versiones inmutables, identidad/contexto/estado propios y aceptación por instancia; no campos de override sobre configuración de plantilla.

- [x] T028 [P] [US2] Persistir versiones e instancias y decisiones de actualización — `backend/src/main/java/com/zeko/agentdesign/application/AgentRepository.java`, `backend/src/main/java/com/zeko/agentdesign/infrastructure/JdbcAgentRepository.java`, `backend/src/main/resources/db/migration/V004__agents_templates.sql`, `backend/src/test/java/com/zeko/agentdesign/AgentRepositoryIntegrationTest.java`.

  **Dependencias**: T027, T022, T020, T018. **Traza**: FR-009–FR-011, FR-021; NFR-001. **Checks**: BEI.

  **Aceptación**: Decisión conserva versión previa/nueva y selección de futuras ejecuciones; concurrencia optimista preserva versiones.

- [x] T029 [P] [US2] Modelar skills de proyecto y vínculos por instancia — `backend/src/main/java/com/zeko/agentdesign/domain/SkillDefinition.java`, `backend/src/main/java/com/zeko/agentdesign/domain/AgentSkillBinding.java`, `backend/src/test/java/com/zeko/agentdesign/SkillBindingTest.java`.

  **Dependencias**: T027, T020, T018. **Traza**: FR-015–FR-020; data-model §Skills. **Checks**: BE.

  **Aceptación**: Binding y definición distintos; validar existencia/ownership de Project sin conceder permisos adicionales.

- [x] T030 [P] [US2] Registrar SKILL.md y persistir definiciones y bindings — `backend/src/main/java/com/zeko/agentdesign/application/SkillRepository.java`, `backend/src/main/java/com/zeko/agentdesign/infrastructure/JdbcSkillRepository.java`, `backend/src/main/java/com/zeko/agentdesign/infrastructure/SkillFileStore.java`, `backend/src/main/resources/db/migration/V005__skills_bindings.sql`, `backend/src/test/java/com/zeko/agentdesign/SkillStoreIntegrationTest.java`.

  **Dependencias**: T029, T028, T020, T018. **Traza**: FR-015–FR-018, FR-020; NFR-004. **Checks**: BEI.

  **Aceptación**: Archivos dentro del scope, huella y metadata coherentes; texto de skill no concede autoridad para abrir herramientas; errores no destruyen el archivo.

- [x] T031 [P] [US2] Implementar creación/consulta/versionado de agentes — `backend/src/main/java/com/zeko/agentdesign/application/AgentService.java`, `backend/src/main/java/com/zeko/agentdesign/api/AgentController.java`, `backend/src/main/java/com/zeko/agentdesign/api/AgentDtos.java`, `backend/src/test/java/com/zeko/agentdesign/AgentApiContractTest.java`.

  **Dependencias**: T028, T024, T020, T018. **Traza**: FR-009–FR-013, FR-021; contrato agentes T004. **Checks**: BEC.

  **Aceptación**: Creación real de instancia y lectura de configuración/relaciones además de plantilla; aceptación de versión sin mutar ejecución activa.

- [x] T032 [P] [US2] Implementar gestión de skills y asociaciones — `backend/src/main/java/com/zeko/agentdesign/application/SkillService.java`, `backend/src/main/java/com/zeko/agentdesign/api/SkillController.java`, `backend/src/main/java/com/zeko/agentdesign/api/SkillDtos.java`, `backend/src/test/java/com/zeko/agentdesign/SkillApiContractTest.java`.

  **Dependencias**: T030, T031, T020, T018. **Traza**: FR-015–FR-018, FR-020; contrato skills T004. **Checks**: BEC.

  **Aceptación**: Alta/lectura/vinculación necesarias para US-002; datos inválidos y cross-project rechazados.

- [x] T033 [P] [US2] Implementar promoción global explícita y registrada — `backend/src/main/java/com/zeko/agentdesign/application/PromotionService.java`, `backend/src/main/java/com/zeko/agentdesign/api/PromotionController.java`, `backend/src/test/java/com/zeko/agentdesign/PromotionIntegrationTest.java`.

  **Dependencias**: T032, T017, T003, T020, T018. **Traza**: FR-019; data-model §Ownership; contrato promoción T004. **Checks**: BEI.

  **Aceptación**: Acción explícita con alcance visible y registro seguro; no duplicación/promoción automática; global no implica compartir agentes o memoria de otros proyectos.

- [x] T034 [P] [US2] Implementar Agents Canvas y edición/versionado de plantillas — `frontend/src/features/agents/agentApi.ts`, `frontend/src/features/agents/AgentsCanvas.tsx`, `frontend/src/features/agents/AgentTemplateEditor.tsx`, `frontend/src/features/agents/TemplateUpdateDialog.tsx`, `frontend/tests/unit/agents-canvas.test.tsx`, `frontend/src/app/WorkspaceShell.tsx`.

  **Dependencias**: T031, T025, T020, T018. **Traza**: FR-009–FR-014, FR-018, FR-021; D-005. **Checks**: FE.

  **Aceptación**: Relaciones comprensibles, actualización por instancia y configuración vigente/futura visibles; aristas no inician ejecución.

- [x] T035 [US2] Implementar asociación y promoción explícita de skills/agentes — `frontend/src/features/skills/skillApi.ts`, `frontend/src/features/skills/SkillPanel.tsx`, `frontend/src/features/skills/SkillBindingEditor.tsx`, `frontend/src/features/agents/PromotionDialog.tsx`, `frontend/tests/unit/skills.test.tsx`, `frontend/src/features/agents/AgentsCanvas.tsx`.

  **Dependencias**: T032, T033, T034, T020, T018. **Traza**: FR-015–FR-020; US-002. **Checks**: FE.

  **Aceptación**: Definición, vínculo y alcance distinguibles; promover requiere acción explícita y muestra efecto. No UI para MCP/custom tools.

- [x] T036 [US2] Validar configuración de agentes y skills local-first — `frontend/tests/e2e/agents-skills.spec.ts`.

  **Dependencias**: T035, T026, T020, T018. **Traza**: US-002; SC-001 parcial; FR-009–FR-020. **Checks**: E2E.

  **Aceptación**: Crear plantilla/instancia/skill/binding y promover explícitamente; verificar entidades distintas y ausencia de ejecución al dibujar aristas.

## Fase 5 - US-003: instrucciones y coordinación (P1)

Verificación independiente: conversación directa/PM, precedencia, registro de override y follow-ups en los tres modos con un gateway de ejecución controlado. La integración real del bucle está en fase 7.

- [x] T037 [US3] Modelar conversación, instrucción y precedencia del usuario — `backend/src/main/java/com/zeko/coordination/domain/Conversation.java`, `backend/src/main/java/com/zeko/coordination/domain/Instruction.java`, `backend/src/main/java/com/zeko/coordination/domain/InstructionPrecedence.java`, `backend/src/test/java/com/zeko/coordination/InstructionPrecedenceTest.java`.

  **Dependencias**: T027, T017, T020, T018. **Traza**: FR-022–FR-029; US-003. **Checks**: BE.

  **Aceptación**: Usuario prevalece sobre reglas/PM/agente/skill/default; override vincula decisión y alcance, no autoriza cambios de permisos ni contenido RAG como instrucción.

- [x] T038 [P] [US3] Persistir conversaciones e historial de instrucciones — `backend/src/main/java/com/zeko/coordination/application/ConversationRepository.java`, `backend/src/main/java/com/zeko/coordination/infrastructure/JdbcConversationRepository.java`, `backend/src/main/resources/db/migration/V006__conversations_instructions.sql`, `backend/src/test/java/com/zeko/coordination/ConversationStoreIntegrationTest.java`.

  **Dependencias**: T037, T028, T020, T018. **Traza**: FR-022–FR-029; NFR-001–NFR-002. **Checks**: BEI.

  **Aceptación**: Historial por Project/interlocutor, origen y override trazados; no sobrescribir instrucciones al continuar.

- [x] T039 [P] [US3] Implementar reglas de iniciativa confirmadas para follow-ups — `backend/src/main/java/com/zeko/coordination/domain/AutonomyMode.java`, `backend/src/main/java/com/zeko/coordination/domain/FollowUpProposal.java`, `backend/src/main/java/com/zeko/coordination/domain/InitiativePolicy.java`, `backend/src/test/java/com/zeko/coordination/InitiativePolicyTest.java`.

  **Dependencias**: T037, T001, T020, T018. **Traza**: FR-031–FR-033, FR-044; spec §Clarificaciones. **Checks**: BE.

  **Aceptación**: Manual no crea follow-ups; Assisted no crea antes de confirmar; Autonomous solo relacionados a instrucción vigente. No equiparar Manual a una sola acción. Duplicados/rechazo/cambio de instrucción no producen seguimiento indebido.

- [x] T040 [US3] Persistir propuestas y confirmaciones de seguimiento — `backend/src/main/java/com/zeko/coordination/application/FollowUpRepository.java`, `backend/src/main/java/com/zeko/coordination/infrastructure/JdbcFollowUpRepository.java`, `backend/src/main/resources/db/migration/V007__follow_up_proposals.sql`, `backend/src/test/java/com/zeko/coordination/FollowUpRepositoryIntegrationTest.java`.

  **Dependencias**: T039, T038, T020, T018. **Traza**: FR-027, FR-031–FR-033, FR-044; diseño de autonomía sincronizado. **Checks**: BEI.

  **Aceptación**: Guardar estado/progenitor/instrucción y decisión conforme al modelo; confirmación repetida no duplica creación; no modelar aprobación de herramienta como confirmación de seguimiento.

- [x] T041 [US3] Implementar conversación directa, coordinación PM y confirmación — `backend/src/main/java/com/zeko/coordination/application/ConversationService.java`, `backend/src/main/java/com/zeko/coordination/application/CoordinationService.java`, `backend/src/main/java/com/zeko/coordination/application/ExecutionGateway.java`, `backend/src/main/java/com/zeko/coordination/api/ConversationController.java`, `backend/src/main/java/com/zeko/coordination/api/ConversationDtos.java`, `backend/src/test/java/com/zeko/coordination/ConversationContractTest.java`.

  **Dependencias**: T040, T031, T018, T020. **Traza**: FR-022–FR-029, FR-044; contracts HTTP/WS. **Checks**: BEC.

  **Aceptación**: Usuario puede entrar por PM o agente; reportes y decisiones trazados; gateway delimita ejecución. Probar coordinación con doble de gateway sin fingir agente real.

- [x] T042 [P] [US3] Implementar conversación PM/agente y propuesta de follow-up — `frontend/src/features/conversations/conversationApi.ts`, `frontend/src/features/conversations/ConversationPanel.tsx`, `frontend/src/features/conversations/FollowUpPrompt.tsx`, `frontend/src/features/conversations/ConversationPanel.test.tsx`, `frontend/src/app/WorkspaceShell.tsx`.

  **Dependencias**: T041, T035, T020, T018. **Traza**: FR-022–FR-029, FR-044, FR-072–FR-074; US-003. **Checks**: FE.

  **Aceptación**: Canal directo, origen y confirmación visibles; Assisted espera confirmación para crear follow-up y no sustituye el approval de acción.

- [x] T043 [P] [US3] Validar precedencia y confirmación sin dependencia del modelo real — `backend/src/test/java/com/zeko/coordination/CoordinationIntegrationTest.java`.

  **Dependencias**: T041, T020, T018. **Traza**: US-003; FR-022–FR-029, FR-044. **Checks**: BEI.

  **Aceptación**: Probar reportes PM, override e iniciativa con gateway controlado; acceso directo no elude permisos. La integración real se completa en fase de ejecución.

## Fase 6 - US-004: permisos y aprobación (P1)

Verificación independiente: clasificar acciones y aceptar/denegar/invalidar una revisión, mostrando permiso e iniciativa separados. Las pruebas E2E con efectos reales del dispatcher se completan en fase 7.

- [x] T044 [US4] Modelar permisos independientes y política conservadora — `backend/src/main/java/com/zeko/executioncontrol/domain/PermissionMode.java`, `backend/src/main/java/com/zeko/executioncontrol/domain/PermissionPolicy.java`, `backend/src/main/java/com/zeko/executioncontrol/domain/PermissionDecision.java`, `backend/src/test/java/com/zeko/executioncontrol/PermissionPolicyTest.java`.

  **Dependencias**: T012, T003, T020, T018. **Traza**: FR-030–FR-044; NFR-005. **Checks**: BE.

  **Aceptación**: Prohibiciones primero; mutante/red/destructiva requiere Ask; Auto solo local no destructiva expresamente cubierta; Full no elimina prohibiciones ni denegaciones. Efectos compuestos no se reducen a categoría inocua.

- [x] T045 [US4] Modelar acción canónica y aprobación por revisión — `backend/src/main/java/com/zeko/executioncontrol/domain/ActionProposal.java`, `backend/src/main/java/com/zeko/executioncontrol/domain/Approval.java`, `backend/src/main/java/com/zeko/executioncontrol/domain/ApprovalDecision.java`, `backend/src/test/java/com/zeko/executioncontrol/ApprovalRevisionTest.java`.

  **Dependencias**: T044, T020, T018. **Traza**: FR-035, FR-038–FR-040; data-model §ActionProposal/Approval. **Checks**: BE.

  **Aceptación**: Cambio de acción/recurso/alcance/efecto invalida solicitud pendiente; distintas acciones no comparten identidad/revisión; decisión tardía o duplicada no habilita ejecución.

- [x] T046 [P] [US4] Persistir políticas, revisiones y aprobación con control concurrente — `backend/src/main/java/com/zeko/executioncontrol/application/ApprovalRepository.java`, `backend/src/main/java/com/zeko/executioncontrol/infrastructure/JdbcApprovalRepository.java`, `backend/src/main/resources/db/migration/V008__permission_actions_approvals.sql`, `backend/src/test/java/com/zeko/executioncontrol/ApprovalConcurrencyIntegrationTest.java`.

  **Dependencias**: T045, T013, T020, T018. **Traza**: FR-030, FR-035–FR-043; D-003. **Checks**: BEI.

  **Aceptación**: Transacción corta actualiza versión/estado de aprobación; carrera invalidar/aprobar rechaza revisión obsoleta; metadata operativa y vista de auditoría segura diferenciadas.

- [x] T047 [P] [US4] Normalizar y clasificar acciones para el límite de ejecución — `backend/src/main/java/com/zeko/executioncontrol/application/ActionClassifier.java`, `backend/src/main/java/com/zeko/executioncontrol/infrastructure/HostActionNormalizer.java`, `backend/src/test/java/com/zeko/executioncontrol/ActionClassifierTest.java`.

  **Dependencias**: T045, T023, T020, T018. **Traza**: FR-020, FR-034, FR-039, FR-041–FR-045; D-007. **Checks**: BE.

  **Aceptación**: Rutas/cwd/argumentos/red validados; catálogo cerrado aplica efectos compuestos conservadores y normalización por host. No autorizar shell arbitrario por coincidencia de texto; no afirmar equivalencia semántica universal.

- [x] T048 [P] [US4] Exponer solicitudes y decisiones de aprobación seguras — `backend/src/main/java/com/zeko/executioncontrol/application/ApprovalService.java`, `backend/src/main/java/com/zeko/executioncontrol/api/ApprovalController.java`, `backend/src/main/java/com/zeko/executioncontrol/api/ApprovalDtos.java`, `backend/src/test/java/com/zeko/executioncontrol/ApprovalContractTest.java`.

  **Dependencias**: T046, T047, T015, T018, T020. **Traza**: FR-035–FR-043; contracts HTTP/WS. **Checks**: BEC.

  **Aceptación**: Vista contiene agente/task/acción/recurso/alcance/efectos; 409 approval-stale bloquea respuesta obsoleta; eventos invalidación/decisión correlacionados y sin ejecutar adaptadores.

- [x] T049 [P] [US4] Configurar y consultar permiso/autonomía sin acoplarlos — `backend/src/main/java/com/zeko/executioncontrol/application/PermissionPolicyService.java`, `backend/src/main/java/com/zeko/executioncontrol/api/PermissionPolicyController.java`, `backend/src/main/java/com/zeko/coordination/application/AutonomySettingsService.java`, `backend/src/main/java/com/zeko/coordination/api/AutonomySettingsController.java`, `backend/src/test/java/com/zeko/coordination/ModeSettingsContractTest.java`.

  **Dependencias**: T044, T040, T046, T015, T020, T018. **Traza**: FR-030–FR-033, FR-037, FR-044; contrato modos T004. **Checks**: BEC.

  **Aceptación**: Persistencia y DTOs de cada dimensión separados conforme a diseño; modificar una no toca otra ni agrega overrides de configuración de plantilla.

- [x] T050 [P] [US4] Implementar prompt legible de aprobación e invalidación — `frontend/src/features/approvals/approvalApi.ts`, `frontend/src/features/approvals/ApprovalPrompt.tsx`, `frontend/src/features/approvals/ApprovalPrompt.test.tsx`.

  **Dependencias**: T048, T019, T020, T018. **Traza**: FR-035, FR-038–FR-040, FR-072–FR-074; US-004. **Checks**: FE.

  **Aceptación**: Muestra información vigente, aceptar/denegar y solicitud invalidada; clic tardío muestra conflicto sin éxito falso; aprobación pendiente nunca implica ejecución.

- [x] T051 [P] [US4] Implementar controles independientes de permiso y autonomía — `frontend/src/features/agents/ModeSettings.tsx`, `frontend/src/features/agents/ModeSettings.test.tsx`, `frontend/src/features/agents/AgentsCanvas.tsx`.

  **Dependencias**: T049, T034, T020, T018. **Traza**: FR-030–FR-033, FR-037, FR-044; US-004. **Checks**: FE.

  **Aceptación**: Explicar iniciativa por follow-ups y permiso aplicable; cambios persisten separadamente sin inferir Full=Autonomous.

- [x] T052 [P] [US4] Probar nueve combinaciones de permiso e iniciativa — `backend/src/test/java/com/zeko/coordination/PermissionAutonomyMatrixTest.java`.

  **Dependencias**: T049, T043, T047, T020, T018. **Traza**: FR-030–FR-044; SC-004. **Checks**: BEI.

  **Aceptación**: Matriz 3×3 conserva independencia y autorizaciones; incluir follow-ups permitidos/pendientes/prohibidos por modo, denegación previa y destructiva con Full Access.

## Fase 7 - US-005: ejecución local aislada y resultados (P1)

Verificación independiente: tarea autorizada hasta resultado/diff; dos worktrees, bloqueo manual y cancelación/reintento. Sin cambio de scope, commit, merge ni push automático.

- [x] T053 [US5] Modelar Task, Execution, snapshot y efectos — `backend/src/main/java/com/zeko/executioncontrol/domain/Task.java`, `backend/src/main/java/com/zeko/executioncontrol/domain/Execution.java`, `backend/src/main/java/com/zeko/executioncontrol/domain/ExecutionSnapshot.java`, `backend/src/main/java/com/zeko/executioncontrol/domain/EffectRecord.java`, `backend/src/test/java/com/zeko/executioncontrol/ExecutionLifecycleTest.java`.

  **Dependencias**: T045, T027, T003, T020, T018. **Traza**: FR-021, FR-045–FR-052, FR-057, FR-062–FR-063; D-009. **Checks**: BE.

  **Aceptación**: Intentos distintos, snapshot inmutable y cancelación solo confirmada; estado desconocido separado de éxito; modelo permite completar sin obligación artificial de pasar por approval.

- [x] T054 [P] [US5] Persistir tareas, intentos, snapshot y efectos seguros — `backend/src/main/java/com/zeko/executioncontrol/application/ExecutionRepository.java`, `backend/src/main/java/com/zeko/executioncontrol/infrastructure/JdbcExecutionRepository.java`, `backend/src/main/resources/db/migration/V009__tasks_executions_effects.sql`, `backend/src/test/java/com/zeko/executioncontrol/ExecutionStoreIntegrationTest.java`.

  **Dependencias**: T053, T046, T017, T038, T020, T018. **Traza**: FR-046–FR-048, FR-057, FR-062–FR-063; NFR-001. **Checks**: BEI.

  **Aceptación**: Orden de migraciones coherente con FK a las acciones existentes; persistir último estado y efecto confirmado, sin transacción extendida a un proceso externo.

- [x] T055 [P] [US5] Modelar ownership de worktree y conflicto manual — `backend/src/main/java/com/zeko/executioncontrol/domain/Worktree.java`, `backend/src/main/java/com/zeko/executioncontrol/domain/ConflictRecord.java`, `backend/src/test/java/com/zeko/executioncontrol/WorktreeOwnershipTest.java`.

  **Dependencias**: T053, T020, T018. **Traza**: FR-053–FR-055; D-008; modelo revisado T003. **Checks**: BE.

  **Aceptación**: Exclusividad por ruta física y dueño activo además de repository+task; cancelar una Task bloqueada no la vuelve ejecutable.

- [x] T056 [P] [US5] Implementar reserva transaccional y rechazo de segundo escritor — `backend/src/main/java/com/zeko/executioncontrol/application/WorktreeRepository.java`, `backend/src/main/java/com/zeko/executioncontrol/infrastructure/JdbcWorktreeRepository.java`, `backend/src/main/resources/db/migration/V010__worktrees_conflicts.sql`, `backend/src/test/java/com/zeko/executioncontrol/WorktreeReservationIntegrationTest.java`.

  **Dependencias**: T055, T054, T020, T018. **Traza**: FR-053–FR-055; SC-002; D-003, D-008. **Checks**: BEI.

  **Aceptación**: Probar solicitudes simultáneas, misma ruta con distintas tasks, misma task con distintas executions y reapertura; preservar conflictos sin sustitución de dueño.

- [x] T057 [P] [US5] Integrar Git worktrees y captura del diff atribuible — `backend/src/main/java/com/zeko/executioncontrol/application/GitWorkspacePort.java`, `backend/src/main/java/com/zeko/executioncontrol/infrastructure/GitWorktreeAdapter.java`, `backend/src/main/java/com/zeko/executioncontrol/infrastructure/GitDiffReader.java`, `backend/src/test/java/com/zeko/executioncontrol/GitWorktreeIntegrationTest.java`.

  **Dependencias**: T056, T023, T047, T020, T018. **Traza**: FR-053–FR-058, FR-061; D-007, D-008. **Checks**: BEI.

  **Aceptación**: Repos temporales, baseline y cambios previos preservados; Git por argumentos seguros; ninguna limpieza destructiva/merge/push implícita. Efectos externos se registran tras confirmación.

- [x] T058 [P] [US5] Definir catálogo cerrado y puertos locales tipados — `backend/src/main/java/com/zeko/executioncontrol/application/LocalCapability.java`, `backend/src/main/java/com/zeko/executioncontrol/application/LocalActionAdapter.java`, `backend/src/main/java/com/zeko/executioncontrol/application/LocalActionResult.java`, `backend/src/main/java/com/zeko/executioncontrol/application/CapabilityRegistry.java`, `backend/src/test/java/com/zeko/executioncontrol/CapabilityRegistryTest.java`.

  **Dependencias**: T053, T047, T020, T018. **Traza**: FR-020, FR-045, FR-076; D-007. **Checks**: BE.

  **Aceptación**: Solo capacidades integradas y resultados conocidos/efectos/cancelación tipados; ninguna vía de registro de herramienta del usuario o MCP.

- [x] T059 [P] [US5] Implementar adaptador de filesystem dentro del scope — `backend/src/main/java/com/zeko/executioncontrol/infrastructure/LocalFilesystemAdapter.java`, `backend/src/test/java/com/zeko/executioncontrol/FilesystemAdapterIntegrationTest.java`.

  **Dependencias**: T058, T057, T020, T018. **Traza**: FR-034, FR-045, FR-056; NFR-002–NFR-005. **Checks**: BEI.

  **Aceptación**: Operaciones autorizables dentro del worktree, validación de ruta/enlaces y efectos seguros; verificar intento de salir del scope con fixtures.

- [x] T060 [P] [US5] Implementar procesos de terminal y detención confirmada — `backend/src/main/java/com/zeko/executioncontrol/infrastructure/LocalTerminalAdapter.java`, `backend/src/test/java/com/zeko/executioncontrol/TerminalAdapterIntegrationTest.java`.

  **Dependencias**: T058, T057, T020, T018. **Traza**: FR-045, FR-049–FR-052; D-007. **Checks**: BEI.

  **Aceptación**: Argumentos/cwd y salida controlados, estado real del proceso y cancelación observables; no éxito si sigue activo; pruebas locales acotadas sin shell con secretos.

- [x] T061 [P] [US5] Implementar adaptador Docker local e indisponibilidad — `backend/src/main/java/com/zeko/executioncontrol/infrastructure/LocalDockerAdapter.java`, `backend/src/test/java/com/zeko/executioncontrol/DockerAdapterTest.java`, `backend/src/test/java/com/zeko/executioncontrol/DockerLiveIntegrationTest.java`.

  **Dependencias**: T058, T060, T020, T018. **Traza**: FR-045, FR-062–FR-063; D-007, D-010. **Checks**: BEI.

  **Aceptación**: Identificar Docker y efectos conocidos; pruebas deterministas de disponible/fallo y suite real diferenciada; no descargar imágenes ni usar daemon remoto silenciosamente.

- [x] T062 [P] [US5] Implementar cliente Ollama local y resultados de generación — `backend/src/main/java/com/zeko/executioncontrol/application/LocalModelPort.java`, `backend/src/main/java/com/zeko/executioncontrol/infrastructure/OllamaLocalClient.java`, `backend/src/test/java/com/zeko/executioncontrol/OllamaClientContractTest.java`, `backend/src/test/java/com/zeko/executioncontrol/OllamaLiveIntegrationTest.java`.

  **Dependencias**: T058, T015, T020, T018. **Traza**: FR-045, FR-062–FR-063; D-007, D-010. **Checks**: BEC.

  **Aceptación**: Solo endpoint local conforme a política, streaming/finalización/fallo distinguibles; dobles reproducibles y validación real separada. No cloud ni descarga de modelos implícita.

- [x] T063 [US5] Aplicar autorización en el dispatcher antes del adaptador real — `backend/src/main/java/com/zeko/executioncontrol/application/AuthorizedActionDispatcher.java`, `backend/src/test/java/com/zeko/executioncontrol/AuthorizedActionDispatcherIntegrationTest.java`.

  **Dependencias**: T054, T048, T047, T056, T059, T060, T061, T062, T020, T018. **Traza**: FR-020, FR-034–FR-045, FR-053–FR-054; NFR-005. **Checks**: BEI.

  **Aceptación**: Revalidar política, revisión, denegación, scope y dueño inmediatamente antes del efecto. Tests prueban cero invocaciones al denegar/invalidar/alterar acción o cambiar adaptador; no reintentar automáticamente efectos externos.

- [x] T064 [P] [US5] Iniciar intentos con snapshot y publicar resultados confirmados — `backend/src/main/java/com/zeko/executioncontrol/application/ExecutionService.java`, `backend/src/main/java/com/zeko/executioncontrol/api/ExecutionController.java`, `backend/src/main/java/com/zeko/executioncontrol/api/ExecutionDtos.java`, `backend/src/test/java/com/zeko/executioncontrol/ExecutionContractTest.java`.

  **Dependencias**: T063, T028, T018, T020. **Traza**: FR-021, FR-045–FR-048, FR-057; contratos tareas/ejecución T004. **Checks**: BEC.

  **Aceptación**: Crear Task y Execution trazables; snapshot congelado al iniciar; ejecutar solo mediante dispatcher y entregar detalle consultable y eventos seguros.

- [x] T065 [P] [US5] Implementar cancelación y reintento manual como intento nuevo — `backend/src/main/java/com/zeko/executioncontrol/application/CancellationService.java`, `backend/src/main/java/com/zeko/executioncontrol/application/ManualRetryService.java`, `backend/src/main/java/com/zeko/executioncontrol/api/ExecutionControlController.java`, `backend/src/test/java/com/zeko/executioncontrol/CancelRetryIntegrationTest.java`.

  **Dependencias**: T064, T020, T018. **Traza**: FR-049–FR-052, FR-062–FR-063; D-009. **Checks**: BEI.

  **Aceptación**: Mostrar último estado/efectos; cancelación real confirmada, nueva Execution con vínculo anterior solo por usuario; reconectar/reiniciar app no vuelve a ejecutar operaciones.

- [x] T066 [P] [US5] Exponer conflicto bloqueante y resolución explícita — `backend/src/main/java/com/zeko/executioncontrol/application/ConflictService.java`, `backend/src/main/java/com/zeko/executioncontrol/api/ConflictController.java`, `backend/src/test/java/com/zeko/executioncontrol/ConflictContractTest.java`.

  **Dependencias**: T064, T056, T020, T018. **Traza**: FR-055; SC-002; contrato conflict-resolution. **Checks**: BEC.

  **Aceptación**: Cancelar, reasignar o registrar resolución manual con parámetros suficientes; validar destino/estado actual y preservar worktree/cambios. Cancelar no conduce a READY.

- [x] T067 [P] [US5] Validar commits autorizados y evidencia de cambios — `backend/src/main/java/com/zeko/executioncontrol/domain/CommitMessagePolicy.java`, `backend/src/main/java/com/zeko/executioncontrol/application/AuthorizedCommitService.java`, `backend/src/main/java/com/zeko/executioncontrol/infrastructure/GitCommitAdapter.java`, `backend/src/test/java/com/zeko/executioncontrol/AuthorizedCommitIntegrationTest.java`.

  **Dependencias**: T063, T057, T020, T018. **Traza**: FR-057–FR-061; constitución §Git. **Checks**: BEI.

  **Aceptación**: Un commit solo tras acción autorizada, diff de su task y checks; Conventional Commits e ID, sin Co-authored-by/firmas/trailers de asistentes. Nada de commit/push/merge por terminar una Execution.

- [x] T068 [P] [US5] Conectar coordinación con ejecuciones y generación local — `backend/src/main/java/com/zeko/coordination/infrastructure/ExecutionGatewayAdapter.java`, `backend/src/main/java/com/zeko/coordination/application/AgentLoop.java`, `backend/src/main/java/com/zeko/coordination/infrastructure/LocalModelGateway.java`, `backend/src/test/java/com/zeko/coordination/AgentLoopIntegrationTest.java`.

  **Dependencias**: T041, T039, T064, T065, T062, T052, T020, T018. **Traza**: FR-022–FR-029, FR-044–FR-045; plan §Flujo de ejecución. **Checks**: BEI.

  **Aceptación**: Instrucción vigente delimita tarea/follow-ups, gateway usa contratos públicos sin ciclos; cada acción pasa por dispatcher. Assisted confirma creación, no acciones implícitas; Autonomous no amplía scope o permisos ni reanuda intentos interrumpidos.

- [x] T069 [P] [US5] Implementar cliente de eventos y reconciliación por snapshot — `frontend/src/features/runtime/runtimeApi.ts`, `frontend/src/features/runtime/runtimeEvents.ts`, `frontend/src/features/runtime/runtimeEvents.test.ts`.

  **Dependencias**: T064, T005, T019, T020, T018. **Traza**: FR-047–FR-048, FR-062; D-006; contracts/websocket.md. **Checks**: FE.

  **Aceptación**: Deduplicar por eventId y secuencia por recurso; huecos/reconexión consultan endpoint real; no descartar evento por secuencia de otro recurso ni solicitar reintento.

- [x] T070 [P] [US5] Implementar Runtime Canvas con estados y contexto de ejecución — `frontend/src/features/runtime/RuntimeCanvas.tsx`, `frontend/src/features/runtime/ExecutionCard.tsx`, `frontend/src/features/runtime/RuntimeCanvas.test.tsx`, `frontend/src/app/WorkspaceShell.tsx`.

  **Dependencias**: T069, T050, T042, T051, T020, T018. **Traza**: FR-046–FR-048, FR-071–FR-074; D-005. **Checks**: FE.

  **Aceptación**: Estados visibles, approvals incrustados con identidad, contexto y control; estado visual XYFlow no muta dominio ni dispara workflows.

- [x] T071 [P] [US5] Implementar cancelación, reintento y conflicto en UI — `frontend/src/features/runtime/ExecutionControls.tsx`, `frontend/src/features/runtime/ConflictPanel.tsx`, `frontend/src/features/runtime/ExecutionControls.test.tsx`, `frontend/src/features/runtime/RuntimeCanvas.tsx`.

  **Dependencias**: T070, T065, T066, T020, T018. **Traza**: FR-049–FR-055, FR-062–FR-063; US-005, US-007. **Checks**: FE.

  **Aceptación**: Acciones explícitas, último estado y efectos antes de reintentar; no mostrar cancelada hasta confirmar; conflicto mantiene cambios y ofrece opciones manuales.

- [x] T072 [P] [US5] Exponer resultados, diff y vínculos de evidencia — `backend/src/main/java/com/zeko/executioncontrol/application/ExecutionResultQuery.java`, `backend/src/main/java/com/zeko/executioncontrol/api/ExecutionResultController.java`, `backend/src/main/java/com/zeko/traceability/api/TraceQueryController.java`, `backend/src/test/java/com/zeko/executioncontrol/ExecutionResultContractTest.java`.

  **Dependencias**: T064, T057, T017, T016, T020, T018. **Traza**: FR-048, FR-056–FR-057, FR-075; contrato consultas T004. **Checks**: BEC.

  **Aceptación**: Resultado/diff/trazas consultables con ownership; separar diff atribuible y cambios previos; redactar vista de secretos sin modificar silenciosamente archivos originales.

- [x] T073 [P] [US5] Implementar revisión del resultado y diff trazable — `frontend/src/features/traceability/traceApi.ts`, `frontend/src/features/traceability/TracePanel.tsx`, `frontend/src/features/runtime/ExecutionResultPanel.tsx`, `frontend/src/features/runtime/DiffViewer.tsx`, `frontend/tests/unit/execution-result.test.tsx`, `frontend/src/features/runtime/RuntimeCanvas.tsx`.

  **Dependencias**: T071, T072, T020, T018. **Traza**: FR-048, FR-056–FR-057, FR-075; SC-001. **Checks**: FE.

  **Aceptación**: Navegación de task/ejecución/cambio/evidencia con contexto y fallos; diff no confunde cambios ajenos con la tarea.

- [x] T074 [P] [US5] Probar integración de actualización de plantilla con ejecución activa — `backend/src/test/java/com/zeko/executioncontrol/TemplateSnapshotIntegrationTest.java`.

  **Dependencias**: T064, T031, T068, T020, T018. **Traza**: FR-021; US-002 aceptación 6–7; quickstart V-002. **Checks**: BEI.

  **Aceptación**: Aceptar actualización durante ejecución no modifica snapshot; siguiente intento usa versión seleccionada vigente conforme al diseño; no override configurable.

- [x] T075 [P] [US5] Validar ciclo autorizado completo y aprobación obsoleta — `frontend/tests/e2e/authorized-execution.spec.ts`.

  **Dependencias**: T073, T068, T074, T036, T020, T018. **Traza**: US-003–US-005; SC-001, SC-003–SC-004; quickstart V-001–V-003. **Checks**: E2E.

  **Aceptación**: Modelo/adaptadores deterministas para flujo completo; aprobación denegada y clic tardío no causan efecto; resultados/diff mantienen IDs; escenarios de follow-up para tres modos.

- [x] T076 [P] [US5] Validar concurrencia, conflictos y cancelación entre dos tareas — `frontend/tests/e2e/worktree-conflicts.spec.ts`.

  **Dependencias**: T075, T066, T065, T020, T018. **Traza**: US-005; SC-002, SC-006; quickstart V-004–V-005. **Checks**: E2E.

  **Aceptación**: Dos worktrees aislados y segundo escritor rechazado; conflicto conserva cambios previos; cancelación/reintento reflejan realidad y no automatizan resolución.

## Fase 8 - US-006: memoria y RAG local (P2)

Verificación independiente: contexto de dos proyectos y fuentes globales autorizadas, con ownership, vacío/error y secretos excluidos. RAG no crea autoridad.

- [x] T077 [US6] Modelar memoria y autorización de recuperación en cuatro niveles — `backend/src/main/java/com/zeko/memorysearch/domain/MemoryEntry.java`, `backend/src/main/java/com/zeko/memorysearch/domain/MemoryScope.java`, `backend/src/main/java/com/zeko/memorysearch/domain/MemoryAccessPolicy.java`, `backend/src/test/java/com/zeko/memorysearch/MemoryAccessPolicyTest.java`.

  **Dependencias**: T037, T027, T003, T020, T018. **Traza**: FR-064–FR-067; NFR-002; modelo revisado T003. **Checks**: BE.

  **Aceptación**: Global/project/agent/conversation con ownership explícito; permisos de fuente evaluados antes de leer/retornar contenido; global no convierte todo dato de proyecto en compartido.

- [x] T078 [US6] Persistir fuentes, huellas y estado de indexación — `backend/src/main/java/com/zeko/memorysearch/application/MemoryRepository.java`, `backend/src/main/java/com/zeko/memorysearch/infrastructure/JdbcMemoryRepository.java`, `backend/src/main/resources/db/migration/V011__memory_sources.sql`, `backend/src/test/java/com/zeko/memorysearch/MemoryRepositoryIntegrationTest.java`.

  **Dependencias**: T077, T013, T038, T020, T018. **Traza**: FR-064–FR-069; NFR-001–NFR-002; D-004. **Checks**: BEI.

  **Aceptación**: Metadata CURRENT/STALE/UNAVAILABLE/EXCLUDED y pertenencia verificable; índice no es fuente de verdad para acceso.

- [x] T079 [US6] Leer solo fuentes locales admitidas y excluir contenido sensible — `backend/src/main/java/com/zeko/memorysearch/application/SourceAdmissionPolicy.java`, `backend/src/main/java/com/zeko/memorysearch/infrastructure/LocalSourceReader.java`, `backend/src/test/java/com/zeko/memorysearch/SourceAdmissionIntegrationTest.java`.

  **Dependencias**: T078, T016, T020, T018. **Traza**: FR-065–FR-070; NFR-004; fuentes acordadas T003. **Checks**: BEI.

  **Aceptación**: Respetar formatos/tamaño/scope fijados en diseño; .env/credenciales y fuentes no autorizadas se excluyen; cambios y desaparición de archivo invalidan metadata sin ingestión avanzada.

- [x] T080 [US6] Implementar índice reconstruible y búsquedas filtradas — `backend/src/main/java/com/zeko/memorysearch/application/ContextIndex.java`, `backend/src/main/java/com/zeko/memorysearch/infrastructure/LuceneContextIndex.java`, `backend/src/test/java/com/zeko/memorysearch/LuceneScopeIntegrationTest.java`.

  **Dependencias**: T079, T020, T018. **Traza**: FR-064–FR-070; D-004; SC-005. **Checks**: BEI.

  **Aceptación**: Indexar/actualizar/reconstruir fuentes autorizadas; filtros antes de ranking y lectura de snippets; vacío frente a error; global recuperable según diseño sin filtración entre proyectos.

- [x] T081 [US6] Exponer búsqueda e identificación de fuentes — `backend/src/main/java/com/zeko/memorysearch/application/MemorySearchService.java`, `backend/src/main/java/com/zeko/memorysearch/api/MemoryController.java`, `backend/src/main/java/com/zeko/memorysearch/api/MemoryDtos.java`, `backend/src/test/java/com/zeko/memorysearch/MemoryContractTest.java`.

  **Dependencias**: T080, T015, T018, T020. **Traza**: FR-064–FR-070; contracts HTTP/WS. **Checks**: BEC.

  **Aceptación**: Payload incluye fuente/nivel/ownership y errores previstos; acceso a fuente revalidado; cambio índice produce evento seguro.

- [x] T082 [P] [US6] Integrar recuperación como contexto sin elevar autoridad — `backend/src/main/java/com/zeko/coordination/application/ContextProvider.java`, `backend/src/main/java/com/zeko/memorysearch/infrastructure/CoordinationContextAdapter.java`, `backend/src/test/java/com/zeko/memorysearch/ContextAuthorityIntegrationTest.java`.

  **Dependencias**: T081, T068, T020, T018. **Traza**: FR-066–FR-067; FR-026; plan §Dependencias de módulos. **Checks**: BEI.

  **Aceptación**: Puertos preservan dependencias memory→coordination, sin ciclo inverso de módulos; contexto recuperado no se convierte en instrucciones de usuario/PM ni concesión de permisos.

- [x] T083 [US6] Resolver y mostrar memoria de la conversación activa — `backend/src/main/java/com/zeko/coordination/application/ConversationContextProvider.java`, `backend/src/main/java/com/zeko/coordination/application/ConversationService.java`, `backend/src/main/java/com/zeko/memorysearch/application/MemoryAccessContext.java`, `backend/src/main/java/com/zeko/memorysearch/application/MemorySearchService.java`, `backend/src/main/java/com/zeko/memorysearch/application/ContextIndex.java`, `backend/src/main/java/com/zeko/memorysearch/domain/MemoryAccessPolicy.java`, `backend/src/main/java/com/zeko/memorysearch/infrastructure/LuceneContextIndex.java`, `backend/src/main/java/com/zeko/memorysearch/api/MemoryController.java`, `backend/src/main/java/com/zeko/memorysearch/api/MemoryDtos.java`, `backend/src/test/java/com/zeko/memorysearch/MemoryConversationAccessIntegrationTest.java`, `frontend/src/features/memory/memoryApi.ts`, `frontend/src/features/memory/MemoryPanel.tsx`, `frontend/src/features/memory/MemoryPanel.test.tsx`, `frontend/src/features/conversations/conversationApi.ts`, `frontend/src/features/conversations/ConversationPanel.tsx`, `frontend/src/features/conversations/ConversationPanel.test.tsx`.

  **Dependencias**: T081, T042, T020, T018. **Traza**: FR-022–FR-023, FR-064–FR-068, FR-072–FR-074; NFR-002, NFR-004; US-006. **Checks**: BEC + FE.

  **Aceptación**: Crear o seleccionar conversación explícita; la búsqueda envía su `conversationId`, no un `projectId` o agentId inferido. Resolver Project, conversación y AgentInstance cuando aplique antes de filtrar/rankear. Distinguir vacío/error/desactualizado y mostrar fuente, nivel, ownership e indexState sin exponer contenido excluido.

- [x] T084 [US6] Validar contexto de dos proyectos y protección de secretos — `frontend/tests/e2e/memory-scope.spec.ts`.

  **Dependencias**: T083, T082, T075, T020, T018. **Traza**: US-006; SC-005; NFR-002, NFR-004; quickstart V-006. **Checks**: E2E.

  **Aceptación**: Fixtures con secreto sintético, conversación activa, contexto global autorizado y contexto aislado; verificar que la búsqueda usa el `conversationId`, muestra metadata segura de fuente y ausencia de secreto en índice/log/prompt/resultado/diff presentado.

## Fase 9 - US-007: estados y recuperación en UI (P2)

Verificación independiente: tabs separadas y estados reales al perder socket, proveedor o proceso; reconectar UI no reanuda Execution.

- [x] T085 [US7] Mostrar desconexión y proveedor afectado sin éxito falso — `backend/src/main/java/com/zeko/executioncontrol/domain/Execution.java`, `backend/src/main/java/com/zeko/executioncontrol/application/ExecutionRepository.java`, `backend/src/main/java/com/zeko/executioncontrol/application/ExecutionService.java`, `backend/src/main/java/com/zeko/executioncontrol/application/AuthorizedActionDispatcher.java`, `backend/src/main/java/com/zeko/executioncontrol/api/ExecutionController.java`, `backend/src/main/java/com/zeko/executioncontrol/api/ExecutionDtos.java`, `backend/src/main/java/com/zeko/executioncontrol/infrastructure/JdbcExecutionRepository.java`, `backend/src/main/resources/db/migration/V012__execution_provider.sql`, `backend/src/test/java/com/zeko/executioncontrol/ExecutionProviderTest.java`, `backend/src/test/java/com/zeko/executioncontrol/ExecutionLifecycleTest.java`, `frontend/src/app/WorkspaceShell.tsx`, `frontend/src/features/runtime/runtimeApi.ts`, `frontend/src/features/runtime/ProviderStatusPanel.tsx`, `frontend/src/features/runtime/ProviderStatusPanel.test.tsx`, `frontend/src/features/runtime/RuntimeCanvas.tsx`, `frontend/src/features/runtime/RuntimeCanvas.test.tsx`.

  **Dependencias**: T073, T069, T065, T020, T018. **Traza**: FR-062–FR-063, FR-071–FR-074; NFR-003; US-007. **Checks**: BEC + FE.

  **Aceptación**: Docker/Ollama se identifican solo desde el campo `provider` tipado y confirmado del snapshot, persistido desde `LocalCapability` durante un despacho autorizado; estado `FAILED` o `UNAVAILABLE` marca el proveedor afectado sin éxito falso. El snapshot se filtra por Project. Desconexión conserva último estado, recuperación recarga snapshot y reintento es manual; no confundir socket reconectado con ejecución reanudada ni inferir proveedor desde texto libre.

- [x] T086 [US7] Validar recuperación visible, estados y separación de canvases — `frontend/tests/e2e/runtime-recovery.spec.ts`.

  **Dependencias**: T085, T076, T084, T020, T018. **Traza**: US-007; SC-006; NFR-003, NFR-006; quickstart V-005–V-007. **Checks**: E2E.

  **Aceptación**: Desconectar UI y simular fallo de proveedor/proceso; confirmar estado veraz, tabs independientes y recuperación sin repetir acciones. Navegación no reanuda trabajo.

## Fase 10 - Integración y aceptación transversal

Validar empaquetado local, protocolos de medición y operación. P2 sigue dentro del MVP; ningún incremento parcial equivale por sí solo al MVP aceptado.

- [x] T087 Integrar build frontend servido por backend desde origen local — `backend/build.gradle.kts`, `frontend/vite.config.ts`, `backend/src/main/java/com/zeko/sharedkernel/api/SpaResourceConfiguration.java`, `backend/src/test/java/com/zeko/sharedkernel/LocalSpaIntegrationTest.java`.

  **Dependencias**: T086, T009. **Traza**: D-005, D-006; plan §Acceso local; SC-001. **Checks**: BEI.

  **Aceptación**: Build incorpora assets y usa same-origin; modo dev con proxy previsto en diseño; no publicar servicio en red ni agregar Electron/Tauri.

- [x] T088 [P] Instrumentar protocolo de actualización visible de estado — `frontend/tests/e2e/state-latency.spec.ts`, `docs/validation/state-latency.md`.

  **Dependencias**: T087, T069. **Traza**: NFR-007; quickstart V-007. **Checks**: E2E.

  **Aceptación**: Medir confirmación de capacidad local→UI, correlacionando evento; registrar resultados respecto de objetivo provisional 5 s. Excluir tiempo del modelo; no afirmar aprobado antes de medir.

- [x] T089 [P] Crear y ejecutar protocolo reproducible de capacidad local — `docs/validation/capacity.md`, `backend/src/test/java/com/zeko/executioncontrol/CapacityMeasurementTest.java`.

  **Dependencias**: T087, T080. **Traza**: NFR-008; plan §Estrategia de verificación. **Checks**: BEI.

  **Aceptación**: Definir carga, hardware, repos y agentes; registrar mediciones reales y limitaciones sin prometer capacidad no medida ni iniciar agentes reales sin recursos autorizados.

- [x] T090 [P] Preparar evaluación de usabilidad y registrar resultados disponibles — `docs/validation/usability.md`.

  **Dependencias**: T087. **Traza**: NFR-006; SC-007; quickstart V-007. **Checks**: DOC.

  **Aceptación**: Protocolo/muestra/recorridos y objetivo provisional 9 de 10; actividad con participantes requiere resultados reales. Si no hay participantes, mantener evaluación pendiente, nunca generar respuestas o marcar criterio cumplido.

- [x] T091 [P] Validar controles transversales y exclusiones del MVP — `backend/src/test/java/com/zeko/executioncontrol/ExecutionSecurityIntegrationTest.java`, `backend/src/test/java/com/zeko/memorysearch/SecretExposureIntegrationTest.java`, `docs/validation/security-scope-review.md`.

  **Dependencias**: T084, T086, T067, T087. **Traza**: FR-020, FR-039, FR-061, FR-067, FR-070, FR-076; NFR-004–NFR-005. **Checks**: BEI.

  **Aceptación**: Intentos de bypass y origen/ruta no autorizados no generan efectos; revisar exclusiones y dependencias. Cambios de control necesarios se planifican por task, no se relajan tests.

- [x] T092 Documentar operación local y cerrar validación del MVP — `README.md`, `docs/validation/mvp-results.md`.

  **Dependencias**: T088, T089, T090, T091. **Traza**: FR-001–FR-076; NFR-001–NFR-008; SC-001–SC-007; quickstart V-001–V-007. **Checks**: ALL.

  **Aceptación**: Ejecutar todos los checks requeridos; registrar resultados reales, hash de revisión y criterios pendientes. Guía de operación acorde a build y proveedores. No declarar MVP aceptado si faltan evaluaciones obligatorias.

- [x] T093 Restablecer quality gate backend — `backend/src/test/java/com/zeko/sharedkernel/SqliteBootstrapIntegrationTest.java`, `backend/src/main/java/com/zeko/sharedkernel/api/SpaResourceConfiguration.java`, `docs/validation/mvp-results.md`.

  **Dependencias**: T092. **Traza**: Definition of Done; override del usuario 2026-09-15. **Checks**: ALL.

  **Aceptación**: Corregir únicamente las infracciones de Checkstyle que bloqueaban la batería final, sin relajar reglas ni alterar el comportamiento de rutas; ejecutar `check build integrationTest contractTest` exitosamente.

## Matriz de cobertura para analyze

La tabla asigna trabajo previsto; no certifica requisitos implementados. FR-058 es una regla de planificación. Las exclusiones se verifican por revisión/pruebas negativas, no creando funcionalidades prohibidas.

| Requisito | Tareas responsables / verificaciones |
|---|---|
| FR-001 | T021, T022, T024, T025, T026 |
| FR-002 | T021, T022, T024, T025, T026 |
| FR-003 | T021, T022, T024, T025, T026 |
| FR-004 | T021, T022, T024, T025, T026 |
| FR-005 | T023, T024, T026 |
| FR-006 | T023, T024, T026 |
| FR-007 | T021, T022, T024, T025, T026 |
| FR-008 | T021, T022, T024, T025, T026 |
| FR-009 | T027, T028, T031, T036 |
| FR-010 | T027, T028, T031, T036 |
| FR-011 | T027, T028, T031, T036 |
| FR-012 | T031, T034, T036 |
| FR-013 | T031, T034, T036 |
| FR-014 | T031, T034, T036 |
| FR-015 | T029, T030, T032, T035, T036 |
| FR-016 | T029, T030, T032, T035, T036 |
| FR-017 | T029, T030, T032, T035, T036 |
| FR-018 | T029, T030, T032, T035, T036 |
| FR-019 | T033, T035, T036 |
| FR-020 | T029, T058, T063, T091 |
| FR-021 | T027, T028, T031, T053, T074 |
| FR-022 | T038, T041, T042, T043, T068 |
| FR-023 | T038, T041, T042, T043, T068 |
| FR-024 | T038, T041, T042, T043, T068 |
| FR-025 | T038, T041, T042, T043, T068 |
| FR-026 | T037, T041, T043, T063, T082 |
| FR-027 | T037, T041, T043, T063, T082 |
| FR-028 | T037, T041, T043, T063, T082 |
| FR-029 | T037, T041, T043, T063, T082 |
| FR-030 | T049, T051, T039, T052 |
| FR-031 | T049, T051, T039, T052 |
| FR-032 | T049, T051, T039, T052 |
| FR-033 | T049, T051, T039, T052 |
| FR-034 | T044, T047, T063 |
| FR-035 | T044, T048, T063, T052 |
| FR-036 | T044, T048, T063, T052 |
| FR-037 | T044, T048, T063, T052 |
| FR-038 | T045, T046, T048, T050, T075 |
| FR-039 | T047, T063, T091 |
| FR-040 | T048, T050, T075 |
| FR-041 | T044, T047, T063, T052 |
| FR-042 | T044, T047, T063, T052 |
| FR-043 | T044, T047, T063, T052 |
| FR-044 | T039, T040, T041, T068, T052 |
| FR-045 | T058, T059, T060, T061, T062, T063, T068 |
| FR-046 | T053, T054, T064, T069, T070, T075 |
| FR-047 | T053, T054, T064, T069, T070, T075 |
| FR-048 | T053, T054, T064, T069, T070, T075 |
| FR-049 | T060, T065, T071, T076 |
| FR-050 | T060, T065, T071, T076 |
| FR-051 | T060, T065, T071, T076 |
| FR-052 | T060, T065, T071, T076 |
| FR-053 | T055, T056, T057, T076 |
| FR-054 | T055, T056, T057, T076 |
| FR-055 | T055, T066, T071, T076 |
| FR-056 | T057, T072, T073, T076 |
| FR-057 | T017, T054, T067, T072, T073 |
| FR-058 | T003, T006 |
| FR-059 | T067, T091 |
| FR-060 | T067, T091 |
| FR-061 | T067, T091 |
| FR-062 | T065, T061, T062, T085, T086 |
| FR-063 | T065, T061, T062, T085, T086 |
| FR-064 | T077, T078, T079, T080, T081, T084 |
| FR-065 | T077, T078, T079, T080, T081, T084 |
| FR-066 | T077, T078, T079, T080, T081, T084 |
| FR-067 | T082, T077, T091 |
| FR-068 | T080, T081, T083, T084 |
| FR-069 | T077, T078, T079, T080, T081, T084 |
| FR-070 | T058, T080, T091 |
| FR-071 | T020, T034, T070, T086 |
| FR-072 | T020, T025, T050, T071, T085, T086 |
| FR-073 | T020, T025, T050, T071, T085, T086 |
| FR-074 | T020, T025, T050, T071, T085, T086 |
| FR-075 | T072, T073, T075 |
| FR-076 | T058, T091, T092 |
| NFR-001 | T013, T022, T054, T078, T026, T086 |
| NFR-002 | T021, T056, T077, T084, T076 |
| NFR-003 | T053, T069, T085, T086 |
| NFR-004 | T011, T015, T016, T079, T072, T091 |
| NFR-005 | T044, T015, T063, T067, T091 |
| NFR-006 | T020, T070, T090 |
| NFR-007 | T069, T088 |
| NFR-008 | T089 |
| SC-001 | T075, T087, T092 |
| SC-002 | T056, T076 |
| SC-003 | T048, T075 |
| SC-004 | T052, T075 |
| SC-005 | T084 |
| SC-006 | T086 |
| SC-007 | T090 |

## Dependencias e incrementos

La lista de dependencias en cada task es autoritativa. Todos los caminos son acíclicos y los prerrequisitos tienen IDs anteriores. Orden de entrega:

1. T001–T006: cierre documental de decisiones y contratos; revisar nuevamente esta lista si cambian las rutas previstas.
2. Ejecutar analyze y aprobar el alcance/revisión que se implementará. Generar este documento no autoriza automáticamente código.
3. Setup y fundaciones: builds/checks, DB, seguridad local y trazabilidad antes de historias.
4. US-001 habilita proyectos; US-002 depende de ese contexto; US-003 y US-004 preparan coordinación y autorización con gateways controlados.
5. US-005 conecta los adaptadores y el bucle real y completa los recorridos de esas historias.
6. US-006 conecta memoria al agente; US-007 verifica recuperación transversal.
7. Integración/mediciones y evidencia final de aceptación. Las historias P2 siguen siendo alcance obligatorio del MVP.

## Paralelismo revisado

Los siguientes pares tienen archivos de escritura distintos y ninguna dependencia entre los dos. Solo ejecutarlos una vez satisfechas las dependencias de ambas tareas, en worktrees separados. Los locks de npm/Gradle, migraciones y archivos compartidos se serializan según las dependencias; resolver un conflicto no autoriza pisar cambios.

| Fase | Pareja posible | Condición |
|---|---|---|
| 1 | T007 + T008 | Todos los prerrequisitos de ambas completos; comprobar diffs reales antes de iniciar. |
| 2 | T013 + T014 | Todos los prerrequisitos de ambas completos; comprobar diffs reales antes de iniciar. |
| 3 | T022 + T023 | Todos los prerrequisitos de ambas completos; comprobar diffs reales antes de iniciar. |
| 4 | T028 + T029 | Todos los prerrequisitos de ambas completos; comprobar diffs reales antes de iniciar. |
| 5 | T038 + T039 | Todos los prerrequisitos de ambas completos; comprobar diffs reales antes de iniciar. |
| 6 | T046 + T047 | Todos los prerrequisitos de ambas completos; comprobar diffs reales antes de iniciar. |
| 7 | T054 + T055 | Todos los prerrequisitos de ambas completos; comprobar diffs reales antes de iniciar. |
| 8 | T082 + T083 | Todos los prerrequisitos de ambas completos; comprobar diffs reales antes de iniciar. |
| 9 | Sin pareja independiente en esta fase | Respetar la secuencia; no forzar paralelismo. |
| 10 | T088 + T089 | Todos los prerrequisitos de ambas completos; comprobar diffs reales antes de iniciar. |

## Definition of Done por tarea

1. Requisito y decisión de diseño identificados; solo archivos y comportamiento de esta tarea.
2. Pruebas críticas incluidas y checks del perfil aplicable exitosos, con evidencia real fuera de specs durante implementación.
3. Un único diff coherente y un único Conventional Commit cuando la tarea se ejecute con autoridad de commit, sin coautoría/firmas de IA ni trailers automáticos.
4. Dependencias completas, aislamiento por worktree respetado y cambios previos preservados.
5. Sin ampliaciones de alcance, stack, permisos o autonomía; sin cambios de specs desde implement.
6. Si falta un archivo o cambia un contrato necesario, volver a la fase documental propietaria; no inventarlo durante el código.
7. La tarea de validación con participantes o mediciones permanece pendiente hasta contar con evidencia. Un protocolo escrito no equivale a cumplir SC-007 ni a capacidad validada.
8. El estado de aceptación de cada task se revisa documentalmente; los agentes de implementación registran evidencia y no se otorgan aprobación modificando specs.

## Resultado de esta generación

Se generaron 92 tareas pendientes: 6 documentales, 5 de setup, 9 de fundaciones, 6 de US-001, 10 de US-002, 7 de US-003, 9 de US-004, 24 de US-005, 8 de US-006, 2 de US-007 y 6 transversales. Se verificaron IDs consecutivos, rutas, referencias de dependencias, ausencia de ciclos y cobertura de los 76 FR, 8 NFR y 7 SC.

No se ejecutaron tareas de implementación ni se comprobaron builds del producto, aún inexistentes. Quedan por realizar las correcciones documentales iniciales, el análisis cruzado de diseño/tasks y la aprobación correspondiente antes de iniciar código.

## Phase 11: Convergence — auditoría A01–A06

Estas tareas corrigen hallazgos de la auditoría `AUD-MVP-20260915` y fueron
autorizadas por el usuario el 2026-09-15. Cada una mantiene un diff y un commit
separados. No modifican el alcance del MVP ni autorizan las capacidades excluidas.

- [ ] T094 [A01] Conectar instrucciones de conversación con el agente operativo — `frontend/src/features/conversations/ConversationPanel.tsx`, `frontend/src/features/conversations/conversationApi.ts`, `backend/src/main/java/com/zeko/coordination/application/ConversationService.java`, `backend/src/main/java/com/zeko/coordination/application/AgentLoop.java`, `backend/src/main/java/com/zeko/coordination/api/ConversationController.java` y pruebas correspondientes.

  **Dependencias**: T042, T043, T068. **Traza**: A01; FR-022–FR-029, FR-044–FR-046; SC-001. **Checks**: FE, BE, BEC.

  **Aceptación**: La UI crea o reutiliza una conversación, persiste el mensaje, muestra el historial y obtiene una respuesta del gateway local; el servicio invoca el bucle con la instrucción y conserva la precedencia/trazabilidad. No se amplían permisos ni se ejecutan acciones sin la cadena autorizada.

- [ ] T095 [A02] Completar canvas XYFlow, instancias y gestión de skills visible — `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/features/agents/AgentsCanvas.tsx`, `frontend/src/features/agents/AgentTemplateEditor.tsx`, `frontend/src/features/agents/agentApi.ts`, `frontend/src/features/skills/SkillPanel.tsx`, `frontend/src/features/skills/SkillBindingEditor.tsx` y pruebas correspondientes.

  **Dependencias**: T034–T036, T042. **Traza**: A02; FR-009–FR-019, FR-021; SC-001; plan §Frontend y UI local. **Checks**: FE, build, E2E.

  **Aceptación**: Agents Canvas usa XYFlow para mostrar agentes y relaciones explicadas como configuración, permite crear una plantilla y una instancia, gestionar skills y visualizar bindings sin iniciar ejecuciones desde una arista. Las entidades plantilla/instancia/skill/binding permanecen separadas.

- [ ] T096 [A03] Persistir y reflejar configuración de permiso y autonomía de una instancia — `frontend/src/features/agents/AgentsCanvas.tsx`, `frontend/src/features/agents/ModeSettings.tsx`, `frontend/src/features/agents/agentApi.ts` y pruebas correspondientes.

  **Dependencias**: T049, T051, T095. **Traza**: A03; FR-030–FR-034, FR-072–FR-074; NFR-003. **Checks**: FE, BEC.

  **Aceptación**: La UI selecciona una instancia real, carga sus valores, persiste cada dimensión por separado y solo confirma después de una respuesta exitosa; errores, ausencia de instancia y guardado pendiente son visibles sin éxito falso.

- [ ] T097 [A04] Reparar snapshot de Runtime y aislarlo por proyecto — `backend/src/main/java/com/zeko/executioncontrol/application/ExecutionRepository.java`, `backend/src/main/java/com/zeko/executioncontrol/infrastructure/JdbcExecutionRepository.java`, `backend/src/main/java/com/zeko/executioncontrol/application/ExecutionService.java`, `backend/src/main/java/com/zeko/executioncontrol/api/ExecutionController.java`, migración o pruebas correspondientes.

  **Dependencias**: T054, T069, T087. **Traza**: A04; FR-007–FR-008, FR-047–FR-048, FR-062; NFR-002–NFR-003. **Checks**: BEI, BEC.

  **Aceptación**: `/api/projects/{projectId}/runtime-snapshot` y la consulta usada por la UI devuelven solo ejecuciones del proyecto, ordenadas por columnas existentes del schema, sin `started_at` inexistente; el contrato y la prueba de SQLite real quedan alineados.

- [ ] T098 [A05] Conectar Runtime Canvas a snapshot, WebSocket, approvals y estados de proveedor — `frontend/src/app/WorkspaceShell.tsx`, `frontend/src/app/WorkspaceContext.tsx`, `frontend/src/features/runtime/RuntimeCanvas.tsx`, `frontend/src/features/runtime/runtimeEvents.ts`, `frontend/src/features/runtime/runtimeApi.ts`, `frontend/src/features/runtime/ConflictPanel.tsx`, `frontend/src/features/approvals/approvalApi.ts` y pruebas correspondientes.

  **Dependencias**: T050, T069–T071, T085–T086, T097. **Traza**: A05; FR-035, FR-038, FR-040, FR-047–FR-055, FR-062–FR-063, FR-071–FR-074; NFR-003, NFR-007. **Checks**: FE, build, E2E.

  **Aceptación**: Runtime recibe snapshot filtrado por proyecto, suscribe eventos y reconcilia secuencias, mantiene errores distintos de vacío, carga approvals/conflictos por datos reales y muestra Docker/Ollama afectados con reintento manual sin reanudar ejecuciones.

- [ ] T099 [A06] Activar ejecución autorizada con worktree, adaptadores, efectos y diff real — `backend/src/main/java/com/zeko/executioncontrol/application/ExecutionService.java`, `backend/src/main/java/com/zeko/executioncontrol/application/AuthorizedActionDispatcher.java`, servicios/puertos de worktree y ejecución, `backend/src/main/java/com/zeko/executioncontrol/application/ExecutionResultQuery.java`, `backend/src/main/java/com/zeko/executioncontrol/infrastructure/JdbcExecutionRepository.java` y pruebas correspondientes.

  **Dependencias**: T061, T063–T068, T072–T074, T097. **Traza**: A06; FR-045–FR-057, FR-062–FR-063; SC-001–SC-003, SC-006; DOCX §§16, 18–20. **Checks**: BE, BEI, BEC.

  **Aceptación**: iniciar una ejecución reserva y activa un worktree de la combinación repositorio+task, ejecuta solo acciones clasificadas y aprobadas mediante adaptadores locales, registra estados/efectos, produce diff Git atribuible y preserva cambios previos; cancelación y reintento siguen siendo explícitos. No se agregan push, merge, publicación, cloud ni herramientas fuera del MVP.
