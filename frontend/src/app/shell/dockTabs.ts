import type { TabItem } from '../../design/Tabs';

export type DockTab = 'terminal' | 'chat' | 'library' | 'traces';

export const dockTabs: readonly TabItem<DockTab>[] = [
  { value: 'terminal', label: 'Terminal' },
  { value: 'chat', label: 'Chat' },
  { value: 'library', label: 'Librería' },
  { value: 'traces', label: 'Trazas' },
];
