    # AGENTS.md - AgentStudio

Reglas operativas obligatorias para personas, agentes y coding assistants que trabajen en AgentStudio.

## 1. Contexto y alcance del MVP

AgentStudio es un **ADE/Agentic IDE local-first** para diseñar, configurar, ejecutar y observar agentes de software. El MVP es un monolito modular con múltiples repositorios por proyecto; no es un servicio cloud ni una plataforma multiusuario.

Stack fijo del MVP:

- Backend: Java 21 o 25, Spring Boot, monolito modular, WebSocket.
- Frontend: React, TypeScript, Vite y XYFlow.
- Datos: SQLite como base de metadata y Lucene para RAG/búsqueda local.
- Ejecución: Git worktrees, Docker y Ollama local.

Cada `Project` PUEDE contener varios repositorios. El producto mantiene dos superficies deliberadamente distintas: **Agents Canvas** para diseño/configuración de agentes y **Runtime Canvas** para observar y controlar ejecuciones. No se deben fusionar.

El MVP NO incluye MCP, herramientas custom creadas por usuarios, marketplace, Architecture/Draw.io canvas, architecture-to-code, team/server mode, ejecución remota, sincronización cloud, multiusuario o RBAC.

## 2. Jerarquía y fuentes de verdad

La precedencia de instrucciones es:

1. Instrucciones explícitas del usuario.
2. Reglas del proyecto (`AGENTS.md`, `.specify/`, y documentos normativos del repositorio).
3. Project Manager (PM).
4. Agente.
5. Skill.
6. Comportamiento por defecto de la herramienta/modelo.

Una orden de mayor precedencia prevalece y cualquier override del usuario DEBE registrarse en el artefacto de trazabilidad de la tarea o decisión correspondiente.

Para una funcionalidad, la fuente de verdad de producto es, en este orden: `constitution.md`; la `spec.md` de la feature; sus aclaraciones, checklist y plan; `research.md`, `data-model.md`, contratos y `quickstart.md`; y finalmente `tasks.md`. El código y los comentarios nunca redefinen estos documentos. Si hay conflicto o ambigüedad, detenerse y usar la fase SDD adecuada; no adivinar.

## 3. Spec-first / SDD

La especificación manda sobre la implementación. No se DEBE implementar una funcionalidad, comportamiento, endpoint, schema, pantalla ni cambio de arquitectura que no esté trazado a una spec, un plan y una tarea aprobada.

El flujo obligatorio de GitHub Spec Kit es:

`constitution -> specify -> clarify -> checklist -> plan -> tasks -> analyze -> implement`

Durante `constitution`, `specify`, `clarify`, `checklist`, `plan`, `tasks` y `analyze` está prohibido escribir código de producción, tests de implementación, scaffolding, migraciones o UI. Solo se crean o actualizan los artefactos documentales propios de esa fase.

`tasks.md` DEBE contener identificadores únicos (`T001`, `T002`, ...), dependencias, archivos concretos y la marca `[P]` para trabajo realmente paralelizable. `analyze` DEBE comprobar requisitos sin tarea, tareas sin requisito, contratos/front-end sin respaldo, dependencias, cobertura de reglas y límites de responsabilidad antes de implementar.

Regla de oro: **una tarea, un diff, un commit**. No mezclar tareas, no adelantar tareas futuras ni ampliar el alcance “por conveniencia”.

## 4. Arquitectura y reglas de código

- Mantener un monolito modular: los módulos se comunican mediante contratos explícitos; no crear microservicios en el MVP.
- Backend por módulo con separación `domain`, `application`, `infrastructure` y `api`.
- El dominio contiene invariantes y reglas de negocio; evitar clases anémicas cuando existan reglas claras.
- La capa `application` orquesta casos de uso. `infrastructure` implementa persistencia, filesystem, Git, Docker/Ollama y adaptadores. `api` contiene controllers, DTOs y transporte.
- Los controladores, handlers WebSocket y componentes de UI NO contienen lógica de negocio.
- Usar DTOs exclusivamente en boundaries (HTTP, WebSocket, persistencia/adaptadores). No filtrar entidades de dominio por esas fronteras.
- Evitar métodos gigantes, duplicación, validaciones mezcladas con controllers y `instanceof` innecesario. Usar enums o value objects para dominios cerrados. Aplicar patrones solo si reducen complejidad real.
- Frontend organizado por `features` y `components`, con estado y efectos de infraestructura aislados de componentes de presentación.
- No cambiar el stack, la arquitectura, contratos o estructura de módulos por iniciativa propia. Proponerlo mediante spec/clarify/plan y obtener la decisión requerida.

Las reglas críticas del dominio, permisos, aprobación, autonomía, aislamiento de worktrees, ejecución y trazabilidad DEBEN tener tests. Las interfaces públicas y contratos modificados DEBEN tener pruebas apropiadas de integración/contrato.

Comentarios en Java
Nada de bloques Javadoc (/** ... */) ni de @param/@return/@throws. Como mucho, una línea // arriba del método, en una sola oración, diciendo qué hace. Si el nombre del método ya lo dice, no lleva comentario.

Dentro del cuerpo, una línea corta se justifica solo cuando el código hace algo contraintuitivo a propósito: // Intencional: aunque parezca un bug, así lo pide el sistema de referencia. Nada de citar números de requisito (FR-xxx, SC-xxx, D-xxx) en el código — esa trazabilidad vive en la spec, bajo specs/.

## 5. Git, ramas y commits

- Usar la convención de ramas que defina la feature o la tarea; cuando no exista, usar una rama/worktree descriptiva basada en la tarea, por ejemplo `T023/approval-workflow`.
- Usar Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `build:`, `ci:`, `perf:`, `style:` y `revert:`. El scope es opcional.
- Los mensajes son imperativos y concisos. Incluir el ID de task cuando aplique: `feat(agent-runtime): T023 add approval workflow`.
- Un commit solo puede cubrir el diff de una tarea. No combinar formateos, refactors oportunistas ni cambios no relacionados.
- Nunca agregar coautoría. Está prohibido incluir `Co-authored-by`, firmar como IA o agregar trailers automáticos de asistentes.

## 6. Límites de archivos y trazabilidad

- Modificar únicamente los archivos explícitamente listados por la tarea y los cambios mínimos indispensables para que esa tarea funcione. Si hace falta salir de ese scope, detenerse y actualizar la planificación.
- No modificar specs generadas salvo durante la fase SDD que lo autorice. Una tarea de implementación no modifica `specs/`.
- No reescribir historia, decisiones, arquitectura o stack para justificar código ya creado.
- Toda decisión relevante, requisito, task, diff, commit, prueba y override del usuario DEBE conservar enlaces trazables entre sí.

## 7. Calidad, build y seguridad

Antes de cerrar una tarea, ejecutar los checks aplicables al módulo afectado: formatter/lint, build, tests unitarios, tests de integración o contrato y validaciones E2E/quickstart cuando correspondan. Una tarea NO está completada si build, lint o tests pertinentes fallan. No desactivar, eliminar ni relajar controles para “hacer pasar” pruebas.

- No exponer secretos en código, commits, logs, issues o prompts; nunca commitear `.env`, tokens, claves o credenciales.
- Respetar permisos de filesystem, terminal y red configurados por el usuario y por el producto.
- No ejecutar comandos destructivos, cambios irreversibles, operaciones masivas de Git, borrados o migraciones peligrosas sin autorización explícita y target confirmado.
- No introducir telemetría, llamadas remotas, sync cloud ni ejecución remota fuera de una spec aprobada.

## 8. Multi-agent, worktrees y skills

- Con concurrencia, usar un worktree por combinación **repositorio + task**. Nunca dos agentes en el mismo worktree.
- Coordinar dependencias antes de iniciar tareas `[P]`; los conflictos se explicitan y resuelven, no se pisan ni se fuerzan.
- El PM coordina y reporta al usuario, pero no es el único punto de entrada: el usuario puede instruir agentes directamente y tiene precedencia.
- Crear agentes custom y `SKILL.md` dentro del proyecto por defecto. Promoverlos a global solo con instrucción explícita del usuario.
- No crear agentes, skills o configuraciones globales automáticamente. En el MVP no se habilitan MCP ni custom tools creadas por usuarios.

## 9. UX del MVP

- Agents Canvas y Runtime Canvas son tabs/superficies separadas, con objetivos y estados propios.
- No introducir Architecture/Draw.io canvas en el MVP.
- La UI debe ser observable: estados de ejecución, errores, permisos, approvals, ownership y resultados deben ser visibles y comprensibles.
- Los approval prompts deben describir acción, alcance, efectos y alternativas en lenguaje legible; permiso y autonomía no son la misma cosa.

## 10. Definition of Done por tarea

Una tarea solo está terminada cuando:

1. Está trazada a requisitos y plan, y se limitó exactamente a su scope.
2. El diff solo contiene esa tarea; se revisó contra los archivos declarados.
3. Las pruebas y checks aplicables pasan y los resultados se registran.
4. La documentación, contratos o quickstart requeridos por la tarea están actualizados.
5. El commit Conventional Commit único, sin coautoría ni trailers automáticos, referencia el task ID cuando aplica.
6. No se añadieron funcionalidades ni elementos fuera del MVP.

## 11. Do / Don't

**Do:** pedir aclaraciones mediante SDD; trabajar una task por vez; mantener contratos explícitos; probar reglas críticas; usar worktrees aislados; reportar incertidumbres y overrides.

**Don't:** escribir código durante fases de diseño; modificar specs desde implementación; inventar requisitos; mezclar tareas; cambiar stack/arquitectura unilateralmente; ocultar fallos de checks; añadir coautoría; crear capacidades fuera del MVP.
