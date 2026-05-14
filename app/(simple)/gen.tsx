/**
 * 조합 생성 탭 — 전체 방식 모음.
 *
 * 등급별 추천 섹션은 제거. 모든 사용자가 동등하게 9개 방식 전체를 보고 선택.
 * 그룹을 둘로 나눠 인지 부담을 낮춤:
 *   1) 자동 추출 — 알고리즘이 6개를 골라줌 (랜덤·트렌드·통계·패턴·평균·의미)
 *   2) 직접/조건 — 사용자가 일부 또는 전체를 지정 (조건·수동·가중치)
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
import { GEN_MODES, type GenMode } from '@/src/lib/generator';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

type Entry = {
  emoji: string;
  bg: string;
  title: string;
  desc: string;
  href: string;
};

const MODE_META: Record<GenMode, { emoji: string; bg: string }> = {
  random:     { emoji: '🎲', bg: 'rgba(0,102,255,0.10)' },
  weighted:   { emoji: '📊', bg: 'rgba(0,191,64,0.10)' },
  statBased:  { emoji: '🧠', bg: 'rgba(101,65,242,0.10)' },
  patternFit: { emoji: '✨', bg: 'rgba(255,193,7,0.12)' },
  average:    { emoji: '🎯', bg: 'rgba(0,152,178,0.12)' },
  meaning:    { emoji: '🎁', bg: 'rgba(255,114,114,0.10)' },
};

// 자동 추출 — GEN_MODES 6개 그대로
const AUTO: Entry[] = GEN_MODES.map((m) => ({
  emoji: MODE_META[m.id].emoji,
  bg: MODE_META[m.id].bg,
  title: m.label,
  desc: m.hint,
  href: `/pick?mode=${m.id}`,
}));

// 직접/조건 — 3개
const MANUAL: Entry[] = [
  {
    emoji: '🧩',
    bg: 'rgba(101,65,242,0.10)',
    title: '조건 조합',
    desc: '고정수·예상수·제외수를 직접 지정해 원하는 조합 추출',
    href: '/condition-pick',
  },
  {
    emoji: '✋',
    bg: 'rgba(0,191,64,0.10)',
    title: '수동 조합 분석',
    desc: '직접 6개 골라 균형 점수를 즉시 확인',
    href: '/manual-pick',
  },
  {
    emoji: '🎛️',
    bg: 'rgba(101,65,242,0.10)',
    title: '가중치 뽑기',
    desc: '1~45 각 번호의 확률을 직접 조정해 정밀하게 뽑기',
    href: '/weighted-pick',
  },
];

export default function Gen() {
  const t = useTheme();
  const router = useRouter();

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
      <AppBar title="조합 생성" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}>

        {/* 자동 추출 */}
        <View style={styles.sectionHead}>
          <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>
            🎲 자동 추출
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
            알고리즘이 6개 번호를 골라줘요
          </T>
        </View>

        {AUTO.map((e, i) => renderEntry(e, `a-${i}`))}

        {/* 직접/조건 */}
        <View style={[styles.sectionHead, { marginTop: 18 }]}>
          <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>
            ✋ 직접·조건 분석
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
            번호를 직접 지정하거나 조건을 걸어 추출해요
          </T>
        </View>

        {MANUAL.map((e, i) => renderEntry(e, `m-${i}`))}

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
