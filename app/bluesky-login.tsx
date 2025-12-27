import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useBlueskyAuth } from '@/contexts/BlueskyAuthContext';

export default function BlueskyLoginScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const { login, isLoading, error: authError, isAuthenticated } = useBlueskyAuth();

  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect to main app
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/tasks');
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    try {
      setError(null);

      if (!handle.trim()) {
        setError('Please enter your handle');
        return;
      }

      if (!password.trim()) {
        setError('Please enter your password');
        return;
      }

      // Normalize handle (remove @ if present)
      const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle;

      await login(normalizedHandle, password);

      // Navigate to DMs screen on successful login
      router.replace('/(tabs)/people');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Login failed';
      setError(errorMessage);
    }
  };

  const styles = createStyles(colors, spacing, radius, typography);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { paddingTop: insets.top + spacing.xl }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <FontAwesome6 name="butterfly" size={48} color={colors.accent} />
            </View>
            <Text style={styles.title}>Bluesky</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Handle Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Handle</Text>
              <View
                style={[
                  styles.inputContainer,
                  handle && styles.inputContainerFocused,
                ]}
              >
                <Text style={styles.handlePrefix}>@</Text>
                <TextInput
                  style={styles.input}
                  placeholder="username"
                  placeholderTextColor={colors.textTertiary}
                  value={handle}
                  onChangeText={setHandle}
                  editable={!isLoading}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View
                style={[
                  styles.inputContainer,
                  password && styles.inputContainerFocused,
                ]}
              >
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  style={styles.passwordToggle}
                >
                  <FontAwesome6
                    name={showPassword ? 'eye' : 'eye-slash'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Messages */}
            {(error || authError) && (
              <View style={styles.errorBox}>
                <FontAwesome6
                  name="exclamation-circle"
                  size={16}
                  color={colors.error}
                  style={{ marginRight: spacing.sm }}
                />
                <Text style={styles.errorText}>{error || authError}</Text>
              </View>
            )}

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                isLoading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoBox}>
              <FontAwesome6
                name="shield"
                size={20}
                color={colors.accent}
                style={{ marginRight: spacing.sm }}
              />
              <Text style={styles.infoText}>
                Your credentials are only used to authenticate with Bluesky and never stored locally.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any, spacing: any, radius: any, typography: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      justifyContent: 'space-between',
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.xxl,
    },
    logoContainer: {
      width: 80,
      height: 80,
      borderRadius: radius.xl,
      backgroundColor: colors.accentSubtle,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.largeTitle,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
    },
    form: {
      gap: spacing.lg,
      marginBottom: spacing.xxl,
    },
    inputGroup: {
      gap: spacing.sm,
    },
    label: {
      ...typography.callout,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      height: 48,
    },
    inputContainerFocused: {
      borderColor: colors.accent,
      borderWidth: 2,
    },
    handlePrefix: {
      ...typography.body,
      color: colors.textTertiary,
      marginRight: spacing.xs,
      fontWeight: '600',
    },
    input: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      padding: 0,
    },
    passwordToggle: {
      padding: spacing.sm,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.error + '15',
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.error + '30',
    },
    errorText: {
      flex: 1,
      ...typography.body,
      color: colors.error,
    },
    loginButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    loginButtonDisabled: {
      opacity: 0.6,
    },
    loginButtonText: {
      ...typography.headline,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    infoSection: {
      gap: spacing.md,
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
