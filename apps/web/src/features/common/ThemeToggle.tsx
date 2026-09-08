import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';

export type ThemeMode = 'light' | 'dark' | 'system';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('documind-theme') as ThemeMode) || 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem('documind-theme', theme);
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="flex items-center gap-1 rounded-xl border border-ink/10 bg-canvas p-1 text-xs">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition ${theme === 'light' ? 'bg-paper text-violet-700 shadow-sm' : 'text-ink-muted hover:text-ink'}`}
        title="Light theme"
      >
        <Sun size={14} />
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition ${theme === 'dark' ? 'bg-paper text-violet-700 shadow-sm' : 'text-ink-muted hover:text-ink'}`}
        title="Dark theme"
      >
        <Moon size={14} />
        <span className="hidden sm:inline">Dark</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme('system')}
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition ${theme === 'system' ? 'bg-paper text-violet-700 shadow-sm' : 'text-ink-muted hover:text-ink'}`}
        title="System default theme"
      >
        <Monitor size={14} />
        <span className="hidden sm:inline">System</span>
      </button>
    </div>
  );
}
