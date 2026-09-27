# Feature Specification: Canvas de flujos con el diseño de la versión anterior de Zeko

**Feature Branch**: `feature/canvas`

**Created**: 2026-09-27

**Status**: Implemented (especificación retroactiva de lo construido en la rama)

**Input**: User description: "Modificar el canvas. Tengo un repo con una versión vieja de Zeko en la
que se hizo un canvas que quedó muy bien (`Zeko-old-version/Zeko-Agentic-IDE/frontend`). Replicar
exactamente el mismo canvas."

## Objetivo

El canvas del editor de flujos es la superficie principal de Zeko: ahí el usuario arma el grafo de
nodos de entrada, agentes y aprobaciones, y sigue su ejecución. La versión anterior de Zeko tenía un
canvas con mejor lectura visual (tema oscuro "taller de graffiti", tarjetas con ícono de acento,
LED de estado, barra de controles flotante y minimapa). Esta feature reemplaza la presentación del
canvas actual por la de la versión anterior, sin cambiar lo que el canvas hace: el flujo, su
validación, la ejecución y el panel del nodo siguen igual.

**Referencia**: `frontend/src/features/canvas/` (`FlowCanvas.tsx`, `CanvasToolbar.tsx`,
`layout.ts`, `edges/ConfigEdge.tsx`, `nodes/NodeShell.tsx`, `nodes/icons.tsx`), los componentes de
diseño `design/{Toolbar,IconButton,Badge,StatePill,stateTone}.ts(x)` y `styles/theme.css` del repo
anterior.

**Actores**

- **Usuario desarrollador**: arma y reordena el flujo, navega el canvas y sigue la ejecución.
- **Sistema Zeko**: valida el flujo, publica el estado de cada nodo durante la ejecución y guarda
  las posiciones en el archivo del flujo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver el flujo con el diseño anterior (Priority: P1)

Al abrir un flujo, el canvas se muestra con la superficie de tinta (`#0a0b0d`), rejilla de puntos y
nodos como tarjetas oscuras: una franja de ícono con el color de acento del tipo a la izquierda, y a
la derecha el tipo en versalitas, el nombre y un subtítulo monoespaciado.

**Why this priority**: es el pedido central: que el canvas se vea igual al de la versión anterior.

**Independent Test**: abrir un flujo con un nodo de cada tipo y compararlo con el canvas del repo
anterior: fondo, puntos, tarjetas, handles, aristas y tipografía.

**Acceptance Scenarios**:

1. **Dado** un flujo abierto, **Cuando** se muestra el canvas, **Entonces** el fondo es `ink-950`,
   la rejilla es de puntos cada 20 px de 1,5 px en `ink-700`, y la vista se ajusta al contenido con
   un margen de 0,24.
2. **Dado** un nodo de entrada, **Cuando** se dibuja, **Entonces** tiene ícono de tarea con acento
   violeta, el objetivo como subtítulo y solo un handle de salida (una entrada no admite
   predecesores).
3. **Dado** un nodo de agente, **Cuando** se dibuja, **Entonces** tiene ícono de agente con acento
   lima, el id del agente (`claude-code`, `codex`) como subtítulo y handles de entrada y salida.
4. **Dado** un nodo de aprobación, **Cuando** se dibuja, **Entonces** tiene ícono de escudo con
   acento magenta, "Review gate" como subtítulo y handles de entrada y salida.
5. **Dado** un nodo seleccionado, **Cuando** se dibuja, **Entonces** su borde es lima con un anillo
   lima al 30 %; sin selección el borde es `ink-700` y `ink-600` al pasar el mouse.
6. **Dado** una arista, **Cuando** se dibuja, **Entonces** es una curva bezier (curvatura 0,35) de
   1,5 px en `ink-600`, que pasa a 2 px lima al seleccionarla.

### User Story 2 - Navegar el canvas con la barra de controles (Priority: P1)

Arriba a la izquierda del canvas flota la barra de controles de la versión anterior: ajustar a la
vista, acercar, alejar, reordenar nodos, mostrar u ocultar el minimapa y la cantidad de nodos.

**Why this priority**: reemplaza a los controles por defecto de React Flow y es la forma principal
de moverse en flujos grandes.

**Independent Test**: con un flujo de varios nodos, usar cada botón y comprobar el efecto.

**Acceptance Scenarios**:

1. **Dado** el canvas, **Cuando** el usuario pulsa "Fit to view", **Entonces** la vista se ajusta a
   todos los nodos con margen 0,2 y una animación de 200 ms; "Zoom in" y "Zoom out" animan 150 ms.
2. **Dado** el zoom, **Cuando** el usuario acerca o aleja, **Entonces** se mantiene entre 0,25 y 2.
3. **Dado** el minimapa visible, **Cuando** el usuario pulsa "Show minimap", **Entonces** se oculta
   y el botón deja de verse activo (lima); al pulsarlo otra vez vuelve a mostrarse.
4. **Dado** un flujo con N nodos, **Cuando** se muestra la barra, **Entonces** indica "N nodes" (o
   "1 node").
5. **Dado** el canvas, **Cuando** el usuario usa la rueda del mouse, **Entonces** la vista se
   desplaza (pan); con Ctrl + rueda hace zoom.

### User Story 3 - Reordenar los nodos automáticamente (Priority: P2)

El botón "Rearrange nodes" acomoda los nodos en columnas según sus dependencias, con el layout por
capas determinista de la versión anterior.

**Why this priority**: ordena flujos que quedaron desprolijos después de agregar y mover nodos.

**Independent Test**: armar `input → a`, `input → b`, `a → gate`, `gate → c`, `b → c`, pulsar
"Rearrange nodes" y comprobar las columnas 0, 1, 1, 2 y 3.

**Acceptance Scenarios**:

1. **Dado** un flujo, **Cuando** el usuario pulsa "Rearrange nodes", **Entonces** cada nodo queda en
   la columna del camino más largo que llega a él, a 320 px entre columnas, desde (48, 40).
2. **Dado** varios nodos en la misma columna, **Cuando** se reordena, **Entonces** se apilan cada
   156 px en el orden en que están en el archivo del flujo.
3. **Dado** un reordenamiento, **Cuando** termina, **Entonces** las posiciones nuevas quedan en el
   flujo como cambio sin guardar, igual que al arrastrar un nodo.

### User Story 4 - Seguir la ejecución en el canvas (Priority: P1)

Durante una ejecución, cada nodo muestra un LED de estado arriba a la derecha y una píldora de
estado entre sus insignias; el minimapa pinta cada nodo con el color de su estado.

**Why this priority**: el estado en vivo es lo que el usuario mira mientras corre un flujo.

**Independent Test**: ejecutar un flujo con un agente y una aprobación y observar los cambios de
color del LED, la píldora y el minimapa.

**Acceptance Scenarios**:

1. **Dado** un nodo en ejecución, **Cuando** se dibuja, **Entonces** el LED y el punto de la
   píldora son cian y pulsan (opacidad 1 → 0,5, 2 s).
2. **Dado** los estados del nodo, **Cuando** se dibujan, **Entonces** usan la paleta de estados:
   pendiente gris, en ejecución cian, esperando aprobación ámbar, completado o aprobado lima,
   fallido o rechazado rojo, cancelado u omitido gris oscuro, bloqueado o interrumpido naranja.
3. **Dado** un nodo con motivo o retención por uso, **Cuando** el usuario pulsa la píldora,
   **Entonces** se despliega el motivo debajo de las insignias.
4. **Dado** un nodo sin estado de ejecución, **Cuando** se dibuja, **Entonces** no tiene LED y el
   minimapa lo pinta con el color "pendiente".

### User Story 5 - Ver problemas y capacidades en el nodo (Priority: P2)

Las insignias de la versión anterior (píldoras redondeadas con borde y fondo del tono al 10 %)
muestran el confinamiento del agente, sus advertencias y la cantidad de problemas de validación.

**Why this priority**: mantiene la información que ya mostraba el canvas actual con el nuevo diseño.

**Independent Test**: crear un agente sin confinamiento y con un error de validación y comprobar
las insignias y el borde.

**Acceptance Scenarios**:

1. **Dado** un agente confinado, de solo escritura o sin confinar, **Cuando** se dibuja,
   **Entonces** la insignia de confinamiento es lima, ámbar o roja respectivamente.
2. **Dado** un nodo con errores de validación, **Cuando** se dibuja, **Entonces** muestra la insignia
   roja "N issues" y su borde es rojo; si solo tiene advertencias, ámbar.
3. **Dado** diagnósticos del flujo, **Cuando** se muestran, **Entonces** el panel de validación
   aparece arriba a la derecha del canvas con el mismo estilo oscuro flotante, y se corre a la
   izquierda cuando el panel del nodo está abierto.

### Edge Cases

- El panel del nodo (dock) tapa la esquina inferior derecha: mientras está abierto, el minimapa se
  corre a la izquierda del panel.
- El panel del nodo vive dentro del área del canvas pero conserva la tipografía y colores claros del
  resto de la app.
- Un flujo con un ciclo no se puede guardar, pero si llegara al layout, el nodo que cierra el ciclo
  se trata como raíz en vez de recorrerse sin fin.
- Arrastrar un nodo se ajusta a una grilla de 16 px, y la posición se guarda redondeada.
- Un flujo sin aristas sigue mostrando la sugerencia "Connect nodes…" abajo al centro, con el estilo
  oscuro.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El canvas MUST reproducir los parámetros de React Flow de la versión anterior:
  `fitView` con margen 0,24, zoom entre 0,25 y 2, `snapToGrid` de 16 px, `panOnScroll`,
  `selectionOnDrag`, nodos arrastrables, elementos seleccionables y atribución visible.
- **FR-002**: El canvas MUST usar el fondo de puntos (20 px, 1,5 px) y el minimapa de 168 × 112 px,
  desplazable y con zoom, abajo a la derecha, con borde `ink-700` y radio de 10 px.
- **FR-003**: Los controles por defecto de React Flow MUST reemplazarse por la barra flotante de la
  versión anterior (Fit, Zoom in, Zoom out | Rearrange, Minimap | cantidad de nodos), con rol
  `toolbar`, botones de 32 px con `aria-label`, `title` y `aria-pressed`.
- **FR-004**: Todos los nodos MUST dibujarse con el componente `NodeShell` de la versión anterior:
  248 px de ancho, radio 12 px, franja de ícono de 44 px con acento, tipo, título, subtítulo
  monoespaciado, insignias y LED de estado opcional.
- **FR-005**: Las aristas MUST dibujarse con `ConfigEdge` (bezier, curvatura 0,35) y admitir una
  etiqueta opcional con forma de píldora.
- **FR-006**: El canvas MUST usar la paleta del tema "taller de graffiti" (`ink`, `chalk`, `spray`,
  `state`), sus radios, sombras y tipografía del sistema, acotada al área del canvas.
- **FR-007**: El canvas MUST ofrecer "Rearrange nodes" con el layout por capas determinista de la
  versión anterior, calculando la columna por dependencias del flujo.
- **FR-008**: El estado de ejecución de cada nodo MUST mapearse a un único tono compartido por el
  LED, la píldora y el minimapa.
- **FR-009**: El canvas MUST conservar todo el comportamiento actual: agregar nodos, conectar con
  validación de ciclos en el runtime, borrar nodos y aristas con Backspace/Delete, seleccionar un
  agente para abrir su panel, guardar posiciones en el flujo, diagnósticos y resultados de nodos.
- **FR-010**: Todos los textos nuevos MUST salir del catálogo de i18n.

### Non-Functional Requirements

- **NFR-001**: No se agregan dependencias. El repo anterior usaba Tailwind; aquí sus clases se
  traducen a CSS plano con los mismos valores, porque el preflight de Tailwind cambiaría los estilos
  del resto de la app.
- **NFR-002**: Los tokens del tema se declaran en `.zeko-canvas`, no en `:root`, para que la
  pantalla de proyecto, el explorador y los diálogos mantengan su paleta clara.
- **NFR-003**: Los íconos son SVG propios (sin librería de íconos), porque la app corre sin red.
- **NFR-004**: Con `prefers-reduced-motion` del sistema, las animaciones y transiciones del canvas
  (incluido el pulso de "en ejecución") se anulan, como en el tema anterior.

### Key Entities

- **Tono de estado**: `pending`, `running`, `waiting`, `completed`, `failed`, `cancelled`,
  `blocked`; se obtiene del estado del nodo (`NodeStatus`).
- **Acento de nodo**: `lime` (agente), `violet` (entrada), `magenta` (aprobación); `cyan` y `slate`
  quedan disponibles para tipos futuros.
- **Posición de layout**: columna por camino más largo y fila por orden de aparición.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El canvas se ve igual al de la versión anterior de Zeko: mismos colores, rejilla,
  tarjetas, aristas, barra de controles y minimapa.
- **SC-002**: Los flujos existentes se abren, editan, validan y ejecutan igual que antes del cambio
  (typecheck, lint y tests existentes sin regresiones).
- **SC-003**: El layout automático es determinista y respeta las dependencias (cubierto por tests).

## Implementación

- `apps/desktop/src/renderer/canvas/` (portado del repo anterior):
  - `node-shell.tsx`: tarjeta de nodo (`NodeShell`).
  - `config-edge.tsx`: arista bezier (`ConfigEdge`).
  - `canvas-toolbar.tsx`: barra flotante de controles con sus botones de ícono.
  - `canvas-icons.tsx`: íconos SVG de agente, tarea, aprobación y controles.
  - `layout.ts`: `layoutColumns` (columna por dependencias, nueva) y `layoutPositions` (layout por
    capas de la versión anterior).
  - `state-tone.ts`: mapeo de `NodeStatus` a tono.
  - `node-types.tsx`: un único `FlowCanvasNode` que elige ícono, acento y handles según el tipo.
  - `node-badges.tsx`: insignias de confinamiento y advertencias con los tonos de `Badge`.
  - `flow-canvas.tsx`: parámetros de React Flow, fondo, minimapa, barra de controles,
    "Rearrange nodes" y selección visible del nodo elegido.
- `apps/desktop/src/renderer/run/node-status.tsx`: el estado en vivo pasa a ser la píldora de estado
  (`StatePill`) sin perder el detalle desplegable.
- `apps/desktop/src/renderer/styles.css`: el bloque del canvas reemplaza los estilos claros por el
  tema oscuro acotado a `.zeko-canvas` (tokens, variables `--xy-*` de React Flow, nodo, insignias,
  píldoras, barra de controles, minimapa, sugerencia y panel de validación).
- `packages/i18n/src/en.json`: claves `canvas.controls`, `canvas.fitView`, `canvas.zoomIn`,
  `canvas.zoomOut`, `canvas.resetLayout`, `canvas.showMinimap`, `canvas.minimap`,
  `canvas.nodeCount` y `canvas.nodeCountOne`.
- Tests: `apps/desktop/test/canvas-layout.test.ts`.

## Diferencias con la versión anterior

Se replicó la presentación completa. Estas diferencias vienen de que el canvas actual edita y
ejecuta flujos, mientras que el anterior solo mostraba relaciones:

- **Conexión y borrado**: el anterior tenía `nodesConnectable` apagado y `deleteKeyCode={null}`;
  aquí se mantienen activos porque el editor necesita crear y borrar aristas y nodos.
- **Posiciones**: el anterior guardaba las posiciones movidas solo en memoria (`useNodeLayout`);
  aquí se guardan en el archivo del flujo, y "Rearrange nodes" escribe las posiciones nuevas.
- **Columnas**: el anterior recibía la columna de cada tipo de entidad; aquí se calcula por el
  camino más largo del grafo del flujo.
- **Tipos de nodo**: la entrada usa el ícono y el acento violeta de la antigua "Tarea"; el agente,
  el de "Instancia" (lima); la aprobación, el de "Aprobación" (magenta).
- **Estados**: los estados propios de Zeko (`waiting_approval`, `approved`, `rejected`, `skipped`,
  `interrupted`) se mapean a los tonos existentes.
- **Bordes de validación**: el anterior no tenía validación en el nodo; aquí un nodo con errores o
  advertencias lleva borde rojo o ámbar.
- **Idioma**: los textos de la barra ("Ajustar a la vista", "Acercar"…) salen del catálogo de i18n,
  hoy en inglés.

## Assumptions

- El repo anterior (`Zeko-old-version/Zeko-Agentic-IDE/frontend`) es la fuente de verdad del diseño.
- El resto de la aplicación (barra lateral, encabezado del editor, panel del nodo, diálogos) sigue
  con el diseño claro actual; el tema oscuro aplica solo al área del canvas.

## Out of Scope

- Pasar toda la aplicación al tema oscuro de la versión anterior o agregar un selector de tema.
- Los canvas de Agentes, Arquitectura y Runtime del repo anterior y sus tipos de nodo.
- El estado vacío superpuesto (`emptyState`) y la alternativa accesible para jsdom (`fallback`) de
  `FlowCanvas`: el editor siempre tiene un flujo cargado y no hay tests de componentes en jsdom.
- Persistir si el minimapa está visible entre sesiones.
