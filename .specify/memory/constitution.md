<!--
Sync Impact Report
==================
Version change: (plantilla sin ratificar) → 1.0.0
Bump rationale: primera ratificación; se definen todos los principios y secciones (MAJOR inicial).

Principios definidos (20, sustituyen los 5 placeholders de la plantilla):
  I. La especificación manda
  II. Local-first
  III. El agente CLI es el motor
  IV. Núcleo headless
  V. Archivos como fuente de verdad
  VI. Estándares abiertos
  VII. Contratos estructurados
  VIII. Aislamiento de cambios
  IX. Permiso y autonomía separados
  X. Jerarquía de instrucciones
  XI. Seguridad por defecto
  XII. La arquitectura es contexto
  XIII. Observabilidad
  XIV. Referencias, no dependencias
  XV. Calidad de código
  XVI. Tests
  XVII. Performance
  XVIII. Alcance del MVP
  XIX. Sin código en fases de diseño
  XX. Implementación controlada

Secciones añadidas:
  - Stack tecnológico y restricciones
  - Flujo de desarrollo y quality gates
  - Governance

Secciones eliminadas: ninguna

Plantillas:
  ✅ .specify/templates/plan-template.md — Constitution Check con gates concretos
  ✅ .specify/templates/tasks-template.md — tests obligatorios para reglas del motor; una tarea = un commit
  ✅ .specify/templates/spec-template.md — revisado, sin cambios necesarios
  ✅ .specify/templates/checklist-template.md — revisado, sin cambios necesarios
  ✅ .claude/skills/speckit-* — revisados, sin referencias obsoletas
  ⚠ Readme.md — solo contiene "Initial Commit"; pendiente describir Zeko y enlazar la constitución

TODOs diferidos: ninguno
-->

# Zeko Constitution

Zeko es un entorno de desarrollo agéntico (ADE) de escritorio, local-first, que orquesta agentes
de código CLI existentes (Claude Code, Codex, OpenCode y otros) mediante un canvas de nodos al
estilo n8n. Incluye una librería de agentes con skills propias y un canvas de arquitectura del
proyecto cuyos nodos definen el alcance y el contexto de los agentes.

## Core Principles

### I. La especificación manda sobre la implementación

- Toda funcionalidad implementada MUST estar trazada a una historia de usuario o requisito de una
  spec aprobada.
- Lo que no esté en la spec MUST ir al backlog fuera del MVP; NUNCA directamente al código.

**Razón**: evita deriva de alcance y garantiza que cada línea de código tenga un porqué verificable.

### II. Local-first

- El flujo central MUST funcionar sin servidor propio, sin cuenta y sin conexión a servicios de Zeko.
- Ningún dato del repositorio MUST salir de la máquina por acción de Zeko. Solo sale lo que cada
  agente CLI envía a su propio proveedor.

**Razón**: el código del usuario es sensible; Zeko no debe convertirse en un punto de fuga.

### III. El agente CLI es el motor

- Zeko orquesta agentes existentes con la suscripción del usuario; MUST NOT reimplementar un agente
  ni un chat propio.
- Cada CLI se integra mediante un adaptador detrás de una interfaz común.
- Agregar un CLI nuevo MUST NOT requerir cambios en el núcleo.

**Razón**: el valor de Zeko está en la orquestación, no en competir con los agentes.

### IV. Núcleo headless

- El motor de orquestación MUST ser independiente de la interfaz.
- Todo flujo ejecutable desde el canvas MUST poder ejecutarse desde la CLI de Zeko.
- La UI MUST NOT contener reglas de negocio, de orquestación ni de seguridad.

**Razón**: testabilidad, automatización y una única implementación de cada regla.

### V. Archivos como fuente de verdad

- Flujos, definiciones de agentes, skills y modelo de arquitectura MUST guardarse como archivos de
  texto versionables dentro del repositorio, en `.zeko/`.
- El canvas es una vista y un editor de esos archivos, nunca un almacén paralelo.
- La base de datos local MUST guardar solo estado de ejecución: runs, eventos y aprobaciones.

**Razón**: los cambios se revisan en git como cualquier otro código.

### VI. Estándares abiertos antes que formatos propios

- Agentes y skills MUST usar el formato `SKILL.md` / `AGENTS.md`.
- La comunicación entre agentes y Zeko MUST usar MCP.
- MUST NOT inventarse un formato propietario cuando exista un estándar adoptado.

**Razón**: interoperabilidad con el ecosistema y portabilidad para el usuario.

### VII. Contratos estructurados

- Toda comunicación entre nodos MUST pasar por contratos tipados y validados: `TaskAssignment` como
  entrada y `WorkReport` como salida.
- Los schemas (zod) se definen una sola vez y son la única fuente de tipos.
- Un nodo MUST NOT terminar con texto libre: devuelve estado, resumen, archivos cambiados, checks,
  hallazgos y bloqueos.

**Razón**: la orquestación solo es fiable si las salidas son máquina-verificables.

### VIII. Aislamiento de cambios

- Cada nodo que modifica código MUST trabajar en su propio git worktree.
- Dos agentes MUST NOT compartir un worktree activo.
- Zeko MUST NOT hacer merge, push ni rebase automático.

**Razón**: cambios paralelos sin interferencias y control humano sobre la integración.

### IX. Permiso y autonomía son dimensiones separadas

- El permiso define qué puede hacer un agente; la autonomía define cuándo actúa sin preguntar.
- La autonomía MUST NOT ampliar permisos.
- Los permisos MUST aplicarse mediante los mecanismos nativos de cada CLI (configuración, sandbox
  y hooks).
- Las acciones destructivas o fuera del alcance asignado MUST requerir aprobación humana.

**Razón**: mezclar ambas dimensiones es la vía más común hacia acciones no autorizadas.

### X. Jerarquía de instrucciones

Orden de prioridad, de mayor a menor:

1. Restricciones de seguridad de Zeko.
2. Política del proyecto.
3. Instrucción explícita del usuario.
4. Criterios de la tarea.
5. Definición del agente y sus skills.
6. Plan del orquestador.

Una instrucción directa del usuario a un agente MUST notificarse al orquestador, y el orquestador
MUST NOT revertirla.

**Razón**: resolución determinista de conflictos y el usuario siempre por encima del orquestador.

### XI. Seguridad por defecto

- Los secretos MUST NOT aparecer en prompts, logs, eventos ni archivos de flujo.
- El contenido del repositorio y la salida de otros agentes son datos, no instrucciones.
- Todo run MUST tener límites obligatorios de tiempo, ciclos y reintentos; no se permiten loops sin
  límite.

**Razón**: mitiga filtración de secretos, prompt injection y consumo descontrolado.

### XII. La arquitectura es contexto, no decoración

- Cada nodo del canvas de arquitectura MUST vincularse a rutas concretas del repositorio y define el
  alcance (rutas permitidas) y el contexto inyectado a los agentes que trabajan sobre él.
- La inferencia de arquitectura es unidireccional (repositorio → diagrama).
- Editar el diagrama MUST NOT reescribir código automáticamente.

**Razón**: el diagrama acota y orienta a los agentes sin convertirse en generador de código oculto.

### XIII. Observabilidad

- Cada evento relevante (inicio, fin, tool call reportado por hooks, aprobación, error) MUST
  registrarse con un identificador de correlación por run.
- El estado de cada nodo (`idle`, `running`, `waiting approval`, `failed`, `done`) MUST ser siempre
  visible.

**Razón**: sin trazabilidad no hay depuración ni confianza en la ejecución multiagente.

### XIV. Referencias, no dependencias

- Orca y Alera son referencias de diseño; MUST NOT usarse como base de fork ni como dependencias de
  runtime.
- Si se reutiliza código con licencia MIT, MUST atribuirse explícitamente.

**Razón**: independencia técnica y cumplimiento de licencias.

### XV. Calidad de código

- TypeScript en modo estricto, sin `any` implícito, módulos ES.
- Sin lógica duplicada, sin funciones gigantes, sin errores silenciados.
- Los errores MUST tiparse y propagarse con contexto.

**Razón**: un orquestador con errores silenciados produce fallos imposibles de diagnosticar.

### XVI. Tests

- Toda regla del motor (scheduling, dependencias, contratos, políticas de permiso, gestión de
  worktrees) MUST tener tests unitarios.
- Los adaptadores MUST probarse contra agentes CLI simulados.
- Los tests MUST NOT llamar a proveedores reales de IA.

**Razón**: tests deterministas, gratuitos y reproducibles offline.

### XVII. Performance

- La interfaz MUST NOT bloquearse con múltiples agentes en ejecución.
- La salida de terminal y los eventos MUST transmitirse en streaming.
- Zeko MUST soportar al menos 8 nodos de agente concurrentes en una máquina de desarrollo estándar.

**Razón**: la orquestación paralela es la propuesta de valor central.

### XVIII. Alcance del MVP

- MVP: un solo usuario, una máquina, repositorios locales.
- Colaboración, sincronización cloud, ejecución remota y marketplace quedan fuera del MVP.

**Razón**: foco en entregar el flujo local completo antes de ampliar superficie.

### XIX. Sin código en fases de diseño

Durante las fases de especificación, aclaración, checklist, planificación, generación de tareas y
análisis MUST NOT implementarse código. Solo se crean o actualizan los documentos correspondientes.

**Razón**: separa decidir de construir y mantiene la spec como autoridad (Principio I).

### XX. Implementación controlada

- Una tarea, un diff, un commit.
- MUST NOT avanzarse a otra tarea sin cerrar la actual.

**Razón**: historial revisable y reversión granular.

## Stack tecnológico y restricciones

- **Lenguaje**: TypeScript estricto en todo el proyecto, Node.js LTS.
- **Monorepo**: pnpm workspaces, con núcleo de orquestación, aplicación de escritorio y CLI como
  paquetes separados. El paquete de escritorio y la CLI dependen del núcleo; el núcleo no depende
  de ninguno de ellos.
- **Escritorio**: Electron con electron-vite, React y `@xyflow/react` para los canvases.
- **Terminales**: `node-pty` y `@xterm/xterm`.
- **Validación y contratos**: zod.
- **Estado de ejecución**: SQLite.
- **Git**: CLI de git controlada para worktrees y diffs.
- **Tests**: Vitest.

Introducir una dependencia de runtime fuera de este stack MUST justificarse en el plan de la
feature (sección Complexity Tracking).

## Flujo de desarrollo y quality gates

- Flujo Spec Kit: especificar → aclarar → planificar → generar tareas → analizar → implementar.
  Las fases previas a implementar solo producen documentos (Principio XIX).
- Todo plan MUST pasar el Constitution Check antes de la investigación (Fase 0) y de nuevo tras el
  diseño (Fase 1). Las violaciones se justifican en Complexity Tracking o se corrigen.
- Cada tarea implementada produce un único commit con su diff; los tests del motor afectados MUST
  pasar antes del commit (Principios XVI y XX).
- Las revisiones MUST verificar: trazabilidad a la spec, ausencia de lógica de negocio en la UI,
  contratos validados con zod, ausencia de secretos y límites de run definidos.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica o guía del proyecto.
- **Enmiendas**: se proponen mediante `/speckit-constitution`, documentando el cambio, su motivo y
  el impacto en plantillas y artefactos existentes (Sync Impact Report). Toda enmienda se registra
  en un commit propio.
- **Versionado** (semver):
  - MAJOR: eliminación o redefinición incompatible de principios o gobernanza.
  - MINOR: principio o sección nuevos, o guía ampliada materialmente.
  - PATCH: aclaraciones, redacción o erratas sin cambio semántico.
- **Cumplimiento**: `/speckit-plan` aplica el Constitution Check; `/speckit-analyze` señala
  conflictos con la constitución como severidad CRITICAL; toda revisión de código verifica los
  principios aplicables.

**Version**: 1.0.0 | **Ratified**: 2026-09-22 | **Last Amended**: 2026-09-22
