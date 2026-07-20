'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'w-full rounded-md border border-border bg-surface px-3 py-2 text-base font-sans placeholder:text-text-muted focus:outline-none focus:border-border-focus focus:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
