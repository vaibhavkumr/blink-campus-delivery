import { Anton_400Regular, useFonts } from '@expo-google-fonts/anton';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '@/lib/store';
import { Colors, Fonts } from '@/constants/theme';

export default function RootLayout() {
  // Anton is the heavy display face used for the wordmark + big headings.
  // We don't block the whole app on it — screens fall back to system bold.
  useFonts({ [Fonts.display]: Anton_400Regular });

  return (
    <AppProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: Colors.text,
          headerStyle: { backgroundColor: Colors.bg },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="cart" options={{ title: 'Your cart', presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications', presentation: 'modal' }} />
        <Stack.Screen name="group" options={{ title: 'Floor order', presentation: 'modal' }} />
        <Stack.Screen name="category/[key]" options={{ title: '' }} />
        <Stack.Screen name="vendor/[id]" options={{ title: '' }} />
        <Stack.Screen name="order/[id]" options={{ title: 'Order status' }} />
      </Stack>
    </AppProvider>
  );
}
