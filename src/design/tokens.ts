/**
 * Design tokens — Wanted Design System v2.
 * Mirrors prototype/colors_and_type.css 1:1 so screens look identical.
 * Source: prototype/colors_and_type.css
 */

// ─── Palette ──────────────────────────────────────────────────────────────
export const palette = {
  white: '#ffffff',
  black: '#000000',

  // Cool gray, 12 steps
  neutral50: '#f7f7f8',
  neutral100: '#f4f4f5',
  neutral200: '#dbdcdf',
  neutral300: '#c2c4c8',
  neutral400: '#aeb0b6',
  neutral500: '#989ba2',
  neutral600: '#70737c',
  neutral700: '#46474c',
  neutral750: '#37383c',
  neutral800: '#2e2f33',
  neutral850: '#1b1c1e',
  neutral900: '#171719',
  neutral950: '#14191e', // Wanted "logo black"

  // Primary — Wanted Blue
  blue50: '#eaf2fe',
  blue100: '#d4e4fd',
  blue300: '#3385ff',
  blue500: '#0066ff',
  blue600: '#005eeb',
  blue700: '#004bc0',

  // Secondary — Purple
  purple50: '#f0ecfe',
  purple500: '#6541f2',
  purple600: '#9747ff',

  // Status
  red500: '#ff4242',
  green500: '#00bf40',
  green700: '#008a2e',
  cyan500: '#0098b2',

  // Soft (rgba on white)
  softStrong: 'rgba(46,47,51,0.88)',
  softMedium: 'rgba(55,56,60,0.61)',
  softWeak: 'rgba(55,56,60,0.31)',
  softBorder: 'rgba(112,115,124,0.22)',
  softBorderStrong: 'rgba(112,115,124,0.42)',
  softBorderWeak: 'rgba(112,115,124,0.16)',
  softFill: 'rgba(112,115,124,0.05)',
  softFill2: 'rgba(112,115,124,0.08)',
} as const;

// ─── Lotto ball colors (Dong-Haeng official palette) ───────────────────────
// 1-10 yellow, 11-20 blue, 21-30 red, 31-40 gray, 41-45 green
// gray는 공식 톤(#aaaaaa)보다 조금 진하게 — 흰 배경에서 가독성 향상.
export const ballPalette = {
  yellow: '#fbc400',
  blue: '#69c8f2',
  red: '#ff7272',
  gray: '#8b8b8d',
  green: '#b0d840',
} as const;

export function ballColor(n: number): string {
  if (n <= 10) return ballPalette.yellow;
  if (n <= 20) return ballPalette.blue;
  if (n <= 30) return ballPalette.red;
  if (n <= 40) return ballPalette.gray;
  return ballPalette.green;
}

// ─── Semantic light theme ─────────────────────────────────────────────────
// Typed as plain `string` so the dark variant can widen each field.
export type SemanticTheme = {
  bgCanvas: string; bgSurface: string; bgSurface2: string; bgInverse: string;
  bgAccentSoft: string; bgAccent: string;
  bgDangerSoft: string; bgSuccessSoft: string; bgWarnSoft: string;
  /** Hero/강조 카드 배경 — 라이트: 부드러운 보라톤, 다크: 거의 블랙. */
  bgHero: string;
  fgStrong: string; fgPrimary: string; fgSecondary: string; fgTertiary: string; fgDisabled: string;
  fgOnAccent: string; fgAccent: string; fgAccentStrong: string;
  fgDanger: string; fgSuccess: string; fgWarn: string; fgLink: string;
  /** PRO 골드 텍스트 — 라이트: 어두운 골드, 다크: 밝은 골드 (가독성 분기). */
  fgGold: string;
  /** Hero 카드 위에 올라가는 텍스트 색상 — 라이트/다크에 따라 자동 분기. */
  fgOnHero: string; fgOnHeroMuted: string; fgOnHeroFaint: string;
  /** Hero 카드 내부 sub-pill 배경 — 라이트: 더 진한 보라, 다크: 흰색 알파. */
  bgOnHeroPill: string;
  /** Hero 카드 내부 divider 라인 색상. */
  borderOnHero: string;
  borderNormal: string; borderStrong: string; borderWeak: string;
  borderDivider: string; borderHard: string; borderWarn: string;
};

export const light: SemanticTheme = {
  bgCanvas: palette.neutral50,
  bgSurface: palette.white,
  bgSurface2: palette.neutral100,
  bgInverse: palette.neutral950,
  bgAccentSoft: palette.blue50,
  bgAccent: palette.blue500,
  bgDangerSoft: '#ffeded',
  bgSuccessSoft: '#e6f9ee',
  bgWarnSoft: '#fffbe6',
  // 라이트 모드 hero — 부드러운 라벤더 톤. 흰 카드와 명확히 구분되면서도 너무
  // 어둡지 않아 일반 모드 화면에 자연스럽게 녹아든다.
  bgHero: '#e8e3fa',

  fgStrong: palette.neutral900,
  fgPrimary: palette.neutral900,
  fgSecondary: palette.softStrong,
  fgTertiary: palette.softMedium,
  fgDisabled: palette.softWeak,
  fgOnAccent: palette.white,
  fgAccent: palette.blue500,
  fgAccentStrong: palette.blue700,
  fgDanger: palette.red500,
  fgSuccess: palette.green500,
  fgWarn: '#7a5800',
  fgGold: '#a37116',  // 라이트: 어두운 골드 (밝은 배경 위 가독)
  fgLink: palette.blue500,
  // hero 위 텍스트 — 라이트 모드 hero가 밝아서 어두운 텍스트가 필요.
  fgOnHero: palette.neutral900,
  fgOnHeroMuted: 'rgba(23,23,25,0.68)',
  fgOnHeroFaint: 'rgba(23,23,25,0.45)',
  bgOnHeroPill: 'rgba(101,65,242,0.16)',
  borderOnHero: 'rgba(101,65,242,0.18)',

  borderNormal: palette.softBorder,
  borderStrong: palette.softBorderStrong,
  borderWeak: palette.softBorderWeak,
  borderDivider: palette.neutral200,
  borderHard: palette.black,
  borderWarn: '#ffeab3',
};

// ─── Dark theme (used when system is dark) ────────────────────────────────
export const dark: SemanticTheme = {
  ...light,
  bgCanvas: '#0a0b0d',
  bgSurface: palette.neutral950,
  bgSurface2: palette.neutral850,
  bgInverse: palette.white,
  bgAccentSoft: 'rgba(0,102,255,0.16)',
  bgHero: palette.neutral950,

  fgStrong: '#f7f7f8',
  fgPrimary: '#ececee',
  fgSecondary: 'rgba(247,247,248,0.78)',
  fgTertiary: 'rgba(247,247,248,0.50)',
  fgDisabled: 'rgba(247,247,248,0.28)',
  fgWarn: '#f0c674',  // 다크: 밝은 골드 (어두운 배경 위 가독)
  fgGold: '#f0c674',  // 다크: 밝은 골드
  fgOnHero: '#ffffff',
  fgOnHeroMuted: 'rgba(255,255,255,0.70)',
  fgOnHeroFaint: 'rgba(255,255,255,0.50)',
  bgOnHeroPill: 'rgba(255,255,255,0.12)',
  borderOnHero: 'rgba(255,255,255,0.10)',

  borderNormal: 'rgba(247,247,248,0.16)',
  borderDivider: 'rgba(247,247,248,0.10)',
};

// ─── Radii ────────────────────────────────────────────────────────────────
export const radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 24,
  xxxl: 32,
  pill: 9999,
} as const;

// ─── Spacing (4-pt grid) ──────────────────────────────────────────────────
export const space = {
  px: 1,
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  24: 96,
  32: 128,
} as const;

// ─── Shadows (RN-style; values for elevation + iOS shadow) ────────────────
import { Platform, type ViewStyle } from 'react-native';

function shadow(elevation: number, opacity: number, radius: number, offsetY: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: { elevation },
    default: {},
  })!;
}

export const shadows = {
  s1: shadow(1, 0.06, 2, 1),
  s2: shadow(3, 0.08, 4, 2),
  s3: shadow(6, 0.07, 12, 4),
  s4: shadow(10, 0.1, 24, 8),
} as const;

// ─── Z-index ──────────────────────────────────────────────────────────────
export const z = {
  base: 0,
  card: 1,
  sheet: 10,
  modal: 100,
  toast: 1000,
} as const;
