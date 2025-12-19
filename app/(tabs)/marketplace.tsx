import { FontAwesome6 } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listingService } from "@/services/listingService";
import { COMMERCE_CATEGORIES } from "@/services/vectorStores/listingVectorStore";
import type { CachedListing } from "@/types/listing";
import { useFocusEffect } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - (CARD_PADDING * 2) - CARD_GAP) / 2;

export default function Marketplace() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography, isDark, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ text: string; type: string; icon: string }>>([]);
  const [searchResults, setSearchResults] = useState<CachedListing[]>([]);
  const [cachedListings, setCachedListings] = useState<CachedListing[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const categoryColors: Record<string, string> = {
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

  useFocusEffect(
    useCallback(() => {
      loadCachedListings();
    }, [])
  );

  const loadCachedListings = async () => {
    try {
      const listings = await listingService.getCachedListings();
      setCachedListings(listings);
    } catch (e) {
      console.error('Failed to load cached listings', e);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length === 0) {
      setIsSearching(false);
      setSuggestions([]);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const suggs = await listingService.getSemanticSuggestions(query);
      setSuggestions(suggs);

      const results = await listingService.searchListingsByText(query, {}, 10);
      const relevantResults = results.filter(r => r.similarity >= 0.15);

      const resultListings: typeof cachedListings = [];
      for (const result of relevantResults) {
        const listing = cachedListings.find(l => l.id === result.listingId);
        if (listing) {
          resultListings.push(listing);
        }
      }

      setSearchResults(resultListings);
    } catch (e) {
      console.error('Failed to search', e);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setSuggestions([]);
    setSearchResults([]);
  };

  const displayListings = isSearching ? searchResults : cachedListings;

  const styles = createStyles(colors, spacing, radius, typography);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        <TouchableOpacity style={styles.headerButton} onPress={toggleTheme}>
          <FontAwesome6
            name={isDark ? "moon" : "sun"}
            size={18}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
          <FontAwesome6 name="magnifying-glass" size={16} color={colors.textTertiary} />
          <TextInput
            placeholder="Search services, products..."
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={styles.searchInput}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <FontAwesome6 name="xmark" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick Categories */}
      {!isSearching && (
        <View style={styles.categoriesWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {Object.entries(COMMERCE_CATEGORIES).slice(0, 6).map(([type, info]) => (
              <TouchableOpacity
                key={type}
                style={styles.categoryChip}
                onPress={() => handleSearch(info.label)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryIcon}>{info.icon}</Text>
                <Text style={styles.categoryLabel}>{info.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Suggestions */}
      {isSearching && suggestions.length > 0 && (
        <View style={styles.suggestionsWrapper}>
          <Text style={styles.sectionLabel}>Suggestions</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsContainer}
          >
            {suggestions.map((item, index) => (
              <TouchableOpacity
                key={`${item.type}-${index}`}
                style={styles.suggestionChip}
                onPress={() => handleSearch(item.text)}
              >
                <Text style={styles.suggestionIcon}>{item.icon}</Text>
                <Text style={styles.suggestionText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Results */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: 80 + insets.bottom }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isSearching && (
          <View style={styles.resultsHeader}>
            <Text style={styles.sectionLabel}>
              {searchResults.length} results
            </Text>
          </View>
        )}

        {!isSearching && (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
        )}

        {displayListings.length === 0 && isSearching && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="magnifying-glass" size={32} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptySubtitle}>Try different keywords</Text>
          </View>
        )}

        <View style={styles.listingsGrid}>
          {displayListings.map((item) => (
            <ListingCard key={item.id} item={item} colors={colors} categoryColors={categoryColors} spacing={spacing} radius={radius} typography={typography} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ListingCard({
  item,
  colors,
  categoryColors,
  spacing,
  radius,
  typography
}: {
  item: CachedListing;
  colors: any;
  categoryColors: Record<string, string>;
  spacing: any;
  radius: any;
  typography: any;
}) {
  const categoryColor = categoryColors[item.type] || colors.accent;
  const category = COMMERCE_CATEGORIES[item.type as keyof typeof COMMERCE_CATEGORIES];

  return (
    <Pressable
      style={({ pressed }) => [
        {
          width: CARD_WIDTH,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        },
        pressed && { opacity: 0.8 }
      ]}
    >
      {/* Icon Header */}
      <View style={{
        height: 80,
        backgroundColor: `${categoryColor}15`,
        justifyContent: "center",
        alignItems: "center",
      }}>
        <Text style={{ fontSize: 36 }}>{category?.icon || '📦'}</Text>
      </View>

      {/* Content */}
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text
          style={{
            ...typography.headline,
            color: colors.textPrimary,
          }}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{
            backgroundColor: `${categoryColor}20`,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radius.sm,
          }}>
            <Text style={{
              ...typography.small,
              color: categoryColor,
              fontWeight: "600",
            }}>
              {category?.label || item.type}
            </Text>
          </View>
          <Text style={{
            ...typography.headline,
            color: colors.textPrimary,
          }}>
            ₹{item.price}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: any, spacing: any, radius: any, typography: any) => StyleSheet.create({
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
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchWrapper: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchBarFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.elevated,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  clearButton: {
    padding: spacing.xs,
  },
  categoriesWrapper: {
    marginBottom: spacing.md,
  },
  categoriesContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryLabel: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  suggestionsWrapper: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  suggestionsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  suggestionIcon: {
    fontSize: 14,
  },
  suggestionText: {
    ...typography.caption,
    color: colors.accent,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
  },
  resultsHeader: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  seeAllText: {
    ...typography.caption,
    color: colors.accent,
  },
  listingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
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
  },
});
