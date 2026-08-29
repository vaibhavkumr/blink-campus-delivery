import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useApp } from '@/lib/store';

export default function Index() {
  const { ready, session } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }
  return session ? <Redirect href="/(tabs)" /> : <Redirect href="/auth" />;
}
