import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RepositoryProvider } from '@/data/repositoryContext';
import { ThemeProvider, darkTheme } from '@/theme';

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
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
