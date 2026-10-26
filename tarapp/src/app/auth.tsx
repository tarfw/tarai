import { StyleSheet, View, Text, Pressable, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';

import { signInWithGoogle, getCurrentUser, getValidIdToken, trySilentSignIn } from '@/lib/auth';
import { TarLogo } from '@/components/TarLogo';
import { TarLogoLoader } from '@/components/TarLogoLoader';

const SOLUTIONS = [
  { icon: 'ellipse-outline' as const, label: 'Projects & Tasks' },
  { icon: 'cube-outline' as const, label: 'Supply chain' },
  { icon: 'cart-outline' as const, label: 'Commerce' },
  { icon: 'globe-outline' as const, label: 'Sites' },
  { icon: 'bulb-outline' as const, label: 'AI' },
];

const AUTH_BACKGROUND = '#1E5631';

const T0 = Date.now();
function ms() { return `${Date.now() - T0}ms`; }

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const [loading, setLoading] = useState(false);

  const logoHeight = Math.round(windowHeight * 0.28);

  useEffect(() => {
    console.log(`[AUTH] ${ms()} — useEffect START (checking user)`);
    (async () => {
      try {
        const t = Date.now();
        const user = await getCurrentUser();
        console.log(`[AUTH] ${Date.now() - t}ms — getCurrentUser: ${user ? user.email : 'null'}`);
        if (user) {
          const token = await getValidIdToken();
          if (token) {
            router.replace('/canvas');
          } else {
            console.log(`[AUTH] ${ms()} — saved Google session needs sign-in`);
          }
          return;
        }
        console.log(`[AUTH] ${ms()} — no user, trying silent sign-in...`);
        const t2 = Date.now();
        const silent = await trySilentSignIn();
        console.log(`[AUTH] ${Date.now() - t2}ms — trySilentSignIn: ${silent ? silent.email : 'null'}`);
        if (silent) {
          router.replace('/canvas');
        } else {
          console.log(`[AUTH] ${ms()} — no silent sign-in, staying on auth screen`);
        }
      } catch (_e) {
        console.log(`[AUTH] ${ms()} — catch:`, _e);
      }
    })();
  }, [router]);

  const handleGoogleAuth = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/canvas');
    } catch (e: any) {
      console.warn('[Auth] Google sign-in failed:', e.message);
      Alert.alert('Google Sign-In Error', e.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: AUTH_BACKGROUND }]}>
      <StatusBar style="light" />
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        <View style={styles.logoContainer}>
          <TarLogo size={logoHeight} color="#EBA827" bgColor={AUTH_BACKGROUND} />
        </View>
        <Text style={[styles.title, { color: '#FFFFFF' }]}>tar.</Text>
        <Text style={[styles.subtitle, { color: '#E2F1E8' }]}>Everything app</Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.solutions}>
          {SOLUTIONS.map((item) => (
            <View key={item.label} style={styles.solutionRow}>
              <Ionicons name={item.icon} size={22} color="#E2F1E8" />
              <Text style={[styles.solutionLabel, { color: '#E2F1E8' }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />

        <Pressable
          style={[styles.authButton, { backgroundColor: '#FFFFFF' }]}
          onPress={handleGoogleAuth}
          disabled={loading}>
          {loading ? (
            <TarLogoLoader size={20} color="#1E5631" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#1E5631" />
              <Text style={[styles.authButtonText, { color: '#1E5631' }]}>Continue with Google</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32, justifyContent: 'flex-start' },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  title: { fontSize: 64, fontWeight: '800', letterSpacing: -2 },
  subtitle: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  bottom: { paddingHorizontal: 32 },
  solutions: { gap: 16 },
  solutionRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  solutionLabel: { fontSize: 20, fontWeight: '500' },
  authButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, gap: 12, marginBottom: 48 },
  authButtonText: { fontSize: 16, fontWeight: '600' },
});
