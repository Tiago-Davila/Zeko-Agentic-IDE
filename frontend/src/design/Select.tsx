import { useId, type SelectHTMLAttributes } from 'react';

import { cn } from './cn';
import { inputStyles } from './inputStyles';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  readonly label: string;
  readonly fieldClassName?: string | undefined;
}

export function Select({ label, className, fieldClassName, children, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', fieldClassName)}>
      <label htmlFor={id} className="text-xs font-medium text-chalk-400">
        {label}
      </label>
      <select id={id} className={cn(inputStyles, 'cursor-pointer pr-8', className)} {...rest}>
        {children}
      </select>
    </div>
  );
}
