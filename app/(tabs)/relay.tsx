import { FontAwesome6 } from '@expo/vector-icons';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useBlueskyAuth } from '@/contexts/BlueskyAuthContext';
import { getConversations, searchUsers } from '@/services/blueskyService';
import type { BlueskyConversation } from '@/services/blueskyService';

export default function DMsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const { isAuthenticated, agent, handle, logout } = useBlueskyAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<BlueskyConversation[]>([]);
  const [searchResults, setSearchResults] = useState<BlueskyConversation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && agent) {
        loadConversations();
      } else if (!isAuthenticated) {
        router.replace('/bluesky-login');
      }
    }, [isAuthenticated, agent])
  );

  const loadConversations = async () => {
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
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
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
    setIsSearching(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/bluesky-login');
  };

  const handleSelectConversation = (conversation: BlueskyConversation) => {
    // Navigate to conversation detail screen
    router.push({
      pathname: '/bluesky-dm-detail',
      params: { convoId: conversation.id, did: conversation.did, handle: conversation.handle },
    });
  };

  const styles = createStyles(colors, spacing, radius, typography);
  const displayList = searchQuery.trim().length > 0 ? searchResults : conversations;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      {/* Header with logout */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Relay</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View
          style={[
            styles.searchBar,
            isFocused && styles.searchBarFocused,
          ]}
        >
          <FontAwesome6 name="magnifying-glass" size={16} color={colors.textTertiary} />
          <TextInput
            placeholder="Search users..."
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
              <FontAwesome6 name="xmark" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {isLoading && displayList.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.emptyTitle, { marginTop: spacing.md }]}>Loading conversations...</Text>
        </View>
      ) : displayList.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <FontAwesome6 name="square" size={40} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery.trim().length > 0 ? 'No users found' : 'Relay'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery.trim().length > 0
              ? 'Try searching for a different handle'
              : 'Search for users to send messages on Bluesky'}
          </Text>
          {!searchQuery && (
            <View style={[styles.infoBox, { marginTop: spacing.lg }]}>
              <FontAwesome6 name="circle-info" size={16} color={colors.accent} style={{ marginRight: spacing.sm }} />
              <Text style={styles.infoText}>
                Note: Bluesky DMs require both users to have DM features enabled on Bluesky. Try searching for a Bluesky handle to start a conversation.
              </Text>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              colors={colors}
              spacing={spacing}
              radius={radius}
              typography={typography}
              onPress={() => handleSelectConversation(item)}
            />
          )}
          scrollEnabled={false}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: 80 + insets.bottom }]}
        />
      )}
    </View>
  );
}

function ConversationRow({
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
  const initials = conversation.displayName
    ? conversation.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : conversation.handle.slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        {/* Avatar */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
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
            fontWeight: '600',
            color: colors.textPrimary,
          }}
          numberOfLines={1}
        >
          {conversation.displayName || conversation.handle}
        </Text>
        {conversation.lastMessage && (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '400',
              color: colors.textSecondary,
            }}
            numberOfLines={1}
          >
            {conversation.lastMessage}
          </Text>
        )}
        {!conversation.lastMessage && (
          <Text
            style={{
              fontSize: 13,
              fontWeight: '400',
              color: colors.textTertiary,
            }}
          >
            @{conversation.handle}
          </Text>
        )}
        </View>

        {/* Unread indicator */}
        {conversation.unreadCount && conversation.unreadCount > 0 && (
          <View
            style={{
              backgroundColor: colors.error,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ ...typography.caption, color: '#FFFFFF', fontWeight: '600' }}>
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: any, spacing: any, radius: any, typography: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      ...typography.largeTitle,
      color: colors.textPrimary,
    },
    logoutButton: {
      padding: spacing.sm,
    },
    logoutText: {
      ...typography.caption,
      color: colors.error,
      fontWeight: '600',
    },
    searchWrapper: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      height: 40,
      gap: spacing.sm,
    },
    searchBarFocused: {
      borderColor: colors.accent,
      borderWidth: 2,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      padding: 0,
    },
    clearButton: {
      padding: spacing.sm,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    contentContainer: {},
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxl * 2,
      paddingHorizontal: spacing.lg,
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
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.accentSubtle,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.accent + '30',
    },
    infoText: {
      flex: 1,
      ...typography.caption,
      color: colors.textPrimary,
    },
  });
