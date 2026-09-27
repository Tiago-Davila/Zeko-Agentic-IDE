# Quickstart — escenario 1 (Windows, Claude Code real)

- **Resultado:** PASS; ejecución secuencial completa.
- **Fecha:** 2026-09-27 (America/Buenos_Aires).
- **Aplicación:** build empaquetado de Windows, Zeko; Claude Code 2.1.283.
- **Autenticación:** suscripción de Claude, autenticada y verificada en preflight.
- **Fixture:** `C:\Users\Tiago\zeko-fixture`; HEAD original `0ade709585ec1b01106bd7e778c8b18acfdea5d8`.
- **Canvas tras reabrir:** flujo `seq` conservó `goal → a → b`, dos aristas y sus posiciones; se mostró como guardado.
- **Run:** `23a91739-71ec-7329-8d80-5e3214f6a6bf`; base commit idéntico a HEAD; `finished / all_succeeded`.
- **Linaje:** `a` completó y confirmó `src/math.js`; después `b` se ejecutó, reportó que verificó el resultado de `a` y no necesitó cambios.
- **Diff de `a`:** `src/math.js`, `M`, `eolOnly: false`; el campo de anotación está presente. No hubo un cambio exclusivamente de finales de línea en este quickstart.
- **Costos de Claude:** `estimated` (precio de lista); `a` USD 0,0559546, `b` USD 0,0187484; total USD 0,074703.
- **Consumo reportado:** 10 input, 1.445 output, 41.065 cache-read y 13.005 cache-creation tokens.
- **Integridad:** el repositorio fuente del fixture permaneció en HEAD; no se modificaron sus archivos de código.

Nota de ejecución: un intento previo, antes de iniciar Claude, confirmó que el runtime rechaza worktrees bajo `%TEMP%`. Se trasladó el `LOCALAPPDATA` dedicado de la prueba a `C:\Users\Tiago\zeko-e2e-state`, fuera de `%TEMP%`; el run documentado arriba es el exitoso. El `run.start` respondió con un error de clonación IPC pese a iniciar el run; se verificó el resultado completo mediante `run.get` y los eventos persistidos.
