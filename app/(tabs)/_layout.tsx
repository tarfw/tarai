import { Tabs } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useTheme } from "@/contexts/ThemeContext";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

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
        name="listings"
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
});
