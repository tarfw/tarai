import { FontAwesome6 } from '@expo/vector-icons';
import { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useBlueskyAuth } from '@/contexts/BlueskyAuthContext';
import { getConversations, searchUsers, setupConversationPolling } from '@/services/blueskyService';
import type { BlueskyConversation } from '@/services/blueskyService';

export default function DMsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const { isAuthenticated, agent, logout } = useBlueskyAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<BlueskyConversation[]>([]);
  const [searchResults, setSearchResults] = useState<BlueskyConversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPollingRef = useRef<(() => void) | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && agent) {
        loadConversationsAndStartPolling();
      } else if (!isAuthenticated) {
        router.replace('/bluesky-login');
      }
      return () => {
        if (stopPollingRef.current) {
          stopPollingRef.current();
          stopPollingRef.current = null;
        }
      };
    }, [isAuthenticated, agent])
  );

  const loadConversationsAndStartPolling = async () => {
    if (!agent) return;
    try {
      setIsLoading(true);
      const convos = await getConversations(agent);
      setConversations(convos);
    } catch (e) {
      console.error('Failed to load conversations', e);
    } finally {
      setIsLoading(false);
    }

    if (stopPollingRef.current) {
      stopPollingRef.current();
    }
    stopPollingRef.current = setupConversationPolling(
      agent,
      (updatedConversations) => {
        setConversations(updatedConversations);
      },
      2000
    );
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (agent) {
        try {
          const results = await searchUsers(agent, query, 20);
          setSearchResults(results);
        } catch (e) {
          console.error('Search failed', e);
          setSearchResults([]);
        }
      }
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/bluesky-login');
  };

  const handleSelectConversation = (conversation: BlueskyConversation) => {
    router.push({
      pathname: '/bluesky-dm-detail',
      params: { convoId: conversation.id, did: conversation.did, handle: conversation.handle },
    });
  };

  const displayList = searchQuery.trim().length > 0 ? searchResults : conversations;

  return (
    <View style={[staticStyles.container, { paddingTop: insets.top + spacing.md, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[staticStyles.header, { borderBottomColor: colors.border }]}>
        <Text style={[staticStyles.headerTitle, { color: colors.textPrimary }]}>Relay</Text>
        <TouchableOpacity style={staticStyles.logoutButton} onPress={handleLogout}>
          <Text style={[staticStyles.logoutText, { color: colors.error }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[staticStyles.searchWrapper, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
        <View style={[staticStyles.searchBar, isFocused && staticStyles.searchBarFocused, { backgroundColor: colors.surface, borderColor: isFocused ? colors.accent : colors.border }]}>
          <FontAwesome6 name="magnifying-glass" size={16} color={colors.textTertiary} />
          <TextInput
            style={[staticStyles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search users..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            selectionColor={colors.accent}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity style={staticStyles.clearButton} onPress={handleClearSearch}>
              <FontAwesome6 name="xmark" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content Area */}
      {isLoading && displayList.length === 0 ? (
        <LoadingState colors={colors} spacing={spacing} />
      ) : displayList.length === 0 ? (
        <EmptyState
          searchQuery={searchQuery}
          colors={colors}
          spacing={spacing}
          radius={radius}
          typography={typography}
        />
      ) : (
        <ConversationList
          conversations={displayList}
          colors={colors}
          spacing={spacing}
          radius={radius}
          typography={typography}
          onSelectConversation={handleSelectConversation}
          insets={insets}
        />
      )}
    </View>
  );
}

// Loading State Component
function LoadingState({
  colors,
  spacing,
}: {
  colors: any;
  spacing: any;
}) {
  return (
    <View style={[staticStyles.contentArea, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[staticStyles.loadingText, { marginTop: spacing.md, color: colors.textPrimary }]}>
        Loading conversations...
      </Text>
    </View>
  );
}

// Empty State Component
function EmptyState({
  searchQuery,
  colors,
  spacing,
  radius,
  typography,
}: {
  searchQuery: string;
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
}) {
  const isSearching = searchQuery.trim().length > 0;

  return (
    <View style={staticStyles.contentArea}>
      <View style={[staticStyles.emptyContainer, { paddingHorizontal: spacing.lg }]}>
        <View style={[staticStyles.emptyIconBox, { backgroundColor: colors.surface }]}>
          <FontAwesome6 name="square" size={40} color={colors.accent} />
        </View>

        <Text style={[staticStyles.emptyTitle, { color: colors.textPrimary }]}>
          {isSearching ? 'No users found' : 'Relay'}
        </Text>

        <Text style={[staticStyles.emptySubtitle, { color: colors.textSecondary }]}>
          {isSearching
            ? 'Try searching for a different handle'
            : 'Search for users to send messages on Bluesky'}
        </Text>

        {!isSearching && (
          <View style={[staticStyles.infoBox, { borderColor: colors.accent + '30', backgroundColor: colors.accentSubtle }]}>
            <FontAwesome6 name="circle-info" size={16} color={colors.accent} />
            <Text style={[staticStyles.infoText, { color: colors.textPrimary, marginLeft: spacing.md }]}>
              Bluesky DMs require both users to have DM features enabled.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// Conversation List Component
function ConversationList({
  conversations,
  colors,
  spacing,
  radius,
  typography,
  onSelectConversation,
  insets,
}: {
  conversations: BlueskyConversation[];
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
  onSelectConversation: (conversation: BlueskyConversation) => void;
  insets: any;
}) {
  return (
    <FlatList
      data={conversations}
      keyExtractor={(item, index) => item.id || item.did || `conversation-${index}`}
      renderItem={({ item }) => (
        <ConversationItem
          conversation={item}
          colors={colors}
          spacing={spacing}
          radius={radius}
          typography={typography}
          onPress={() => onSelectConversation(item)}
        />
      )}
      scrollEnabled={true}
      contentContainerStyle={[staticStyles.listContent, { paddingBottom: insets.bottom + spacing.lg }]}
    />
  );
}

// Individual Conversation Item
function ConversationItem({
  conversation,
  colors,
  spacing,
  radius,
  typography,
  onPress,
}: {
  conversation: BlueskyConversation;
  colors: any;
  spacing: any;
  radius: any;
  typography: any;
  onPress: () => void;
}) {
  const initials = getInitials(conversation);
  const displayName = conversation.displayName || conversation.handle || '';
  const subtitle = conversation.lastMessage || `@${conversation.handle || ''}`;
  const subtitleColor = conversation.lastMessage ? colors.textSecondary : colors.textTertiary;
  const unreadBadgeText = conversation.unreadCount && conversation.unreadCount > 99 ? '99+' : `${conversation.unreadCount || 0}`;

  return (
    <TouchableOpacity
      style={[staticStyles.conversationItem, { borderBottomColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={staticStyles.conversationRow}>
        {/* Avatar */}
        <View style={[staticStyles.avatar, { backgroundColor: colors.accentSubtle }]}>
          <Text style={[staticStyles.avatarText, { color: colors.accent }]}>
            {initials}
          </Text>
        </View>

        {/* Content */}
        <View style={staticStyles.conversationContent}>
          <Text style={[staticStyles.conversationName, { color: colors.textPrimary }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[staticStyles.conversationSubtitle, { color: subtitleColor }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        {/* Unread Badge */}
        {conversation.unreadCount && conversation.unreadCount > 0 ? (
          <View style={[staticStyles.badge, { backgroundColor: colors.error }]}>
            <Text style={staticStyles.badgeText}>
              {unreadBadgeText}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// Helper function to get initials
function getInitials(conversation: BlueskyConversation): string {
  if (conversation.displayName) {
    return conversation.displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return (conversation.handle || 'U').slice(0, 2).toUpperCase();
}

// Styles
const staticStyles = StyleSheet.create({
  listContent: {},
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  logoutButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e74c3c',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchBarFocused: {
    borderColor: '#0085ff',
    borderWidth: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  contentArea: {
    flex: 1,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    maxWidth: 300,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
  },
  conversationItem: {
    borderBottomWidth: 1,
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  conversationContent: {
    flex: 1,
    gap: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
  },
  conversationSubtitle: {
    fontSize: 13,
    fontWeight: '400',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
