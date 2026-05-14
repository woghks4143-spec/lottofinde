/**
 * <Card> — base surface block with the prototype's .lp-card look.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/design/theme';
import { radius } from '@/src/design/tokens';

export function Card({
  children,
  style,
  flat,
  padding = 16,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Drop the border (for nested surfaces). */
  flat?: boolean;
  padding?: number;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: t.bgSurface,
          borderColor: flat ? 'transparent' : t.borderWeak,
          borderWidth: flat ? 0 : 1,
          borderRadius: radius.xl,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
});
