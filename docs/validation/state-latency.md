# Protocolo de latencia de estado visible

## Objetivo

Medir el intervalo entre la confirmación de una capacidad local y la presentación del
estado correlacionado en Runtime Canvas. El objetivo provisional es menor que cinco
segundos. La generación del modelo queda fuera de este intervalo.

## Método reproducible

1. Iniciar el backend en loopback y abrir la UI desde el mismo origen local.
2. Crear una sesión local y una Execution conocida; registrar su identificador y el
   `X-Correlation-Id` de la confirmación de capacidad.
3. Emitir o recuperar el evento de estado correspondiente sin incluir la generación
   de Ollama en la marca inicial.
4. Registrar con reloj monotónico la marca de confirmación y la primera presentación
   visible del estado en Runtime Canvas.
5. Guardar el identificador de correlación, las dos marcas, el delta, sistema operativo,
   CPU, memoria, proveedor y versión de revisión en `work/evidence/T088/`.

## Comprobación automatizada disponible

`npm --prefix frontend run test:e2e -- state-latency.spec.ts` intercepta la respuesta
local de `runtime/snapshot`, conserva su identificador de correlación y adjunta el
delta hasta que Runtime Canvas muestra `RUNNING`. Esta prueba cubre solo el camino
visible simulado; no inicia un modelo ni acredita rendimiento de Docker u Ollama.

## Resultado operativo

No hay medición con una capacidad local real registrada para esta revisión. Por tanto,
NFR-007 permanece pendiente y el resultado simulado no se presenta como aceptación del
objetivo de cinco segundos.
