import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ThemeProvider, useThemeMode } from '@/hooks/use-theme-context';
import { Colors } from '@/constants/theme';

void SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { resolvedScheme } = useThemeMode();
  useEffect(() => { void SplashScreen.hideAsync(); }, []);
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 0, contentStyle: { backgroundColor: Colors[resolvedScheme].background } }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="auth" />
    <Stack.Screen name="home" />
    <Stack.Screen name="settings" />
  </Stack>;
}

export default function RootLayout() {
  return <KeyboardProvider><ThemeProvider><Navigation /></ThemeProvider></KeyboardProvider>;
}
