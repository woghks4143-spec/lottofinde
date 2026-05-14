/**
 * Typography presets — mirrors the .w-* classes in prototype/colors_and_type.css.
 *
 * Use as: `<Text style={[type.title3, { color: theme.fgPrimary }]}>...`.
 *
 * Note: RN ignores `font` shorthand and on Android, `fontWeight` alone doesn't
 * select a custom OTF — we set `fontFamily` to the exact weight name from
 * fonts.ts and only use `fontWeight` as a redundant hint.
 */
import type { TextStyle } from 'react-native';
import { FONT_FAMILY } from './fonts';

const F = FONT_FAMILY;

// Letter-spacing: prototype uses `em` (relative to font size). RN needs `px`.
// Apply: ls_px = ls_em * fontSize.
const ls = (em: number, size: number) => Math.round(em * size * 1000) / 1000;

export const type = {
  display2: {
    fontFamily: F.bold, fontWeight: '700',
    fontSize: 40, lineHeight: 52, letterSpacing: ls(-0.0282, 40),
  },
  display3: {
    fontFamily: F.bold, fontWeight: '700',
    fontSize: 36, lineHeight: 48, letterSpacing: ls(-0.027, 36),
  },
  title1: {
    fontFamily: F.bold, fontWeight: '700',
    fontSize: 32, lineHeight: 44, letterSpacing: ls(-0.0253, 32),
  },
  title2: {
    fontFamily: F.bold, fontWeight: '700',
    fontSize: 28, lineHeight: 38, letterSpacing: ls(-0.0236, 28),
  },
  title3: {
    fontFamily: F.bold, fontWeight: '700',
    fontSize: 24, lineHeight: 32, letterSpacing: ls(-0.023, 24),
  },
  // Onboarding "30/40" hero (used in H1_Welcome)
  hero: {
    fontFamily: F.bold, fontWeight: '700',
    fontSize: 30, lineHeight: 40, letterSpacing: ls(-0.025, 30),
  },
  heading1: {
    fontFamily: F.bold, fontWeight: '700',
    fontSize: 22, lineHeight: 30, letterSpacing: ls(-0.0194, 22),
  },
  heading2: {
    fontFamily: F.bold, fontWeight: '700',
    fontSize: 20, lineHeight: 28, letterSpacing: ls(-0.012, 20),
  },
  headline1: {
    fontFamily: F.semibold, fontWeight: '600',
    fontSize: 18, lineHeight: 26, letterSpacing: ls(-0.002, 18),
  },
  headline2: {
    fontFamily: F.semibold, fontWeight: '600',
    fontSize: 17, lineHeight: 24,
  },
  body1n: {
    fontFamily: F.medium, fontWeight: '500',
    fontSize: 16, lineHeight: 24, letterSpacing: ls(0.0057, 16),
  },
  body1r: {
    fontFamily: F.medium, fontWeight: '500',
    fontSize: 16, lineHeight: 26, letterSpacing: ls(0.0057, 16),
  },
  body2n: {
    fontFamily: F.medium, fontWeight: '500',
    fontSize: 15, lineHeight: 22, letterSpacing: ls(0.0096, 15),
  },
  body2r: {
    fontFamily: F.medium, fontWeight: '500',
    fontSize: 15, lineHeight: 24, letterSpacing: ls(0.0096, 15),
  },
  label1n: {
    fontFamily: F.semibold, fontWeight: '600',
    fontSize: 14, lineHeight: 20, letterSpacing: ls(0.0145, 14),
  },
  label1r: {
    fontFamily: F.medium, fontWeight: '500',
    fontSize: 14, lineHeight: 22, letterSpacing: ls(0.0145, 14),
  },
  label2: {
    fontFamily: F.semibold, fontWeight: '600',
    fontSize: 13, lineHeight: 18, letterSpacing: ls(0.0194, 13),
  },
  caption1: {
    fontFamily: F.semibold, fontWeight: '600',
    fontSize: 12, lineHeight: 16, letterSpacing: ls(0.0252, 12),
  },
  caption2: {
    fontFamily: F.bold, fontWeight: '700',
    fontSize: 11, lineHeight: 14, letterSpacing: ls(0.0311, 11),
  },
} as const satisfies Record<string, TextStyle>;

export type TypeKey = keyof typeof type;

/**
 * Senior mode adds +2pt to body & label text per the settings screen
 * ("시니어 큰 글씨, 본문 +2pt"). Pass `senior: true` to apply.
 */
export function senior(style: TextStyle, on: boolean): TextStyle {
  if (!on || !style.fontSize) return style;
  return { ...style, fontSize: style.fontSize + 2, lineHeight: (style.lineHeight ?? style.fontSize * 1.4) + 3 };
}
