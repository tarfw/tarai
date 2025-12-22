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
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { nodeService } from "@/services/nodeService";
import { COMMERCE_CATEGORIES } from "@/services/vectorStores/nodeVectorStore";
import type { CachedNode } from "@/types/node";
import { useFocusEffect, router } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";

export default function Nodes() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography, toggleTheme, isDark } = useTheme();
  const [nodes, setNodes] = useState<CachedNode[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CachedNode | null>(null);

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

  const STATUS_CONFIG = {
    active: { label: "Active", color: colors.success },
    draft: { label: "Draft", color: colors.textTertiary },
    paused: { label: "Paused", color: colors.warning },
  };

  useFocusEffect(
    useCallback(() => {
      loadNodes();
    }, [])
  );

  const loadNodes = async () => {
    try {
      const cachedNodes = await nodeService.getCachedNodes();
      setNodes(cachedNodes);
    } catch (e) {
      console.error("Failed to load nodes", e);
    }
  };

  const handleAddPress = () => {
    router.push("/node/add");
  };

  const handleItemPress = (item: CachedNode) => {
    router.push(`/node/add?id=${item.id}&mode=edit`);
  };

  const handleMorePress = (item: CachedNode) => {
    setSelectedItem(item);
    setMenuVisible(true);
  };

  const handleEdit = () => {
    setMenuVisible(false);
    if (selectedItem) {
      router.push(`/node/add?id=${selectedItem.id}&mode=edit`);
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    if (selectedItem) {
      Alert.alert(
        "Delete Node",
        `Are you sure you want to delete "${selectedItem.title}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await nodeService.deleteNode(selectedItem.id);
                loadNodes();
              } catch (error) {
                Alert.alert("Error", "Failed to delete node.");
              }
            },
          },
        ]
      );
    }
  };

  const stats = {
    total: nodes.length,
    active: nodes.length,
    views: nodes.length * 42,
  };

  const styles = createStyles(colors, spacing, radius, typography);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Items</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={toggleTheme}>
            <FontAwesome6
              name={isDark ? "moon" : "sun"}
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
            <LinearGradient
              colors={[colors.accent, colors.purple]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addButtonGradient}
            >
              <FontAwesome6 name="plus" size={16} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {nodes.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="cube" size={32} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No items yet</Text>
            <Text style={styles.emptySubtitle}>Create your first node and start selling</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleAddPress}>
              <LinearGradient
                colors={[colors.accent, colors.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyButtonGradient}
              >
                <FontAwesome6 name="plus" size={14} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Create node</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.nodesContainer}>
            {nodes.map((item) => {
              const categoryColor = categoryColors[item.type] || colors.accent;
              const category = COMMERCE_CATEGORIES[item.type as keyof typeof COMMERCE_CATEGORIES];
              const status = STATUS_CONFIG.active;

              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.nodeItem, pressed && styles.nodeItemPressed]}
                  onPress={() => handleItemPress(item)}
                >
                  <View style={[styles.nodeIcon, { backgroundColor: `${categoryColor}20` }]}>
                    <Text style={styles.nodeIconEmoji}>{category?.icon || "📦"}</Text>
                  </View>
                  <View style={styles.nodeContent}>
                    <Text style={styles.nodeTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.nodeMeta}>
                      <View style={[styles.statusBadge, { backgroundColor: `${status.color}20` }]}>
                        <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                      <Text style={styles.nodeType}>{category?.label || item.type}</Text>
                    </View>
                  </View>
                  <View style={styles.nodeRight}>
                    <Text style={styles.nodePrice}>₹{item.price}</Text>
                    <TouchableOpacity
                      style={styles.moreButton}
                      onPress={() => handleMorePress(item)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <FontAwesome6 name="ellipsis" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Context Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle} numberOfLines={1}>
                {selectedItem?.title}
              </Text>
            </View>
            <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
              <FontAwesome6 name="pen" size={16} color={colors.textPrimary} />
              <Text style={styles.menuItemText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <FontAwesome6 name="trash" size={16} color={colors.error} />
              <Text style={[styles.menuItemText, { color: colors.error }]}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuCancel]} onPress={() => setMenuVisible(false)}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
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
    nodesContainer: {
      gap: spacing.sm,
    },
    nodeItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nodeItemPressed: {
      backgroundColor: colors.surfaceHover,
    },
    nodeIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      justifyContent: "center",
      alignItems: "center",
    },
    nodeIconEmoji: {
      fontSize: 24,
    },
    nodeContent: {
      flex: 1,
      gap: spacing.xs,
    },
    nodeTitle: {
      ...typography.headline,
      color: colors.textPrimary,
    },
    nodeMeta: {
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
    nodeType: {
      ...typography.small,
      color: colors.textTertiary,
    },
    nodeRight: {
      alignItems: "flex-end",
      gap: spacing.sm,
    },
    nodePrice: {
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
      color: "#FFFFFF",
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    menuContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingBottom: spacing.xxl,
    },
    menuHeader: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuTitle: {
      ...typography.headline,
      color: colors.textPrimary,
      textAlign: "center",
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuItemText: {
      ...typography.body,
      color: colors.textPrimary,
    },
    menuCancel: {
      justifyContent: "center",
      borderBottomWidth: 0,
      marginTop: spacing.sm,
    },
    menuCancelText: {
      ...typography.headline,
      color: colors.textSecondary,
      textAlign: "center",
    },
  });
