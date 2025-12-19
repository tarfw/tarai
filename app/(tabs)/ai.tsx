import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, typography, spacing, radius } from "@/constants/theme";

const QUICK_ACTIONS = [
  { icon: "magnifying-glass", label: "Find services", prompt: "Help me find..." },
  { icon: "calendar", label: "Book appointment", prompt: "I want to book..." },
  { icon: "truck-fast", label: "Order delivery", prompt: "I need delivery of..." },
  { icon: "circle-question", label: "Get help", prompt: "I have a question about..." },
];

const SUGGESTIONS = [
  "Find a plumber near me",
  "Book a taxi for tomorrow",
  "Order biryani for dinner",
  "Compare AC repair services",
];

export default function AI() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Assistant</Text>
        <TouchableOpacity style={styles.headerButton}>
          <FontAwesome6 name="clock-rotate-left" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: 180 + insets.bottom }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[colors.accentSubtle, "transparent"]}
            style={styles.heroGradient}
          >
            <View style={styles.heroIconContainer}>
              <LinearGradient
                colors={[colors.accent, colors.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroIconGradient}
              >
                <FontAwesome6 name="wand-magic-sparkles" size={32} color={colors.textPrimary} />
              </LinearGradient>
            </View>
            <Text style={styles.heroTitle}>How can I help you?</Text>
            <Text style={styles.heroSubtitle}>
              Ask me anything about services, bookings, or products
            </Text>
          </LinearGradient>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionCard}
                onPress={() => setMessage(action.prompt)}
              >
                <View style={styles.quickActionIcon}>
                  <FontAwesome6 name={action.icon as any} size={18} color={colors.accent} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Suggestions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Try asking</Text>
          <View style={styles.suggestionsContainer}>
            {SUGGESTIONS.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => setMessage(suggestion)}
              >
                <FontAwesome6 name="arrow-turn-up" size={12} color={colors.textTertiary} style={{ transform: [{ rotate: '90deg' }] }} />
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.inputWrapper, { paddingBottom: insets.bottom + 75 }]}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask anything..."
            placeholderTextColor={colors.textTertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, message.trim() && styles.sendButtonActive]}
            disabled={!message.trim()}
          >
            <FontAwesome6
              name="arrow-up"
              size={16}
              color={message.trim() ? colors.textPrimary : colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.inputHint}>
          AI can help you find, book, and order services
        </Text>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
  },
  heroSection: {
    marginBottom: spacing.xl,
  },
  heroGradient: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
  },
  heroIconContainer: {
    marginBottom: spacing.lg,
  },
  heroIconGradient: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: {
    ...typography.largeTitle,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  quickActionCard: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionLabel: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  suggestionsContainer: {
    gap: spacing.sm,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  inputWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    maxHeight: 100,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonActive: {
    backgroundColor: colors.accent,
  },
  inputHint: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
