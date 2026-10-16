# Feature Specification: Nodos interactivos de agente

**Feature Branch**: `Tiago-Davila/feature-interactive-nodes`

**Created**: 2026-09-27 | **Updated**: 2026-10-16

**Status**: Draft

**Input**: User description: "Trabajar directamente con un agente de código en la terminal de un nodo de flujo, conservando aislamiento, trazabilidad y un resultado consumible por otros nodos." Ampliación del 2026-10-16: "Que los agentes de distintos nodos se comuniquen: que lean el trabajo de otros nodos, que se manden mensajes y que un agente pueda orquestar sub-tareas en otros nodos, sin pisarse los archivos."

## Objetivo

El usuario necesita explorar, decidir y corregir en conversación con un agente sin salir del flujo. Los pasos posteriores deben conocer qué se hizo, qué cambió y cómo terminó la tarea.

Además, los agentes de distintos nodos se coordinan entre sí en tres niveles:

1. **Lectura**: un agente consulta, cuando lo necesita, el estado, el resultado y la actividad reciente de los nodos enlazados al suyo.
2. **Mensajes**: un agente interactivo envía un mensaje a otro agente interactivo enlazado. Zeko lo entrega en la terminal del destino cuando este espera entrada.
3. **Orquestación**: un agente interactivo crea nodos hijos dentro del run para repartir trabajo, sigue su progreso y lee sus resultados.

Cada nodo, incluidos los hijos, trabaja en su propia copia aislada. Zeko no bloquea archivos ni integra ramas por su cuenta.

Esta especificación describe el comportamiento esperado, independientemente de lo que ya haga la aplicación.

**Actores**

- **Usuario desarrollador**: abre la sesión, conversa con el agente, responde a sus solicitudes de permiso, confirma o rechaza los nodos hijos que propone un orquestador, cancela, declara el fin de la tarea o sale normalmente del agente para finalizarla.
- **Agente CLI**: atiende la conversación interactiva en la terminal del nodo. Puede usar las herramientas de Zeko que la configuración del nodo habilite.
- **Agente orquestador**: el agente de un nodo interactivo con orquestación habilitada.
- **Nodo hijo**: nodo de agente no interactivo creado durante un run a pedido de un orquestador.
- **Zeko**: coordina el flujo, aísla los cambios, entrega los mensajes, crea los hijos aprobados, registra la sesión y determina el estado final.

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
- Q: ¿Cómo recibe el agente las instrucciones iniciales y el resultado de los predecesores? → A: Zeko los muestra al usuario; solo llega al agente el contenido que el usuario escribe en la terminal. (Reemplazada en parte por la sesión 2026-10-16: el agente también puede leerlos con una herramienta de Zeko.)
- Q: ¿Guarda Zeko la transcripción completa de la sesión? → A: No; cada agente conserva y permite recuperar sus conversaciones con sus propias funciones. Zeko guarda solo el resultado y los eventos del run, incluida la recap usada como resumen.

### Session 2026-09-28

- Q: ¿Qué debe contener el campo de resumen del resultado de un nodo interactivo? → A: La recap del modelo: la última respuesta completa del agente antes del cierre, tomada de las funciones de conversación del propio agente; si no existe, «recap no disponible».
- Q: Si la última respuesta del agente contiene un JSON con la forma del resultado, ¿cómo debe usarlo Zeko? → A: No lo interpreta; la recap se conserva como texto. Que el agente entregue un resultado estructurado, por ejemplo por MCP, queda fuera de alcance por ahora.
- Q: Al reabrir un nodo interactivo terminado, ¿el agente continúa su conversación anterior o empieza una nueva? → A: Retoma la conversación anterior con la función del propio agente. Si el agente no puede recuperarla, Zeko lo indica y abre una conversación nueva sobre la misma copia.
- Q: ¿Cómo sabe Zeko que la tarea de un nodo interactivo «requería cambios»? → A: Por una opción «requiere cambios» en la configuración del nodo, desactivada por defecto; solo si está activada, un «completado» sin cambios observados es una inconsistencia.
- Q: Cuando el usuario declara el fin desde Zeko con el agente todavía abierto, ¿qué pasa con la sesión del agente? → A: Zeko cierra la sesión del agente antes de registrar los cambios; si el agente está respondiendo, pide confirmación para cerrarlo ya o espera a que termine la respuesta.

### Session 2026-10-16

- Q: ¿Pueden comunicarse los agentes de distintos nodos? → A: Sí, en tres niveles: lectura bajo demanda de nodos enlazados, mensajes entre nodos interactivos enlazados y orquestación (un nodo interactivo crea nodos hijos dentro del run).
- Q: ¿Cómo llega la información de otro nodo al agente? → A: El agente la pide con una herramienta de Zeko cuando la necesita. Zeko no la escribe en la conversación por su cuenta.
- Q: ¿Puede Zeko escribir en la conversación de un agente? → A: Solo para entregar un mensaje de otro agente enlazado o un aviso de Zeko sobre los hijos del propio nodo. Siempre va enmarcado como mensaje, con el agente esperando entrada y sin texto a medio escribir del usuario, y solo si la configuración lo habilita. La mensajería está desactivada por defecto.
- Q: ¿Quién puede enviar mensajes y a quién? → A: Solo el agente de un nodo interactivo con sesión activa, y solo a nodos interactivos con los que tenga un enlace con mensajería habilitada.
- Q: ¿Qué nodos puede crear un orquestador? → A: Solo nodos de agente no interactivos, como hijos directos suyos y dentro del run. Su alcance de rutas tiene que estar incluido en el del orquestador, y el agente y los límites tienen que estar permitidos por la configuración del orquestador. Los hijos no pueden crear nodos ni enviar mensajes.
- Q: ¿Se pide confirmación para crear hijos? → A: Sí, por defecto el usuario confirma cada lote de hijos. La confirmación se puede desactivar en la configuración del nodo orquestador.
- Q: ¿Los hijos se guardan en el flujo? → A: No automáticamente: pertenecen al run. El usuario puede guardarlos en el flujo con una acción explícita.
- Q: ¿Cómo evitan los agentes pisarse los archivos? → A: Cada nodo, incluidos los hijos, trabaja en su propia copia aislada y Zeko no bloquea archivos. Los hijos parten de una instantánea del estado actual del orquestador. La integración de los cambios de un hijo la deciden el orquestador o el usuario dentro de la copia del orquestador; Zeko nunca la hace.
- Q: ¿Guarda Zeko el texto de los mensajes? → A: No. Registra quién lo envió, a quién, cuándo, cómo terminó la entrega y su tamaño. El texto queda en la conversación del agente que lo recibió.
- Q: ¿Cómo sabe Zeko si un agente está ocupado o esperando entrada? → A: Por los avisos que emite el propio agente o por sus archivos de sesión. Nunca interpretando la pantalla de la terminal.

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
9. **Dado** un nodo con instrucciones iniciales o resultados de predecesores, **Cuando** el usuario abre su terminal, **Entonces** Zeko muestra esos datos al usuario sin escribirlos en la conversación del agente, y el agente puede leerlos con la herramienta de lectura de Zeko si el usuario se lo pide.
10. **Dado** una sesión activa, **Cuando** el agente pasa de trabajar a esperar entrada o a pedir permiso, **Entonces** el nodo muestra esa actividad sin que el usuario abra la terminal.

---

### User Story 2 - Entregar cambios y un resultado verificable (Priority: P1)

El usuario declara que terminó e indica un estado, o sale normalmente del agente y el nodo registra «completado» de forma provisional. La recap que produce el modelo en la terminal se usa como resumen del resultado, sin intervención de Zeko en su redacción. Zeko comprueba la ejecución y los archivos modificados, fija el estado final, registra los cambios en la copia aislada y entrega a los sucesores el mismo tipo de resultado que produce un nodo de agente.

**Why this priority**: El paso interactivo solo sirve al flujo si los siguientes nodos reciben un resultado fiable y un estado de código correcto.

**Independent Test**: Ejecutar predecesor → nodo interactivo → sucesor; modificar un archivo en la sesión, declarar «completado» y comprobar el resultado, el archivo observado y el punto de partida del sucesor.

**Acceptance Scenarios**:

1. **Dado** una sesión activa, **Cuando** el usuario declara su fin con estado «completado», «bloqueado» o «fallido» y el nodo dispone de un resumen, **Entonces** Zeko registra la declaración, cierra la sesión del agente antes de registrar los cambios y determina el estado final según sus reglas.
2. **Dado** una sesión activa, **Cuando** el usuario sale normalmente del agente desde su terminal, **Entonces** Zeko finaliza automáticamente el nodo, registra «completado» como estado declarado provisional y determina el estado final según sus reglas.
3. **Dado** un nodo interactivo terminado cuya copia aislada sigue siendo confiable, **Cuando** el usuario lo reabre dentro del mismo run, **Entonces** el agente retoma su conversación anterior, el usuario puede continuar su trabajo en esa copia y Zeko conserva el resultado anterior en el historial como reemplazado.
4. **Dado** un dependiente activo o terminado, **Cuando** el usuario reabre el nodo interactivo del que depende, **Entonces** Zeko cancela al dependiente activo, invalida los resultados de todos los dependientes afectados y solicita confirmación antes de reejecutarlos.
5. **Dado** una sesión cuyo agente tiene una recap del modelo disponible, **Cuando** Zeko produce el resultado, **Entonces** usa como resumen la última respuesta completa del agente antes del cierre, obtenida de las funciones de conversación del propio agente, sin solicitar al agente que la genere ni permitir su edición desde Zeko.
6. **Dado** una sesión sin recap disponible, **Cuando** Zeko produce el resultado, **Entonces** indica «recap no disponible» en el campo de resumen y en el nodo, sin inventar contenido de la conversación.
7. **Dado** un predecesor que modificó código, **Cuando** el usuario abre el nodo interactivo dependiente, **Entonces** trabaja desde el estado de código dejado por ese predecesor y ve su resultado completo como contexto informativo.
8. **Dado** un nodo interactivo que modificó archivos dentro de su alcance y terminó completado, **Cuando** arranca un sucesor, **Entonces** recibe el resultado estructurado completo y comienza desde los cambios registrados por el nodo interactivo.
9. **Dado** un nodo con la opción «requiere cambios» activada y una declaración de «completado» sin cambios observados, **Cuando** Zeko determina el resultado, **Entonces** muestra la inconsistencia en el nodo y en su historial.
10. **Dado** una sesión que modificó archivos fuera del alcance de rutas, **Cuando** Zeko determina el resultado, **Entonces** muestra esos archivos y aplica el estado final «bloqueado», aunque el usuario haya declarado «completado».
11. **Dado** un run terminado, **Cuando** el usuario revisa el repositorio original, **Entonces** no encuentra cambios causados por el nodo interactivo ni por sus hijos en sus archivos, rama actual ni cambios pendientes.

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
5. **Dado** una sesión activa, **Cuando** el usuario cancela el nodo, **Entonces** la sesión y toda actividad asociada del agente terminan, el nodo queda «cancelado», sus hijos activos se cancelan y sus dependientes se omiten.
6. **Dado** una sesión activa al cerrarse la aplicación, **Cuando** el usuario vuelve a abrir Zeko, **Entonces** el nodo figura «interrumpido», no queda una sesión del agente ejecutándose, su copia aislada figura «no confiable» y sus hijos activos figuran «interrumpidos».
7. **Dado** un flujo que contiene un nodo interactivo, **Cuando** el usuario intenta ejecutarlo sin interfaz, **Entonces** la validación rechaza el flujo antes de iniciar el run e identifica los nodos que requieren interfaz.

---

### User Story 4 - Leer el trabajo de los nodos enlazados (Priority: P2)

El agente de un nodo interactivo consulta, cuando lo necesita, qué hizo otro nodo enlazado: su estado, su resultado y su actividad reciente. También puede leer sus propias instrucciones y los resultados de sus predecesores. Nadie le empuja esa información a la conversación.

**Why this priority**: Es la forma de coordinación más segura y la base de los mensajes y la orquestación: permite continuar o revisar el trabajo de otro nodo sin que el usuario copie y pegue.

**Independent Test**: Flujo con dos nodos interactivos enlazados. Mientras uno trabaja, pedir al agente del otro que lea qué hizo; comprobar que la respuesta coincide con la actividad real y que un nodo no enlazado no es legible.

**Acceptance Scenarios**:

1. **Dado** dos nodos enlazados, **Cuando** el agente de uno pide la lista de sus enlaces, **Entonces** recibe los nodos enlazados con su título, tipo, agente y estado, y nada más.
2. **Dado** un nodo enlazado que terminó, **Cuando** el agente pide su resultado, **Entonces** recibe el resultado vigente con la misma forma que recibe un sucesor.
3. **Dado** un nodo enlazado que sigue trabajando, **Cuando** el agente pide su actividad reciente, **Entonces** recibe las últimas entradas de su conversación o de su actividad, redactadas y marcadas como datos.
4. **Dado** un nodo interactivo con predecesores, **Cuando** su agente pide su propio contexto, **Entonces** recibe las instrucciones del nodo y los resultados vigentes de sus predecesores, aunque no haya enlaces declarados.
5. **Dado** un nodo no enlazado, de otro run o con un resultado reemplazado, **Cuando** el agente intenta leerlo, **Entonces** Zeko lo rechaza con un motivo y no entrega nada, o entrega solo el resultado vigente.
6. **Dado** un enlace de una sola dirección, **Cuando** el nodo leído intenta leer al que lo lee, **Entonces** Zeko lo rechaza.

---

### User Story 5 - Mensajes entre agentes (Priority: P2)

Dos agentes interactivos enlazados se mandan mensajes para coordinarse, por ejemplo «ya cambié la interfaz de X; adaptá tu parte». Zeko entrega cada mensaje en la terminal del destino solo cuando ese agente espera entrada y el usuario no está escribiendo. Si no, lo encola y lo entrega después.

**Why this priority**: Permite coordinar trabajo en paralelo sin que el usuario haga de intermediario, pero escribe en la conversación de otro agente, así que va detrás de la lectura y está desactivado por defecto.

**Independent Test**: Flujo con mensajería habilitada y dos nodos interactivos enlazados. Enviar un mensaje con el destino esperando, con el destino trabajando y con texto a medio escribir en el destino; comprobar entrega, cola y resultados informados al remitente.

**Acceptance Scenarios**:

1. **Dado** la mensajería habilitada y un destino que espera entrada, **Cuando** el agente remitente envía un mensaje, **Entonces** Zeko lo escribe en la terminal del destino como un único mensaje enmarcado, con remitente y a quién responder, y el remitente recibe «entregado» cuando el destino empieza a procesarlo.
2. **Dado** un destino que está trabajando o esperando permiso, **Cuando** llega un mensaje, **Entonces** Zeko no interrumpe, lo encola y lo entrega cuando el destino vuelve a esperar entrada; el remitente recibe «encolado».
3. **Dado** un destino en cuya terminal el usuario dejó texto sin enviar, **Cuando** llega un mensaje, **Entonces** Zeko no lo escribe y lo encola hasta que esa entrada quede vacía o enviada.
4. **Dado** un mensaje encolado, **Cuando** vence su plazo, la cola del destino está llena o la sesión del destino termina, **Entonces** el remitente recibe el motivo y el nodo destino deja de mostrarlo como pendiente.
5. **Dado** un mensaje recibido, **Cuando** el agente destino responde, **Entonces** la respuesta llega al remitente original con las mismas reglas.
6. **Dado** un remitente que supera el intervalo mínimo por destino, el máximo por turno o el máximo del nodo, **Cuando** envía, **Entonces** recibe «límite alcanzado» con el tiempo de espera cuando aplique y nada se entrega.
7. **Dado** un mensaje cuyo cuerpo imita el marco de Zeko o contiene secuencias de control, **Cuando** se entrega, **Entonces** el marco real es distinguible y las secuencias de control no llegan a la terminal.
8. **Dado** un nodo sin enlace con mensajería, un destino no interactivo, la mensajería deshabilitada o la recepción pausada por el usuario, **Cuando** un agente intenta enviar, **Entonces** Zeko lo rechaza con el motivo y nada se escribe.
9. **Dado** un mensaje entregado, **Cuando** el usuario mira la terminal del destino, **Entonces** ve el mensaje como cualquier otra entrada, y el nodo indica que recibió un mensaje de otro agente.

---

### User Story 6 - Orquestar sub-tareas en nodos hijos (Priority: P2)

El agente de un nodo interactivo con orquestación habilitada divide el trabajo y pide a Zeko crear nodos hijos, por ejemplo uno por módulo. El usuario confirma el lote. Los hijos corren como nodos de agente en sus propias copias, partiendo del estado actual del orquestador. El orquestador sigue su progreso, recibe un aviso cuando cada uno termina, lee sus resultados y decide si integra sus ramas en su copia.

**Why this priority**: Permite paralelizar trabajo desde una conversación, pero multiplica costo y superficie de cambios, así que requiere configuración explícita y confirmación.

**Independent Test**: Nodo interactivo con orquestación habilitada. Pedir al agente que cree dos hijos con alcances disjuntos y un tercero que dependa del primero; confirmar; comprobar copias, punto de partida, dependencias, avisos al orquestador, lectura de resultados y que la copia del orquestador no cambió hasta que el agente integra una rama.

**Acceptance Scenarios**:

1. **Dado** un orquestador, **Cuando** su agente pide crear un lote de hijos válido, **Entonces** Zeko muestra al usuario el lote con agentes, modelos, alcances y límites, y crea los hijos solo si el usuario confirma.
2. **Dado** un lote con un hijo cuyo alcance excede el del orquestador, con un agente no permitido, con límites mayores a los permitidos, que supera el máximo de hijos o con dependencias inválidas, **Cuando** el agente lo pide, **Entonces** Zeko rechaza el lote completo sin crear nada e informa cada motivo.
3. **Dado** un pedido de validación sin creación, **Cuando** el agente lo hace, **Entonces** recibe el mismo resultado de validación y nada se crea ni se pide al usuario.
4. **Dado** un lote confirmado, **Cuando** arrancan los hijos, **Entonces** cada uno trabaja en su propia copia aislada que parte del estado de código del orquestador en el momento de la creación, y la copia, rama e historial del orquestador no cambian.
5. **Dado** un hijo que depende de otro del mismo lote, **Cuando** el primero termina completado, **Entonces** el dependiente arranca desde el resultado del primero; si el primero no termina completado, el dependiente queda omitido.
6. **Dado** hijos en ejecución, **Cuando** uno termina, **Entonces** el orquestador recibe un aviso enmarcado de Zeko en su terminal cuando espera entrada, y su agente puede leer el resultado del hijo.
7. **Dado** un hijo en ejecución, **Cuando** el agente orquestador lo cancela, **Entonces** el hijo queda «cancelado» y su copia «no confiable».
8. **Dado** un hijo terminado, **Cuando** el agente orquestador integra la rama del hijo en su propia copia, **Entonces** Zeko lo observa como cambios del orquestador y valida su alcance; Zeko no integró nada por su cuenta.
9. **Dado** dos hijos del mismo lote con alcances superpuestos, **Cuando** el agente lo pide, **Entonces** Zeko advierte la superposición en la confirmación.
10. **Dado** hijos visibles en el canvas durante el run, **Cuando** el usuario elige «Guardar en el flujo», **Entonces** Zeko los agrega al archivo del flujo como nodos de agente; sin esa acción, el flujo no cambia.
11. **Dado** un orquestador con hijos activos, **Cuando** su sesión termina por declaración, salida, fallo, tiempo, cancelación o interrupción, **Entonces** Zeko pide al usuario si cancela los hijos activos o los deja terminar, salvo en cancelación e interrupción, que los cancelan siempre.
12. **Dado** un hijo, **Cuando** su agente intenta crear nodos o enviar mensajes, **Entonces** no dispone de esas herramientas.

---

### User Story 7 - Revisar la trazabilidad (Priority: P3)

El usuario inspecciona el historial para saber quién cerró el nodo o si terminó al salir del agente, qué estado quedó declarado, qué decidió Zeko, qué archivos cambiaron, qué mensajes se intercambiaron y qué hijos se crearon, sin exponer información sensible.

**Why this priority**: La revisión del run permite entender y auditar el trabajo realizado durante la conversación y la coordinación entre agentes.

**Independent Test**: Terminar una sesión con cambios, mensajes, hijos y costo informado por el agente; inspeccionar el historial y confirmar los campos y la redacción de datos sensibles.

**Acceptance Scenarios**:

1. **Dado** un nodo terminado, **Cuando** el usuario abre el historial del run, **Entonces** ve quién declaró el fin o que hubo salida normal del agente, el estado declarado, el estado final y su motivo, la duración, los archivos observados y el costo si el agente lo informó.
2. **Dado** contenido persistible que incluye una clave o un dato personal, **Cuando** Zeko lo guarda o lo muestra desde el historial, **Entonces** el valor sensible está oculto y queda indicado que se redactó contenido.
3. **Dado** una sesión interactiva terminada, **Cuando** el usuario revisa el historial de Zeko, **Entonces** encuentra el resultado y los eventos del run, incluida la recap disponible como resumen, pero no una copia de la transcripción completa; la recuperación de la conversación pertenece al agente.
4. **Dado** un run con mensajes entre agentes, **Cuando** el usuario revisa el historial, **Entonces** ve cada envío con remitente, destino, momento, resultado de la entrega y tamaño, pero no el texto del mensaje, y también los envíos rechazados.
5. **Dado** un run con hijos, **Cuando** el usuario revisa el historial, **Entonces** ve cada lote pedido, su validación, la decisión del usuario, los hijos creados con su orquestador y sus resultados.

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
- El usuario declara el fin mientras el agente está respondiendo: Zeko le pide elegir entre cerrar el agente de inmediato o esperar a que termine; si lo cierra de inmediato, la recap es la última respuesta completa anterior o «recap no disponible». La copia no se registra hasta que la sesión está cerrada.
- Al reabrir un nodo, el agente no puede recuperar la conversación anterior: Zeko lo indica y abre una conversación nueva sobre la misma copia; el resultado anterior sigue visible como reemplazado.
- El usuario abre la terminal y no escribe las instrucciones iniciales mostradas por Zeko: el agente no las recibe automáticamente; puede leerlas solo si usa la herramienta de lectura.
- El agente no emite avisos de actividad (por versión, configuración o error): la actividad figura «desconocida», los mensajes hacia ese nodo se encolan y no se entregan hasta tener un aviso de espera, y la declaración de fin pide confirmación de cierre.
- Dos agentes se responden mensajes sin fin: los límites por par, por turno y por nodo cortan el intercambio y el remitente recibe «límite alcanzado».
- El usuario escribe en la terminal del destino justo cuando Zeko va a entregar un mensaje: la entrega espera; nunca se mezcla un mensaje con texto del usuario.
- Un mensaje se escribe en la terminal pero el destino no empieza a procesarlo dentro del plazo: el remitente recibe «entregado sin acuse», no «entregado».
- Un proceso ajeno a la sesión intenta enviar avisos o usar herramientas de Zeko sin la credencial de esa sesión: Zeko lo rechaza, no produce efecto y lo registra.
- Un orquestador pide hijos mientras el usuario está ausente: el pedido espera la confirmación sin bloquear al agente; el agente recibe «pendiente de confirmación» y luego el resultado.
- El usuario rechaza un lote: el agente recibe el rechazo como definitivo y no se crea nada.
- Hijos con alcances superpuestos modifican los mismos archivos: cada uno en su copia; el conflicto aparece recién al integrar sus ramas y lo resuelve quien integra.
- Un hijo depende de otro hijo que falla: queda omitido con motivo visible.
- El orquestador se reabre: sus hijos terminados conservan sus resultados y siguen legibles.
- El proyecto declara rutas compartidas (por ejemplo dependencias instaladas) y un agente con terminal sin confinar escribe en ellas: esa escritura alcanza a la copia original de esas rutas. Zeko lo advierte en el nodo, porque esas rutas no están aisladas.

## Requirements *(mandatory)*

### Functional Requirements

**Definición del nodo**

- **FR-001**: Zeko MUST ofrecer un tipo de nodo interactivo distinguible visualmente de los nodos de agente no interactivos en edición, ejecución e historial.
- **FR-002**: El nodo MUST permitir configurar Claude Code o Codex como agente, modelo explícito, instrucciones iniciales opcionales, alcance de rutas, la opción «requiere cambios» (desactivada por defecto) y límite de tiempo máximo obligatorio y finito. Zeko MUST indicar el modelo al agente y MUST NOT heredar el modelo elegido por el propio agente.
- **FR-003**: Zeko MUST guardar la definición del nodo con el flujo y reconstruirla al reabrirlo. La definición MUST NOT contener secretos ni datos personales de la cuenta del agente.
- **FR-004**: Zeko MUST validar la configuración del nodo y mostrar errores antes de ejecutar el flujo; en esta versión MUST admitir Claude Code y Codex en nodos interactivos.

**Espera y sesión**

- **FR-005**: Al quedar listo en un run, el nodo MUST pasar a «esperando al usuario», mostrar una acción visible para abrirlo y notificar que necesita intervención.
- **FR-006**: Zeko MUST iniciar el agente interactivo solo tras una acción explícita del usuario sobre ese nodo. Iniciar el run MUST NOT iniciar la sesión interactiva.
- **FR-007**: La terminal MUST permitir entrada y salida interactiva del agente y permitir al usuario responder a sus solicitudes de permiso.
- **FR-008**: Cerrar o minimizar la vista MUST conservar activa la sesión; reabrir el nodo MUST recuperar esa sesión mientras siga activa.
- **FR-009**: Zeko MUST permitir al menos cuatro sesiones interactivas simultáneas, una por nodo, e impedir dos sesiones simultáneas sobre la misma copia aislada.
- **FR-010**: El límite de tiempo MUST empezar cuando el usuario abre la sesión, excluir la espera previa y seguir contando mientras la sesión permanezca activa aunque la vista esté cerrada o minimizada. Si el nodo se reabre dentro del mismo run, el tiempo activo acumulado MUST seguir sujeto al mismo límite del nodo.
- **FR-011**: Una salida normal del agente desde su terminal MUST finalizar automáticamente el nodo con «completado» como estado declarado provisional; Zeko MUST determinar el estado final según sus reglas. Un corte inesperado del proceso MUST tratarse como fallo. El usuario MUST poder reabrir un nodo terminado dentro del mismo run para continuar en su copia aislada si esta es confiable; una copia marcada como no confiable MUST impedir la reapertura. Al reabrir, Zeko MUST retomar la conversación anterior del agente mediante la función de reanudación del propio agente. Si el agente no puede recuperarla, Zeko MUST indicarlo al usuario y abrir una conversación nueva sobre la misma copia.

**Contexto, aislamiento y seguridad**

- **FR-012**: Cada nodo interactivo MUST trabajar en una copia aislada y una rama propias, sin compartir una copia activa con otro nodo ni modificar el repositorio original.
- **FR-013**: Si su predecesor modificó código, el nodo interactivo MUST comenzar desde el estado de código dejado por él, respetando las reglas generales de dependencias.
- **FR-014**: Zeko MUST mostrar al usuario del nodo interactivo el resultado completo de sus predecesores: declaración, estado final, motivo, archivos observados, verificaciones, hallazgos y bloqueos disponibles. Zeko MUST tratarlo, y tratar toda salida de un agente y todo mensaje entre agentes, como información; nunca como instrucciones capaces de alterar permisos, aprobaciones, alcance u orquestación.
- **FR-015**: El canvas MUST mostrar el nivel real de confinamiento y sus límites según el agente y la configuración. La copia aislada y el alcance de rutas MUST NOT presentarse como confinamiento real de la terminal.
- **FR-016**: La sesión MUST aplicar las restricciones de herramientas y comandos configuradas para el nodo cuando el agente las admita. Zeko MUST mostrar las restricciones que el agente no admite. El usuario MUST poder responder a las solicitudes de permiso del agente, pero esa respuesta MUST NOT ampliar las restricciones de seguridad de Zeko ni el alcance de rutas asignado.
- **FR-017**: Zeko MUST mostrar las instrucciones iniciales y los resultados completos de predecesores al usuario cuando abre el nodo. Zeko MUST NOT escribirlos en la conversación del agente; el agente puede leerlos con la herramienta de lectura (FR-033) y el usuario puede comunicarlos escribiendo en la terminal. Las únicas escrituras de Zeko en la terminal de un agente son la entrega de mensajes de otros agentes (FR-037) y los avisos sobre hijos (FR-050), con sus condiciones.

**Finalización y resultado**

- **FR-018**: El usuario MUST poder terminar la tarea mediante una declaración explícita de «completado», «bloqueado» o «fallido». Tras una declaración explícita, Zeko MUST cerrar la sesión del agente antes de registrar los cambios; si el agente está respondiendo, MUST pedir al usuario que elija entre cerrarlo de inmediato o esperar a que termine la respuesta. Una salida normal del agente desde la terminal MUST ser otra forma de terminarla y MUST registrar «completado» como declaración provisional. Zeko MUST usar como resumen del resultado la recap del modelo, es decir, la última respuesta completa del agente antes del cierre, obtenida de las funciones de conversación del propio agente y no de la salida visible de la terminal, sin solicitarla, modificarla ni exigir confirmación del usuario. Si no hay recap disponible, MUST indicar «recap no disponible» en el resumen y en el nodo. Zeko MUST conservar la recap como texto y MUST NOT interpretarla como datos estructurados, aunque contenga JSON.
- **FR-019**: Zeko MUST determinar y mostrar el estado final del nodo según las reglas generales del flujo, dando prioridad a cancelación, interrupción, corte del proceso, tiempo excedido y violaciones observadas por encima de «completado» declarado por el usuario.
- **FR-020**: Zeko MUST determinar los archivos modificados observando la copia aislada, mostrar discrepancias con cualquier declaración y marcar «bloqueado» un cambio fuera del alcance de rutas.
- **FR-021**: Si el nodo tiene activada la opción «requiere cambios» y el usuario declara «completado» sin cambios observados, Zeko MUST mostrar la inconsistencia en el nodo y el historial. MUST mostrar otras inconsistencias detectables entre declaración y observación.
- **FR-022**: Al terminar, Zeko MUST registrar los cambios de la copia aislada y producir un resultado con la misma forma que el de un nodo de agente: estado declarado, recap del modelo como resumen o indicación de ausencia, archivos observados, verificaciones, hallazgos, bloqueos, estado final y motivo. Las listas sin elementos MUST admitirse vacías. Si el nodo creó hijos, el resultado MUST incluir la lista de sus hijos con su estado final y su rama.
- **FR-023**: Los dependientes MUST recibir el resultado estructurado completo y, si el nodo interactivo terminó completado con cambios, MUST arrancar desde su estado de código registrado.
- **FR-023a**: Al reabrir un nodo interactivo, el run MUST volver a estar en curso si ya había terminado. Zeko MUST conservar el resultado anterior en el historial como reemplazado, cancelar sus dependientes activos e invalidar los resultados de todos los dependientes directos e indirectos afectados; las ramas independientes MUST conservar sus resultados. Al cerrarse de nuevo el nodo, Zeko MUST pedir confirmación explícita antes de reejecutar dependientes con el nuevo resultado; ningún dependiente MUST consumir el resultado reemplazado como vigente. Los hijos de un orquestador reabierto MUST conservar sus resultados.

**Coordinación, cancelación e historial**

- **FR-024**: Los dependientes MUST esperar a que el nodo interactivo termine completado; las ramas independientes MUST continuar. Si termina bloqueado, fallido o cancelado, los dependientes MUST quedar «omitidos» con motivo visible.
- **FR-025**: El usuario MUST poder cancelar el nodo desde el canvas o su vista. Zeko MUST detener la sesión y toda actividad asociada del agente, cancelar sus hijos activos y fijar «cancelado» como estado final.
- **FR-026**: Si Zeko se cierra durante una sesión activa, al volver MUST registrar el nodo y sus hijos activos como «interrumpidos», dejar sin procesos activos de sus agentes y marcar sus copias aisladas como «no confiables».
- **FR-027**: El historial MUST registrar quién declaró el fin o que la finalización ocurrió por salida normal del agente; también MUST registrar la recap disponible como resumen, estado declarado, estado final y motivo, duración, costo cuando el agente lo informe y archivos observados.
- **FR-028**: Zeko MUST guardar solo el resultado y los eventos del run, incluida la recap disponible que se use como resumen, y MUST NOT guardar una transcripción completa de la terminal ni el texto de los mensajes entre agentes. Todo contenido persistido o entregado a otro agente MUST redactarse antes, ocultando claves de API, credenciales y datos personales. La conservación y recuperación de conversaciones completas corresponde a las funciones propias del agente.
- **FR-029**: Al ejecutar sin interfaz un flujo que contiene uno o más nodos interactivos, Zeko MUST rechazarlo durante la validación, antes de iniciar el run, e identificar los nodos que requieren interfaz.

**Actividad del agente**

- **FR-030**: Zeko MUST conocer la actividad del agente de cada sesión interactiva (iniciando, esperando entrada, trabajando, esperando permiso, desconocida) a partir de los avisos que emite el propio agente o de sus archivos de sesión, nunca interpretando la pantalla de la terminal, y MUST mostrarla en el nodo.
- **FR-031**: La ausencia de avisos MUST tratarse como actividad «desconocida». Ninguna regla que dependa de la actividad (entrega de mensajes, avisos, cierre tras declaración) MUST suponer que un agente con actividad desconocida está esperando entrada.

**Enlaces y lectura**

- **FR-032**: El flujo MUST permitir declarar enlaces de contexto entre nodos, con dirección (los dos se leen, o solo uno lee al otro). Un nodo interactivo MUST quedar enlazado en lectura, sin declararlo, con sus predecesores directos y con sus hijos.
- **FR-033**: El agente de un nodo interactivo MUST poder, mediante herramientas de Zeko: listar sus enlaces; leer de cada nodo enlazado su estado, su resultado vigente y su actividad reciente (las últimas entradas de su conversación o de su actividad); y leer sus propias instrucciones y los resultados vigentes de sus predecesores.
- **FR-034**: La lectura MUST ser a pedido del agente. Lo leído MUST redactarse, entregarse marcado como datos de otro nodo y limitarse en tamaño.
- **FR-035**: Un nodo MUST NOT poder leer nodos no enlazados, nodos de otros runs ni, en la dirección no permitida, nodos con enlace de una sola dirección. Un resultado reemplazado MUST NOT entregarse como vigente.

**Mensajes entre agentes**

- **FR-036**: El flujo MUST permitir habilitar la mensajería, desactivada por defecto, e indicar qué enlaces la admiten.
- **FR-037**: El agente de un nodo interactivo con sesión activa MUST poder enviar un mensaje a un nodo interactivo con el que tenga un enlace con mensajería, y responder a un mensaje recibido. Zeko MUST escribir el mensaje en la terminal del destino como una única entrada, y solo cuando: la sesión del destino está activa; su agente está esperando entrada según FR-030; el usuario no dejó texto sin enviar en esa terminal; la recepción no está pausada; y no hay otra escritura en curso en esa terminal.
- **FR-038**: Si el destino no cumple esas condiciones, Zeko MUST encolar el mensaje en una cola por destino con capacidad y vencimiento acotados, y entregarlo cuando las cumpla, sin interrumpir al agente. Un mensaje encolado MUST entregarse solo en la misma sesión para la que se encoló. Si vence, la cola está llena o la sesión termina, Zeko MUST informar el motivo al remitente.
- **FR-039**: Cada mensaje MUST llegar enmarcado con un encabezado generado por Zeko que identifique al remitente y a quién responder, con una marca única por entrega que el remitente no conoce. El cuerpo MUST sanearse de secuencias de control.
- **FR-040**: Cada envío MUST devolver al remitente un resultado tipado (entregado, encolado, entregado sin acuse, rechazado con motivo, vencido, límite alcanzado) que indique si reintentar puede servir y cuándo. «Entregado» MUST significar que el destino empezó a procesar el mensaje.
- **FR-041**: Zeko MUST limitar los mensajes con un intervalo mínimo por par remitente→destino, un máximo por turno del remitente y un máximo total por nodo en el run.
- **FR-042**: El usuario MUST poder pausar y reanudar la recepción de mensajes de una sesión, ver en el nodo cuántos mensajes hay encolados y de quién (sin su texto) y descartarlos.
- **FR-043**: Un mensaje MUST tratarse como información de otro agente: MUST NOT alterar permisos, alcance, aprobaciones ni orquestación, y queda por debajo de las instrucciones del usuario.

**Orquestación**

- **FR-044**: Un nodo interactivo MUST poder habilitar la orquestación, desactivada por defecto, con: agentes permitidos para hijos, máximo de hijos en el run, límites máximos de tiempo y de turnos por hijo, y si cada lote requiere confirmación (activada por defecto).
- **FR-045**: El agente de un orquestador MUST poder pedir la creación de un lote de nodos hijos de agente no interactivo. Cada hijo lleva título, agente, modelo explícito, instrucciones, criterios de aceptación opcionales, alcance de rutas, dependencias opcionales con otros hijos del mismo lote y límites. El agente también MUST poder pedir solo la validación del lote, sin crear nada.
- **FR-046**: Zeko MUST rechazar el lote completo, sin crear nada, si algún hijo tiene un alcance que no está incluido en el del orquestador, un agente no permitido, un modelo faltante, límites mayores a los permitidos, o dependencias inexistentes o cíclicas, o si el lote supera el máximo de hijos. MUST informar cada motivo.
- **FR-047**: Con la confirmación activada, Zeko MUST mostrar al usuario el lote (agentes, modelos, alcances, límites, dependencias y superposiciones) y crear los hijos solo si el usuario lo confirma. El rechazo MUST informarse al agente como definitivo. Mientras espera la confirmación, el agente MUST recibir «pendiente de confirmación» sin quedar bloqueado.
- **FR-048**: Los hijos MUST ejecutarse como nodos de agente del run, con las mismas reglas de aislamiento, límites, concurrencia, permisos, resultado y cancelación que un nodo de agente. Los hijos MUST NOT disponer de herramientas para crear nodos ni enviar mensajes.
- **FR-049**: Cada hijo sin dependencias MUST partir de una instantánea del estado de código de la copia del orquestador en el momento de la creación del lote, y un hijo con dependencias MUST partir del resultado de su dependencia, con las reglas generales de linaje. Tomar la instantánea MUST NOT modificar la copia, la rama ni el historial del orquestador. Zeko MUST advertir si los alcances de hijos del mismo lote se superponen.
- **FR-050**: El agente orquestador MUST poder consultar el estado y el resultado de sus hijos y cancelar un hijo. Cuando un hijo termina, Zeko MUST avisarlo al orquestador con un aviso propio enmarcado, entregado con las mismas condiciones de FR-037 y FR-038, además de mostrarlo en el nodo.
- **FR-051**: Zeko MUST NOT integrar los cambios de un hijo en la copia del orquestador ni en ninguna otra. Si el agente o el usuario integran la rama de un hijo dentro de la copia del orquestador, Zeko MUST observarlo como cambios del orquestador y validarlo con su alcance.
- **FR-052**: Los hijos MUST verse en el canvas durante el run asociados a su orquestador y distinguibles de los nodos del flujo. MUST NOT agregarse al archivo del flujo salvo que el usuario elija «Guardar en el flujo», que los agrega como nodos de agente.
- **FR-053**: Cuando la sesión de un orquestador con hijos activos termina, Zeko MUST cancelar los hijos activos si la causa es cancelación o interrupción. En los demás casos MUST pedir al usuario que elija entre cancelarlos o dejarlos terminar. El resultado del orquestador MUST registrar los hijos que seguían activos.
- **FR-054**: Los hijos MUST NOT formar parte de las dependencias del flujo: los dependientes del orquestador consumen solo el resultado del orquestador, que lista sus hijos (FR-022).

**Identidad**

- **FR-055**: Zeko MUST aceptar avisos de actividad y pedidos de herramientas solo de los procesos que lanzó para cada sesión, identificados con una credencial propia de esa sesión. Un pedido sin credencial válida MUST rechazarse sin efecto y registrarse.

**Copias aisladas y archivos compartidos**

- **FR-056**: El proyecto MUST poder declarar rutas ignoradas por git (por ejemplo, dependencias instaladas) que Zeko hace visibles en cada copia aislada sin copiarlas. Zeko MUST mostrar en el nodo que esas rutas no están aisladas.

### Non-Functional Requirements

- **NFR-001**: El comportamiento descrito MUST funcionar en Windows.
- **NFR-002**: En sesiones activas, el texto que escribe el usuario MUST aparecer en la terminal en menos de 100 ms, medido desde la pulsación hasta su visualización, incluso con otros nodos en ejecución.
- **NFR-003**: La interfaz MUST mantener operables canvas y terminales con al menos cuatro sesiones interactivas abiertas y ocho nodos de agente no interactivos en ejecución simultánea.
- **NFR-004**: Desde la solicitud de cancelación hasta el cese de toda actividad asociada del agente MUST transcurrir menos de 10 segundos.
- **NFR-005**: El estado «esperando al usuario», la actividad del agente, los mensajes encolados, la confirmación de un lote de hijos y la acción para declarar el fin MUST ser visibles en el nodo o su vista principal sin abrir menús.
- **NFR-006**: Ningún agente interactivo MUST iniciar sin acción explícita del usuario. Ninguna salida de un agente ni ningún mensaje MUST interpretarse como orden de Zeko. Las herramientas de Zeko solo ejecutan lo que la configuración del nodo permite.
- **NFR-007**: Un mensaje dirigido a un destino que cumple las condiciones de entrega MUST escribirse en su terminal en menos de 2 segundos desde el envío.
- **NFR-008**: Emitir un aviso de actividad MUST NOT demorar al agente más de 500 ms. Si Zeko no responde, el agente MUST seguir funcionando.
- **NFR-009**: La comunicación MUST funcionar sin modificar los agentes ni la configuración global del usuario.
- **NFR-010**: Las herramientas de lectura MUST responder en menos de 2 segundos para nodos del mismo proyecto.

### Key Entities

- **Definición de nodo interactivo**: tipo, agente, modelo explícito, instrucciones opcionales, alcance de rutas, opción «requiere cambios» (desactivada por defecto), límite de tiempo obligatorio y finito, configuración de orquestación opcional y posición en el flujo; no contiene secretos.
- **Sesión interactiva**: conversación activa de un nodo en un run, con momento de apertura, duración, estado de actividad, copia aislada asociada, credencial propia y referencia a la conversación del agente que permite retomarla al reabrir el nodo, sin contener la transcripción.
- **Actividad del agente**: iniciando, esperando entrada, trabajando, esperando permiso o desconocida, con el momento del último aviso.
- **Declaración de fin**: origen manual o salida normal del agente, usuario cuando corresponda, estado declarado y momento.
- **Resumen del resultado**: recap del modelo, definida como la última respuesta completa del agente antes del cierre y obtenida de las funciones de conversación del propio agente; en su ausencia, indicación explícita de que no hay recap.
- **Resultado del nodo**: declaración, estado final y motivo, archivos observados, verificaciones, hallazgos, bloqueos, hijos y costo informado cuando exista; consumible por cualquier dependiente. Los resultados anteriores de un nodo reabierto quedan identificados como reemplazados.
- **Copia aislada**: estado de código y cambios propios del nodo, rama asociada y marca de confianza tras cancelación o interrupción.
- **Enlace de contexto**: par de nodos, dirección de lectura y si admite mensajes. Puede ser declarado en el flujo o implícito (predecesores directos, hijos).
- **Mensaje**: remitente, destino, respuesta a, momento, resultado de la entrega, tamaño y marca de entrega; su texto no se persiste.
- **Lote de hijos**: pedido de un orquestador con los hijos propuestos, su validación, la decisión del usuario y los hijos creados.
- **Nodo hijo**: nodo de agente del run con su orquestador, su instantánea de partida o su dependencia, su copia y su resultado.
- **Rutas compartidas**: rutas ignoradas por git que el proyecto declara visibles en cada copia sin aislarlas.
- **Historial del run**: resultado y eventos persistidos del nodo, incluidos cierres y reaperturas sucesivos, la recap usada como resumen, los envíos de mensajes y los lotes de hijos, sujetos a redacción antes de guardarse; no incluye transcripción completa ni texto de mensajes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En Windows, un usuario puede crear, guardar, reabrir y ejecutar un flujo con nodo interactivo, terminarlo y hacer que un sucesor consuma su resultado en un recorrido completo.
- **SC-002**: En el 100 % de los nodos interactivos, el agente comienza únicamente después de que el usuario abre expresamente su sesión.
- **SC-003**: El texto ingresado aparece en menos de 100 ms en todas las pulsaciones medidas durante la carga concurrente definida en NFR-003.
- **SC-004**: Con cuatro sesiones interactivas y ocho nodos no interactivos simultáneos, el usuario puede escribir, cambiar de terminal y operar el canvas sin bloqueo de la interfaz.
- **SC-005**: El 100 % de las cancelaciones detienen toda actividad asociada del agente en menos de 10 segundos.
- **SC-006**: En el 100 % de los resultados, la lista de archivos modificados coincide con lo observado en la copia aislada, y ningún cambio de un nodo ni de sus hijos afecta el repositorio original fuera de las rutas compartidas declaradas.
- **SC-007**: En una revisión de los datos persistidos de sesiones y de lo entregado a otros agentes, el 100 % de las claves, credenciales y datos personales detectables están ocultos.
- **SC-008**: En las pruebas de entrega, el 100 % de los mensajes entregados llegan enmarcados como una única entrada, y ninguno se escribe con el agente trabajando ni con texto del usuario sin enviar.
- **SC-009**: El 100 % de los lotes de hijos que exceden la configuración del orquestador se rechazan sin crear ningún nodo.
- **SC-010**: En el 100 % de los runs con hijos, la copia, rama e historial del orquestador no cambian por la creación ni la ejecución de sus hijos.
- **SC-011**: El 100 % de los pedidos sin credencial válida de sesión se rechazan sin efecto.

## Assumptions

- La versión descrita es local, para un usuario y repositorios de su máquina, conforme al alcance vigente de Zeko.
- El usuario dispone de Claude Code o Codex instalado y autenticado para cada nodo que configure; una falla de autenticación al abrir la sesión se muestra como falla del nodo.
- La definición del nodo y el historial del run son datos distintos: el flujo conserva configuración; el historial conserva resultados y eventos de ejecución. Los hijos son datos del run hasta que el usuario los guarda en el flujo.
- «Interrumpido» es un motivo visible de terminación no satisfactoria; no habilita a los dependientes.
- Las verificaciones, hallazgos y bloqueos pueden ser listas vacías cuando la sesión no aporta esa información.
- La regla FR-029 requiere tratar en la planificación su conflicto con el principio IV de la constitución vigente, que exige que todo flujo ejecutable desde el canvas también pueda ejecutarse desde la línea de comandos.
- En un nodo interactivo, el contexto conversacional del agente es lo que el usuario introduce en su terminal, lo que el agente lee con las herramientas de Zeko, los mensajes entregados y lo que el propio agente conserva en esa conversación.
- La disponibilidad de conversaciones anteriores, de avisos de actividad y de herramientas externas depende de las funciones del agente elegido; Zeko no promete almacenarlas ni reproducirlas y declara qué ofrece cada agente.
- La credencial de sesión eleva el costo de suplantar a otro nodo, pero no es una frontera de seguridad frente a procesos del mismo usuario del sistema que lean los archivos de Zeko. La frontera real son los límites de cada nodo: enlaces, mensajería, orquestación y alcance.
- Un mensaje entregado mientras el usuario empieza a escribir en el mismo instante no se puede excluir por completo; Zeko lo reduce comprobando la entrada pendiente justo antes de escribir y registra cada entrega para que el caso sea visible.

## Out of Scope

- Tomar el control de un nodo de agente no interactivo mientras se ejecuta.
- Grabar y reproducir sesiones.
- Compartir una sesión entre varios usuarios.
- Confinar realmente la terminal interactiva.
- Crear terminales sueltas fuera de un nodo de flujo.
- Recibir del agente interactivo un resultado estructurado (por ejemplo, JSON mediante MCP); en esta versión la recap es solo texto.
- Hijos interactivos, hijos que creen nodos (más de un nivel de orquestación) y orquestación desde nodos de agente no interactivos.
- Mensajes hacia o desde nodos de agente no interactivos.
- Ver la pantalla de la terminal de otro nodo como herramienta de lectura.
- Comunicación entre runs, proyectos o máquinas distintas.
- Integración automática de ramas (merge, rebase) por parte de Zeko.
