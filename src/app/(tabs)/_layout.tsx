import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Icon, IconName } from '@/components/Icon';
import { Colors, Shadow } from '@/constants/theme';
import { useApp } from '@/lib/store';

function tabIcon(name: IconName) {
  return ({ focused }: { focused: boolean }) => (
    <Icon
      name={name}
      size={23}
      color={focused ? Colors.primary : Colors.textMuted}
      strokeWidth={focused ? 2.4 : 2}
    />
  );
}

export default function TabsLayout() {
  const { ready, session } = useApp();
  // Guard the tab group: a signed-out visitor (e.g. after a web reload)
  // is sent back to sign-in rather than seeing empty screens.
  if (ready && !session) return <Redirect href="/auth" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerShown: false,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopWidth: 0,
          height: Platform.OS === 'web' ? 64 : undefined,
          paddingTop: 4,
          ...Shadow.md,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Shop', tabBarIcon: tabIcon('bag') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: tabIcon('clock') }} />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards', tabBarIcon: tabIcon('person') }} />
    </Tabs>
  );
}
