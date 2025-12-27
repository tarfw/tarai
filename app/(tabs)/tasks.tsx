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
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getAllTasks, searchTasks, getTaskStats, updateTaskStatus } from '@/services/taskService';
import { TASK_CATEGORIES } from '@/services/vectorStores/nodeVectorStore';
import type { TaskRecord, TaskStatus } from '@/types/node';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#f59e0b',
  progress: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#ef4444',
};

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Normal', color: '#64748b' },
  1: { label: 'High', color: '#f59e0b' },
  2: { label: 'Urgent', color: '#ef4444' },
};

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, progress: 0, completed: 0, cancelled: 0, overdue: 0 });
  const [activeFilter, setActiveFilter] = useState<TaskStatus | 'all'>('all');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
      loadStats();
    }, [])
  );

  const loadTasks = async () => {
    try {
      const allTasks = await getAllTasks();
      setTasks(allTasks);
      setFilteredTasks(allTasks);
    } catch (e) {
      console.error('Failed to load tasks', e);
    }
  };

  const loadStats = async () => {
    try {
      const taskStats = await getTaskStats();
      setStats(taskStats);
    } catch (e) {
      console.error('Failed to load task stats', e);
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
      applyFilter(activeFilter, tasks);
      return;
    }

    // Debounce search by 300ms to avoid concurrent model calls
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchTasks(query);
        setFilteredTasks(results);
      } catch (e) {
        console.error('Search failed', e);
      }
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    applyFilter(activeFilter, tasks);
  };

  const applyFilter = (filter: TaskStatus | 'all', taskList: TaskRecord[] = tasks) => {
    setActiveFilter(filter);
    if (filter === 'all') {
      setFilteredTasks(taskList);
    } else {
      setFilteredTasks(taskList.filter((t) => t.status === filter));
    }
  };

  const handleTaskAction = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateTaskStatus(taskId, newStatus);
      await loadTasks();
      await loadStats();
    } catch (e) {
      console.error('Failed to update task', e);
    }
  };

  const styles = createStyles(colors, spacing, radius, typography);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
        <TextInput
            placeholder="Search tasks..."
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

      {/* Filter Chips */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsContainer}
        >
        <TouchableOpacity
          style={[styles.statChip, activeFilter === 'all' && styles.statChipActive]}
          onPress={() => applyFilter('all')}
        >
          <Text style={[styles.statLabel, activeFilter === 'all' && styles.statLabelActive]}>All</Text>
          <Text style={[styles.statNumber, activeFilter === 'all' && styles.statNumberActive]}>
            {stats.total}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statChip, activeFilter === 'pending' && styles.statChipActive]}
          onPress={() => applyFilter('pending')}
        >
          <Text style={[styles.statLabel, activeFilter === 'pending' && styles.statLabelActive]}>Pending</Text>
          <Text style={[styles.statNumber, activeFilter === 'pending' && styles.statNumberActive, { color: STATUS_COLORS.pending }]}>{stats.pending}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statChip, activeFilter === 'progress' && styles.statChipActive]}
          onPress={() => applyFilter('progress')}
        >
          <Text style={[styles.statLabel, activeFilter === 'progress' && styles.statLabelActive]}>In Progress</Text>
          <Text style={[styles.statNumber, activeFilter === 'progress' && styles.statNumberActive, { color: STATUS_COLORS.progress }]}>{stats.progress}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statChip, activeFilter === 'completed' && styles.statChipActive]}
          onPress={() => applyFilter('completed')}
        >
          <Text style={[styles.statLabel, activeFilter === 'completed' && styles.statLabelActive]}>Done</Text>
          <Text style={[styles.statNumber, activeFilter === 'completed' && styles.statNumberActive, { color: STATUS_COLORS.completed }]}>{stats.completed}</Text>
        </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Task List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 80 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <FontAwesome6 name="clipboard-check" size={32} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No tasks</Text>
            <Text style={styles.emptySubtitle}>Tasks from orders will appear here</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredTasks.map((task, index) => (
              <TaskRow
                key={task.id}
                task={task}
                colors={colors}
                spacing={spacing}
                radius={radius}
                typography={typography}
                onAction={handleTaskAction}
                isLast={index === filteredTasks.length - 1}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TaskRow({
  task,
  colors,
  spacing,
  radius,
  typography,
  onAction,
  isLast,
}: {
  task: TaskRecord;
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
  onAction: (id: string, status: TaskStatus) => void;
  isLast: boolean;
}) {
  const statusColor = STATUS_COLORS[task.status];
  const priorityInfo = PRIORITY_LABELS[task.priority] || PRIORITY_LABELS[0];
  const taskCategory = TASK_CATEGORIES[task.type];

  const formatDue = (timestamp?: number) => {
    if (!timestamp) return null;
    const now = new Date();
    const diffMs = timestamp - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMs < 0) return 'Overdue';
    if (diffHours < 1) return 'Soon';
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  const dueText = formatDue(task.due);
  const isOverdue = task.due && task.due < Date.now() && task.status === 'pending';
  const isActionable = task.status !== 'completed' && task.status !== 'cancelled';

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
      {/* Status indicator / Action button */}
      <TouchableOpacity
        onPress={() => {
          if (task.status === 'pending') onAction(task.id, 'progress');
          else if (task.status === 'progress') onAction(task.id, 'completed');
        }}
        disabled={!isActionable}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: statusColor,
          backgroundColor: task.status === 'completed' ? statusColor : 'transparent',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {task.status === 'completed' && (
          <FontAwesome6 name="check" size={12} color="#FFFFFF" />
        )}
        {task.status === 'progress' && (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }} />
        )}
      </TouchableOpacity>

      {/* Content */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '500',
            color: task.status === 'completed' ? colors.textTertiary : colors.textPrimary,
            textDecorationLine: task.status === 'completed' ? 'line-through' : 'none',
          }}
          numberOfLines={1}
        >
          {task.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontSize: 13, fontWeight: '400', color: colors.textTertiary }}>
            {taskCategory?.icon} {task.type}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '400', color: colors.textTertiary }}>
            · {task.personid.replace('person_', '').replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      {/* Right side: priority & due */}
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {task.priority > 0 && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: priorityInfo.color,
            }}
          />
        )}
        {dueText && (
        <Text
        style={{
        fontSize: 12,
        color: isOverdue ? '#ef4444' : colors.textTertiary,
        fontWeight: isOverdue ? '600' : '400',
        }}
        >
        {dueText}
        </Text>
        )}
      </View>

      {/* Cancel action for active tasks */}
      {isActionable && (
        <TouchableOpacity
          onPress={() => onAction(task.id, 'cancelled')}
          style={{ padding: spacing.xs }}
        >
          <FontAwesome6 name="xmark" size={14} color={colors.textTertiary} />
        </TouchableOpacity>
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
    statsContainer: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    statChip: {
      height: 36,
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    statChipActive: {
      backgroundColor: colors.accentSubtle,
      borderColor: colors.accent,
    },
    statNumber: {
      ...typography.caption,
      color: colors.textTertiary,
      fontWeight: '600',
    },
    statNumberActive: {
      color: colors.accent,
    },
    statLabel: {
      ...typography.caption,
      color: colors.textPrimary,
    },
    statLabelActive: {
      color: colors.accent,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: spacing.lg,
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
    listContainer: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
