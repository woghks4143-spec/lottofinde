/**
 * SegTabs — 가로 스크롤 pill 탭.
 *
 * stats 화면 6차원 셀렉터에 쓰인다. 활성 탭은 accent 배경에 흰 글씨.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export type SegItem<T extends string = string> = { id: T; label: string };

export function SegTabs<T extends string>({
  items,
  active,
  onChange,
  style,
}: {
  items: SegItem<T>[];
  active: T;
  onChange: (id: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={style}
    >
      {items.map((it) => {
        const on = it.id === active;
        return (
          <Pressable
            key={it.id}
            onPress={() => onChange(it.id)}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: on ? t.bgAccent : t.bgSurface,
                borderColor: on ? 'transparent' : t.borderWeak,
                borderWidth: on ? 0 : 1,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <T
              variant="label1n"
              style={{ color: on ? palette.white : t.fgSecondary, fontWeight: '600' }}
              allowFontScaling={false}
            >
              {it.label}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 0, paddingVertical: 4 },
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
