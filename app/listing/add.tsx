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
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/contexts/ThemeContext";
import { COMMERCE_CATEGORIES } from "@/services/vectorStores/listingVectorStore";
import { listingService } from "@/services/listingService";
import type { CommerceType } from "@/types/listing";

type FormData = {
  title: string;
  description: string;
  price: string;
  type: CommerceType;
  category: string;
  tags: string;
  location: string;
};

const INITIAL_FORM: FormData = {
  title: "",
  description: "",
  price: "",
  type: "physical_product",
  category: "",
  tags: "",
  location: "",
};

export default function AddListing() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const params = useLocalSearchParams<{ id?: string; mode?: string }>();
  const isEditing = params.mode === "edit" && params.id;

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const styles = createStyles(colors, spacing, radius, typography);

  const categoryColors: Record<string, string> = {
    transportation: colors.blue,
    food_delivery: colors.orange,
    service: colors.green,
    booking: colors.purple,
    physical_product: colors.teal,
    educational: colors.pink,
    event: colors.warning,
    rental: colors.accent,
    digital_product: colors.success,
    recurring_service: colors.error,
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

    if (!form.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (!form.price.trim()) {
      newErrors.price = "Price is required";
    } else if (isNaN(Number(form.price)) || Number(form.price) <= 0) {
      newErrors.price = "Enter a valid price";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isEditing && params.id) {
        await listingService.updateListing(params.id, {
          title: form.title.trim(),
          type: form.type,
          price: Number(form.price),
          description: form.description.trim(),
          category: form.category.trim(),
          tags: form.tags.trim(),
          location: form.location.trim(),
        });
      } else {
        await listingService.createListing({
          title: form.title.trim(),
          type: form.type,
          price: Number(form.price),
          description: form.description.trim(),
          category: form.category.trim(),
          tags: form.tags.trim(),
          location: form.location.trim(),
        });
      }
      router.back();
    } catch (error) {
      console.error("Failed to save listing:", error);
      Alert.alert("Error", "Failed to save listing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Listing",
      "Are you sure you want to delete this listing? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (params.id) {
              try {
                await listingService.deleteListing(params.id);
                router.back();
              } catch (error) {
                Alert.alert("Error", "Failed to delete listing.");
              }
            }
          },
        },
      ]
    );
  };

  const selectedType = COMMERCE_CATEGORIES[form.type as keyof typeof COMMERCE_CATEGORIES];
  const typeColor = categoryColors[form.type] || colors.accent;

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
          disabled={isSubmitting}
          style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]}
        >
          <Text style={[styles.saveButtonText, isSubmitting && styles.saveButtonTextDisabled]}>
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
              onPress={() => setShowTypeSelector(!showTypeSelector)}
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
                name={showTypeSelector ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.textTertiary}
              />
            </TouchableOpacity>

            {showTypeSelector && (
              <View style={styles.typeGrid}>
                {Object.entries(COMMERCE_CATEGORIES).map(([type, info]) => {
                  const isSelected = form.type === type;
                  const chipColor = categoryColors[type] || colors.accent;
                  return (
                    <Pressable
                      key={type}
                      style={[
                        styles.typeChip,
                        {
                          backgroundColor: isSelected ? `${chipColor}20` : colors.surface,
                          borderColor: isSelected ? chipColor : colors.border,
                        },
                      ]}
                      onPress={() => {
                        updateField("type", type as CommerceType);
                        setShowTypeSelector(false);
                      }}
                    >
                      <Text style={styles.typeChipIcon}>{info.icon}</Text>
                      <Text
                        style={[
                          styles.typeChipLabel,
                          { color: isSelected ? chipColor : colors.textSecondary },
                        ]}
                      >
                        {info.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
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

          {/* Price */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Price</Text>
            <View style={[styles.priceContainer, errors.price && styles.inputError]}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                value={form.price}
                onChangeText={(v) => updateField("price", v.replace(/[^0-9.]/g, ""))}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Electronics, Food, Home Services"
              placeholderTextColor={colors.textTertiary}
              value={form.category}
              onChangeText={(v) => updateField("category", v)}
              maxLength={50}
            />
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
              <Text style={styles.deleteButtonText}>Delete Listing</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: any, spacing: any, radius: any, typography: any) =>
  StyleSheet.create({
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
  });
