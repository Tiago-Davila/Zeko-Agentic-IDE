# Resultado de validación del MVP

## Revisión evaluada

`f825327` — 2026-09-15. Esta revisión incorpora las correcciones funcionales T094–T105
y su trazabilidad documental. El commit funcional más reciente es `5edd94f` (T105).

## Estado de convergencia

| Hallazgos | Estado | Evidencia |
|---|---|---|
| A01–A07 | Corregidos en la implementación | T094–T099; pruebas de conversación, canvas, configuración, Runtime, autorización, worktrees, efectos, diff y redacción. |
| A08–A11 | Corregidos en la implementación y pruebas | T100–T105; Lucene persistente, admisión segura, ingesta/contexto, contratos y recorridos E2E. |
| A12 | En seguimiento documental | Este informe y la auditoría actualizan la revisión y separan checks de aceptación pendiente. |

Las correcciones automatizadas se probaron con datos temporales y dobles deterministas
cuando el proveedor local no estaba disponible. Eso verifica los contratos y estados del
producto, pero no equivale a una medición de Docker/Ollama ni a un estudio de usabilidad.

## Checks ejecutados

| Área | Comando o prueba | Resultado |
|---|---|---|
| Frontend | `npm run lint` | Aprobado |
| Frontend | `npm run build` | Aprobado; incluye typecheck |
| Frontend | `npm run test -- --run` | Aprobado: 15 archivos, 27 pruebas |
| Frontend | `npm run test:e2e` | Aprobado: 13 pruebas simuladas, sin errores de proxy en las rutas ejercitadas |
| Backend | `./gradlew --offline test integrationTest contractTest --rerun-tasks -x installFrontend -x buildFrontend` | Aprobado: 68 unitarias, 55 de integración y 85 de contrato; 208 en total |
| Backend | `./gradlew --offline checkstyleMain checkstyleTest --rerun-tasks -x installFrontend -x buildFrontend` | Aprobado |
| Backend | `./gradlew --offline check build --rerun-tasks -x installFrontend -x buildFrontend` | Aprobado; genera `bootJar` |

Los reportes de Gradle están en `backend/build/test-results/{test,integrationTest,contractTest}`
como artefactos locales. Las pruebas de memoria incluyen reconstrucción desde SQLite y
Lucene, scope por proyecto/owner, exclusión de secretos y contrato de búsqueda; las de
ejecución incluyen autorización, efectos, conflictos, recuperación y estados visibles.

## Criterios de aceptación pendientes

- **NFR-007:** falta medir con una capacidad local real el intervalo entre confirmación y
  estado visible; el E2E actual verifica el camino simulado y correlacionado.
- **NFR-008:** falta ejecutar tres repeticiones por combinación de la matriz de capacidad
  con recursos locales autorizados.
- **SC-007:** falta evaluar los recorridos con diez participantes y registrar los resultados.
- La operación de Docker/Ollama reales y la ausencia exhaustiva de vulnerabilidades no se
  infieren de los checks deterministas.

## Conclusión

Las correcciones T094–T105 y sus checks están documentados, pero el MVP **no está
aceptado**. No debe declararse cerrado hasta aportar evidencia reproducible para NFR-007,
NFR-008 y SC-007. Las capacidades excluidas del MVP siguen fuera del alcance.
