/**
 * 내 룰 — 저장한 룰 리스트. 시뮬레이터로 열기 / 삭제.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar, IconBtn } from '@/src/components/AppBar';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { RuleChips } from '@/src/components/RuleChips';
import { useRules } from '@/src/store/rules';
import { useTheme } from '@/src/design/theme';
import { palette } from '@/src/design/tokens';

export default function Rules() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/analysis');
  const rules = useRules((s) => s.rules);
  const remove = useRules((s) => s.remove);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title="내 룰"
        onBack={goBack}
        trailing={
          <IconBtn onPress={() => router.push('/simulator' as any)}>
            <Icon.plus color={t.fgSecondary} size={18} />
          </IconBtn>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        {rules.length === 0 ? (
          <Card padding={28}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={[styles.icon, { backgroundColor: palette.purple50 }]}>
                <Icon.filter color={palette.purple500} size={28} />
              </View>
              <T variant="heading2" color="primary">아직 저장한 룰이 없어요</T>
              <T variant="body2r" color="tertiary" style={{ textAlign: 'center' }}>
                조합 필터링에서 조건을 만들어 저장하면 여기서 다시 꺼내 쓸 수 있어요.
              </T>
              <View style={{ marginTop: 8 }}>
                <Button
                  title="조합 필터링 열기"
                  variant="primary"
                  onPress={() => router.push('/simulator' as any)}
                />
              </View>
            </View>
          </Card>
        ) : (
          rules.map((r) => (
            <Card key={r.id} padding={14}>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <T variant="heading2" color="primary">{r.name}</T>
                  <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
                    {r.lastUsedAt
                      ? `${daysAgo(r.lastUsedAt)} 사용`
                      : `${daysAgo(r.createdAt)} 생성`}
                  </T>
                </View>
                <Pressable onPress={() => remove(r.id)} hitSlop={8}>
                  <Icon.close color={t.fgTertiary} />
                </Pressable>
              </View>
              <RuleChips rule={r} style={{ marginTop: 10 }} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="조합 필터링으로 열기"
                    variant="outline"
                    size="sm"
                    full
                    onPress={() => router.push(`/simulator?ruleId=${r.id}` as any)}
                  />
                </View>
              </View>
            </Card>
          ))
        )}

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

function daysAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 86400000);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 30) return `${diff}일 전`;
  if (diff < 365) return `${Math.floor(diff / 30)}개월 전`;
  return `${Math.floor(diff / 365)}년 전`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  icon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
