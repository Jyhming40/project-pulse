import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeState>(getStoredTheme);
  const [isLoading, setIsLoading] = useState(false);
  const [isSynced, setIsSynced] = useState(false);

  // Load theme from database when user logs in
  useEffect(() => {
    const loadFromDb = async () => {
      if (!user?.id) {
        setIsSynced(false);
        return;
      }

      setIsLoading(true);
      try {
        // Use raw query since types may not be regenerated yet
        const { data, error } = await (supabase as any)
          .from('user_preferences')
          .select('theme_mode, theme_color')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          // Table might not exist yet or other error
          console.error('Failed to load theme preferences:', error);
          return;
        }

        if (data) {
          const dbTheme: ThemeState = {
            mode: (data.theme_mode as ThemeMode) || 'light',
            color: (data.theme_color as ThemeColor) || 'teal',
          };
          setThemeState(dbTheme);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dbTheme));
          setIsSynced(true);
        } else {
          // No preferences in DB yet, save current local preferences
          const localTheme = getStoredTheme();
          await (supabase as any).from('user_preferences').insert({
            user_id: user.id,
            theme_mode: localTheme.mode,
            theme_color: localTheme.color,
          });
          setIsSynced(true);
        }
      } catch (err) {
        console.error('Theme sync error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromDb();
  }, [user?.id]);

  // Apply theme on change
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  }, [theme]);

  // Apply on mount
  useEffect(() => {
    applyTheme(theme);
  }, []);

  const saveToDb = useCallback(async (newTheme: ThemeState) => {
    if (!user?.id) return;

    try {
      const { error } = await (supabase as any)
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          theme_mode: newTheme.mode,
          theme_color: newTheme.color,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('Failed to save theme preferences:', error);
      }
    } catch (err) {
      console.error('Theme save error:', err);
    }
  }, [user?.id]);

  const setMode = useCallback((mode: ThemeMode) => {
    setThemeState(prev => {
      const newTheme: ThemeState = { ...prev, mode };
      saveToDb(newTheme);
      return newTheme;
    });
  }, [saveToDb]);

  const setColor = useCallback((color: ThemeColor) => {
    setThemeState(prev => {
      const newTheme: ThemeState = { ...prev, color };
      saveToDb(newTheme);
      return newTheme;
    });
  }, [saveToDb]);

  const toggleMode = useCallback(() => {
    setThemeState(prev => {
      const newMode: ThemeMode = prev.mode === 'light' ? 'dark' : 'light';
      const newTheme: ThemeState = { ...prev, mode: newMode };
      saveToDb(newTheme);
      return newTheme;
    });
  }, [saveToDb]);

  return {
    mode: theme.mode,
    color: theme.color,
    setMode,
    setColor,
    toggleMode,
    isDark: theme.mode === 'dark',
    isLoading,
    isSynced,
  };
}
