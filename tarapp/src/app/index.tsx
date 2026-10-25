import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { getCurrentUser, getValidIdToken } from '@/lib/auth';

export default function Index() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const decide = async () => {
      const token = await getValidIdToken().catch(() => null);
      const user = token ? true : await getCurrentUser();
      if (active) {
        router.replace(user ? '/canvas' : '/auth');
        setReady(true);
      }
    };
    void decide();
    return () => { active = false; };
  }, [router]);

  return ready ? null : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
}
