import { useId, type InputHTMLAttributes } from 'react';

import { cn } from './cn';
import { inputStyles } from './inputStyles';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  // El nombre accesible sale de acá: se asocia por htmlFor/id, no por aria-label.
  readonly label: string;
  readonly hint?: string | undefined;
  readonly mono?: boolean | undefined;
  readonly fieldClassName?: string | undefined;
}

export function Field({ label, hint, mono = false, className, fieldClassName, ...rest }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={cn('flex flex-col gap-1.5', fieldClassName)}>
      <label htmlFor={id} className="text-xs font-medium text-chalk-400">
        {label}
      </label>
      <input
        id={id}
        className={cn(inputStyles, mono ? 'font-mono text-xs' : '', className)}
        {...(hint === undefined ? {} : { 'aria-describedby': hintId })}
        {...rest}
      />
      {hint === undefined ? null : (
        <p id={hintId} className="text-[11px] text-chalk-600">
          {hint}
        </p>
      )}
    </div>
  );
}
