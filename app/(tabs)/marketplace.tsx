import { FontAwesome6 } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  FlatList
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listingService } from "@/services/listingService";
import { COMMERCE_CATEGORIES } from "@/services/vectorStores/listingVectorStore";
import type { CachedListing } from "@/types/listing";
import { colors } from "@/constants/theme";
import { useFocusEffect } from "expo-router";

export default function Marketplace() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ text: string; type: string; icon: string }>>([]);
  const [searchResults, setSearchResults] = useState<CachedListing[]>([]);
  const [cachedListings, setCachedListings] = useState<CachedListing[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCachedListings();
    }, [])
  );

  const loadCachedListings = async () => {
    try {
      const listings = await listingService.getCachedListings();
      console.log('Marketplace loaded listings:', listings.length, listings);
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
      // Get semantic suggestions
      const suggs = await listingService.getSemanticSuggestions(query);
      setSuggestions(suggs);

      // Perform search (vector or text fallback)
      const results = await listingService.searchListingsByText(query, {}, 10);
      console.log('Search results:', results);

      // Filter results by similarity threshold (0.15 minimum)
      const relevantResults = results.filter(r => r.similarity >= 0.15);
      console.log('Relevant results (similarity >= 0.15):', relevantResults.length);

      // Map results to cached listings, preserving search order
      const resultListings: typeof cachedListings = [];
      for (const result of relevantResults) {
        const listing = cachedListings.find(l => l.id === result.listingId);
        if (listing) {
          resultListings.push(listing);
        }
      }
      console.log('Filtered listings:', resultListings.length);

      setSearchResults(resultListings);
    } catch (e) {
      console.error('Failed to search', e);
    }
  };

  const handleSuggestionPress = (suggestion: { text: string; type: string }) => {
    handleSearch(suggestion.text);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
    setSuggestions([]);
    setSearchResults([]);
  };

  const renderListingCard = ({ item }: { item: CachedListing }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardType}>
          {COMMERCE_CATEGORIES[item.type as keyof typeof COMMERCE_CATEGORIES]?.icon || '📦'}
        </Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.cardPrice}>₹{item.price}</Text>
        <Text style={styles.cardTypeLabel}>
          {COMMERCE_CATEGORIES[item.type as keyof typeof COMMERCE_CATEGORIES]?.label || item.type}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSuggestion = ({ item }: { item: { text: string; type: string; icon: string } }) => (
    <TouchableOpacity
      style={styles.suggestionChip}
      onPress={() => handleSuggestionPress(item)}
    >
      <Text style={styles.suggestionIcon}>{item.icon}</Text>
      <Text style={styles.suggestionText}>{item.text}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TARAI</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <FontAwesome6 name="magnifying-glass" size={18} color={colors.textSecondary} />
          <TextInput
            placeholder="Search marketplace..."
            value={searchQuery}
            onChangeText={handleSearch}
            style={styles.searchInput}
            placeholderTextColor={colors.textSecondary}
          />
          {isSearching && (
            <TouchableOpacity onPress={handleClearSearch}>
              <FontAwesome6 name="xmark" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.sectionLabel}>Suggestions</Text>
          <FlatList
            horizontal
            data={suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item, index) => `${item.type}-${index}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsList}
          />
        </View>
      )}

      {/* Results or All Listings */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.sectionLabel}>
          {isSearching
            ? `Search Results (${searchResults.length})`
            : `All Listings (${cachedListings.length})`}
        </Text>

        {isSearching && searchResults.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No results found</Text>
            <Text style={styles.emptyStateSubtext}>Try different keywords</Text>
          </View>
        )}

        {!isSearching && cachedListings.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No listings yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Demo data will load automatically
            </Text>
          </View>
        )}

        <View style={styles.listingsGrid}>
          {(isSearching ? searchResults : cachedListings).map(item => (
            <View key={item.id} style={styles.gridItem}>
              {renderListingCard({ item })}
            </View>
          ))}
        </View>
      </ScrollView>
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
  searchContainer: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },
  suggestionsContainer: {
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  suggestionsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  suggestionIcon: {
    fontSize: 16,
  },
  suggestionText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 12,
  },
  listingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridItem: {
    width: "48%",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  cardType: {
    fontSize: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2196F3",
  },
  cardTypeLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
