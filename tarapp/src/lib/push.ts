// The closed-phone bell: register this device once per session. FCM on
// Android through Expo's push service; the backend sends on urgent rows only.

import { requireOptionalNativeModule } from 'expo';
import * as SecureStore from 'expo-secure-store';


const DONE_KEY = 'tar_push_registered_at';

export async function registerPush(force = false): Promise<void> {
  if (!requireOptionalNativeModule('ExpoPushTokenManager')) return;
  const last = await SecureStore.getItemAsync(DONE_KEY);
  if (last && !force && Date.now() - Number(last) < 6 * 60 * 60_000) return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;
    // Phase 1: the device registers; the backend push route returns later.
    await Notifications.getDevicePushTokenAsync();
    await SecureStore.setItemAsync(DONE_KEY, String(Date.now()));
  } catch { /* the bell is best-effort; the badge still tells the truth */ }
}
