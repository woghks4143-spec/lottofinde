/**
 * BallRow — six balls + optional bonus, with hit highlight ring support.
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ball, type BallSize } from './Ball';
import { useTheme } from '@/src/design/theme';

export function BallRow({
  nums,
  bonus,
  size = 'md',
  dimmed,
  hits,
  style,
}: {
  nums: number[];
  bonus?: number;
  size?: BallSize;
  dimmed?: boolean;
  /** Indices of balls in `nums` (or matched numbers) to ring as a "hit". */
  hits?: number[];
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const ringColor = t.fgAccent;
  const ringSize = size === 'lg' ? 50 : size === 'md' ? 40 : size === 'sm' ? 34 : 28;

  return (
    <View style={[styles.row, dimmed && { opacity: 0.42 }, style]}>
      {nums.map((n, i) => (
        <View key={i} style={styles.ballWrap}>
          <Ball n={n} size={size} />
          {hits?.includes(n) && (
            <View
              pointerEvents="none"
              style={[
                styles.hitRing,
                { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: ringColor },
              ]}
            />
          )}
        </View>
      ))}
      {bonus !== undefined && (
        <>
          <Text style={[styles.plus, { color: t.fgTertiary }]} allowFontScaling={false}>+</Text>
          <Ball n={bonus} size={size} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ballWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  hitRing: {
    position: 'absolute',
    borderWidth: 2.5,
  },
  plus: { fontSize: 14, fontWeight: '700' },
});
