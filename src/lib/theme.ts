export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'design-tester-lab-theme';

/**
 * Reads the persisted theme preference from localStorage.
 * Falls back to 'system' if nothing is stored or localStorage is unavailable.
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable (e.g. incognito in some browsers)
  }
  return 'system';
}

/**
 * Persists the theme preference to localStorage.
 */
export function setStoredTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Silently fail
  }
}

/**
 * Resolves the effective theme (light or dark) given a preference.
 * 'system' resolves based on prefers-color-scheme.
 */
export function resolveTheme(preference: Theme): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference;
  if (typeof window === 'undefined') return 'dark'; // SSR default
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Applies the resolved theme to the document root element.
 * Adds/removes the 'dark' class on <html>.
 */
export function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Initializes theme on page load. Call once in root layout.
 * Returns the resolved theme.
 */
export function initTheme(): 'light' | 'dark' {
  const stored = getStoredTheme();
  const resolved = resolveTheme(stored);
  applyTheme(resolved);
  return resolved;
}

/**
 * Inline script to inject into <head> to prevent flash of wrong theme.
 * This runs before React hydration.
 */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var theme = stored === 'light' ? 'light' : stored === 'dark' ? 'dark' : null;
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;
