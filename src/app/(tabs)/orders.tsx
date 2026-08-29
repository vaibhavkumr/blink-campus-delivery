import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Colors, Radius } from '@/constants/theme';
import { campusById } from '@/lib/campuses';
import { useApp } from '@/lib/store';
import { Order, OrderStatus } from '@/lib/types';

const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: 'Order placed',
  ACCEPTED: 'Courier assigned',
  PICKING: 'Shopper shopping',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
};

export default function OrdersScreen() {
  const router = useRouter();
  const { orders } = useApp();

  const renderOrder = ({ item }: { item: Order }) => {
    const status = item.status;
    const active = status !== 'DELIVERED';
    return (
      <Pressable style={styles.card} onPress={() => router.push(`/order/${item.id}`)}>
        <View style={styles.cardTop}>
          <Text style={styles.orderId}>#{item.shortId}</Text>
          {item.needsSubstitution ? (
            <View style={[styles.statusPill, styles.pillAlert]}>
              <Text style={[styles.pillText, styles.pillTextAlert]}>Action needed</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, active ? styles.pillActive : styles.pillDone]}>
              <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextDone]}>
                {STATUS_LABEL[status]}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.items} numberOfLines={1}>
          {item.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')}
        </Text>
        <View style={styles.cardBottom}>
          <Text style={styles.meta}>
            {campusById(item.campusId).short} · {item.building}
          </Text>
          <Text style={styles.total}>${item.total.toFixed(2)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Your orders</Text>
      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="bag" size={44} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No orders yet — grab a snack!</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, padding: 16 },
  list: { paddingHorizontal: 16, gap: 12, paddingBottom: 24 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontWeight: '800', color: Colors.text, fontSize: 15 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.xl },
  pillActive: { backgroundColor: '#FEF3C7' },
  pillDone: { backgroundColor: '#DCFCE7' },
  pillAlert: { backgroundColor: '#FEF3C7' },
  pillTextAlert: { color: '#92400E' },
  pillText: { fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: '#92400E' },
  pillTextDone: { color: '#166534' },
  items: { color: Colors.textMuted, fontSize: 13 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { color: Colors.textMuted, fontSize: 13 },
  total: { fontWeight: '700', color: Colors.text },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
});
