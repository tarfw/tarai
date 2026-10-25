import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ThemeProvider, useThemeMode } from '@/hooks/use-theme-context';
import { WorkspaceProvider } from '@/state/Workspace';
import { Colors } from '@/constants/theme';

void SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { resolvedScheme } = useThemeMode();
  useEffect(() => { void SplashScreen.hideAsync(); }, []);
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 0, contentStyle: { backgroundColor: Colors[resolvedScheme].background } }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="auth" />
    <Stack.Screen name="canvas" />
    <Stack.Screen name="ask" options={{ animation: 'slide_from_bottom' }} />
    <Stack.Screen name="sale" options={{ animation: 'slide_from_bottom' }} />
    <Stack.Screen name="chat" />
    <Stack.Screen name="tool/[toolId]" />
    <Stack.Screen name="record/[id]" />
    <Stack.Screen name="settings" />
  </Stack>;
}

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <ThemeProvider>
        <WorkspaceProvider>
          <Navigation />
        </WorkspaceProvider>
      </ThemeProvider>
    </KeyboardProvider>
  );
}
