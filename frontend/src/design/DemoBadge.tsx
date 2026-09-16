import { cn } from './cn';

interface DemoBadgeProps {
  readonly className?: string | undefined;
  // Que representa la maqueta, para que no se confunda con estado real.
  readonly detail?: string | undefined;
}

/*
 * Obligatoria en toda superficie que muestre datos de demostracion.
 * El override de diseno exige que lo simulado no aparente ejecuciones, guardados
 * ni permisos reales confirmados.
 */
export function DemoBadge({ className, detail }: DemoBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-spray-magenta/50',
        'bg-spray-magenta/10 px-2 py-0.5 text-[11px] leading-4 font-semibold text-spray-magenta',
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-spray-magenta" />
      Demostración
      {detail === undefined ? null : <span className="font-normal opacity-80">· {detail}</span>}
    </span>
  );
}
