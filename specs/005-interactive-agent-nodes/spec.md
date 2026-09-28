# Feature Specification: Nodos interactivos de agente

**Feature Branch**: `Tiago-Davila/feature-interactive-nodes`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "Trabajar directamente con un agente de código en la terminal de un nodo de flujo, conservando aislamiento, trazabilidad y un resultado consumible por otros nodos."

## Objetivo

El usuario necesita explorar, decidir y corregir en conversación con un agente sin salir del flujo. Los pasos posteriores deben conocer qué se hizo, qué cambió y cómo terminó la tarea. Esta especificación describe el comportamiento esperado, independientemente de lo que ya haga la aplicación.

**Actores**

- **Usuario desarrollador**: abre la sesión, conversa con el agente, responde a sus solicitudes de permiso, cancela, declara el fin de la tarea o sale normalmente del agente para finalizarla.
- **Agente CLI**: atiende la conversación interactiva en la terminal del nodo.
- **Zeko**: coordina el flujo, aísla los cambios, registra la sesión y determina el estado final.

## Clarifications

### Session 2026-09-27

- Q: ¿Qué agentes admiten nodo interactivo en esta versión? → A: Claude Code y Codex.
- Q: ¿Cómo se controlan las herramientas y comandos del agente en un nodo interactivo? → A: Se aplican las restricciones configuradas para el nodo que admita cada agente; el usuario atiende las solicitudes de permiso del agente sin ampliar el alcance asignado.
- Q: ¿Qué hace la línea de comandos ante un flujo con nodos interactivos? → A: Lo rechaza durante la validación, antes de iniciar el run, e identifica los nodos que requieren interfaz.
- Q: ¿Salir del agente desde su terminal finaliza el nodo y qué estado declara? → A: Una salida normal lo finaliza automáticamente con «completado» como estado declarado provisional; Zeko determina el estado final con sus reglas.
- Q: ¿El límite de tiempo de un nodo interactivo es obligatorio u opcional? → A: Es obligatorio y finito para cada nodo; empieza al abrir la sesión y no cuenta la espera previa.
- Q: ¿Puede continuarse un nodo terminado y qué ocurre con sus dependientes? → A: Puede reabrirse dentro del mismo run; Zeko invalida los resultados de sus dependientes, cancela los que estén activos y pide confirmación para reejecutarlos.
- Q: ¿Quién redacta el resumen del resultado? → A: El agente propone un resumen y el usuario puede editarlo. (Reemplazada por la aclaración siguiente.)
- Q: ¿La recap del modelo en la terminal es el resumen del resultado? → A: Sí; Zeko la usa como resumen sin solicitarla, editarla ni exigir confirmación del usuario.
- Q: ¿Cómo recibe el agente las instrucciones iniciales y el resultado de los predecesores? → A: Zeko los muestra al usuario; solo llega al agente el contenido que el usuario escribe en la terminal.
- Q: ¿Guarda Zeko la transcripción completa de la sesión? → A: No; cada agente conserva y permite recuperar sus conversaciones con sus propias funciones. Zeko guarda solo el resultado y los eventos del run, incluida la recap usada como resumen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conversar con el agente dentro de un flujo (Priority: P1)

El usuario configura un nodo interactivo y ejecuta el flujo. Cuando el nodo queda disponible, abre su terminal y trabaja directamente con el agente. Puede ocultar la vista y volver a ella sin perder la sesión.

**Why this priority**: La conversación directa dentro del flujo es el propósito principal de la funcionalidad.

**Independent Test**: Guardar y reabrir un flujo con un nodo interactivo; ejecutarlo, abrir su terminal, intercambiar mensajes, ocultarla y reabrirla mientras la sesión sigue activa.

**Acceptance Scenarios**:

1. **Dado** un flujo editable, **Cuando** el usuario añade un nodo interactivo y configura agente, modelo, alcance de rutas y tiempo máximo, **Entonces** el canvas lo distingue de un nodo no interactivo y conserva su configuración al guardar y reabrir el flujo.
2. **Dado** un nodo interactivo listo en un run, **Cuando** Zeko llega a él, **Entonces** muestra y notifica «esperando al usuario» sin iniciar el agente.
3. **Dado** un nodo que espera al usuario, **Cuando** este abre su terminal, **Entonces** se inicia una sesión en la que puede escribir, leer respuestas y atender solicitudes de permiso del agente.
4. **Dado** una sesión activa, **Cuando** el usuario cierra o minimiza la vista y luego la reabre, **Entonces** vuelve a la misma sesión activa y el nodo no ha terminado por ocultar la vista.
5. **Dado** dos nodos interactivos listos, **Cuando** el usuario abre ambos, **Entonces** puede trabajar en las dos sesiones de manera independiente.
6. **Dado** que Claude Code y Codex están disponibles, **Cuando** el usuario configura nodos interactivos para cada uno, **Entonces** puede guardar y abrir sesiones de ambos agentes.
7. **Dado** un nodo interactivo con restricciones de herramientas o comandos admitidas por su agente, **Cuando** el agente solicita una acción, **Entonces** se aplican esas restricciones y la respuesta del usuario a una solicitud de permiso no amplía el alcance asignado al nodo.
8. **Dado** un nodo interactivo sin límite de tiempo finito, **Cuando** el usuario valida el flujo, **Entonces** Zeko muestra un error de configuración y no inicia el run.
9. **Dado** un nodo con instrucciones iniciales o resultados de predecesores, **Cuando** el usuario abre su terminal, **Entonces** Zeko muestra esos datos al usuario sin enviarlos al agente ni agregar mensajes a su conversación.

---

### User Story 2 - Entregar cambios y un resultado verificable (Priority: P1)

El usuario declara que terminó e indica un estado, o sale normalmente del agente y el nodo registra «completado» de forma provisional. La recap que produce el modelo en la terminal se usa como resumen del resultado, sin intervención de Zeko en su redacción. Zeko comprueba la ejecución y los archivos modificados, fija el estado final, registra los cambios en la copia aislada y entrega a los sucesores el mismo tipo de resultado que produce un nodo de agente.

**Why this priority**: El paso interactivo solo sirve al flujo si los siguientes nodos reciben un resultado fiable y un estado de código correcto.

**Independent Test**: Ejecutar predecesor → nodo interactivo → sucesor; modificar un archivo en la sesión, declarar «completado» y comprobar el resultado, el archivo observado y el punto de partida del sucesor.

**Acceptance Scenarios**:

1. **Dado** una sesión activa, **Cuando** el usuario declara su fin con estado «completado», «bloqueado» o «fallido» y el nodo dispone de un resumen, **Entonces** Zeko registra la declaración y determina el estado final según sus reglas.
2. **Dado** una sesión activa, **Cuando** el usuario sale normalmente del agente desde su terminal, **Entonces** Zeko finaliza automáticamente el nodo, registra «completado» como estado declarado provisional y determina el estado final según sus reglas.
3. **Dado** un nodo interactivo terminado cuya copia aislada sigue siendo confiable, **Cuando** el usuario lo reabre dentro del mismo run, **Entonces** puede continuar su trabajo en esa copia y Zeko conserva el resultado anterior en el historial como reemplazado.
4. **Dado** un dependiente activo o terminado, **Cuando** el usuario reabre el nodo interactivo del que depende, **Entonces** Zeko cancela al dependiente activo, invalida los resultados de todos los dependientes afectados y solicita confirmación antes de reejecutarlos.
5. **Dado** una sesión cuya terminal tiene una recap del modelo disponible, **Cuando** Zeko produce el resultado, **Entonces** usa esa recap como resumen sin solicitar al agente que la genere ni permitir su edición desde Zeko.
6. **Dado** una sesión sin recap disponible, **Cuando** Zeko produce el resultado, **Entonces** indica «recap no disponible» en el campo de resumen y en el nodo, sin inventar contenido de la conversación.
7. **Dado** un predecesor que modificó código, **Cuando** el usuario abre el nodo interactivo dependiente, **Entonces** trabaja desde el estado de código dejado por ese predecesor y ve su resultado completo como contexto informativo.
8. **Dado** un nodo interactivo que modificó archivos dentro de su alcance y terminó completado, **Cuando** arranca un sucesor, **Entonces** recibe el resultado estructurado completo y comienza desde los cambios registrados por el nodo interactivo.
9. **Dado** una declaración de «completado» sin cambios en una tarea que los requería, **Cuando** Zeko determina el resultado, **Entonces** muestra la inconsistencia en el nodo y en su historial.
10. **Dado** una sesión que modificó archivos fuera del alcance de rutas, **Cuando** Zeko determina el resultado, **Entonces** muestra esos archivos y aplica el estado final «bloqueado», aunque el usuario haya declarado «completado».
11. **Dado** un run terminado, **Cuando** el usuario revisa el repositorio original, **Entonces** no encuentra cambios causados por el nodo interactivo en sus archivos, rama actual ni cambios pendientes.

---

### User Story 3 - Coordinar esperas, ramas y fallos (Priority: P2)

El usuario ve qué nodos necesitan su intervención. Los sucesores esperan el resultado interactivo y las ramas independientes continúan. Una cancelación o interrupción termina la actividad del agente y deja un motivo visible.

**Why this priority**: Los flujos deben avanzar de forma predecible mientras el usuario trabaja o se ausenta.

**Independent Test**: Ejecutar un flujo con nodo interactivo, sucesor y rama independiente; comprobar esperas, avance independiente, cancelación y omisión del sucesor.

**Acceptance Scenarios**:

1. **Dado** un nodo interactivo en «esperando al usuario», **Cuando** hay una rama independiente lista, **Entonces** esa rama continúa mientras los dependientes del nodo interactivo esperan.
2. **Dado** un nodo interactivo que termina bloqueado, fallido o cancelado, **Cuando** Zeko actualiza el flujo, **Entonces** sus dependientes quedan «omitidos» con motivo visible y las ramas independientes continúan.
3. **Dado** un nodo en espera, **Cuando** transcurre tiempo antes de que el usuario lo abra, **Entonces** ese tiempo no consume su límite de ejecución.
4. **Dado** un nodo con sesión activa cuya vista se minimizó, **Cuando** se cumple su límite de tiempo, **Entonces** Zeko detiene la sesión y marca el nodo como fallido, aunque la vista esté cerrada.
5. **Dado** una sesión activa, **Cuando** el usuario cancela el nodo, **Entonces** la sesión y toda actividad asociada del agente terminan, el nodo queda «cancelado» y sus dependientes se omiten.
6. **Dado** una sesión activa al cerrarse la aplicación, **Cuando** el usuario vuelve a abrir Zeko, **Entonces** el nodo figura «interrumpido», no queda una sesión del agente ejecutándose y su copia aislada figura «no confiable».
7. **Dado** un flujo que contiene un nodo interactivo, **Cuando** el usuario intenta ejecutarlo sin interfaz, **Entonces** la validación rechaza el flujo antes de iniciar el run e identifica los nodos que requieren interfaz.

---

### User Story 4 - Revisar la trazabilidad (Priority: P3)

El usuario inspecciona el historial para saber quién cerró el nodo o si terminó al salir del agente, qué estado quedó declarado, qué decidió Zeko y qué archivos cambiaron, sin exponer información sensible.

**Why this priority**: La revisión del run permite entender y auditar el trabajo realizado durante la conversación.

**Independent Test**: Terminar una sesión con cambios y costo informado por el agente; inspeccionar el historial y confirmar los campos y la redacción de datos sensibles.

**Acceptance Scenarios**:

1. **Dado** un nodo terminado, **Cuando** el usuario abre el historial del run, **Entonces** ve quién declaró el fin o que hubo salida normal del agente, el estado declarado, el estado final y su motivo, la duración, los archivos observados y el costo si el agente lo informó.
2. **Dado** contenido persistible que incluye una clave o un dato personal, **Cuando** Zeko lo guarda o lo muestra desde el historial, **Entonces** el valor sensible está oculto y queda indicado que se redactó contenido.
3. **Dado** una sesión interactiva terminada, **Cuando** el usuario revisa el historial de Zeko, **Entonces** encuentra el resultado y los eventos del run, incluida la recap disponible como resumen, pero no una copia de la transcripción completa; la recuperación de la conversación pertenece al agente.

### Edge Cases

- El usuario intenta abrir una sesión antes de que terminen sus predecesores: el nodo sigue pendiente y explica qué dependencia falta.
- Dos predecesores aportan estados de código incompatibles: el flujo es inválido según sus reglas de dependencia; Zeko no escoge uno en silencio.
- El agente termina inesperadamente, falla su autenticación o supera el tiempo máximo antes de un cierre válido: el nodo queda fallido y una declaración posterior no puede convertirlo en completado. Estos casos se distinguen de una salida normal desde la terminal.
- El usuario cancela mientras Zeko registra los cambios: prevalece «cancelado», se conserva la copia aislada marcada como no confiable y no arranca ningún dependiente.
- El agente informa un costo ausente o inválido: el historial lo indica como no disponible.
- El agente o el usuario declaran archivos distintos de los realmente modificados: prevalece la observación de Zeko y se muestra la discrepancia.
- Se modifican rutas no autorizadas: se listan las rutas y se aplica «bloqueado».
- La aplicación se cierra con varias sesiones activas: cada nodo afectado queda interrumpido y cada copia se marca como no confiable.
- El usuario intenta iniciar otra sesión del mismo nodo: Zeko vuelve a la sesión existente y evita dos agentes sobre la misma copia.
- La ejecución sin interfaz recibe un flujo que contiene nodos interactivos, aunque estén en una rama posterior: se rechaza antes de iniciar cualquier nodo.
- El límite de tiempo falta, es indefinido o no es finito: el flujo no supera la validación. Si el usuario minimiza la terminal durante una sesión activa, el tiempo sigue contando.
- El usuario intenta reabrir un nodo cancelado o interrumpido cuya copia está marcada como no confiable: Zeko impide continuar sobre esa copia y explica el motivo.
- La sesión termina sin una recap disponible para Zeko: el resultado conserva su forma y marca el resumen como «recap no disponible»; los demás campos y verificaciones conservan su validez.
- El usuario abre la terminal y no escribe las instrucciones iniciales mostradas por Zeko: el agente no las recibe automáticamente y la sesión permanece disponible para que el usuario decida qué comunicar.

## Requirements *(mandatory)*

### Functional Requirements

**Definición del nodo**

- **FR-001**: Zeko MUST ofrecer un tipo de nodo interactivo distinguible visualmente de los nodos de agente no interactivos en edición, ejecución e historial.
- **FR-002**: El nodo MUST permitir configurar Claude Code o Codex como agente, modelo explícito, instrucciones iniciales opcionales, alcance de rutas y límite de tiempo máximo obligatorio y finito. Zeko MUST indicar el modelo al agente y MUST NOT heredar el modelo elegido por el propio agente.
- **FR-003**: Zeko MUST guardar la definición del nodo con el flujo y reconstruirla al reabrirlo. La definición MUST NOT contener secretos ni datos personales de la cuenta del agente.
- **FR-004**: Zeko MUST validar la configuración del nodo y mostrar errores antes de ejecutar el flujo; en esta versión MUST admitir Claude Code y Codex en nodos interactivos.

**Espera y sesión**

- **FR-005**: Al quedar listo en un run, el nodo MUST pasar a «esperando al usuario», mostrar una acción visible para abrirlo y notificar que necesita intervención.
- **FR-006**: Zeko MUST iniciar el agente interactivo solo tras una acción explícita del usuario sobre ese nodo. Iniciar el run MUST NOT iniciar la sesión interactiva.
- **FR-007**: La terminal MUST permitir entrada y salida interactiva del agente y permitir al usuario responder a sus solicitudes de permiso.
- **FR-008**: Cerrar o minimizar la vista MUST conservar activa la sesión; reabrir el nodo MUST recuperar esa sesión mientras siga activa.
- **FR-009**: Zeko MUST permitir al menos cuatro sesiones interactivas simultáneas, una por nodo, e impedir dos sesiones simultáneas sobre la misma copia aislada.
- **FR-010**: El límite de tiempo MUST empezar cuando el usuario abre la sesión, excluir la espera previa y seguir contando mientras la sesión permanezca activa aunque la vista esté cerrada o minimizada. Si el nodo se reabre dentro del mismo run, el tiempo activo acumulado MUST seguir sujeto al mismo límite del nodo.
- **FR-011**: Una salida normal del agente desde su terminal MUST finalizar automáticamente el nodo con «completado» como estado declarado provisional; Zeko MUST determinar el estado final según sus reglas. Un corte inesperado del proceso MUST tratarse como fallo. El usuario MUST poder reabrir un nodo terminado dentro del mismo run para continuar en su copia aislada si esta es confiable; una copia marcada como no confiable MUST impedir la reapertura.

**Contexto, aislamiento y seguridad**

- **FR-012**: Cada nodo interactivo MUST trabajar en una copia aislada y una rama propias, sin compartir una copia activa con otro nodo ni modificar el repositorio original.
- **FR-013**: Si su predecesor modificó código, el nodo interactivo MUST comenzar desde el estado de código dejado por él, respetando las reglas generales de dependencias.
- **FR-014**: Zeko MUST mostrar al usuario del nodo interactivo el resultado completo de sus predecesores: declaración, estado final, motivo, archivos observados, verificaciones, hallazgos y bloqueos disponibles. Zeko MUST tratarlo, y tratar toda salida del agente, como información; nunca como instrucciones capaces de alterar permisos, aprobaciones u orquestación.
- **FR-015**: El canvas MUST mostrar el nivel real de confinamiento y sus límites según el agente y la configuración. La copia aislada y el alcance de rutas MUST NOT presentarse como confinamiento real de la terminal.
- **FR-016**: La sesión MUST aplicar las restricciones de herramientas y comandos configuradas para el nodo cuando el agente las admita. Zeko MUST mostrar las restricciones que el agente no admite. El usuario MUST poder responder a las solicitudes de permiso del agente, pero esa respuesta MUST NOT ampliar las restricciones de seguridad de Zeko ni el alcance de rutas asignado.
- **FR-017**: Zeko MUST mostrar las instrucciones iniciales y los resultados completos de predecesores al usuario cuando abre el nodo, sin enviarlos al agente ni agregar mensajes a su conversación. El usuario decide qué contenido de lo mostrado comunicarle escribiéndolo en la terminal.

**Finalización y resultado**

- **FR-018**: El usuario MUST poder terminar la tarea mediante una declaración explícita de «completado», «bloqueado» o «fallido». Una salida normal del agente desde la terminal MUST ser otra forma de terminarla y MUST registrar «completado» como declaración provisional. Zeko MUST usar la recap del modelo disponible en la terminal como resumen del resultado, sin solicitarla, modificarla ni exigir confirmación del usuario. Si no hay recap disponible, MUST indicar «recap no disponible» en el resumen y en el nodo.
- **FR-019**: Zeko MUST determinar y mostrar el estado final del nodo según las reglas generales del flujo, dando prioridad a cancelación, interrupción, corte del proceso, tiempo excedido y violaciones observadas por encima de «completado» declarado por el usuario.
- **FR-020**: Zeko MUST determinar los archivos modificados observando la copia aislada, mostrar discrepancias con cualquier declaración y marcar «bloqueado» un cambio fuera del alcance de rutas.
- **FR-021**: Si la tarea requería cambios y el usuario declara «completado» sin cambios observados, Zeko MUST mostrar la inconsistencia en el nodo y el historial. MUST mostrar otras inconsistencias detectables entre declaración y observación.
- **FR-022**: Al terminar, Zeko MUST registrar los cambios de la copia aislada y producir un resultado con la misma forma que el de un nodo de agente: estado declarado, recap del modelo como resumen o indicación de ausencia, archivos observados, verificaciones, hallazgos, bloqueos, estado final y motivo. Las listas sin elementos MUST admitirse vacías.
- **FR-023**: Los dependientes MUST recibir el resultado estructurado completo y, si el nodo interactivo terminó completado con cambios, MUST arrancar desde su estado de código registrado.
- **FR-023a**: Al reabrir un nodo interactivo, el run MUST volver a estar en curso si ya había terminado. Zeko MUST conservar el resultado anterior en el historial como reemplazado, cancelar sus dependientes activos e invalidar los resultados de todos los dependientes directos e indirectos afectados; las ramas independientes MUST conservar sus resultados. Al cerrarse de nuevo el nodo, Zeko MUST pedir confirmación explícita antes de reejecutar dependientes con el nuevo resultado; ningún dependiente MUST consumir el resultado reemplazado como vigente.

**Coordinación, cancelación e historial**

- **FR-024**: Los dependientes MUST esperar a que el nodo interactivo termine completado; las ramas independientes MUST continuar. Si termina bloqueado, fallido o cancelado, los dependientes MUST quedar «omitidos» con motivo visible.
- **FR-025**: El usuario MUST poder cancelar el nodo desde el canvas o su vista. Zeko MUST detener la sesión y toda actividad asociada del agente y fijar «cancelado» como estado final.
- **FR-026**: Si Zeko se cierra durante una sesión activa, al volver MUST registrar el nodo como «interrumpido», dejar sin procesos activos del agente y marcar su copia aislada como «no confiable».
- **FR-027**: El historial MUST registrar quién declaró el fin o que la finalización ocurrió por salida normal del agente; también MUST registrar la recap disponible como resumen, estado declarado, estado final y motivo, duración, costo cuando el agente lo informe y archivos observados.
- **FR-028**: Zeko MUST guardar solo el resultado y los eventos del run, incluida la recap disponible que se use como resumen, y MUST NOT guardar una transcripción completa de la terminal. Todo contenido persistido MUST redactarse antes de guardarlo o volver a mostrarlo, ocultando claves de API, credenciales y datos personales. La conservación y recuperación de conversaciones completas corresponde a las funciones propias del agente.
- **FR-029**: Al ejecutar sin interfaz un flujo que contiene uno o más nodos interactivos, Zeko MUST rechazarlo durante la validación, antes de iniciar el run, e identificar los nodos que requieren interfaz.

### Non-Functional Requirements

- **NFR-001**: El comportamiento descrito MUST funcionar en Windows.
- **NFR-002**: En sesiones activas, el texto que escribe el usuario MUST aparecer en la terminal en menos de 100 ms, medido desde la pulsación hasta su visualización, incluso con otros nodos en ejecución.
- **NFR-003**: La interfaz MUST mantener operables canvas y terminales con al menos cuatro sesiones interactivas abiertas y ocho nodos de agente no interactivos en ejecución simultánea.
- **NFR-004**: Desde la solicitud de cancelación hasta el cese de toda actividad asociada del agente MUST transcurrir menos de 10 segundos.
- **NFR-005**: El estado «esperando al usuario» y la acción para declarar el fin MUST ser visibles en el nodo o su vista principal sin abrir menús.
- **NFR-006**: Ningún agente interactivo MUST iniciar sin acción explícita del usuario; ninguna salida del agente MUST interpretarse como orden de Zeko.

### Key Entities

- **Definición de nodo interactivo**: tipo, agente, modelo explícito, instrucciones opcionales, alcance de rutas, límite de tiempo obligatorio y finito, y posición en el flujo; no contiene secretos.
- **Sesión interactiva**: conversación activa de un nodo en un run, con momento de apertura, duración, estado de actividad y copia aislada asociada.
- **Declaración de fin**: origen manual o salida normal del agente, usuario cuando corresponda, estado declarado y momento.
- **Resumen del resultado**: recap producida por el modelo dentro de la terminal cuando esté disponible; en su ausencia, indicación explícita de que no hay recap.
- **Resultado del nodo**: declaración, estado final y motivo, archivos observados, verificaciones, hallazgos, bloqueos y costo informado cuando exista; consumible por cualquier dependiente. Los resultados anteriores de un nodo reabierto quedan identificados como reemplazados.
- **Copia aislada**: estado de código y cambios propios del nodo, rama asociada y marca de confianza tras cancelación o interrupción.
- **Historial del run**: resultado y eventos persistidos del nodo, incluidos los cierres y reaperturas sucesivos y la recap usada como resumen, sujetos a redacción antes de guardarse; no incluye transcripción completa.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En Windows, un usuario puede crear, guardar, reabrir y ejecutar un flujo con nodo interactivo, terminarlo y hacer que un sucesor consuma su resultado en un recorrido completo.
- **SC-002**: En el 100 % de los nodos interactivos, el agente comienza únicamente después de que el usuario abre expresamente su sesión.
- **SC-003**: El texto ingresado aparece en menos de 100 ms en todas las pulsaciones medidas durante la carga concurrente definida en NFR-003.
- **SC-004**: Con cuatro sesiones interactivas y ocho nodos no interactivos simultáneos, el usuario puede escribir, cambiar de terminal y operar el canvas sin bloqueo de la interfaz.
- **SC-005**: El 100 % de las cancelaciones detienen toda actividad asociada del agente en menos de 10 segundos.
- **SC-006**: En el 100 % de los resultados, la lista de archivos modificados coincide con lo observado en la copia aislada, y ningún cambio del nodo afecta el repositorio original.
- **SC-007**: En una revisión de los datos persistidos de sesiones, el 100 % de las claves, credenciales y datos personales detectables están ocultos.

## Assumptions

- La versión descrita es local, para un usuario y repositorios de su máquina, conforme al alcance vigente de Zeko.
- El usuario dispone de Claude Code o Codex instalado y autenticado para cada nodo que configure; una falla de autenticación al abrir la sesión se muestra como falla del nodo.
- La definición del nodo y el historial del run son datos distintos: el flujo conserva configuración; el historial conserva resultados y eventos de ejecución.
- «Interrumpido» es un motivo visible de terminación no satisfactoria; no habilita a los dependientes.
- Las verificaciones, hallazgos y bloqueos pueden ser listas vacías cuando la sesión no aporta esa información.
- La regla FR-029 requiere tratar en la planificación su conflicto con el principio IV de la constitución vigente, que exige que todo flujo ejecutable desde el canvas también pueda ejecutarse desde la línea de comandos.
- En un nodo interactivo, el contexto conversacional del agente es lo que el usuario introduce en su terminal y lo que el propio agente conserva en esa conversación; Zeko muestra antecedentes sin agregarlos al chat por cuenta propia.
- La disponibilidad de conversaciones anteriores depende de las funciones del agente elegido; Zeko no promete almacenarlas ni reproducirlas y solo registra la actividad del nodo dentro de su run.

## Out of Scope

- Tomar el control de un nodo de agente no interactivo mientras se ejecuta.
- Grabar y reproducir sesiones.
- Compartir una sesión entre varios usuarios.
- Confinar realmente la terminal interactiva.
- Crear terminales sueltas fuera de un nodo de flujo.
