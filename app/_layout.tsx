import { Stack } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SupabaseAuthProvider } from "@/contexts/SupabaseAuthContext";
import { BlueskyAuthProvider } from "@/contexts/BlueskyAuthContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SupabaseAuthProvider>
        <BlueskyAuthProvider>
          <SafeAreaProvider>
            <KeyboardProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="email-login" />
                <Stack.Screen name="bluesky-login" />
              </Stack>
            </KeyboardProvider>
          </SafeAreaProvider>
        </BlueskyAuthProvider>
      </SupabaseAuthProvider>
    </ThemeProvider>
  );
}
