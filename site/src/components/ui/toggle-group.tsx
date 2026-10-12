import * as React from 'react';
import { cn } from '@/lib/utils';

type ToggleGroupProps<T extends string> = {
  value: T;
  options: readonly T[];
  onValueChange: (value: T) => void;
  label: string;
  className?: string;
  renderOption?: (value: T) => React.ReactNode;
};

/** Single-select segmented control (a radio group under the hood). */
export function ToggleGroup<T extends string>({
  value,
  options,
  onValueChange,
  label,
  className,
  renderOption,
}: ToggleGroupProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onValueChange(options[next]);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} data-slot="toggle-group" className={cn('flex flex-wrap gap-1 rounded-lg bg-muted p-1', className)}>
      {options.map((option, i) => {
        const active = option === value;
        return (
          <button
            key={option}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(option)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {renderOption ? renderOption(option) : option}
          </button>
        );
      })}
    </div>
  );
}
