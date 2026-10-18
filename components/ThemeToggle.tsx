'use client';

import { useEffect, useState } from 'react';
import { Icons, IconButton } from './ui';

type Theme = 'dark' | 'light';

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/**
 * The theme is applied before first paint by an inline script in app/layout.tsx;
 * this component only reflects it and flips it. The icon renders after mount so
 * server and client markup agree.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const toggle = () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem('quintet:theme', next);
    } catch {
      /* private mode: the theme just will not persist */
    }
    setTheme(next);
  };

  return (
    <IconButton label={theme === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme'} onClick={toggle}>
      {theme === 'light' ? <Icons.moon /> : <Icons.sun />}
    </IconButton>
  );
}
