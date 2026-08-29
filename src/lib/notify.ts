import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Thin wrapper around expo-notifications for on-device LOCAL notifications.
// Fires when the app (foreground/background) sees a new server event while
// polling. Remote push (FCM/APNs) would be added as a separate transport in
// production; local notifications need no cloud project and work in Expo Go.
//
// Guarded so the web preview (which has no native module) is a no-op.

let mod: typeof import('expo-notifications') | null = null;
let ready = false;

async function ensure() {
  if (Platform.OS === 'web') return null;
  if (!mod) {
    try {
      mod = await import('expo-notifications');
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      return null;
    }
  }
  if (!ready) {
    try {
      const { status } = await mod.getPermissionsAsync();
      if (status !== 'granted') await mod.requestPermissionsAsync();
      ready = true;
    } catch {
      // permission flow unavailable — skip
    }
  }
  return mod;
}

export async function pushLocal(title: string, body: string) {
  const m = await ensure();
  if (!m) return;
  try {
    await m.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch {
    // ignore — notification is best-effort
  }
}

// Get this device's Expo push token so the backend can send REMOTE pushes
// that reach a fully-closed phone. Returns null on web / Expo Go where
// remote push isn't available.
export async function registerForPush(): Promise<string | null> {
  const m = await ensure();
  if (!m) return null;
  try {
    const projectId =
      (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas
        ?.projectId ||
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    const res = await m.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return res.data || null;
  } catch {
    return null;
  }
}
