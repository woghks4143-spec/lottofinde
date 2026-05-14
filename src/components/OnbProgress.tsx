/**
 * Onboarding progress pip bar — 3 segments, filled up to `step`.
 */
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/src/design/theme';

export function OnbProgress({ step, total }: { step: number; total: number }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pip,
            { backgroundColor: i < step ? t.bgAccent : t.borderDivider },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingBottom: 4 },
  pip: { flex: 1, height: 3, borderRadius: 99 },
});
