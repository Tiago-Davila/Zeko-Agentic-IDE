import { StatePill } from '../../design/StatePill';
import type { RuntimeExecution } from './runtimeApi';

export function ExecutionCard({ execution }: { readonly execution: RuntimeExecution }) {
  const confirmed = execution.effects.filter((effect) => effect.confirmed).length;

  return (
    <article
      aria-label={`Ejecución ${execution.attempt}`}
      className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-ink-700 bg-ink-850 p-3"
    >
      <header className="flex items-center gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-chalk-400 uppercase">
          Intento {execution.attempt}
        </h3>
        <StatePill state={execution.state} className="ml-auto" />
      </header>

      {/* Texto contiguo a propósito: las pruebas leen "Estado: X · último estado: Y". */}
      <p className="text-[11px] text-chalk-400">
        Estado: <strong className="font-medium text-chalk-100">{execution.state}</strong> · último estado:{' '}
        <span className="font-mono text-chalk-200">{execution.knownState}</span>
      </p>
      <p className="truncate text-[11px] text-chalk-600">
        Plantilla: <span className="font-mono">{execution.templateId}</span> v{execution.templateVersion}
      </p>
      <p className="text-[11px] text-chalk-400">
        Efectos confirmados: <strong className="font-medium text-chalk-100">{confirmed}</strong>
      </p>
    </article>
  );
}
