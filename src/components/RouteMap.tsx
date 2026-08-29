import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { api, RouteResult } from '@/lib/api';
import { Colors, Radius } from '@/constants/theme';

// Draws the real fastest-route geometry (from OSRM) as a mini map: store →
// drop-off, with the courier's position interpolated along the line by the
// order's driveProgress.
export function RouteMap({
  orderId,
  progress,
}: {
  orderId: string;
  progress: number;
}) {
  const [route, setRoute] = useState<RouteResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .orderRoute(orderId)
      .then((r) => !cancelled && setRoute(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const W = 320;
  const H = 150;
  const pad = 18;

  if (!route || route.coordinates.length < 2) {
    return (
      <View style={[styles.wrap, styles.loading]}>
        <Text style={styles.loadingText}>Loading route…</Text>
      </View>
    );
  }

  const xs = route.coordinates.map((c) => c[0]);
  const ys = route.coordinates.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-6;
  const spanY = maxY - minY || 1e-6;
  // Fit while preserving aspect; flip Y (screen y grows downward).
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const project = (lng: number, lat: number): [number, number] => [
    offX + (lng - minX) * scale,
    H - (offY + (lat - minY) * scale),
  ];

  const pts = route.coordinates.map((c) => project(c[0], c[1]));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const start = pts[0];
  const end = pts[pts.length - 1];
  const idx = Math.min(pts.length - 1, Math.max(0, Math.round(progress * (pts.length - 1))));
  const courier = pts[idx];

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={0} width={W} height={H} rx={16} fill="#F0EAE0" />
        <Path d={d} stroke={Colors.primary} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={start[0]} cy={start[1]} r={7} fill={Colors.text} />
        <Circle cx={end[0]} cy={end[1]} r={7} fill={Colors.primary} />
        <Circle cx={courier[0]} cy={courier[1]} r={8} fill="#fff" stroke={Colors.primary} strokeWidth={3} />
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.text }]} />
          <Text style={styles.legendText}>Store</Text>
        </View>
        <Text style={styles.legendMeta}>
          {route.distanceKm} km · ~{route.durationMin} min{route.source === 'osrm' ? ' · fastest route' : ''}
        </Text>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={styles.legendText}>You</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loading: { height: 150, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textMuted },
  legend: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  legendMeta: { fontSize: 11, color: Colors.textMuted },
});
