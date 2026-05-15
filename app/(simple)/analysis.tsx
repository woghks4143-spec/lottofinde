/**
 * 번호분석 탭 — 분석 도구 hub.
 *
 * 조합 생성 탭과 동일한 섹션 구조로 대분류:
 *   1) 통계 분석     — 빈도·출현 기반 (번호별/주간/궁합수)
 *   2) 패턴 분석     — 회차 간 관계·위치 패턴 (회귀/분석법 비교/패턴/예측)
 *   3) 회차 & 참고   — 단일 회차 상세, 시뮬레이터, 용어 사전
 *
 * 각 카드는 분석 종류를 보여주고 탭하면 해당 페이지로 이동.
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
  bg: string;
  title: string;
  desc: string;
  href: string;
};

export default function Analysis() {
  const t = useTheme();
  const router = useRouter();
  const latestRound = useHistory((s) => s.latestRound);

  // ─── 통계 분석 — 빈도/출현 기반 ─────────────────────────────────
  const STATS: Entry[] = [
    {
      emoji: '📈',
      bg: 'rgba(0,102,255,0.10)',
      title: '번호별 통계',
      desc: '1~45 각 번호의 전체 출현 + 궁합수 + 미출현',
      href: '/number-stats',
    },
    {
      emoji: '📊',
      bg: 'rgba(0,191,64,0.10)',
      title: '특정 주간 출현',
      desc: '최근 5/10/15/20/30주 자주 나온 번호 랭킹',
      href: '/weekly',
    },
    {
      emoji: '🤝',
      bg: 'rgba(255,193,7,0.12)',
      title: '궁합수 분석',
      desc: '어떤 번호가 가장 자주 함께 나왔는지',
      href: '/compat',
    },
  ];

  // ─── 패턴 분석 — 회차 간 관계 + 위치 패턴 ─────────────────────
  const PATTERN: Entry[] = [
    {
      emoji: '🔁',
      bg: 'rgba(101,65,242,0.10)',
      title: '회귀 분석',
      desc: '직전 1~100회차의 번호가 이번 회차에 다시 나온 빈도',
      href: '/regression',
    },
    {
      emoji: '🧪',
      bg: 'rgba(0,152,178,0.12)',
      title: '분석법 비교',
      desc: '동일날짜·이월수·이웃수·-45 분석 종합 비교',
      href: '/analysis-methods',
    },
    {
      emoji: '🎯',
      bg: 'rgba(255,114,114,0.10)',
      title: '패턴 분석',
      desc: '모서리·보너스 가로세로·대각선·당첨 X자 위치 패턴',
      href: '/pattern-analysis',
    },
    {
      emoji: '🔮',
      bg: 'rgba(101,65,242,0.10)',
      title: '예상수 10수 분석',
      desc: '8가지 분석법을 결합해 다음 회차 예상 10수 + 지난 적중률',
      href: '/predict',
    },
  ];

  // ─── 회차 & 참고 ──────────────────────────────────────────────
  const TOOLS: Entry[] = [
    {
      emoji: '🔎',
      bg: 'rgba(0,102,255,0.10)',
      title: '회차 상세 보기',
      desc: '회차별 분석 (홀/짝/저/고·잠수번호 등)',
      href: `/round/${latestRound}`,
    },
    {
      emoji: '📚',
      bg: 'rgba(0,191,64,0.10)',
      title: '용어 사전',
      desc: 'AC값·표준편차·동행수 등 분석 용어 설명',
      href: '/glossary',
    },
  ];

  const renderEntry = (e: Entry, key: string) => (
    <Pressable
      key={key}
      onPress={() => router.push(e.href as any)}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <Card padding={14}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: e.bg }]}>
            <T allowFontScaling={false} style={{ fontSize: 24 }}>{e.emoji}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="headline2" color="primary" style={{ fontWeight: '700' }}>
              {e.title}
            </T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 4, lineHeight: 17 }}>
              {e.desc}
            </T>
          </View>
          <Icon.chev color={t.fgTertiary} />
        </View>
      </Card>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="번호분석" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}>
        <T variant="body2r" color="secondary" style={{ marginBottom: 2, lineHeight: 22 }}>
          데이터로 깊이 있는 분석을 제공합니다.
        </T>

        {/* 통계 분석 */}
        <View style={styles.sectionHead}>
          <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>
            📊 통계 분석
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
            번호의 빈도와 출현 패턴을 살펴봐요
          </T>
        </View>
        {STATS.map((e, i) => renderEntry(e, `s-${i}`))}

        {/* 패턴 분석 */}
        <View style={[styles.sectionHead, { marginTop: 18 }]}>
          <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>
            🔁 패턴 분석
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
            회차 간 관계와 위치 패턴을 분석해요
          </T>
        </View>
        {PATTERN.map((e, i) => renderEntry(e, `p-${i}`))}

        {/* 회차 & 참고 */}
        <View style={[styles.sectionHead, { marginTop: 18 }]}>
          <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>
            🔧 회차 & 참고
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
            회차 상세, 시뮬레이터, 용어 풀이
          </T>
        </View>
        {TOOLS.map((e, i) => renderEntry(e, `t-${i}`))}

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sectionHead: {
    marginTop: 4,
    marginBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: {
    width: 52, height: 52, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
});
