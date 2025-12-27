import { FontAwesome6 } from '@expo/vector-icons';
import { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  FlatList,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllNodes, searchNodes, deleteNode, getNodeStats } from '@/services/nodeService';
import { COMMERCE_CATEGORIES } from '@/services/vectorStores/nodeVectorStore';
import type { NodeRecord, NodeType, NodeStatus } from '@/types/node';
import { useFocusEffect, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

const STATUS_CONFIG: Record<NodeStatus, { color: string }> = {
  active: { color: '#22c55e' },
  pending: { color: '#f59e0b' },
  completed: { color: '#3b82f6' },
  cancelled: { color: '#ef4444' },
};

export default function NodesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [filteredNodes, setFilteredNodes] = useState<NodeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NodeRecord | null>(null);
  const [stats, setStats] = useState({ total: 0, byType: {} as Record<string, number>, byStatus: {} as Record<string, number> });
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadNodes();
      loadStats();
    }, [])
  );

  const loadNodes = async () => {
    try {
      const allNodes = await getAllNodes();
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
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.trim().length === 0) {
      setIsSearching(false);
      setFilteredNodes(nodes);
      return;
    }

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
    setFilteredNodes(nodes);
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

  const filterTypes: (NodeType | 'all')[] = ['all', 'product', 'food', 'service', 'booking', 'transport', 'event'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Nodes</Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.accent }]} onPress={handleAddPress}>
          <FontAwesome6 name="plus" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: isFocused ? colors.accent : colors.border }]}>
          <FontAwesome6 name="magnifying-glass" size={16} color={colors.textTertiary} />
          <TextInput
            placeholder="Search nodes..."
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <FontAwesome6 name="xmark" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>



      {/* Nodes List */}
      <View style={styles.listWrapper}>
        {filteredNodes.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
              <FontAwesome6 name="cube" size={40} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No nodes found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {selectedFilter === 'all' ? 'Create your first node' : `No ${selectedFilter} nodes`}
            </Text>
            <TouchableOpacity style={[styles.emptyButton, { backgroundColor: colors.accent }]} onPress={handleAddPress}>
              <FontAwesome6 name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Create Node</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredNodes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NodeCard
                item={item}
                colors={colors}
                onPress={() => handleItemPress(item)}
                onMore={() => handleMorePress(item)}
                showSimilarity={isSearching}
              />
            )}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Context Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.menuTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {selectedItem?.title}
              </Text>
            </View>
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleEdit}>
              <FontAwesome6 name="pen" size={16} color={colors.textPrimary} />
              <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <FontAwesome6 name="trash" size={16} color={colors.error} />
              <Text style={[styles.menuItemText, { color: colors.error }]}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCancel} onPress={() => setMenuVisible(false)}>
              <Text style={[styles.menuCancelText, { color: colors.textSecondary }]}>Cancel</Text>
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
  onPress,
  onMore,
  showSimilarity,
}: {
  item: NodeRecord;
  colors: any;
  onPress: () => void;
  onMore: () => void;
  showSimilarity?: boolean;
}) {
  const category = COMMERCE_CATEGORIES[item.type as keyof typeof COMMERCE_CATEGORIES];
  const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
  const statusColor = statusConfig?.color || '#22c55e';
  const similarityPercent = item.similarity ? Math.round(item.similarity * 100) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.nodeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.7}
    >
      <View style={styles.nodeHeader}>
        <View style={styles.nodeHeaderLeft}>
          <Text style={styles.nodeIcon}>{category?.icon || '📦'}</Text>
          <View style={styles.nodeHeaderInfo}>
            <Text style={[styles.nodeTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.title || 'Untitled'}
            </Text>
            <View style={styles.nodeMeta}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.nodeStatus, { color: statusColor }]}>
                {item.status || 'active'}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.moreButton} onPress={onMore}>
          <FontAwesome6 name="ellipsis-vertical" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.nodeFooter}>
        <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
          {category?.label || item.type}
        </Text>
        <Text style={[styles.nodeValue, { color: colors.textPrimary }]}>
          {item.value > 0 ? `₹${item.value}` : 'Free'}
        </Text>
      </View>

      {showSimilarity && similarityPercent !== null && (
        <View style={[styles.similarityBadge, { backgroundColor: colors.accent }]}>
          <Text style={styles.similarityText}>{similarityPercent}%</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },


  listWrapper: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
  },
  nodeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nodeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  nodeIcon: {
    fontSize: 32,
  },
  nodeHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  nodeTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  nodeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nodeStatus: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  moreButton: {
    padding: 4,
  },
  nodeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  nodeValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  similarityBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  similarityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  menuHeader: {
    padding: 20,
    borderBottomWidth: 1,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuCancel: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
