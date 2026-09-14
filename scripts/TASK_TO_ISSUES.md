# Importar tareas de Zeko a GitHub Issues

Requisitos: Python 3.10+ sin paquetes adicionales. Para consultar GitHub o publicar, GitHub CLI (`gh`) instalado y autenticado con acceso a `Tiago-Davila/Zeko-Agentic-IDE`.

Ejecutar desde la raíz del repositorio. El script exige `--dry-run` o `--apply`; nunca publica por defecto.

## Vista previa

```powershell
python scripts/task_to_issues.py --dry-run --repo Tiago-Davila/Zeko-Agentic-IDE --expect-count 92
```

La vista previa es offline. `--check-remote` agrega consultas de solo lectura a todas las páginas de labels e issues abiertas/cerradas para detectar duplicados:

```powershell
python scripts/task_to_issues.py --dry-run --check-remote --repo Tiago-Davila/Zeko-Agentic-IDE --expect-count 92
```

Salida local en `work/task-to-issues/`: `summary.json`, `labels.json`, `issues.json` y un Markdown completo por task. `--output` permite cambiar ese directorio. El script solo sobrescribe sus archivos generados, no elimina otros archivos de la carpeta. No versionar previews/logs de trabajo por accidente.

## Publicar cuando corresponda

```powershell
python scripts/task_to_issues.py --apply --repo Tiago-Davila/Zeko-Agentic-IDE --expect-count 92
```

`--apply` crea labels faltantes y una issue por tarea, siguiendo orden topológico para enlazar dependencias ya creadas por número. No asigna personas, no crea PRs, no ejecuta tareas, no publica commits y no cierra issues por una casilla marcada en el Markdown.

Los enlaces son relaciones documentales `T001 — #123`, no dependencias nativas ni subissues de GitHub. Los links al archivo fuente requieren que `specs/001-zeko-mvp/tasks.md` esté disponible en la rama GitHub indicada por `--branch` (por defecto `feature/001-zeko-mvp`). El cuerpo de la issue conserva toda la información necesaria aunque la rama aún no esté publicada; el script no hace push.

## Labels

- Áreas: `front`, `backend`, `docs`, `security`, `testing`, `database`, `runtime`, `git`, `rag`, `ux`, `build`.
- Fases: `fase:0` hasta `fase:10`, obtenidas de los encabezados reales. Fase 0 es el cierre documental previo.
- Trazabilidad: `feature:001-zeko-mvp`, `story:US-001` a `story:US-007`, `priority:P1` y `priority:P2` donde la historia lo indique.
- Proceso: `parallel`, condicionado a dependencias y archivos sin solapamiento; `sdd:documentation` para fase 0.
- `source:completed` se usa solo si la fuente tiene una task marcada; no cambia estado remoto.

La clasificación parte de rutas, título y perfil de verificación. Una tarea puede tener varios labels; los conteos por área no suman necesariamente 92. Las descripciones y colores se incluyen en `labels.json`. Labels existentes se conservan sin sobrescribir colores o descripciones.

## Parser y reejecución

Se reconoce únicamente una cabecera completa `- [ ] T001 [P] [US1] Título — ` seguida de rutas entre backticks. Las marcas P y US son opcionales según fase. Se conserva la aceptación multilínea, las comillas, acentos y backticks. Las tablas, referencias a IDs en prosa y ejemplos dentro de bloques de código no generan issues.

Antes de cualquier publicación se validan campos, archivos, IDs únicos, relación fase/historia, dependencias existentes, ausencia de ciclos, perfiles de checks y conteo esperado. Un formato no reconocido produce error en lugar de perder tareas silenciosamente. Si se cambia el formato de tasks.md, adaptar el parser y sus pruebas antes de importar.

Cada issue lleva un marcador oculto exacto `<!-- zeko-task:001-zeko-mvp:T001 -->`. Al reejecutar se buscan issues abiertas y cerradas; las existentes se omiten sin editar título/cuerpo/labels/estado. Un título previo con el task ID pero sin marcador, o marcadores duplicados, detiene la importación para revisión; no se adopta ni duplica automáticamente.

El script no sincroniza cambios posteriores de una task sobre una issue existente. Revisar esos cambios por separado. Ante fallo parcial, detener y volver a ejecutar: los marcadores permiten recuperar las issues ya creadas. `publish-results.json` registra las creaciones confirmadas. No hay rollback remoto automático. Ejecutar una sola importación a la vez; el lock local solo protege procesos que comparten el mismo `--output`, no máquinas diferentes.

El contenido se pasa a `gh issue create` mediante archivo UTF-8 y `--body-file`; no se construyen comandos de shell con el texto. Referencias de GitHub CLI: [crear issues](https://cli.github.com/manual/gh_issue_create), [consultas paginadas](https://cli.github.com/manual/gh_api), [crear labels](https://cli.github.com/manual/gh_label_create).

## Pruebas del importador

```powershell
python -m unittest discover -s scripts -p test_task_to_issues.py -v
```

Son pruebas de esta herramienta de desarrollo. No implementan funciones del MVP ni modifican la spec, el plan o las tareas.
