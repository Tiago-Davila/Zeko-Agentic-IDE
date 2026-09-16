import type { ReactNode } from 'react';

import { Tabs } from '../../design/Tabs';
import { cn } from '../../design/cn';
import { panelId, tabId } from '../../design/tabIds';
import { dockTabs, type DockTab } from './dockTabs';

interface BottomDockProps {
  readonly tab: DockTab;
  readonly onTabChange: (tab: DockTab) => void;
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly children: ReactNode;
}

export function BottomDock({ tab, onTabChange, collapsed, onToggleCollapsed, children }: BottomDockProps) {
  return (
    <section
      aria-label="Panel inferior"
      className={cn('flex min-h-0 flex-col border-t border-ink-700 bg-ink-900', collapsed ? 'shrink-0' : 'h-full')}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 px-2">
        <Tabs
          items={dockTabs}
          value={tab}
          onChange={onTabChange}
          label="Paneles inferiores"
          idPrefix="dock"
          variant="underline"
          className="border-b-0"
        />
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          className="ml-auto rounded-[var(--radius-control)] px-2 py-1 text-xs text-chalk-400 transition-colors hover:bg-ink-800 hover:text-chalk-50"
        >
          {collapsed ? 'Mostrar panel' : 'Ocultar panel'}
        </button>
      </div>

      {collapsed ? null : (
        <div
          id={panelId('dock', tab)}
          role="tabpanel"
          aria-labelledby={tabId('dock', tab)}
          className="min-h-0 flex-1 overflow-auto"
        >
          {children}
        </div>
      )}
    </section>
  );
}
