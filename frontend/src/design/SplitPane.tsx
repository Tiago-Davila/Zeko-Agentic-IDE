import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import { cn } from './cn';

interface SplitPaneProps {
  // 'vertical' apila y redimensiona la altura del panel secundario;
  // 'horizontal' los pone lado a lado y redimensiona su ancho.
  readonly orientation: 'vertical' | 'horizontal';
  readonly size: number;
  readonly onSizeChange: (size: number) => void;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly label: string;
  readonly primary: ReactNode;
  readonly secondary: ReactNode;
  readonly className?: string | undefined;
}

const STEP = 24;

export function SplitPane({
  orientation,
  size,
  onSizeChange,
  min = 120,
  max = 720,
  label,
  primary,
  secondary,
  className,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const vertical = orientation === 'vertical';

  const clamp = useCallback((value: number) => Math.min(Math.max(value, min), max), [max, min]);

  const applyFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (container === null) return;
      const rect = container.getBoundingClientRect();
      // El panel secundario vive al final, asi que se mide desde el borde opuesto.
      onSizeChange(clamp(vertical ? rect.bottom - clientY : rect.right - clientX));
    },
    [clamp, onSizeChange, vertical],
  );

  useEffect(() => {
    function onMove(event: globalThis.PointerEvent) {
      if (!draggingRef.current) return;
      event.preventDefault();
      applyFromPointer(event.clientX, event.clientY);
    }
    function onUp() {
      draggingRef.current = false;
      document.body.style.removeProperty('user-select');
      document.body.style.removeProperty('cursor');
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [applyFromPointer]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    draggingRef.current = true;
    document.body.style.setProperty('user-select', 'none');
    document.body.style.setProperty('cursor', vertical ? 'row-resize' : 'col-resize');
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const grow = vertical ? 'ArrowUp' : 'ArrowLeft';
    const shrink = vertical ? 'ArrowDown' : 'ArrowRight';
    if (event.key === grow) onSizeChange(clamp(size + STEP));
    else if (event.key === shrink) onSizeChange(clamp(size - STEP));
    else if (event.key === 'Home') onSizeChange(min);
    else if (event.key === 'End') onSizeChange(max);
    else return;
    event.preventDefault();
  }

  return (
    <div
      ref={containerRef}
      className={cn('flex min-h-0 min-w-0', vertical ? 'flex-col' : 'flex-row', className)}
    >
      <div className="min-h-0 min-w-0 flex-1">{primary}</div>
      <div
        role="separator"
        aria-label={label}
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
        aria-valuenow={Math.round(size)}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        onPointerDown={startDrag}
        onKeyDown={onKeyDown}
        className={cn(
          'group relative shrink-0 bg-ink-700 transition-colors duration-150',
          'hover:bg-spray-lime/50 focus-visible:bg-spray-lime',
          vertical ? 'h-px cursor-row-resize' : 'w-px cursor-col-resize',
        )}
      >
        {/* Area de agarre mas ancha que la linea visible. */}
        <span
          aria-hidden="true"
          className={cn('absolute', vertical ? '-top-1.5 -bottom-1.5 left-0 right-0' : '-left-1.5 -right-1.5 top-0 bottom-0')}
        />
      </div>
      <div
        className="min-h-0 min-w-0 shrink-0 overflow-hidden"
        style={vertical ? { height: size } : { width: size }}
      >
        {secondary}
      </div>
    </div>
  );
}
