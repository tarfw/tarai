import { FontAwesome6 } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cartService, calculateItemTotal } from "@/services/cartService";
import { COMMERCE_CATEGORIES } from "@/services/vectorStores/nodeVectorStore";
import type { CartItem, CartSummary } from "@/types/cart";
import { useFocusEffect, router } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";

export default function Cart() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [summary, setSummary] = useState<CartSummary>({
    itemCount: 0,
    subtotal: 0,
    byType: {} as any,
    bySeller: {},
  });

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
      loadCart();
    }, [])
  );

  const loadCart = async () => {
    try {
      const items = await cartService.getCartItems();
      const cartSummary = await cartService.getCartSummary();
      setCartItems(items);
      setSummary(cartSummary);
    } catch (e) {
      console.error("Failed to load cart", e);
    }
  };

  const handleQuantityChange = async (item: CartItem, delta: number) => {
    const newQuantity = item.quantity + delta;
    if (newQuantity <= 0) {
      handleRemoveItem(item);
      return;
    }
    try {
      await cartService.updateQuantity(item.id, newQuantity);
      loadCart();
    } catch (e) {
      console.error("Failed to update quantity", e);
    }
  };

  const handleRemoveItem = (item: CartItem) => {
    Alert.alert(
      "Remove Item",
      `Remove "${item.title}" from cart?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await cartService.removeFromCart(item.id);
              loadCart();
            } catch (e) {
              console.error("Failed to remove item", e);
            }
          },
        },
      ]
    );
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;

    Alert.alert(
      "Clear Cart",
      "Remove all items from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await cartService.clearCart();
              loadCart();
            } catch (e) {
              console.error("Failed to clear cart", e);
            }
          },
        },
      ]
    );
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    Alert.alert("Checkout", "Checkout flow coming soon!");
  };

  const handleBrowse = () => {
    router.push("/(tabs)/marketplace");
  };

  const formatMetadata = (item: CartItem): string | null => {
    const { metadata, nodeType } = item;
    const parts: string[] = [];

    if (nodeType === "rental" && metadata.duration) {
      parts.push(`${metadata.duration} ${metadata.durationUnit || "days"}`);
    }
    if (nodeType === "booking" && metadata.scheduledDate) {
      parts.push(new Date(metadata.scheduledDate).toLocaleDateString());
    }
    if (nodeType === "event" && metadata.ticketCount) {
      parts.push(`${metadata.ticketCount} tickets`);
    }
    if (metadata.variant) parts.push(metadata.variant);
    if (metadata.size) parts.push(metadata.size);
    if (metadata.color) parts.push(metadata.color);

    return parts.length > 0 ? parts.join(" • ") : null;
  };

  const styles = createStyles(colors, spacing, radius, typography);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cart</Text>
        {cartItems.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearCart}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary Card */}
      {cartItems.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items</Text>
            <Text style={styles.summaryValue}>{summary.itemCount}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryTotal}>₹{summary.subtotal.toFixed(2)}</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: cartItems.length > 0 ? 100 + insets.bottom : 80 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {cartItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="cart-shopping" size={32} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySubtitle}>Browse the marketplace and add items to your cart</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleBrowse} activeOpacity={0.8}>
              <FontAwesome6 name="compass" size={14} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Browse Marketplace</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cartContainer}>
            {/* Group by seller */}
            {Object.entries(summary.bySeller).map(([sellerId, group]) => (
              <View key={sellerId} style={styles.sellerGroup}>
                <View style={styles.sellerHeader}>
                  <FontAwesome6 name="store" size={12} color={colors.textTertiary} />
                  <Text style={styles.sellerName}>Seller: {sellerId.slice(0, 8)}...</Text>
                  <Text style={styles.sellerSubtotal}>₹{group.subtotal.toFixed(2)}</Text>
                </View>

                {group.items.map((item) => {
                  const categoryColor = categoryColors[item.nodeType] || colors.accent;
                  const category = COMMERCE_CATEGORIES[item.nodeType as keyof typeof COMMERCE_CATEGORIES];
                  const itemTotal = calculateItemTotal(item);
                  const metadataText = formatMetadata(item);

                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [styles.cartItem, pressed && styles.cartItemPressed]}
                    >
                      <View style={[styles.itemIcon, { backgroundColor: `${categoryColor}20` }]}>
                        <Text style={styles.itemIconEmoji}>{category?.icon || "📦"}</Text>
                      </View>

                      <View style={styles.itemContent}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.itemType}>{category?.label || item.nodeType}</Text>
                        {metadataText && (
                          <Text style={styles.itemMeta}>{metadataText}</Text>
                        )}
                      </View>

                      <View style={styles.itemRight}>
                        <Text style={styles.itemPrice}>₹{itemTotal.toFixed(2)}</Text>

                        {/* Quantity controls */}
                        <View style={styles.quantityContainer}>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => handleQuantityChange(item, -1)}
                          >
                            <FontAwesome6 name="minus" size={10} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <Text style={styles.quantityText}>{item.quantity}</Text>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => handleQuantityChange(item, 1)}
                          >
                            <FontAwesome6 name="plus" size={10} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>

                        {/* Remove button */}
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleRemoveItem(item)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <FontAwesome6 name="trash" size={12} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Checkout Button */}
      {cartItems.length > 0 && (
        <View style={[styles.checkoutContainer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout} activeOpacity={0.8}>
            <Text style={styles.checkoutText}>Checkout</Text>
            <Text style={styles.checkoutTotal}>₹{summary.subtotal.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any, spacing: any, radius: any, typography: any) =>
  StyleSheet.create({
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
    clearButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    clearButtonText: {
      ...typography.body,
      color: colors.error,
    },
    summaryCard: {
      marginHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      ...typography.body,
      color: colors.textSecondary,
    },
    summaryValue: {
      ...typography.headline,
      color: colors.textPrimary,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.sm,
    },
    summaryTotal: {
      ...typography.title,
      color: colors.accent,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: spacing.lg,
    },
    cartContainer: {
      gap: spacing.lg,
    },
    sellerGroup: {
      gap: spacing.sm,
    },
    sellerHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    sellerName: {
      ...typography.caption,
      color: colors.textTertiary,
      flex: 1,
    },
    sellerSubtotal: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    cartItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cartItemPressed: {
      backgroundColor: colors.surfaceHover,
    },
    itemIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      justifyContent: "center",
      alignItems: "center",
    },
    itemIconEmoji: {
      fontSize: 24,
    },
    itemContent: {
      flex: 1,
      gap: 2,
    },
    itemTitle: {
      ...typography.headline,
      color: colors.textPrimary,
    },
    itemType: {
      ...typography.small,
      color: colors.textTertiary,
    },
    itemMeta: {
      ...typography.small,
      color: colors.textSecondary,
      fontStyle: "italic",
    },
    itemRight: {
      alignItems: "flex-end",
      gap: spacing.xs,
    },
    itemPrice: {
      ...typography.headline,
      color: colors.textPrimary,
    },
    quantityContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
    },
    quantityButton: {
      width: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.xs,
    },
    quantityText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: "600",
      minWidth: 20,
      textAlign: "center",
    },
    removeButton: {
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
      backgroundColor: "#007AFF",
      borderRadius: radius.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    emptyButtonText: {
      ...typography.headline,
      color: "#FFFFFF",
    },
    checkoutContainer: {
      position: "absolute",
      bottom: 60,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    checkoutButton: {
      backgroundColor: "#007AFF",
      borderRadius: radius.lg,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    checkoutText: {
      ...typography.title,
      color: "#FFFFFF",
    },
    checkoutTotal: {
      ...typography.title,
      color: "#FFFFFF",
    },
  });
