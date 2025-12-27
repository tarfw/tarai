import { FontAwesome6 } from '@expo/vector-icons';
import { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getAllNodes, searchNodes, deleteNode, getNodeStats } from '@/services/nodeService';
import { COMMERCE_CATEGORIES } from '@/services/vectorStores/nodeVectorStore';
import type { NodeRecord, NodeType, NodeStatus } from '@/types/node';
import { useFocusEffect, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_PADDING * 2 - CARD_GAP) / 2;

const STATUS_COLORS: Record<NodeStatus, string> = {
  active: '#22c55e',
  pending: '#f59e0b',
  completed: '#3b82f6',
  cancelled: '#ef4444',
};

export default function NodesScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography, toggleTheme, isDark } = useTheme();
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<NodeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<NodeType | 'all'>('all');
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NodeRecord | null>(null);
  const [stats, setStats] = useState({ total: 0, byType: {} as Record<string, number>, byStatus: {} as Record<string, number> });
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryColors: Record<string, string> = {
    transport: colors.blue,
    food: colors.orange,
    service: colors.green,
    booking: colors.purple,
    product: colors.teal,
    education: colors.pink,
    event: colors.warning,
    rental: colors.accent,
    digital: colors.success,
    subscription: colors.error,
    healthcare: '#ec4899',
    realestate: '#8b5cf6',
  };

  useFocusEffect(
    useCallback(() => {
      loadNodes();
      loadStats();
    }, [])
  );

  const loadNodes = async () => {
    try {
      const allNodes = await getAllNodes();
      // Filter out structural types for main view
      const commerceNodes = allNodes.filter(
        (n) => !['variant', 'inventory', 'store', 'cart', 'search'].includes(n.type)
      );
      setNodes(commerceNodes);
      setFilteredNodes(commerceNodes);
    } catch (e) {
      console.error('Failed to load nodes', e);
    }
  };

  const loadStats = async () => {
    try {
      const nodeStats = await getNodeStats();
      setStats(nodeStats);
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    // Clear previous timeout to debounce
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length === 0) {
      setIsSearching(false);
      applyFilter(selectedFilter, nodes);
      return;
    }

    // Debounce search by 300ms to avoid concurrent model calls
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchNodes(query, {}, 30);
        setFilteredNodes(results);
      } catch (e) {
        console.error('Search failed', e);
      }
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    applyFilter(selectedFilter, nodes);
  };

  const applyFilter = (filter: NodeType | 'all', nodeList: NodeRecord[] = nodes) => {
    setSelectedFilter(filter);
    if (filter === 'all') {
      setFilteredNodes(nodeList);
    } else {
      setFilteredNodes(nodeList.filter((n) => n.type === filter));
    }
  };

  const handleAddPress = () => {
    router.push('/node/add');
  };

  const handleItemPress = (item: NodeRecord) => {
    router.push(`/node/add?id=${item.id}&mode=edit`);
  };

  const handleMorePress = (item: NodeRecord) => {
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
      Alert.alert('Delete Node', `Are you sure you want to delete "${selectedItem.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNode(selectedItem.id);
              loadNodes();
              loadStats();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete node.');
            }
          },
        },
      ]);
    }
  };

  const styles = createStyles(colors, spacing, radius, typography);

  const filterTypes: (NodeType | 'all')[] = ['all', 'product', 'food', 'service', 'booking', 'transport', 'event'];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
        <TextInput
            placeholder="Search nodes..."
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
              <FontAwesome6 name="xmark" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
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

      {/* Stats Row */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: STATUS_COLORS.active }]}>
            {stats.byStatus.active || 0}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: STATUS_COLORS.pending }]}>
            {stats.byStatus.pending || 0}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {filterTypes.map((type) => {
            const category = type === 'all' ? null : COMMERCE_CATEGORIES[type];
            const isActive = selectedFilter === type;

            return (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => applyFilter(type)}
              >
                {category && <Text style={styles.filterIcon}>{category.icon}</Text>}
                <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                  {type === 'all' ? 'All' : category?.label || type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Node Grid */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {filteredNodes.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="cube" size={32} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No nodes</Text>
            <Text style={styles.emptySubtitle}>Create your first node</Text>
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
          <View style={styles.nodesGrid}>
            {filteredNodes.map((item) => (
              <NodeCard
                key={item.id}
                item={item}
                colors={colors}
                categoryColors={categoryColors}
                spacing={spacing}
                radius={radius}
                typography={typography}
                onPress={() => handleItemPress(item)}
                onMore={() => handleMorePress(item)}
                showSimilarity={isSearching}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Context Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
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
            <TouchableOpacity
              style={[styles.menuItem, styles.menuCancel]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
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
  onMore,
  showSimilarity,
}: {
  item: NodeRecord;
  colors: any;
  categoryColors: Record<string, string>;
  spacing: any;
  radius: any;
  typography: any;
  onPress: () => void;
  onMore: () => void;
  showSimilarity?: boolean;
}) {
  const categoryColor = categoryColors[item.type] || colors.accent;
  const category = COMMERCE_CATEGORIES[item.type as keyof typeof COMMERCE_CATEGORIES];
  const statusColor = STATUS_COLORS[item.status] || colors.textTertiary;
  const similarityPercent = item.similarity ? Math.round(item.similarity * 100) : null;

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
          overflow: 'hidden',
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      {/* Icon Header */}
      <View
        style={{
          height: 80,
          backgroundColor: `${categoryColor}15`,
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <Text style={{ fontSize: 36 }}>{category?.icon || '📦'}</Text>
        {/* Similarity Badge */}
        {showSimilarity && similarityPercent !== null && (
          <View
            style={{
              position: 'absolute',
              top: spacing.sm,
              left: spacing.sm,
              backgroundColor: colors.accent,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              borderRadius: radius.sm,
            }}
          >
            <Text style={{ ...typography.small, color: '#FFFFFF', fontWeight: '700' }}>
              {similarityPercent}%
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: spacing.sm,
            right: spacing.sm,
            padding: spacing.xs,
          }}
          onPress={onMore}
        >
          <FontAwesome6 name="ellipsis" size={14} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={{ ...typography.headline, color: colors.textPrimary }} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: statusColor,
              }}
            />
            <Text
              style={{
                ...typography.small,
                color: statusColor,
                textTransform: 'capitalize',
              }}
            >
              {item.status}
            </Text>
          </View>
          <Text style={{ ...typography.headline, color: colors.textPrimary }}>
            {item.value > 0 ? `₹${item.value}` : 'Free'}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: `${categoryColor}20`,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radius.sm,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ ...typography.small, color: categoryColor, fontWeight: '600' }}>
            {category?.label || item.type}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: any, spacing: any, radius: any, typography: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchWrapper: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
    },
    searchBarFocused: {},

    searchInput: {
      flex: 1,
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
      padding: 0,
    },
    clearButton: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginLeft: spacing.sm,
    },
    addButton: {
      borderRadius: radius.md,
      overflow: 'hidden',
      marginLeft: spacing.sm,
    },
    addButtonGradient: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statsContainer: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
    },
    statValue: {
      ...typography.title,
      color: colors.textPrimary,
    },
    statLabel: {
      ...typography.small,
      color: colors.textTertiary,
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.border,
      marginHorizontal: spacing.md,
    },
    filtersWrapper: {
      marginBottom: spacing.md,
    },
    filtersContainer: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    filterChip: {
      height: 36,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
    },
    filterChipActive: {
      backgroundColor: colors.accentSubtle,
      borderColor: colors.accent,
    },
    filterIcon: {
      fontSize: 14,
    },
    filterLabel: {
      ...typography.caption,
      color: colors.textPrimary,
    },
    filterLabelActive: {
      color: colors.accent,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: spacing.lg,
    },
    nodesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: CARD_GAP,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl * 2,
      gap: spacing.md,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    emptyTitle: {
      ...typography.title,
      color: colors.textPrimary,
    },
    emptySubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    emptyButton: {
      marginTop: spacing.md,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    emptyButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    emptyButtonText: {
      ...typography.headline,
      color: '#FFFFFF',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
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
      textAlign: 'center',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
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
      justifyContent: 'center',
      borderBottomWidth: 0,
      marginTop: spacing.sm,
    },
    menuCancelText: {
      ...typography.headline,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
