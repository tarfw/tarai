import { FontAwesome6 } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useBlueskyAuth } from '@/contexts/BlueskyAuthContext';
import { router } from 'expo-router';

interface IntegrationItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  isConnected: boolean;
  connectedInfo?: string;
  onPress: () => void;
}

export default function IntegrationsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isConnected: blueskyConnected, handle: blueskyHandle, disconnect: blueskyDisconnect } = useBlueskyAuth();

  const handleBlueskyPress = () => {
    if (blueskyConnected) {
      // Show disconnect confirmation
      Alert.alert(
        'Disconnect Bluesky',
        `Are you sure you want to disconnect @${blueskyHandle}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              await blueskyDisconnect();
            },
          },
        ]
      );
    } else {
      router.push('/bluesky-login');
    }
  };

  const integrations: IntegrationItem[] = [
    {
      id: 'bluesky',
      title: 'Bluesky',
      description: blueskyConnected
        ? 'Connected and syncing your social identity'
        : 'Connect your social identity and messaging',
      icon: 'butterfly',
      color: '#0085ff',
      isConnected: blueskyConnected,
      connectedInfo: blueskyHandle ? `@${blueskyHandle}` : undefined,
      onPress: handleBlueskyPress,
    },
    // Add more integrations here as they are implemented
  ];

  const renderIntegrationItem = ({ item }: { item: IntegrationItem }) => (
    <IntegrationCard
      item={item}
      colors={colors}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Integrations</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Connect your accounts and services
        </Text>
      </View>

      {/* Integrations List */}
      <View style={styles.listWrapper}>
        <FlatList
          data={integrations}
          keyExtractor={(item) => item.id}
          renderItem={renderIntegrationItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
                <FontAwesome6 name="plug" size={40} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No integrations yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Connect your accounts to get started
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

function IntegrationCard({
  item,
  colors,
}: {
  item: IntegrationItem;
  colors: any;
}) {
  const handlePress = () => {
    if (item.onPress) {
      item.onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.integrationCard,
        {
          backgroundColor: colors.surface,
          borderColor: item.isConnected ? item.color : colors.border,
          borderWidth: item.isConnected ? 2 : 1,
        }
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.integrationContent}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
          <FontAwesome6 name={item.icon} size={24} color={item.color} />
          {item.isConnected && (
            <View style={[styles.connectedBadge, { backgroundColor: '#10B981' }]}>
              <FontAwesome6 name="check" size={8} color="#FFFFFF" />
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.details}>
          <View style={styles.titleRow}>
            <Text style={[styles.integrationTitle, { color: colors.textPrimary }]}>
              {item.title}
            </Text>
            {item.isConnected && (
              <View style={[styles.statusBadge, { backgroundColor: '#10B98120' }]}>
                <Text style={[styles.statusText, { color: '#10B981' }]}>Connected</Text>
              </View>
            )}
          </View>
          <Text style={[styles.integrationDescription, { color: colors.textSecondary }]}>
            {item.description}
          </Text>
          {item.isConnected && item.connectedInfo && (
            <Text style={[styles.connectedInfo, { color: item.color }]}>
              {item.connectedInfo}
            </Text>
          )}
        </View>

        {/* Action Arrow */}
        <FontAwesome6
          name={item.isConnected ? "gear" : "chevron-right"}
          size={16}
          color={colors.textTertiary}
        />
      </View>
    </TouchableOpacity>
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
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  integrationCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  integrationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  details: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  integrationTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  integrationDescription: {
    fontSize: 13,
    fontWeight: '400',
  },
  connectedInfo: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  connectedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    paddingBottom: 80,
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
});