import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Icon } from '@/components/Icon';
import { ProductArt } from '@/components/ProductArt';
import { ProductGrid } from '@/components/ProductGrid';
import { Colors, Fonts, Gradients, Radius, Shadow } from '@/constants/theme';
import { RESTAURANTS } from '@/lib/restaurants';
import { useApp } from '@/lib/store';

export default function ShopScreen() {
  const router = useRouter();
  const { session, products, categories, bundles, stats, cartCount, cartSubtotal, addBundle, unreadCount } =
    useApp();
  const [search, setSearch] = useState('');
  const searching = search.trim().length > 0;

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : [];
  }, [products, search]);

  // A representative product for each category tile's art.
  const catProduct = (key: string) =>
    products.find((p) => p.category === key && p.inStock) ??
    products.find((p) => p.category === key) ??
    null;

  const credit = session?.credit ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/rewards')}
          hitSlop={8}
          accessibilityLabel="Account"
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconPressed]}
        >
          <Icon name="person" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.brand}>
          BLIN<Text style={{ color: Colors.primary }}>K</Text>
        </Text>
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => router.push('/notifications')}
            hitSlop={8}
            accessibilityLabel="Notifications"
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconPressed]}
          >
            <Icon name="bell" size={21} color={Colors.text} />
            {unreadCount > 0 && <View style={styles.dot} />}
          </Pressable>
          <Pressable
            onPress={() => router.push('/cart')}
            hitSlop={8}
            accessibilityLabel="Cart"
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconPressed]}
          >
            <Icon name="bag" size={21} color={Colors.text} />
            {cartCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Search + delivery estimate */}
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Icon name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search snacks, drinks, essentials"
            placeholderTextColor={Colors.textSoft}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <View style={styles.eta}>
          <Icon name="clock" size={14} color={Colors.primary} strokeWidth={2.4} />
          <Text style={styles.etaText}>10 min</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {searching ? (
          results.length > 0 ? (
            <ProductGrid products={results} />
          ) : (
            <Text style={styles.empty}>No items match “{search.trim()}”.</Text>
          )
        ) : (
          <>
            {/* Referral banner */}
            <Pressable
              onPress={() => router.push('/rewards')}
              style={({ pressed }) => [styles.referralWrap, Shadow.brand, pressed && styles.cardPressed]}
            >
              <LinearGradient
                colors={Gradients.brandDiagonal}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.referral}
              >
                <View style={styles.refGlow} />
                <View style={styles.refStats}>
                  <View style={styles.refStat}>
                    <Text style={styles.refNum}>${credit.toFixed(0)}</Text>
                    <Text style={styles.refLabel}>Your credit</Text>
                  </View>
                  <View style={styles.refDivider} />
                  <View style={styles.refStat}>
                    <Text style={styles.refNum}>$5</Text>
                    <Text style={styles.refLabel}>Per referral</Text>
                  </View>
                </View>
                <View style={styles.refCta}>
                  <Text style={styles.refCtaText}>Refer a friend — you both get $5</Text>
                  <View style={styles.refArrow}>
                    <Icon name="arrow" size={16} color={Colors.primary} strokeWidth={2.6} />
                  </View>
                </View>
              </LinearGradient>
            </Pressable>

            {/* Floor order entry */}
            <Pressable
              style={({ pressed }) => [styles.floor, Shadow.xs, pressed && styles.cardPressed]}
              onPress={() => router.push('/group')}
            >
              <View style={styles.floorIcon}>
                <Icon name="people" size={19} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.floorText}>Order together with your floor</Text>
                <Text style={styles.floorSub}>Split one cart, hit $15, delivery’s free</Text>
              </View>
              <Icon name="chevron" size={18} color={Colors.textMuted} />
            </Pressable>

            {stats && stats.ordersThisWeek > 0 && (
              <View style={styles.proofRow}>
                <View style={styles.liveDot} />
                <Text style={styles.proof}>
                  {stats.ordersThisWeek} order{stats.ordersThisWeek === 1 ? '' : 's'} on campus this week
                  {stats.leaderboard[0] ? ` · ${stats.leaderboard[0].building} leading` : ''}
                </Text>
              </View>
            )}

            {/* Restaurants near you */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Restaurants near you</Text>
              <Text style={styles.sectionKicker}>Hot food, delivered to your dorm</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
              {RESTAURANTS.map((r) => (
                <Pressable
                  key={r.id}
                  style={({ pressed }) => [styles.resto, Shadow.sm, pressed && styles.cardPressed]}
                  onPress={() => router.push({ pathname: '/vendor/[id]', params: { id: r.id } })}
                >
                  <View style={[styles.restoTop, { backgroundColor: r.color }]}>
                    <Text style={styles.restoName} numberOfLines={1}>{r.name}</Text>
                  </View>
                  <View style={styles.restoBody}>
                    <Text style={styles.restoBlurb} numberOfLines={1}>{r.blurb}</Text>
                    <View style={styles.restoCta}>
                      <Text style={styles.restoCtaText}>Order</Text>
                      <Icon name="arrow" size={13} color={Colors.primary} strokeWidth={2.4} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            {/* Campus Favorites (bundles) */}
            {bundles.length > 0 && (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Campus favorites</Text>
                  <Text style={styles.sectionKicker}>Tap to add the whole bundle</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
                  {bundles.map((b) => (
                    <Pressable
                      key={b.id}
                      style={({ pressed }) => [styles.bundle, Shadow.sm, pressed && styles.cardPressed]}
                      onPress={() => addBundle(b)}
                    >
                      <Text style={styles.bundleName} numberOfLines={1}>{b.name}</Text>
                      <Text style={styles.bundleItems} numberOfLines={2}>
                        {b.items.map((i) => i.name.split(' ')[0]).join(' · ')}
                      </Text>
                      <View style={styles.bundleAdd}>
                        <Icon name="plus" size={13} color="#fff" strokeWidth={2.6} />
                        <Text style={styles.bundleAddText}>Add all · ${b.total.toFixed(2)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Category grid */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Shop by category</Text>
            </View>
            <View style={styles.catGrid}>
              {categories.map((c) => (
                <Pressable
                  key={c.key}
                  style={({ pressed }) => [styles.catTile, Shadow.sm, pressed && styles.cardPressed]}
                  onPress={() => router.push({ pathname: '/category/[key]', params: { key: c.key } })}
                >
                  <View style={styles.catImageBlob}>
                    {(() => {
                      const p = catProduct(c.key);
                      return p ? <ProductArt id={p.id} name={p.name} category={p.category} size={66} /> : null;
                    })()}
                  </View>
                  <Text style={styles.catName}>{c.key}</Text>
                  <View style={styles.catGo}>
                    <Icon name="arrow" size={14} color={Colors.primary} strokeWidth={2.4} />
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {cartCount > 0 && (
        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(180)}
          exiting={SlideOutDown.duration(200)}
          style={[styles.cartBarWrap, Shadow.brand]}
        >
          <Pressable
            style={({ pressed }) => pressed && styles.cardPressed}
            onPress={() => router.push('/cart')}
          >
            <LinearGradient
              colors={Gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cartBar}
            >
              <View style={styles.cartBarLeft}>
                <Animated.View key={cartCount} entering={FadeIn.duration(200)} style={styles.cartBarCount}>
                  <Text style={styles.cartBarCountText}>{cartCount}</Text>
                </Animated.View>
                <Text style={styles.cartBarText}>View cart</Text>
              </View>
              <Text style={styles.cartBarText}>${cartSubtotal.toFixed(2)}</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    ...Shadow.xs,
  },
  iconPressed: { transform: [{ scale: 0.92 }] },
  brand: { fontFamily: Fonts.display, fontSize: 28, color: Colors.text, letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, borderWidth: 1.5, borderColor: Colors.card },
  badge: {
    position: 'absolute',
    top: 4,
    right: 3,
    backgroundColor: Colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.card,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: Colors.card,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Shadow.sm,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text, padding: 0 },
  eta: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    backgroundColor: Colors.tint,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  etaText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  scroll: { padding: 16, paddingTop: 4, paddingBottom: 110, gap: 4 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },

  referralWrap: { borderRadius: Radius.lg, marginBottom: 14 },
  referral: { borderRadius: Radius.lg, padding: 18, overflow: 'hidden' },
  refGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  refStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  refStat: { alignItems: 'flex-start', paddingRight: 22 },
  refNum: { color: '#fff', fontWeight: '900', fontSize: 26, letterSpacing: 0.3 },
  refLabel: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '700', marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  refDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.28)', marginRight: 22 },
  refCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)', paddingTop: 13 },
  refCtaText: { color: '#fff', fontWeight: '700', fontSize: 13.5, flex: 1 },
  refArrow: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  floor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: 13,
    marginBottom: 14,
  },
  floorIcon: { width: 38, height: 38, borderRadius: Radius.pill, backgroundColor: Colors.tint, alignItems: 'center', justifyContent: 'center' },
  floorText: { color: Colors.text, fontWeight: '800', fontSize: 14.5 },
  floorSub: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },

  proofRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  proof: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },

  sectionHead: { marginTop: 8, marginBottom: 12 },
  sectionTitle: { fontFamily: Fonts.display, fontSize: 22, color: Colors.text, letterSpacing: 0.4 },
  sectionKicker: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },

  shelf: { gap: 12, paddingBottom: 6, paddingRight: 8 },
  bundle: {
    width: 158,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 15,
  },
  bundleName: { fontWeight: '800', color: Colors.text, fontSize: 15.5 },
  bundleItems: { color: Colors.textMuted, fontSize: 11.5, marginTop: 4, minHeight: 30, lineHeight: 15 },
  bundleAdd: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: 9,
  },
  bundleAddText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  resto: {
    width: 172,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  restoTop: { height: 64, justifyContent: 'flex-end', padding: 12 },
  restoName: { fontFamily: Fonts.display, fontSize: 18, color: '#fff', letterSpacing: 0.3 },
  restoBody: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restoBlurb: { color: Colors.textMuted, fontSize: 11.5, flex: 1, marginRight: 6 },
  restoCta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  restoCtaText: { color: Colors.primary, fontWeight: '800', fontSize: 12 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catTile: {
    width: '47.4%',
    flexGrow: 1,
    minHeight: 148,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  catImageBlob: {
    width: 84,
    height: 84,
    borderRadius: Radius.md,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  catName: { fontFamily: Fonts.display, fontSize: 18, color: Colors.text, letterSpacing: 0.3, maxWidth: '82%' },
  catGo: { position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.tint, alignItems: 'center', justifyContent: 'center' },

  cartBarWrap: { position: 'absolute', left: 16, right: 16, bottom: 18, borderRadius: Radius.lg },
  cartBar: {
    borderRadius: Radius.lg,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cartBarCount: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  cartBarCountText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  cartBarText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.96 },
});
