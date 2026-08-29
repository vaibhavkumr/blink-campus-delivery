import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Colors } from '@/constants/theme';
import { API_BASE } from '@/lib/config';

// Renders the product photo when available, with a clean neutral placeholder
// (no emoji) when there's no image or it fails to load.
export function ProductImage({
  image,
  size = 56,
}: {
  image: string | null;
  emoji?: string; // accepted for backward-compat, no longer rendered
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const uri = image ? `${API_BASE}${image}` : null;

  if (!uri || failed) {
    return (
      <View style={[styles.placeholder, { width: size, height: size }]}>
        <Icon name="bag" size={size * 0.5} color={Colors.tintDeep} strokeWidth={1.6} />
      </View>
    );
  }
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image
        source={{ uri }}
        style={{ width: size, height: size }}
        contentFit="contain"
        transition={150}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
