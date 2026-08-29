import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProductGrid } from '@/components/ProductGrid';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { restaurantById } from '@/lib/restaurants';
import { useApp } from '@/lib/store';
import { Product } from '@/lib/types';

export default function VendorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { products, cartCount, cartSubtotal } = useApp();
  const r = restaurantById(id ?? '');

  const items = useMemo(() => products.filter((p) => p.vendorId === id), [products, id]);

  // Group items into menu sections (Combos, Sides, Drinks…) in first-seen order.
  const sections = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of items) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ title: r?.name ?? 'Menu' }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: r?.color ?? Colors.primary }]}>
          <Text style={styles.heroName}>{r?.name ?? 'Menu'}</Text>
          {r?.blurb ? <Text style={styles.heroBlurb}>{r.blurb} · delivered to your dorm</Text> : null}
        </View>

        {items.length === 0 ? (
          <Text style={styles.empty}>Menu loading…</Text>
        ) : (
          sections.map(([section, list]) => (
            <View key={section} style={styles.section}>
              <Text style={styles.sectionTitle}>{section}</Text>
              <ProductGrid products={list} />
            </View>
          ))
        )}
      </ScrollView>

      {cartCount > 0 && (
        <Pressable style={styles.cartBar} onPress={() => router.push('/cart')}>
          <Text style={styles.cartBarText}>
            View cart · {cartCount} item{cartCount > 1 ? 's' : ''}
          </Text>
          <Text style={styles.cartBarText}>${cartSubtotal.toFixed(2)}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 16, paddingBottom: 96 },
  hero: { borderRadius: Radius.lg, padding: 18, marginBottom: 16 },
  heroName: { fontFamily: Fonts.display, fontSize: 26, color: '#fff', letterSpacing: 0.4 },
  heroBlurb: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2, fontWeight: '600' },
  section: { marginBottom: 10 },
  sectionTitle: { fontFamily: Fonts.display, fontSize: 19, color: Colors.text, marginBottom: 10, letterSpacing: 0.3 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  cartBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cartBarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
