import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemeColor = 'teal' | 'fire';

interface ThemeState {
  mode: ThemeMode;
  color: ThemeColor;
}

const STORAGE_KEY = 'app-theme';

const getStoredTheme = (): ThemeState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return { mode: 'light', color: 'teal' };
};

const applyTheme = (theme: ThemeState) => {
  const root = document.documentElement;
  
  // Apply mode
  if (theme.mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  
  // Apply color theme
  root.setAttribute('data-theme-color', theme.color);
};

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeState>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  // Apply on mount
  useEffect(() => {
    applyTheme(theme);
  }, []);

  const setMode = (mode: ThemeMode) => {
    setThemeState(prev => ({ ...prev, mode }));
  };

  const setColor = (color: ThemeColor) => {
    setThemeState(prev => ({ ...prev, color }));
  };

  const toggleMode = () => {
    setThemeState(prev => ({ ...prev, mode: prev.mode === 'light' ? 'dark' : 'light' }));
  };

  return {
    mode: theme.mode,
    color: theme.color,
    setMode,
    setColor,
    toggleMode,
    isDark: theme.mode === 'dark',
  };
}
