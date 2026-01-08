import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

export default function EmailLoginScreen() {
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, typography } = useTheme();
  const { signInWithEmail, signUpWithEmail, isLoading, error: authError, isAuthenticated } = useSupabaseAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // If already authenticated, redirect to main app
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/tasks');
    }
  }, [isAuthenticated]);

  const handleAuth = async () => {
    try {
      setError(null);

      if (!email.trim()) {
        setError('Please enter your email');
        return;
      }

      if (!password.trim()) {
        setError('Please enter your password');
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      setSigningIn(true);

      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      // Navigation will happen automatically via the useEffect above
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : isSignUp ? 'Sign up failed' : 'Sign in failed';
      setError(errorMessage);
      setSigningIn(false);
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
            <Image
              source={require('@/assets/images/tar.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
            <Text style={styles.subtitle}>Universal Commerce</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View
                style={[
                  styles.inputContainer,
                  email && styles.inputContainerFocused,
                ]}
              >
                <FontAwesome6 name="envelope" size={16} color={colors.textTertiary} />
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  editable={!isLoading && !signingIn}
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
                <FontAwesome6 name="lock" size={16} color={colors.textTertiary} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading && !signingIn}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading || signingIn}
                  style={styles.passwordToggle}
                >
                  <FontAwesome6
                    name={showPassword ? 'eye' : 'eye-slash'}
                    size={16}
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

            {/* Auth Button */}
            <TouchableOpacity
              style={[
                styles.authButton,
                (isLoading || signingIn) && styles.authButtonDisabled,
              ]}
              onPress={handleAuth}
              disabled={isLoading || signingIn}
            >
              {isLoading || signingIn ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.authButtonText}>
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle Sign Up/Sign In */}
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              disabled={isLoading || signingIn}
            >
              <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={[styles.toggleLink, { color: colors.accent }]}>
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </Text>
              </Text>
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
                Your data is encrypted and secure. We'll never share your information.
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
      marginTop: spacing.xl,
      marginBottom: spacing.xl,
    },
    logo: {
      width: 100,
      height: 100,
      marginBottom: spacing.md,
    },
    title: {
      ...typography.largeTitle,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
    },
    form: {
      gap: spacing.lg,
      marginBottom: spacing.xl,
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
      gap: spacing.sm,
    },
    inputContainerFocused: {
      borderColor: colors.accent,
      borderWidth: 2,
    },
    input: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      padding: 0,
    },
    passwordToggle: {
      padding: spacing.xs,
    },
    authButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    authButtonDisabled: {
      opacity: 0.6,
    },
    authButtonText: {
      ...typography.headline,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    toggleButton: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    toggleText: {
      ...typography.body,
    },
    toggleLink: {
      fontWeight: '600',
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
