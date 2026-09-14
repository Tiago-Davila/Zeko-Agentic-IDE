# Checklist de calidad funcional: Zeko Agentic IDE - MVP local-first

**Propósito**: Revisar rigurosamente la completitud, claridad, consistencia,
verificabilidad y cobertura de los requisitos del MVP antes de planificación.
**Creada**: 2026-09-13
**Feature**: [spec.md](../spec.md)

**Uso**: Este checklist evalúa la calidad de lo especificado. No valida una
implementación, no reemplaza los tests posteriores y no aprueba la feature por sí solo.

## Aclaraciones, alcance y trazabilidad

- [x] CHK001 ¿Las nueve decisiones de `## Clarificaciones` están reflejadas sin contradicción en FR-021, FR-041 a FR-044 y FR-062 a FR-063? [Consistencia, Spec §Clarificaciones, §FR-021, §FR-041–FR-044, §FR-062–FR-063]
- [x] CHK002 ¿La actualización seleccionable de `AgentTemplate` define cuándo entra en vigor para una instancia y cuál es la configuración trazable antes y después de aceptarla? [Claridad, Spec §FR-021]
- [x] CHK003 ¿Los cambios de plantilla para instancias con una ejecución activa están definidos o se declaran explícitamente fuera de alcance? [Cobertura, Spec §FR-021, §US-005]
- [x] CHK004 ¿Las historias US-001 a US-007, los FR/NFR y los SC tienen relaciones suficientes en `## Trazabilidad de alcance` para planificar sin inventar comportamiento? [Trazabilidad, Spec §Historias de usuario y verificación, §Trazabilidad de alcance]
- [x] CHK005 ¿Cada requisito expresa una obligación atómica y las prioridades P1/P2 evitan ocultar requisitos obligatorios o exclusiones aprobadas? [Claridad, Spec §Requisitos, §Objetivo, actores y límites]
- [x] CHK006 ¿La spec distingue el alcance del producto de Spec Kit y de las herramientas de desarrollo, sin convertirlas en funcionalidades del IDE? [Alcance, Spec §Objetivo, actores y límites, §FR-076]

## Proyectos, agentes, plantillas y skills

- [x] CHK007 ¿Los requisitos de Project definen múltiples repositorios, persistencia y la identificación del repositorio objetivo de cada task, cambio y ejecución? [Completitud, Spec §FR-001–FR-008]
- [x] CHK008 ¿Las definiciones de `AgentTemplate` y `AgentInstance` expresan responsabilidades distintas y consistentes con su relación de actualización seleccionable? [Consistencia, Spec §Entidades conceptuales, §FR-010–FR-011, §FR-021]
- [x] CHK009 ¿Las definiciones de `SkillDefinition` y `AgentSkillBinding` describen con claridad la diferencia entre una definición reutilizable y su asociación concreta? [Claridad, Spec §Entidades conceptuales, §FR-015–FR-018]
- [x] CHK010 ¿La spec define qué sucede con configuraciones propias de una instancia al aceptar una actualización de plantilla, o declara ese caso fuera de alcance? [Cobertura, Spec §FR-021]
- [x] CHK011 ¿El alcance de proyecto por defecto, las asociaciones y la promoción global explícita de agentes y skills están definidos sin que la memoria global implique promoción automática? [Consistencia, Spec §FR-018–FR-020, §Modelo de producto y memoria, §Supuestos]
- [x] CHK012 ¿Las relaciones visibles en Agents Canvas están definidas funcionalmente sin transformarlas en workflows ejecutables? [Claridad, Spec §US-002, §FR-012–FR-014]

## Permisos, autonomía y autoridad

- [x] CHK013 ¿Las reglas de `Ask Approval`, `Auto Approve` y `Full Access` permiten clasificar una acción local, de red, mutante o destructiva sin conflicto entre FR-034 y FR-041 a FR-043? [Consistencia, Spec §FR-030–FR-043]
- [x] CHK014 ¿Los requisitos de `Manual`, `Assisted` y `Autonomous` explican el grado de iniciativa de cada modo sin derivar permisos de autonomía? [Claridad, Spec §FR-031–FR-044, §US-004]
- [x] CHK015 ¿La spec define el resultado requerido si la acción, el recurso o el alcance cambian mientras una aprobación está pendiente? [Cobertura, Spec §FR-035, §FR-038–FR-040]
- [x] CHK016 ¿La aprobación y la denegación tienen alcance, efectos y vínculo con la acción exacta suficientes para impedir una alternativa equivalente no autorizada? [Verificabilidad, Spec §FR-038–FR-040, §US-004]
- [x] CHK017 ¿Filesystem, terminal, network, secretos y acciones destructivas se tratan de forma consistente entre requisitos funcionales, NFR y restricciones constitucionales? [Consistencia, Spec §FR-034, §FR-041–FR-043, §NFR-004–NFR-005]
- [x] CHK018 ¿La precedencia de instrucciones y los overrides del usuario definen qué se registra y preservan la prohibición de ampliar permisos de forma implícita? [Completitud, Spec §FR-026–FR-029, §US-003]
- [x] CHK019 ¿Los requisitos mantienen al PM como coordinador que informa al usuario sin impedir instrucciones directas y su trazabilidad? [Consistencia, Spec §FR-022–FR-025, §US-003]

## Ejecución, concurrencia y Git

- [x] CHK020 ¿Los estados pendiente, ejecutando, esperando aprobación, completada, fallida y cancelada tienen transiciones observables suficientemente definidas para distinguir estado conocido, resultado y error? [Claridad, Spec §US-005, §FR-047–FR-052, §NFR-003]
- [x] CHK021 ¿La cancelación diferencia solicitud, resultado real, continuidad de la operación y efectos ya producidos sin prometer rollback? [Consistencia, Spec §FR-049–FR-052, §US-005]
- [x] CHK022 ¿El último estado conocido, los efectos registrados y el reintento manual explícito están definidos para caída de UI, proveedor local y proceso, sin reanudación automática? [Cobertura, Spec §FR-062–FR-063, §US-007]
- [x] CHK023 ¿La spec identifica si Docker y Ollama tienen requisitos de indisponibilidad distintos o confirma que ambos comparten el tratamiento genérico de proveedor local? [Claridad, Spec §Alcance y stack del MVP, §FR-045, §FR-062]
- [x] CHK024 ¿La exclusividad de un worktree por repositorio + task y la prohibición de dos agentes sobre el mismo worktree son coherentes en historias, requisitos y casos borde? [Consistencia, Spec §US-005, §FR-053–FR-055, §Casos borde]
- [x] CHK025 ¿Los requisitos describen una salida funcional para conflictos de asignación o integración, además de exponerlos y no sobrescribir cambios? [Completitud, Spec §FR-055–FR-056]
- [x] CHK026 ¿La trazabilidad entre requisito, task, agente, ejecución, repositorio, worktree, diff y commit es consistente con una tarea, un diff, un commit y con división por repositorio? [Trazabilidad, Spec §FR-057–FR-061, §Trazabilidad de alcance]

## Memoria, UX y escenarios

- [x] CHK027 ¿Los niveles global, project, agent y conversation definen pertenencia, visibilidad y recuperación de forma coherente con el aislamiento de proyectos? [Completitud, Spec §FR-064–FR-070, §Entidades conceptuales, §NFR-002]
- [x] CHK028 ¿La spec especifica límites de acceso al contexto, identificación de fuentes y protección de secretos sin que el contexto otorgue autoridad o permisos? [Consistencia, Spec §FR-065–FR-070, §NFR-004]
- [x] CHK029 ¿Las fuentes admitidas, la actualización del contexto y la precedencia detallada entre memorias se declaran como decisiones posteriores sin exigir ingestión avanzada ni ocultar un bloqueo funcional? [Ambiguity, Spec §Supuestos, §FR-064–FR-070]
- [x] CHK030 ¿Agents Canvas y Runtime Canvas permanecen como superficies separadas con propósitos inequívocos en historias, requisitos y criterios de aceptación? [Consistencia, Spec §US-002, §US-007, §FR-071]
- [x] CHK031 ¿Los requisitos identifican el contexto necesario para decidir —proyecto, repositorio, agente, task, permiso y autonomía— en todos los recorridos donde sea relevante? [Cobertura, Spec §FR-072, §US-001, §US-004, §US-005]
- [x] CHK032 ¿Los approval prompts especifican de forma suficiente acción, recursos, alcance, efectos esperados y alternativas para una decisión informada? [Claridad, Spec §FR-040, §Permisos y autonomía]
- [x] CHK033 ¿Los criterios de aceptación y casos borde cubren recorrido principal, rechazo, conflicto, ausencia de contexto, falla, interrupción y cambios previos del usuario con resultados observables? [Cobertura, Spec §Historias de usuario y verificación, §Casos borde]

## NFR, restricciones y exclusiones

- [x] CHK034 ¿Los objetivos provisionales de actualización de estado, capacidad y usabilidad indican condiciones de medición, responsables de validación y límites respecto del tiempo de generación del modelo? [Verificabilidad, Spec §NFR-007–NFR-008, §SC-007]
- [x] CHK035 ¿Persistencia local, aislamiento, observabilidad veraz, seguridad de secretos y autorización de acciones se expresan con resultados comprobables y sin depender de términos vagos? [Claridad, Spec §NFR-001–NFR-006]
- [x] CHK036 ¿Las restricciones heredadas de stack y arquitectura se mantienen como límites de planificación, sin introducir decisiones de implementación en los requisitos funcionales? [Consistencia, Spec §Objetivo, actores y límites, §Alcance y stack del MVP]
- [x] CHK037 ¿Las exclusiones de MCP, custom tools de usuario, Architecture/Draw.io canvas, architecture-to-code, marketplace, team/server mode, ejecución remota, cloud sync, multiusuario y RBAC están completas y no se reintroducen en historias o requisitos? [Alcance, Spec §Objetivo, actores y límites, §FR-020, §FR-076]
- [x] CHK038 ¿Las reglas de proceso sobre Conventional Commits, ausencia de `Co-authored-by` y firmas de IA permanecen diferenciadas de funcionalidades del producto? [Consistencia, Spec §FR-059–FR-061, §Objetivo, actores y límites]

## Notas

- Revisión documental completada el 2026-09-13 contra la spec, plan, research,
  modelo de datos y contratos vigentes. Las marcas acreditan calidad y trazabilidad
  documental; no sustituyen la evidencia de implementación, rendimiento o usabilidad.
