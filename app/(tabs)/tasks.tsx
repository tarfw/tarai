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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getAllTasks, searchTasks, getTaskStats, updateTaskStatus } from '@/services/taskService';
import { TASK_CATEGORIES } from '@/services/vectorStores/memoryVectorStore';
import type { TaskRecord, TaskStatus } from '@/types/memory';

const STATUS_CONFIG: Record<TaskStatus, { color: string; icon: string }> = {
  pending: { color: '#f59e0b', icon: 'clock' },
  progress: { color: '#3b82f6', icon: 'spinner' },
  completed: { color: '#22c55e', icon: 'circle-check' },
  cancelled: { color: '#ef4444', icon: 'circle-xmark' },
};

const PRIORITY_COLORS: Record<number, string> = {
  0: '#64748b',
  1: '#f59e0b',
  2: '#ef4444',
};

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskRecord[]>([]);
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
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.trim().length === 0) {
      applyFilter(activeFilter, tasks);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Tasks</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: isFocused ? colors.accent : colors.border }]}>
          <FontAwesome6 name="magnifying-glass" size={16} color={colors.textTertiary} />
          <TextInput
            placeholder="Search tasks..."
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

      {/* Filter Tabs */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', gap: 24 }}>
        <TouchableOpacity onPress={() => applyFilter('all')}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: activeFilter === 'all' ? '600' : '400',
              color: activeFilter === 'all' ? colors.accent : colors.textSecondary,
              borderBottomWidth: activeFilter === 'all' ? 2 : 0,
              borderBottomColor: colors.accent,
              paddingBottom: 4,
            }}
          >
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => applyFilter('pending')}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: activeFilter === 'pending' ? '600' : '400',
              color: activeFilter === 'pending' ? colors.accent : colors.textSecondary,
              borderBottomWidth: activeFilter === 'pending' ? 2 : 0,
              borderBottomColor: colors.accent,
              paddingBottom: 4,
            }}
          >
            Pending
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => applyFilter('progress')}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: activeFilter === 'progress' ? '600' : '400',
              color: activeFilter === 'progress' ? colors.accent : colors.textSecondary,
              borderBottomWidth: activeFilter === 'progress' ? 2 : 0,
              borderBottomColor: colors.accent,
              paddingBottom: 4,
            }}
          >
            In progress
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => applyFilter('completed')}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: activeFilter === 'completed' ? '600' : '400',
              color: activeFilter === 'completed' ? colors.accent : colors.textSecondary,
              borderBottomWidth: activeFilter === 'completed' ? 2 : 0,
              borderBottomColor: colors.accent,
              paddingBottom: 4,
            }}
          >
            Done
          </Text>
        </TouchableOpacity>
      </View>

      {/* Task List */}
      <View style={styles.listWrapper}>
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
              <FontAwesome6 name="clipboard-list" size={40} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No tasks found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {activeFilter === 'all' ? 'Tasks from orders will appear here' : `No ${activeFilter} tasks`}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredTasks}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TaskRow
                task={item}
                colors={colors}
                onAction={handleTaskAction}
              />
            )}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

function TaskRow({
  task,
  colors,
  onAction,
}: {
  task: TaskRecord;
  colors: any;
  onAction: (id: string, status: TaskStatus) => void;
}) {
  const statusConfig = STATUS_CONFIG[task.status];
  const taskCategory = TASK_CATEGORIES[task.type];
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS[0];

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
    <View style={[styles.taskRow, { borderBottomColor: colors.border }]}>
      {/* Status Button */}
      <TouchableOpacity
        onPress={() => {
          if (task.status === 'pending') onAction(task.id, 'progress');
          else if (task.status === 'progress') onAction(task.id, 'completed');
        }}
        disabled={!isActionable}
        style={[
          styles.statusButton,
          { borderColor: statusConfig.color, backgroundColor: task.status === 'completed' ? statusConfig.color : 'transparent' }
        ]}
      >
        {task.status === 'completed' && (
          <FontAwesome6 name="check" size={14} color="#FFFFFF" />
        )}
        {task.status === 'progress' && (
          <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
        )}
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.taskContent}>
        <Text
          style={[
            styles.taskTitle,
            { color: task.status === 'completed' ? colors.textTertiary : colors.textPrimary },
            task.status === 'completed' && styles.taskTitleCompleted
          ]}
          numberOfLines={1}
        >
          {task.title}
        </Text>
        <View style={styles.taskMeta}>
          <Text style={[styles.taskMetaText, { color: colors.textTertiary }]}>
            {taskCategory?.icon || '📋'} {task.type}
          </Text>
          <Text style={[styles.taskMetaText, { color: colors.textTertiary }]}>•</Text>
          <Text style={[styles.taskMetaText, { color: colors.textTertiary }]} numberOfLines={1}>
            {task.personid.replace('person_', '').replace(/_/g, ' ')}
          </Text>
        </View>
      </View>

      {/* Right Side */}
      <View style={styles.taskRight}>
        {task.priority > 0 && (
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
        )}
        {dueText && (
          <Text
            style={[
              styles.dueText,
              { color: isOverdue ? '#ef4444' : colors.textTertiary },
              isOverdue && styles.dueTextOverdue
            ]}
          >
            {dueText}
          </Text>
        )}
      </View>

      {/* Cancel Button */}
      {isActionable && (
        <TouchableOpacity
          onPress={() => onAction(task.id, 'cancelled')}
          style={styles.cancelButton}
        >
          <FontAwesome6 name="xmark" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
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
  listContent: {
    paddingHorizontal: 20,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  statusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  taskContent: {
    flex: 1,
    gap: 4,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  taskMetaText: {
    fontSize: 13,
  },
  taskRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dueText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dueTextOverdue: {
    fontWeight: '600',
  },
  cancelButton: {
    padding: 8,
  },
});
