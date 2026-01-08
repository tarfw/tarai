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
import { getAllMemories, searchMemories, deleteMemory, getMemoryStats } from '@/services/memoryService';
import { COMMERCE_CATEGORIES } from '@/services/vectorStores/memoryVectorStore';
import type { MemoryRecord, MemoryType, MemoryStatus } from '@/types/memory';
import { useFocusEffect, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

const STATUS_CONFIG: Record<MemoryStatus, { color: string }> = {
  active: { color: '#22c55e' },
  pending: { color: '#f59e0b' },
  completed: { color: '#3b82f6' },
  cancelled: { color: '#ef4444' },
};

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [filteredMemories, setFilteredMemories] = useState<MemoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MemoryRecord | null>(null);
  const [stats, setStats] = useState({ total: 0, byType: {} as Record<string, number>, byStatus: {} as Record<string, number> });
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadMemories();
      loadStats();
    }, [])
  );

  const loadMemories = async () => {
    try {
      const allMemories = await getAllMemories();
      const commerceMemories = allMemories.filter(
        (n) => !['variant', 'inventory', 'store', 'cart', 'search'].includes(n.type)
      );
      setMemories(commerceMemories);
      setFilteredMemories(commerceMemories);
    } catch (e) {
      console.error('Failed to load memories', e);
    }
  };

  const loadStats = async () => {
    try {
      const memoryStats = await getMemoryStats();
      setStats(memoryStats);
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.trim().length === 0) {
      setIsSearching(false);
      setFilteredMemories(memories);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchMemories(query, {}, 30);
        setFilteredMemories(results);
      } catch (e) {
        console.error('Search failed', e);
      }
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setFilteredMemories(memories);
  };

  const handleAddPress = () => {
    router.push('/memory/add');
  };

  const handleItemPress = (item: MemoryRecord) => {
    router.push(`/memory/add?id=${item.id}&mode=edit`);
  };

  const handleMorePress = (item: MemoryRecord) => {
    setSelectedItem(item);
    setMenuVisible(true);
  };

  const handleEdit = () => {
    setMenuVisible(false);
    if (selectedItem) {
      router.push(`/memory/add?id=${selectedItem.id}&mode=edit`);
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    if (selectedItem) {
      Alert.alert('Delete Memory', `Are you sure you want to delete "${selectedItem.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMemory(selectedItem.id);
              loadMemories();
              loadStats();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete memory.');
            }
          },
        },
      ]);
    }
  };



  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Memories</Text>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.accent }]} onPress={handleAddPress}>
          <FontAwesome6 name="plus" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: isFocused ? colors.accent : colors.border }]}>
          <FontAwesome6 name="magnifying-glass" size={16} color={colors.textTertiary} />
          <TextInput
            placeholder="Search memories..."
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



      {/* Memories List */}
      <View style={styles.listWrapper}>
        {filteredMemories.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
              <FontAwesome6 name="cube" size={40} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No memories found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Create your first memory
            </Text>
            <TouchableOpacity style={[styles.emptyButton, { backgroundColor: colors.accent }]} onPress={handleAddPress}>
              <FontAwesome6 name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Create Memory</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredMemories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MemoryCard
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

function MemoryCard({
  item,
  colors,
  onPress,
  onMore,
  showSimilarity,
}: {
  item: MemoryRecord;
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
      style={[styles.memoryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      activeOpacity={0.7}
    >
      <View style={styles.memoryHeader}>
        <View style={styles.memoryHeaderLeft}>
          <Text style={styles.memoryIcon}>{category?.icon || '📦'}</Text>
          <View style={styles.memoryHeaderInfo}>
            <Text style={[styles.memoryTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.title || 'Untitled'}
            </Text>
            <View style={styles.memoryMeta}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.memoryStatus, { color: statusColor }]}>
                {item.status || 'active'}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.moreButton} onPress={onMore}>
          <FontAwesome6 name="ellipsis-vertical" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={styles.memoryFooter}>
        <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
          {category?.label || item.type}
        </Text>
        <Text style={[styles.memoryValue, { color: colors.textPrimary }]}>
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
  memoryCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  memoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  memoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memoryIcon: {
    fontSize: 32,
  },
  memoryHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  memoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memoryStatus: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  moreButton: {
    padding: 4,
  },
  memoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  memoryValue: {
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
