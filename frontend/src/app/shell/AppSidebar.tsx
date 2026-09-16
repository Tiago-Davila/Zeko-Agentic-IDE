/*
 * Rail de navegacion deliberadamente vacio. El usuario pidio la sidebar sin contenido
 * ni iconos por ahora, asi que aca solo se reserva el ancho y el borde; los destinos
 * se agregan cuando esten definidos.
 */
export function AppSidebar() {
  return (
    <nav
      aria-label="Navegación principal"
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-ink-700 bg-ink-900 py-2"
    />
  );
}
