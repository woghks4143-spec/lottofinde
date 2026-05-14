/**
 * H1 ② Q1 — single-select: lottery purchase frequency.
 * Source: prototype/flow-h1.jsx → H1_Q1
 */
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { Button } from '@/src/components/Button';
import { Icon } from '@/src/components/Icons';
import { OnbProgress } from '@/src/components/OnbProgress';
import { useSettings, type Q1Answer } from '@/src/store/settings';
import { useTheme } from '@/src/design/theme';
import { radius } from '@/src/design/tokens';

const OPTS: Array<{ id: Q1Answer; t: string; sub: string; emoji: string }> = [
  { id: 'sometimes', t: '가끔 한 번 사봐요',   sub: '월에 1~2번 정도',     emoji: '🎟️' },
  { id: 'weekly',    t: '매주 빠지지 않고 사요', sub: '주말 루틴이에요',     emoji: '📆' },
  { id: 'expert',    t: '직접 통계를 분석해요',  sub: '엑셀로 패턴을 봐요',  emoji: '📊' },
  { id: 'newbie',    t: '아직 사본 적은 없어요', sub: '먼저 알아보고 싶어요', emoji: '✨' },
];

export default function Q1() {
  const t = useTheme();
  const router = useRouter();
  const { q1, setQ1 } = useSettings();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgSurface }]} edges={['top', 'bottom']}>
      <OnbProgress step={1} total={3} />
      <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
        <T variant="caption2" color="accent" style={{ marginBottom: 10, letterSpacing: 1.1 }}>1 / 3</T>
        <T variant="title3" color="primary">로또를 얼마나 자주{'\n'}구매하시나요?</T>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 12 }}>
        {OPTS.map((o) => {
          const sel = q1 === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => setQ1(o.id)}
              style={[
                styles.opt,
                {
                  borderColor: sel ? t.bgAccent : t.borderWeak,
                  backgroundColor: sel ? t.bgAccentSoft : t.bgSurface,
                },
              ]}
            >
              <View style={[
                styles.emojiBox,
                { backgroundColor: sel ? '#fff' : 'rgba(112,115,124,0.05)' },
              ]}>
                <T variant="title3" style={{ fontSize: 20 }}>{o.emoji}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T variant="body2n" style={{ color: sel ? t.fgAccentStrong : t.fgPrimary, fontWeight: '700' }}>{o.t}</T>
                <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>{o.sub}</T>
              </View>
              <View style={[
                styles.radio,
                {
                  backgroundColor: sel ? t.bgAccent : 'transparent',
                  borderColor: sel ? t.bgAccent : t.borderNormal,
                },
              ]}>
                {sel && <Icon.check size={12} color="#fff" weight={3} />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Button title="다음" size="lg" full disabled={!q1} onPress={() => router.push('/onboarding/q2')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  opt: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, paddingHorizontal: 16,
    borderWidth: 1.5, borderRadius: radius.lg + 2,
  },
  emojiBox: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
});
