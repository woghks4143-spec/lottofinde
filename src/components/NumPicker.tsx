/**
 * NumPicker — 1~45 7×7 그리드 (45개 + 4개 빈 자리).
 *
 * 두 가지 모드 지원:
 *   - `triState`  : 중립 → 포함(파랑) → 제외(빨강) → 중립. Expert 시뮬레이터용.
 *   - 'multi'     : on/off 토글, 색은 accent. 통계 범위 선택 등.
 *
 * cellSize는 onLayout으로 측정한 너비 기반으로 동적 계산 → 어느 폰/카드 너비에서도
 * 정확히 7컬럼 보장. 부모가 `size`를 명시하면 그 값을 fallback으로 사용.
 *
 * 부모는 `include`/`exclude` 또는 `selected` 둘 중 한 쌍만 넘긴다.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { useTheme } from '@/src/design/theme';
import { ballColor, palette, radius } from '@/src/design/tokens';

type Mode = 'triState' | 'multi';

const NUM_COLS = 7;
const NUM_ROWS = 7; // 7×7 = 49칸 (45개 숫자 + 4개 빈 자리)
const NUM_GAP = 6;

export function NumPicker({
  mode = 'triState',
  include,
  exclude,
  selected,
  onToggle,
  size: sizeProp,
  style,
}: {
  mode?: Mode;
  include?: number[];
  exclude?: number[];
  selected?: number[];
  /** Tri-state: returns next state {include,exclude}. Multi: returns next selected. */
  onToggle: (n: number) => void;
  /** @deprecated cellSize는 onLayout으로 자동 계산. 사용 시 fallback 값. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const inc = new Set(include ?? []);
  const exc = new Set(exclude ?? []);
  const sel = new Set(selected ?? []);

  // onLayout으로 측정한 너비로 셀 크기를 정확히 계산 → 7컬럼 보장.
  const [gridW, setGridW] = useState(0);
  const cellSize = gridW > 0
    ? Math.floor((gridW - (NUM_COLS - 1) * NUM_GAP) / NUM_COLS)
    : (sizeProp ?? 38);

  return (
    <View
      style={[styles.grid, style]}
      onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
    >
      {Array.from({ length: NUM_COLS * NUM_ROWS }, (_, i) => i + 1).map((n) => {
        // 46~49는 빈 자리 — 시각적 자리 차지하되 내용 X
        if (n > 45) {
          return (
            <View
              key={n}
              style={[styles.cellEmpty, { width: cellSize, height: cellSize }]}
            />
          );
        }
        const isIn = inc.has(n);
        const isOut = exc.has(n);
        const isSel = sel.has(n);
        const state =
          mode === 'multi' ? (isSel ? 'selected' : 'neutral')
          : isIn ? 'in'
          : isOut ? 'out'
          : 'neutral';
        const bg =
          state === 'in' ? palette.blue500
          : state === 'out' ? palette.red500
          : state === 'selected' ? palette.blue500
          : t.bgSurface;
        const fg =
          state === 'in' || state === 'out' || state === 'selected' ? '#fff'
          : t.fgSecondary;
        const border =
          state === 'neutral' ? t.borderWeak : 'transparent';
        // 미선택(neutral) 셀에 로또공 색 dot 표시 — 1-10 노랑, 11-20 파랑,
        // 21-30 빨강, 31-40 회색, 41-45 초록. 어느 구간 번호인지 한눈에 식별.
        const ringColor = state === 'neutral' ? ballColor(n) : undefined;
        return (
          <Pressable
            key={n}
            onPress={() => onToggle(n)}
            style={({ pressed }) => [
              styles.cell,
              {
                width: cellSize, height: cellSize,
                backgroundColor: bg,
                borderColor: border, borderWidth: state === 'neutral' ? 1 : 0,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {ringColor && (
              <View
                pointerEvents="none"
                style={[styles.dot, { backgroundColor: ringColor }]}
              />
            )}
            <T
              variant="label1n"
              style={{
                color: fg,
                fontWeight: '700',
                fontSize: Math.max(12, Math.min(15, cellSize * 0.36)),
                textDecorationLine: state === 'out' ? 'line-through' : 'none',
              }}
              allowFontScaling={false}
            >
              {n}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: NUM_GAP,
    // 가운데 정렬 — 7컬럼이 그리드 너비를 거의 다 채우지만 잔여 픽셀이
    // 좌우 균등하게 분배되어 시각적으로 깔끔.
    justifyContent: 'center',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    position: 'relative',
  },
  cellEmpty: {
    backgroundColor: 'transparent',
    opacity: 0,
  },
  dot: {
    position: 'absolute',
    top: 4, right: 4,
    width: 6, height: 6,
    borderRadius: 3,
    opacity: 0.7,
  },
});
