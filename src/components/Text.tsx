/**
 * <T> — a Text wrapper that applies typography presets and senior text scale
 * in one place. Saves us from repeating `style={[type.body1n, { color: ... }]}`
 * everywhere.
 *
 * Usage: `<T variant="heading1" color="primary">제목</T>`
 *        `<T variant="body2n" color="tertiary">설명</T>`
 */
import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { type, senior, type TypeKey } from '@/src/design/typography';
import { useTheme } from '@/src/design/theme';

type Color =
  | 'primary' | 'secondary' | 'tertiary' | 'disabled'
  | 'accent' | 'accentStrong' | 'danger' | 'success' | 'warn'
  | 'onAccent' | 'inverse';

export function T({
  variant = 'body2n',
  color = 'primary',
  style,
  children,
  ...rest
}: {
  variant?: TypeKey;
  color?: Color;
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
    inverse: t.scheme === 'dark' ? t.fgPrimary : '#fff',
  };
  const base: TextStyle = type[variant];
  // Only scale body & label tiers, not heading/title/display.
  const shouldScale = variant.startsWith('body') || variant.startsWith('label');
  const finalStyle: TextStyle = {
    ...senior(base, shouldScale && t.senior),
    color: COLOR_MAP[color],
  };
  return (
    <RNText style={[finalStyle, style]} {...rest}>
      {children}
    </RNText>
  );
}
