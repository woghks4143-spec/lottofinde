/**
 * Ball — Dong-Haeng colour-coded lottery ball.
 * Sizes match prototype's .lp-ball variants (xs/sm/md/lg).
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ballColor } from '@/src/design/tokens';
import { FONT_FAMILY } from '@/src/design/fonts';

export type BallSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE: Record<BallSize, { d: number; f: number }> = {
  xs: { d: 22, f: 11 },
  sm: { d: 28, f: 13 },
  md: { d: 34, f: 15 },
  lg: { d: 44, f: 18 },
};

export function Ball({
  n,
  size = 'md',
  outline,
  dashedRing,
  dashedRingColor,
  style,
}: {
  n: number;
  size?: BallSize;
  outline?: boolean;
  /** 강조 표시 — 외곽에 점선 ring을 그린다 (조합 일치 번호 강조용). */
  dashedRing?: boolean;
  dashedRingColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { d, f } = SIZE[size];
  const bg = outline ? '#fff' : ballColor(n);

  const ringPad = 4;       // ball 바깥으로 4px 여백
  const wrap = d + ringPad * 2;
  const ringColor = dashedRingColor ?? '#0066ff';

  const inner = (
    <View
      style={[
        styles.base,
        { width: d, height: d, borderRadius: d / 2, backgroundColor: bg },
        outline && styles.outline,
        !dashedRing && style,
      ]}
    >
      {/* Inner highlights (top white sheen + bottom dark rim) for tactile look */}
      {!outline && <View pointerEvents="none" style={[styles.sheen, { borderRadius: d / 2 }]} />}
      <Text
        style={[
          styles.text,
          { fontSize: f, color: outline ? '#46474c' : '#fff' },
          outline && { fontFamily: FONT_FAMILY.semibold },
        ]}
        allowFontScaling={false}
      >
        {n}
      </Text>
    </View>
  );

  if (!dashedRing) return inner;

  // 강조 ring: ball 외곽에 점선 SVG circle을 absolute로 얹는다.
  return (
    <View style={[{ width: wrap, height: wrap, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={wrap} height={wrap} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
        <Circle
          cx={wrap / 2}
          cy={wrap / 2}
          r={d / 2 + 2.5}
          fill="none"
          stroke={ringColor}
          strokeWidth={2}
          strokeDasharray="3,3"
        />
      </Svg>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: 'rgba(112,115,124,0.22)',
    shadowOpacity: 0,
    elevation: 0,
  },
  sheen: {
    position: 'absolute',
    inset: 0,
    // RN doesn't support `inset` shorthand pre-0.71, fall back to t/r/b/l:
    top: 0, right: 0, bottom: 0, left: 0,
    borderTopWidth: 2,
    borderTopColor: 'rgba(255,255,255,0.35)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  text: {
    fontFamily: FONT_FAMILY.extrabold,
    fontWeight: '800',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
});
