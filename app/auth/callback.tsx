import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { colors, typography, spacing } from '@/constants/theme';

export default function AuthCallback() {
  const { isAuthenticated } = useSupabaseAuth();

  useEffect(() => {
    // Small delay to ensure auth state is updated
    const timeout = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(tabs)/tasks');
      } else {
        router.replace('/google-login');
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [isAuthenticated]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  text: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
