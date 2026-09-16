# Feature Specification: Explorador de directorios para asociar repositorios

**Feature Branch**: `002-repository-browser`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "que en vez de escribir rutas, se abra el explorador de archivos y se seleccione desde ahí", con alcance de navegación "todo el home del usuario".

## Contexto y motivación

Hoy la única forma de asociar un repositorio a un proyecto es escribir su ruta absoluta a mano
en un campo de texto. Es lento, propenso a errores de tipeo y obliga a la persona a conocer de
memoria la ruta exacta.

El explorador nativo del sistema operativo **no** resuelve esto. Se verificó en el navegador
del proyecto que `showDirectoryPicker()` y `<input webkitdirectory>` existen, pero ninguno
expone la ruta absoluta: el primero devuelve un handle cuyo único identificador es el nombre
de la carpeta, el segundo devuelve rutas relativas a la carpeta elegida. `File` no tiene
propiedad `path`, lo que confirma que no se está en un entorno tipo Electron. El navegador
oculta la ruta absoluta de forma deliberada.

Por eso la solución es que el backend, que corre en la misma máquina, liste los directorios y
la interfaz dibuje su propio explorador.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir un repositorio navegando el filesystem (Priority: P1)

Al configurar un proyecto, la persona abre un explorador dentro de Zeko, navega por las
carpetas de su máquina y elige la que contiene el repositorio, sin escribir ninguna ruta.

**Why this priority**: Es el pedido central. Sin esto la feature no existe.

**Independent Test**: Con un proyecto abierto y sin repositorios, abrir el explorador, navegar
hasta un repositorio git conocido y asociarlo. Entrega valor completo por sí solo.

**Acceptance Scenarios**:

1. **Given** un proyecto sin repositorios, **When** se abre el explorador, **Then** se listan
   los subdirectorios del punto de partida, sin contenidos de archivos.
2. **Given** el explorador abierto en un directorio, **When** se elige un subdirectorio,
   **Then** se navega a él y se listan sus subdirectorios.
3. **Given** un directorio seleccionado que es un repositorio git, **When** se confirma la
   selección, **Then** se asocia al proyecto usando el camino de alta ya existente, con su
   misma validación y sus mismos errores.
4. **Given** un directorio seleccionado que **no** es un repositorio git, **When** se intenta
   confirmar, **Then** el sistema lo impide y explica el motivo.

---

### User Story 2 - Distinguir a simple vista qué carpetas son repositorios (Priority: P2)

Mientras navega, la persona ve marcadas las carpetas que son repositorios git, para no tener
que entrar en cada una a adivinar.

**Why this priority**: Sin esto el explorador funciona pero obliga a navegar a ciegas. Es la
diferencia entre una lista de carpetas y una herramienta útil.

**Independent Test**: Navegar a un directorio que contiene una mezcla de repositorios y
carpetas comunes y verificar que solo los repositorios aparecen marcados.

**Acceptance Scenarios**:

1. **Given** un directorio con subdirectorios de los cuales algunos son repositorios git,
   **When** se lista, **Then** cada entrada indica si es o no un repositorio.

---

### User Story 3 - Volver a escribir la ruta a mano (Priority: P3)

La persona puede seguir pegando o escribiendo una ruta directamente, sin pasar por el
explorador.

**Why this priority**: El camino actual ya funciona y hay casos donde pegar una ruta es más
rápido. Quitarlo sería una regresión.

**Independent Test**: Asociar un repositorio escribiendo su ruta, sin abrir el explorador.

**Acceptance Scenarios**:

1. **Given** el panel de configuración del proyecto, **When** se escribe una ruta válida y se
   confirma, **Then** el repositorio se asocia igual que antes de esta feature.

---

### Edge Cases

- ¿Qué pasa cuando el directorio no existe, fue borrado entre el listado y la selección, o no
  tiene permisos de lectura?
- ¿Qué pasa cuando se pide listar una ruta **fuera** del alcance permitido?
- ¿Qué pasa con enlaces simbólicos que apuntan fuera del alcance permitido?
- ¿Qué pasa con directorios que contienen decenas de miles de entradas?
- ¿Qué pasa si se intenta asociar un repositorio que el proyecto ya tiene asociado?
- ¿Qué pasa cuando un repositorio es un submódulo o un worktree de git en vez de un repo
  independiente?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST listar los subdirectorios de una ruta indicada, devolviendo por
  cada entrada su nombre, su ruta absoluta y si es o no un repositorio git.
- **FR-002**: El sistema MUST NOT devolver archivos ni contenido de archivos: el explorador
  solo opera sobre directorios.
- **FR-003**: El sistema MUST restringir la navegación al directorio home de la persona
  usuaria y MUST rechazar cualquier ruta fuera de él.
- **FR-004**: El sistema MUST rechazar rutas que escapen del alcance permitido mediante
  enlaces simbólicos o recorridos relativos, resolviendo la ruta real antes de decidir.
- **FR-005**: El sistema MUST excluir del listado los directorios que contienen credenciales o
  secretos, como mínimo `.ssh`, `.gnupg`, `.aws`, `.docker` y `.config/gh`.
- **FR-006**: El sistema MUST ocultar los directorios que empiezan con punto por defecto, y
  MUST permitir mostrarlos mediante una acción explícita, sin que eso levante la exclusión de
  FR-005.
- **FR-007**: Las personas usuarias MUST poder navegar hacia subdirectorios y hacia el
  directorio padre, sin superar el límite de FR-003.
- **FR-008**: Las personas usuarias MUST poder confirmar la selección de un directorio y, con
  eso, asociarlo como repositorio del proyecto activo.
- **FR-009**: El sistema MUST reutilizar el camino de alta de repositorios existente, con su
  inspección, su estado de acceso y sus errores, sin duplicar ni relajar esas reglas.
- **FR-010**: El sistema MUST impedir confirmar un directorio que no sea un repositorio git
  disponible, e informar el motivo.
- **FR-011**: El sistema MUST conservar la vía de escritura manual de ruta ya existente.
- **FR-012**: El sistema MUST aplicar al nuevo endpoint las mismas protecciones de acceso que
  el resto de la API: cliente de loopback, `Host` y `Origin` locales y sesión local vigente.
- **FR-013**: El sistema MUST responder con un error legible y sin filtrar detalles del
  filesystem cuando la ruta no existe, no es un directorio o no se puede leer.
- **FR-014**: El sistema MUST acotar la cantidad de entradas devueltas por listado y MUST
  indicar cuando el listado quedó truncado.

### Key Entities *(include if feature involves data)*

- **DirectoryEntry**: Un subdirectorio navegable. Atributos: nombre, ruta absoluta, si es
  repositorio git, si es legible.
- **DirectoryListing**: El resultado de listar una ruta. Atributos: ruta absoluta consultada,
  ruta del padre navegable si la hay, colección de `DirectoryEntry`, marca de truncamiento.

Ninguna de las dos se persiste: son proyecciones de solo lectura del filesystem.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una persona puede asociar un repositorio sin escribir ningún carácter de ruta.
- **SC-002**: Un listado de un directorio con hasta 500 subdirectorios se muestra en menos de
  1 segundo en la máquina local.
- **SC-003**: El 100% de los intentos de listar rutas fuera del home son rechazados, incluidos
  los que usan enlaces simbólicos o recorridos relativos.
- **SC-004**: Ningún listado incluye los directorios de credenciales enumerados en FR-005, ni
  siquiera con los ocultos visibles.
- **SC-005**: Asociar un repositorio elegido por el explorador produce exactamente el mismo
  resultado que asociarlo escribiendo su ruta.

## Assumptions

- El backend corre en la misma máquina y con el mismo usuario que la persona que usa la
  interfaz, que es el modelo local-first vigente del producto.
- El alcance de navegación es el home del usuario, elegido explícitamente por el usuario
  frente a la alternativa de acotarlo a la raíz del proyecto. La exclusión de directorios de
  credenciales es un refinamiento de esa decisión, no una contradicción.
- El explorador es de solo lectura: no crea, mueve, renombra ni borra directorios.
- Se reutiliza `RepositoryInspector` para decidir si un directorio es un repositorio git, en
  vez de introducir una segunda definición de "es un repo".
- La feature no incluye descubrimiento automático ni escaneo recursivo del disco: la persona
  navega explícitamente.
- La feature no incluye recordar ubicaciones favoritas ni historial de navegación.

## Fuera de alcance

- Explorar o asociar repositorios remotos, o clonar desde una URL.
- Navegar fuera del home, incluidas unidades externas montadas fuera de él.
- Listar o previsualizar archivos.
- Escaneo recursivo automático en busca de repositorios.
- Cualquier operación de escritura sobre el filesystem.

## Riesgos

- **Exposición de la estructura del home.** El endpoint permite enumerar nombres de
  directorios bajo el home a cualquier cliente que supere el gate de loopback y sesión. Se
  mitiga con FR-005 y FR-006, pero no se elimina: es el costo de la decisión de alcance.
- **Escape por enlaces simbólicos.** Es el vector clásico de este tipo de endpoint. FR-004 lo
  aborda y el proyecto ya tiene precedente en `SourceAdmissionPolicy`, cuya lógica de
  resolución de ruta real y detección de enlaces conviene reutilizar antes que reescribir.
