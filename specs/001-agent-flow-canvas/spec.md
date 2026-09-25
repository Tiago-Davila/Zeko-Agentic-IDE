# Feature Specification: Canvas de flujos de agentes CLI (primera versión de Zeko)

**Feature Branch**: `feature/001-desktop-app`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "Desarrollar la primera versión de Zeko que permita diseñar, guardar y
ejecutar flujos de agentes de código CLI sobre un repositorio local mediante un canvas de nodos."

## Objetivo

El usuario necesita coordinar varios agentes de código sobre un mismo proyecto sin perder control.
Debe poder armar visualmente qué agente hace qué, en qué orden o en paralelo, dónde se requiere su
aprobación, y ver en vivo el estado, el costo y el resultado real de cada paso, sin que los agentes
pisen el trabajo de otros ni actúen fuera del alcance asignado.

**Actores**

- **Usuario desarrollador**: abre un proyecto, arma flujos, los ejecuta, aprueba o rechaza pasos y
  revisa resultados.
- **Agente CLI**: herramienta externa, instalada y autenticada por el usuario, que ejecuta la tarea
  de un nodo. En esta versión se soportan Claude Code y Codex; el diseño permite agregar otros
  agentes más adelante.
- **Sistema Zeko**: valida flujos, ejecuta nodos respetando dependencias, aísla cambios, determina
  el resultado real de cada nodo, registra eventos y muestra estados.

## Clarifications

### Session 2026-09-22

- Q: ¿Linux y macOS son plataformas obligatorias en esta versión? → A: Windows y Linux son
  obligatorias; macOS queda para después.
- Q: Si un agente no puede confinar un nodo sin terminal, ¿se permite o se bloquea? → A: Se permite
  con una advertencia visible en el nodo.
- Q: Al rechazar un nodo de aprobación, ¿se detiene la rama o el run completo? → A: Solo la rama;
  las ramas independientes continúan.

### Session 2026-09-23

- Q: ¿Cuál es el valor por defecto del límite de concurrencia y es global o por agente? → A: Límite
  global por proyecto, por defecto 8, configurable; sin sub-límite por agente.
- Q: ¿Qué nivel de uso se considera "cerca del límite" y es configurable? → A: 90 % del uso
  informado por el agente, configurable por proyecto.
- Q: La copia aislada de un nodo cancelado, ¿se descarta automáticamente o se conserva? → A: Se
  conserva siempre, marcada como no confiable; solo se elimina con confirmación explícita.
- Q: ¿Zeko acepta Codex autenticado con cuenta de ChatGPT, clave de API o ambas? → A: Solo cuenta
  de ChatGPT; la clave de API queda fuera de alcance. *(Reemplazada en la sesión siguiente.)*
- Q: ¿En qué idioma se muestra la interfaz y hay selector de idioma? → A: Solo inglés, con los
  textos centralizados en un catálogo; sin selector de idioma.

### Session 2026-09-23 (revisión tras el spike técnico de Codex)

- Q: ¿Un nodo de Codex puede ejecutarse sin terminal? → A: No. Codex no puede leer archivos sin
  terminal, así que sus nodos siempre la tienen. Su confinamiento es solo de escritura: no puede
  escribir fuera de su copia aislada, pero sí leer fuera de ella.
- Q: ¿La lista de comandos permitidos aplica a Codex? → A: No en esta versión; solo a Claude Code.
- Q: ¿Cómo se aplica la regla de acción denegada a un agente que no informa denegaciones? → A: La
  regla aplica solo cuando el agente las informa. Para Codex, el nodo muestra que esa verificación
  no está disponible. *(Ampliada en la sesión 2026-09-24: denegaciones inferidas.)*
- Q: ¿Cómo se aplica el límite de turnos a Codex? → A: No se aplica; para Codex solo rige el límite
  de tiempo, y el nodo lo muestra.
- Q: ¿Zeko acepta Codex autenticado con cuenta de ChatGPT, clave de API o ambas? → A: Ambas. La
  cuenta de ChatGPT es la forma principal; la clave de API se soporta marcada como no verificada.
- Q: ¿Los nodos de Codex tienen acceso a red? → A: En Windows no; es una limitación visible del
  agente.

### Session 2026-09-23 (post-plan clarification)

- Q: En qué plataforma(s) debe validarse primero esta feature antes de comprometerse con Linux como plataforma igualmente soportada? → A: Windows first, then Linux in parallel. Windows es obligatorio con validación completa (spikes 001, 001b, quickstart manual). Linux se valida en paralelo durante implementación, pero no bloquea ship v1; cualquier incompatibilidad es tratada como hotfix post-v1.
- Q: ¿Debe la regla FR-008 (un solo predecesor que modifique código) aplicarse también a nodos de solo lectura, o solo a través de nodos de aprobación? → A: Solo a través de nodos de aprobación, como dice la spec. Esto simplifica la lógica de validación del grafo.
- Q: La comunicación entre agente y Zeko debe usar MCP (Principio VI) o puede diferirse usando stdout JSON + schema estricto (verificado en spikes)? → A: Diferir MCP a v1.1 (post-MVP). v1 usa stdout JSON verificado en `[001 §2, §5]` y `[001b §A]`. El servidor MCP se implementa en v1.1 cuando se agreguen Codex sin terminal (D-01) u otros agentes. Esto está documentado como excepción en Complexity Tracking.
- Q: Para nodos sin terminal con alcance de escritura parcial (ej. `src/**`), ¿implementar prevención activa o solo detección post-ejecución? → A: Detección solo en v1. Prevención requiere verificación de flags de Claude no probados (U-02). El nodo muestra advertencia `SCOPE_ENFORCEMENT_DETECTION_ONLY`. Prevención se implementa en v1.1 tras spike de U-02.
- Q: Cuando el usuario abre un flujo que se modificó en disco mientras estaba abierto en canvas, ¿mostrar diálogo de conflicto o solo rechazar guardar? → A: Alerta simple con dos botones: "Recargar" o "Descartar cambios locales". No merge en v1 (single-user). Agregar merge en v1.1 para colaboración futura. *(Reemplazada en la sesión 2026-09-24: "Recargar" o "Conservar mi versión".)*

### Session 2026-09-24 (revisión tras el spike 001c corregido)

- Q: ¿El nodo de agente define el modelo que usa, y qué pasa si no lo tiene? → A: Cada nodo de
  agente define modelo (y nivel de razonamiento si el agente lo admite), guardado por agente para
  conservarlo al cambiar de agente; al crear el nodo se copia el valor por defecto del proyecto.
  Zeko nunca usa el default del propio agente. Si un nodo no tiene modelo, como último recurso Zeko
  usa el valor por defecto del proyecto y lo avisa en el nodo, sin bloquear el run.
- Q: ¿Las fallas de infraestructura del agente (no de la tarea) consumen los reintentos del nodo?
  → A: No. Se relanzan aparte, hasta 2 veces, sin consumir los reintentos del nodo; el nodo muestra
  cada relanzamiento y, si se agotan, queda "fallido" con ese motivo.
- Q: ¿Los datos personales de la cuenta del agente (por ejemplo, su email) pueden quedar en el
  historial, los eventos o los registros? → A: No. Se ocultan antes de guardar, igual que secretos
  y credenciales, dejando visible que había un dato; la interfaz muestra la forma de autenticación,
  nunca la cuenta.
- Q: Las denegaciones que Zeko infiere para un agente que no las informa (Codex), ¿cambian el
  estado final del nodo? → A: No. Se registran y se muestran en el nodo marcadas como "inferidas",
  pero la regla de acción denegada sigue aplicando solo a agentes que informan denegaciones.
- Q: Si Zeko detecta que un nodo modificó archivos fuera de su alcance de rutas, ¿qué estado final
  tiene? → A: "Bloqueado", con la lista de archivos visible, con cualquier agente. Donde el alcance
  no se puede prevenir, se detecta al terminar observando la copia aislada.
- Q: Si el archivo de flujo cambia en disco mientras está abierto, ¿qué opciones tiene el usuario?
  → A: "Recargar" (toma la versión del disco) o "Conservar mi versión" (guarda la del canvas sobre
  la del disco, por decisión explícita). Nunca se sobrescribe en silencio; sin merge en v1.

### Session 2026-09-24 (post-analyze)

- Q: Si un agente no ofrece una forma sin costo de verificar su autenticación (hoy, Claude Code),
  ¿cómo se cumple la verificación previa? → A: La instalación se verifica siempre. La autenticación
  se verifica cuando el agente ofrece un chequeo sin costo; si no, la verificación previa la muestra
  como "no verificada" y permite iniciar el run. Si al ejecutar falla la autenticación, el nodo
  queda "fallido" con ese motivo.
- Q: Con una lista de comandos permitidos, ¿qué pasa con los comandos de solo lectura que el agente
  aprueba por su cuenta aunque no estén en la lista? → A: Pueden ejecutarse. Se deniegan los
  comandos que no están en la lista, salvo los que el agente clasifica como de solo lectura, y el
  nodo muestra esa excepción como advertencia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir un proyecto y diseñar un flujo guardado (Priority: P1)

El usuario abre una carpeta de su máquina como proyecto, crea un flujo, agrega un nodo de entrada y
nodos de agente, los conecta para expresar dependencias y lo guarda. El flujo queda como un archivo
de texto legible dentro del repositorio y, al reabrirlo, el canvas se reconstruye igual.

**Why this priority**: sin proyecto y sin flujos persistidos no hay nada que ejecutar; es la base
de todas las demás historias.

**Independent Test**: abrir un repositorio, crear un flujo de tres nodos, guardarlo, cerrar y
reabrir la aplicación, y comprobar que el canvas es idéntico y que el archivo es legible.

**Acceptance Scenarios**:

1. **Dado** una carpeta que es un repositorio git, **Cuando** el usuario la abre como proyecto,
   **Entonces** Zeko la carga y lista los flujos existentes del proyecto.
2. **Dado** una carpeta que no es un repositorio git, **Cuando** el usuario intenta abrirla,
   **Entonces** Zeko informa claramente que debe ser un repositorio git y no continúa.
3. **Dado** un flujo con los nodos A → B, **Cuando** el usuario intenta conectar B → A,
   **Entonces** la conexión se impide y se explica que crearía un ciclo.
4. **Dado** un nodo de agente C conectado a dos nodos de agente A y B que pueden modificar código,
   **Cuando** se valida el flujo, **Entonces** C muestra un error que explica que no puede depender
   de más de un predecesor que modifique código.
5. **Dado** un flujo guardado, **Cuando** el usuario lo reabre, **Entonces** nodos, conexiones,
   configuración y posiciones son idénticos a los guardados.
6. **Dado** un archivo de flujo editado a mano con cambios válidos, **Cuando** el usuario lo
   reabre, **Entonces** el canvas refleja esos cambios.
7. **Dado** un archivo de flujo inválido, **Cuando** el usuario lo abre, **Entonces** Zeko muestra
   errores claros, no modifica ni borra el archivo y la aplicación sigue funcionando.

---

### User Story 2 - Ejecutar un flujo y conocer el resultado real de cada nodo (Priority: P1)

El usuario inicia un run de un flujo válido. Zeko verifica que los agentes necesarios estén
disponibles, ejecuta los nodos respetando dependencias y en paralelo cuando es posible, cada uno en
su propia copia aislada del repositorio. El usuario ve estado y salida en vivo, puede cancelar, y al
terminar cada nodo ve un estado final determinado por Zeko con su motivo y los cambios producidos.

**Why this priority**: es la propuesta de valor central: coordinar agentes sin perder control.
Junto con la Historia 1 forma el MVP mínimo.

**Independent Test**: ejecutar un flujo entrada → agente A → agente B con un solo agente CLI,
comprobar estados en vivo, que B arranca desde los cambios de A, que el repositorio original no
cambia y que el estado final y su motivo son visibles en cada nodo.

**Acceptance Scenarios**:

1. **Dado** un flujo válido cuyos agentes están instalados y autenticados, **Cuando** el usuario
   inicia un run, **Entonces** los nodos sin predecesores pendientes se ejecutan y su estado cambia
   a "ejecutando" en el canvas.
2. **Dado** un flujo que usa un agente no instalado, o no autenticado según un chequeo que el
   agente ofrece, **Cuando** el usuario inicia un run, **Entonces** Zeko informa qué agentes faltan
   y no inicia el run. Si el agente no ofrece ese chequeo, su autenticación figura como "no
   verificada" y el run puede iniciarse.
3. **Dado** dos nodos sin dependencia entre sí y concurrencia disponible, **Cuando** ambos quedan
   listos, **Entonces** se ejecutan en paralelo.
4. **Dado** un nodo de agente en ejecución, **Cuando** el usuario lo selecciona, **Entonces** ve su
   salida en vivo.
5. **Dado** un nodo en ejecución, **Cuando** el usuario lo cancela, **Entonces** el nodo pasa a
   "cancelado", no queda ningún proceso del agente activo y sus dependientes pasan a "omitido".
6. **Dado** un nodo A que falla, **Cuando** el run continúa, **Entonces** los dependientes de A
   quedan "omitidos" con el motivo visible y las ramas independientes siguen ejecutándose.
7. **Dado** un agente que declara "completado" pero lista bloqueos, **Cuando** termina, **Entonces**
   el nodo queda "bloqueado" y se muestra la inconsistencia.
8. **Dado** un agente que informa denegaciones y declara "completado" pero al que se le denegó una
   acción durante la ejecución, **Cuando** termina, **Entonces** el nodo queda "bloqueado" con la
   acción denegada visible. Si el agente no informa denegaciones, el nodo muestra que esa
   verificación no está disponible, y las denegaciones que Zeko infiera se muestran como
   "inferidas" sin cambiar el estado final.
9. **Dado** un agente que termina sin entregar reporte, **Cuando** Zeko se lo pide una segunda vez y
   tampoco lo entrega, **Entonces** el nodo queda "fallido" con ese motivo.
10. **Dado** un agente cuyo reporte lista archivos distintos de los realmente modificados en su
    copia aislada, **Cuando** termina, **Entonces** el nodo muestra la discrepancia.
11. **Dado** un nodo que supera su tiempo máximo o, si su agente admite límite de turnos, su límite
    de turnos, **Cuando** se alcanza el límite, **Entonces** Zeko detiene la ejecución y el nodo
    queda "fallido" sin importar el reporte.
12. **Dado** un nodo A que modificó código y un nodo B que depende de A, **Cuando** B se ejecuta,
    **Entonces** B parte del estado de código que dejó A y recibe el resultado completo de A.
13. **Dado** un run terminado, **Cuando** el usuario inspecciona el repositorio original,
    **Entonces** sus archivos, rama actual y cambios pendientes no fueron alterados, y puede ver
    los cambios producidos por cada nodo.

---

### User Story 3 - Aprobación humana en puntos de control (Priority: P2)

El usuario coloca un nodo de aprobación entre pasos. Cuando la ejecución llega a él, su rama se
pausa y el usuario ve un resumen de lo producido por los predecesores para aprobar o rechazar.

**Why this priority**: da control explícito sobre pasos sensibles; el MVP puede operar sin él pero
es clave para confiar en flujos largos.

**Independent Test**: ejecutar entrada → agente → aprobación → agente, aprobar una vez y rechazar
en otra ejecución, verificando el comportamiento de los dependientes.

**Acceptance Scenarios**:

1. **Dado** un run que llega a un nodo de aprobación, **Cuando** sus predecesores terminan
   completados, **Entonces** el nodo pasa a "esperando aprobación" y muestra un resumen de lo
   producido por sus predecesores.
2. **Dado** un nodo esperando aprobación, **Cuando** el usuario aprueba, **Entonces** el nodo queda
   "aprobado" y sus dependientes pueden ejecutarse.
3. **Dado** un nodo esperando aprobación, **Cuando** el usuario rechaza, **Entonces** sus
   dependientes quedan "omitidos" con el motivo "rechazado por el usuario" y las ramas
   independientes siguen ejecutándose.
4. **Dado** una rama pausada esperando aprobación, **Cuando** otra rama independiente tiene nodos
   listos, **Entonces** esa rama sigue ejecutándose.

---

### User Story 4 - Combinar Claude Code y Codex en un mismo flujo (Priority: P2)

El usuario arma un flujo donde un agente implementa y otro, de un proveedor distinto, revisa los
cambios. Cada nodo recibe el resultado completo del anterior con la misma forma, sin importar qué
agente lo produjo.

**Why this priority**: combinar agentes es un diferenciador de Zeko, pero requiere que la ejecución
con un solo agente (Historia 2) funcione primero.

**Independent Test**: ejecutar entrada → implementación (Claude Code) → revisión (Codex) y verificar
que la revisión ve los cambios y el reporte completo de la implementación.

**Acceptance Scenarios**:

1. **Dado** un flujo con nodos de Claude Code y de Codex, **Cuando** se valida, **Entonces** es
   válido si cumple las reglas de dependencias.
2. **Dado** un nodo de Codex que depende de uno de Claude Code que modificó código, **Cuando** se
   ejecuta, **Entonces** parte de los cambios de ese nodo y recibe su resultado completo.
3. **Dado** un nodo de agente configurado, **Cuando** el usuario cambia su agente, **Entonces** se
   conservan instrucciones, criterios, alcance, terminal y límites, el modelo de cada agente queda
   guardado para recuperarlo al volver, y el nodo indica qué opciones no aplican al nuevo agente.
4. **Dado** reportes de ambos agentes, **Cuando** el usuario los inspecciona, **Entonces** tienen la
   misma forma y los mismos campos.

---

### User Story 5 - Controlar terminal y confinamiento de cada nodo (Priority: P2)

Por defecto un nodo de Claude Code solo puede leer y modificar archivos dentro de su alcance, sin
terminal. El usuario puede habilitar la terminal de forma explícita. Un nodo de Codex siempre tiene
terminal y solo está confinado en escritura. El usuario ve siempre el nivel real de confinamiento
de cada nodo según su agente y configuración.

**Why this priority**: es la garantía de seguridad que permite delegar trabajo a agentes sin
supervisión continua.

**Independent Test**: configurar un nodo sin terminal y otro con terminal, verificar los indicadores
de confinamiento, y comprobar que el nodo sin terminal no puede leer ni escribir fuera de su copia
aislada, ni siquiera con rutas relativas o enlaces.

**Acceptance Scenarios**:

1. **Dado** un nodo de Claude Code nuevo, **Cuando** el usuario lo agrega, **Entonces** la terminal
   está deshabilitada.
2. **Dado** un nodo sin terminal cuyo agente permite confinamiento, **Cuando** el agente intenta
   leer o escribir fuera de su copia aislada, incluso con rutas relativas o enlaces, **Entonces** la
   acción se deniega y queda registrada en el nodo.
3. **Dado** un nodo, **Cuando** el agente modifica un archivo fuera de su alcance de rutas,
   **Entonces** la modificación se deniega o, donde no se puede prevenir, se detecta al terminar; en
   ambos casos queda registrada y el nodo queda "bloqueado" con los archivos visibles.
4. **Dado** un nodo con terminal habilitada, **Cuando** el usuario lo ve en el canvas,
   **Entonces** el nodo se muestra como "no confinado" con el motivo.
5. **Dado** un nodo sin terminal con un agente que no garantiza confinamiento, **Cuando** el usuario
   lo ve en el canvas, **Entonces** se muestra como "no confinado" indicando que es por el agente.
6. **Dado** un nodo sin terminal con un agente que no garantiza confinamiento, **Cuando** el usuario
   inicia un run, **Entonces** el nodo se ejecuta y la advertencia de "no confinado" sigue visible
   en el nodo durante y después de la ejecución.
7. **Dado** un nodo de Codex, **Cuando** el usuario lo ve en el canvas, **Entonces** la terminal
   figura siempre habilitada, sin opción de deshabilitarla ni de indicar comandos permitidos, y el
   nodo se muestra como "confinado solo en escritura", indicando que puede leer fuera de su copia
   aislada.
8. **Dado** un nodo de Codex, **Cuando** el agente intenta escribir fuera de su copia aislada,
   incluso con rutas relativas, enlaces o comandos, **Entonces** la escritura no ocurre.

---

### User Story 6 - Ver costo y cuidar el uso de la suscripción (Priority: P2)

El usuario ve el costo y consumo de cada nodo y el total del run, y el nivel de uso de la
suscripción de cada agente. Si un agente se acerca a su límite, Zeko deja de lanzar nodos de ese
agente en lugar de dejarlos fallar.

**Why this priority**: los agentes consumen la suscripción del usuario; sin visibilidad, los flujos
paralelos pueden agotarla sin aviso.

**Independent Test**: ejecutar un flujo con ambos agentes y verificar costos por nodo, total del
run, datos no disponibles marcados como tales, y la retención de nodos al simular uso cercano al
límite.

**Acceptance Scenarios**:

1. **Dado** un nodo terminado cuyo agente informa costo y consumo, **Cuando** el usuario lo ve,
   **Entonces** se muestran ambos valores; el run muestra el total.
2. **Dado** un agente que no informa costo en dinero, **Cuando** el nodo termina, **Entonces** el
   costo se muestra como "no disponible" y el total del run indica que es parcial.
3. **Dado** un agente cuyo uso de suscripción supera el umbral de "cerca del límite",
   **Cuando** un nodo de ese agente queda listo, **Entonces** Zeko no lo lanza, lo informa en el
   nodo, y los nodos de otros agentes siguen ejecutándose.

---

### User Story 7 - Ejecutar un flujo desde la línea de comandos (Priority: P3)

El usuario ejecuta un flujo guardado desde la línea de comandos y obtiene el mismo comportamiento
que en el canvas, con estado, motivo y costo por nodo.

**Why this priority**: permite automatizar y verifica que el motor no depende de la interfaz, pero
el uso principal es el canvas.

**Independent Test**: ejecutar el mismo flujo desde el canvas y desde la línea de comandos y
comparar estados finales, motivos y registro en el historial.

**Acceptance Scenarios**:

1. **Dado** un flujo guardado válido, **Cuando** el usuario lo ejecuta desde la línea de comandos,
   **Entonces** se aplican las mismas validaciones, reglas de ejecución y de estado final que en el
   canvas.
2. **Dado** un run desde la línea de comandos, **Cuando** termina, **Entonces** se informa estado,
   motivo y costo por nodo, y el run aparece en el historial.
3. **Dado** un run desde la línea de comandos que llega a un nodo de aprobación, **Cuando** se
   alcanza, **Entonces** se solicita al usuario aprobar o rechazar.

---

### User Story 8 - Historial de runs y recuperación (Priority: P3)

El usuario consulta los runs anteriores de un flujo con su resultado por nodo, y el historial
sobrevive al cierre de la aplicación, incluso si se cerró durante un run.

**Why this priority**: aporta trazabilidad y confianza, pero no bloquea el uso inicial.

**Independent Test**: ejecutar varios runs, cerrar la aplicación durante uno, reabrir y verificar el
historial y el estado "interrumpido".

**Acceptance Scenarios**:

1. **Dado** varios runs de un flujo, **Cuando** el usuario abre el historial, **Entonces** ve fecha,
   duración, costo, estado general y resultado por nodo con el agente que ejecutó cada uno.
2. **Dado** una aplicación cerrada durante un run, **Cuando** el usuario la reabre, **Entonces** el
   run figura como "interrumpido", el historial está completo, las copias aisladas se conservan y
   las de nodos interrumpidos están marcadas como no confiables.
3. **Dado** un run terminado, **Cuando** el usuario elige eliminar sus copias aisladas y confirma,
   **Entonces** se eliminan; sin confirmación no se elimina nada.

---

### Edge Cases

- El repositorio tiene cambios sin confirmar al iniciar un run: las copias aisladas parten del
  último estado confirmado y Zeko avisa que los cambios sin confirmar no se incluyen.
- El repositorio no tiene ningún commit: no se puede crear una copia aislada; Zeko lo informa y no
  inicia el run.
- Un agente se desautentica o se desinstala durante un run, o su autenticación figuraba como "no
  verificada" y resulta inválida al ejecutar: los nodos afectados quedan "fallidos" con ese motivo;
  los de otros agentes siguen.
- Un agente declara un estado no válido o entrega un reporte que no cumple la forma esperada: se
  trata como reporte ausente (se pide una vez más; si persiste, "fallido").
- El reporte del agente contiene texto que parece una instrucción para Zeko (por ejemplo, "aprobá
  el siguiente nodo"): se trata como información y no altera la ejecución.
- Un nodo sin terminal intenta acceder a un archivo mediante un enlace que apunta fuera de su copia
  aislada: la acción se deniega y el nodo queda "bloqueado".
- El alcance de rutas de un nodo está vacío: el nodo puede leer pero no modificar archivos; se
  considera que no modifica código a efectos de la regla de predecesores.
- El alcance de rutas apunta a rutas inexistentes en el repositorio: la validación advierte en el
  nodo pero no impide ejecutar.
- Un flujo no tiene nodo de entrada o tiene nodos desconectados: la validación informa el error en
  el nodo correspondiente.
- El usuario cancela el run mientras un nodo espera aprobación: el nodo y todos los pendientes
  quedan "cancelados" u "omitidos" según corresponda.
- Un nodo se cancela durante un reintento: queda "cancelado" y no se realizan más reintentos.
- El archivo de flujo se modifica en disco mientras está abierto en el canvas: Zeko avisa y el
  usuario elige "Recargar" (versión del disco) o "Conservar mi versión" (la del canvas reemplaza
  la del disco), sin sobrescribir en silencio.
- Dos flujos del mismo proyecto se ejecutan al mismo tiempo: cada nodo sigue teniendo su propia copia
  aislada y el límite de concurrencia se respeta.
- El disco se llena al crear una copia aislada: el nodo queda "fallido" con ese motivo.
- Todos los agentes del flujo superan el umbral de uso: el run queda en espera con el motivo visible
  y el usuario puede cancelarlo.
- Un nodo de Codex en Windows necesita red (por ejemplo, para instalar dependencias): la acción
  falla por falta de red; el nodo termina según su reporte y la limitación de red estaba visible en
  el nodo desde antes de ejecutarlo (FR-066).
- Un nodo de agente no tiene modelo para su agente (por ejemplo, un archivo editado a mano): el run
  no se bloquea; Zeko usa el modelo por defecto del proyecto, lo advierte en el nodo y lo registra
  en el run (FR-011a).
- El agente no acepta el modelo configurado: la ejecución termina con error y el nodo queda
  "fallido" con ese motivo (FR-036).
- Un nodo de Codex supera el umbral de uso de la suscripción mientras se ejecuta: el nodo en curso
  termina normalmente; la retención (FR-053) aplica a los nodos que se lanzan después.

## Requirements *(mandatory)*

### Functional Requirements

**Proyecto**

- **FR-001**: El sistema MUST permitir abrir una carpeta local como proyecto.
- **FR-002**: El sistema MUST verificar que la carpeta sea un repositorio git y, si no lo es,
  informarlo claramente y no continuar.
- **FR-003**: El sistema MUST listar los flujos existentes del proyecto.

**Edición de flujos**

- **FR-004**: Los usuarios MUST poder crear, nombrar, abrir y eliminar flujos; la eliminación
  requiere confirmación.
- **FR-005**: Los usuarios MUST poder agregar, mover, configurar, conectar y eliminar nodos.
- **FR-006**: Una conexión entre nodos MUST significar "el nodo destino depende del nodo origen".
- **FR-007**: El sistema MUST impedir crear conexiones que formen un ciclo y explicar el motivo.
- **FR-008**: El sistema MUST marcar como error de validación, explicado en el nodo, que un nodo de
  agente dependa de más de un predecesor que modifique código. Un nodo modifica código si es un
  nodo de agente con alcance de escritura no vacío, o si hereda código modificado a través de un
  nodo de aprobación.
- **FR-009**: El sistema MUST validar el flujo antes de ejecutarlo, mostrar cada error en el nodo
  correspondiente e impedir iniciar un run con errores.

**Tipos de nodo**

- **FR-010**: El nodo de entrada MUST definir el objetivo inicial del run, que se entrega como
  contexto a los nodos que dependen de él.
- **FR-011**: El nodo de agente MUST configurarse con: agente CLI (Claude Code o Codex), modelo
  (y nivel de razonamiento cuando el agente lo admite), instrucciones de la tarea, criterios de
  aceptación, alcance de rutas que puede modificar, uso de terminal (con lista opcional de comandos
  permitidos) y límites de tiempo máximo, turnos y reintentos. Todo nodo nuevo recibe límites por
  defecto finitos y el modelo por defecto del proyecto para su agente. Las opciones que el agente
  del nodo no admite (FR-017, FR-018, FR-032) MUST mostrarse como no aplicables para ese agente.
- **FR-011a**: Zeko MUST indicar a cada agente, en cada ejecución, el modelo del nodo de forma
  explícita y MUST NOT usar el modelo por defecto del propio agente. Si un nodo no tiene modelo
  para su agente, Zeko MUST usar el modelo por defecto del proyecto como último recurso, mostrar
  una advertencia en el nodo y registrar en el run el modelo usado.
- **FR-012**: El nodo de aprobación humana MUST pausar su rama hasta que el usuario apruebe o
  rechace, mostrando un resumen de lo producido por sus predecesores.

**Flujos con varios agentes**

- **FR-013**: Un flujo MUST poder combinar nodos de Claude Code y de Codex.
- **FR-014**: Un nodo MUST poder depender de un nodo ejecutado por un agente distinto.
- **FR-015**: Cambiar el agente de un nodo MUST conservar el resto de su configuración. Si alguna
  opción conservada no aplica al nuevo agente, el nodo MUST indicarlo; volver al agente anterior la
  recupera sin cambios. El modelo se guarda por agente: al volver al agente anterior se recupera su
  modelo.
- **FR-016**: Las reglas de validación, ejecución, estado final y paso de resultados MUST ser las
  mismas para todos los agentes; agregar un agente nuevo en el futuro no debe cambiarlas.

**Terminal y confinamiento**

- **FR-017**: Por defecto, un nodo de Claude Code MUST NOT poder ejecutar comandos de terminal y
  solo puede modificar archivos dentro de su alcance de rutas. Un nodo de Codex MUST ejecutarse
  siempre con terminal, porque ese agente no puede leer archivos sin ella; para Codex no existe la
  opción de deshabilitarla. Cuando el agente no puede impedir una escritura fuera del alcance de
  rutas, Zeko MUST detectarla al terminar el nodo (FR-037).
- **FR-018**: En los nodos de Claude Code, los usuarios MUST poder habilitar la terminal de forma
  explícita, indicando opcionalmente la lista de comandos permitidos; si se indica, los demás
  comandos se deniegan, salvo los que el agente clasifica como de solo lectura, que pueden
  ejecutarse aunque no estén en la lista. El nodo MUST mostrar esa excepción como advertencia antes,
  durante y después de la ejecución. La lista de comandos permitidos no está disponible para Codex en esta
  versión, y el nodo MUST mostrarla como no aplicable.
- **FR-019**: Un nodo de Claude Code sin terminal MUST quedar confinado: no puede leer ni escribir
  fuera de su copia aislada, incluso mediante rutas relativas o enlaces. Un nodo de Codex MUST
  quedar confinado solo en escritura: no puede escribir fuera de su copia aislada, incluso mediante
  rutas relativas, enlaces o comandos, pero puede leer archivos fuera de ella.
- **FR-020**: Un nodo de Claude Code con terminal, o ejecutado por un agente que no garantiza
  confinamiento, MUST considerarse no confinado. Un nodo de Codex MUST considerarse "confinado solo
  en escritura".
- **FR-021**: El canvas MUST mostrar en cada nodo su nivel real de confinamiento ("confinado",
  "confinado solo en escritura" o "no confinado") y el motivo cuando no está confinado por
  completo. Para un nodo "confinado solo en escritura", el motivo MUST indicar que puede leer fuera
  de su copia aislada.
- **FR-022**: Cuando un agente no puede confinar un nodo sin terminal, el sistema MUST permitir
  ejecutarlo mostrando una advertencia visible de "no confinado" en el nodo, antes, durante y
  después de la ejecución y en el historial del run.
- **FR-023**: Toda acción denegada que el agente informe (fuera de alcance, fuera de la copia
  aislada o comando no permitido) MUST quedar registrada y visible en el nodo. Cuando el agente no
  informa denegaciones, como Codex, el nodo MUST mostrar que la verificación de acciones denegadas
  no está disponible para ese agente, antes, durante y después de la ejecución. Las denegaciones
  que Zeko infiera de la salida de ese agente MUST registrarse y mostrarse en el nodo marcadas como
  "inferidas", y MUST NOT cambiar el estado final (FR-036, regla 4).

**Ejecución**

- **FR-024**: Un run MUST iniciarse solo por acción explícita del usuario y solo sobre un flujo
  válido.
- **FR-025**: Antes de iniciar, el sistema MUST verificar que cada agente CLI requerido esté
  instalado, informar cuáles faltan y no iniciar el run si falta alguno. También MUST verificar que
  esté autenticado cuando el agente ofrezca un chequeo que no consuma su uso, y no iniciar el run si
  no lo está. Si el agente no ofrece ese chequeo, la verificación previa MUST mostrar la
  autenticación de ese agente como "no verificada" y permitir iniciar el run; un fallo de
  autenticación durante la ejecución deja el nodo "fallido" con ese motivo.
- **FR-026**: Un nodo MUST ejecutarse solo cuando todos sus predecesores terminaron "completados" o
  "aprobados".
- **FR-027**: Los nodos sin dependencia entre sí MUST ejecutarse en paralelo respetando un único
  límite de concurrencia global por proyecto, con valor por defecto 8 y configurable por el
  usuario. El sistema MUST NOT aplicar sub-límites por agente; la retención por uso de suscripción
  (FR-053) es el único control específico por agente.
- **FR-028**: El sistema MUST mostrar en tiempo real el estado de cada nodo: pendiente, ejecutando,
  esperando aprobación, aprobado, completado, bloqueado, fallido, cancelado u omitido.
- **FR-029**: El sistema MUST mostrar la salida en vivo de cada nodo de agente.
- **FR-030**: Los usuarios MUST poder cancelar un run completo o un nodo individual; una
  cancelación MUST NOT dejar procesos del agente ejecutándose, incluidos los comandos que el agente
  haya lanzado. Cuando el agente no ofrece una interrupción ordenada, como Codex, la cancelación
  MUST detener el agente y todos sus procesos de forma forzada, y el nodo queda "cancelado" por
  decisión de Zeko sin esperar confirmación ni reporte del agente.
- **FR-031**: Si un nodo queda bloqueado, fallido, cancelado o rechazado, sus dependientes (directos
  e indirectos) MUST NOT ejecutarse y MUST quedar "omitidos" con el motivo; las ramas independientes
  continúan. Al rechazar un nodo de aprobación, el sistema MUST detener solo la rama del nodo
  rechazado; el resto del run continúa.
- **FR-032**: El sistema MUST aplicar los límites de tiempo, turnos y reintentos de cada nodo;
  superar tiempo o turnos detiene la ejecución. Los reintentos se aplican solo cuando la ejecución
  termina con error y nunca superan el límite configurado. Una falla de infraestructura del agente
  (el agente no pudo ejecutar la tarea por un problema de su entorno, por ejemplo al crear
  procesos, aunque haya terminado sin error aparente) MUST NOT consumir esos reintentos: el nodo se
  relanza desde el mismo estado inicial hasta 2 veces, cada relanzamiento es visible en el nodo y,
  si se agotan, el nodo queda "fallido" con ese motivo. El límite de turnos aplica solo a los
  agentes que lo admiten; para Codex solo rigen los límites de tiempo y reintentos, y el nodo MUST
  mostrar que el límite de turnos no aplica.

**Resultado de cada nodo**

- **FR-033**: Cada agente MUST entregar un reporte estructurado con estado declarado (completado,
  bloqueado o fallido), resumen, archivos modificados, verificaciones realizadas y bloqueos.
- **FR-034**: El reporte MUST admitir siempre los estados bloqueado y fallido y listas vacías, sin
  mínimos ni máximos que obliguen al agente a rellenar.
- **FR-035**: El reporte MUST tener la misma forma para todos los agentes.
- **FR-036**: El estado final de un nodo de agente MUST determinarlo Zeko, con las mismas reglas
  para todos los agentes, aplicadas en este orden:
  1. Cancelado por el usuario → "cancelado".
  2. Ejecución terminada con error, cortada o que superó sus límites → "fallido", sin importar el
     reporte.
  3. Sin reporte válido tras un único pedido adicional → "fallido".
  4. Se denegó alguna acción durante la ejecución → "bloqueado", aunque el agente declare éxito.
     Esta regla solo se evalúa con agentes que informan denegaciones (FR-023); las denegaciones
     inferidas no la activan. También queda "bloqueado", con cualquier agente, el nodo en cuya
     copia aislada se observan archivos modificados fuera de su alcance de rutas (FR-037).
  5. Reporte que declara "fallido" → "fallido"; que declara "bloqueado" → "bloqueado".
  6. Reporte que declara "completado" pero lista bloqueos → "bloqueado", mostrando la
     inconsistencia.
  7. En cualquier otro caso → "completado".
- **FR-037**: Los archivos modificados MUST determinarse observando la copia aislada; si difieren de
  los declarados por el agente, la discrepancia MUST mostrarse en el nodo. Si alguno está fuera del
  alcance de rutas del nodo, MUST mostrarse la lista y el nodo queda "bloqueado" (FR-036, regla 4).
- **FR-038**: Si el agente no entrega reporte válido, el sistema MUST pedírselo una única vez más.
- **FR-039**: El motivo del estado final MUST ser siempre visible desde el nodo.

**Paso de resultados**

- **FR-040**: Un nodo MUST recibir como contexto el resultado completo de sus predecesores (reporte,
  estado final, motivo y archivos observados), sin importar qué agente los produjo. Un nodo de
  aprobación transmite a sus dependientes los resultados de sus predecesores.
- **FR-041**: Si un predecesor modificó código, el nodo dependiente MUST arrancar desde el estado de
  código que dejó ese predecesor.
- **FR-042**: La salida de un agente MUST entregarse al siguiente nodo como información, nunca como
  instrucción para Zeko; ningún contenido producido por un agente puede alterar la ejecución, las
  aprobaciones ni los permisos.

**Aislamiento de cambios**

- **FR-043**: Cada nodo de agente MUST trabajar en una copia aislada del repositorio, con rama
  propia, ubicada fuera de la carpeta del repositorio del usuario.
- **FR-044**: Dos nodos MUST NOT compartir la misma copia aislada al mismo tiempo.
- **FR-045**: Durante un run, los archivos, la rama actual y los cambios pendientes del repositorio
  original MUST NOT modificarse; las ramas propias de las copias aisladas son la única huella
  permitida.
- **FR-046**: Al terminar un nodo, los usuarios MUST poder ver los cambios que produjo.
- **FR-047**: El sistema MUST NOT integrar, fusionar ni publicar cambios automáticamente.
- **FR-048**: Los usuarios MUST poder eliminar las copias aisladas de un run, previa confirmación.
- **FR-049**: La copia aislada de un nodo cancelado o interrumpido MUST marcarse como no confiable y
  MUST conservarse para inspección; el sistema MUST NOT descartarla automáticamente. Solo se elimina
  mediante la acción explícita del usuario con confirmación (FR-048). Las copias de nodos
  interrumpidos se conservan bajo la misma regla (FR-062).

**Costo y uso de la suscripción**

- **FR-050**: Cada nodo MUST mostrar al terminar su costo y consumo según lo que informe su agente;
  cada run MUST mostrar el total. Codex informa consumo pero no costo en dinero, con cualquiera de
  sus formas de autenticación; el costo de sus nodos se muestra como "no disponible" y el total del
  run que los incluya, como parcial (FR-051).
- **FR-051**: Un dato que el agente no informe MUST mostrarse como "no disponible"; un total que
  incluya datos no disponibles MUST indicarse como parcial; nunca se muestra un valor estimado sin
  marcarlo como estimado.
- **FR-052**: El sistema MUST mostrar el nivel de uso de la suscripción de cada agente cuando el
  agente lo informe, junto con el momento de la última lectura. Codex no informa su uso mientras
  un nodo se ejecuta: su nivel se actualiza al terminar cada nodo de ese agente, o al consultarlo
  antes de lanzar uno, y el canvas MUST indicar que no es un valor en vivo.
- **FR-053**: Cuando el uso de la suscripción de un agente supere el umbral de "cerca del límite",
  el sistema MUST NOT lanzar nuevos nodos de ese agente, MUST informarlo en esos nodos (que quedan
  pendientes con el motivo visible) y MUST permitir que sigan los nodos de otros agentes. El umbral
  de "cerca del límite" MUST ser 90 % del uso informado por el agente, configurable por proyecto.

**Persistencia de flujos**

- **FR-054**: Cada flujo MUST guardarse como un archivo de texto legible y versionable dentro de la
  carpeta de Zeko del repositorio.
- **FR-055**: Abrir un flujo guardado MUST reconstruir el canvas de forma idéntica: nodos,
  conexiones, configuración y posiciones.
- **FR-056**: Si el archivo se edita a mano, al reabrirlo el canvas MUST reflejar los cambios.
- **FR-057**: Si el archivo es inválido, el sistema MUST mostrar errores claros que indiquen la
  ubicación del problema, sin modificar ni borrar el archivo y sin cerrar la aplicación.
- **FR-058**: Los archivos de flujo MUST NOT contener secretos ni credenciales de los agentes.

**Ejecución sin interfaz**

- **FR-059**: Un flujo guardado MUST poder ejecutarse desde la línea de comandos con el mismo
  comportamiento que desde el canvas, reportando estado, motivo y costo por nodo; las aprobaciones
  se solicitan al usuario en la misma sesión de línea de comandos.

**Historial y observabilidad**

- **FR-060**: El sistema MUST listar los runs de un flujo con fecha, duración, costo, estado general
  y resultado por nodo, indicando qué agente ejecutó cada nodo, incluidos los runs lanzados desde la
  línea de comandos.
- **FR-061**: El historial MUST persistir al cerrar y reabrir la aplicación.
- **FR-062**: Si la aplicación se cierra durante un run, al reabrirla el run MUST figurar como
  "interrumpido", sin perder historial ni copias aisladas.
- **FR-063**: El sistema MUST registrar cada evento relevante (inicio y fin de nodo, acción
  reportada por el agente, acción denegada, aprobación o rechazo, cancelación, error) con un
  identificador del run al que pertenece.

**Plataforma y agentes**

- **FR-064**: Windows y Linux MUST ser plataformas soportadas para ambos agentes. macOS queda para
  una versión posterior.
- **FR-065**: El sistema MUST aceptar Codex autenticado mediante cuenta de ChatGPT (suscripción del
  usuario), que es la forma principal, o mediante clave de API. La clave de API MUST mostrarse como
  forma de autenticación "no verificada" en la verificación previa al run (FR-025) y en los nodos de
  Codex. La verificación previa MUST informar la forma de autenticación que efectivamente usará
  cada nodo, sin mostrar ni guardar la cuenta ni sus datos personales (NFR-007).
- **FR-066**: En Windows, los nodos de Codex MUST NOT tener acceso a red, y el nodo MUST mostrar esa
  limitación antes, durante y después de la ejecución. Las acciones que requieren red fallan dentro
  del nodo.

### Non-Functional Requirements

- **NFR-001 (Plataforma)**: Todas las historias de usuario funcionan en Windows y en Linux con ambos
  agentes.
- **NFR-002 (Performance)**: La interfaz responde a interacciones del usuario (seleccionar un nodo,
  desplazar el canvas, abrir la salida) en menos de 200 ms con al menos 8 nodos de agente
  ejecutándose a la vez, combinando ambos agentes.
- **NFR-003 (Performance)**: Un cambio de estado de un nodo se refleja en el canvas en menos de
  1 segundo.
- **NFR-004 (Performance)**: La cancelación de un nodo se completa, sin procesos residuales, en menos
  de 10 segundos con cualquiera de los dos agentes.
- **NFR-005 (Confiabilidad)**: Tras un cierre durante un run, el 100 % de los eventos registrados
  antes del cierre siguen disponibles en el historial.
- **NFR-006 (Seguridad)**: Ningún agente se ejecuta sin una acción explícita del usuario.
- **NFR-007 (Seguridad y privacidad)**: Ningún archivo de flujo, registro, evento ni entrada del
  historial contiene secretos, credenciales (por ejemplo claves de API) ni datos personales de la
  cuenta del agente (por ejemplo su email). Se ocultan antes de guardarse, dejando visible que había
  un dato oculto.
- **NFR-008 (Seguridad)**: Todo nodo de agente tiene límites finitos de tiempo y reintentos, y de
  turnos cuando su agente lo admite, aplicados por Zeko; no existe forma de configurar una ejecución
  sin límite de tiempo. Los relanzamientos por falla de infraestructura también son finitos
  (FR-032).
- **NFR-009 (Seguridad)**: Por defecto, un nodo de Claude Code no tiene terminal ni permisos más
  allá de su alcance. Un nodo de Codex siempre tiene terminal y no puede escribir fuera de su copia
  aislada.
- **NFR-010 (Usabilidad)**: Un usuario nuevo arma y ejecuta un flujo de dos nodos de agente en menos
  de 5 minutos.
- **NFR-011 (Usabilidad)**: El motivo de un fallo, bloqueo u omisión es visible desde el nodo con
  como máximo una interacción.
- **NFR-012 (Usabilidad)**: Las diferencias de garantías entre agentes (confinamiento, terminal,
  comandos permitidos, detección de acciones denegadas, límite de turnos, acceso a red, forma de
  autenticación, datos de costo y datos de uso) se muestran en el nodo.
- **NFR-013 (Localización)**: Todo texto visible al usuario, en el canvas y en la línea de comandos,
  está en inglés. No hay selector de idioma en esta versión. Agregar un segundo idioma más adelante
  no requiere modificar la interfaz: todos los textos visibles se resuelven desde un único origen
  intercambiable. Los nombres de estado y de concepto escritos en español en este documento son
  conceptuales; su texto visible es la etiqueta en inglés correspondiente.

### Key Entities *(include if feature involves data)*

- **Proyecto**: carpeta local que es un repositorio git; contiene flujos.
- **Flujo**: grafo dirigido y acíclico de nodos y conexiones, con nombre; se guarda como archivo de
  texto en el repositorio.
- **Nodo**: elemento del flujo con tipo (entrada, agente, aprobación), posición y configuración.
  El nodo de agente incluye agente, modelo por agente, instrucciones, criterios de aceptación,
  alcance de rutas, terminal, comandos permitidos y límites.
- **Conexión**: relación de dependencia entre un nodo origen y un nodo destino.
- **Agente CLI**: herramienta externa soportada, con sus capacidades declaradas: nivel de
  confinamiento que garantiza, si admite nodos sin terminal, si admite lista de comandos
  permitidos, si informa acciones denegadas, si admite límite de turnos, si tiene acceso a red por
  plataforma, si informa costo, si informa consumo, si informa uso de la suscripción y en qué
  momento, y formas de autenticación aceptadas con su estado de verificación.
- **Run**: ejecución de un flujo; tiene fecha, duración, estado general (en curso, terminado,
  cancelado, interrumpido), costo total y ejecuciones de nodo.
- **Ejecución de nodo**: resultado de un nodo en un run: estado final, motivo, reporte, archivos
  observados, discrepancias, acciones denegadas, costo, consumo, intentos y copia aislada.
- **Reporte de trabajo**: salida estructurada del agente: estado declarado, resumen, archivos
  modificados, verificaciones y bloqueos.
- **Copia aislada**: copia del repositorio con rama propia usada por una ejecución de nodo; puede
  estar marcada como no confiable.
- **Decisión de aprobación**: aprobación o rechazo de un nodo de aprobación, con fecha.
- **Evento**: registro con marca de tiempo e identificador de run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario nuevo arma y ejecuta un flujo de dos nodos de agente en menos de 5 minutos
  en al menos 9 de cada 10 intentos de prueba.
- **SC-002**: Con 8 nodos de agente ejecutándose a la vez, combinando ambos agentes, la interfaz
  responde en menos de 200 ms y los cambios de estado se ven en menos de 1 segundo.
- **SC-003**: El 100 % de las cancelaciones de nodo terminan en menos de 10 segundos sin procesos
  del agente residuales.
- **SC-004**: En el 100 % de los runs, el repositorio original del usuario queda sin cambios en sus
  archivos, rama actual y cambios pendientes.
- **SC-005**: En el 100 % de los casos de prueba de estado final (error, límites, acción denegada,
  reporte ausente, inconsistencia, discrepancia de archivos), el nodo termina con el estado que
  indican las reglas y su motivo es visible, con ambos agentes.
- **SC-006**: En el 100 % de las pruebas de confinamiento, un nodo confinado no logra leer ni
  escribir fuera de su copia aislada, y un nodo confinado solo en escritura no logra escribir fuera
  de ella, incluidas rutas relativas y enlaces.
- **SC-007**: Guardar y reabrir un flujo reproduce nodos, conexiones, configuración y posiciones sin
  diferencias en el 100 % de los casos.
- **SC-008**: Un mismo flujo ejecutado desde el canvas y desde la línea de comandos produce los
  mismos estados finales por nodo cuando los agentes responden igual.
- **SC-009**: Ningún run sobrepasa el límite de uso de suscripción por lanzar nodos después de
  haber superado el umbral de "cerca del límite".

## Assumptions

- El usuario ya tiene instalados y autenticados los agentes CLI que quiere usar; Zeko no los
  instala ni gestiona sus credenciales.
- Las copias aisladas parten del último estado confirmado del repositorio; los cambios sin
  confirmar no se incluyen y Zeko lo avisa al iniciar el run.
- "Acción necesaria denegada" se interpreta de forma conservadora: cualquier acción denegada que el
  agente informe durante la ejecución hace que el nodo quede "bloqueado".
- Un reintento parte del mismo estado de código inicial del nodo, descartando la copia del intento
  anterior.
- La retención por "cerca del límite" solo aplica a agentes que informan su uso de suscripción.
- Los agentes pueden diferir en qué datos de costo, consumo y uso informan; las diferencias se
  muestran, no se ocultan.
- Las rutas del alcance se expresan relativas a la raíz del repositorio.
- Un único usuario y una única máquina (Constitución, Principio XVIII).

## Out of Scope

- Agentes CLI distintos de Claude Code y Codex.
- Nodos de Codex sin terminal, lista de comandos permitidos y límite de turnos para Codex.
- Acceso a red para nodos de Codex en Windows.
- Interfaz en más de un idioma y selector de idioma.
- Librería de agentes predefinidos con skills.
- Canvas de arquitectura del proyecto.
- Terminales interactivas donde el usuario toma control de un agente.
- Confinamiento real de nodos con terminal.
- Nodos condicionales, bucles y disparadores automáticos.
- Orquestador automático que genere flujos a partir de un objetivo.
- Fusión de cambios, pull requests e integración con servicios git remotos.
- Nodos que llamen directamente a APIs de modelos.
- Reanudar un run interrumpido.
- Multiusuario, sincronización cloud y ejecución remota.
