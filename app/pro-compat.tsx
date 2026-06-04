/**
 * PRO 궁합수 — /pro-compat
 *
 * 일반 모드의 "궁합수 분석"을 전문가급으로 확장하되 평이한 한글 유지.
 *
 *   1. 다중 번호 선택 (1~5개) — 여러 번호의 합산 궁합 분석
 *   2. 합산 궁합 TOP 10 — 선택한 번호들과 가장 자주 함께 나온 번호
 *   3. 자동 추천 조합 5개 — 선택 번호 + TOP 짝궁으로 6자리 완성
 *   4. 궁합 트리오 TOP 10 — 같은 회차에 자주 등장한 3개 묶음
 *   5. 평이한 인사이트 — "X번을 같이 고르면 Y번이 평균보다 N배 자주 나왔어요"
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { useProGuard } from '@/src/lib/useProGuard';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { NumPicker } from '@/src/components/NumPicker';
import { useHistory } from '@/src/data/historyStore';
import { coOccurrence } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const GOLD = '#e8b04e';
const GOLD_SOFT = '#fff4dc';
const GOLD_DARK = '#a37116';

const MAX_PICK = 5;

type Range = 'all' | 500 | 300 | 100 | 50;
const RANGES: Range[] = [50, 100, 300, 500, 'all'];

export default function ProCompat() {
  const isPro = useProGuard();
  const t = useTheme();
  const goBack = useSafeBack('/pro-analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);

  const [picked, setPicked] = useState<number[]>([]);
  const [range, setRange] = useState<Range>('all');
  // 분석 탭 — 궁합수(선택한 번호 분석) / 당첨 궁합(회차 적중 확인)
  const [tab, setTab] = useState<'mine' | 'winning'>('mine');
  // 당첨 궁합 — 분석 기준 회차 (직전 회차의 본번호 짝궁 → 이 회차에 적중 강조)
  // 기본값: 추첨 예정 회차 (가장 최근 추첨 다음 회차 = latestRound + 1)
  const upcomingRound = latestRound != null ? latestRound + 1 : null;
  const [winRound, setWinRound] = useState<number | null>(null);
  useEffect(() => {
    if (winRound == null && upcomingRound != null) setWinRound(upcomingRound);
  }, [upcomingRound, winRound]);

  // newest-first 회차 배열
  const allDraws = useMemo(() => {
    return Object.keys(drawsMap)
      .map((k) => Number(k))
      .sort((a, b) => b - a)
      .map((r) => drawsMap[r]);
  }, [drawsMap, latestRound]);

  const draws = useMemo(() => {
    if (range === 'all') return allDraws;
    return allDraws.slice(0, range);
  }, [allDraws, range]);

  /** 동시출현 매트릭스 — 회차 범위 변경 시만 재계산. */
  const coMatrix = useMemo(() => coOccurrence(draws), [draws]);

  /**
   * 짝궁 점수 — Lift 기반 (관측 ÷ 기대).
   *
   * 단순 합산의 빈도 편향(자주 나오는 번호가 무조건 상위)을 제거하기 위해,
   * 각 picked p에 대해 "우연이라면 같이 나올 횟수(expected)" 대비 "실제 같이
   * 나온 횟수(actual)" 비율을 계산하고 picked 전체에 대해 **기하평균**.
   *
   *   expected_p = freq[n] × freq[p] / totalDraws   (독립 가정)
   *   lift_p     = (actual_p + 1) / (expected_p + 1) (Laplace-1 smoothing)
   *   score(n)   = (∏ lift_p)^(1/k)                   (기하평균)
   *
   * Lift = 1.0 은 우연 수준, 1.3+ 은 뚜렷한 동행, 0.7 이하는 회피 경향.
   * 기하평균이라 picked 한 명한테라도 안 맞으면 점수가 떨어지는 게 장점.
   */
  const partners = useMemo(() => {
    if (picked.length === 0) return [];
    const totalDraws = draws.length;
    if (totalDraws === 0) return [];
    const pickedSet = new Set(picked);

    // 전체 빈도
    const freq = new Array(46).fill(0);
    for (const d of draws) for (const n of d.nums) freq[n]++;

    const items: { n: number; lift: number; raw: number }[] = [];
    for (let n = 1; n <= 45; n++) {
      if (pickedSet.has(n)) continue;
      let product = 1;
      let raw = 0;
      for (const p of picked) {
        const actual = coMatrix[n][p];
        const expected = (freq[n] * freq[p]) / totalDraws;
        // Laplace-1 smoothing: 0/0이나 극단치 방지
        const lift = (actual + 1) / (expected + 1);
        product *= lift;
        raw += actual;
      }
      const geomean = Math.pow(product, 1 / picked.length);
      items.push({ n, lift: geomean, raw });
    }
    items.sort((a, b) => b.lift - a.lift);
    return items;
  }, [coMatrix, picked, draws]);

  /** 안 어울리는 번호 BOTTOM 5 — lift가 가장 낮은 5개 (덜 함께 나온 번호). */
  const worstPartners = useMemo(() => {
    if (partners.length === 0) return [];
    return [...partners].sort((a, b) => a.lift - b.lift).slice(0, 5);
  }, [partners]);
  const maxPartnerLiftBottom = Math.max(
    ...worstPartners.map((p) => p.lift),
    0.01,
  );

  /** 궁합 트리오 — 같은 회차에 자주 함께 등장한 3개 묶음. */
  const trios = useMemo(() => {
    const counter = new Map<string, number>();
    for (const d of draws) {
      const ns = d.nums; // 6개 본번호 (이미 정렬됨)
      // C(6,3) = 20 triples per draw
      for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
          for (let k = j + 1; k < 6; k++) {
            const key = `${ns[i]}-${ns[j]}-${ns[k]}`;
            counter.set(key, (counter.get(key) ?? 0) + 1);
          }
        }
      }
    }
    const items: { trio: number[]; c: number }[] = [];
    counter.forEach((c, key) => {
      const trio = key.split('-').map(Number);
      items.push({ trio, c });
    });
    items.sort((a, b) => b.c - a.c || a.trio[0] - b.trio[0]);
    return items.slice(0, 10);
  }, [draws]);

  /**
   * 당첨 궁합 — 분석 기준 회차(winRound)의 직전 회차(winRound-1) 본번호 6개
   * 각각에 대한 짝궁 TOP N. 본번호 짝궁 중 winRound에 실제 적중한 번호는 강조.
   *
   * 짝궁 계산: 같은 lift 공식, 단 단일 picked 기준.
   * 분석 데이터: winRound 미포함, winRound-1 이전까지만 사용 (no-future-leakage).
   */
  const winningCompat = useMemo(() => {
    if (winRound == null) return null;
    const prev = drawsMap[winRound - 1];
    const cur = drawsMap[winRound];
    if (!prev) return null;
    // winRound 직전 회차까지의 데이터만 사용 (분석에 적중 회차 자체가 들어가면 leakage)
    const historyDraws = allDraws.filter((d) => d.round < winRound);
    if (historyDraws.length < 20) return null;

    const totalDraws = historyDraws.length;
    // 전체 빈도
    const freq = new Array(46).fill(0);
    for (const d of historyDraws) for (const n of d.nums) freq[n]++;
    // 동시출현 매트릭스
    const co = coOccurrence(historyDraws);

    // 각 본번호별 짝궁 TOP 10 (lift 기준)
    const TOP_N = 10;
    const partnersOf: { sourceNum: number; items: { n: number; lift: number; hit: boolean; bonusHit: boolean }[] }[] = [];
    const curMainSet = cur ? new Set(cur.nums) : new Set<number>();
    const curBonus = cur?.bonus ?? -1;

    // 짝궁 union — 6개 본번호의 TOP10 짝궁을 합집합 (중복 제거)
    const unionSet = new Set<number>();

    for (const src of prev.nums) {
      const items: { n: number; lift: number; hit: boolean; bonusHit: boolean }[] = [];
      for (let n = 1; n <= 45; n++) {
        if (n === src) continue;
        const actual = co[n][src];
        const expected = (freq[n] * freq[src]) / totalDraws;
        const lift = (actual + 1) / (expected + 1);
        items.push({
          n,
          lift,
          hit: curMainSet.has(n),
          bonusHit: n === curBonus,
        });
      }
      items.sort((a, b) => b.lift - a.lift);
      const top = items.slice(0, TOP_N);
      partnersOf.push({ sourceNum: src, items: top });
      // union 누적
      for (const it of top) unionSet.add(it.n);
    }

    /**
     * 적중 점수 (사용자 정의):
     *   - 다음 회차 6개 본번호 중 짝궁 union에 포함된 개수 × 1.0
     *   - 다음 회차 보너스가 짝궁 union에 포함되면 +0.5
     *   - max = 6.0 (본번호 전부) + 0.5 (보너스) = 6.5
     *
     * 예: 다음 회차 본번호 6개 중 4개가 짝궁 union에 있고 보너스도 포함 → 4.5 / 6.5
     */
    let hitScore = 0;
    let hitMain = 0;     // 본번호 적중 개수
    let hitBonus = false; // 보너스 적중 여부
    if (cur) {
      for (const n of cur.nums) {
        if (unionSet.has(n)) { hitScore += 1; hitMain += 1; }
      }
      if (unionSet.has(cur.bonus)) { hitScore += 0.5; hitBonus = true; }
    }
    const maxScore = 6.5;

    /**
     * 다음 회차 출현 예상 TOP — 6개 본번호 짝궁을 종합 점수로 랭크.
     *
     * score(n) = appearCount(n) × avgLift(n)
     *   - appearCount: 6개 본번호 중 몇 명의 TOP10 짝궁에 들어갔는가 (1~6)
     *   - avgLift: 그 본번호들과의 lift 평균
     *
     * 여러 본번호의 짝궁으로 동시에 등장 + lift 높으면 강력 추천.
     * 추첨 완료된 회차면 적중 표시.
     */
    const predictMap = new Map<number, { count: number; liftSum: number; sources: number[] }>();
    for (const row of partnersOf) {
      for (const it of row.items) {
        const cur = predictMap.get(it.n) ?? { count: 0, liftSum: 0, sources: [] };
        cur.count += 1;
        cur.liftSum += it.lift;
        cur.sources.push(row.sourceNum);
        predictMap.set(it.n, cur);
      }
    }
    const TOP_PREDICT = 10;
    const predictions: { n: number; count: number; avgLift: number; score: number; sources: number[]; hit: boolean; bonusHit: boolean }[] = [];
    predictMap.forEach((v, n) => {
      const avgLift = v.liftSum / v.count;
      predictions.push({
        n,
        count: v.count,
        avgLift,
        score: v.count * avgLift,
        sources: v.sources,
        hit: curMainSet.has(n),
        bonusHit: n === curBonus,
      });
    });
    predictions.sort((a, b) => b.score - a.score || b.count - a.count);
    const topPredictions = predictions.slice(0, TOP_PREDICT);
    const predictHit = topPredictions.filter((p) => p.hit).length;
    const predictBonus = topPredictions.some((p) => p.bonusHit);

    return {
      prev,
      cur, // null이면 아직 추첨 안 됨 (분석 가능하지만 적중 표시 X)
      partnersOf,
      hitScore,
      hitMain,
      hitBonus,
      maxScore,
      unionSize: unionSet.size,
      historyCount: totalDraws,
      topPredictions,
      predictHit,
      predictBonus,
    };
  }, [drawsMap, allDraws, winRound]);

  /**
   * 백테스트 — 같은 분석법(직전 회차 본번호별 짝궁 TOP10 종합 → 출현 예상 TOP10)을
   * 최근 30회차에 적용했을 때 평균 적중 개수. winRound와 무관하게 latestRound 기준.
   * 무거운 계산이라 useMemo로 캐싱, latestRound 변경 시만 재계산.
   */
  const backtest = useMemo(() => {
    if (latestRound == null || earliestRound == null) return null;
    const BACKTEST_N = 30;
    let totalHit = 0;
    let totalCount = 0;
    let bonusHits = 0;
    for (let i = 0; i < BACKTEST_N; i++) {
      const r = latestRound - i;
      if (r - 1 <= earliestRound) break;
      const prev = drawsMap[r - 1];
      const cur = drawsMap[r];
      if (!prev || !cur) continue;
      // history < r
      const hist = allDraws.filter((d) => d.round < r);
      if (hist.length < 20) continue;
      const td = hist.length;
      const fq = new Array(46).fill(0);
      for (const d of hist) for (const n of d.nums) fq[n]++;
      const co = coOccurrence(hist);

      const predMap = new Map<number, { count: number; liftSum: number }>();
      for (const src of prev.nums) {
        const items: { n: number; lift: number }[] = [];
        for (let n = 1; n <= 45; n++) {
          if (n === src) continue;
          const actual = co[n][src];
          const expected = (fq[n] * fq[src]) / td;
          items.push({ n, lift: (actual + 1) / (expected + 1) });
        }
        items.sort((a, b) => b.lift - a.lift);
        for (const it of items.slice(0, 10)) {
          const e = predMap.get(it.n) ?? { count: 0, liftSum: 0 };
          e.count += 1; e.liftSum += it.lift;
          predMap.set(it.n, e);
        }
      }
      const preds: { n: number; score: number }[] = [];
      predMap.forEach((v, n) => preds.push({ n, score: v.count * (v.liftSum / v.count) }));
      preds.sort((a, b) => b.score - a.score);
      const top10 = preds.slice(0, 10).map((p) => p.n);
      const curMain = new Set(cur.nums);
      const curBonus = cur.bonus;
      let hits = 0;
      let bHit = 0;
      for (const n of top10) {
        if (curMain.has(n)) hits++;
        if (n === curBonus) bHit = 1;
      }
      totalHit += hits;
      bonusHits += bHit;
      totalCount += 1;
    }
    if (totalCount === 0) return null;
    return {
      rounds: totalCount,
      avgMainHit: totalHit / totalCount,
      bonusHitRate: bonusHits / totalCount,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestRound, earliestRound]);

  // 회차 점프 — 이전/다음/예정
  const goPrevWinRound = () => {
    if (winRound == null || earliestRound == null) return;
    if (winRound - 1 > earliestRound) setWinRound(winRound - 1);
  };
  const goNextWinRound = () => {
    if (winRound == null || upcomingRound == null) return;
    if (winRound + 1 <= upcomingRound) setWinRound(winRound + 1);
  };
  const goUpcomingRound = () => {
    if (upcomingRound != null) setWinRound(upcomingRound);
  };

  // ─── 핸들러 ─────────────────────────────────────────────
  const toggleNumber = (n: number) => {
    if (picked.includes(n)) {
      setPicked(picked.filter((x) => x !== n));
    } else if (picked.length < MAX_PICK) {
      setPicked([...picked, n]);
    }
  };

  const clearPicked = () => setPicked([]);

  const maxPartnerLift = Math.max(0.01, partners[0]?.lift ?? 1);
  const maxTrioCount = Math.max(1, trios[0]?.c ?? 1);

  // ─── 출현 통계 (선택 번호 모두의 평균 출현률 등은 단순화) ─────────
  const selectedAppearance = useMemo(() => {
    if (picked.length === 0) return 0;
    let totalHits = 0;
    for (const d of draws) {
      for (const p of picked) {
        if (d.nums.includes(p)) totalHits++;
      }
    }
    return picked.length > 0 ? totalHits / picked.length : 0;
  }, [draws, picked]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon.crown color={GOLD} size={18} weight={2} />
            <T variant="heading1" color="primary">궁합수</T>
          </View>
        }
        onBack={goBack}
      />
      {/* 탭 바 + (winning 탭이면) 회차 네비 — sticky 위치 (ScrollView 밖) */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8, backgroundColor: t.bgCanvas }}>
        <View style={[styles.tabBar, { backgroundColor: t.bgSurface2, borderColor: t.borderDivider }]}>
          <Pressable
            onPress={() => setTab('mine')}
            style={({ pressed }) => [
              styles.tabBtn,
              tab === 'mine' && { backgroundColor: t.bgSurface },
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <T
              variant="label1n"
              allowFontScaling={false}
              style={{
                color: tab === 'mine' ? GOLD_DARK : t.fgSecondary,
                fontWeight: tab === 'mine' ? '800' : '600',
                fontSize: 13,
              }}
            >
              궁합수
            </T>
          </Pressable>
          <Pressable
            onPress={() => setTab('winning')}
            style={({ pressed }) => [
              styles.tabBtn,
              tab === 'winning' && { backgroundColor: t.bgSurface },
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <T
              variant="label1n"
              allowFontScaling={false}
              style={{
                color: tab === 'winning' ? GOLD_DARK : t.fgSecondary,
                fontWeight: tab === 'winning' ? '800' : '600',
                fontSize: 13,
              }}
            >
              당첨 궁합
            </T>
          </Pressable>
        </View>

        {/* 회차 네비 — 당첨 궁합 탭일 때만 sticky 표시 */}
        {tab === 'winning' && winRound != null && (
          <View style={[styles.winNav, { backgroundColor: t.bgSurface, borderColor: t.borderDivider }]}>
            <Pressable
              onPress={goPrevWinRound}
              disabled={winRound - 1 <= (earliestRound ?? 0)}
              style={({ pressed }) => [
                styles.winNavBtn,
                { backgroundColor: t.bgSurface2, opacity: (winRound - 1 <= (earliestRound ?? 0)) ? 0.3 : pressed ? 0.7 : 1 },
              ]}
            >
              <Icon.chevLeft color={t.fgPrimary} size={18} weight={2.5} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10 }}>
                {winRound === upcomingRound ? '추첨 예정' : '분석 회차'}
              </T>
              <T variant="label1n" color="primary" allowFontScaling={false} style={{ fontWeight: '900', fontSize: 18, marginTop: 2 }}>
                {winRound}회
              </T>
            </View>
            <Pressable
              onPress={goNextWinRound}
              disabled={winRound + 1 > (upcomingRound ?? 0)}
              style={({ pressed }) => [
                styles.winNavBtn,
                { backgroundColor: t.bgSurface2, opacity: (winRound + 1 > (upcomingRound ?? 0)) ? 0.3 : pressed ? 0.7 : 1 },
              ]}
            >
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <Icon.chevLeft color={t.fgPrimary} size={18} weight={2.5} />
              </View>
            </Pressable>
            <Pressable
              onPress={goUpcomingRound}
              disabled={winRound === upcomingRound}
              style={({ pressed }) => [
                styles.upcomingJumpBtn,
                {
                  backgroundColor: winRound === upcomingRound ? palette.purple500 + '50' : palette.purple500,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.3 }}>
                예정
              </T>
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>

        {tab === 'mine' && (<>

        {/* Hero — 선택한 번호 + 분석 범위 (라이트/다크 자동 분기) */}
        <View style={[styles.hero, { backgroundColor: t.bgHero }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroBadge, { backgroundColor: GOLD }]}>
              <Icon.crown color="#fff" size={12} weight={2.5} />
              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10, marginLeft: 4, letterSpacing: 0.4 }}>
                PRO
              </T>
            </View>
            <T variant="caption1" allowFontScaling={false} style={{ color: t.fgOnHeroFaint, fontSize: 11 }}>
              {range === 'all'
                ? `전체 ${earliestRound}~${latestRound}회`
                : `최근 ${range}회 (${(latestRound ?? 0) - range + 1}~${latestRound})`}
            </T>
          </View>
          <T variant="caption1" style={{ color: t.fgOnHeroMuted, fontWeight: '600', marginTop: 10 }}>
            선택한 번호 ({picked.length}/{MAX_PICK})
          </T>
          <View style={styles.heroBalls}>
            {picked.length === 0 ? (
              <T variant="body2r" style={{ color: t.fgOnHeroFaint, marginTop: 4 }}>
                1~5개 번호를 골라보세요
              </T>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {picked.map((n) => (
                  <Ball key={n} n={n} size="md" />
                ))}
              </View>
            )}
          </View>
          {picked.length > 0 && (
            <T variant="caption1" style={{ color: 'rgba(255,255,255,0.78)', marginTop: 12, fontSize: 12 }}>
              평균 {selectedAppearance.toFixed(1)}회 출현 · {draws.length}회차 분석
            </T>
          )}
        </View>

        {/* 분석 범위 세그먼티드 */}
        <View style={[styles.segWrap, { backgroundColor: 'rgba(112,115,124,0.10)' }]}>
          {RANGES.map((r) => {
            const on = range === r;
            const label = r === 'all' ? '전체' : `${r}회`;
            return (
              <Pressable
                key={String(r)}
                onPress={() => setRange(r)}
                style={({ pressed }) => [
                  styles.segOpt,
                  on && [styles.segOptActive, { backgroundColor: t.bgSurface }],
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <T
                  variant="label1n"
                  style={{
                    color: on ? GOLD_DARK : t.fgSecondary,
                    fontWeight: on ? '800' : '600',
                    fontSize: 13,
                  }}
                  allowFontScaling={false}
                >
                  {label}
                </T>
              </Pressable>
            );
          })}
        </View>

        {/* 번호 선택 그리드 */}
        <Card padding={14}>
          <View style={styles.cardHead}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
              번호 선택 (최대 {MAX_PICK}개)
            </T>
            {picked.length > 0 && (
              <Pressable onPress={clearPicked} hitSlop={8}>
                <T variant="caption1" allowFontScaling={false} style={{ color: palette.red500, fontWeight: '700' }}>
                  초기화
                </T>
              </Pressable>
            )}
          </View>
          <NumPicker
            mode="multi"
            selected={picked}
            onToggle={toggleNumber}
            style={{ marginTop: 10 }}
          />
          {picked.length >= MAX_PICK && (
            <T variant="caption1" color="tertiary" style={{ marginTop: 8, fontSize: 11.5 }}>
              최대 {MAX_PICK}개까지 선택할 수 있어요
            </T>
          )}
        </Card>

        {/* 짝궁 TOP 10 — Lift 기반 (빈도 편향 제거) */}
        {picked.length > 0 && (
          <Card padding={16}>
            <View>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                🤝 짝궁 TOP 10
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                선택한 {picked.length}개 번호와 가장 잘 어울리는 짝궁 순위
              </T>
            </View>
            <View style={{ marginTop: 12, gap: 8 }}>
              {partners.slice(0, 10).map((p, i) => (
                <PartnerRow
                  key={p.n}
                  rank={i + 1}
                  n={p.n}
                  lift={p.lift}
                  raw={p.raw}
                  max={maxPartnerLift}
                />
              ))}
            </View>
          </Card>
        )}

        {/* 안 어울리는 번호 BOTTOM 5 — Lift 가장 낮음 */}
        {picked.length > 0 && worstPartners.length > 0 && (
          <Card padding={16}>
            <View>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                💔 안 어울리는 번호 BOTTOM 5
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                선택한 {picked.length}개 번호와 가장 적게 함께 나온 번호
              </T>
            </View>
            <View style={{ marginTop: 12, gap: 8 }}>
              {worstPartners.map((p, i) => (
                <PartnerRow
                  key={p.n}
                  rank={i + 1}
                  n={p.n}
                  lift={p.lift}
                  raw={p.raw}
                  max={maxPartnerLiftBottom}
                  worst
                />
              ))}
            </View>
          </Card>
        )}

        {/* 궁합 트리오 TOP 10 */}
        <Card padding={16}>
          <View>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
              🎯 궁합 트리오 TOP 10
            </T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
              같은 회차에 함께 나온 3개 묶음 순위 (선택과 무관)
            </T>
          </View>
          <View style={{ marginTop: 12, gap: 8 }}>
            {trios.map((tr, i) => (
              <TrioRow
                key={i}
                rank={i + 1}
                trio={tr.trio}
                count={tr.c}
                max={maxTrioCount}
              />
            ))}
          </View>
        </Card>

        </>)}

        {tab === 'winning' && winningCompat && (
          <>
            {/* Hero — 분석 회차 정보 */}
            <View style={[styles.hero, { backgroundColor: t.bgHero }]}>
              <View style={styles.heroTopRow}>
                <View style={[styles.heroBadge, { backgroundColor: GOLD }]}>
                  <Icon.crown color="#fff" size={12} weight={2.5} />
                  <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10, marginLeft: 4, letterSpacing: 0.4 }}>
                    PRO
                  </T>
                </View>
                <T variant="caption1" allowFontScaling={false} style={{ color: t.fgOnHeroFaint, fontSize: 11 }}>
                  {winningCompat.historyCount}회차 분석
                </T>
              </View>
              <T variant="caption1" style={{ color: t.fgOnHeroMuted, fontWeight: '600', marginTop: 10 }}>
                {winRound}회 적중 분석
              </T>
              {winningCompat.cur ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                    <T allowFontScaling={false} style={{ color: t.fgOnHero, fontWeight: '900', fontSize: 28, letterSpacing: -0.5 }}>
                      {winningCompat.hitScore.toFixed(1)}
                    </T>
                    <T variant="caption1" style={{ color: t.fgOnHeroMuted, fontSize: 12 }}>
                      / {winningCompat.maxScore} 적중
                    </T>
                  </View>
                  <T variant="caption2" style={{ color: t.fgOnHeroFaint, marginTop: 4, fontSize: 10.5 }}>
                    본번호 {winningCompat.hitMain}개 + 보너스 {winningCompat.hitBonus ? 'O' : 'X'}
                  </T>
                </>
              ) : (
                <T variant="caption2" style={{ color: t.fgOnHeroFaint, marginTop: 8, fontSize: 11 }}>
                  토요일 추첨 후 적중 결과 표시
                </T>
              )}
            </View>

            {/* 직전 회차 본번호 카드 */}
            <Card padding={14}>
              <View style={styles.roundCardHead}>
                <View style={[styles.roundBadge, { backgroundColor: palette.blue500 }]}>
                  <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.3 }}>
                    직전회차 {(winRound ?? 0) - 1}회
                  </T>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {winningCompat.prev.nums.map((n) => (
                  <Ball key={n} n={n} size="md" />
                ))}
              </View>
            </Card>

            {/* 다음 회차 본번호 (적중 비교 기준) — 추첨 후 표시 */}
            {winningCompat.cur ? (
              <Card padding={14}>
                <View style={styles.roundCardHead}>
                  <View style={[styles.roundBadge, { backgroundColor: palette.red500 }]}>
                    <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.3 }}>
                      다음회차 {winRound}회
                    </T>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
                  {winningCompat.cur.nums.map((n) => (
                    <Ball key={n} n={n} size="md" />
                  ))}
                  <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 11, marginLeft: 4 }}>
                    + 보너스
                  </T>
                  <Ball n={winningCompat.cur.bonus} size="md" />
                </View>
              </Card>
            ) : (
              <Card padding={14}>
                <View style={styles.roundCardHead}>
                  <View style={[styles.roundBadge, { backgroundColor: palette.purple500 }]}>
                    <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.3 }}>
                      다음회차 {winRound}회 · 추첨 예정
                    </T>
                  </View>
                </View>
                <T variant="caption1" color="tertiary" style={{ marginTop: 10, fontSize: 11.5 }}>
                  토요일 20:35 추첨 후 적중 결과가 표시됩니다
                </T>
              </Card>
            )}

            {/* 🎯 다음 회차 출현 예상 TOP 10 */}
            <Card padding={14}>
              <View style={styles.predictHead}>
                <T variant="label1n" color="primary" allowFontScaling={false} style={{ fontWeight: '800', flex: 1 }}>
                  🎯 다음 회차 출현 예상 TOP 10
                </T>
                {winningCompat.cur && (
                  <View style={[styles.predictHitPill, { backgroundColor: winningCompat.predictHit > 0 ? palette.red500 : '#888' }]}>
                    <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>
                      적중 {winningCompat.predictHit}/10
                    </T>
                  </View>
                )}
              </View>
              {backtest && (
                <View style={[styles.backtestPill, { backgroundColor: 'rgba(232,176,78,0.10)', borderColor: GOLD }]}>
                  <T variant="caption2" allowFontScaling={false} style={{ color: t.fgGold, fontSize: 11, fontWeight: '700' }}>
                    최근 {backtest.rounds}회차 평균 적중{' '}
                    <T allowFontScaling={false} style={{ fontWeight: '900', fontSize: 13 }}>
                      {backtest.avgMainHit.toFixed(2)}개
                    </T>
                  </T>
                </View>
              )}
              <View style={{ marginTop: 12, gap: 6 }}>
                {winningCompat.topPredictions.map((p, i) => (
                  <View
                    key={p.n}
                    style={[
                      styles.predictRow,
                      {
                        backgroundColor: p.hit ? 'rgba(255,66,66,0.08)' : t.bgSurface2,
                        borderColor: p.hit ? palette.red500 : p.bonusHit ? palette.purple500 : t.borderDivider,
                        borderWidth: (p.hit || p.bonusHit) ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.predictRank, { backgroundColor: i < 3 ? GOLD : t.bgSurface }]}>
                      <T variant="caption2" allowFontScaling={false} style={{ color: i < 3 ? '#fff' : t.fgSecondary, fontWeight: '900', fontSize: 11 }}>
                        {i + 1}
                      </T>
                    </View>
                    <Ball n={p.n} size="md" />
                    <View style={{ flex: 1 }} />
                    {p.hit && (
                      <View style={[styles.predictBadge, { backgroundColor: palette.red500 }]}>
                        <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10 }}>
                          본번호
                        </T>
                      </View>
                    )}
                    {p.bonusHit && (
                      <View style={[styles.predictBadge, { backgroundColor: palette.purple500 }]}>
                        <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10 }}>
                          보너스
                        </T>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </Card>

            {/* 본번호별 짝궁 TOP 10 — 5×2 정렬 그리드 */}
            <Card padding={14}>
              <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                🤝 본번호별 짝궁 TOP 10
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                {winningCompat.cur ? `${winRound}회 본번호 적중은 빨간 테두리, 보너스 적중은 보라 테두리` : '적중 비교는 회차 추첨 후 표시'}
              </T>
              <View style={{ marginTop: 12, gap: 10 }}>
                {winningCompat.partnersOf.map((row) => {
                  const mainHits = row.items.filter((it) => it.hit).length;
                  const bonusHit = row.items.some((it) => it.bonusHit);
                  // 5×2 그리드 — 행마다 5개씩 정확히 정렬
                  const r1 = row.items.slice(0, 5);
                  const r2 = row.items.slice(5, 10);
                  return (
                    <View
                      key={row.sourceNum}
                      style={[styles.winRow, { backgroundColor: t.bgSurface2, borderColor: t.borderDivider }]}
                    >
                      <View style={styles.winRowHead}>
                        <Ball n={row.sourceNum} size="md" />
                        <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 11, fontWeight: '700', marginLeft: 8 }}>
                          의 짝궁
                        </T>
                        <View style={{ flex: 1 }} />
                        {winningCompat.cur && (
                          <View style={[
                            styles.winHitPill,
                            { backgroundColor: (mainHits > 0 || bonusHit) ? palette.red500 + '20' : 'rgba(150,150,150,0.15)' },
                          ]}>
                            <T variant="caption2" allowFontScaling={false} style={{
                              color: (mainHits > 0 || bonusHit) ? palette.red500 : '#888',
                              fontWeight: '800', fontSize: 11,
                            }}>
                              {mainHits > 0 ? `적중 ${mainHits}` : ''}
                              {mainHits > 0 && bonusHit ? ' + 보너스' : bonusHit ? '보너스' : (mainHits === 0 ? '적중 0' : '')}
                            </T>
                          </View>
                        )}
                      </View>
                      <View style={{ marginTop: 8, gap: 8 }}>
                        <View style={styles.winRowGrid}>
                          {r1.map((it, idx) => (
                            <PartnerBall key={it.n} item={it} rank={idx + 1} />
                          ))}
                        </View>
                        <View style={styles.winRowGrid}>
                          {r2.map((it, idx) => (
                            <PartnerBall key={it.n} item={it} rank={idx + 6} />
                          ))}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </>
        )}

        {tab === 'winning' && !winningCompat && (
          <Card padding={20}>
            <T variant="body2r" color="tertiary" style={{ textAlign: 'center' }}>
              분석할 데이터가 부족해요 (직전 회차 데이터 필요)
            </T>
          </Card>
        )}

        <Disclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── 당첨 궁합 짝궁 ball — 1~10위 순번 + 적중(red) / 보너스(purple) 테두리 강조 ─── */
function PartnerBall({ item, rank }: { item: { n: number; hit: boolean; bonusHit: boolean }; rank: number }) {
  const ring = item.hit ? palette.red500 : item.bonusHit ? palette.purple500 : 'transparent';
  return (
    <View style={styles.partnerBallCol}>
      <View style={[styles.partnerBallSlot, ring !== 'transparent' && { borderColor: ring, borderWidth: 2 }]}>
        <Ball n={item.n} size="sm" />
      </View>
      <T variant="caption2" allowFontScaling={false} style={[styles.partnerRankLabel, { color: rank <= 3 ? GOLD_DARK : '#888' }]}>
        {rank}위
      </T>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   짝궁 행 — 순위 + ball + bar + 점수 + 배수
   ═══════════════════════════════════════════════════════════════════════════ */

function PartnerRow({
  rank, n, lift, raw, max, worst,
}: {
  rank: number;
  n: number;
  lift: number;   // 기하평균 Lift — 정렬 기준
  raw: number;    // 합산 동시출현 (참고용)
  max: number;    // 최상위 lift (bar 너비 계산)
  worst?: boolean; // BOTTOM 5 모드 — 빨강 톤
}) {
  const t = useTheme();
  const pct = Math.max(6, (lift / max) * 100);
  const isStrong = !worst && lift >= 1.3;
  const isWeak = !worst && lift < 1.0;
  const barColor = worst ? palette.red500 : isStrong ? GOLD : isWeak ? '#999' : palette.blue500;
  const valColor = worst ? palette.red500 : isStrong ? GOLD_DARK : isWeak ? '#888' : palette.blue700;
  return (
    <View style={styles.barRow}>
      <T variant="caption1" color="tertiary" style={{ width: 18, textAlign: 'center', fontWeight: '700' }} allowFontScaling={false}>
        {rank}
      </T>
      <Ball n={n} size="sm" />
      <View style={[styles.barTrack, { backgroundColor: t.borderDivider }]}>
        <View
          style={[
            styles.barFill,
            { backgroundColor: barColor, width: `${pct}%` },
          ]}
        />
      </View>
      <View style={{ minWidth: 70, alignItems: 'flex-end' }}>
        <T
          variant="label2"
          allowFontScaling={false}
          style={{ fontWeight: '800', color: valColor }}
        >
          {lift.toFixed(2)}배
        </T>
        <T
          variant="caption2"
          allowFontScaling={false}
          style={{ fontSize: 10, color: '#888', fontWeight: '600' }}
        >
          동시 {raw}회
        </T>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   트리오 행 — 순위 + 3개 ball + count
   ═══════════════════════════════════════════════════════════════════════════ */

function TrioRow({
  rank, trio, count, max,
}: {
  rank: number;
  trio: number[];
  count: number;
  max: number;
}) {
  const t = useTheme();
  const pct = Math.max(6, (count / max) * 100);
  return (
    <View style={styles.barRow}>
      <T variant="caption1" color="tertiary" style={{ width: 18, textAlign: 'center', fontWeight: '700' }} allowFontScaling={false}>
        {rank}
      </T>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {trio.map((n) => <Ball key={n} n={n} size="sm" />)}
      </View>
      <View style={[styles.barTrack, { backgroundColor: t.borderDivider, marginLeft: 4 }]}>
        <View style={[styles.barFill, { backgroundColor: palette.blue500, width: `${pct}%` }]} />
      </View>
      <T variant="label2" color="primary" style={{ minWidth: 40, textAlign: 'right', fontWeight: '700' }}>
        {count}회
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: { borderRadius: radius.xl + 2, padding: 18, overflow: 'hidden' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, alignSelf: 'flex-start',
  },
  heroBalls: { minHeight: 44 },

  // 탭 바 — 내 궁합수 / 당첨 궁합
  tabBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 당첨 궁합 — 회차 네비
  winNav: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
  },
  winNavBtn: {
    width: 36, height: 36,
    borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  upcomingJumpBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  backtestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  // 당첨 궁합 — 본번호별 짝궁 행
  winRow: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  winRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  winHitPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  // 5×2 정렬 그리드 — 한 행에 5개 정확히 균등 분포
  winRowGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // 짝궁 ball + 순위 라벨 컬럼
  partnerBallCol: {
    alignItems: 'center',
  },
  partnerBallSlot: {
    width: 36, height: 36,
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  partnerRankLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    marginTop: 3,
    letterSpacing: -0.3,
  },

  // 회차 강조 카드 헤더
  roundCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roundBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
  },

  // 출현 예상 TOP
  predictHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  predictHitPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  predictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.md,
    gap: 8,
  },
  predictRank: {
    width: 26, height: 26,
    borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  predictBadge: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: radius.pill,
  },

  segWrap: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    gap: 2,
  },
  segOpt: {
    flex: 1,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segOptActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },

  // ── 추천 조합 결과 ───────────────────────────────────
  recActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  refreshBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  saveAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: radius.pill,
  },
  labelBox: {
    width: 32, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  saveDot: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
  },

  toast: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.pill,
    shadowColor: '#000', shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8, elevation: 8,
  },
});
