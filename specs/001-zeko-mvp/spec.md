# Especificación funcional: Zeko Agentic IDE - MVP local-first

**Feature Branch**: `feature/001-zeko-mvp`
**Feature ID**: `001-zeko-mvp`
**Short name**: `zeko-mvp`
**Creada**: 2026-09-13
**Estado**: Borrador — aclaraciones resueltas; plan completo, listo para tareas
**Entrada**: MVP local-first de Zeko Agentic IDE

## Objetivo, actores y límites

Zeko Agentic IDE permite a un usuario local organizar proyectos con repositorios
locales, configurar agentes y skills, dar instrucciones al PM o a un agente,
controlar ejecuciones autorizadas y revisar sus resultados y cambios con trazabilidad.
El MVP debe completar ese ciclo sin depender de servicios cloud ni de colaboración
multiusuario.

Los actores son:

- **Usuario local**: propietario del proyecto y autoridad sobre instrucciones,
  permisos y decisiones.
- **Project Manager (PM)**: agente que coordina trabajo y reporta avances, bloqueos
  y resultados al usuario.
- **Agente de trabajo**: instancia configurada para realizar o colaborar en tareas
  dentro de reglas y permisos vigentes.

Estos actores no son cuentas ni roles de acceso y MUST NOT introducir multiusuario,
RBAC ni team/server mode.

El MVP excluye MCP, herramientas custom creadas por usuarios, Architecture/Draw.io
canvas, architecture-to-code, marketplace, distribución pública de agentes/skills/plugins,
ejecución remota, cloud sync, colaboración cloud e infraestructura SaaS añadida por
iniciativa del agente. El uso de Spec Kit durante el desarrollo MUST NOT convertirse
en una funcionalidad de la UI del producto.

Las restricciones heredadas incluyen el stack local ya fijado y la separación de
responsabilidades arquitectónicas establecida por la constitución. Esta especificación
no decide clases, tablas, endpoints, librerías concretas ni algoritmos; esas decisiones
corresponden a la fase de planificación.

Como restricción heredada, la planificación MUST respetar Java 21 o 25 y Spring Boot
en un monolito modular con WebSocket; React, TypeScript, Vite y XYFlow en el frontend;
SQLite para metadata, Lucene para RAG/búsqueda local y Git worktrees, Docker y Ollama
para repositorios y ejecución local. La elección concreta entre las alternativas
permitidas y sus versiones no forma parte de esta especificación funcional.

## Clarificaciones

### Sesión 2026-09-13

- P: Al editar un `AgentTemplate`, ¿cómo se propagan sus cambios a las instancias existentes? → R: Cada instancia puede recibir una actualización seleccionable desde su plantilla.
- P: ¿Qué política debe gobernar permisos y autonomía en el MVP? → R: Política conservadora: `Ask Approval` aprueba cada acción mutante, de red o destructiva; `Auto Approve` solo permite acciones locales, no destructivas y cubiertas explícitamente; `Full Access` permite acciones locales no prohibidas. La autonomía no amplía permisos.

- P: ¿Qué recuperación mínima se admite tras una interrupción? → R: Reintento manual explícito después de mostrar el último estado conocido y los efectos registrados; sin reanudación automática.
- P: ¿Qué ocurre si cambia una acción mientras espera aprobación? → R: Cualquier cambio de acción, recurso, alcance o efecto esperado invalida la aprobación pendiente y requiere una solicitud nueva.
- P: ¿Cuándo se aplica una actualización aceptada de plantilla a una instancia con ejecución activa? → R: Solo se aplica a ejecuciones futuras; la ejecución activa conserva su configuración hasta terminar, fallar o cancelarse.
- P: ¿Las instancias admiten overrides configurables sobre su plantilla en el MVP? → R: No; conservan identidad, contexto, estado y la decisión de aceptar actualizaciones, sin overrides configurables sobre la plantilla.
- P: ¿Cómo se trata la indisponibilidad de Docker y Ollama? → R: Comparten el tratamiento de proveedor local no disponible: se identifica el proveedor afectado, se muestra el último estado conocido y se ofrece reintento manual.
- P: ¿Cómo se resuelven los conflictos de asignación o integración? → R: Las tareas afectadas quedan bloqueadas; se preservan worktrees y cambios, y el usuario debe cancelar, reasignar o resolver manualmente el conflicto.
- P: ¿Qué iniciativa corresponde a `Manual`, `Assisted` y `Autonomous`? → R: `Manual` actúa solo ante una instrucción explícita vigente del usuario y no crea follow-ups; `Assisted` propone follow-ups y espera la confirmación del usuario antes de crearlos; `Autonomous` puede crear y continuar follow-ups relacionados con la instrucción vigente. Ningún modo amplía permisos ni evita approvals aplicables.

### Sesión 2026-09-14

- P: ¿Qué propietario debe usar la UI para buscar memoria? → R: La conversación activa. El usuario crea o selecciona explícitamente una conversación con PM o agente y la UI usa su identidad para recuperar contexto; nunca infiere el ownership desde el Project.

## Historias de usuario y verificación

### US-001 — Gestionar un proyecto con varios repositorios (Prioridad: P1)

Como usuario local, quiero crear, abrir y volver a abrir un proyecto con más de un
repositorio local para conservar su configuración y saber qué repositorio afecta cada
tarea, ejecución y cambio.

**Valor**: establece el contexto local y trazable necesario para cualquier trabajo.

**Verificación independiente**: crear un proyecto, asociar dos repositorios válidos,
cerrarlo y abrirlo de nuevo; verificar que los repositorios y su estado persisten y
que una tarea identifica su repositorio objetivo.

**Criterios de aceptación**:

1. **Dado** un proyecto nuevo, **cuando** el usuario asocia dos repositorios locales
   válidos, **entonces** ambos quedan visibles con identidad propia dentro del proyecto.
2. **Dado** un proyecto con dos repositorios asociados, **cuando** se reabre,
   **entonces** conserva la configuración y no confunde los datos de un repositorio
   con los del otro.
3. **Dado** una ruta inexistente, inaccesible o que no corresponde a un repositorio,
   **cuando** el usuario intenta asociarla, **entonces** recibe un error comprensible
   y la información existente del proyecto permanece intacta.
4. **Dado** una tarea o ejecución, **cuando** se visualiza su detalle, **entonces**
   se identifica el proyecto y el repositorio objetivo.

### US-002 — Diseñar agentes y asignar skills de proyecto (Prioridad: P1)

Como usuario local, quiero crear y configurar agentes y skills dentro de mi proyecto,
y ver sus relaciones en Agents Canvas, para preparar trabajo especializado sin confundir
definiciones reutilizables, agentes concretos o asociaciones.

**Valor**: permite preparar una colaboración de agentes comprensible y acotada al proyecto.

**Verificación independiente**: crear una plantilla de agente, crear una instancia,
definir una skill de proyecto, asociarla a la instancia y comprobar en Agents Canvas
la diferencia entre los cuatro conceptos y sus relaciones.

**Criterios de aceptación**:

1. **Dado** un proyecto abierto, **cuando** el usuario crea una definición de agente,
   **entonces** queda en alcance de proyecto y puede configurarse para reutilización.
2. **Dado** una definición de agente, **cuando** el usuario crea una instancia,
   **entonces** la instancia posee identidad, contexto y estado propios diferenciados
   de la definición.
3. **Dado** una skill de proyecto, **cuando** se asocia a un agente, **entonces** la
   definición de skill y la asociación son elementos distinguibles y visibles.
4. **Dado** Agents Canvas, **cuando** el usuario revisa una relación, **entonces**
   puede entender qué relación funcional representa sin que la conexión visual se
   interprete como un workflow ejecutable.
5. **Dado** un agente o skill de proyecto, **cuando** el usuario solicita promoción
   global, **entonces** el producto solicita una acción explícita, muestra el alcance
   afectado y registra la decisión.
6. **Dado** una instancia con una ejecución activa, **cuando** el usuario acepta una
   actualización de su plantilla, **entonces** la actualización se aplica solo a las
   ejecuciones futuras y la ejecución activa conserva su configuración hasta terminar,
   fallar o cancelarse.
7. **Dado** una instancia, **cuando** el usuario revisa su configuración, **entonces**
   puede distinguir su identidad, contexto, estado y decisión de actualización de la
   plantilla, sin que el MVP presente overrides configurables sobre esa plantilla.

### US-003 — Instruir y coordinar agentes con trazabilidad (Prioridad: P1)

Como usuario local, quiero conversar con el PM o directamente con un agente y que las
instrucciones, conversaciones y overrides queden trazados, para conservar mi autoridad
y comprender quién tomó cada decisión.

**Valor**: habilita coordinación sin convertir al PM en un intermediario obligatorio.

**Verificación independiente**: enviar una instrucción directa a un agente que cambia
una decisión operativa permitida, comprobar que el override se registra y que el PM
puede informar el resultado sin haber sido el único canal de entrada.

**Criterios de aceptación**:

1. **Dado** un proyecto y un agente disponibles, **cuando** el usuario inicia una
   conversación con el PM o directamente con el agente, **entonces** el historial
   queda asociado al proyecto y al interlocutor correspondiente.
2. **Dado** una instrucción directa del usuario, **cuando** contradice una instrucción
   de menor precedencia, **entonces** prevalece y queda registrada como override con
   alcance, decisión afectada y agente o ejecución vinculados.
3. **Dado** una instrucción directa al agente, **cuando** implica una acción restringida,
   **entonces** conserva trazabilidad pero no amplía permisos silenciosamente.
4. **Dado** trabajo coordinado por el PM, **cuando** hay avance, bloqueo o resultado,
   **entonces** el PM lo comunica al usuario con referencias al trabajo afectado.
5. **Dado** una instrucción vigente y una autonomía configurada, **cuando** el agente
   completa el trabajo inicial, **entonces** `Manual` no crea un follow-up, `Assisted`
   presenta el follow-up y espera confirmación antes de crearlo, y `Autonomous` puede
   crear y continuar follow-ups relacionados; toda acción resultante sigue sujeta a
   la política de permisos y approvals aplicable.

### US-004 — Autorizar o rechazar una ejecución local (Prioridad: P1)

Como usuario local, quiero configurar permisos y autonomía como dimensiones separadas,
revisar prompts de aprobación y aprobar o denegar una acción concreta, para controlar
qué hace cada agente sin perder el contexto de la tarea.

**Valor**: protege el workspace y hace auditables las decisiones de ejecución.

**Verificación independiente**: configurar un agente en `Ask Approval` y `Assisted`,
solicitar una acción que requiere aprobación, denegarla y verificar que permanece sin
ejecutar y vinculada a la denegación.

**Criterios de aceptación**:

1. **Dado** un agente configurado, **cuando** el usuario modifica permiso o autonomía,
   **entonces** el otro valor no cambia implícitamente y ambos quedan visibles.
2. **Dado** una acción que requiere aprobación en `Ask Approval`, **cuando** el agente
   la solicita, **entonces** permanece bloqueada hasta que el usuario responda.
3. **Dado** un prompt de aprobación, **cuando** el usuario lo revisa, **entonces** ve
   agente, tarea, repositorio o recurso, acción, alcance y efectos esperados.
4. **Dado** una acción denegada, **cuando** el agente continúa su trabajo,
   **entonces** no ejecuta esa misma acción por una vía alternativa y registra la
   denegación vinculada a la acción exacta.
5. **Dado** un permiso `Full Access`, **cuando** se selecciona una autonomía distinta,
   **entonces** se mantienen las prohibiciones constitucionales y la autonomía elegida.
6. **Dado** una aprobación pendiente, **cuando** cambian la acción, el recurso, el
   alcance o los efectos esperados, **entonces** la aprobación queda invalidada y el
   sistema solicita una nueva aprobación con la información actualizada.

### US-005 — Ejecutar y observar tareas aisladas (Prioridad: P1)

Como usuario local, quiero ejecutar tareas autorizadas y observarlas en Runtime Canvas,
para saber su estado, detenerlas si corresponde y revisar el resultado, el worktree y
el diff atribuibles a cada tarea.

**Valor**: completa el ciclo de trabajo controlado desde una instrucción hasta un
resultado verificable.

**Verificación independiente**: iniciar dos tareas sobre repositorios o worktrees
distintos, observar sus estados y resultados; intentar asignar dos agentes al mismo
worktree y comprobar que el conflicto se rechaza y queda explicado.

**Criterios de aceptación**:

1. **Dado** dos tareas concurrentes con worktrees distintos, **cuando** comienzan,
   **entonces** cada una muestra proyecto, repositorio, task, agente y worktree.
2. **Dado** dos agentes que solicitan el mismo worktree, **cuando** se intenta asignar
   el segundo, **entonces** la asignación se rechaza y el conflicto se muestra sin
   sobrescribir cambios.
3. **Dado** una ejecución, **cuando** cambia de estado, **entonces** Runtime Canvas
   distingue al menos pendiente, ejecutando, esperando aprobación, completada,
   fallida y cancelada, junto con el estado conocido y los eventos relevantes.
4. **Dado** una ejecución activa, **cuando** el usuario solicita cancelación,
   **entonces** el producto muestra el resultado real de la solicitud y no afirma
   cancelación mientras la operación siga en curso ni promete revertir efectos previos.
5. **Dado** una tarea completada, **cuando** el usuario revisa Runtime Canvas,
   **entonces** puede acceder al resultado, errores si los hubo, approvals, cambios
   atribuibles y diff trazable de la tarea.
6. **Dado** un conflicto de asignación o integración, **cuando** se detecta,
   **entonces** las tareas afectadas quedan bloqueadas, sus worktrees y cambios se
   preservan, y el usuario puede cancelar, reasignar o resolver manualmente el conflicto.

### US-006 — Recuperar contexto local con alcance controlado (Prioridad: P2)

Como usuario local, quiero que los agentes recuperen contexto de memoria local sin
mezclar proyectos ni convertir documentos recuperados en permisos, para recibir ayuda
relevante sin perder control sobre la información.

**Valor**: mejora la continuidad de las conversaciones y tareas preservando alcance.

**Verificación independiente**: almacenar contexto de dos proyectos, recuperar contexto
en una conversación de uno de ellos y comprobar que se identifica la fuente, no se
expone el otro proyecto y la ausencia de resultados se diferencia de un error.

**Criterios de aceptación**:

1. **Dado** contexto en los niveles global, project, agent y conversation, **cuando**
   el usuario o agente revisa memoria relevante, **entonces** puede identificar su
   nivel de alcance, pertenencia y fuente.
2. **Dado** una conversación de un proyecto, **cuando** se recupera contexto local,
   **entonces** no se filtra información de otro proyecto fuera del alcance autorizado.
3. **Dado** documentos recuperados, **cuando** influyen en una respuesta o acción,
   **entonces** se presentan como contexto y no como permiso ni como instrucción de
   precedencia superior.
4. **Dado** una consulta sin coincidencias o con una falla de búsqueda, **cuando** se
   muestra el resultado, **entonces** el usuario puede distinguir ambos casos.

### US-007 — Comprender estados y fallos en superficies separadas (Prioridad: P2)

Como usuario local, quiero usar Agents Canvas y Runtime Canvas como superficies
separadas y entender estados vacíos, carga, error, espera de aprobación y finalización,
para poder intervenir sin confundir diseño de agentes con control de ejecuciones.

**Valor**: hace que el control local sea comprensible en recorridos normales y fallidos.

**Verificación independiente**: abrir ambas superficies durante una ejecución con un
proveedor local no disponible y comprobar que se mantienen separadas, el estado es
veraz y el usuario recibe una acción disponible.

**Criterios de aceptación**:

1. **Dado** el proyecto abierto, **cuando** el usuario navega entre canvases,
   **entonces** Agents Canvas se dedica a configuración y relaciones, mientras Runtime
   Canvas se dedica a observación, control, resultados y approvals.
2. **Dado** un recorrido crítico sin datos, en carga, con error, esperando aprobación
   o finalizado, **cuando** se muestra su estado, **entonces** el usuario ve qué ocurrió
   y qué acción disponible puede tomar.
3. **Dado** que un proveedor local no está disponible o un proceso se interrumpe,
   **cuando** la UI recibe el último estado conocido, **entonces** no informa éxito
   falso, identifica el proveedor local afectado y explica el estado conocido y la
   acción de recuperación disponible.
4. **Dado** una ejecución interrumpida, **cuando** vuelve a estar disponible la
   capacidad local necesaria, **entonces** el usuario puede solicitar un reintento
   explícito después de revisar el último estado conocido y los efectos registrados;
   el sistema no la reanuda automáticamente.

### Casos borde

- Un proyecto vuelve a abrirse cuando uno de sus repositorios ya no es accesible.
- Dos tareas concurrentes intentan usar el mismo worktree.
- El usuario deniega una aprobación y el agente intenta completar la tarea con la
  misma acción mediante otro mecanismo.
- Una instrucción directa del usuario contradice una instrucción del PM.
- Un permiso y una autonomía se combinan sin que uno deba derivarse del otro.
- Una consulta de memoria no devuelve coincidencias, devuelve contexto de alcance no
  permitido o falla por indisponibilidad del servicio local.
- La UI se desconecta, el proveedor local cae o una ejecución se interrumpe antes de
  informar su estado terminal.
- Una tarea termina con cambios previos del usuario presentes en el repositorio.

## Requisitos

### Requisitos funcionales

#### Proyectos y repositorios

- **FR-001**: El sistema MUST permitir crear un proyecto local.
- **FR-002**: El sistema MUST permitir abrir un proyecto local existente.
- **FR-003**: El sistema MUST conservar la configuración de un proyecto al volver a abrirlo.
- **FR-004**: El sistema MUST permitir asociar múltiples repositorios locales a un proyecto.
- **FR-005**: El sistema MUST validar que una ruta asociada exista, sea accesible y corresponda a un repositorio local.
- **FR-006**: El sistema MUST informar rutas inválidas o inaccesibles sin destruir datos existentes.
- **FR-007**: El sistema MUST identificar el repositorio objetivo de cada tarea, cambio y ejecución.
- **FR-008**: El sistema MUST mantener el alcance de datos por proyecto y repositorio.

#### Agentes, skills y Agents Canvas

- **FR-009**: El sistema MUST permitir crear y editar definiciones de agentes dentro del proyecto por defecto.
- **FR-010**: El sistema MUST distinguir `AgentTemplate` de `AgentInstance` en datos y UI.
- **FR-011**: Un `AgentInstance` MUST conservar identidad, contexto y estado propios.
- **FR-012**: El sistema MUST permitir configurar agentes y sus relaciones en Agents Canvas.
- **FR-013**: El sistema MUST explicar funcionalmente cada relación mostrada en Agents Canvas.
- **FR-014**: Una conexión visual MUST NOT ser tratada como un workflow ejecutable por sí sola.
- **FR-015**: El sistema MUST permitir gestionar `SkillDefinition` basada en `SKILL.md` dentro del proyecto.
- **FR-016**: El sistema MUST distinguir `SkillDefinition` de `AgentSkillBinding`.
- **FR-017**: El sistema MUST permitir asociar una skill de proyecto a un agente.
- **FR-018**: El sistema MUST mostrar el alcance y las asociaciones de agentes y skills.
- **FR-019**: La promoción de un agente o skill a alcance global MUST requerir una acción explícita del usuario y quedar registrada.
- **FR-020**: Una skill MUST NOT ampliar permisos ni habilitar MCP o herramientas custom creadas por usuarios.
- **FR-021**: Al editar un `AgentTemplate`, el sistema MUST permitir que el usuario seleccione por instancia si aplica la actualización; MUST conservar la configuración existente hasta que el usuario la acepte y aplicar la actualización aceptada solo a ejecuciones futuras. Una ejecución activa MUST conservar su configuración hasta terminar, fallar o cancelarse. El MVP MUST NOT admitir overrides configurables de instancia sobre la plantilla.

#### Conversación, coordinación e instrucciones

- **FR-022**: El sistema MUST conservar conversaciones con proyecto y agente o PM asociados.
- **FR-023**: El usuario MUST poder instruir directamente al PM o a un agente de trabajo.
- **FR-024**: El PM MUST reportar avances, bloqueos y resultados al usuario.
- **FR-025**: El PM MUST NOT ser el único punto de entrada para instrucciones.
- **FR-026**: El sistema MUST aplicar la precedencia User > Project Rules > Project Manager > Agent > Skill > default behavior.
- **FR-027**: El sistema MUST registrar cada override explícito del usuario con decisión afectada, alcance y agente o ejecución relacionada.
- **FR-028**: Una instrucción directa MUST conservar trazabilidad sin ampliar permisos silenciosamente.
- **FR-029**: Un override que cambie alcance o arquitectura MUST requerir el proceso SDD antes de implementarse.

#### Permisos y autonomía

- **FR-030**: El sistema MUST permitir configurar y mostrar `Ask Approval`, `Auto Approve` y `Full Access` como modos de permiso.
- **FR-031**: El sistema MUST permitir configurar y mostrar `Manual`, `Assisted` y `Autonomous` como modos de autonomía.
- **FR-032**: El cambio de permiso MUST NOT modificar implícitamente la autonomía.
- **FR-033**: El cambio de autonomía MUST NOT modificar implícitamente el permiso.
- **FR-034**: El sistema MUST explicar las acciones permitidas, las que requieren aprobación y las prohibidas según permisos de filesystem, terminal y network.
- **FR-035**: Una acción que requiera aprobación en `Ask Approval` MUST permanecer bloqueada hasta obtener respuesta.
- **FR-036**: En `Auto Approve`, el sistema MUST aprobar automáticamente solo acciones cubiertas por la política configurada.
- **FR-037**: `Full Access` MUST NOT eliminar prohibiciones constitucionales ni cambiar la autonomía.
- **FR-038**: El sistema MUST registrar aprobación o denegación vinculada a la acción exacta e invalidar una aprobación pendiente cuando cambien la acción, el recurso, el alcance o los efectos esperados.
- **FR-039**: Una denegación MUST impedir ejecutar esa misma acción por una vía alternativa.
- **FR-040**: Cada prompt de aprobación MUST mostrar agente, tarea, repositorio o recurso, acción, alcance y efectos esperados.
- **FR-041**: En `Ask Approval`, el sistema MUST solicitar aprobación para cada acción mutante, de red o destructiva.
- **FR-042**: En `Auto Approve`, el sistema MUST autoaprobar solo acciones locales, no destructivas y cubiertas explícitamente por la política configurada.
- **FR-043**: En `Full Access`, el sistema MUST permitir solo acciones locales que no estén prohibidas por la constitución ni por los permisos configurados de filesystem, terminal y network, y que no tengan una denegación previa vigente.
- **FR-044**: La autonomía MUST controlar el grado de iniciativa del agente sin ampliar los permisos de una acción: `Manual` MUST limitarlo a una instrucción explícita vigente del usuario y MUST NOT crear follow-ups; `Assisted` MUST presentar cada follow-up propuesto y esperar confirmación del usuario antes de crearlo; `Autonomous` MAY crear y continuar follow-ups relacionados con la instrucción vigente. Toda acción resultante MUST seguir la política de permisos y approvals aplicable.

#### Ejecución, Runtime Canvas, Git y worktrees

- **FR-045**: El sistema MUST ejecutar solo tareas locales autorizadas dentro de las capacidades del MVP.
- **FR-046**: El sistema MUST vincular cada ejecución con proyecto, repositorio, tarea, agente y worktree cuando corresponda.
- **FR-047**: Runtime Canvas MUST mostrar estados pendiente, ejecutando, esperando aprobación, completada, fallida y cancelada.
- **FR-048**: Runtime Canvas MUST mostrar progreso, errores, approvals, resultados y cambios generados de cada ejecución.
- **FR-049**: El sistema MUST permitir solicitar la cancelación de una ejecución.
- **FR-050**: El sistema MUST mostrar el resultado real de una solicitud de cancelación.
- **FR-051**: El sistema MUST NOT mostrar una ejecución como cancelada mientras continúe activa.
- **FR-052**: El sistema MUST NOT prometer revertir efectos ya aplicados por una cancelación.
- **FR-053**: El sistema MUST asignar un worktree por combinación repositorio + task en trabajo concurrente.
- **FR-054**: El sistema MUST rechazar la modificación concurrente del mismo worktree por dos agentes.
- **FR-055**: El sistema MUST exponer conflictos de asignación e integración, bloquear las tareas afectadas, preservar worktrees y cambios, y permitir que el usuario cancele, reasigne o resuelva manualmente el conflicto. MUST NOT sobrescribir cambios ni resolver el conflicto automáticamente.
- **FR-056**: El sistema MUST preservar cambios previos del usuario y distinguir el diff atribuible a una tarea.
- **FR-057**: El sistema MUST mantener trazabilidad entre requisito, tarea, agente, ejecución, repositorio, worktree, diff y commit cuando exista.
- **FR-058**: La planificación posterior MUST dividir el trabajo de múltiples repositorios en tasks por repositorio con dependencias explícitas.
- **FR-059**: Un commit creado en una acción autorizada MUST usar Conventional Commits y el ID de task cuando aplique.
- **FR-060**: Un commit creado en una acción autorizada MUST NOT incluir `Co-authored-by`, firmas de IA ni trailers automáticos.
- **FR-061**: Esta especificación MUST NOT autorizar commits, push, merge ni publicación de PRs automáticos.
- **FR-062**: Tras una caída de UI, proveedor local o proceso, el sistema MUST mostrar el último estado conocido y los efectos registrados de la ejecución. Docker y Ollama MUST compartir este tratamiento de proveedor local no disponible, identificando cuál de ellos está afectado.
- **FR-063**: Tras una interrupción, el sistema MUST permitir un reintento solo mediante una solicitud explícita del usuario y MUST NOT reanudar automáticamente la ejecución.

#### Memoria y RAG local

- **FR-064**: El sistema MUST distinguir memoria global, project, agent y conversation.
- **FR-065**: El sistema MUST mostrar el alcance, ownership y fuente del contexto recuperado asociado a la conversación activa.
- **FR-066**: El sistema MUST recuperar contexto local relevante para una conversación seleccionada explícitamente, sin inferir ownership desde el Project ni filtrar información de otros proyectos fuera del alcance autorizado.
- **FR-067**: El contexto recuperado MUST NOT otorgar permisos ni prevalecer sobre instrucciones de mayor jerarquía.
- **FR-068**: El sistema MUST distinguir ausencia de resultados de un error de búsqueda.
- **FR-069**: El sistema MUST mantener metadata y recuperación de contexto local conforme a las restricciones heredadas.
- **FR-070**: El sistema MUST NOT incorporar por defecto servicios cloud, una base vectorial externa ni proveedores adicionales para memoria o recuperación.

#### UX y exclusiones

- **FR-071**: Agents Canvas y Runtime Canvas MUST permanecer como superficies separadas.
- **FR-072**: La UI MUST mostrar proyecto y repositorio activos, agente, task, permiso y autonomía cuando sean relevantes.
- **FR-073**: La UI MUST mostrar estados vacíos, carga, error, espera de aprobación y finalización en recorridos críticos.
- **FR-074**: La UI MUST explicar errores y acciones disponibles de forma comprensible.
- **FR-075**: Los resultados y diffs MUST ser revisables por el usuario.
- **FR-076**: El MVP MUST NOT incluir funcionalidades excluidas en la sección de objetivo, actores y límites.

### Requisitos no funcionales

- **NFR-001 — Persistencia local**: La configuración, trazabilidad y estados conocidos del proyecto MUST conservarse localmente y estar disponibles al volver a abrir el proyecto.
- **NFR-002 — Aislamiento**: Datos, contexto y cambios MUST permanecer asociados a su proyecto, repositorio, agente, conversación y worktree cuando aplique.
- **NFR-003 — Observabilidad veraz**: La UI MUST distinguir un resultado confirmado, un error y un estado desconocido; MUST NOT mostrar éxito falso ante interrupciones.
- **NFR-004 — Seguridad de secretos**: Secretos, tokens, claves y credenciales MUST NOT aparecer en logs, prompts de aprobación, diffs, commits ni índices de contexto de forma indiscriminada.
- **NFR-005 — Seguridad de acciones**: Las acciones destructivas, irreversibles o masivas MUST requerir autorización explícita con alcance identificado.
- **NFR-006 — Usabilidad**: Los recorridos de proyecto, instrucción, aprobación, ejecución y revisión MUST presentar estado y siguiente acción disponible de forma comprensible.
- **NFR-007 — Actualización de estado provisional**: Como objetivo provisional sujeto a validación en planificación, la UI SHOULD reflejar un cambio de estado confirmado por una capacidad local dentro de 5 segundos; este objetivo excluye el tiempo de generación del modelo.
- **NFR-008 — Capacidad**: La capacidad de agentes simultáneos, tamaño de repositorios y requisitos de hardware queda pendiente de medición en planificación; MUST NOT asumirse como aprobada una cifra en esta fase.

### Entidades conceptuales

- **Project**: contenedor local de configuración, conversaciones, agentes, memoria y uno o varios repositorios asociados.
- **Repository**: repositorio local asociado a un Project, con identidad, ruta y estado de acceso propios.
- **AgentTemplate**: definición reutilizable de configuración de un agente; no representa una ejecución ni una identidad concreta.
- **AgentInstance**: agente concreto con identidad, contexto y estado; no sustituye a la plantilla que pueda originarlo.
- **SkillDefinition**: definición reutilizable de una skill basada en `SKILL.md` y con alcance visible.
- **AgentSkillBinding**: asociación específica entre una SkillDefinition y un AgentInstance o agente configurado.
- **Conversation**: historial de instrucciones y contexto asociado a un Project y a un interlocutor.
- **Task**: unidad de trabajo trazable, con requisito, repositorio objetivo, agente y estado.
- **Execution**: intento observable de realizar una Task, incluyendo estados, approvals, resultados y errores.
- **Approval**: decisión explícita de permitir o denegar una acción concreta dentro de una Execution.
- **PermissionMode**: dimensión que define el tratamiento de autorización de acciones (`Ask Approval`, `Auto Approve`, `Full Access`).
- **AutonomyMode**: dimensión independiente que define el nivel de iniciativa (`Manual`, `Assisted`, `Autonomous`).
- **Worktree**: espacio aislado de trabajo vinculado a una combinación de Repository y Task.
- **MemoryEntry**: contexto local identificado por nivel global, project, agent o conversation, ownership, fuente y alcance.
- **TraceLink**: vínculo entre requisito, decisión, override, task, agente, ejecución, repositorio, worktree, diff, commit y evidencia disponible.

## Criterios de éxito

- **SC-001**: En la verificación del recorrido principal, el usuario completa abrir un proyecto con dos repositorios, preparar un agente con una skill, dar una instrucción, autorizar una tarea y revisar su resultado y diff sin perder la identificación de proyecto, repositorio, tarea, agente o ejecución.
- **SC-002**: En una prueba de dos tareas concurrentes con worktrees distintos, el sistema identifica ambos aislamientos y rechaza el intento de asignar el mismo worktree a dos agentes, sin sobrescribir cambios.
- **SC-003**: En el 100% de las acciones que requieren aprobación de la prueba, el prompt contiene agente, tarea, recurso, acción, alcance y efectos esperados; una denegación no ejecuta la acción denegada.
- **SC-004**: En las combinaciones evaluadas de permiso y autonomía, cambiar una dimensión no modifica la otra y `Full Access` no elimina una prohibición constitucional.
- **SC-005**: En una prueba con contexto de dos proyectos, el usuario identifica la fuente y alcance del contexto recuperado y no recibe contenido de otro proyecto fuera del alcance autorizado.
- **SC-006**: Ante proveedor local no disponible, interrupción de proceso o desconexión de UI, el usuario recibe el estado conocido y no observa una finalización exitosa sin confirmación.
- **SC-007**: Objetivo provisional: en una prueba de los recorridos críticos, al menos 9 de cada 10 participantes identifican el estado actual y una acción disponible sin asistencia. El método de evaluación y la muestra se definirán en planificación.

## Trazabilidad de alcance

| Historia | Requisitos principales | Criterios de éxito |
|---|---|---|
| US-001 | FR-001 a FR-008, NFR-001, NFR-002 | SC-001 |
| US-002 | FR-009 a FR-021, FR-067 a FR-072, NFR-006 | SC-001, SC-007 |
| US-003 | FR-022 a FR-029, NFR-001, NFR-002 | SC-001 |
| US-004 | FR-030 a FR-044, NFR-004, NFR-005 | SC-003, SC-004 |
| US-005 | FR-045 a FR-063, NFR-001 a NFR-006 | SC-001, SC-002, SC-003, SC-006 |
| US-006 | FR-064 a FR-070, NFR-001, NFR-002, NFR-004 | SC-005 |
| US-007 | FR-047, FR-048, FR-050 a FR-052, FR-062, FR-063, FR-071 a FR-076, NFR-003, NFR-006, NFR-007 | SC-006, SC-007 |

## Supuestos, dependencias y aclaraciones pendientes

### Supuestos

- El usuario opera localmente y es la autoridad de instrucciones y decisiones; no hay cuentas de equipo ni roles de acceso en el MVP.
- El usuario proporciona o selecciona repositorios locales sobre los que tenga acceso; asociarlos no concede permisos nuevos.
- Los cambios previos del usuario pueden existir en un repositorio y deben preservarse y diferenciarse de los cambios atribuibles a una task.
- La memoria global es un nivel de alcance conceptual y no autoriza creación automática de agentes, skills o configuraciones globales.
- Los documentos que pueden ingresar a memoria, su actualización y la precedencia detallada entre niveles se definirán durante planificación, sin crear un sistema avanzado de ingestión por defecto.
- La versión concreta del entorno de ejecución y los límites medidos de rendimiento/capacidad se decidirán en planificación de acuerdo con las restricciones heredadas.

### Dependencias

- Constitución vigente en `.specify/memory/constitution.md`, que fija alcance, stack, seguridad, SDD, trazabilidad y exclusiones.
- Reglas de proyecto en `AGENTS.md`; sus referencias a AgentStudio se interpretan como nombre heredado del mismo producto, pero los nuevos artefactos usan Zeko Agentic IDE.
- Capacidades locales autorizadas para repositorios, worktrees y proveedores de ejecución del MVP.

### Aclaraciones pendientes de alto impacto

1. **AC-001 — Propagación de plantillas**: resuelta mediante FR-021; las actualizaciones aceptadas solo afectan ejecuciones futuras.
2. **AC-002 — Matriz permiso/autonomía**: resuelta mediante FR-041 a FR-044.
3. **AC-003 — Recuperación ante interrupciones**: resuelta mediante FR-062 y FR-063; solo se permite reintento manual explícito.
4. **AC-004 — Modificación durante aprobación**: resuelta mediante FR-038; toda modificación material requiere una solicitud nueva.
5. **AC-005 — Iniciativa por autonomía**: resuelta mediante FR-044; los tres modos tienen límites explícitos y conservan la política de permisos y approvals.
6. **AC-006 — Overrides de instancia**: resuelta mediante FR-021; el MVP no admite overrides configurables sobre una plantilla.
7. **AC-007 — Indisponibilidad de proveedores locales**: resuelta mediante FR-062; Docker y Ollama comparten el mismo tratamiento, con identificación del proveedor afectado.
8. **AC-008 — Conflictos de asignación e integración**: resuelta mediante FR-055; las tareas quedan bloqueadas hasta la resolución manual del usuario.

Las aclaraciones de alto impacto están resueltas. La especificación está lista para la
fase posterior `/speckit-checklist`; no se han generado plan ni tasks.
