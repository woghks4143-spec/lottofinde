/**
 * AppBar — top bar with optional leading button, title, and trailing slot.
 */
import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { T } from './Text';
import { Icon } from './Icons';
import { useTheme } from '@/src/design/theme';

export function AppBar({
  title,
  trailing,
  onBack,
  style,
}: {
  /** String title or a custom ReactNode (e.g. for inline chip). */
  title?: React.ReactNode;
  trailing?: React.ReactNode;
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[styles.bar, style]}>
      <View style={styles.left}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8} style={styles.iconBtn}>
            <Icon.chevLeft color={t.fgSecondary} />
          </Pressable>
        )}
        {typeof title === 'string'
          ? <T variant="heading1" color="primary">{title}</T>
          : title}
      </View>
      <View style={styles.right}>{trailing}</View>
    </View>
  );
}

/** Reusable 36×36 icon button (top-right of app bar). */
export function IconBtn({
  onPress,
  children,
}: {
  onPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.iconBtn}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
    minHeight: 56,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minHeight: 28 },
  right: { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
