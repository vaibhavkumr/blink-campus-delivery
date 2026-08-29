import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { ProductArt } from '@/components/ProductArt';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { api, GroupCart } from '@/lib/api';
import { campusById } from '@/lib/campuses';
import { useApp } from '@/lib/store';

export default function GroupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { session, products } = useApp();
  const campus = campusById(session?.campusId ?? 'unl');

  const [code, setCode] = useState(params.code ?? '');
  const [group, setGroup] = useState<GroupCart | null>(null);
  const [created, setCreated] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const refresh = useCallback(async (c: string) => {
    try {
      setGroup(await api.group(c));
    } catch {
      /* keep last */
    }
  }, []);

  // Live-refresh the shared cart while in a group.
  useEffect(() => {
    if (!code) return;
    refresh(code);
    const id = setInterval(() => refresh(code), 3000);
    return () => clearInterval(id);
  }, [code, refresh]);

  const onStart = async () => {
    setBusy(true);
    try {
      const g = await api.groupCreate(campus.buildings[0]);
      setGroup(g);
      setCode(g.code);
      setCreated(true);
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    setErr('');
    try {
      const g = await api.group(joinInput.trim().toUpperCase());
      setGroup(g);
      setCode(g.code);
    } catch {
      setErr('No floor order with that code.');
    }
  };

  const onAdd = async (productId: string) => {
    if (!code) return;
    setGroup(await api.groupAdd(code, productId, 1));
  };

  const onCheckout = async () => {
    if (!code) return;
    setBusy(true);
    try {
      const { order } = await api.groupCheckout(code, { building: group?.building ?? campus.buildings[0], tip: 2 });
      router.replace(`/order/${order.id}`);
    } catch {
      setErr('Could not place the order.');
      setBusy(false);
    }
  };

  // Landing: start or join.
  if (!group) {
    return (
      <ScrollView style={styles.safe} contentContainerStyle={styles.center}>
        <Icon name="people" size={52} color={Colors.primary} />
        <Text style={styles.title}>Order with your floor</Text>
        <Text style={styles.sub}>
          Everyone adds their snacks to one cart, splits nothing, and hits $15 together for free
          delivery — all dropped at one spot.
        </Text>
        <Pressable style={[styles.primary, busy && styles.dim]} onPress={onStart} disabled={busy}>
          <Text style={styles.primaryText}>Start a floor order</Text>
        </Pressable>
        <Text style={styles.or}>or join one</Text>
        <View style={styles.joinRow}>
          <TextInput
            style={styles.joinInput}
            placeholder="Enter code (e.g. FLOOR3X2)"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            value={joinInput}
            onChangeText={setJoinInput}
          />
          <Pressable style={styles.joinBtn} onPress={onJoin}>
            <Text style={styles.joinBtnText}>Join</Text>
          </Pressable>
        </View>
        {err ? <Text style={styles.err}>{err}</Text> : null}
      </ScrollView>
    );
  }

  const items = products.filter(
    (p) => p.inStock && (search ? p.name.toLowerCase().includes(search.trim().toLowerCase()) : true)
  );

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.container}>
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Share this code with your floor</Text>
        <Text style={styles.code}>{group.code}</Text>
        <Text style={styles.people}>{group.people.length || 1} in · {group.building}</Text>
      </View>

      <View style={styles.freeBar}>
        <Text style={styles.freeText}>
          {group.unlocked
            ? 'Free delivery unlocked for everyone!'
            : `$${group.toFreeDelivery.toFixed(2)} more for FREE delivery`}
        </Text>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(100, (group.subtotal / group.freeDeliveryThreshold) * 100)}%` },
            ]}
          />
        </View>
      </View>

      <Text style={styles.section}>The cart · ${group.subtotal.toFixed(2)}</Text>
      {group.items.length === 0 ? (
        <Text style={styles.empty}>Nothing yet — add the first snack below.</Text>
      ) : (
        group.items.map((it) => (
          <View key={it.id} style={styles.line}>
            <ProductArt id={it.productId} name={it.name} size={36} />
            <Text style={styles.lineName}>
              {it.name} {it.qty > 1 ? `×${it.qty}` : ''}
            </Text>
            <Text style={styles.lineWho}>{it.who}</Text>
            <Text style={styles.linePrice}>${it.lineTotal.toFixed(2)}</Text>
          </View>
        ))
      )}

      <Text style={styles.section}>Add your snacks</Text>
      <TextInput
        style={styles.search}
        placeholder="Search…"
        placeholderTextColor={Colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8, paddingRight: 16 }}>
        {items.slice(0, 20).map((p) => (
          <Pressable key={p.id} style={styles.pick} onPress={() => onAdd(p.id)}>
            <ProductArt id={p.id} name={p.name} category={p.category} size={46} />
            <Text style={styles.pickName} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
            <Text style={styles.pickAdd}>+ ${p.price.toFixed(2)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {created ? (
        <Pressable style={[styles.primary, busy && styles.dim]} onPress={onCheckout} disabled={busy || group.items.length === 0}>
          <Text style={styles.primaryText}>Place group order · ${group.subtotal.toFixed(2)}</Text>
        </Pressable>
      ) : (
        <Text style={styles.waitHost}>Waiting for the host to place the order…</Text>
      )}
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Pressable style={styles.leave} onPress={() => router.back()}>
        <Text style={styles.leaveText}>Back to shop</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  center: { padding: 24, alignItems: 'center', justifyContent: 'center', flexGrow: 1, gap: 10 },
  hero: { fontSize: 56 },
  title: { fontFamily: Fonts.display, fontSize: 30, color: Colors.text },
  sub: { color: Colors.textMuted, textAlign: 'center', fontSize: 14, marginBottom: 12 },
  primary: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: 16, alignItems: 'center', alignSelf: 'stretch', marginTop: 8 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  dim: { opacity: 0.5 },
  or: { color: Colors.textMuted, marginVertical: 6 },
  joinRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  joinInput: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 12, color: Colors.text },
  joinBtn: { backgroundColor: Colors.text, borderRadius: Radius.md, paddingHorizontal: 20, justifyContent: 'center' },
  joinBtnText: { color: '#fff', fontWeight: '700' },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  codeCard: { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 18, alignItems: 'center' },
  codeLabel: { color: '#FBE9E7', fontSize: 12, fontWeight: '600' },
  code: { fontFamily: Fonts.display, fontSize: 34, color: '#fff', letterSpacing: 2, marginVertical: 2 },
  people: { color: '#FBE9E7', fontSize: 13 },
  freeBar: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  freeText: { fontWeight: '700', color: Colors.primaryDark, fontSize: 13, marginBottom: 6 },
  track: { height: 8, borderRadius: 4, backgroundColor: Colors.border, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  section: { fontWeight: '800', color: Colors.text, fontSize: 16, marginTop: 6 },
  empty: { color: Colors.textMuted },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 10 },
  lineName: { flex: 1, color: Colors.text, fontWeight: '600', fontSize: 14 },
  lineWho: { color: Colors.textMuted, fontSize: 12, marginRight: 6 },
  linePrice: { color: Colors.text, fontWeight: '700' },
  search: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, color: Colors.text },
  pick: { width: 84, backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 8, alignItems: 'center', gap: 2 },
  pickName: { fontSize: 12, fontWeight: '600', color: Colors.text },
  pickAdd: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  waitHost: { color: Colors.textMuted, textAlign: 'center', marginTop: 8, fontWeight: '600' },
  leave: { padding: 14, alignItems: 'center' },
  leaveText: { color: Colors.textMuted, fontWeight: '600' },
  err: { color: Colors.primary, fontWeight: '600', textAlign: 'center' },
});
