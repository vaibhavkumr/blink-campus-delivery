import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Icon } from '@/components/Icon';
import { ItemCustomizer, needsCustomizer } from '@/components/ItemCustomizer';
import { ItemVisual } from '@/components/ItemVisual';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useApp } from '@/lib/store';
import { Product } from '@/lib/types';

// A self-contained 2-column product grid: image, name, price, add/stepper.
// One choice → quick picker; multiple / multi-select → full build-your-own.
export function ProductGrid({ products }: { products: Product[] }) {
  const { cart, setQty } = useApp();
  const [modProduct, setModProduct] = useState<Product | null>(null);
  const [custProduct, setCustProduct] = useState<Product | null>(null);

  const qtyOf = (id: string) => cart.filter((i) => i.productId === id).reduce((s, i) => s + i.qty, 0);
  const plainQty = (id: string) => cart.find((i) => i.productId === id && i.modifier === '')?.qty ?? 0;
  const addLine = (id: string, modifier: string) => {
    const existing = cart.find((i) => i.productId === id && i.modifier === modifier)?.qty ?? 0;
    setQty(id, existing + 1, modifier);
  };

  const onAdd = (p: Product) => {
    if (p.modifiers.length === 0) setQty(p.id, plainQty(p.id) + 1);
    else if (needsCustomizer(p)) setCustProduct(p);
    else setModProduct(p);
  };
  const chooseModifier = (label: string) => {
    if (!modProduct) return;
    addLine(modProduct.id, label);
    setModProduct(null);
  };

  return (
    <View style={styles.grid}>
      {products.map((item, i) => {
        const qty = qtyOf(item.id);
        const hasMods = item.modifiers.length > 0;
        return (
          <Animated.View
            key={item.id}
            entering={FadeInDown.duration(260).delay(Math.min(i, 8) * 32)}
            style={[styles.card, Shadow.sm, !item.inStock && styles.cardOut]}
          >
            <View style={styles.imageBox}>
              <ItemVisual product={item} size={82} />
              {!item.inStock && (
                <View style={styles.outBadge}>
                  <Text style={styles.outBadgeText}>Out</Text>
                </View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.bottom}>
              <Text style={styles.price}>${item.price.toFixed(2)}</Text>
              {!item.inStock ? null : hasMods || qty === 0 ? (
                <Pressable
                  style={({ pressed }) => [styles.add, Shadow.brand, pressed && styles.addPressed]}
                  onPress={() => onAdd(item)}
                  accessibilityLabel={`Add ${item.name}`}
                >
                  {qty > 0 ? (
                    <Text style={styles.addQty}>{qty}</Text>
                  ) : (
                    <Icon name="plus" size={20} color="#fff" strokeWidth={2.6} />
                  )}
                </Pressable>
              ) : (
                <View style={styles.stepper}>
                  <Pressable style={styles.stepBtn} onPress={() => setQty(item.id, qty - 1)}>
                    <Icon name="minus" size={15} color={Colors.primary} strokeWidth={2.4} />
                  </Pressable>
                  <Text style={styles.stepQty}>{qty}</Text>
                  <Pressable style={styles.stepBtn} onPress={() => setQty(item.id, qty + 1)}>
                    <Icon name="plus" size={15} color={Colors.primary} strokeWidth={2.4} />
                  </Pressable>
                </View>
              )}
            </View>
          </Animated.View>
        );
      })}

      <Modal visible={!!modProduct} transparent animationType="slide" onRequestClose={() => setModProduct(null)}>
        <Pressable style={styles.backdrop} onPress={() => setModProduct(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{modProduct?.name}</Text>
            {modProduct?.modifiers[0] && (
              <>
                <Text style={styles.sheetGroup}>
                  {modProduct.modifiers[0].name}
                  {modProduct.modifiers[0].required ? ' · required' : ''}
                </Text>
                {modProduct.modifiers[0].options.map((opt) => (
                  <Pressable key={opt.label} style={styles.option} onPress={() => chooseModifier(opt.label)}>
                    <Text style={styles.optionText}>{opt.label}</Text>
                    <Icon name="plus-circle" size={22} color={Colors.primary} />
                  </Pressable>
                ))}
              </>
            )}
            <Pressable style={styles.cancel} onPress={() => setModProduct(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ItemCustomizer
        product={custProduct}
        onClose={() => setCustProduct(null)}
        onAdd={(modifier) => {
          if (custProduct) addLine(custProduct.id, modifier);
          setCustProduct(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47.6%',
    flexGrow: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 12,
  },
  cardOut: { opacity: 0.6 },
  imageBox: {
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: Colors.bgWarm,
    borderRadius: Radius.md,
  },
  outBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: Colors.text, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  outBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  name: { fontSize: 14, fontWeight: '600', color: Colors.text, minHeight: 38, lineHeight: 18 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  price: { fontSize: 16, fontWeight: '900', color: Colors.text, letterSpacing: 0.2 },
  add: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPressed: { transform: [{ scale: 0.9 }] },
  addQty: { color: '#fff', fontWeight: '900', fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.tint, borderRadius: Radius.pill, padding: 3 },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.xs,
  },
  stepQty: { fontSize: 14, fontWeight: '800', color: Colors.text, minWidth: 16, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: 20,
    gap: 8,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  sheetGroup: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', marginTop: 4 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionText: { fontSize: 15, color: Colors.text, fontWeight: '600' },
  cancel: { padding: 14, alignItems: 'center', marginTop: 4 },
  cancelText: { color: Colors.textMuted, fontWeight: '600' },
});
