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
      {/* 평평한 솔리드 공 디자인 — 동행복권 공식 컬러를 그대로 사용.
          이전엔 sheen(흰 위/검은 아래 테두리)이 있었으나 작은 사이즈와 옅은 색
          (회색/연파랑)에서 색이 빠진 것처럼 보이는 부작용이 있어 제거. */}
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

  // ⚠️ ball 외부 wrap 사이즈를 dashedRing 여부와 무관하게 동일하게 유지해야
  // 같은 행 안에서 ring 있는 ball/없는 ball의 baseline이 어긋나지 않는다.
  // ringPad(4px)만큼의 outer가 항상 있고, dashedRing=true일 때만 SVG circle을 얹는다.
  return (
    <View style={[{ width: wrap, height: wrap, alignItems: 'center', justifyContent: 'center' }, style]}>
      {dashedRing && (
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
      )}
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    // 가벼운 그림자만 유지 — 평면 디자인이지만 살짝 떠 있는 느낌.
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: 'rgba(112,115,124,0.22)',
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    fontFamily: FONT_FAMILY.extrabold,
    fontWeight: '800',
    letterSpacing: -0.3,
    includeFontPadding: false,
  },
});
