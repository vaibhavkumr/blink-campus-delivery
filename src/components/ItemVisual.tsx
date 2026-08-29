import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FoodArt } from '@/components/FoodArt';
import { ProductArt } from '@/components/ProductArt';
import { Colors, Radius } from '@/constants/theme';
import { API_BASE } from '@/lib/config';
import { Product } from '@/lib/types';

// Restaurant items (vendorId rc_*) are prepared food; packaged goods are not.
export function isRestaurantItem(p: Pick<Product, 'vendorId'>) {
  return !!p.vendorId && p.vendorId.startsWith('rc_');
}

// One visual for any catalog item:
//   • packaged goods  → branded ProductArt package
//   • restaurant food → representative photo if one exists (labeled
//     "Representative" for honesty), else an illustrated FoodArt stand-in.
export function ItemVisual({ product, size = 72 }: { product: Product; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (!isRestaurantItem(product)) {
    return <ProductArt id={product.id} name={product.name} category={product.category} size={size} />;
  }

  const uri = product.image ? `${API_BASE}${product.image}` : null;
  if (uri && !failed) {
    return (
      <View style={{ width: size, height: size }}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size * 0.16 }}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
        />
        <View style={styles.repTag}>
          <Text style={styles.repText}>Representative</Text>
        </View>
      </View>
    );
  }
  return <FoodArt id={product.id} name={product.name} size={size} />;
}

const styles = StyleSheet.create({
  repTag: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    backgroundColor: 'rgba(26,20,19,0.6)',
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  repText: { color: '#fff', fontSize: 8, fontWeight: '700' },
});
