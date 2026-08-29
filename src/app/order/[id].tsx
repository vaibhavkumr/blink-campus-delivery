import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, IconName } from '@/components/Icon';
import { RouteMap } from '@/components/RouteMap';
import { Colors, Radius } from '@/constants/theme';
import { campusById } from '@/lib/campuses';
import { useApp } from '@/lib/store';
import { ORDER_STEPS, OrderItem, OrderStatus } from '@/lib/types';

const STEP_INFO: Record<OrderStatus, { label: string; icon: IconName; detail: string }> = {
  PLACED: { label: 'Order placed', icon: 'bag', detail: 'Sent to your Blink courier' },
  ACCEPTED: { label: 'Courier assigned', icon: 'person', detail: 'A courier claimed your order' },
  PICKING: { label: 'Shopper shopping', icon: 'search', detail: 'Your courier is grabbing your items' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', icon: 'arrow', detail: 'Your courier is on the way' },
  DELIVERED: { label: 'Delivered', icon: 'check', detail: 'Enjoy! Points added to your account' },
};

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orders, products, resolveItem } = useApp();
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Order not found</Text>
      </View>
    );
  }

  const status = order.status;
  const stepIndex = order.stepIndex >= 0 ? order.stepIndex : ORDER_STEPS.indexOf(status);
  const campus = campusById(order.campusId);
  const delivered = status === 'DELIVERED';
  const driveProgress = order.driveProgress;
  const oosItems = order.items.filter((it) => it.itemStatus === 'out_of_stock');

  // Suggest up to 3 in-stock substitutes from the same category.
  const substitutesFor = (item: OrderItem) =>
    products
      .filter((p) => p.category === (products.find((x) => x.id === item.productId)?.category) && p.inStock && p.id !== item.productId)
      .slice(0, 3);

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.container}>
      <View style={styles.etaCard}>
        <Icon name={STEP_INFO[status].icon} size={36} color="#fff" />
        <Text style={styles.etaTitle}>
          {delivered ? 'Delivered!' : `Arriving in ~${order.etaMinutes} min`}
        </Text>
        <Text style={styles.etaSub}>
          {campus.short} · {order.building}
          {order.note ? ` · “${order.note}”` : ''}
        </Text>
      </View>

      {oosItems.length > 0 && (
        <View style={styles.subCard}>
          <Text style={styles.subTitle}>An item is out of stock</Text>
          <Text style={styles.subSub}>
            Your courier couldn’t find {oosItems.length === 1 ? 'an item' : 'some items'}. Pick a
            substitute or get a refund.
          </Text>
          {oosItems.map((item) => (
            <View key={item.id} style={styles.subItem}>
              <Text style={styles.subItemName}>{item.name}</Text>
              <View style={styles.subOptions}>
                {substitutesFor(item).map((sub) => (
                  <Pressable
                    key={sub.id}
                    style={styles.subChip}
                    onPress={() => resolveItem(order.id, item.id, { substituteProductId: sub.id })}
                  >
                    <Text style={styles.subChipText}>
                      {sub.name} · ${sub.price.toFixed(2)}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.subChip, styles.refundChip]}
                  onPress={() => resolveItem(order.id, item.id, { refund: true })}
                >
                  <Text style={styles.refundChipText}>Refund this item</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Real fastest-route geometry from OSRM, courier interpolated along it. */}
      <RouteMap orderId={order.id} progress={driveProgress} />

      <View style={styles.timeline}>
        {ORDER_STEPS.map((step, i) => {
          const done = i <= stepIndex;
          const current = i === stepIndex;
          return (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepRail}>
                <View style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent]} />
                {i < ORDER_STEPS.length - 1 && (
                  <View style={[styles.rail, i < stepIndex && styles.railDone]} />
                )}
              </View>
              <View style={styles.stepBody}>
                <View style={styles.stepLabelRow}>
                  <Icon
                    name={STEP_INFO[step].icon}
                    size={16}
                    color={done ? Colors.text : Colors.textMuted}
                  />
                  <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>
                    {STEP_INFO[step].label}
                  </Text>
                </View>
                {current && <Text style={styles.stepDetail}>{STEP_INFO[step].detail}</Text>}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.receipt}>
        <Text style={styles.receiptTitle}>Order #{order.shortId}</Text>
        {order.items.map((it) => {
          if (it.itemStatus === 'refunded') {
            return (
              <View key={it.id} style={styles.receiptLine}>
                <Text style={[styles.receiptItem, styles.struck]}>
                  {it.name} {it.qty > 1 ? `×${it.qty}` : ''}
                </Text>
                <Text style={styles.refundedTag}>Refunded</Text>
              </View>
            );
          }
          if (it.itemStatus === 'substituted' && it.substitute) {
            return (
              <View key={it.id} style={styles.receiptLine}>
                <Text style={styles.receiptItem}>
                  {it.substitute.name} {it.qty > 1 ? `×${it.qty}` : ''}
                  <Text style={styles.subNote}> (sub for {it.name})</Text>
                </Text>
                <Text style={styles.receiptPrice}>${(it.substitute.price * it.qty).toFixed(2)}</Text>
              </View>
            );
          }
          return (
            <View key={it.id} style={styles.receiptLine}>
              <Text style={styles.receiptItem}>
                {it.name} {it.qty > 1 ? `×${it.qty}` : ''}
                {it.modifier ? <Text style={styles.subNote}> · {it.modifier}</Text> : null}
              </Text>
              <Text style={styles.receiptPrice}>${(it.price * it.qty).toFixed(2)}</Text>
            </View>
          );
        })}
        <View style={styles.divider} />
        <View style={styles.receiptLine}>
          <Text style={styles.receiptItem}>Total</Text>
          <Text style={styles.receiptTotal}>${order.total.toFixed(2)}</Text>
        </View>
        {delivered && (
          <Text style={styles.pointsNote}>+{order.pointsEarned} points earned</Text>
        )}
      </View>

      <Pressable style={styles.button} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.buttonText}>Back to shop</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: 16, gap: 16, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },
  etaCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  etaTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 8 },
  etaSub: { color: '#FECACA', fontSize: 13, marginTop: 4, textAlign: 'center' },
  subCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  subTitle: { fontWeight: '800', color: '#92400E', fontSize: 16 },
  subSub: { color: '#B45309', fontSize: 13, marginTop: 4, marginBottom: 12 },
  subItem: { marginBottom: 12 },
  subItemName: { fontWeight: '700', color: Colors.text, marginBottom: 6 },
  subOptions: { gap: 8 },
  subChip: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subChipText: { color: Colors.text, fontWeight: '600' },
  refundChip: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  refundChipText: { color: '#B91C1C', fontWeight: '700' },
  struck: { textDecorationLine: 'line-through', color: Colors.textMuted },
  refundedTag: { color: '#B91C1C', fontWeight: '700', fontSize: 13 },
  subNote: { color: Colors.textMuted, fontWeight: '400', fontSize: 12 },
  map: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapLabel: { fontSize: 12, fontWeight: '700', color: Colors.text },
  mapTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    justifyContent: 'center',
  },
  mapProgress: { height: 6, borderRadius: 3, backgroundColor: Colors.success },
  mapCar: { position: 'absolute', fontSize: 18, top: -14 },
  timeline: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 20 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.border,
    marginTop: 3,
  },
  dotDone: { backgroundColor: Colors.success },
  dotCurrent: { backgroundColor: Colors.primary },
  rail: { width: 3, flex: 1, backgroundColor: Colors.border, minHeight: 22 },
  railDone: { backgroundColor: Colors.success },
  stepBody: { flex: 1, paddingBottom: 14 },
  stepLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepLabel: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
  stepLabelDone: { color: Colors.text },
  stepDetail: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  receipt: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  receiptTitle: { fontWeight: '800', color: Colors.text, marginBottom: 4 },
  receiptLine: { flexDirection: 'row', justifyContent: 'space-between' },
  receiptItem: { color: Colors.text, fontSize: 14 },
  receiptPrice: { color: Colors.textMuted, fontSize: 14 },
  receiptTotal: { fontWeight: '800', color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border },
  pointsNote: { color: '#92400E', fontWeight: '700', marginTop: 4 },
  button: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonText: { color: Colors.text, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: Colors.textMuted },
});
