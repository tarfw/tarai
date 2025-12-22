import { Tabs, useFocusEffect } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";
import { View, StyleSheet, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useCallback } from "react";
import { cartService } from "@/services/cartService";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [cartCount, setCartCount] = useState(0);

  // Refresh cart count when any tab gains focus
  useFocusEffect(
    useCallback(() => {
      const loadCartCount = async () => {
        try {
          const count = await cartService.getCartCount();
          setCartCount(count);
        } catch (e) {
          console.error("Failed to load cart count", e);
        }
      };
      loadCartCount();
      // Set up interval to refresh cart count
      const interval = setInterval(loadCartCount, 2000);
      return () => clearInterval(interval);
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarShowLabel: false,
        tabBarButton: (props) => (
          <Pressable
            {...props}
            android_ripple={{ color: colors.accentSubtle, borderless: true, radius: 28 }}
            style={({ pressed }) => [
              props.style,
              { opacity: pressed ? 0.7 : 1 }
            ]}
          />
        ),
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isDark ? "rgba(20, 20, 21, 0.85)" : "rgba(255, 255, 255, 0.85)",
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={80}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "500",
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="marketplace"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentSubtle }] : undefined}>
              <FontAwesome6
                name="compass"
                size={20}
                color={focused ? colors.accent : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentSubtle }] : undefined}>
              <FontAwesome6
                name="wand-magic-sparkles"
                size={20}
                color={focused ? colors.accent : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentSubtle }] : undefined}>
              <FontAwesome6
                name="message"
                size={20}
                color={focused ? colors.accent : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentSubtle }] : undefined}>
              <FontAwesome6
                name="cart-shopping"
                size={20}
                color={focused ? colors.accent : color}
              />
              {cartCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>
                    {cartCount > 99 ? "99+" : cartCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="nodes"
        options={{
          title: "My Items",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentSubtle }] : undefined}>
              <FontAwesome6
                name="cube"
                size={20}
                color={focused ? colors.accent : color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconContainer: {
    borderRadius: 8,
    padding: 6,
    marginTop: -6,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});
