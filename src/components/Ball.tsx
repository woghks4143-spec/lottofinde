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
  muted,
  dashedRing,
  dashedRingColor,
  ringPad: ringPadProp,
  noShadow,
  style,
}: {
  n: number;
  size?: BallSize;
  outline?: boolean;
  /**
   * 색은 유지하되 옅게 표현 — 흰 배경 + 그 번호 컬러로 보더 + 컬러 글자.
   * "조합과 매칭 안 된 공"처럼 한 줄에서 비매칭 항목을 자연스럽게 약화시킬 때.
   */
  muted?: boolean;
  /** 강조 표시 — 외곽에 점선 ring을 그린다 (조합 일치 번호 강조용). */
  dashedRing?: boolean;
  dashedRingColor?: string;
  /** 공 바깥쪽 패딩 (px). 기본 4. 좁은 공간에선 0~2로 줄여서 콤팩트하게. */
  ringPad?: number;
  /**
   * Android elevation shadow가 borderRadius를 무시하고 정사각형으로 그리는
   * RN 버그 회피용. 좁은 ringPad나 행 안에서 ball이 일부만 filled일 때
   * 사각형 그림자가 도드라져 보이는 케이스에서 사용.
   */
  noShadow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { d, f } = SIZE[size];
  const baseColor = ballColor(n);
  const bg = outline || muted ? '#fff' : baseColor;

  const ringPad = ringPadProp ?? 4;
  const wrap = d + ringPad * 2;
  const ringColor = dashedRingColor ?? '#0066ff';

  const inner = (
    <View
      style={[
        styles.base,
        { width: d, height: d, borderRadius: d / 2, backgroundColor: bg },
        outline && styles.outline,
        muted && {
          // muted: 색은 유지하되 흰 배경 + 그 번호 색의 보더로 옅게 표현
          borderWidth: 1.5,
          borderColor: baseColor,
          shadowOpacity: 0,
          elevation: 0,
        },
        noShadow && { shadowOpacity: 0, elevation: 0 },
        !dashedRing && style,
      ]}
    >
      {/* 평평한 솔리드 공 디자인 — 동행복권 공식 컬러를 그대로 사용.
          이전엔 sheen(흰 위/검은 아래 테두리)이 있었으나 작은 사이즈와 옅은 색
          (회색/연파랑)에서 색이 빠진 것처럼 보이는 부작용이 있어 제거. */}
      <Text
        style={[
          styles.text,
          {
            fontSize: f,
            color: outline ? '#46474c' : muted ? baseColor : '#fff',
          },
          (outline || muted) && { fontFamily: FONT_FAMILY.semibold },
        ]}
        allowFontScaling={false}
      >
        {n}
      </Text>
    </View>
  );

  // ⚠️ ball 외부 wrap 사이즈를 dashedRing 여부와 무관하게 동일하게 유지해야
  // 같은 행 안에서 ring 있는 ball/없는 ball의 baseline이 어긋나지 않는다.
  //
  // dashedRing은 항상 공 **외부**에 그린다. SVG 캔버스를 ringPad와 무관하게 충분히
  // 크게(d+8) 잡아 어떤 ringPad에서도 점선이 잘리지 않는다.
  // 인접 공과 점선이 겹치지 않으려면 BallRow나 부모에서 공 사이 gap을 4 이상으로.
  const ringCanvas = d + 8;
  const ringOffset = (wrap - ringCanvas) / 2; // 음수일 수 있음 (wrap < ringCanvas)
  const ringR = d / 2 + 2; // 공보다 2px 외부 (시인성 + 인접 침범 최소화)

  return (
    <View style={[{ width: wrap, height: wrap, alignItems: 'center', justifyContent: 'center' }, style]}>
      {inner}
      {dashedRing && (
        <Svg
          width={ringCanvas}
          height={ringCanvas}
          style={{ position: 'absolute', top: ringOffset, left: ringOffset }}
          pointerEvents="none"
        >
          <Circle
            cx={ringCanvas / 2}
            cy={ringCanvas / 2}
            r={ringR}
            fill="none"
            stroke={ringColor}
            strokeWidth={2}
            strokeDasharray="3,3"
          />
        </Svg>
      )}
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
