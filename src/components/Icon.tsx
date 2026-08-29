import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

// Minimal, dependency-light icon set (Feather-style, MIT paths) rendered via
// react-native-svg. Outline stroke icons that read clean and professional.
export type IconName =
  | 'person'
  | 'bag'
  | 'bell'
  | 'search'
  | 'clock'
  | 'plus'
  | 'minus'
  | 'chevron'
  | 'arrow'
  | 'people'
  | 'plus-circle'
  | 'check';

export function Icon({
  name,
  size = 24,
  color = '#000',
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'person' && (
        <>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...p} />
          <Circle cx="12" cy="7" r="4" {...p} />
        </>
      )}
      {name === 'bag' && (
        <>
          <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" {...p} />
          <Line x1="3" y1="6" x2="21" y2="6" {...p} />
          <Path d="M16 10a4 4 0 0 1-8 0" {...p} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...p} />
          <Path d="M13.73 21a2 2 0 0 1-3.46 0" {...p} />
        </>
      )}
      {name === 'search' && (
        <>
          <Circle cx="11" cy="11" r="8" {...p} />
          <Line x1="21" y1="21" x2="16.65" y2="16.65" {...p} />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle cx="12" cy="12" r="10" {...p} />
          <Polyline points="12 6 12 12 16 14" {...p} />
        </>
      )}
      {name === 'plus' && (
        <>
          <Line x1="12" y1="5" x2="12" y2="19" {...p} />
          <Line x1="5" y1="12" x2="19" y2="12" {...p} />
        </>
      )}
      {name === 'minus' && <Line x1="5" y1="12" x2="19" y2="12" {...p} />}
      {name === 'chevron' && <Polyline points="9 18 15 12 9 6" {...p} />}
      {name === 'arrow' && (
        <>
          <Line x1="5" y1="12" x2="19" y2="12" {...p} />
          <Polyline points="12 5 19 12 12 19" {...p} />
        </>
      )}
      {name === 'people' && (
        <>
          <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...p} />
          <Circle cx="9" cy="7" r="4" {...p} />
          <Path d="M23 21v-2a4 4 0 0 0-3-3.87" {...p} />
          <Path d="M16 3.13a4 4 0 0 1 0 7.75" {...p} />
        </>
      )}
      {name === 'plus-circle' && (
        <>
          <Circle cx="12" cy="12" r="10" {...p} />
          <Line x1="12" y1="8" x2="12" y2="16" {...p} />
          <Line x1="8" y1="12" x2="16" y2="12" {...p} />
        </>
      )}
      {name === 'check' && <Polyline points="20 6 9 17 4 12" {...p} />}
    </Svg>
  );
}
