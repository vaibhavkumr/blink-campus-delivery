// Blink brand — pulled from the landing page: cream paper, deep maroon,
// near-black ink, warm pink tint on icon tiles. Elevated with a depth +
// gradient system so surfaces feel layered and premium.
export const Colors = {
  primary: '#9E1B1B', // maroon (buttons, wordmark accent, bottom bar)
  primaryDark: '#7A1616',
  primaryBright: '#C0392B', // lighter maroon for gradient tops / glows
  bg: '#FBF7F1', // cream paper
  bgWarm: '#F4ECE1', // slightly deeper cream for section separation
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  text: '#1A1413', // near-black ink
  textMuted: '#8A807A',
  textSoft: '#B7ADA5', // tertiary / hints
  border: '#EEE6DB',
  borderSoft: '#F2ECE3',
  success: '#2E7D32',
  successBg: '#E7F3E8',
  warning: '#B45309',
  gold: '#C6841C',
  tint: '#F7E9E4', // pink tile tint
  tintDeep: '#F0D8D0',
  overlay: 'rgba(26,20,19,0.45)',
};

// Brand gradients (top → bottom or start → end). Consumed by LinearGradient.
export const Gradients = {
  brand: ['#B4231C', '#7A1616'] as const, // primary CTAs / hero cards
  brandDiagonal: ['#C0392B', '#8A1717'] as const,
  gold: ['#E0A44A', '#C6841C'] as const,
  cream: ['#FFFFFF', '#FBF4EC'] as const, // subtle card lift
  scrim: ['rgba(26,20,19,0)', 'rgba(26,20,19,0.55)'] as const, // image overlays
};

// Soft, warm-tinted elevation. Works across iOS (shadow*), Android (elevation),
// and web (react-native-web maps shadow props to box-shadow).
export const Shadow = {
  xs: {
    shadowColor: '#5B3A2E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#5B3A2E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#4A2A20',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  brand: {
    shadowColor: '#9E1B1B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const Radius = { sm: 10, md: 16, lg: 22, xl: 30, pill: 999 };

// Font families. `display` is the heavy condensed headline face (Anton),
// loaded in the root layout; falls back to the system bold if unavailable.
export const Fonts = {
  display: 'Anton',
};
