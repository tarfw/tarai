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
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nodeService } from "@/services/nodeService";
import { cartService } from "@/services/cartService";
import { COMMERCE_CATEGORIES } from "@/services/vectorStores/nodeVectorStore";
import type { CachedNode, CommerceType } from "@/types/node";
import type { CartItemMetadata } from "@/types/cart";
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
  const [searchResults, setSearchResults] = useState<CachedNode[]>([]);
  const [cachedNodes, setCachedNodes] = useState<CachedNode[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Add to cart modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CachedNode | null>(null);
  const [metadata, setMetadata] = useState<CartItemMetadata>({});
  const [quantity, setQuantity] = useState(1);

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
      loadCachedNodes();
    }, [])
  );

  const loadCachedNodes = async () => {
    try {
      const nodes = await nodeService.getCachedNodes();
      setCachedNodes(nodes);
    } catch (e) {
      console.error('Failed to load cached nodes', e);
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
      const suggs = await nodeService.getSemanticSuggestions(query);
      setSuggestions(suggs);

      const results = await nodeService.searchNodesByText(query, {}, 10);
      const relevantResults = results.filter(r => r.similarity >= 0.15);

      const resultNodes: typeof cachedNodes = [];
      for (const result of relevantResults) {
        const node = cachedNodes.find(l => l.id === result.nodeId);
        if (node) {
          resultNodes.push(node);
        }
      }

      setSearchResults(resultNodes);
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

  const handleNodePress = (node: CachedNode) => {
    setSelectedNode(node);
    setMetadata({});
    setQuantity(1);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedNode(null);
    setMetadata({});
    setQuantity(1);
  };

  const handleAddToCart = async () => {
    if (!selectedNode) return;

    try {
      await cartService.addToCart({
        nodeId: selectedNode.id,
        nodeType: selectedNode.type as CommerceType,
        sellerId: "demo_seller", // In real app, this would come from node data
        title: selectedNode.title,
        price: selectedNode.price,
        quantity,
        thumbnail: selectedNode.thumbnail,
        metadata,
      });

      handleCloseModal();
    } catch (error) {
      console.error("Failed to add to cart:", error);
    }
  };

  const displayNodes = isSearching ? searchResults : cachedNodes;

  const styles = createStyles(colors, spacing, radius, typography);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      {/* Modern AI Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
          {!isFocused && searchQuery.length === 0 && (
            <FontAwesome6 name="magnifying-glass" size={24} color={colors.textTertiary} style={styles.searchIcon} />
          )}
          <TextInput
            placeholder="Search anything..."
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={styles.searchInput}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <FontAwesome6 name="xmark" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {isFocused && searchQuery.length === 0 && (
          <Text style={styles.searchHint}>Try "taxi", "food", "plumber"...</Text>
        )}
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

        {displayNodes.length === 0 && isSearching && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="magnifying-glass" size={32} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptySubtitle}>Try different keywords</Text>
          </View>
        )}

        <View style={styles.nodesGrid}>
          {displayNodes.map((item) => (
            <NodeCard
              key={item.id}
              item={item}
              colors={colors}
              categoryColors={categoryColors}
              spacing={spacing}
              radius={radius}
              typography={typography}
              onPress={() => handleNodePress(item)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Add to Cart Modal */}
      <AddToCartModal
        visible={modalVisible}
        node={selectedNode}
        metadata={metadata}
        setMetadata={setMetadata}
        quantity={quantity}
        setQuantity={setQuantity}
        onClose={handleCloseModal}
        onAddToCart={handleAddToCart}
        colors={colors}
        spacing={spacing}
        radius={radius}
        typography={typography}
        categoryColors={categoryColors}
      />
    </View>
  );
}

// Add to Cart Modal with type-specific fields
function AddToCartModal({
  visible,
  node,
  metadata,
  setMetadata,
  quantity,
  setQuantity,
  onClose,
  onAddToCart,
  colors,
  spacing,
  radius,
  typography,
  categoryColors,
}: {
  visible: boolean;
  node: CachedNode | null;
  metadata: CartItemMetadata;
  setMetadata: (m: CartItemMetadata) => void;
  quantity: number;
  setQuantity: (q: number) => void;
  onClose: () => void;
  onAddToCart: () => void;
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
  categoryColors: Record<string, string>;
}) {
  if (!node) return null;

  const category = COMMERCE_CATEGORIES[node.type as keyof typeof COMMERCE_CATEGORIES];
  const categoryColor = categoryColors[node.type] || colors.accent;

  const updateMetadata = (key: string, value: any) => {
    setMetadata({ ...metadata, [key]: value });
  };

  // Render type-specific metadata fields
  const renderMetadataFields = () => {
    switch (node.type) {
      case "rental":
        return (
          <View style={{ gap: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.textTertiary, textTransform: "uppercase" }}>
              Rental Details
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs }}>
                  Duration
                </Text>
                <View style={{
                  flexDirection: "row",
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  overflow: "hidden",
                }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      padding: spacing.md,
                      backgroundColor: metadata.duration === 1 ? colors.accentSubtle : "transparent",
                      alignItems: "center",
                    }}
                    onPress={() => updateMetadata("duration", 1)}
                  >
                    <Text style={{ ...typography.caption, color: metadata.duration === 1 ? colors.accent : colors.textSecondary }}>1 Day</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      padding: spacing.md,
                      backgroundColor: metadata.duration === 3 ? colors.accentSubtle : "transparent",
                      alignItems: "center",
                    }}
                    onPress={() => updateMetadata("duration", 3)}
                  >
                    <Text style={{ ...typography.caption, color: metadata.duration === 3 ? colors.accent : colors.textSecondary }}>3 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      padding: spacing.md,
                      backgroundColor: metadata.duration === 7 ? colors.accentSubtle : "transparent",
                      alignItems: "center",
                    }}
                    onPress={() => updateMetadata("duration", 7)}
                  >
                    <Text style={{ ...typography.caption, color: metadata.duration === 7 ? colors.accent : colors.textSecondary }}>7 Days</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        );

      case "booking":
      case "service":
      case "recurring_service":
        return (
          <View style={{ gap: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.textTertiary, textTransform: "uppercase" }}>
              Schedule
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {["Morning", "Afternoon", "Evening"].map((time) => (
                <TouchableOpacity
                  key={time}
                  style={{
                    flex: 1,
                    padding: spacing.md,
                    backgroundColor: metadata.scheduledTime === time ? colors.accentSubtle : colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: metadata.scheduledTime === time ? colors.accent : colors.border,
                    alignItems: "center",
                  }}
                  onPress={() => updateMetadata("scheduledTime", time)}
                >
                  <Text style={{ ...typography.caption, color: metadata.scheduledTime === time ? colors.accent : colors.textSecondary }}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case "event":
        return (
          <View style={{ gap: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.textTertiary, textTransform: "uppercase" }}>
              Tickets
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <TouchableOpacity
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onPress={() => updateMetadata("ticketCount", Math.max(1, (metadata.ticketCount || 1) - 1))}
              >
                <FontAwesome6 name="minus" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={{ ...typography.title, color: colors.textPrimary, minWidth: 40, textAlign: "center" }}>
                {metadata.ticketCount || 1}
              </Text>
              <TouchableOpacity
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onPress={() => updateMetadata("ticketCount", (metadata.ticketCount || 1) + 1)}
              >
                <FontAwesome6 name="plus" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={{ ...typography.body, color: colors.textTertiary }}>tickets</Text>
            </View>
          </View>
        );

      case "food_delivery":
        return (
          <View style={{ gap: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.textTertiary, textTransform: "uppercase" }}>
              Special Instructions
            </Text>
            <TextInput
              placeholder="Any special requests? (allergies, preferences...)"
              placeholderTextColor={colors.textTertiary}
              value={metadata.specialInstructions || ""}
              onChangeText={(text) => updateMetadata("specialInstructions", text)}
              multiline
              style={{
                ...typography.body,
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
          </View>
        );

      case "transportation":
        return (
          <View style={{ gap: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.textTertiary, textTransform: "uppercase" }}>
              Trip Details
            </Text>
            <TextInput
              placeholder="Pickup location"
              placeholderTextColor={colors.textTertiary}
              value={metadata.pickupLocation || ""}
              onChangeText={(text) => updateMetadata("pickupLocation", text)}
              style={{
                ...typography.body,
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
              }}
            />
            <TextInput
              placeholder="Drop-off location"
              placeholderTextColor={colors.textTertiary}
              value={metadata.dropoffLocation || ""}
              onChangeText={(text) => updateMetadata("dropoffLocation", text)}
              style={{
                ...typography.body,
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.md,
              }}
            />
          </View>
        );

      case "physical_product":
      case "digital_product":
        return (
          <View style={{ gap: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.textTertiary, textTransform: "uppercase" }}>
              Options
            </Text>
            <View style={{ gap: spacing.sm }}>
              <Text style={{ ...typography.small, color: colors.textSecondary }}>Size</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {["S", "M", "L", "XL"].map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={{
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.sm,
                      backgroundColor: metadata.size === size ? colors.accentSubtle : colors.surface,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: metadata.size === size ? colors.accent : colors.border,
                    }}
                    onPress={() => updateMetadata("size", size)}
                  >
                    <Text style={{ ...typography.caption, color: metadata.size === size ? colors.accent : colors.textSecondary }}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text style={{ ...typography.small, color: colors.textSecondary }}>Color</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {[
                  { name: "Black", color: "#1a1a1a" },
                  { name: "White", color: "#f5f5f5" },
                  { name: "Blue", color: "#3b82f6" },
                  { name: "Red", color: "#ef4444" },
                ].map((c) => (
                  <TouchableOpacity
                    key={c.name}
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: c.color,
                      borderRadius: radius.full,
                      borderWidth: metadata.color === c.name ? 3 : 1,
                      borderColor: metadata.color === c.name ? colors.accent : colors.border,
                    }}
                    onPress={() => updateMetadata("color", c.name)}
                  />
                ))}
              </View>
            </View>
          </View>
        );

      case "educational":
        return (
          <View style={{ gap: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.textTertiary, textTransform: "uppercase" }}>
              Course Access
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {["1 Month", "3 Months", "Lifetime"].map((access) => (
                <TouchableOpacity
                  key={access}
                  style={{
                    flex: 1,
                    padding: spacing.md,
                    backgroundColor: metadata.variant === access ? colors.accentSubtle : colors.surface,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: metadata.variant === access ? colors.accent : colors.border,
                    alignItems: "center",
                  }}
                  onPress={() => updateMetadata("variant", access)}
                >
                  <Text style={{ ...typography.caption, color: metadata.variant === access ? colors.accent : colors.textSecondary }}>
                    {access}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  // Calculate total price based on type
  const calculateTotal = () => {
    let total = node.price * quantity;

    if (node.type === "rental" && metadata.duration) {
      total = node.price * metadata.duration * quantity;
    } else if (node.type === "event" && metadata.ticketCount) {
      total = node.price * metadata.ticketCount;
    }

    return total;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable style={{
          backgroundColor: colors.background,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          maxHeight: "85%",
        }} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            <Text style={{ ...typography.title, color: colors.textPrimary }}>Add to Cart</Text>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome6 name="xmark" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
            {/* Node Info */}
            <View style={{ flexDirection: "row", gap: spacing.md, marginBottom: spacing.xl }}>
              <View style={{
                width: 72,
                height: 72,
                backgroundColor: `${categoryColor}15`,
                borderRadius: radius.lg,
                justifyContent: "center",
                alignItems: "center",
              }}>
                <Text style={{ fontSize: 32 }}>{category?.icon || "📦"}</Text>
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={{ ...typography.headline, color: colors.textPrimary }} numberOfLines={2}>
                  {node.title}
                </Text>
                <View style={{
                  alignSelf: "flex-start",
                  backgroundColor: `${categoryColor}20`,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.sm,
                }}>
                  <Text style={{ ...typography.small, color: categoryColor, fontWeight: "600" }}>
                    {category?.label || node.type}
                  </Text>
                </View>
                <Text style={{ ...typography.title, color: colors.accent }}>₹{node.price}</Text>
              </View>
            </View>

            {/* Type-specific fields */}
            {renderMetadataFields()}

            {/* Quantity (for non-event types) */}
            {node.type !== "event" && (
              <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
                <Text style={{ ...typography.caption, color: colors.textTertiary, textTransform: "uppercase" }}>
                  Quantity
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <TouchableOpacity
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    onPress={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <FontAwesome6 name="minus" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <Text style={{ ...typography.title, color: colors.textPrimary, minWidth: 40, textAlign: "center" }}>
                    {quantity}
                  </Text>
                  <TouchableOpacity
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    onPress={() => setQuantity(quantity + 1)}
                  >
                    <FontAwesome6 name="plus" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Spacer for bottom button */}
            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Add to Cart Button */}
          <View style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: spacing.lg,
            paddingBottom: spacing.xl,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
            <TouchableOpacity
              onPress={onAddToCart}
              style={{
                backgroundColor: "#007AFF",
                borderRadius: radius.lg,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.lg,
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <FontAwesome6 name="cart-plus" size={18} color="#FFFFFF" />
                <Text style={{ ...typography.headline, color: "#FFFFFF" }}>Add to Cart</Text>
              </View>
              <Text style={{ ...typography.title, color: "#FFFFFF" }}>₹{calculateTotal()}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NodeCard({
  item,
  colors,
  categoryColors,
  spacing,
  radius,
  typography,
  onPress,
}: {
  item: CachedNode;
  colors: any;
  categoryColors: Record<string, string>;
  spacing: any;
  radius: any;
  typography: any;
  onPress: () => void;
}) {
  const categoryColor = categoryColors[item.type] || colors.accent;
  const category = COMMERCE_CATEGORIES[item.type as keyof typeof COMMERCE_CATEGORIES];

  return (
    <Pressable
      onPress={onPress}
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
  searchWrapper: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderWidth: 0,
  },
  searchBarFocused: {
    backgroundColor: "transparent",
  },
  searchIcon: {
    marginRight: spacing.md,
    opacity: 0.4,
  },
  searchInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    padding: 0,
    margin: 0,
    lineHeight: 36,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginLeft: spacing.sm,
  },
  searchHint: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
    opacity: 0.6,
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
  nodesGrid: {
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
