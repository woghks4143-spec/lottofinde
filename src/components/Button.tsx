/**
 * <Button> — primary / outline / ghost variants, sm / md / lg sizes.
 * Mirrors .lp-btn from prototype.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { T } from './Text';
import { useTheme } from '@/src/design/theme';
import { radius } from '@/src/design/tokens';

type Variant = 'primary' | 'outline' | 'ghost' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const SIZE: Record<Size, { h: number; px: number; r: number; v: 'label1n' | 'body1n' | 'body1r' }> = {
  sm: { h: 36, px: 14, r: 10, v: 'label1n' },
  md: { h: 48, px: 24, r: 12, v: 'body1n' },
  lg: { h: 56, px: 24, r: 12, v: 'body1r' },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  full,
  disabled,
  onPress,
  style,
  ...rest
}: {
  title: string;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
} & Omit<PressableProps, 'style'>) {
  const t = useTheme();
  const s = SIZE[size];

  const bg =
    disabled ? t.borderDivider
    : variant === 'primary' ? t.bgAccent
    : variant === 'dark' ? t.bgInverse
    : '#fff';
  const fg =
    disabled ? t.fgDisabled
    : variant === 'primary' ? t.fgOnAccent
    // dark variant uses bgInverse as background → use bgCanvas as text
    // so it's always opposite contrast in both themes
    : variant === 'dark' ? t.bgCanvas
    : variant === 'outline' ? t.fgAccent
    : t.fgSecondary;
  const border = variant === 'outline' ? t.fgAccent : 'transparent';
  const bgPressed = variant === 'primary' ? '#005eeb' : bg;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.h,
          paddingHorizontal: variant === 'ghost' ? 8 : s.px,
          borderRadius: size === 'sm' ? radius.md : radius.lg,
          backgroundColor: variant === 'ghost' ? 'transparent' : (pressed ? bgPressed : bg),
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: border,
          opacity: pressed && !disabled ? 0.92 : 1,
          alignSelf: full ? 'stretch' : 'auto',
        },
        style,
      ]}
      {...rest}
    >
      <T variant={s.v} style={{ color: fg, fontWeight: '700' }} allowFontScaling={false}>{title}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
});
