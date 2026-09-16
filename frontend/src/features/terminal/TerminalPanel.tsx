import { Badge } from '../../design/Badge';
import { DemoBadge } from '../../design/DemoBadge';

interface TerminalPanelProps {
  readonly workingDirectory?: string | undefined;
}

/*
 * Superficie de terminal de solo presentacion.
 *
 * El backend tiene LocalTerminalAdapter con capacidad EXECUTE_LOCAL, pero ningun
 * controller lo expone, asi que no hay canal que conectar. Este panel dibuja la forma
 * de la superficie sin simular salida de comandos: el scrollback explica su propio
 * estado en vez de inventar un historial que podria confundirse con ejecucion real.
 */
export function TerminalPanel({ workingDirectory }: TerminalPanelProps) {
  const cwd = workingDirectory ?? 'sin worktree reservado';

  return (
    <section aria-label="Terminal" className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-700 px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-chalk-400 uppercase">Terminal</span>
        <Badge tone="muted" mono>
          {cwd}
        </Badge>
        <Badge tone="neutral">EXECUTE_LOCAL</Badge>
        <DemoBadge className="ml-auto" detail="sin canal de ejecución" />
      </header>

      <div className="min-h-0 flex-1 overflow-auto bg-ink-950 p-3 font-mono text-xs leading-relaxed">
        <p className="text-chalk-400">
          Esta superficie todavía no está conectada a una capacidad de ejecución.
        </p>
        <p className="mt-2 text-chalk-600">
          El backend define <span className="text-chalk-400">LocalTerminalAdapter</span> con capacidad{' '}
          <span className="text-chalk-400">EXECUTE_LOCAL</span>, pero ningún endpoint HTTP lo expone.
        </p>
        <p className="mt-2 text-chalk-600">
          Conectarla es una capacidad funcional nueva y no entra en el alcance de diseño: queda
          registrada en el backlog para su propia tarea.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-ink-700 px-3 py-2 font-mono text-xs">
        <span aria-hidden="true" className="text-spray-lime">
          $
        </span>
        <input
          aria-label="Comando de terminal"
          disabled
          placeholder="Sin canal de ejecución disponible"
          className="min-w-0 flex-1 cursor-not-allowed bg-transparent text-chalk-600 outline-none placeholder:text-chalk-600"
        />
      </div>
    </section>
  );
}
