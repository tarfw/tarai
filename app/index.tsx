import { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { memoryVectorStore } from '@/services/vectorStores/memoryVectorStore';
import { initializeMemoryService } from '@/services/memoryService';
import { colors, typography, spacing, radius } from '@/constants/theme';

export default function Index() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Load vector store and AI model (as per blog)
        setLoadingStatus('Loading AI model...');
        console.log('[Init] Starting memoryVectorStore.load()...');
        await memoryVectorStore.load();
        console.log('[Init] memoryVectorStore.load() completed successfully');

        setLoadingStatus('Initializing database...');
        console.log('[Init] Starting initializeMemoryService()...');
        await initializeMemoryService();
        console.log('[Init] initializeMemoryService() completed');

        // Load demo data
        const { loadDemoData } = await import('@/services/demo/sampleMemories');
        setLoadingStatus('Loading demo data...');
        const result = await loadDemoData(true); // Force reload
        console.log(`Loaded ${result.memories} memories, ${result.tasks} tasks`);

        setLoadingStatus('Ready!');
        setAppReady(true);
      } catch (e) {
        console.error('TARAI initialization failed', e);
        setLoadingStatus(`Error: ${e}`);
        setAppReady(true);
      }
    })();
  }, []);

  // Navigate based on authentication status once everything is loaded
  useEffect(() => {
    if (appReady && !authLoading) {
      if (isAuthenticated) {
        // User is authenticated, go to main app
        router.replace('/(tabs)/tasks');
      } else {
        // User not authenticated, go to login
        router.replace('/email-login');
      }
    }
  }, [appReady, authLoading, isAuthenticated]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/tar.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>tar app</Text>
        <Text style={styles.tagline}>Universal Commerce</Text>
      </View>
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.loadingText}>{loadingStatus}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: spacing.md,
  },
  appName: {
    ...typography.largeTitle,
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
