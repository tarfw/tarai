import { useEffect, useState } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { listingVectorStore } from "@/services/vectorStores/listingVectorStore";
import { listingService } from "@/services/listingService";

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
          await listingVectorStore.load();
          console.log("Vector store loaded successfully!");
        } catch (aiError: any) {
          console.warn('AI model failed to load:', aiError?.message || aiError);
          console.warn('Full error:', JSON.stringify(aiError, null, 2));
          console.warn('Using text search fallback');
        }

        setLoadingStatus("Initializing database...");
        await listingService.initialize();

        // Load demo data for testing
        const { loadDemoListings } = await import("@/services/demo/sampleListings");
        setLoadingStatus("Loading demo listings...");
        await loadDemoListings();

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
    <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
      <ActivityIndicator size="large" color="#000" />
      <Text style={styles.loadingText}>{loadingStatus}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
});
