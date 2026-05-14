/**
 * Theme context — picks light/dark scheme and exposes the senior text-scale
 * toggle. Components consume tokens via useTheme().
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type SemanticTheme } from './tokens';
import { useSettings } from '@/src/store/settings';

type ThemeCtx = SemanticTheme & {
  scheme: 'light' | 'dark';
  senior: boolean;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const { darkMode, seniorText } = useSettings();

  // "darkMode: system" follows OS; otherwise honour the user pref.
  const scheme = darkMode === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : darkMode;

  const value = useMemo<ThemeCtx>(() => ({
    ...(scheme === 'dark' ? dark : light),
    scheme,
    senior: seniorText,
  }), [scheme, seniorText]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const t = useContext(Ctx);
  if (!t) throw new Error('useTheme() outside ThemeProvider');
  return t;
}
