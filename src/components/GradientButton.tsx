import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Icon, IconName } from '@/components/Icon';
import { Gradients, Radius, Shadow } from '@/constants/theme';

// The app's signature call-to-action: a warm maroon gradient pill with a soft
// brand-tinted shadow and a gentle spring on press.
export function GradientButton({
  label,
  onPress,
  disabled,
  icon,
  size = 'lg',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
  size?: 'lg' | 'md';
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => (scale.value = withSpring(0.96, { damping: 15, stiffness: 320 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 12, stiffness: 280 }))}
      style={disabled && styles.disabled}
    >
      <Animated.View style={[styles.wrap, Shadow.brand, animStyle]}>
        <LinearGradient
          colors={Gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.grad, size === 'md' ? styles.gradMd : styles.gradLg]}
        >
          <View style={styles.inner}>
            <Text style={[styles.label, size === 'md' && styles.labelMd]}>{label}</Text>
            {icon && <Icon name={icon} size={size === 'md' ? 16 : 18} color="#fff" strokeWidth={2.4} />}
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.pill },
  grad: { borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  gradLg: { paddingVertical: 17, paddingHorizontal: 24 },
  gradMd: { paddingVertical: 12, paddingHorizontal: 18 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  labelMd: { fontSize: 14 },
  disabled: { opacity: 0.5 },
});
