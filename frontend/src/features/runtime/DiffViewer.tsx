export function DiffViewer({
  attributableDiff,
  previousChanges,
}: {
  readonly attributableDiff: string;
  readonly previousChanges: string;
}) {
  return (
    <section aria-label="Cambios de ejecución" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wide text-chalk-400 uppercase">
          Diff atribuible a la tarea
        </h3>
        <pre className="overflow-x-auto rounded-[var(--radius-control)] border border-ink-700 bg-ink-950 p-2 font-mono text-[11px] leading-relaxed whitespace-pre text-chalk-200">
          {attributableDiff || 'No hay cambios atribuibles confirmados.'}
        </pre>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wide text-chalk-400 uppercase">
          Cambios previos preservados
        </h3>
        <pre className="overflow-x-auto rounded-[var(--radius-control)] border border-ink-700 bg-ink-950 p-2 font-mono text-[11px] leading-relaxed whitespace-pre text-chalk-400">
          {previousChanges || 'No se detectaron cambios previos.'}
        </pre>
      </div>
    </section>
  );
}
