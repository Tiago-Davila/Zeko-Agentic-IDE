# Quickstart — escenario 2 (Windows, Claude Code real)

- **Resultado:** PASS en límites de concurrencia 8 y 1.
- **Fecha:** 2026-09-27 (America/Buenos_Aires).
- **Fixture/flow:** `C:\Users\Tiago\zeko-fixture`, flujo `parallel-quickstart`; `x` es independiente, `y` solicita una especificación inexistente y `z` depende de `y`.
- **Límite 8 — run `0cf5c37e-8ebd-7d2d-ae55-76aa3ea0645d`:** `x` y `y` entraron en Running con 68 ms de diferencia; `y` terminó Blocked (`AGENT_REPORTED_BLOCKED`), luego `z` Skipped (`UPSTREAM_NOT_SUCCEEDED`, source `y`), y `x` terminó Completed mientras `y` estaba bloqueado. Run `some_not_succeeded`.
- **Límite 1 — run `6b409611-f0bc-7fc9-924f-b5fa7cbfc064`:** `x` entró en Running y terminó Completed antes de que `y` entrara en Running; luego `y` Blocked (`AGENT_REPORTED_BLOCKED`) y `z` Skipped por `y`. Run `some_not_succeeded`.
- **Costos Claude (estimados):** límite 8: USD 0,0355354; límite 1: USD 0,0359196.
- **Estado posterior:** se restauró `concurrencyLimit: 8` en el fixture.

En ambos inicios, `run.start` respondió con un error de clonación IPC aunque el motor inició el run; los estados finales y las marcas temporales se verificaron en los registros persistidos con `run.get`/`run.list`.
