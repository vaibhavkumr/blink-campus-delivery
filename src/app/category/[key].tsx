import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProductGrid } from '@/components/ProductGrid';
import { Colors, Radius } from '@/constants/theme';
import { useApp } from '@/lib/store';

export default function CategoryScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const { products, cartCount, cartSubtotal } = useApp();
  const category = decodeURIComponent(key ?? '');

  const items = useMemo(
    () => products.filter((p) => p.category === category),
    [products, category]
  );

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ title: category }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <Text style={styles.empty}>Nothing here yet.</Text>
        ) : (
          <ProductGrid products={items} />
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
