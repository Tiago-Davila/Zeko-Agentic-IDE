import { useRef, type KeyboardEvent } from 'react';

import { cn } from './cn';
import { panelId, tabId } from './tabIds';

export interface TabItem<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface TabsProps<T extends string> {
  readonly items: readonly TabItem<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  // Nombre accesible del tablist.
  readonly label: string;
  readonly idPrefix: string;
  readonly variant?: 'segmented' | 'underline' | undefined;
  readonly className?: string | undefined;
}

function nextIndex(key: string, index: number, total: number): number | null {
  if (key === 'ArrowRight') return (index + 1) % total;
  if (key === 'ArrowLeft') return (index - 1 + total) % total;
  if (key === 'Home') return 0;
  if (key === 'End') return total - 1;
  return null;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
  variant = 'segmented',
  className,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  function move(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.value === value);
    if (index < 0) return;
    const next = nextIndex(event.key, index, items.length);
    if (next === null) return;
    event.preventDefault();
    const item = items[next];
    if (item === undefined) return;
    onChange(item.value);
    listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(tabId(idPrefix, item.value))}`)?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={move}
      className={cn(
        'flex items-center',
        variant === 'segmented'
          ? 'gap-0.5 rounded-[var(--radius-control)] border border-ink-700 bg-ink-900 p-0.5'
          : 'gap-1 border-b border-ink-700',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            id={tabId(idPrefix, item.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idPrefix, item.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'cursor-pointer whitespace-nowrap transition-colors duration-150',
              variant === 'segmented'
                ? cn(
                    'rounded-[6px] px-3 py-1 text-xs font-medium',
                    selected
                      ? 'bg-ink-700 text-chalk-50 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]'
                      : 'text-chalk-400 hover:bg-ink-800 hover:text-chalk-200',
                  )
                : cn(
                    '-mb-px border-b-2 px-3 py-1.5 text-xs font-medium',
                    selected
                      ? 'border-spray-lime text-chalk-50'
                      : 'border-transparent text-chalk-400 hover:text-chalk-200',
                  ),
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
