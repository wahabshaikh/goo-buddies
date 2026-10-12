import * as React from 'react';
import { cn } from '@/lib/utils';

type SliderProps = Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
};

/** shadcn-style slider on a native range input (accessible and keyboard friendly for free). */
export function Slider({ className, value, min, max, onValueChange, style, ...props }: SliderProps) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      data-slot="slider"
      className={cn('slider', className)}
      value={value}
      min={min}
      max={max}
      onChange={(e) => onValueChange(Number(e.target.value))}
      style={{ ...style, ['--fill' as string]: `${fill}%` }}
      {...props}
    />
  );
}
