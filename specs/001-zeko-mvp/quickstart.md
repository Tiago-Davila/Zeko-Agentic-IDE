# Guía de validación futura: Zeko Agentic IDE - MVP local-first

## Propósito

Esta guía define cómo validar el MVP una vez implementado. Los comandos descritos son
objetivos de la implementación; no existen todavía y no deben ejecutarse durante la
fase de plan. Los detalles de datos y contratos están en [data-model.md](data-model.md),
[openapi.yaml](contracts/openapi.yaml) y [websocket.md](contracts/websocket.md).

## Prerrequisitos de la futura implementación

- JDK 21 y un entorno Windows/PowerShell como plataforma inicial de validación.
- Git disponible en `PATH`; dos repositorios locales de prueba, sin secretos.
- Node.js 22.12+ y npm para el frontend local.
- Docker local y Ollama local solo para los escenarios que los requieran. Su ausencia
  es un escenario válido de recuperación, no motivo para desactivar controles.
- Espacio local para la base SQLite, índice Lucene y worktrees temporales.

No se usan credenciales reales, servicios cloud ni repositorios remotos. Los directorios
de prueba deben estar fuera de datos que el usuario no quiera modificar.

## Comandos previstos después de implementación

```powershell
# Backend
.\backend\gradlew.bat check build
.\backend\gradlew.bat bootRun

# Frontend
npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run dev

# Validación completa prevista
.\backend\gradlew.bat integrationTest
.\backend\gradlew.bat contractTest
npm --prefix frontend run test:e2e
```

El backend es un build Gradle independiente bajo `backend/`; no existe un subproyecto
`:backend` ni wrapper Gradle en la raíz. Las versiones frontend quedan fijadas en el
lockfile versionado creado por setup. Cada tarea conserva su evidencia redactada en
`work/evidence/<task-id>/`, fuera de `specs/`.

## Preparación de datos locales

1. Crear dos repositorios Git temporales, `repo-a` y `repo-b`, con cambios iniciales
   distinguibles y un archivo no secreto en cada uno.
2. Iniciar backend y frontend locales. La UI debe mostrar que el backend está en origen
   loopback; no debe exponerse a una red externa.
3. Crear un Project y asociar ambos repositorios. Registrar las rutas usadas para
   verificar que se mantienen separadas.
4. Crear una plantilla, una instancia y una skill basada en un `SKILL.md` de prueba
   dentro del Project. No promover nada a global sin acción explícita.

## Recorridos de validación E2E

### V-001 — Proyecto, agentes y ciclo principal

Crear un Project con `repo-a` y `repo-b`; configurar plantilla, instancia y binding de
skill; enviar una instrucción al PM o al agente; crear Task en `repo-a`; aprobar la
acción requerida; completar ejecución y revisar resultado/diff. El resultado esperado
es que Project, Repository, Task, agente, Execution y diff permanecen identificables.

### V-002 — Actualización de plantilla sin override

Con una Execution activa, aceptar una actualización de AgentTemplate para su instancia.
El resultado esperado es que la Execution activa conserva snapshot original; una nueva
Execution usa la versión aceptada. La UI no ofrece overrides configurables por instancia.

### V-003 — Permiso, autonomía, follow-ups y aprobación obsoleta

Configurar `Ask Approval`; proponer una acción mutante y revisar que el prompt muestra
agente, task, recurso, acción, alcance y efectos. Cambiar la acción antes de responder.
El resultado esperado es Approval invalidada y una nueva solicitud; una respuesta tardía
no ejecuta la acción nueva. Cambiar autonomía no debe cambiar PermissionMode.

Con una instrucción vigente, completar el trabajo inicial en cada modo. El resultado
esperado es que `Manual` no cree follow-up, `Assisted` muestre una propuesta y solo
cree la Task tras confirmación explícita, y `Autonomous` pueda crear un follow-up
vinculado con la instrucción vigente. En todos los casos, una acción del follow-up
sigue la misma política de permisos y approvals.

### V-004 — Worktrees concurrentes y conflicto manual

Ejecutar dos Tasks en worktrees distintos y comprobar aislamiento. Solicitar un segundo
escritor sobre el worktree ya reservado. El resultado esperado es rechazo, Task `BLOCKED`,
worktrees y cambios preservados, y opciones manuales de cancelar, reasignar o resolver.

### V-005 — Cancelación, proveedor indisponible y reintento

Solicitar cancelación de una Execution activa y comprobar que el estado final solo se
muestra tras confirmación. Simular indisponibilidad de Docker y luego de Ollama. El
resultado esperado identifica proveedor, último estado y efectos conocidos, sin éxito
falso. Tras recuperar proveedor, el usuario puede crear un reintento manual; no hay
reanudar automático.

### V-006 — Memoria con alcance y secretos

Indexar fuentes autorizadas no secretas en dos Projects. Buscar desde una conversación
del primero. El resultado esperado solo devuelve fuentes permitidas con nivel/ownership,
distingue vacío de error y no concede permisos a partir de contexto recuperado. Un valor
marcado secreto no se indexa ni aparece en log, prompt, diff o resultado.

### V-007 — UX y mediciones provisionales

Evaluar Agents Canvas y Runtime Canvas como tabs separadas. En recorridos de carga,
espera, error, desconexión y finalización, registrar si el usuario identifica estado y
acción disponible. Medir desde la confirmación local hasta actualización visible para
NFR-007, excluyendo generación de modelo. Para SC-007, documentar muestra, tarea,
método y resultado; no afirmar cumplimiento antes de realizar la evaluación.

El usuario local responsable del Project aporta la decisión de producto y participa en
la evaluación de recorridos; el revisor técnico registra evidencia, condiciones de
hardware y límites de cada medición. Ninguna medición o evaluación se marca aprobada
sin sus resultados reales.

## Checks de cierre por task

Cada task futura ejecuta formatter/lint, build, pruebas unitarias, integración o
contrato y E2E/quickstart aplicables. Las reglas de permisos, approvals, autonomía,
worktrees, trazabilidad y boundaries públicos requieren pruebas. Docker/Ollama pueden
tener validación local condicional, pero sus dobles deterministas siguen siendo parte
del check; la indisponibilidad no autoriza omitir controles.

La evidencia se registra fuera de `specs/` junto a la task, diff y commit. Una task no
está terminada hasta que sus checks aplicables pasan y se conserva trazabilidad.
