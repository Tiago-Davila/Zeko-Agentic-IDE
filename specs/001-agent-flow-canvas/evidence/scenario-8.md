# Quickstart — escenario 8 (uso simulado, sin proveedores reales)

- **Resultado:** PASS automatizado.
- **Prueba:** `packages/runtime/test/fake-usage.test.ts` (`development fake usage`).
- **Simulación:** `development: true`, `fakeUsage: 0.95`; solo el adaptador de Claude recibe el dato simulado. La ruta de producción ignora el override.
- **Flujo:** el nodo Claude permaneció Pending con `USAGE_NEAR_LIMIT`; el nodo Codex completó. El run emitió `run.held`, siguió cancelable y terminó Cancelled al cancelarlo.
- **Lanzamientos:** Claude 0; Codex 1. Adaptadores `ScriptedAdapter`; no se invocó ningún proveedor ni se consumió cuota.
- **Verificación:** `pnpm exec vitest run --project unit packages/runtime/test/fake-usage.test.ts packages/core/test/engine/usage-gate.test.ts` (4 tests passed); `pnpm typecheck`; `pnpm --filter @zeko/desktop build`.
