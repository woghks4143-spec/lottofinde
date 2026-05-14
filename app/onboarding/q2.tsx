/**
 * H1 ③ Q2 — multi-select (max 2): what should the app help with most.
 * Source: prototype/flow-h1.jsx → H1_Q2
 */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { Button } from '@/src/components/Button';
import { Icon, type IconName } from '@/src/components/Icons';
import { OnbProgress } from '@/src/components/OnbProgress';
import { useSettings, type Q2Answer } from '@/src/store/settings';
import { useTheme } from '@/src/design/theme';
import { radius } from '@/src/design/tokens';

const OPTS: Array<{ id: Q2Answer; t: string; d: string; ic: IconName }> = [
  { id: 'auto-check', t: '당첨 자동 확인', d: 'QR 한 번이면 끝',  ic: 'qr' },
  { id: 'recommend',  t: '번호 받아보기',  d: '자동/조건 추천',   ic: 'sparkle' },
  { id: 'store',      t: '판매점 찾기',    d: '가까운 1등 배출점', ic: 'pin' },
  { id: 'stats',      t: '통계로 분석',    d: '히트맵·구간',       ic: 'chart' },
  { id: 'history',    t: '내 번호 관리',   d: '회차별 보관함',     ic: 'history' },
  { id: 'reminder',   t: '추첨 알림',      d: '토요일 리마인더',   ic: 'bell' },
];

export default function Q2() {
  const t = useTheme();
  const router = useRouter();
  const { q2, toggleQ2 } = useSettings();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgSurface }]} edges={['top', 'bottom']}>
      <OnbProgress step={2} total={3} />
      <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
        <T variant="caption2" color="accent" style={{ marginBottom: 10, letterSpacing: 1.1 }}>2 / 3</T>
        <T variant="title3" color="primary">앱에서 가장 도와줬으면{'\n'}하는 일은요?</T>
        <T variant="label1r" color="tertiary" style={{ marginTop: 8 }}>최대 2개까지 선택할 수 있어요.</T>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
        {OPTS.map((o) => {
          const sel = q2.includes(o.id);
          const IconComp = Icon[o.ic];
          return (
            <Pressable
              key={o.id}
              onPress={() => toggleQ2(o.id)}
              style={[
                styles.tile,
                {
                  borderColor: sel ? t.bgAccent : t.borderWeak,
                  backgroundColor: sel ? t.bgAccentSoft : t.bgSurface,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <IconComp size={20} color={sel ? t.fgAccentStrong : t.fgSecondary} />
                {sel && (
                  <View style={[styles.dot, { backgroundColor: t.bgAccent }]}>
                    <Icon.check size={12} color="#fff" weight={3} />
                  </View>
                )}
              </View>
              <View style={{ marginTop: 8, gap: 4 }}>
                <T variant="label1n" style={{ color: sel ? t.fgAccentStrong : t.fgPrimary, fontWeight: '700' }}>{o.t}</T>
                <T variant="caption1" color="tertiary" style={{ fontSize: 11, lineHeight: 15 }}>{o.d}</T>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Button
          title="다음"
          size="lg"
          full
          disabled={q2.length === 0}
          onPress={() => router.push('/onboarding/result')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grid: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '48%',
    minHeight: 100,
    padding: 14,
    borderWidth: 1.5,
    borderRadius: radius.lg + 2,
    justifyContent: 'space-between',
  },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
});
