import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from './Icon.jsx';

// Light or dark. The choice is kept in this browser; until someone chooses, the page follows
// the system setting. index.html applies the same rule before the first paint.
const KEY = 'theme';

function stored() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null; // storage blocked: the toggle still works for this visit
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // The browser's own bar (phones) takes the page colour of the theme.
    const page = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (page) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', page);
  }, [theme]);

  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = (e) => {
      if (!stored()) setTheme(e.matches ? 'dark' : 'light');
    };
    system.addEventListener('change', follow);
    return () => system.removeEventListener('change', follow);
  }, []);

  const next = theme === 'dark' ? 'light' : 'dark';
  const toggle = () => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // not saved; see stored()
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      <SunIcon className="icon-sun" />
      <MoonIcon className="icon-moon" />
    </button>
  );
}
