import { useEffect, useState } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { nodeVectorStore } from "@/services/vectorStores/nodeVectorStore";
import { nodeService } from "@/services/nodeService";
import { colors, typography, spacing, radius } from "@/constants/theme";

export default function Index() {
  const insets = useSafeAreaInsets();
  const [loadingStatus, setLoadingStatus] = useState("Initializing...");

  useEffect(() => {
    (async () => {
      try {
        // Try to load AI model (optional - app works without it)
        setLoadingStatus("Loading AI model...");
        try {
          console.log("Starting vector store load...");
          await nodeVectorStore.load();
          console.log("Vector store loaded successfully!");
        } catch (aiError: any) {
          console.warn('AI model failed to load:', aiError?.message || aiError);
          console.warn('Full error:', JSON.stringify(aiError, null, 2));
          console.warn('Using text search fallback');
        }

        setLoadingStatus("Initializing database...");
        await nodeService.initialize();

        // Load demo data for testing (force reload to rebuild vector index after migration)
        const { loadDemoNodes } = await import("@/services/demo/sampleNodes");
        setLoadingStatus("Loading nodes...");
        await loadDemoNodes(true); // Force reload to rebuild vector store

        setLoadingStatus("Ready!");

        // Navigate to the main app
        router.replace("/(tabs)/marketplace");
      } catch (e) {
        console.error('TARAI initialization failed', e);
        setLoadingStatus(`Error: ${e}`);
      }
    })();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <LinearGradient
          colors={[colors.accent, colors.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoContainer}
        >
          <Text style={styles.logoText}>T</Text>
        </LinearGradient>
        <Text style={styles.appName}>TARAI</Text>
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
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: 40,
    fontWeight: "800",
    color: colors.textPrimary,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
