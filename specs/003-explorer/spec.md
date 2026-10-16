# Feature Specification: Explorador de archivos y búsqueda del proyecto en la barra izquierda

**Feature Branch**: `feature/explorer`

**Created**: 2026-09-27

**Status**: Implemented (especificación retroactiva de lo construido en la rama)

**Input**: User description: "Replicar el file explorer de Orca, junto con la búsqueda por nombre de
archivo y por contenido, en la barra izquierda de Zeko, tanto en la pantalla de proyecto como en el
canvas."

## Objetivo

El usuario necesita ver y encontrar los archivos de su repositorio sin salir de Zeko mientras arma
flujos: para escribir instrucciones, definir alcances de rutas o revisar qué hay en el proyecto.
Esta feature agrega a la barra izquierda un explorador de archivos de solo lectura, con un único
campo de búsqueda que alterna entre filtrar por nombre ("Names") y buscar dentro del contenido
("Contents"), siguiendo el diseño del explorador de Orca.

**Actores**

- **Usuario desarrollador**: navega el árbol de archivos, filtra por nombre, busca texto y copia
  rutas.
- **Sistema Zeko**: lista directorios, filtra rutas y busca contenido dentro del proyecto abierto,
  respetando `.gitignore` y sin salir de la raíz del repositorio.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegar los archivos del proyecto (Priority: P1)

Con un proyecto abierto, la barra izquierda muestra el árbol de archivos del repositorio. El usuario
expande y colapsa carpetas con el mouse o el teclado. El explorador está en la pantalla de proyecto
y a la izquierda del canvas de flujos.

**Why this priority**: el árbol es la base del explorador y de las demás historias.

**Independent Test**: abrir un repositorio, expandir `src/`, abrir un flujo y comprobar que el
explorador también está a la izquierda del canvas.

**Acceptance Scenarios**:

1. **Dado** un proyecto abierto, **Cuando** se muestra la barra izquierda, **Entonces** aparece el
   primer nivel del repositorio, carpetas primero y en orden alfabético natural, sin `.git`.
2. **Dado** una carpeta colapsada, **Cuando** el usuario la expande, **Entonces** se carga solo ese
   nivel y se muestra un indicador mientras carga.
3. **Dado** el árbol con foco, **Cuando** el usuario usa flechas, Home, End, Enter o Espacio,
   **Entonces** la selección se mueve, las carpetas se expanden o colapsan y la izquierda sube a la
   carpeta padre.
4. **Dado** carpetas expandidas, **Cuando** el usuario pulsa "Collapse folders", **Entonces** todas
   se colapsan; **Cuando** pulsa "Refresh", **Entonces** se releen la raíz y las carpetas abiertas, y
   las que ya no existen se colapsan.
5. **Dado** un enlace simbólico, **Cuando** aparece en el árbol, **Entonces** se muestra con su
   ícono y no se puede expandir.
6. **Dado** el canvas de un flujo, **Cuando** se abre, **Entonces** la barra izquierda muestra la
   marca de Zeko y el mismo explorador del proyecto.

### User Story 2 - Filtrar archivos por nombre (Priority: P1)

En modo "Names", el usuario escribe en "Find files" y el árbol se reemplaza por un árbol con solo
las rutas que contienen todas las palabras escritas.

**Why this priority**: encontrar un archivo por nombre es la búsqueda más frecuente.

**Independent Test**: escribir `src view` y comprobar que solo quedan las rutas que contienen ambas
palabras, dentro de sus carpetas.

**Acceptance Scenarios**:

1. **Dado** el texto "src view", **Cuando** termina la espera de 150 ms, **Entonces** se muestran las
   rutas que contienen "src" y "view" (sin distinguir mayúsculas), agrupadas en carpetas expandidas.
2. **Dado** archivos ignorados por `.gitignore`, **Cuando** se filtra, **Entonces** no aparecen; los
   archivos nuevos no ignorados, sí.
3. **Dado** más de 500 coincidencias, **Cuando** se filtra, **Entonces** se muestran las primeras 500
   con un aviso.
4. **Dado** un árbol filtrado, **Cuando** el usuario colapsa una carpeta, **Entonces** se ocultan sus
   hijos sin perder el filtro.
5. **Dado** el filtro sin coincidencias, **Cuando** termina la búsqueda, **Entonces** se muestra
   "No matching files"; Escape o el botón de limpiar vuelven al árbol completo.

### User Story 3 - Buscar texto dentro de los archivos (Priority: P1)

En modo "Contents", el usuario escribe un texto y ve los resultados agrupados por archivo, con la
línea y la coincidencia resaltada. Puede distinguir mayúsculas, buscar palabra completa, usar
expresión regular e incluir o excluir rutas con globs.

**Why this priority**: es la otra mitad de la búsqueda pedida y la más útil en repos grandes.

**Independent Test**: buscar `alpha` con "Match case" y "files to include" = `*.ts` y comprobar que
solo aparecen coincidencias exactas en archivos `.ts`.

**Acceptance Scenarios**:

1. **Dado** un texto de búsqueda, **Cuando** pasan 300 ms sin escribir o se pulsa Enter,
   **Entonces** se muestra "N matches in M files" y los resultados agrupados por archivo.
2. **Dado** un resultado, **Cuando** se muestra, **Entonces** cada archivo tiene nombre, carpeta y
   cantidad de coincidencias, y cada coincidencia tiene número de línea y el texto resaltado, con el
   texto previo recortado para que la coincidencia se vea en la barra angosta.
3. **Dado** los botones "Aa", "ab" y ".*", **Cuando** se activan, **Entonces** la búsqueda distingue
   mayúsculas, exige palabra completa o interpreta el texto como expresión regular.
4. **Dado** "files to include" y "files to exclude" (por ejemplo `*.ts, src/**` y `dist/`),
   **Cuando** se busca, **Entonces** se aplican como globs separados por comas; un glob sin `/`
   aplica en cualquier nivel y uno de carpeta incluye todo su contenido.
5. **Dado** una expresión regular inválida, **Cuando** se busca, **Entonces** se muestra "Invalid
   regular expression".
6. **Dado** más de 2000 coincidencias, más de 100 en un archivo o más de 15 s de búsqueda,
   **Cuando** termina, **Entonces** se muestran las obtenidas y el aviso "(results truncated)".
7. **Dado** un encabezado de archivo, **Cuando** el usuario lo pulsa, **Entonces** se colapsan o
   expanden sus coincidencias.
8. **Dado** una coincidencia, **Cuando** el usuario la pulsa, **Entonces** Zeko vuelve a "Names",
   expande las carpetas hasta el archivo y lo selecciona en el árbol.

### User Story 4 - Copiar rutas (Priority: P3)

Con clic derecho sobre un archivo, carpeta o resultado, el usuario copia la ruta absoluta, la
relativa o, en una coincidencia, `ruta#Llínea`.

**Why this priority**: es un atajo útil para escribir instrucciones y alcances de nodos.

**Independent Test**: clic derecho sobre `src/app.ts` → "Copy relative path" y pegar el resultado.

**Acceptance Scenarios**:

1. **Dado** un archivo del árbol, **Cuando** el usuario elige "Copy path", **Entonces** se copia la
   ruta absoluta con el separador del sistema.
2. **Dado** una coincidencia en la línea 12, **Cuando** elige "Copy line path", **Entonces** se
   copia `ruta/relativa#L12`.
3. **Dado** el menú abierto, **Cuando** el usuario pulsa Escape, hace clic afuera o la ventana pierde
   el foco, **Entonces** el menú se cierra.

### Edge Cases

- Un pedido con una ruta que sale de la raíz (`../`): se rechaza con `PATH_OUTSIDE_PROJECT`.
- Un pedido para un proyecto no abierto con `project.open`: se rechaza con `PROJECT_NOT_OPEN`.
- Una búsqueda nueva mientras otra sigue en curso: la anterior se cancela y su respuesta se descarta.
- Líneas muy largas (archivos minificados): se recorta una vista de 500 caracteres alrededor de la
  coincidencia.
- Archivos binarios: se excluyen de la búsqueda de contenido.
- Una expresión regular válida para git pero no para JavaScript: se resalta la línea completa.
- Al cambiar entre "Names" y "Contents", el texto escrito pasa al otro campo si este está vacío.
- Al abrir un proyecto, el explorador no toma el foco; el foco pasa al campo solo al cambiar de modo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La barra izquierda de la pantalla de proyecto y la del canvas de flujos MUST mostrar el
  explorador del proyecto abierto.
- **FR-002**: El árbol MUST cargar un nivel por vez, ordenar carpetas antes que archivos, ocultar
  `.git` y no expandir enlaces simbólicos.
- **FR-003**: El explorador MUST ofrecer un único campo con un selector "Names" / "Contents" debajo;
  ambos campos quedan montados para que el cambio de modo no desplace la interfaz.
- **FR-004**: El filtro por nombre MUST usar los archivos versionados y los nuevos no ignorados
  (`git ls-files --cached --others --exclude-standard`), exigir todas las palabras sin distinguir
  mayúsculas y limitar a 500 resultados, avisando si se truncó.
- **FR-005**: La búsqueda de contenido MUST usar `git grep` sobre archivos versionados y nuevos no
  ignorados, excluir binarios y submódulos, y soportar mayúsculas, palabra completa, expresión
  regular extendida e inclusión/exclusión por globs.
- **FR-006**: La búsqueda MUST devolver la columna de cada coincidencia (varias por línea), limitarse
  a 2000 coincidencias totales, 100 por archivo y 15 segundos, y marcar el resultado como truncado.
- **FR-007**: Toda operación de archivos MUST ejecutarse en el runtime (engine host), no en la UI, a
  través de los métodos IPC `files.readDir`, `files.list` y `files.search`, y solo para proyectos
  abiertos.
- **FR-008**: Toda ruta pedida MUST resolverse dentro de la raíz del proyecto; si sale de ella, MUST
  rechazarse.
- **FR-009**: La salida de git MUST leerse en streaming y el proceso MUST detenerse al alcanzar un
  límite o ser reemplazado por otra búsqueda, usando cancelación por `AbortSignal`.
- **FR-010**: Las coincidencias MUST mostrarse agrupadas por archivo, con encabezados colapsables y
  resaltado; pulsar una coincidencia MUST revelar el archivo en el árbol.
- **FR-011**: El explorador MUST permitir copiar ruta absoluta, relativa y ruta con línea.
- **FR-012**: El árbol MUST poder operarse con teclado y exponer roles de accesibilidad (`tree`,
  `treeitem`, `aria-expanded`, `aria-selected`).
- **FR-013**: Todos los textos MUST salir del catálogo de i18n.

### Non-Functional Requirements

- **NFR-001**: No se agregan dependencias: Zeko solo abre repositorios git, así que `git ls-files` y
  `git grep` reemplazan el ripgrep empaquetado de Orca.
- **NFR-002**: Abrir el explorador en un repositorio grande MUST ser inmediato, porque solo se lee el
  primer nivel.
- **NFR-003**: El filtro espera 150 ms y la búsqueda 300 ms tras la última tecla, y las respuestas de
  consultas anteriores se descartan.

### Key Entities

- **Entrada de directorio**: nombre, ruta relativa con `/`, si es carpeta y si es enlace simbólico.
- **Resultado de listado**: rutas relativas y si se truncó.
- **Opciones de búsqueda**: texto, mayúsculas, palabra completa, expresión regular, globs a incluir
  y a excluir.
- **Resultado de búsqueda**: archivos con sus coincidencias (línea, columna, largo y vista de la
  línea), total de coincidencias y si se truncó.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario encuentra un archivo por nombre o un texto en el repositorio sin salir de
  Zeko, desde la pantalla de proyecto o desde el canvas.
- **SC-002**: Ningún pedido del renderer puede leer fuera de la raíz del proyecto (cubierto por
  tests).
- **SC-003**: Los archivos ignorados por `.gitignore` no aparecen ni en el filtro ni en la búsqueda
  (cubierto por tests).

## Implementación

- `packages/git/src/project-search.ts`: `listProjectFiles` y `searchProjectContents` con git en
  streaming, conversión de globs a pathspecs, lectura de registros de `git grep --null` y vista de
  líneas largas.
- `packages/runtime/src/project-files.ts`: `ProjectFiles` (lectura de directorios confinada a la
  raíz, validación de opciones y cancelación de la búsqueda anterior), conectado en
  `create-runtime.ts`.
- Contrato IPC: `files.readDir`, `files.list` y `files.search` en `packages/contracts/src/ipc.ts`,
  `packages/runtime/src/adapter-registry.ts`, `apps/desktop/src/engine-host/dispatch.ts` y
  `apps/desktop/src/renderer/ipc/client.ts`.
- Renderer: `apps/desktop/src/renderer/explorer/` (explorador, resultados de búsqueda, hooks de árbol
  y consultas, proyección pura de filas e íconos SVG), montado en `screens/project-screen.tsx` y
  `screens/flow-editor.tsx`. La barra izquierda pasa de 228 a 300 px.
- Tests: `packages/git/test/project-search.test.ts`, `packages/runtime/test/project-files.test.ts`,
  `apps/desktop/test/explorer-rows.test.ts` y la actualización de
  `packages/runtime/test/ipc-exhaustiveness.test.ts`.

## Assumptions

- El proyecto es un repositorio git con `git` disponible en el PATH (ya exigido por la spec 001).
- El diseño toma como referencia el explorador y la búsqueda de Orca (MIT, Copyright (c) 2026
  Lovecast Inc.), con atribución en el código y sin usarlo como dependencia (constitución XIV).

## Out of Scope

- Abrir o editar archivos: Zeko todavía no tiene editor. Decidir si se abren con la aplicación del
  sistema o en un visor interno queda pendiente.
- Crear, renombrar, mover, duplicar o borrar archivos; arrastrar y soltar.
- Decoraciones de estado git, observación de cambios en disco (watchers) y proyectos remotos (SSH).
- Virtualización de filas e íconos por tipo de archivo.
- Conservar el estado del explorador (carpetas abiertas, consulta) al pasar de la pantalla de
  proyecto al canvas, y mostrarlo en las pantallas de historial y de configuración.
