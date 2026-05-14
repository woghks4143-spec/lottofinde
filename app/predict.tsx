/**
 * 다음회 예측 분석 — /predict
 *
 * 통계 기반의 다음 회차 추천 + 근거 + 예상 패턴.
 *
 * ⚠️ 본질적으로 로또는 무작위라 "예측"이 가능하지 않다. 이 페이지는 최근 회차의
 * 빈도와 미출현 데이터를 정직하게 통계로 보여줄 뿐, 당첨을 보장하지 않는다.
 * 면책 안내문을 화면 위·아래 두 곳에 노출한다.
 *
 * 추천 알고리즘 (결정론적):
 *   - Hot 3개:  최근 30회 Top 3 빈도
 *   - Cold 3개: 전 회차 기준 가장 오래 안 나온 Top 3 (미출현 회차 ↓)
 *   - 합쳐서 6개를 오름차순 정렬
 *
 * 예상 패턴 (참고용):
 *   - 합: 최근 30회 평균 ± 표준편차
 *   - 홀짝/저고: 최근 30회 가장 흔한 비율
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { useHistory } from '@/src/data/historyStore';
import {
  ac, frequency, highLowLabel, oddEvenLabel, roundsMissing, tailSum, total,
} from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const RECENT_WINDOW = 30;

export default function Predict() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const latestDraw = useHistory((s) => s.getLatest());

  // 최신 → 과거 순 회차 배열
  const allDraws = useMemo(() => {
    const arr: Array<{ round: number; nums: number[]; bonus: number; date: string }> = [];
    const rounds = Object.keys(drawsMap).map(Number).sort((a, b) => b - a);
    for (const r of rounds) {
      const d = drawsMap[r];
      if (d) arr.push({ round: d.round, nums: d.nums, bonus: d.bonus, date: d.date });
    }
    return arr;
  }, [drawsMap]);

  const recent = useMemo(() => allDraws.slice(0, RECENT_WINDOW), [allDraws]);
  const recentFreq = useMemo(() => frequency(recent), [recent]);
  const missing = useMemo(() => roundsMissing(allDraws), [allDraws]);

  // ─── Hot 3: 최근 30회 Top 3 빈도 ─────────────────────────────────────────
  const hot3 = useMemo(() => recentFreq.top.slice(0, 3), [recentFreq]);

  // ─── Cold 3: 전체 기준 가장 오래 미출현 3개 ──────────────────────────────
  const cold3 = useMemo(() => {
    return Array.from({ length: 45 }, (_, i) => i + 1)
      .map((n) => ({ n, miss: missing[n] ?? 0 }))
      .sort((a, b) => b.miss - a.miss)
      .slice(0, 3);
  }, [missing]);

  // ─── 종합 추천 6개 (Hot + Cold) ──────────────────────────────────────────
  const recommended = useMemo(() => {
    const set = new Set<number>();
    for (const { n } of hot3) set.add(n);
    for (const { n } of cold3) set.add(n);
    // 중복 (Hot과 Cold가 같은 번호일 수도) 시 부족분은 다음 후보로 보강
    if (set.size < 6) {
      // Hot 다음 후보로 채움
      for (const { n } of recentFreq.top) {
        if (set.size >= 6) break;
        set.add(n);
      }
    }
    return [...set].slice(0, 6).sort((a, b) => a - b);
  }, [hot3, cold3, recentFreq]);

  // ─── 직전 회차 이월 후보 ──────────────────────────────────────────────────
  // 통계적으로 이월수는 한 회차 평균 ~1개. 직전 본번호 6 + 보너스 1 = 7개 표시.
  const carryCandidates = useMemo(() => {
    if (!latestDraw) return [];
    return [...latestDraw.nums, latestDraw.bonus].sort((a, b) => a - b);
  }, [latestDraw]);

  // ─── 예상 패턴 (최근 30회 평균) ────────────────────────────────────────────
  const patternStats = useMemo(() => {
    if (recent.length === 0) return null;
    const sums = recent.map((d) => total(d.nums));
    const meanSum = Math.round(sums.reduce((a, b) => a + b, 0) / sums.length);
    const minSum = Math.min(...sums);
    const maxSum = Math.max(...sums);

    // 가장 흔한 홀짝
    const oeCount: Record<string, number> = {};
    const hlCount: Record<string, number> = {};
    for (const d of recent) {
      const oe = oddEvenLabel(d.nums);
      const hl = highLowLabel(d.nums);
      oeCount[oe] = (oeCount[oe] ?? 0) + 1;
      hlCount[hl] = (hlCount[hl] ?? 0) + 1;
    }
    const mostCommon = (m: Record<string, number>) =>
      Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    const [oeTop, oeFreq] = mostCommon(oeCount);
    const [hlTop, hlFreq] = mostCommon(hlCount);

    return {
      meanSum, minSum, maxSum,
      oeTop, oeFreq, oeRatio: Math.round((oeFreq / recent.length) * 100),
      hlTop, hlFreq, hlRatio: Math.round((hlFreq / recent.length) * 100),
    };
  }, [recent]);

  // ─── 다음 회차 추첨일 ──────────────────────────────────────────────────────
  const nextDraw = useMemo(() => {
    if (!latestDraw) return { round: latestRound + 1, dateLabel: '' };
    const d = new Date(latestDraw.date + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dateLabel = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
    return { round: latestRound + 1, dateLabel };
  }, [latestDraw, latestRound]);

  const sumV = recommended.length === 6 ? total(recommended) : 0;
  const tailV = recommended.length === 6 ? tailSum(recommended) : 0;
  const acV = recommended.length === 6 ? ac(recommended) : 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="다음회 예측 분석" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* 상단 면책 안내 — 강조 */}
        <View style={[styles.disclaimerBox, { backgroundColor: 'rgba(255,66,66,0.10)', borderColor: 'rgba(255,66,66,0.30)' }]}>
          <T variant="caption1" style={{ color: palette.red500, lineHeight: 18, fontWeight: '600' }}>
            ⚠️ <T variant="caption1" style={{ color: palette.red500, fontWeight: '800' }}>로또는 무작위</T>입니다.
            아래 분석은 최근 회차의 통계 패턴일 뿐이며, <T variant="caption1" style={{ color: palette.red500, fontWeight: '800' }}>당첨을 보장하지 않습니다</T>.
            참고용으로만 봐주세요.
          </T>
        </View>

        {/* Hero — 다음 회차 정보 */}
        <View style={[styles.hero, { backgroundColor: palette.neutral950 }]}>
          <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)' }}>다음 회차</T>
          <T variant="title1" style={{ color: '#fff', fontWeight: '800', marginTop: 2 }}>
            제 {nextDraw.round}회
          </T>
          <T variant="caption1" style={{ color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
            {nextDraw.dateLabel || '추첨일 미정'}
          </T>
        </View>

        {/* 종합 추천 6개 */}
        <View style={[styles.heroRec, { backgroundColor: palette.purple500 }]}>
          <View style={styles.heroRecHead}>
            <T variant="caption1" style={{ color: 'rgba(255,255,255,0.75)' }}>통계 기반 종합 추천</T>
            <T variant="title3" style={{ color: '#fff', fontWeight: '800', marginTop: 2 }}>
              🔮 6개 추천 조합
            </T>
          </View>
          <View style={{ marginTop: 14, alignItems: 'center' }}>
            <BallRow nums={recommended} size="lg" />
          </View>
          <View style={[styles.metaRow, { borderTopColor: 'rgba(255,255,255,0.10)' }]}>
            <T variant="caption1" style={{ color: 'rgba(255,255,255,0.75)' }}>
              합 {sumV} · 끝수합 {tailV} · AC {acV} · {recommended.length === 6 ? oddEvenLabel(recommended) : ''} · {recommended.length === 6 ? highLowLabel(recommended) : ''}
            </T>
          </View>
        </View>

        {/* 추천 근거: Hot */}
        <Card padding={16}>
          <View style={styles.cardHead}>
            <View style={[styles.tonePill, { backgroundColor: 'rgba(255,66,66,0.10)' }]}>
              <T variant="caption2" style={{ color: palette.red500, fontWeight: '800', fontSize: 10 }} allowFontScaling={false}>🔥 HOT</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>최근 {RECENT_WINDOW}회 인기 번호</T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>최근 추세를 그대로 따라가는 전략</T>
            </View>
          </View>
          <View style={styles.ballsRow}>
            {hot3.map((it) => (
              <View key={it.n} style={styles.ballItem}>
                <Ball n={it.n} size="md" />
                <T variant="caption2" color="tertiary" style={{ marginTop: 4, fontSize: 11 }} allowFontScaling={false}>
                  {it.c}회 ({Math.round((it.c / RECENT_WINDOW) * 100)}%)
                </T>
              </View>
            ))}
          </View>
        </Card>

        {/* 추천 근거: Cold */}
        <Card padding={16}>
          <View style={styles.cardHead}>
            <View style={[styles.tonePill, { backgroundColor: 'rgba(0,102,255,0.10)' }]}>
              <T variant="caption2" style={{ color: palette.blue700, fontWeight: '800', fontSize: 10 }} allowFontScaling={false}>❄️ COLD</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>오래 안 나온 잠수 번호</T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>곧 나올 것이라는 평균 회귀 가정</T>
            </View>
          </View>
          <View style={styles.ballsRow}>
            {cold3.map((it) => (
              <View key={it.n} style={styles.ballItem}>
                <Ball n={it.n} size="md" />
                <T variant="caption2" color="tertiary" style={{ marginTop: 4, fontSize: 11 }} allowFontScaling={false}>
                  {it.miss}회차 미출현
                </T>
              </View>
            ))}
          </View>
        </Card>

        {/* 직전 이월 후보 */}
        {carryCandidates.length > 0 && latestDraw && (
          <Card padding={16}>
            <View style={styles.cardHead}>
              <View style={[styles.tonePill, { backgroundColor: 'rgba(101,65,242,0.10)' }]}>
                <T variant="caption2" style={{ color: palette.purple500, fontWeight: '800', fontSize: 10 }} allowFontScaling={false}>⚡ 이월</T>
              </View>
              <View style={{ flex: 1 }}>
                <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>직전 회차 이월 후보</T>
                <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
                  {latestRound}회 본번호 6개 + 보너스 1개 (평균 ~1개 이월됨)
                </T>
              </View>
            </View>
            <View style={[styles.carryBalls, { marginTop: 4 }]}>
              {latestDraw.nums.map((n) => <Ball key={n} n={n} size="sm" />)}
              <T variant="caption1" color="tertiary" style={{ marginHorizontal: 4 }}>+</T>
              <Ball n={latestDraw.bonus} size="sm" outline />
            </View>
          </Card>
        )}

        {/* 예상 패턴 */}
        {patternStats && (
          <Card padding={16}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
              📊 예상 패턴
            </T>
            <T variant="caption1" color="tertiary" style={{ marginBottom: 14 }}>
              최근 {RECENT_WINDOW}회 평균을 기반으로 한 예상 분포
            </T>
            <View style={styles.patternGrid}>
              <PatternCell label="합 평균" value={`${patternStats.meanSum}`} hint={`${patternStats.minSum}~${patternStats.maxSum}`} />
              <PatternCell label="가장 흔한 홀짝" value={patternStats.oeTop} hint={`${patternStats.oeRatio}%`} />
              <PatternCell label="가장 흔한 저고" value={patternStats.hlTop} hint={`${patternStats.hlRatio}%`} />
            </View>
          </Card>
        )}

        {/* 하단 면책 */}
        <Disclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function PatternCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.patternCell, { backgroundColor: palette.softFill, borderColor: t.borderWeak }]}>
      <T variant="caption2" color="tertiary" style={{ fontSize: 10.5, fontWeight: '600' }} allowFontScaling={false}>
        {label}
      </T>
      <T variant="label1n" color="primary" style={{ fontWeight: '800', marginTop: 4 }} allowFontScaling={false}>
        {value}
      </T>
      {hint && (
        <T variant="caption2" color="tertiary" style={{ fontSize: 10, marginTop: 2 }} allowFontScaling={false}>
          {hint}
        </T>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  disclaimerBox: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  hero: {
    borderRadius: radius.xl,
    padding: 18,
  },

  heroRec: {
    borderRadius: radius.xl + 2,
    padding: 18,
    overflow: 'hidden',
  },
  heroRecHead: {},
  metaRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: 'center',
  },

  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  tonePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },

  ballsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  ballItem: {
    alignItems: 'center',
  },
  carryBalls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },

  // 예상 패턴
  patternGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  patternCell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
});
