/**
 * 번호별 통계 — /number-stats
 *
 * 1~45 각 번호의 전 회차 통계를 한 화면에서 조회한다:
 *   1) 번호 선택 그리드 (1~45)
 *   2) 핵심 지표 카드: 총 출현 / 비율 / 최근 출현 회차 / 미출현 회차 수
 *   3) 최근 30회차 출현 타임라인 (점으로 시각화)
 *   4) 궁합수 Top 5 (가장 자주 함께 나온 번호)
 *   5) 안 어울리는 번호 Bottom 5 (가장 적게 함께 나온 번호)
 *
 * 모든 통계는 전체 회차(시드 1~1223회)를 기반으로 계산. coOccurrence 매트릭스가
 * 46×46이라 한 번만 계산해 모든 번호 선택 변경 시 재사용.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { useHistory } from '@/src/data/historyStore';
import {
  bottomCompanions, coOccurrence, frequency, roundsMissing, topCompanions,
} from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function NumberStats() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/analysis');
  const [selected, setSelected] = useState<number>(1);

  // 전체 회차 (최신 → 과거 순)
  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);

  // 정렬된 회차 배열 (최신 → 과거)
  const draws = useMemo(() => {
    const arr: Array<{ round: number; nums: number[]; bonus: number; date: string }> = [];
    const rounds = Object.keys(drawsMap).map(Number).sort((a, b) => b - a);
    for (const r of rounds) {
      const d = drawsMap[r];
      if (d) arr.push({ round: d.round, nums: d.nums, bonus: d.bonus, date: d.date });
    }
    return arr;
  }, [drawsMap]);

  const totalRounds = draws.length;

  // 전체 빈도
  const freq = useMemo(() => frequency(draws), [draws]);
  // 미출현 (최근부터 몇 회차 안 나왔는지)
  const missing = useMemo(() => roundsMissing(draws), [draws]);
  // 동시 출현 매트릭스 — 무거운 연산이지만 1.2k draws × 6×5/2=15 pair = 18k step. 매우 빠름.
  const coMatrix = useMemo(() => coOccurrence(draws), [draws]);

  // 선택된 번호의 통계
  const stat = useMemo(() => {
    const count = freq.count[selected] ?? 0;
    const pct = totalRounds > 0 ? (count / totalRounds) * 100 : 0;
    const miss = missing[selected] ?? totalRounds;
    const lastRound = miss < totalRounds ? latestRound - miss : null;
    return { count, pct, miss, lastRound };
  }, [freq, missing, selected, totalRounds, latestRound]);

  // 최근 30회 출현 패턴
  const recent30 = useMemo(() => {
    const slice = draws.slice(0, 30); // 이미 최신순
    return slice.map((d) => ({
      round: d.round,
      hit: d.nums.includes(selected),
      bonus: d.bonus === selected,
    }));
  }, [draws, selected]);

  // 궁합수 Top 5 / Bottom 5
  const top5 = useMemo(() => topCompanions(coMatrix, selected, 5), [coMatrix, selected]);
  const bot5 = useMemo(() => bottomCompanions(coMatrix, selected, 5), [coMatrix, selected]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="번호별 통계" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* 번호 선택 그리드 */}
        <Card padding={14}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
            번호 선택
          </T>
          <T variant="caption1" color="tertiary" style={{ marginBottom: 12 }}>
            통계를 확인할 번호를 탭하세요
          </T>
          <View style={styles.grid}>
            {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
              const on = selected === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setSelected(n)}
                  style={({ pressed }) => [
                    styles.gridCell,
                    on && [styles.gridCellActive, { borderColor: palette.blue500 }],
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ball n={n} size="sm" />
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 핵심 지표 — Hero */}
        <View style={[styles.hero, { backgroundColor: palette.neutral950 }]}>
          <View style={styles.heroRow}>
            <Ball n={selected} size="lg" />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)' }}>전체 회차</T>
              <T variant="title3" style={{ color: '#fff', fontWeight: '800' }}>
                {totalRounds.toLocaleString()}회 중
              </T>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                1회 ~ {latestRound}회 분석
              </T>
            </View>
          </View>

          <View style={[styles.metricRow, { borderTopColor: 'rgba(255,255,255,0.08)' }]}>
            <Metric label="총 출현" value={`${stat.count}회`} />
            <Divider />
            <Metric label="출현 비율" value={`${stat.pct.toFixed(1)}%`} />
            <Divider />
            <Metric label="미출현" value={stat.miss === 0 ? '바로 직전' : `${stat.miss}회차`} highlight={stat.miss >= 12} />
            <Divider />
            <Metric label="최근 출현" value={stat.lastRound ? `${stat.lastRound}회` : '없음'} />
          </View>
        </View>

        {/* 최근 30회 타임라인 */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
            최근 30회 출현 패턴
          </T>
          <T variant="caption1" color="tertiary" style={{ marginBottom: 14 }}>
            최신 회차(좌)부터 과거(우)로 출현 여부 — 본번호·보너스 구분
          </T>
          <View style={styles.timeline}>
            {recent30.map((it, i) => (
              <View key={i} style={styles.timelineCol}>
                <View
                  style={[
                    styles.timelineDot,
                    it.hit
                      ? { backgroundColor: palette.blue500 }
                      : it.bonus
                      ? { backgroundColor: palette.yellow }
                      : { backgroundColor: t.borderDivider },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.timelineLegend}>
            <LegendDot color={palette.blue500} label="본번호" />
            <LegendDot color={palette.yellow} label="보너스" />
            <LegendDot color={t.borderDivider} label="미출현" />
          </View>
          {/* 출현 횟수 요약 */}
          <View style={[styles.recentSummary, { borderTopColor: t.borderDivider }]}>
            <T variant="caption1" color="tertiary">
              최근 30회 중{' '}
              <T variant="caption1" style={{ color: palette.blue700, fontWeight: '800' }}>
                {recent30.filter((it) => it.hit).length}회
              </T>{' '}
              본번호로 등장
              {recent30.some((it) => it.bonus) && (
                <>, 보너스{' '}
                <T variant="caption1" style={{ color: '#a37116', fontWeight: '800' }}>
                  {recent30.filter((it) => it.bonus).length}회
                </T></>
              )}
            </T>
          </View>
        </Card>

        {/* 궁합수 Top 5 */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
            궁합수 Top 5
          </T>
          <T variant="caption1" color="tertiary" style={{ marginBottom: 14 }}>
            <Ball n={selected} size="xs" style={{ marginRight: 4 } as any} />과 가장 자주 함께 나온 번호
          </T>
          {top5.map((it, i) => (
            <CompanionRow key={it.n} rank={i + 1} n={it.n} count={it.c} total={stat.count} tone="hot" isLast={i === top5.length - 1} />
          ))}
        </Card>

        {/* 안 어울리는 번호 Bottom 5 */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
            안 어울리는 번호 Bottom 5
          </T>
          <T variant="caption1" color="tertiary" style={{ marginBottom: 14 }}>
            가장 적게 함께 나온 번호
          </T>
          {bot5.map((it, i) => (
            <CompanionRow key={it.n} rank={i + 1} n={it.n} count={it.c} total={stat.count} tone="cold" isLast={i === bot5.length - 1} />
          ))}
        </Card>

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T variant="caption2" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10.5, fontWeight: '600' }} allowFontScaling={false}>
        {label}
      </T>
      <T variant="label1n" style={{ color: highlight ? palette.red500 : '#fff', fontWeight: '800', marginTop: 4, fontSize: 14 }} allowFontScaling={false}>
        {value}
      </T>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <T variant="caption2" color="tertiary" style={{ fontSize: 11 }} allowFontScaling={false}>{label}</T>
    </View>
  );
}

function CompanionRow({
  rank, n, count, total, tone, isLast,
}: {
  rank: number; n: number; count: number; total: number; tone: 'hot' | 'cold'; isLast?: boolean;
}) {
  const t = useTheme();
  const fill = tone === 'hot' ? palette.red500 : palette.blue500;
  const bgFill = tone === 'hot' ? 'rgba(255,66,66,0.10)' : 'rgba(0,102,255,0.10)';
  // 비율은 동시출현 횟수 / 선택된 번호의 총 출현 횟수
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const ratio = total > 0 ? Math.min(count / total, 1) : 0;
  return (
    <View style={[styles.compRow, !isLast && { borderBottomWidth: 1, borderBottomColor: t.borderDivider }]}>
      <View style={[styles.compRank, { backgroundColor: bgFill }]}>
        <T variant="caption2" style={{ color: fill, fontWeight: '800', fontSize: 11 }} allowFontScaling={false}>
          {rank}
        </T>
      </View>
      <Ball n={n} size="sm" />
      <View style={{ flex: 1 }}>
        <View style={[styles.compBar, { backgroundColor: t.borderDivider }]}>
          <View style={[styles.compFill, { width: `${Math.max(ratio * 100, 6)}%`, backgroundColor: fill }]} />
        </View>
      </View>
      <View style={{ minWidth: 56, alignItems: 'flex-end' }}>
        <T variant="label1n" color="primary" style={{ fontWeight: '800' }} allowFontScaling={false}>
          {count}회
        </T>
        <T variant="caption2" color="tertiary" style={{ fontSize: 10 }} allowFontScaling={false}>
          {pct}%
        </T>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // 번호 선택 그리드
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  gridCell: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellActive: {
    borderWidth: 2,
  },

  // Hero
  hero: {
    borderRadius: radius.xl + 2,
    padding: 18,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },

  // 타임라인
  timeline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
  },
  timelineCol: {
    width: 'auto',
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recentSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },

  // 궁합수
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  compRank: {
    width: 22, height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  compFill: {
    height: '100%',
    borderRadius: 4,
  },
});
