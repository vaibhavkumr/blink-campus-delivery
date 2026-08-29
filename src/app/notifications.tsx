import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Colors, Radius } from '@/constants/theme';
import { useApp } from '@/lib/store';
import { AppNotification } from '@/lib/types';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, markNotificationsRead } = useApp();

  // Mark everything read when the screen opens.
  useEffect(() => {
    markNotificationsRead();
  }, [markNotificationsRead]);

  const renderItem = ({ item }: { item: AppNotification }) => (
    <Pressable
      style={[styles.row, !item.read && styles.rowUnread]}
      onPress={() => item.orderId && router.push(`/order/${item.orderId}`)}
    >
      <View style={styles.rowTop}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.time}>{timeAgo(item.at)}</Text>
      </View>
      <Text style={styles.body}>{item.body}</Text>
    </Pressable>
  );

  return (
    <View style={styles.safe}>
      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="bell" size={44} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: 16, gap: 10 },
  row: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowUnread: { borderColor: Colors.primary, backgroundColor: '#FFF7F8' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontWeight: '800', color: Colors.text, fontSize: 15, flex: 1 },
  time: { color: Colors.textMuted, fontSize: 12 },
  body: { color: Colors.textMuted, fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
});
