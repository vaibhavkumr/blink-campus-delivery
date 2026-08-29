import { View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// Illustrated, license-free food stand-ins for restaurant menu items — shown
// until a representative photo is dropped into server/public/menu/<id>.jpg.
// Clearly stylized (not a photo), so it never implies a specific restaurant's
// actual plating. Vector, so it stays crisp at any size.

type Kind =
  | 'tenders' | 'fries' | 'sandwich' | 'drink' | 'bowl'
  | 'noodles' | 'burrito' | 'tacos' | 'chips' | 'generic';

// id -> dish kind. Unmapped ids fall back to a keyword guess, then 'generic'.
const MAP: Record<string, Kind> = {
  cn1: 'tenders', cn2: 'tenders', cn3: 'tenders', cn4: 'sandwich', cn5: 'fries',
  cn6: 'drink', cn7: 'generic', cn8: 'drink', cn9: 'drink',
  ab1: 'sandwich', ab2: 'sandwich', ab3: 'sandwich', ab4: 'sandwich', ab5: 'fries',
  ab6: 'tenders', ab7: 'drink', ab8: 'drink',
  pd1: 'bowl', pd2: 'bowl', pd4: 'tenders', pd5: 'noodles', pd6: 'bowl',
  pd7: 'tenders', pd8: 'tenders', pd9: 'drink',
  cp1: 'burrito', cp2: 'bowl', cp3: 'tacos', cp4: 'burrito', cp5: 'chips',
  cp6: 'chips', cp7: 'drink',
};

function guess(name: string): Kind {
  const n = name.toLowerCase();
  if (/fries/.test(n)) return 'fries';
  if (/burrito|quesadilla|wrap/.test(n)) return 'burrito';
  if (/bowl|rice|plate/.test(n)) return 'bowl';
  if (/taco/.test(n)) return 'tacos';
  if (/chip|guac|queso/.test(n)) return 'chips';
  if (/noodle|chow|mein|lo /.test(n)) return 'noodles';
  if (/tea|lemonade|drink|shake|coke|cola|soda|water/.test(n)) return 'drink';
  if (/tender|finger|nugget|chicken|roll|rangoon|stick/.test(n)) return 'tenders';
  if (/sandwich|beef|burger|toast|bun/.test(n)) return 'sandwich';
  return 'generic';
}

function grad(id: string, from: string, to: string) {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor={from} />
      <Stop offset="1" stopColor={to} />
    </LinearGradient>
  );
}

export function FoodArt({ id, name, size = 72 }: { id: string; name: string; size?: number }) {
  const kind: Kind = MAP[id] ?? guess(name);
  const g = `fa_${id}`;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          {grad(`${g}_a`, '#F0C465', '#D99A2E')}
          {grad(`${g}_b`, '#B5673A', '#8A431F')}
          {grad(`${g}_c`, '#EFE7DA', '#D9Cdb8')}
        </Defs>
        <Ellipse cx="60" cy="103" rx="34" ry="6" fill="#3A2418" opacity={0.12} />

        {kind === 'tenders' && (
          <>
            <Ellipse cx="60" cy="78" rx="40" ry="12" fill="#F4EEE2" />
            {[[-24, 8], [-2, 0], [20, 6]].map(([dx, dy], i) => (
              <Rect key={i} x={48 + dx} y={38 + dy} width="20" height="42" rx="10"
                fill={`url(#${g}_a)`} transform={`rotate(${(i - 1) * 12} ${58 + dx} ${59 + dy})`} />
            ))}
          </>
        )}

        {kind === 'fries' && (
          <>
            {[-16, -6, 4, 14, 24].map((x, i) => (
              <Rect key={i} x={44 + x} y={28 + (i % 2) * 6} width="7" height="52" rx="3" fill={`url(#${g}_a)`} />
            ))}
            <Path d="M38 60 L82 60 L76 100 Q75 104 71 104 L49 104 Q45 104 44 100 Z" fill="#C8342B" />
            <Rect x="40" y="64" width="40" height="9" rx="2" fill="#fff" opacity={0.5} />
          </>
        )}

        {kind === 'sandwich' && (
          <>
            <Path d="M26 52 Q60 30 94 52 L94 56 L26 56 Z" fill={`url(#${g}_a)`} />
            <Rect x="26" y="55" width="68" height="9" fill="#7FB04A" />
            <Rect x="26" y="62" width="68" height="12" fill={`url(#${g}_b)`} />
            <Path d="M26 74 Q60 92 94 74 L94 70 L26 70 Z" fill="#E7B85C" />
          </>
        )}

        {kind === 'drink' && (
          <>
            <Rect x="66" y="24" width="5" height="26" rx="2" fill="#556" />
            <Path d="M42 44 L78 44 L73 100 Q72 104 68 104 L52 104 Q48 104 47 100 Z" fill={`url(#${g}_c)`} />
            <Path d="M44 52 L76 52 L74 70 L46 70 Z" fill="#C0392B" opacity={0.85} />
            <Rect x="40" y="40" width="40" height="7" rx="3" fill="#C0392B" />
          </>
        )}

        {kind === 'bowl' && (
          <>
            <Path d="M28 60 Q28 54 34 54 L86 54 Q92 54 92 60 Q92 92 60 92 Q28 92 28 60 Z" fill={`url(#${g}_c)`} />
            <Path d="M34 58 Q60 42 86 58 Q86 58 84 60 L36 60 Z" fill="#EAD9B0" />
            <Ellipse cx="52" cy="56" rx="9" ry="6" fill={`url(#${g}_a)`} />
            <Ellipse cx="70" cy="55" rx="8" ry="6" fill={`url(#${g}_b)`} />
            <Ellipse cx="60" cy="52" rx="7" ry="5" fill="#7FB04A" />
          </>
        )}

        {kind === 'noodles' && (
          <>
            <Path d="M30 58 Q30 52 36 52 L84 52 Q90 52 90 58 Q90 90 60 90 Q30 90 30 58 Z" fill={`url(#${g}_c)`} />
            {[0, 1, 2, 3].map((i) => (
              <Path key={i} d={`M38 ${56 + i * 6} Q60 ${48 + i * 6} 82 ${56 + i * 6}`} stroke="#E7C25C" strokeWidth="4" fill="none" strokeLinecap="round" />
            ))}
            <Ellipse cx="66" cy="58" rx="7" ry="5" fill="#7FB04A" />
          </>
        )}

        {kind === 'burrito' && (
          <>
            <Path d="M34 84 L84 40 Q90 34 96 40 Q102 46 96 52 L46 96 Q40 102 34 96 Q28 90 34 84 Z" fill="#E7CE97" />
            <Path d="M40 90 L86 46 Q88 44 90 46 L48 96 Q44 98 40 90 Z" fill="#D9BE7E" opacity={0.7} />
            <Path d="M34 84 Q30 88 33 94 Q39 97 42 92 Z" fill="#CFCFD6" />
          </>
        )}

        {kind === 'tacos' && (
          <>
            {[[-20, 6], [4, -2], [26, 6]].map(([dx, dy], i) => (
              <Path key={i} d={`M${34 + dx} ${86 + dy} Q${44 + dx} ${52 + dy} ${64 + dx} ${86 + dy} Z`} fill="#EBC978" transform="" />
            ))}
            {[[-20, 6], [4, -2], [26, 6]].map(([dx, dy], i) => (
              <Path key={'f' + i} d={`M${38 + dx} ${80 + dy} Q${49 + dx} ${64 + dy} ${60 + dx} ${80 + dy} Z`} fill="#A5522C" />
            ))}
          </>
        )}

        {kind === 'chips' && (
          <>
            {[[-22, 0], [-4, -6], [16, -2]].map(([dx, dy], i) => (
              <Path key={i} d={`M${50 + dx} ${44 + dy} L${66 + dx} ${44 + dy} L${58 + dx} ${64 + dy} Z`} fill={`url(#${g}_a)`} />
            ))}
            <Path d="M40 66 Q40 62 46 62 L82 62 Q88 62 88 66 Q88 92 64 92 Q40 92 40 66 Z" fill="#EFE7DA" />
            <Ellipse cx="64" cy="70" rx="20" ry="8" fill="#6FA03A" />
          </>
        )}

        {kind === 'generic' && (
          <>
            <Ellipse cx="60" cy="76" rx="38" ry="12" fill="#EFE7DA" />
            <Path d="M34 72 Q60 44 86 72 Z" fill={`url(#${g}_a)`} />
          </>
        )}
      </Svg>
    </View>
  );
}
