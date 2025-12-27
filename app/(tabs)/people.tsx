import { FontAwesome6 } from '@expo/vector-icons';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getAllPeople,
  getPersonWithRoles,
  searchPeople,
  getPeopleStats,
} from '@/services/peopleService';
import { getNodeById } from '@/services/nodeService';
import { getTasksByPerson } from '@/services/taskService';
import { ROLE_CATEGORIES } from '@/services/vectorStores/nodeVectorStore';
import type { PersonRole, NodeRecord, TaskRecord } from '@/types/node';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PeopleScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [people, setPeople] = useState<string[]>([]);
  const [filteredPeople, setFilteredPeople] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [stats, setStats] = useState<{ total: number; byRole: Record<string, number> }>({
    total: 0,
    byRole: {},
  });
  const [activeFilter, setActiveFilter] = useState<PersonRole | 'all'>('all');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadPeople();
      loadStats();
    }, [])
  );

  const loadPeople = async () => {
    try {
      const allPeople = await getAllPeople();
      setPeople(allPeople);
      setFilteredPeople(allPeople);
    } catch (e) {
      console.error('Failed to load people', e);
    }
  };

  const loadStats = async () => {
    try {
      const peopleStats = await getPeopleStats();
      setStats(peopleStats);
    } catch (e) {
      console.error('Failed to load people stats', e);
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
      applyFilter(activeFilter, people);
      return;
    }

    // Debounce search by 300ms to avoid concurrent model calls
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPeople(query);
        const uniqueIds = [...new Set(results.map((r) => r.personid))];
        setFilteredPeople(uniqueIds);
      } catch (e) {
        console.error('Search failed', e);
      }
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    applyFilter(activeFilter, people);
  };

  const applyFilter = async (filter: PersonRole | 'all', peopleList: string[] = people) => {
    setActiveFilter(filter);
    if (filter === 'all') {
      setFilteredPeople(peopleList);
    } else {
      // Need to filter by role - search people with specific role
      try {
        const results = await searchPeople('');
        const filtered = results.filter((r) => r.role === filter);
        const uniqueIds = [...new Set(filtered.map((r) => r.personid))];
        setFilteredPeople(uniqueIds);
      } catch (e) {
        setFilteredPeople(peopleList);
      }
    }
  };

  const styles = createStyles(colors, spacing, radius, typography);

  const roleFilters: (PersonRole | 'all')[] = ['all', 'seller', 'buyer', 'driver', 'staff'];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
          {!isFocused && searchQuery.length === 0 && (
            <FontAwesome6
              name="magnifying-glass"
              size={24}
              color={colors.textTertiary}
              style={styles.searchIcon}
            />
          )}
          <TextInput
            placeholder="Search people..."
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
        </View>
      </View>

      {/* Role Filter Chips */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {roleFilters.map((role) => {
            const roleInfo = role === 'all' ? null : ROLE_CATEGORIES[role];
            const count = role === 'all' ? stats.total : stats.byRole[role] || 0;
            const isActive = activeFilter === role;

            return (
              <TouchableOpacity
                key={role}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => applyFilter(role)}
              >
                {roleInfo && <Text style={styles.filterIcon}>{roleInfo.icon}</Text>}
                <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                  {role === 'all' ? 'All' : roleInfo?.label || role}
                </Text>
                <Text style={[styles.filterCount, isActive && styles.filterCountActive]}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* People List */}
      <ScrollView
      style={styles.content}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: 80 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      >
      {filteredPeople.length === 0 ? (
      <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
      <FontAwesome6 name="users" size={32} color={colors.textTertiary} />
      </View>
      <Text style={styles.emptyTitle}>No people</Text>
      <Text style={styles.emptySubtitle}>People from nodes will appear here</Text>
      </View>
      ) : (
      <View style={styles.listContainer}>
      {filteredPeople.map((personId, index) => (
      <PersonRow
        key={personId}
        personId={personId}
        colors={colors}
        spacing={spacing}
        radius={radius}
        typography={typography}
        isLast={index === filteredPeople.length - 1}
      />
      ))}
      </View>
      )}
      </ScrollView>
    </View>
  );
}

function PersonRow({
  personId,
  colors,
  spacing,
  radius,
  typography,
  isLast,
}: {
  personId: string;
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
  isLast: boolean;
}) {
  const displayName = personId.replace('person_', '').replace(/_/g, ' ');
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const [roleCount, setRoleCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);

  // Load role and task counts on mount
  useEffect(() => {
    (async () => {
      try {
        const details = await getPersonWithRoles(personId);
        const tasks = await getTasksByPerson(personId);
        setRoleCount(new Set(details.roles.map((r) => r.role)).size);
        setTaskCount(tasks.filter((t) => t.status === 'pending' || t.status === 'progress').length);
      } catch (e) {
        console.error('Failed to load person data', e);
      }
    })();
  }, []);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        gap: spacing.md,
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.accentSubtle,
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Text style={{ ...typography.caption, color: colors.accent, fontWeight: '600' }}>
          {initials}
        </Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '500',
            color: colors.textPrimary,
          }}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={{ fontSize: 13, fontWeight: '400', color: colors.textTertiary }}>
            👤 {roleCount} {roleCount === 1 ? 'role' : 'roles'}
          </Text>
        </View>
      </View>

      {/* Task count */}
      {taskCount > 0 && (
        <View
          style={{
            backgroundColor: '#f59e0b20',
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radius.sm,
          }}
        >
          <Text style={{ ...typography.caption, color: '#f59e0b', fontWeight: '600' }}>
            {taskCount}
          </Text>
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
    searchIcon: {
      marginRight: spacing.md,
      opacity: 0.4,
    },
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
    filterCount: {
      ...typography.small,
      color: colors.textTertiary,
    },
    filterCountActive: {
      color: colors.accent,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: spacing.lg,
    },
    listContainer: {
      width: '100%',
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
    },
  });
