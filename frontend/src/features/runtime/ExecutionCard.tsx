import type { RuntimeExecution } from './runtimeApi';

export function ExecutionCard({ execution }: { readonly execution: RuntimeExecution }) {
  return <article aria-label={`Ejecución ${execution.attempt}`}><h3>Intento {execution.attempt}</h3><p>Estado: <strong>{execution.state}</strong> · último estado: {execution.knownState}</p><p>Plantilla: {execution.templateId} v{execution.templateVersion}</p><p>Efectos confirmados: {execution.effects.filter((effect) => effect.confirmed).length}</p></article>;
}
