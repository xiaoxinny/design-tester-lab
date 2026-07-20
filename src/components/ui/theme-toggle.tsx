'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
  type Theme,
} from '@/lib/theme';

interface ThemeToggleProps {
  className?: string;
}

const nextTheme: Record<Theme, Theme> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

function ThemeToggle({ className }: ThemeToggleProps) {
  const [preference, setPreference] = useState<Theme>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('dark');

  const updateTheme = useCallback((newPreference: Theme) => {
    setStoredTheme(newPreference);
    const newResolved = resolveTheme(newPreference);
    applyTheme(newResolved);
    setPreference(newPreference);
    setResolved(newResolved);
  }, []);

  useEffect(() => {
    updateTheme(getStoredTheme());
  }, [updateTheme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (preference === 'system') {
        const newResolved = resolveTheme('system');
        applyTheme(newResolved);
        setResolved(newResolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [preference]);

  const nextPreference = nextTheme[preference];
  const Icon = preference === 'system' ? Monitor : resolved === 'dark' ? Moon : Sun;

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-md p-2 text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors duration-150',
        className,
      )}
      aria-label={`Switch to ${nextPreference} theme`}
      onClick={() => updateTheme(nextPreference)}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  );
}

export { ThemeToggle };
