/**
 * Mandatory disclaimer footer — PRD F-007 obligation.
 * Always rendered on stats / recommend / result screens.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export function Disclaimer({ short = false }: { short?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: palette.softFill, borderRadius: radius.sm },
      ]}
    >
      <T
        variant="caption1"
        style={{ color: t.fgTertiary, fontSize: 10.5, fontWeight: '500', lineHeight: 15 }}
        allowFontScaling={false}
      >
        {short
          ? '본 정보는 통계 분석일 뿐 당첨을 보장하지 않습니다.'
          : '본 정보는 통계 분석일 뿐 당첨을 보장하지 않으며, 복권은 책임 있는 범위에서 즐겨주세요. (만 19세 이상)'}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 8, paddingHorizontal: 12 },
});
