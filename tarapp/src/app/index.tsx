import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';


export default function Index() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // the canvas owns the gates: terms → onboarding → home
    router.replace('/canvas');
    setReady(true);
  }, [router]);

  return ready ? null : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
}
