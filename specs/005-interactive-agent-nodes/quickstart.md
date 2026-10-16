# Quickstart: validación de nodos interactivos en Windows (005)

**Plan**: [plan.md](./plan.md) | **Base**: [quickstart de 001](../001-agent-flow-canvas/quickstart.md)

Escenarios manuales de punta a punta en **Windows 10/11 nativo** (NFR-001). Cada uno indica qué
requisitos valida y cómo se verifica. Igual que en 001, **todo se verifica en el filesystem, en git y
en la tabla de procesos**, nunca por lo que diga el agente `[001b §B]`.

Los escenarios marcados **[005a]** dependen de capacidades que se declaran con valores conservadores
hasta cerrar el mini-spike ([research §S](./research.md#s--mini-spike-005a-propuesto)). Antes de
005a se ejecutan igual y deben dar el **resultado conservador** que se indica; después de 005a, el
resultado candidato.

## Preparación

1. Requisitos de 001 (quickstart §Preparación): Git, Claude Code y Codex instalados y autenticados,
   `codex.exe` nativo disponible, app de escritorio compilada.
2. Repositorio de prueba desechable **fuera de `%TEMP%`** con un commit inicial, `.gitattributes`
   (recomendado por R-15) y los archivos `src/signup/form.ts`, `docs/signup.md`.
3. Copiar [contracts/flow-file.example.yaml](./contracts/flow-file.example.yaml) a
   `.zeko/flows/implement-adjust-review.flow.yaml` y hacer commit.
4. Anotar el estado del repositorio original para SC-006:

   ```powershell
   git -C <repo> rev-parse HEAD
   git -C <repo> branch --show-current
   git -C <repo> status --porcelain
   Get-ChildItem <repo> -Recurse -File -Exclude .git | Get-FileHash | Sort-Object Path | Out-File before.txt
   ```

5. Para verificar procesos: tener a mano una consulta de `Win32_Process` (PID, PPID, `CreationDate`)
   y registrar el PID del agente desde el panel de diagnóstico del nodo (evento `session.opened` y
   filas de `process_tree` del segmento).

## 1. Predecesor → interactivo → sucesor (US1, US2, SC-001, SC-002, SC-006)

1. Abrir el proyecto y el flujo. Verificar que `adjust` se ve distinto de los nodos de agente, con
   su agente, modelo, alcance, `requiresChanges` y tiempo máximo (US1-1, FR-001). Cerrar y reabrir la
   app: la configuración es idéntica (FR-003).
2. Iniciar el run. `implement` y `docs` corren; cuando `implement` termina `completed`, `adjust` pasa
   a **Waiting for you** con la acción "Abrir sesión" visible sin menús y una notificación del
   sistema si la ventana no tiene foco (FR-005, NFR-005).
3. **Verificar que no hay proceso del agente** para `adjust` antes de abrir (SC-002, FR-006): ningún
   `codex.exe` nuevo en la tabla de procesos desde el inicio del run.
4. Esperar 2 minutos antes de abrir. Abrir la sesión: el tiempo restante mostrado es el límite
   completo (FR-010, US3-3).
5. Verificar el contexto mostrado (US1-9, FR-014, FR-017): instrucciones de `adjust` y el resultado
   completo de `implement` (estado, motivo, archivos observados, verificaciones, hallazgos, bloqueos,
   resumen). **Verificar que el agente no lo recibió**: la primera pantalla de la TUI no contiene
   ningún mensaje del usuario, y en el archivo de sesión del agente no hay mensajes del usuario
   hasta que se escribe uno.
6. Verificar el punto de partida (US2-7, FR-013): en la terminal pedir al agente que muestre
   `src/signup/form.ts`; el contenido incluye el cambio de `implement`. Comparar con
   `git -C <worktree> log -1` = `resultCommit` de `implement`.
7. Pedir al agente un cambio en `src/signup/form.ts` y declarar **Completed** desde Zeko.
8. Verificar:
   - `adjust` termina `completed`; su resultado muestra la declaración, la recap o "recap no
     disponible" **[005a]**, los archivos observados (incluye `src/signup/form.ts`) y listas vacías
     de verificaciones, hallazgos y bloqueos (FR-022);
   - `review` arranca y su prompt contiene el `PredecessorResult` de `adjust` con la misma forma que
     el de un nodo de agente (FR-023); su worktree parte del `resultCommit` de `adjust`
     (`git -C <wt-review> log -1`);
   - `docs` no se detuvo mientras `adjust` esperaba (US3-1).
9. Al terminar el run, repetir las consultas del paso 4 de Preparación: `HEAD`, rama actual,
   `status --porcelain` y hashes son idénticos (US2-11, SC-006). Las únicas huellas son ramas
   `zeko/*`.

## 2. Salida normal del agente (US2-2, FR-011) **[005a]**

1. Nuevo run hasta `adjust` en espera; abrir la sesión.
2. Salir del agente desde su propia terminal con su comando de salida.
3. **Antes de 005a** (`normalExit.codes = []`): el nodo queda `failed` con `PROCESS_ERROR` y el motivo
   visible. Es el resultado conservador documentado (research T5-08).
4. **Después de 005a**: el nodo registra la declaración provisional `COMPLETED` con origen
   "salida normal" y termina según las reglas (FR-019). El historial dice que terminó por salida
   normal, no por declaración del usuario (US4-1).
5. En los dos casos: ningún proceso del árbol registrado del segmento sigue vivo, y **no queda ningún
   prompt de shell** en la terminal (research I-01).

## 3. Declaración manual (US2-1, FR-018)

1. Abrir la sesión, pedir un cambio y, **mientras el agente responde**, declarar **Blocked**.
2. Antes de 005a (`busyDetection = none`): Zeko pide confirmar el cierre inmediato y avisa que la
   última respuesta puede quedar incompleta. Después de 005a (si hay detección): ofrece "Cerrar ahora"
   o "Esperar a que termine".
3. Confirmar. Verificar: el agente se cierra (ningún proceso del árbol vivo), se hace el commit del
   motor (`git -C <wt> log -1` con autor `Zeko <zeko@localhost>`) y el nodo queda `blocked` con
   `USER_DECLARED_BLOCKED`. Los dependientes quedan `skipped` con motivo visible (US3-2).
4. Repetir con **Failed** → `failed` con `USER_DECLARED_FAILED`.
5. Repetir con **Completed**, `requiresChanges: true` y sin pedir cambios: el nodo queda `completed`
   y muestra la inconsistencia `COMPLETED_WITHOUT_CHANGES` en el nodo y en el historial (US2-9,
   FR-021). Con `requiresChanges: false` no aparece.
6. Tras cerrar, intentar declarar de nuevo: la acción no está disponible (`SESSION_NOT_ACTIVE`).

## 4. Cancelación (US3-5, FR-025, NFR-004, SC-005)

1. Abrir la sesión y pedir al agente que ejecute en su terminal un comando que agregue una línea por
   segundo a `progreso.txt` durante 60 s (tarea de `[001 §7]`).
2. Cuando el archivo tenga 3 o 4 líneas, cancelar el nodo desde el canvas y anotar la hora.
3. Verificar en menos de **10 s** desde la cancelación:
   - ningún `(pid, creationTime)` registrado en `process_tree` para el segmento sigue vivo;
   - `progreso.txt` deja de crecer (medir 10 s más);
   - el proceso del engine host y la app siguen vivos.
4. El nodo queda `cancelled`, su copia aislada figura **no confiable**, no hay commit del motor y sus
   dependientes quedan `skipped` (FR-049 de 001, FR-024).
5. Intentar reabrir `adjust`: Zeko lo impide y explica que la copia no es confiable (caso límite).
6. Repetir cancelando un nodo en **Waiting for you**: pasa a `cancelled` sin haber lanzado nada.

## 5. Cierre de la app con sesiones activas (US3-6, FR-026)

1. Flujo con **dos** nodos interactivos independientes; abrir las dos sesiones y dejar en cada una un
   comando largo como el del escenario 4.
2. **Cierre ordenado**: cerrar la app. Al reabrir: el run y los dos nodos figuran `interrupted`, las
   dos copias figuran **no confiables**, y ningún proceso registrado de los dos árboles sigue vivo.
3. **Cierre abrupto**: repetir y terminar la app con `taskkill /PID <main> /F` (solo el PID de la app
   anotado, nunca por nombre). Antes de reabrir, anotar qué procesos de los árboles siguen vivos
   (dato para U5-14). Reabrir: la recuperación los termina, y el resultado es el mismo del paso 2.
4. Verificar que ningún otro proceso del usuario fue afectado (comparar la tabla de procesos antes y
   después, excluyendo los árboles registrados).

## 6. Reapertura con dependientes (US2-3, US2-4, FR-011, FR-023a) **[005a para la reanudación]**

1. Correr el flujo completo hasta que `review` esté `running` (o `completed`).
2. Reabrir `adjust`. Verificar:
   - si `review` estaba corriendo, queda cancelado con `UPSTREAM_REOPENED` y sin procesos vivos;
   - el resultado anterior de `adjust` y el de `review` aparecen en el historial como **reemplazados**;
   - `docs` (rama independiente) conserva su resultado;
   - si el run estaba `finished`, vuelve a **en curso**;
   - el tiempo restante mostrado es el límite menos el tiempo activo ya usado (FR-010).
3. Conversación: **antes de 005a** se abre una conversación nueva en la **misma** copia y el nodo
   muestra `RESUME_UNAVAILABLE`; **después**, el agente responde un dato que solo estaba en la
   conversación anterior. En los dos casos, `git -C <wt> log` muestra el commit anterior del motor:
   es la misma copia.
4. Hacer otro cambio y declarar **Completed**. Zeko pide confirmación para reejecutar `review`.
   - Confirmar: `review` corre en un worktree **nuevo** cuya base es el **nuevo** `resultCommit` de
     `adjust`, y su prompt contiene el resultado nuevo, no el reemplazado.
   - En otra corrida, rechazar: `review` queda `skipped` con `RERUN_DECLINED`.
5. Dejar vencer el tiempo de `adjust` en una sesión (límite corto, p. ej. 1 minuto) e intentar
   reabrir: `REOPEN_TIME_EXHAUSTED`.

## 7. Cambio fuera de alcance (US2-10, FR-020)

1. En `adjust` (alcance `src/signup/**`, `tests/signup/**`), pedir al agente que modifique también
   `README.md`.
2. Declarar **Completed**.
3. Verificar: el nodo queda `blocked` con `WRITE_OUTSIDE_SCOPE` y la lista contiene `README.md`,
   aunque la declaración fue "completado" (FR-019). Los archivos observados salen del diff de git de
   la copia (`git -C <wt> diff --name-status <base> <result>`), no de lo que diga el agente.
4. `review` queda `skipped`.
5. Confinamiento mostrado: antes de abrir la sesión, el nodo muestra su nivel real y las
   restricciones que el agente no admite (FR-015, FR-016). Antes de 005a: `unconfined` con
   `INTERACTIVE_CONFINEMENT_UNVERIFIED`.

## 8. Recap no disponible (US2-6, FR-018) **[005a para el caso con recap]**

1. Abrir la sesión y declarar **Completed** sin escribir nada al agente.
2. Verificar: el resultado conserva su forma, el resumen dice **"recap no disponible"** en el nodo y
   en el historial, y ningún campo contiene texto inventado. Los archivos observados y el estado
   final siguen siendo válidos.
3. Después de 005a, repetir conversando: el resumen es la última respuesta completa del agente, igual
   a la que muestra su archivo de sesión, y no hay ningún otro fragmento de la conversación en la base
   (buscar en `zeko.db` una frase del primer mensaje del usuario: no aparece; FR-028, US4-3).
4. Redacción (US4-2, SC-007): pedir al agente que responda con una cadena con forma de clave
   (`sk-ant-…` inventada) y un email de prueba como última respuesta, y declarar. En el historial y
   en `zeko.db` aparecen `[REDACTED:api_key]` y `[REDACTED:email]`.

## 9. CLI con nodo interactivo (US3-7, FR-029)

```powershell
zeko validate implement-adjust-review --project <repo>; $LASTEXITCODE
zeko run implement-adjust-review --project <repo> --json; $LASTEXITCODE
```

Verificar ([contracts/cli.md](./contracts/cli.md)):

- los dos comandos salen con **2** e informan `INTERACTIVE_NODE_REQUIRES_DESKTOP` en el nodo `adjust`,
  con archivo, línea y columna;
- `zeko run` no creó ningún run (`zeko runs list` no lo muestra), no creó worktrees ni ramas
  (`git -C <repo> branch --list "zeko/*"` sin cambios) y no lanzó ningún agente, aunque `implement`
  y `docs` no dependan de `adjust`.

## 10. Latencia con carga (NFR-002, NFR-003, SC-003, SC-004)

Con el build de desarrollo (sonda de latencia activa, [contracts/ipc.md](./contracts/ipc.md)):

1. Flujo de prueba con **4 nodos interactivos** del agente simulado en modo eco y **8 nodos de
   agente no interactivos** del agente simulado emitiendo a la tasa de
   `spikes/001-claude-chain/samples/q1-verbose-raw.jsonl` ×10 (research R5-01, R5-15).
2. Abrir las 4 sesiones y dejar las 8 corriendo.
3. En cada sesión, escribir 200 caracteres a ritmo humano (≈ 8 teclas/s) mientras se cambia de
   terminal y se mueve el canvas.
4. Resultado: la sonda registra la latencia tecla → eco parseado en xterm. **Todas** las pulsaciones
   < 100 ms (SC-003). Además, el canvas responde a arrastre y selección sin bloqueos visibles y los
   cambios de estado llegan en < 1 s (SC-004, NFR-003 de 001).
5. Repetir el paso 3 con un agente real en una de las sesiones, como verificación de humo (sin
   criterio numérico: incluye la latencia propia de la TUI del agente).

Si el paso 4 falla, se aplica la alternativa diseñada de research R5-01 (proceso de terminal aparte)
y se repite.
