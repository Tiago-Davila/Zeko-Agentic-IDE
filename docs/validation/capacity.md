# Protocolo de capacidad local

## Propósito y límite

Este protocolo mide capacidad local bajo una carga declarada. No inicia agentes reales,
no usa servicios remotos y no permite afirmar capacidad antes de obtener resultados
reproducibles con recursos autorizados.

## Matriz de carga

| Dimensión | Valores por ejecución |
|---|---|
| Agentes | 1, 2, 4 |
| Repositorios Git temporales | 1, 2 |
| Tamaño por repositorio | 1 MiB, 10 MiB, 100 MiB |
| Modelo | Ninguno para preflight; Ollama local solo con recursos autorizados |
| Repeticiones | 3 por combinación |

Los repositorios se crean dentro de un directorio temporal aislado. Cada corrida debe
registrar la revisión, sistema operativo, CPU, memoria, versión de Git, versión de Java,
proveedor usado, concurrencia, duración, ejecuciones completadas/fallidas y cualquier
límite observado. Los resultados se guardan en `work/evidence/T089/` sin secretos.

## Preflight ejecutado

El 2026-09-15 se ejecutó la comprobación local `CapacityMeasurementTest` sin agentes ni
proveedores: 8 procesadores disponibles, 21 GiB de memoria visible, Java 21.0.12.1,
Node 26.5.0 y Git 2.55.0. Esta observación verifica que el protocolo puede registrar el
perfil de máquina; no mide throughput, no evalúa Ollama/Docker y no acredita NFR-008.

## Ejecución autorizada futura

1. Reservar explícitamente los recursos locales y seleccionar una fila de la matriz.
2. Crear repositorios temporales no secretos y anotar su tamaño inicial.
3. Ejecutar la carga tres veces, sin incluir preparación o descarga de modelos en el
   tiempo medido.
4. Registrar cada resultado, fallos y límites; no promediar ni omitir ejecuciones
   fallidas.
5. Comparar las corridas únicamente contra mediciones registradas de la misma máquina.

La capacidad del MVP queda pendiente hasta completar estas mediciones reales.
