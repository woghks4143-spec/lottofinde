/**
 * <Screen> — quick scaffold for "준비 중" placeholder tabs.
 * Renders AppBar + centered emoji + label + optional copy.
 */
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from './Text';
import { AppBar } from './AppBar';
import { useTheme } from './../design/theme';

export function Placeholder({
  title,
  emoji,
  copy,
}: {
  title: string;
  emoji?: string;
  copy?: string;
}) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bgCanvas }} edges={['top']}>
      <AppBar title={title} />
      <View style={styles.body}>
        <T variant="display2" style={{ fontSize: 64, marginBottom: 16 }}>{emoji ?? '🚧'}</T>
        <T variant="heading2" color="primary">곧 만나요</T>
        <T variant="body2r" color="tertiary" style={{ marginTop: 6, textAlign: 'center' }}>
          {copy ?? '이 화면은 다음 스프린트에서 채워집니다.'}
        </T>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
});
