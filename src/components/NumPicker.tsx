/**
 * NumPicker — 1~45 9×5 그리드.
 *
 * 두 가지 모드 지원:
 *   - `triState`  : 중립 → 포함(파랑) → 제외(빨강) → 중립. Expert 시뮬레이터용.
 *   - 'multi'     : on/off 토글, 색은 accent. 통계 범위 선택 등.
 *
 * 부모는 `include`/`exclude` 또는 `selected` 둘 중 한 쌍만 넘긴다.
 */
import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { useTheme } from '@/src/design/theme';
import { ballColor, palette, radius } from '@/src/design/tokens';

type Mode = 'triState' | 'multi';

export function NumPicker({
  mode = 'triState',
  include,
  exclude,
  selected,
  onToggle,
  size = 38,
  style,
}: {
  mode?: Mode;
  include?: number[];
  exclude?: number[];
  selected?: number[];
  /** Tri-state: returns next state {include,exclude}. Multi: returns next selected. */
  onToggle: (n: number) => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const inc = new Set(include ?? []);
  const exc = new Set(exclude ?? []);
  const sel = new Set(selected ?? []);

  const cells: number[] = [];
  for (let i = 1; i <= 45; i++) cells.push(i);

  return (
    <View style={[styles.grid, style]}>
      {cells.map((n) => {
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
          : state === 'selected' ? palette.blue50
          : t.bgSurface;
        const fg =
          state === 'in' || state === 'out' ? '#fff'
          : state === 'selected' ? palette.blue700
          : t.fgSecondary;
        const border =
          state === 'neutral' ? t.borderWeak : 'transparent';
        const ringColor = mode === 'triState' && state === 'neutral'
          ? ballColor(n)
          : undefined;
        return (
          <Pressable
            key={n}
            onPress={() => onToggle(n)}
            style={({ pressed }) => [
              styles.cell,
              {
                width: size, height: size,
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
                fontSize: 14,
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
    gap: 6,
    justifyContent: 'flex-start',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: 4, right: 4,
    width: 6, height: 6,
    borderRadius: 3,
    opacity: 0.7,
  },
});
