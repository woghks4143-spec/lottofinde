/**
 * ToggleRow — 리스트 행 스위치 + 보조 라벨.
 *
 * 디자인은 expert/more.tsx의 설정 행을 따른다. Switch는 RN의 기본 컴포넌트.
 */
import React from 'react';
import { StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { useTheme } from '@/src/design/theme';

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  style,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={{ flex: 1 }}>
        <T variant="body1n" color="primary" style={{ fontWeight: '600' }}>{label}</T>
        {hint && <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>{hint}</T>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: t.borderDivider, true: t.bgAccent }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
});
