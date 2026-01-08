import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { COMMERCE_CATEGORIES } from "@/services/vectorStores/memoryVectorStore";
import { memoryService } from "@/services/memoryService";
import type { MemoryType, MemoryStatus } from "@/types/memory";

type FormData = {
  title: string;
  description: string;
  value: string;
  type: MemoryType;
  tags: string;
  location: string;
  quantity: string;
  status: MemoryStatus;
};

const INITIAL_FORM: FormData = {
  title: "",
  description: "",
  value: "",
  type: "product",
  tags: "",
  location: "",
  quantity: "1",
  status: "active",
};

export default function AddMemory() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const params = useLocalSearchParams<{ id?: string; mode?: string }>();
  const isEditing = params.mode === "edit" && params.id;

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const styles = createStyles(colors, spacing, radius, typography);
  const { height: screenHeight } = Dimensions.get("window");

  // Bottom sheet animation
  const translateY = useSharedValue(screenHeight);
  const backdropOpacity = useSharedValue(0);

  const openSheet = () => {
    setShowTypeSelector(true);
    backdropOpacity.value = withTiming(1, { duration: 200 });
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
  };

  const closeSheet = () => {
    backdropOpacity.value = withTiming(0, { duration: 150 });
    translateY.value = withSpring(screenHeight, { damping: 20, stiffness: 200 }, () => {
      runOnJS(setShowTypeSelector)(false);
    });
  };

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Load existing memory data when editing
  useEffect(() => {
    if (isEditing && params.id) {
      loadMemory(params.id);
    }
  }, [isEditing, params.id]);

  const loadMemory = async (id: string) => {
    setIsLoading(true);
    try {
      const memory = await memoryService.getMemoryById(id);
      if (memory) {
        // Parse data JSON field
        let parsedData: { desc?: string; tags?: string } = {};
        try {
          if (memory.data) parsedData = JSON.parse(memory.data);
        } catch (e) {}

        setForm({
          title: memory.title || "",
          description: parsedData.desc || "",
          value: memory.value?.toString() || "",
          type: (memory.type as MemoryType) || "product",
          tags: parsedData.tags || "",
          location: memory.location || "",
          quantity: memory.quantity?.toString() || "1",
          status: (memory.status as MemoryStatus) || "active",
        });
      }
    } catch (error) {
      console.error("Failed to load memory:", error);
      Alert.alert("Error", "Failed to load memory data.");
    } finally {
      setIsLoading(false);
    }
  };

  const categoryColors: Record<string, string> = {
    transport: colors.blue,
    food: colors.orange,
    service: colors.green,
    booking: colors.purple,
    product: colors.teal,
    education: colors.pink,
    event: colors.warning,
    rental: colors.accent,
    digital: colors.success,
    subscription: colors.error,
    healthcare: '#ec4899',
    realestate: '#8b5cf6',
    order: colors.blue,
    variant: colors.textTertiary,
    inventory: colors.textTertiary,
    store: colors.textTertiary,
    cart: colors.textTertiary,
    search: colors.textTertiary,
  };

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!form.title.trim()) {
      newErrors.title = "Title is required";
    } else if (form.title.length < 3) {
      newErrors.title = "Title must be at least 3 characters";
    }

    if (form.value.trim() && (isNaN(Number(form.value)) || Number(form.value) < 0)) {
      newErrors.value = "Enter a valid value";
    }

    if (form.quantity.trim() && (isNaN(Number(form.quantity)) || Number(form.quantity) < 0)) {
      newErrors.quantity = "Enter a valid quantity";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Build data JSON field
      const dataJson = JSON.stringify({
        desc: form.description.trim(),
        tags: form.tags.trim(),
      });

      if (isEditing && params.id) {
        await memoryService.updateMemory(params.id, {
          title: form.title.trim(),
          type: form.type,
          data: dataJson,
          value: Number(form.value) || 0,
          quantity: Number(form.quantity) || 1,
          location: form.location.trim(),
          status: form.status,
        });
      } else {
        await memoryService.createMemory({
          title: form.title.trim(),
          type: form.type,
          data: dataJson,
          value: Number(form.value) || 0,
          quantity: Number(form.quantity) || 1,
          location: form.location.trim(),
          status: form.status,
        });
      }
      router.back();
    } catch (error) {
      console.error("Failed to save memory:", error);
      Alert.alert("Error", "Failed to save memory. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Memory",
      "Are you sure you want to delete this memory? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (params.id) {
              try {
                await memoryService.deleteMemory(params.id);
                router.back();
              } catch (error) {
                Alert.alert("Error", "Failed to delete memory.");
              }
            }
          },
        },
      ]
    );
  };

  const selectedType = COMMERCE_CATEGORIES[form.type];
  const typeColor = categoryColors[form.type] || colors.accent;

  // Status options
  const STATUS_OPTIONS: { value: MemoryStatus; label: string; color: string }[] = [
    { value: "active", label: "Active", color: "#22c55e" },
    { value: "pending", label: "Pending", color: "#f59e0b" },
    { value: "completed", label: "Completed", color: "#3b82f6" },
    { value: "cancelled", label: "Cancelled", color: "#ef4444" },
  ];

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome6 name="xmark" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? "Edit Item" : "New Item"}</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || isLoading}
          style={[styles.saveButton, (isSubmitting || isLoading) && styles.saveButtonDisabled]}
        >
          <Text style={[styles.saveButtonText, (isSubmitting || isLoading) && styles.saveButtonTextDisabled]}>
            {isSubmitting ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Type</Text>
            <TouchableOpacity
              style={[styles.typeSelector, { borderColor: `${typeColor}50` }]}
              onPress={openSheet}
              activeOpacity={0.7}
            >
              <View style={[styles.typeIconContainer, { backgroundColor: `${typeColor}20` }]}>
                <Text style={styles.typeIcon}>{selectedType?.icon || "📦"}</Text>
              </View>
              <View style={styles.typeSelectorContent}>
                <Text style={styles.typeSelectorLabel}>{selectedType?.label || "Product"}</Text>
                <Text style={styles.typeSelectorHint}>Tap to change</Text>
              </View>
              <FontAwesome6
                name="chevron-down"
                size={14}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Title</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="What are you selling?"
              placeholderTextColor={colors.textTertiary}
              value={form.title}
              onChangeText={(v) => updateField("title", v)}
              maxLength={100}
            />
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.description && styles.inputError]}
              placeholder="Describe your item, service, or offering..."
              placeholderTextColor={colors.textTertiary}
              value={form.description}
              onChangeText={(v) => updateField("description", v)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={1000}
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            <Text style={styles.charCount}>{form.description.length}/1000</Text>
          </View>

          {/* Value & Quantity Row */}
          <View style={[styles.section, { flexDirection: "row", gap: spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Value (₹)</Text>
              <View style={[styles.priceContainer, errors.value && styles.inputError]}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  value={form.value}
                  onChangeText={(v) => updateField("value", v.replace(/[^0-9.]/g, ""))}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              {errors.value && <Text style={styles.errorText}>{errors.value}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Quantity</Text>
              <TextInput
                style={[styles.input, errors.quantity && styles.inputError]}
                placeholder="1"
                placeholderTextColor={colors.textTertiary}
                value={form.quantity}
                onChangeText={(v) => updateField("quantity", v.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                maxLength={6}
              />
              {errors.quantity && <Text style={styles.errorText}>{errors.quantity}</Text>}
            </View>
          </View>

          {/* Status */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Status</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = form.status === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.statusChip,
                      { borderColor: isSelected ? opt.color : colors.border },
                      isSelected && { backgroundColor: `${opt.color}15` },
                    ]}
                    onPress={() => setForm((prev) => ({ ...prev, status: opt.value }))}
                  >
                    <View style={[styles.statusDot, { backgroundColor: opt.color }]} />
                    <Text style={[styles.statusLabel, isSelected && { color: opt.color }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tags</Text>
            <TextInput
              style={styles.input}
              placeholder="Comma-separated tags for better discovery"
              placeholderTextColor={colors.textTertiary}
              value={form.tags}
              onChangeText={(v) => updateField("tags", v)}
              maxLength={200}
            />
            <Text style={styles.hint}>e.g., fast delivery, quality, local</Text>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Location</Text>
            <View style={styles.locationContainer}>
              <FontAwesome6 name="location-dot" size={16} color={colors.textTertiary} />
              <TextInput
                style={styles.locationInput}
                placeholder="Where is this available?"
                placeholderTextColor={colors.textTertiary}
                value={form.location}
                onChangeText={(v) => updateField("location", v)}
                maxLength={100}
              />
            </View>
          </View>

          {/* Delete Button (Edit mode only) */}
          {isEditing && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <FontAwesome6 name="trash" size={16} color={colors.error} />
              <Text style={styles.deleteButtonText}>Delete Memory</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Type Selection Bottom Sheet */}
      <Modal
        visible={showTypeSelector}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View style={styles.modalContainer}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          </Animated.View>

          <Animated.View style={[styles.bottomSheet, sheetStyle, { paddingBottom: insets.bottom + spacing.lg }]}>
            {/* Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Type</Text>
              <TouchableOpacity onPress={closeSheet} style={styles.sheetCloseButton}>
                <FontAwesome6 name="xmark" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Type Options */}
            <ScrollView
              style={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              {Object.entries(COMMERCE_CATEGORIES).map(([type, info]) => {
                const isSelected = form.type === type;
                const chipColor = categoryColors[type] || colors.accent;
                return (
                  <Pressable
                    key={type}
                    style={[
                      styles.typeOption,
                      isSelected && { backgroundColor: `${chipColor}15` },
                    ]}
                    onPress={() => {
                      updateField("type", type as MemoryType);
                      closeSheet();
                    }}
                  >
                    <View style={[styles.typeOptionIcon, { backgroundColor: `${chipColor}20` }]}>
                      <Text style={styles.typeOptionIconText}>{info.icon}</Text>
                    </View>
                    <View style={styles.typeOptionContent}>
                      <Text style={[
                        styles.typeOptionLabel,
                        isSelected && { color: chipColor },
                      ]}>
                        {info.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <FontAwesome6 name="check" size={16} color={chipColor} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any, spacing: any, radius: any, typography: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      ...typography.headline,
      color: colors.textPrimary,
    },
    saveButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
    },
    saveButtonDisabled: {
      backgroundColor: colors.border,
    },
    saveButtonText: {
      ...typography.caption,
      color: "#FFFFFF",
      fontWeight: "600",
    },
    saveButtonTextDisabled: {
      color: colors.textTertiary,
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: spacing.lg,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionLabel: {
      ...typography.caption,
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    typeSelector: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      gap: spacing.md,
    },
    typeIconContainer: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      justifyContent: "center",
      alignItems: "center",
    },
    typeIcon: {
      fontSize: 22,
    },
    typeSelectorContent: {
      flex: 1,
    },
    typeSelectorLabel: {
      ...typography.headline,
      color: colors.textPrimary,
    },
    typeSelectorHint: {
      ...typography.small,
      color: colors.textTertiary,
    },
    typeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    typeChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing.xs,
    },
    typeChipIcon: {
      fontSize: 14,
    },
    typeChipLabel: {
      ...typography.caption,
      fontWeight: "500",
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...typography.body,
      color: colors.textPrimary,
    },
    inputError: {
      borderColor: colors.error,
    },
    textArea: {
      minHeight: 120,
      paddingTop: spacing.md,
    },
    errorText: {
      ...typography.small,
      color: colors.error,
      marginTop: spacing.xs,
    },
    charCount: {
      ...typography.small,
      color: colors.textTertiary,
      textAlign: "right",
      marginTop: spacing.xs,
    },
    hint: {
      ...typography.small,
      color: colors.textTertiary,
      marginTop: spacing.xs,
    },
    priceContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    currencySymbol: {
      ...typography.title,
      color: colors.textSecondary,
      marginRight: spacing.sm,
    },
    priceInput: {
      flex: 1,
      ...typography.title,
      color: colors.textPrimary,
      paddingVertical: spacing.md,
    },
    locationContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    locationInput: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      paddingVertical: spacing.md,
    },
    deleteButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      marginTop: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    deleteButtonText: {
      ...typography.body,
      color: colors.error,
    },
    // Bottom Sheet styles
    modalContainer: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    bottomSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: "70%",
    },
    sheetHandle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: "center",
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      ...typography.headline,
      color: colors.textPrimary,
    },
    sheetCloseButton: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    sheetContent: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    typeOption: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.md,
      borderRadius: radius.lg,
      marginVertical: spacing.xs,
      gap: spacing.md,
    },
    typeOptionIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      justifyContent: "center",
      alignItems: "center",
    },
    typeOptionIconText: {
      fontSize: 22,
    },
    typeOptionContent: {
      flex: 1,
    },
    typeOptionLabel: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing.xs,
      backgroundColor: colors.surface,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusLabel: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: "500",
    },
  });
