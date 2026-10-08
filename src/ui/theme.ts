/**
 * Identité visuelle : sombre, premium, sportive. Un accent « volt »
 * et une couleur dédiée par domaine pour une lecture instantanée.
 */
export const colors = {
  bg: '#0A0B0D',
  surface: '#14161A',
  surfaceAlt: '#1B1E23',
  border: '#262A31',
  text: '#F5F7FA',
  textDim: '#A3AAB5',
  textMute: '#6B7280',
  accent: '#C8FF2E',
  accentInk: '#0A0B0D',
  sport: '#FF6A2B',
  nutrition: '#34D399',
  protein: '#F472B6',
  carbs: '#FBBF24',
  fat: '#60A5FA',
  hydration: '#38BDF8',
  sleep: '#A78BFA',
  steps: '#2DD4BF',
  danger: '#F87171',
  warning: '#FBBF24',
  success: '#4ADE80',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

export const font = {
  hero: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8 },
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  number: { fontSize: 28, fontWeight: '800' as const, fontVariant: ['tabular-nums' as const] },
};
