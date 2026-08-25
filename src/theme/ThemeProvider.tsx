import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { darkTheme, type Theme } from './theme';

const ThemeContext = createContext<Theme>(darkTheme);

interface ThemeProviderProps {
  theme?: Theme;
  children: ReactNode;
}

export function ThemeProvider({ theme = darkTheme, children }: ThemeProviderProps) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Builds a stylesheet from the active theme and memoises it per theme.
 *
 * `factory` must be defined at module scope (a stable reference) — defining it
 * inline inside a component would rebuild the stylesheet on every render and
 * defeat the memoisation.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
