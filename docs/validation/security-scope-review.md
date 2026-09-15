# Revisión de controles transversales y alcance

## Controles verificados

- Una aprobación invalidada o de una revisión distinta detiene el dispatcher antes de
  consultar el worktree o invocar un adaptador local.
- El backend mantiene su binding en loopback y rechaza origen, host o sesión local no
  autorizados antes de resolver una mutación.
- Las rutas bajo `/api` no se sirven como fallback de la SPA.
- Las fuentes de memoria fuera de raíz, `.env`, extensiones no admitidas o contenido con
  marcadores sensibles se rechazan antes de indexación.
- Una entrada de memoria sensible o no vigente se filtra aunque un índice la devuelva.

## Exclusiones confirmadas del MVP

No se incorporaron MCP, herramientas creadas por usuarios, marketplace, canvas de
arquitectura, architecture-to-code, modo servidor/equipo, ejecución remota,
sincronización cloud, multiusuario ni RBAC. La SPA se sirve por el backend local en
loopback y no publica un servicio de red.

## Resultado

Las pruebas de esta revisión verifican rechazo de bypass de aprobación y exposición de
secretos sintéticos. Los controles ya existentes de sesión local, worktrees y commits
autorizados deben ejecutarse en la validación completa; una falla no se resuelve
relajando estos controles y requiere una task planificada.
