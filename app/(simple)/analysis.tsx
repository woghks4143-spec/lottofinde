/**
 * 번호분석 탭 — 분석 도구 hub.
 *
 * 한 화면에 모든 분석 도구의 진입점을 정리. 각 카드는 분석의 종류를 보여주고
 * 탭하면 해당 페이지로 이동.
 *
 * 추후 추가 가능: 특정 주간 출현(5/10/15/20/30주 탭), 번호별 통계 페이지,
 * 다음회 예측 등 영상 참조 앱에 있던 다른 분석 메뉴들.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

type Entry = {
  emoji: string;
  title: string;
  desc: string;
  onPress: () => void;
  comingSoon?: boolean;
};

export default function Analysis() {
  const t = useTheme();
  const router = useRouter();
  const latestRound = useHistory((s) => s.latestRound);

  const entries: Entry[] = [
    {
      emoji: '🤝',
      title: '궁합수 분석',
      desc: '어떤 번호가 가장 자주 함께 나왔는지',
      onPress: () => router.push('/compat' as any),
    },
    {
      emoji: '🔎',
      title: '회차 상세 보기',
      desc: `${latestRound}회 등 회차별 분석 (홀/짝/저/고·잠수번호)`,
      onPress: () => router.push(`/round/${latestRound}` as any),
    },
    {
      emoji: '⚙️',
      title: '시뮬레이터',
      desc: '조건(포함·제외·합·AC 등)으로 조합 추출 + 룰 저장/불러오기',
      onPress: () => router.push('/simulator' as any),
    },
    {
      emoji: '📚',
      title: '용어 사전',
      desc: 'AC값·표준편차·동행수 등 분석 용어 설명',
      onPress: () => router.push('/glossary' as any),
    },
    {
      emoji: '📊',
      title: '특정 주간 출현',
      desc: '최근 5/10/15/20/30주 자주 나온 번호 랭킹',
      onPress: () => router.push('/weekly' as any),
    },
    {
      emoji: '📈',
      title: '번호별 통계',
      desc: '1~45 각 번호의 전체 출현 + 궁합수 + 미출현',
      onPress: () => router.push('/number-stats' as any),
    },
    {
      emoji: '🔮',
      title: '다음회 예측 분석',
      desc: 'Hot·Cold·이월수·예상 패턴으로 다음 회차 통계 분석',
      onPress: () => router.push('/predict' as any),
    },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="번호분석" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}>
        <T variant="body2r" color="secondary" style={{ marginBottom: 6, lineHeight: 22 }}>
          전체 {latestRound}회차 데이터로 깊이 있는 분석을 제공합니다.
        </T>
        {entries.map((e, i) => (
          <Pressable
            key={i}
            onPress={e.onPress}
            disabled={e.comingSoon}
            style={({ pressed }) => [{ opacity: pressed && !e.comingSoon ? 0.92 : 1 }]}
          >
            <Card padding={16}>
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: palette.softFill }]}>
                  <T allowFontScaling={false} style={{ fontSize: 24 }}>{e.emoji}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <T variant="headline2" color="primary" style={{ fontWeight: '700' }}>
                      {e.title}
                    </T>
                    {e.comingSoon && (
                      <View style={[styles.soonChip, { backgroundColor: palette.purple50 }]}>
                        <T variant="caption2" style={{ color: palette.purple500, fontWeight: '700', fontSize: 10 }} allowFontScaling={false}>
                          준비 중
                        </T>
                      </View>
                    )}
                  </View>
                  <T variant="caption1" color="tertiary" style={{ marginTop: 4, lineHeight: 17 }}>
                    {e.desc}
                  </T>
                </View>
                {!e.comingSoon && <Icon.chev color={t.fgTertiary} />}
              </View>
            </Card>
          </Pressable>
        ))}
        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: {
    width: 52, height: 52, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  soonChip: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.pill,
  },
});
