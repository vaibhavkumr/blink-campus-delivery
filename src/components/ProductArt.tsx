import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { View } from 'react-native';

// ── High-quality, license-free product art ───────────────────────────────
// Every catalog item renders as a clean branded "package" (bag / can / bottle
// / box) in its brand color, with a soft gradient, a gloss highlight, a drop
// shadow, and a wrap-around label. Vector, so it stays crisp at any size and
// looks cohesive across the whole app.

type Shape = 'bag' | 'can' | 'bottle' | 'box';

const ART: Record<string, { shape: Shape; color: string; label: string }> = {
  s01: { shape: 'box', color: '#C8102E', label: 'Club' },
  s02: { shape: 'bag', color: '#E23B2E', label: 'Cheetos' },
  s03: { shape: 'bag', color: '#C8341F', label: 'Munchies' },
  s04: { shape: 'box', color: '#E38B1A', label: 'Cheez-It' },
  s05: { shape: 'box', color: '#C8102E', label: 'Cheez-It' },
  s06: { shape: 'bag', color: '#A83226', label: 'Ruffles' },
  s07: { shape: 'bag', color: '#33306B', label: 'Smartfood' },
  s08: { shape: 'bag', color: '#B31217', label: 'Doritos' },
  s09: { shape: 'bag', color: '#A0181C', label: 'Slim Jim' },
  s10: { shape: 'bag', color: '#C8102E', label: 'Doritos' },
  s11: { shape: 'bag', color: '#F2C200', label: "Lay's" },
  s12: { shape: 'bag', color: '#6A1B9A', label: 'Takis' },
  w01: { shape: 'box', color: '#1E63B0', label: 'Oreo' },
  w02: { shape: 'box', color: '#E8720C', label: "Reese's" },
  w03: { shape: 'bag', color: '#E64A9B', label: 'Sour Patch' },
  w04: { shape: 'bag', color: '#B8321A', label: "M&M's" },
  w05: { shape: 'box', color: '#E23B7A', label: 'Pop-Tarts' },
  d01: { shape: 'bottle', color: '#C8102E', label: 'Coca-Cola' },
  d02: { shape: 'bottle', color: '#2E9E4A', label: 'Sprite' },
  d03: { shape: 'bottle', color: '#2196C4', label: 'Gatorade' },
  d04: { shape: 'bottle', color: '#2E7DB0', label: 'Dasani' },
  d05: { shape: 'can', color: '#1E9E5A', label: 'Arizona' },
  d06: { shape: 'bottle', color: '#F2B90F', label: 'Lemonade' },
  e01: { shape: 'can', color: '#1B3A8F', label: 'Red Bull' },
  e02: { shape: 'can', color: '#1F1F1F', label: 'Monster' },
  e03: { shape: 'can', color: '#2AA5D6', label: 'Celsius' },
  e04: { shape: 'can', color: '#E85B9E', label: 'Alani Nu' },
  x01: { shape: 'box', color: '#C8102E', label: 'Advil' },
  x02: { shape: 'box', color: '#3A3A3A', label: 'Charger' },
  x03: { shape: 'box', color: '#1E88C4', label: 'Toothpaste' },
  x04: { shape: 'box', color: '#6AB0E0', label: 'Towels' },
};

const CATEGORY_FALLBACK: Record<string, { shape: Shape; color: string }> = {
  'Salty Snacks': { shape: 'bag', color: '#C8102E' },
  Sweet: { shape: 'box', color: '#E23B7A' },
  Drinks: { shape: 'bottle', color: '#2196C4' },
  Energy: { shape: 'can', color: '#1B3A8F' },
  Essentials: { shape: 'box', color: '#3A3A3A' },
};

const PALETTE = ['#C8102E', '#E38B1A', '#1E63B0', '#2E9E4A', '#6A1B9A', '#E64A9B', '#2196C4'];

function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function shift(hex: string, amt: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const to = (c: number) => clamp(c + amt).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
function hashIndex(s: string, mod: number) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

export function ProductArt({
  id,
  name,
  category,
  size = 72,
}: {
  id: string;
  name: string;
  category?: string;
  size?: number;
}) {
  const spec =
    ART[id] ??
    (() => {
      const cf = (category && CATEGORY_FALLBACK[category]) || { shape: 'bag' as Shape, color: PALETTE[hashIndex(name, PALETTE.length)] };
      return { ...cf, label: name.split(' ')[0] };
    })();

  const { shape, color, label } = spec;
  const gid = `pa_${id}_${shape}`;
  const light = shift(color, 34);
  const dark = shift(color, -30);
  const ink = '#2A2320';

  // Auto-size the label to fit the wrap-around band.
  const len = label.length;
  const fontSize = len <= 6 ? 14 : len <= 9 ? 11.5 : 9.5;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={light} />
            <Stop offset="0.5" stopColor={color} />
            <Stop offset="1" stopColor={dark} />
          </LinearGradient>
        </Defs>

        {/* contact shadow */}
        <Ellipse cx="60" cy="111" rx="30" ry="5" fill="#3A2418" opacity={0.14} />

        {shape === 'bag' && (
          <>
            <Rect x="34" y="16" width="52" height="90" rx="9" fill={`url(#${gid})`} />
            <Rect x="34" y="16" width="52" height="9" rx="4" fill={light} />
            <Rect x="34" y="97" width="52" height="9" rx="4" fill={dark} />
            <Rect x="41" y="30" width="6" height="60" rx="3" fill="#FFFFFF" opacity={0.16} />
            <LabelBand y={52} x={27} w={66} fontSize={fontSize} label={label} ink={ink} />
          </>
        )}

        {shape === 'can' && (
          <>
            <Rect x="38" y="18" width="44" height="88" rx="13" fill={`url(#${gid})`} />
            <Ellipse cx="60" cy="104" rx="22" ry="4" fill={dark} />
            <Ellipse cx="60" cy="20" rx="22" ry="5" fill={light} />
            <Ellipse cx="60" cy="19" rx="16" ry="3" fill={shift(color, 50)} />
            <Rect x="44" y="30" width="5" height="62" rx="2.5" fill="#FFFFFF" opacity={0.2} />
            <LabelBand y={54} x={30} w={60} fontSize={fontSize} label={label} ink={ink} />
          </>
        )}

        {shape === 'bottle' && (
          <>
            <Rect x="51" y="11" width="18" height="13" rx="3" fill={dark} />
            <Path d="M50 30 L70 30 L77 45 L43 45 Z" fill={color} />
            <Rect x="43" y="43" width="34" height="65" rx="14" fill={`url(#${gid})`} />
            <Rect x="49" y="52" width="5" height="46" rx="2.5" fill="#FFFFFF" opacity={0.16} />
            <LabelBand y={60} x={30} w={60} fontSize={fontSize} label={label} ink={ink} />
          </>
        )}

        {shape === 'box' && (
          <>
            <Path d="M40 34 L48 26 L88 26 L80 34 Z" fill={light} />
            <Path d="M80 34 L88 26 L88 98 L80 106 Z" fill={dark} />
            <Rect x="40" y="34" width="40" height="72" rx="4" fill={`url(#${gid})`} />
            <Rect x="45" y="42" width="5" height="56" rx="2.5" fill="#FFFFFF" opacity={0.14} />
            <LabelBand y={56} x={42} w={36} cx={60} fontSize={Math.min(fontSize, 11)} label={label} ink={ink} />
          </>
        )}
      </Svg>
    </View>
  );
}

function LabelBand({
  y,
  x,
  w,
  cx = 60,
  fontSize,
  label,
  ink,
}: {
  y: number;
  x: number;
  w: number;
  cx?: number;
  fontSize: number;
  label: string;
  ink: string;
}) {
  return (
    <>
      <Rect x={x} y={y} width={w} height={20} rx={5} fill="#FFFFFF" opacity={0.95} />
      <SvgText
        x={cx}
        y={y + 14}
        fontSize={fontSize}
        fontWeight="800"
        fill={ink}
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </>
  );
}
