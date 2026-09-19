import { useState, type ReactNode } from 'react';

import { cn } from '../../design/cn';
import { ChatIcon, LibraryIcon, TerminalIcon, TraceIcon } from '../../features/canvas/nodes/icons';
import { dockTabs, type DockTab } from './dockTabs';

const icons: Record<DockTab, ReactNode> = {
  terminal: <TerminalIcon />,
  chat: <ChatIcon />,
  library: <LibraryIcon />,
  traces: <TraceIcon />,
};

interface AppSidebarProps {
  readonly activeTab: DockTab;
  readonly onSelectTab: (tab: DockTab) => void;
  readonly dockCollapsed: boolean;
}

/*
 * Rail plegado: ocupa una franja angosta y se despliega al entrar el puntero o el foco de
 * teclado. Se monta siempre, asi que los botones quedan alcanzables por tabulacion aunque
 * el rail este visualmente contraido.
 */
export function AppSidebar({ activeTab, onSelectTab, dockCollapsed }: AppSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      className="relative z-20 flex shrink-0"
    >
      {/* Zona sensible: angosta cuando esta plegado, para no comer area del canvas. */}
      <nav
        aria-label="Paneles"
        className={cn(
          'flex flex-col items-center gap-1 border-r border-ink-700 bg-ink-900 py-2 transition-all duration-150',
          open ? 'w-12 px-1.5' : 'w-2.5 px-0',
        )}
      >
        {dockTabs.map((item) => {
          const active = !dockCollapsed && item.value === activeTab;
          return (
            <button
              key={item.value}
              type="button"
              aria-label={item.label}
              title={item.label}
              aria-pressed={active}
              onClick={() => onSelectTab(item.value)}
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] transition-all duration-150',
                open ? 'opacity-100' : 'pointer-events-none w-0 opacity-0',
                active
                  ? 'bg-spray-lime/15 text-spray-lime'
                  : 'text-chalk-400 hover:bg-ink-800 hover:text-chalk-50',
              )}
            >
              {icons[item.value]}
            </button>
          );
        })}

        {/* Marca visible cuando el rail esta plegado, para que la zona sea descubrible. */}
        {open ? null : (
          <span aria-hidden="true" className="mt-1 h-10 w-0.5 rounded-full bg-ink-600" />
        )}
      </nav>
    </div>
  );
}
