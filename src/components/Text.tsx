/**
 * <T> — a Text wrapper that applies typography presets and senior text scale
 * in one place. Saves us from repeating `style={[type.body1n, { color: ... }]}`
 * everywhere.
 *
 * Usage: `<T variant="heading1" color="primary">제목</T>`
 *        `<T variant="body2n" color="tertiary">설명</T>`
 */
import React from 'react';
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { type, type TypeKey } from '@/src/design/typography';
import { useTheme } from '@/src/design/theme';

type Color =
  | 'primary' | 'secondary' | 'tertiary' | 'disabled'
  | 'accent' | 'accentStrong' | 'danger' | 'success' | 'warn'
  | 'onAccent' | 'inverse';

/**
 * 시니어 모드 시 fontSize에 따라 비례적으로 늘림.
 * 매우 작은 캡션(≤10pt)은 좁은 레이아웃(그리드 셀, 헤더 등)에 있어서 +1만,
 * 중간(11~13pt) +2, 본문/제목(14pt+) +3.
 * 이렇게 비례 스케일하면 좁은 셀에서의 overflow 방지.
 */
function seniorBump(fontSize: number): number {
  if (fontSize <= 10) return 1;
  if (fontSize <= 13) return 2;
  return 3;
}

export function T({
  variant = 'body2n',
  color = 'primary',
  style,
  compact,
  children,
  ...rest
}: {
  variant?: TypeKey;
  color?: Color;
  /** 시니어 스케일 적용 안 함. 좁은 레이아웃(그리드/배지/스테퍼)에서 사용. */
  compact?: boolean;
} & TextProps) {
  const t = useTheme();
  const COLOR_MAP: Record<Color, string> = {
    primary: t.fgPrimary,
    secondary: t.fgSecondary,
    tertiary: t.fgTertiary,
    disabled: t.fgDisabled,
    accent: t.fgAccent,
    accentStrong: t.fgAccentStrong,
    danger: t.fgDanger,
    success: t.fgSuccess,
    warn: t.fgWarn,
    onAccent: t.fgOnAccent,
    inverse: t.bgCanvas,
  };
  const base: TextStyle = type[variant];
  const flat = StyleSheet.flatten([base, style]) as TextStyle;
  // 인라인 style.color가 있으면 그걸 우선 사용 (이전 동작 유지),
  // 없으면 color prop의 COLOR_MAP 적용.
  let finalStyle: TextStyle = flat.color != null
    ? flat
    : { ...flat, color: COLOR_MAP[color] };
  if (t.senior && !compact && typeof finalStyle.fontSize === 'number') {
    const bump = seniorBump(finalStyle.fontSize);
    const newSize = finalStyle.fontSize + bump;
    const baseLh = finalStyle.lineHeight ?? finalStyle.fontSize * 1.4;
    finalStyle = { ...finalStyle, fontSize: newSize, lineHeight: baseLh + Math.max(2, bump + 1) };
  }
  return (
    <RNText style={finalStyle} {...rest}>
      {children}
    </RNText>
  );
}
