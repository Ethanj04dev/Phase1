import {
  DarkTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RepositoryProvider } from '@/data/repositoryContext';
import { ThemeProvider, darkTheme } from '@/theme';

/**
 * React Navigation paints its own root container, and its default theme is
 * light (#f2f2f2). Without this the navigator shows a white ground behind the
 * app during transitions and on scroll overscroll. Mapping our design tokens
 * onto the navigation theme keeps every surface consistent.
 */
const navigationTheme: NavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: darkTheme.colors.background,
    card: darkTheme.colors.background,
    text: darkTheme.colors.textPrimary,
    border: darkTheme.colors.border,
    primary: darkTheme.colors.accent,
    notification: darkTheme.colors.statusOffTarget,
  },
};

// Hold the native splash until the first screen has decided what to render,
// so the app never flashes an empty frame on cold start.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // No async boot work yet. Once auth and profile hydration land, this moves
    // behind that gate instead of firing on mount.
    void SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: darkTheme.colors.background }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NavigationThemeProvider value={navigationTheme}>
            <RepositoryProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: darkTheme.colors.background },
                  animation: 'fade',
                }}
              />
            </RepositoryProvider>
          </NavigationThemeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
