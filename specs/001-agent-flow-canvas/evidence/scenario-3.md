# Quickstart — escenario 3 (Windows, Claude Code real)

**Estado: INCOMPLETO; T157 permanece sin marcar.** Las aprobaciones A/B se probaron por IPC, no haciendo clic en el canvas. El caso CLI TTY pasó después de corregir y cubrir una condición de carrera del scheduler.

- **Run A** `8de0f73f-59ed-7bab-8ed3-1a3c3ef5c329`: `impl` y `doc` Completed; `gate` Approved; `fix` Completed; run `all_succeeded`. Total Claude estimado: USD 0,0828028.
- **Run B** `9e146433-71dd-7ab1-9661-6e56080a6f16`: `impl` y `doc` Completed; `gate` Rejected (`REJECTED_BY_USER`); `fix` Skipped (`UPSTREAM_NOT_SUCCEEDED`, origen `gate`); run `some_not_succeeded`. Total estimado: USD 0,0655684.
- **Run C inicial, CLI con TTY** `436bdcb3-31ed-7ef9-b832-0ab7941f0889`: la CLI mostró el resumen de `impl` y pidió aprobación; se ingresó `a`. La decisión quedó Approved, pero la CLI terminó con el run todavía `running` y `fix` `pending`.
- **Run C repetido tras el hotfix, CLI con TTY** `08de2e13-bb6c-74b8-8c8e-b97a3cd3af6d`: se ingresó `a` en la misma sesión; `gate` Approved, `fix` Completed y run `finished`. Total Claude estimado: USD 0,0911.
- **Sin TTY:** `zeko run approval-quickstart < NUL` salió con código 3 y `APPROVAL_REQUIRES_TTY`; no inició otro run.
- **Harness descartado:** `d808521f-324c-741e-8339-c28ad4cd1b28` fue aprobado por un listener de A que seguía registrado; se reinició el host aislado antes de repetir B y no se cuenta como resultado.

Pendiente: repetir aprobación/rechazo mediante la UI del canvas. El fallo inicial de CLI se corrigió y cubre un test donde no hay otra operación activa cuando se decide la aprobación.
