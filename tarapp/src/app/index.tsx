import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getCurrentUser, getValidIdToken } from '@/lib/auth';

export default function Index() {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getValidIdToken()
      .then(async (token) => { if (active) setTarget(token || await getCurrentUser() ? '/home' : '/auth'); })
      .catch(async () => { if (active) setTarget(await getCurrentUser() ? '/home' : '/auth'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (target) {
      router.replace(target as any);
    }
  }, [target, router]);

  return null;
}
