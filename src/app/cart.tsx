import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GradientButton } from '@/components/GradientButton';
import { Icon } from '@/components/Icon';
import { ItemCustomizer, needsCustomizer } from '@/components/ItemCustomizer';
import { ItemVisual } from '@/components/ItemVisual';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { api } from '@/lib/api';
import { campusById } from '@/lib/campuses';
import { Product } from '@/lib/types';
import {
  DELIVERY_FEE,
  FREE_DELIVERY_THRESHOLD,
  REDEEM_POINTS,
  REDEEM_VALUE,
  SERVICE_FEE,
  SMALL_ORDER_FEE,
  SMALL_ORDER_THRESHOLD,
  TAX_RATE,
  unitPrice,
  useApp,
} from '@/lib/store';

const TIP_OPTIONS = [0, 1, 2, 3];

export default function CartScreen() {
  const router = useRouter();
  const { session, cart, setQty, cartSubtotal, placeOrder, productById, products } = useApp();
  const [placing, setPlacing] = useState(false);
  const campus = campusById(session?.campusId ?? 'unl');
  const [building, setBuilding] = useState(campus.buildings[0]);
  const [note, setNote] = useState('');
  const [tip, setTip] = useState(2);
  // Cart line being re-customized (tap a built item to edit it).
  const [editing, setEditing] = useState<{ product: Product; modifier: string; qty: number } | null>(null);

  // Replace an existing line's build with a new one, keeping its quantity.
  const editLine = (product: Product, oldModifier: string, newModifier: string, qty: number) => {
    setEditing(null);
    if (newModifier === oldModifier) return;
    const mergedQty = (cart.find((i) => i.productId === product.id && i.modifier === newModifier)?.qty ?? 0) + qty;
    setQty(product.id, 0, oldModifier); // drop the old build
    setQty(product.id, mergedQty, newModifier); // add/merge the new build
  };
  const [redeem, setRedeem] = useState(false);

  // Geofence: confirm the chosen drop-off sits inside the UNL delivery zone.
  const [coords, setCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [zoneOk, setZoneOk] = useState<boolean | null>(null);
  useEffect(() => {
    api
      .campuses()
      .then((cs) => {
        const c = cs.find((x) => x.id === campus.id) ?? cs[0];
        const map: Record<string, { lat: number; lng: number }> = {};
        c?.buildings.forEach((b) => (map[b.name] = { lat: b.lat, lng: b.lng }));
        setCoords(map);
      })
      .catch(() => {});
  }, [campus.id]);
  useEffect(() => {
    const c = coords[building];
    if (!c) return;
    let cancelled = false;
    api
      .geofence(c.lat, c.lng, campus.id)
      .then((r) => !cancelled && setZoneOk(r.inside))
      .catch(() => !cancelled && setZoneOk(null));
    return () => {
      cancelled = true;
    };
  }, [building, coords, campus.id]);

  const canRedeem = (session?.points ?? 0) >= REDEEM_POINTS;
  const discount = redeem && canRedeem ? Math.min(REDEEM_VALUE, cartSubtotal) : 0;
  // Zero-minimum cart: a small-order fee applies under the threshold.
  const underThreshold = cartSubtotal > 0 && cartSubtotal < SMALL_ORDER_THRESHOLD;
  const smallOrderFee = underThreshold ? SMALL_ORDER_FEE : 0;
  const amountToAvoidFee = Math.max(0, SMALL_ORDER_THRESHOLD - cartSubtotal);
  // Free delivery once the cart clears the threshold.
  const freeDelivery = cartSubtotal >= FREE_DELIVERY_THRESHOLD;
  const deliveryFee = freeDelivery ? 0 : DELIVERY_FEE;
  const toFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - cartSubtotal);
  const freeProgress = Math.min(1, cartSubtotal / FREE_DELIVERY_THRESHOLD);
  const credit = session?.credit ?? 0;
  const tax = (cartSubtotal - discount) * TAX_RATE;
  const preCredit = cartSubtotal - discount + tax + deliveryFee + SERVICE_FEE + smallOrderFee + tip;
  const creditApplied = Math.min(credit, preCredit);
  const total = preCredit - creditApplied;
  // Drinks to upsell (in stock, not already in cart).
  const upsells = products
    .filter((p) => p.category === 'Drinks' && p.inStock && !cart.some((c) => c.productId === p.id))
    .slice(0, 6);

  const onPlace = async () => {
    if (placing) return;
    setPlacing(true);
    const order = await placeOrder({
      campusId: campus.id,
      building,
      note,
      tip,
      redeemPoints: redeem && canRedeem,
    });
    if (!order) {
      setPlacing(false);
      return;
    }
    // If Stripe is configured, send the customer to the hosted Checkout page,
    // then confirm payment on return. Otherwise (demo/stub) go straight to
    // the order screen.
    try {
      const cfg = await api.paymentsConfig();
      if (cfg.enabled) {
        const co = await api.checkout(order.id);
        if (co.url) {
          await WebBrowser.openBrowserAsync(co.url);
          await api.confirmPayment(order.id);
        }
      }
    } catch {
      // fall through — order still exists; payment can be retried
    }
    router.replace(`/order/${order.id}`);
  };

  if (cart.length === 0) {
    return (
      <View style={styles.empty}>
        <Icon name="bag" size={44} color={Colors.textMuted} />
        <Text style={styles.emptyText}>Your cart is empty</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Browse snacks</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.container}>
      {cart.map((item) => {
        const p = productById(item.productId);
        if (!p) return null;
        const unit = unitPrice(p, item.modifier);
        const editable = !!item.modifier && needsCustomizer(p);
        return (
          <View key={`${item.productId}|${item.modifier}`} style={styles.row}>
            <View style={styles.rowArt}>
              <ItemVisual product={p} size={46} />
            </View>
            <Pressable
              style={{ flex: 1 }}
              disabled={!editable}
              onPress={() => setEditing({ product: p, modifier: item.modifier, qty: item.qty })}
            >
              <Text style={styles.rowName}>{p.name}</Text>
              {item.modifier ? <Text style={styles.rowMod}>{item.modifier}</Text> : null}
              <View style={styles.rowMeta}>
                <Text style={styles.rowPrice}>${unit.toFixed(2)}</Text>
                {editable && (
                  <View style={styles.editTag}>
                    <Icon name="chevron" size={11} color={Colors.primary} strokeWidth={2.4} />
                    <Text style={styles.editText}>Edit</Text>
                  </View>
                )}
              </View>
            </Pressable>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => setQty(p.id, item.qty - 1, item.modifier)}>
                <Icon name="minus" size={15} color={Colors.primary} />
              </Pressable>
              <Text style={styles.stepQty}>{item.qty}</Text>
              <Pressable style={styles.stepBtn} onPress={() => setQty(p.id, item.qty + 1, item.modifier)}>
                <Icon name="plus" size={15} color={Colors.primary} />
              </Pressable>
            </View>
          </View>
        );
      })}

      <View style={styles.freeBar}>
        <Text style={styles.freeBarText}>
          {freeDelivery
            ? 'Free delivery unlocked!'
            : `Add $${toFreeDelivery.toFixed(2)} more for FREE delivery`}
        </Text>
        <View style={styles.freeTrack}>
          <View style={[styles.freeFill, { width: `${freeProgress * 100}%` }]} />
        </View>
      </View>

      {upsells.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Add a drink?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {upsells.map((p) => (
              <Pressable key={p.id} style={styles.upsell} onPress={() => setQty(p.id, 1)}>
                <ItemVisual product={p} size={46} />
                <Text style={styles.upsellName} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
                <Text style={styles.upsellAdd}>+ ${p.price.toFixed(2)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={styles.sectionTitle}>Deliver to · {campus.short}</Text>
      <View style={styles.buildingWrap}>
        {campus.buildings.map((b) => (
          <Pressable
            key={b}
            onPress={() => setBuilding(b)}
            style={[styles.buildingChip, building === b && styles.buildingChipActive]}
          >
            <Text style={[styles.buildingText, building === b && styles.buildingTextActive]}>
              {b}
            </Text>
          </Pressable>
        ))}
      </View>
      {zoneOk !== null && (
        <View style={[styles.zone, zoneOk ? styles.zoneOk : styles.zoneBad]}>
          <Icon
            name={zoneOk ? 'check' : 'minus'}
            size={16}
            color={zoneOk ? Colors.success : Colors.primary}
          />
          <Text style={[styles.zoneText, zoneOk ? styles.zoneTextOk : styles.zoneTextBad]}>
            {zoneOk ? 'Inside the UNL delivery zone' : 'Outside the delivery zone — pick a campus spot'}
          </Text>
        </View>
      )}
      <TextInput
        style={styles.noteInput}
        placeholder="Drop-off note (room #, entrance, etc.)"
        placeholderTextColor={Colors.textMuted}
        value={note}
        onChangeText={setNote}
      />

      <Text style={styles.sectionTitle}>Tip your driver</Text>
      <View style={styles.tipRow}>
        {TIP_OPTIONS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTip(t)}
            style={[styles.tipChip, tip === t && styles.tipChipActive]}
          >
            <Text style={[styles.tipText, tip === t && styles.tipTextActive]}>
              {t === 0 ? 'None' : `$${t}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {canRedeem && (
        <Pressable style={styles.redeemRow} onPress={() => setRedeem(!redeem)}>
          <View style={[styles.checkbox, redeem && styles.checkboxOn]}>
            {redeem && <Icon name="check" size={13} color="#fff" strokeWidth={3} />}
          </View>
          <Text style={styles.redeemText}>
            Redeem {REDEEM_POINTS} points for ${REDEEM_VALUE} off
          </Text>
        </Pressable>
      )}

      {underThreshold && (
        <View style={styles.nudge}>
          <Text style={styles.nudgeText}>
            Add ${amountToAvoidFee.toFixed(2)} more to avoid the ${SMALL_ORDER_FEE.toFixed(2)}{' '}
            small order fee
          </Text>
        </View>
      )}

      <View style={styles.summary}>
        <SummaryLine label="Subtotal" value={cartSubtotal} />
        {discount > 0 && <SummaryLine label="Points discount" value={-discount} />}
        {freeDelivery ? (
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Delivery fee</Text>
            <Text style={styles.freeTag}>FREE</Text>
          </View>
        ) : (
          <SummaryLine label="Delivery fee" value={deliveryFee} />
        )}
        <SummaryLine label="Service fee" value={SERVICE_FEE} />
        {smallOrderFee > 0 && <SummaryLine label="Small order fee" value={smallOrderFee} />}
        <SummaryLine label="Tax (est.)" value={tax} />
        <SummaryLine label="Tip" value={tip} />
        {creditApplied > 0 && <SummaryLine label="Referral credit" value={-creditApplied} />}
        <View style={styles.divider} />
        <SummaryLine label="Total" value={total} bold />
      </View>

      <Text style={styles.sectionTitle}>Express checkout</Text>
      <View style={styles.payRow}>
        <Pressable style={[styles.payBtn, styles.payApple]} onPress={onPlace} disabled={placing}>
          <Text style={styles.payAppleText}>Apple Pay</Text>
        </Pressable>
        <Pressable style={[styles.payBtn, styles.payGoogle]} onPress={onPlace} disabled={placing}>
          <Text style={styles.payGoogleText}>G Pay</Text>
        </Pressable>
      </View>

      <View style={styles.payCard}>
        <GradientButton
          label={placing ? 'Placing order…' : `Pay with card · $${total.toFixed(2)}`}
          onPress={onPlace}
          disabled={placing}
        />
      </View>
      <View style={styles.payHintRow}>
        <Icon name="check" size={13} color={Colors.textMuted} strokeWidth={2.6} />
        <Text style={styles.payHint}>Secure checkout by Stripe</Text>
      </View>

      <ItemCustomizer
        product={editing?.product ?? null}
        initial={editing?.modifier}
        editing
        onClose={() => setEditing(null)}
        onAdd={(newModifier) =>
          editing && editLine(editing.product, editing.modifier, newModifier, editing.qty)
        }
      />
    </ScrollView>
  );
}

function SummaryLine({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={[styles.summaryLabel, bold && styles.summaryBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryBold]}>
        {value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: 16, gap: 10, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 12,
    ...Shadow.sm,
  },
  rowArt: { width: 52, height: 52, borderRadius: Radius.sm, backgroundColor: Colors.bgWarm, alignItems: 'center', justifyContent: 'center' },
  rowEmoji: { fontSize: 28 },
  rowName: { fontWeight: '600', color: Colors.text, fontSize: 15 },
  rowMod: { color: Colors.textMuted, fontSize: 12, fontWeight: '500', marginTop: 2, lineHeight: 16 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  rowPrice: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  editTag: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  editText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEECEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '800' },
  stepQty: { fontWeight: '700', color: Colors.text, minWidth: 18, textAlign: 'center' },
  sectionTitle: { fontWeight: '800', color: Colors.text, fontSize: 16, marginTop: 12 },
  buildingWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  buildingChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buildingChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  zone: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: Radius.md, padding: 10, marginTop: 4 },
  zoneOk: { backgroundColor: '#E7F3E8' },
  zoneBad: { backgroundColor: '#FBE9E7' },
  zoneText: { fontWeight: '700', fontSize: 13 },
  zoneTextOk: { color: Colors.success },
  zoneTextBad: { color: Colors.primary },
  buildingText: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  buildingTextActive: { color: '#fff' },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    backgroundColor: Colors.card,
    color: Colors.text,
  },
  tipRow: { flexDirection: 'row', gap: 8 },
  tipChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tipChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tipText: { fontWeight: '700', color: Colors.text },
  tipTextActive: { color: '#fff' },
  redeemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: Radius.md,
    padding: 14,
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#92400E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#92400E' },
  redeemText: { fontWeight: '700', color: '#92400E' },
  nudge: {
    backgroundColor: '#EFF6FF',
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  nudgeText: { color: '#1D4ED8', fontWeight: '700', fontSize: 13 },
  freeBar: { marginTop: 6, marginBottom: 4 },
  freeBarText: { fontWeight: '700', fontSize: 13, color: Colors.primaryDark, marginBottom: 6 },
  freeTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  freeFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  freeTag: { color: Colors.success, fontWeight: '800' },
  upsell: {
    width: 84,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 8,
    alignItems: 'center',
    gap: 2,
  },
  upsellName: { fontSize: 12, fontWeight: '600', color: Colors.text },
  upsellAdd: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  payRow: { flexDirection: 'row', gap: 12 },
  payBtn: { flex: 1, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  payApple: { backgroundColor: '#000' },
  payAppleText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  payGoogle: { backgroundColor: '#fff' },
  payGoogleText: { color: '#3C4043', fontWeight: '800', fontSize: 16 },
  payCard: { marginTop: 10 },
  payHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 12 },
  summary: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 18,
    gap: 9,
    marginTop: 12,
    ...Shadow.sm,
  },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: Colors.textMuted },
  summaryValue: { color: Colors.text, fontWeight: '600' },
  summaryBold: { fontWeight: '800', fontSize: 16, color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  payHint: { color: Colors.textMuted, fontSize: 12, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: Colors.textMuted, fontSize: 16 },
});
