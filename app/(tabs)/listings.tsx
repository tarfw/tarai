import { FontAwesome6 } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listingService } from "@/services/listingService";
import { COMMERCE_CATEGORIES } from "@/services/vectorStores/listingVectorStore";
import type { CachedListing } from "@/types/listing";
import { colors } from "@/constants/theme";
import { useFocusEffect } from "expo-router";

export default function Listings() {
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState<CachedListing[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [])
  );

  const loadListings = async () => {
    try {
      const cachedListings = await listingService.getCachedListings();
      setListings(cachedListings);
    } catch (e) {
      console.error('Failed to load listings', e);
    }
  };

  const renderListingItem = ({ item }: { item: CachedListing }) => (
    <TouchableOpacity style={styles.listingItem}>
      <View style={styles.iconContainer}>
        <Text style={styles.listingIcon}>
          {COMMERCE_CATEGORIES[item.type as keyof typeof COMMERCE_CATEGORIES]?.icon || '📦'}
        </Text>
      </View>
      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle}>{item.title}</Text>
        <Text style={styles.listingType}>
          {COMMERCE_CATEGORIES[item.type as keyof typeof COMMERCE_CATEGORIES]?.label || item.type}
        </Text>
      </View>
      <Text style={styles.listingPrice}>₹{item.price}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Listings</Text>
        <TouchableOpacity style={styles.addButton}>
          <FontAwesome6 name="plus" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Listings List */}
      <FlatList
        data={listings}
        renderItem={renderListingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No Listings</Text>
            <Text style={styles.emptySubtitle}>
              Your listings on this device will appear here
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  addButton: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  listingItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  listingIcon: {
    fontSize: 24,
  },
  listingInfo: {
    flex: 1,
    gap: 4,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  listingType: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2196F3",
  },
  separator: {
    height: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
