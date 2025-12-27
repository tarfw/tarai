import { Tabs, useFocusEffect } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useCallback } from 'react';
import { getTaskStats } from '@/services/taskService';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [pendingTaskCount, setPendingTaskCount] = useState(0);

  // Refresh pending task count
  useFocusEffect(
    useCallback(() => {
      const loadTaskCount = async () => {
        try {
          const stats = await getTaskStats();
          setPendingTaskCount(stats.pending + stats.progress);
        } catch (e) {
          console.error('Failed to load task count', e);
        }
      };
      loadTaskCount();
      const interval = setInterval(loadTaskCount, 5000);
      return () => clearInterval(interval);
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarShowLabel: true,
        tabBarButton: (props) => (
          <Pressable
            {...props}
            android_ripple={{ color: colors.accentSubtle, borderless: true, radius: 28 }}
            style={({ pressed }) => [props.style, { opacity: pressed ? 0.7 : 1 }]}
          />
        ),
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: colors.background,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
      name="tasks"
      options={{
      title: 'tasks',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconContainer}>
              <FontAwesome6 name="square-check" size={22} color={focused ? colors.accent : color} />
              {pendingTaskCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>{pendingTaskCount > 99 ? '99+' : pendingTaskCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
      name="nodes"
      options={{
      title: 'agents',
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome6 name="cube" size={22} color={focused ? colors.accent : color} />
          ),
        }}
      />
      <Tabs.Screen
      name="people"
      options={{
      title: 'relays',
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome6 name="circle-user" size={22} color={focused ? colors.accent : color} />
          ),
        }}
      />
      {/* Hidden tabs */}
      <Tabs.Screen name="marketplace" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
