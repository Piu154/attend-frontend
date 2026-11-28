import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const KEY = 'attend.theme';

export function applySavedTheme() {
  const saved = localStorage.getItem(KEY);
  const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
}

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={'grid h-10 w-10 place-items-center rounded-full border border-line bg-card text-muted transition hover:text-ink ' + className}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}