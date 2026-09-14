export function DiffViewer({ attributableDiff, previousChanges }: { readonly attributableDiff: string; readonly previousChanges: string }) {
  return <section aria-label="Cambios de ejecución"><h3>Diff atribuible a la tarea</h3><pre>{attributableDiff || 'No hay cambios atribuibles confirmados.'}</pre><h3>Cambios previos preservados</h3><pre>{previousChanges || 'No se detectaron cambios previos.'}</pre></section>;
}
