import Constants from 'expo-constants';

// The backend runs on this port. The host is auto-detected from the Expo
// dev server so the same build works in the web preview (localhost) and
// on a physical phone (the PC's LAN IP) with no hardcoding.
export const API_PORT = 4010;

function detectHost(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    // Fallback for older Expo Go runtimes
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost ||
    '';
  const host = hostUri.split(':')[0];
  return host || 'localhost';
}

export const API_BASE = `http://${detectHost()}:${API_PORT}`;
