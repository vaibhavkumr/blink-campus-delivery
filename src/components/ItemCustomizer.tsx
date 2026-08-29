import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { ModifierGroup, Product } from '@/lib/types';

// An item needs the full builder when it has more than one choice group or any
// multi-select group; single-group items use the quick picker instead.
export function needsCustomizer(p: Product) {
  return p.modifiers.length > 1 || p.modifiers.some((g) => (g.max ?? 1) > 1);
}

const maxOf = (g: { max?: number }) => g.max ?? 1;

// Parse a saved "Label · Label · …" modifier back into per-group selections.
// Each part goes to the first group that offers it and still has room — which
// correctly re-fills duplicate groups like Panda's Entrée 1 / Entrée 2.
function prefill(groups: ModifierGroup[], modifier: string): string[][] {
  const sel = groups.map(() => [] as string[]);
  if (!modifier) return sel;
  for (const part of modifier.split(' · ').map((s) => s.trim()).filter(Boolean)) {
    for (let gi = 0; gi < groups.length; gi++) {
      if (sel[gi].length >= maxOf(groups[gi]) || sel[gi].includes(part)) continue;
      if (groups[gi].options.some((o) => o.label === part)) {
        sel[gi].push(part);
        break;
      }
    }
  }
  return sel;
}

export function ItemCustomizer({
  product,
  initial,
  editing,
  onClose,
  onAdd,
}: {
  product: Product | null;
  initial?: string; // existing selection when editing a cart line
  editing?: boolean;
  onClose: () => void;
  onAdd: (modifier: string) => void;
}) {
  // selections[groupIndex] = array of chosen option labels
  const [sel, setSel] = useState<string[][]>([]);

  const groups = product?.modifiers ?? [];
  const key = product?.id ?? '';
  // (Re)seed selections whenever a new product / line opens.
  useEffect(() => {
    setSel(prefill(groups, initial ?? ''));
  }, [key, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!product) return null;

  const toggle = (gi: number, label: string) => {
    setSel((prev) => {
      const next = prev.map((a) => [...a]);
      const cur = next[gi] ?? [];
      const max = maxOf(groups[gi]);
      if (max <= 1) {
        next[gi] = cur[0] === label ? [] : [label]; // radio (tap again to clear if optional)
      } else if (cur.includes(label)) {
        next[gi] = cur.filter((l) => l !== label); // uncheck
      } else if (cur.length < max) {
        next[gi] = [...cur, label]; // check (respect max)
      }
      return next;
    });
  };

  const deltaCents = groups.reduce((sum, g, gi) => {
    for (const label of sel[gi] ?? []) {
      const opt = g.options.find((o) => o.label === label);
      if (opt) sum += opt.priceDelta;
    }
    return sum;
  }, 0);
  const total = product.price + deltaCents / 100;

  const missing = groups.filter((g, gi) => g.required >= 1 && (sel[gi]?.length ?? 0) === 0);
  const valid = missing.length === 0;

  const confirm = () => {
    if (!valid) return;
    // Group order preserved; multi-select contributes each chosen label.
    const modifier = groups.flatMap((g, gi) => sel[gi] ?? []).join(' · ');
    onAdd(modifier);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grab} />
          <Text style={styles.title}>{product.name}</Text>
          <Text style={styles.subtitle}>{editing ? 'Edit your order' : 'Build it your way'}</Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {groups.map((g, gi) => {
              const max = maxOf(g);
              const chosen = sel[gi] ?? [];
              const isMissing = g.required >= 1 && chosen.length === 0;
              return (
                <View key={g.name} style={styles.group}>
                  <View style={styles.groupHead}>
                    <Text style={styles.groupName}>{g.name}</Text>
                    <Text style={[styles.groupHint, isMissing && styles.groupHintReq]}>
                      {max > 1 ? `Pick up to ${max}` : g.required >= 1 ? 'Required' : 'Optional'}
                    </Text>
                  </View>
                  {g.options.map((o) => {
                    const on = chosen.includes(o.label);
                    const multi = max > 1;
                    return (
                      <Pressable key={o.label} style={styles.option} onPress={() => toggle(gi, o.label)}>
                        <View
                          style={[
                            multi ? styles.box : styles.radio,
                            on && (multi ? styles.boxOn : styles.radioOn),
                          ]}
                        >
                          {on &&
                            (multi ? (
                              <Icon name="check" size={12} color="#fff" strokeWidth={3} />
                            ) : (
                              <View style={styles.radioDot} />
                            ))}
                        </View>
                        <Text style={styles.optionLabel}>{o.label}</Text>
                        {o.priceDelta > 0 && (
                          <Text style={styles.optionPrice}>+${(o.priceDelta / 100).toFixed(2)}</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
            <View style={{ height: 12 }} />
          </ScrollView>

          <Pressable
            style={[styles.add, Shadow.brand, !valid && styles.addDisabled]}
            onPress={confirm}
            disabled={!valid}
          >
            <Text style={styles.addText}>
              {!valid
                ? `Choose ${missing[0].name.toLowerCase()}`
                : `${editing ? 'Update' : 'Add to cart'} · $${total.toFixed(2)}`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  backdropTap: { flex: 1 },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: '86%',
  },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, marginBottom: 12 },
  title: { fontSize: 21, fontWeight: '900', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },
  scroll: { flexGrow: 0 },
  group: { marginTop: 16 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  groupName: { fontSize: 16, fontWeight: '800', color: Colors.text },
  groupHint: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  groupHintReq: { color: Colors.primary },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    ...Shadow.xs,
  },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.primary },
  box: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optionLabel: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '600' },
  optionPrice: { fontSize: 13, color: Colors.primary, fontWeight: '800' },
  add: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  addDisabled: { backgroundColor: Colors.textMuted },
  addText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
