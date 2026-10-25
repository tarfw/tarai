// The closed-phone bell: register this device once per session. FCM on
// Android through Expo's push service; the harness sends on urgent rows only.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { request } from './tar';

const DONE_KEY = 'tar_push_registered_at';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function registerPush(force = false): Promise<void> {
  const last = await SecureStore.getItemAsync(DONE_KEY);
  if (last && !force && Date.now() - Number(last) < 6 * 60 * 60_000) return;
  try {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    const token = await Notifications.getDevicePushTokenAsync();
    await request('POST', '/v1/push/register', { token: (token as { data?: string }).data ?? String(token), platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    await SecureStore.setItemAsync(DONE_KEY, String(Date.now()));
  } catch { /* the bell is best-effort; the badge still tells the truth */ }
}
