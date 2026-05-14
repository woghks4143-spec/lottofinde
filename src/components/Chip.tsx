/**
 * <Chip> — pill badge (accent / danger / success / purple / neutral).
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

type Tone = 'neutral' | 'accent' | 'danger' | 'success' | 'purple' | 'invert';

export function Chip({
  label,
  tone = 'neutral',
  style,
  compact,
}: {
  label: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const t = useTheme();
  const cfg: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: palette.softFill, fg: t.fgSecondary },
    accent:  { bg: palette.blue50, fg: palette.blue700 },
    danger:  { bg: '#ffeded', fg: palette.red500 },
    success: { bg: '#e6f9ee', fg: palette.green700 },
    purple:  { bg: palette.purple50, fg: palette.purple500 },
    invert:  { bg: 'rgba(255,255,255,0.12)', fg: '#fff' },
  };
  const { bg, fg } = cfg[tone];
  return (
    <View
      style={[
        styles.base,
        compact && styles.compact,
        { backgroundColor: bg, borderRadius: radius.pill },
        style,
      ]}
    >
      <T variant="caption1" style={{ color: fg, fontWeight: '600' }} allowFontScaling={false}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 26,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  compact: { height: 20, paddingHorizontal: 6 },
});
