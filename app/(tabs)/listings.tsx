import { FontAwesome6 } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { listingService } from "@/services/listingService";
import { COMMERCE_CATEGORIES } from "@/services/vectorStores/listingVectorStore";
import type { CachedListing } from "@/types/listing";
import { colors, typography, spacing, radius } from "@/constants/theme";
import { useFocusEffect } from "expo-router";

const CATEGORY_COLORS: Record<string, string> = {
  transportation: colors.blue,
  food_delivery: colors.orange,
  service: colors.green,
  booking: colors.purple,
  physical_product: colors.teal,
  educational: colors.pink,
  event: colors.warning,
  rental: colors.accent,
  digital_product: colors.success,
  recurring_service: colors.error,
};

const STATUS_CONFIG = {
  active: { label: "Active", color: colors.success },
  draft: { label: "Draft", color: colors.textTertiary },
  paused: { label: "Paused", color: colors.warning },
};

export default function Listings() {
  const insets = useSafeAreaInsets();
  const [listings, setListings] = useState<CachedListing[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("all");

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

  const stats = {
    total: listings.length,
    active: listings.length,
    views: 1234,
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Items</Text>
        <TouchableOpacity style={styles.addButton}>
          <LinearGradient
            colors={[colors.accent, colors.purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addButtonGradient}
          >
            <FontAwesome6 name="plus" size={16} color={colors.textPrimary} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.views}</Text>
          <Text style={styles.statLabel}>Views</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {["all", "active", "draft"].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterTab, selectedFilter === filter && styles.filterTabActive]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: 80 + insets.bottom }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {listings.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="cube" size={32} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No items yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first listing and start selling
            </Text>
            <TouchableOpacity style={styles.emptyButton}>
              <LinearGradient
                colors={[colors.accent, colors.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyButtonGradient}
              >
                <FontAwesome6 name="plus" size={14} color={colors.textPrimary} />
                <Text style={styles.emptyButtonText}>Create listing</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listingsContainer}>
            {listings.map((item) => (
              <ListingItem key={item.id} item={item} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ListingItem({ item }: { item: CachedListing }) {
  const categoryColor = CATEGORY_COLORS[item.type] || colors.accent;
  const category = COMMERCE_CATEGORIES[item.type as keyof typeof COMMERCE_CATEGORIES];
  const status = STATUS_CONFIG.active;

  return (
    <Pressable style={({ pressed }) => [styles.listingItem, pressed && styles.listingItemPressed]}>
      <View style={[styles.listingIcon, { backgroundColor: `${categoryColor}20` }]}>
        <Text style={styles.listingIconEmoji}>{category?.icon || '📦'}</Text>
      </View>
      <View style={styles.listingContent}>
        <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.listingMeta}>
          <View style={[styles.statusBadge, { backgroundColor: `${status.color}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.listingType}>{category?.label || item.type}</Text>
        </View>
      </View>
      <View style={styles.listingRight}>
        <Text style={styles.listingPrice}>₹{item.price}</Text>
        <TouchableOpacity style={styles.moreButton}>
          <FontAwesome6 name="ellipsis" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </Pressable>
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
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  addButton: {
    borderRadius: radius.md,
    overflow: "hidden",
  },
  addButtonGradient: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  statsContainer: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  statValue: {
    ...typography.title,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  filterText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
  },
  listingsContainer: {
    gap: spacing.sm,
  },
  listingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listingItemPressed: {
    backgroundColor: colors.surfaceHover,
  },
  listingIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  listingIconEmoji: {
    fontSize: 24,
  },
  listingContent: {
    flex: 1,
    gap: spacing.xs,
  },
  listingTitle: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  listingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...typography.small,
    fontWeight: "600",
  },
  listingType: {
    ...typography.small,
    color: colors.textTertiary,
  },
  listingRight: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  listingPrice: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  moreButton: {
    padding: spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  emptyButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyButtonText: {
    ...typography.headline,
    color: colors.textPrimary,
  },
});
