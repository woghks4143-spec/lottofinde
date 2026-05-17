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
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { NumPicker } from '@/src/components/NumPicker';
import { useHistory } from '@/src/data/historyStore';
import { coOccurrence, sort6 } from '@/src/data/lotto';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const GOLD = '#e8b04e';
const GOLD_SOFT = '#fff4dc';
const GOLD_DARK = '#a37116';

const MAX_PICK = 5;

type Range = 'all' | 500 | 300 | 100 | 50;
const RANGES: Range[] = [50, 100, 300, 500, 'all'];

export default function ProCompat() {
  const t = useTheme();
  const goBack = useSafeBack('/pro-analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);

  const [picked, setPicked] = useState<number[]>([7, 13, 27]);
  const [range, setRange] = useState<Range>('all');
  const [refreshSeed, setRefreshSeed] = useState(0);
  const addMany = useSavedNumbers((s) => s.addMany);
  const addOne = useSavedNumbers((s) => s.add);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  // 추천 조합별 저장 여부 — refreshSeed/picked/range 변경 시 리셋
  const [savedSet, setSavedSet] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setSavedSet({});
  }, [refreshSeed, picked, range]);

  const showToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 2200);
  };

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
   * 자동 추천 조합 5개 — 한쪽으로 쏠리지 않게 3-Phase로 구성.
   *
   *   1) 경험적 베이스라인: 과거 회차에서 picked가 한 번이라도 나온 회차의
   *      "나머지 번호" 중 TOP-15 짝궁이 평균 몇 개 들어갔는지 측정 → 타겟치.
   *   2) Phase A — 짝궁 (TOP-15에서 점수가중, 타겟 ± 1 jitter개).
   *   3) Phase B — 트리오 확장 (picked 2개 이상 등장한 회차의 나머지 번호,
   *      50% 확률로 1개, 동행 횟수 가중).
   *   4) Phase C — 균형 채우기 (전체 빈도 가중, 짝궁 풀 번호엔 0.3 페널티).
   *   5) 현실성 필터: 합 100~175, 홀짝 0:6/6:0 아님, 최대 연속 ≤ 3.
   */
  const recommendations = useMemo(() => {
    if (picked.length === 0 || partners.length === 0) return [];
    const pickedSet = new Set(picked);

    // ─── 1) 경험적 베이스라인 측정 ────────────────────────
    const topCompSet = new Set(partners.slice(0, 15).map((p) => p.n));
    let totalComp = 0;
    let drawCount = 0;
    for (const d of draws) {
      const hits = d.nums.filter((n) => pickedSet.has(n)).length;
      if (hits === 0) continue;
      const others = d.nums.filter((n) => !pickedSet.has(n));
      totalComp += others.filter((n) => topCompSet.has(n)).length;
      drawCount++;
    }
    const empiricalAvgComp = drawCount > 0 ? totalComp / drawCount : 1.5;

    // ─── 전체 빈도 (균형 채우기용) ──────────────────────
    const overallFreq = new Array(46).fill(0);
    for (const d of draws) for (const n of d.nums) overallFreq[n]++;

    // ─── 트리오 확장 풀 ─────────────────────────────────
    // picked 2개 이상이 같은 회차에 등장했을 때, 그 회차의 나머지 번호들을
    // 동시출현 횟수로 가중. 트리오 표시(top10)와 무관하게 draws 전체에서 탐색.
    const trioExtensions: number[] = [];
    const trioExtWeights = new Map<number, number>();
    if (picked.length >= 2) {
      for (const d of draws) {
        const pickedHits = d.nums.filter((n) => pickedSet.has(n)).length;
        if (pickedHits >= 2) {
          for (const n of d.nums) {
            if (!pickedSet.has(n)) {
              trioExtWeights.set(n, (trioExtWeights.get(n) ?? 0) + 1);
            }
          }
        }
      }
      const sorted = Array.from(trioExtWeights.entries())
        .filter(([, s]) => s >= 2) // 최소 2회 이상 동행
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      for (const [n] of sorted) trioExtensions.push(n);
    }

    // ─── 현실성 검증 ────────────────────────────────────
    const isRealistic = (nums: number[]) => {
      const sum = nums.reduce((a, b) => a + b, 0);
      if (sum < 100 || sum > 175) return false;
      const odd = nums.filter((n) => n % 2 === 1).length;
      if (odd === 0 || odd === 6) return false;
      let maxC = 1, cur = 1;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] === nums[i - 1] + 1) {
          cur++;
          if (cur > maxC) maxC = cur;
        } else cur = 1;
      }
      return maxC <= 3;
    };

    // 가중 인덱스 추출 (weights 배열의 인덱스 반환)
    const weightedIdx = (weights: number[]): number => {
      const total = weights.reduce((a, b) => a + b, 0);
      if (total <= 0) return Math.floor(Math.random() * weights.length);
      let r = Math.random() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r <= 0) return i;
      }
      return weights.length - 1;
    };

    type Meta = { comp: number; trio: number; bal: number };

    // ─── 한 조합 빌드 ──────────────────────────────────
    const buildOne = (): { combo: number[]; meta: Meta } | null => {
      for (let attempt = 0; attempt < 50; attempt++) {
        const chosen = new Set<number>(picked);
        const need = 6 - chosen.size;
        if (need <= 0) {
          return {
            combo: sort6(Array.from(chosen).slice(0, 6)),
            meta: { comp: 0, trio: 0, bal: 0 },
          };
        }

        // 타겟 짝궁 수: 경험치 ± jitter, 상한은 need-1 (need=1일 땐 need)
        const baseTarget = Math.round(empiricalAvgComp);
        const jitter = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
        const cap = need > 1 ? need - 1 : need;
        const targetComp = Math.max(0, Math.min(cap, baseTarget + jitter));

        let compCount = 0, trioCount = 0, balCount = 0;

        // Phase A — 짝궁 (TOP-15에서 Lift 가중)
        const compPool = partners.slice(0, 15).filter((p) => !chosen.has(p.n));
        for (let i = 0; i < targetComp && compPool.length > 0; i++) {
          const avail = compPool.filter((p) => !chosen.has(p.n));
          if (avail.length === 0) break;
          // Lift 차이를 더 강조하기 위해 제곱 (1.5배 vs 0.8배의 차이를 더 크게)
          const weights = avail.map((p) => Math.max(0.05, p.lift * p.lift));
          const idx = weightedIdx(weights);
          chosen.add(avail[idx].n);
          compCount++;
        }

        // Phase B — 트리오 확장 (50% 확률, 1개, 가중 추출)
        if (chosen.size < 6 && trioExtensions.length > 0 && Math.random() < 0.5) {
          const avail = trioExtensions.filter((n) => !chosen.has(n));
          if (avail.length > 0) {
            const ws = avail.map((n) => Math.max(1, trioExtWeights.get(n) ?? 1));
            const idx = weightedIdx(ws);
            chosen.add(avail[idx]);
            trioCount++;
          }
        }

        // Phase C — 균형 채우기 (전체 빈도 가중 + 짝궁 풀 페널티)
        while (chosen.size < 6) {
          const candidates: number[] = [];
          const weights: number[] = [];
          for (let n = 1; n <= 45; n++) {
            if (chosen.has(n)) continue;
            candidates.push(n);
            const inComp = topCompSet.has(n);
            weights.push(Math.max(1, overallFreq[n]) * (inComp ? 0.3 : 1.0));
          }
          if (candidates.length === 0) break;
          const idx = weightedIdx(weights);
          chosen.add(candidates[idx]);
          balCount++;
        }

        const combo = sort6(Array.from(chosen));
        if (isRealistic(combo)) return { combo, meta: { comp: compCount, trio: trioCount, bal: balCount } };
      }
      return null;
    };

    // ─── 5개 조합 만들기 (중복 제거) ─────────────────────
    const results: Array<{ nums: number[]; meta: Meta }> = [];
    const seen = new Set<string>();
    let attempts = 0;
    while (results.length < 5 && attempts < 100) {
      attempts++;
      const r = buildOne();
      if (!r) continue;
      const key = r.combo.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ nums: r.combo, meta: r.meta });
    }
    return results;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, partners, draws, refreshSeed]);

  /** 평이한 인사이트. */
  const insights = useMemo(() => {
    type Ins = { emoji: string; text: string; color: string };
    const list: Ins[] = [];
    if (picked.length === 0 || partners.length === 0) return list;

    const pickedTxt =
      picked.length === 1
        ? `${picked[0]}번`
        : picked.length <= 3
        ? `${picked.join('·')}번`
        : `${picked.slice(0, 3).join('·')} 등 ${picked.length}개 번호`;

    const top = partners[0];
    if (top && top.lift >= 1.0) {
      list.push({
        emoji: '🤝',
        text: `${pickedTxt}과 ${top.n}번이 우연보다 ${top.lift.toFixed(2)}배 자주 같이 나왔어요 (실제 ${top.raw}회)`,
        color: palette.blue700,
      });
    }

    // 한 번도 같이 안 나온 번호 (raw === 0)
    const zero = partners.filter((p) => p.raw === 0).map((p) => p.n);
    if (zero.length > 0) {
      let zText: string;
      if (zero.length === 1) zText = `${zero[0]}번이 한 번도 같이 안 나왔어요`;
      else if (zero.length <= 3) zText = `${zero.join('·')}번이 한 번도 같이 안 나왔어요`;
      else zText = `${zero.slice(0, 3).join('·')} 등 ${zero.length}개 번호가 한 번도 같이 안 나왔어요`;
      list.push({ emoji: '💔', text: zText, color: '#888' });
    }

    // 강도 분석 — TOP 3 Lift 평균이 1.0(우연) 대비 얼마나 강한가
    if (partners.length >= 3) {
      const top3LiftAvg = (partners[0].lift + partners[1].lift + partners[2].lift) / 3;
      if (top3LiftAvg >= 1.4) {
        list.push({
          emoji: '🔥',
          text: `TOP 3 짝궁이 우연보다 평균 ${top3LiftAvg.toFixed(2)}배 — 궁합이 뚜렷한 조합이에요`,
          color: palette.red500,
        });
      } else if (top3LiftAvg < 1.15) {
        list.push({
          emoji: '🌫',
          text: `TOP 3 짝궁도 우연 수준(${top3LiftAvg.toFixed(2)}배) — 특별히 강한 궁합은 없어요`,
          color: '#888',
        });
      }
    }

    return list;
  }, [picked, partners]);

  // ─── 핸들러 ─────────────────────────────────────────────
  const toggleNumber = (n: number) => {
    if (picked.includes(n)) {
      setPicked(picked.filter((x) => x !== n));
    } else if (picked.length < MAX_PICK) {
      setPicked([...picked, n]);
    }
  };

  const clearPicked = () => setPicked([]);

  const saveAllRecommendations = () => {
    if (recommendations.length === 0) return;
    // 아직 저장 안 한 것만 골라서 저장
    const pending = recommendations
      .map((r, i) => ({ r, i }))
      .filter((x) => !savedSet[x.i]);
    if (pending.length === 0) return;
    const games = pending.map(({ r }) => ({
      nums: r.nums,
      source: 'gen' as const,
      round: null,
    }));
    const res = addMany(games);
    // 새로 저장된 만큼만 savedSet에 반영 (중복은 reason='duplicate'로 스킵됨)
    setSavedSet((prev) => {
      const next = { ...prev };
      pending.forEach(({ i }) => { next[i] = true; });
      return next;
    });
    showToast(`보관함에 ${res.added}개 저장됨${res.skipped > 0 ? ` (${res.skipped}개 중복)` : ''}`);
  };

  const saveOneRecommendation = (idx: number, nums: number[]) => {
    if (savedSet[idx]) return; // 이미 저장됨
    const res = addOne({ nums, source: 'gen', round: null });
    if (res.ok) {
      setSavedSet((prev) => ({ ...prev, [idx]: true }));
      showToast('보관함에 저장됨');
    } else if (res.reason === 'duplicate') {
      setSavedSet((prev) => ({ ...prev, [idx]: true })); // 이미 다른 경로로 저장된 거 — UI에 반영
      showToast('이미 저장된 조합이에요');
    } else {
      showToast('보관함이 가득 찼어요 (5000개)');
    }
  };

  const refreshRecommendations = () => setRefreshSeed((s) => s + 1);

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
            <T variant="heading1" color="primary">궁합수 PRO</T>
          </View>
        }
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>

        {/* Hero — 선택한 번호 + 분석 범위 */}
        <View style={[styles.hero, { backgroundColor: palette.neutral950 }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroBadge, { backgroundColor: GOLD }]}>
              <Icon.crown color="#fff" size={12} weight={2.5} />
              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10, marginLeft: 4, letterSpacing: 0.4 }}>
                PRO
              </T>
            </View>
            <T variant="caption1" allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>
              {range === 'all'
                ? `전체 ${earliestRound}~${latestRound}회`
                : `최근 ${range}회 (${(latestRound ?? 0) - range + 1}~${latestRound})`}
            </T>
          </View>
          <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 10 }}>
            선택한 번호 ({picked.length}/{MAX_PICK})
          </T>
          <View style={styles.heroBalls}>
            {picked.length === 0 ? (
              <T variant="body2r" style={{ color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
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

        {/* 인사이트 */}
        {insights.length > 0 && (
          <Card padding={14}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 10 }}>
              💡 한눈에 보기
            </T>
            <View style={{ gap: 8 }}>
              {insights.map((ins, i) => (
                <View key={i} style={[styles.insRow, { backgroundColor: ins.color + '11' }]}>
                  <T allowFontScaling={false} style={{ fontSize: 18, marginRight: 8 }}>{ins.emoji}</T>
                  <T variant="caption1" color="primary" style={{ flex: 1, lineHeight: 18, fontWeight: '600' }}>
                    {ins.text}
                  </T>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* 짝궁 TOP 10 — Lift 기반 (빈도 편향 제거) */}
        {picked.length > 0 && (
          <Card padding={16}>
            <View>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                🤝 짝궁 TOP 10
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                선택한 {picked.length}개 번호와 우연보다 자주 같이 나온 정도 (배수) 기준
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

        {/* 자동 추천 조합 5개 */}
        {recommendations.length > 0 && (() => {
          const savedCount = Object.values(savedSet).filter(Boolean).length;
          const allSaved = savedCount === recommendations.length;
          return (
            <Card padding={16}>
              {/* 제목 + 부제 */}
              <View>
                <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                  ✨ 자동 추천 조합 {recommendations.length}개
                </T>
                <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                  {savedCount > 0
                    ? `${savedCount} / ${recommendations.length} 저장됨 · 실제 회차 패턴 기반`
                    : '실제 회차 패턴 기반: 선택 + 짝궁 + 트리오 + 균형으로 구성'}
                </T>
              </View>

              {/* 액션 버튼 묶음 — 다시 만들기 + 모두 저장 (1:1 분할) */}
              <View style={styles.recActions}>
                <Pressable
                  onPress={refreshRecommendations}
                  style={({ pressed }) => [
                    styles.refreshBtn,
                    { borderColor: GOLD, backgroundColor: t.bgSurface, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <T allowFontScaling={false} style={{ fontSize: 13, marginRight: 4 }}>🔄</T>
                  <T variant="caption1" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 12 }}>
                    다시 만들기
                  </T>
                </Pressable>
                <Pressable
                  onPress={saveAllRecommendations}
                  disabled={allSaved}
                  style={({ pressed }) => [
                    styles.saveAllBtn,
                    {
                      backgroundColor: allSaved ? palette.green500 : GOLD,
                      opacity: pressed && !allSaved ? 0.85 : 1,
                    },
                  ]}
                >
                  <Icon.check color="#fff" size={13} weight={2.8} />
                  <T variant="caption1" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 12, marginLeft: 5 }}>
                    {allSaved ? '저장 완료' : '모두 저장'}
                  </T>
                </Pressable>
              </View>

              {/* 조합 행 — 단일 Card 내부에서 recRow Views로 구분 */}
              <View style={{ marginTop: 12, gap: 8 }}>
                {recommendations.map((r, i) => (
                  <View
                    key={i}
                    style={[
                      styles.recRow,
                      { backgroundColor: t.bgSurface2, borderColor: t.borderDivider },
                    ]}
                  >
                    <View style={styles.labelBox}>
                      <T variant="caption2" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 11 }}>
                        #{i + 1}
                      </T>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {r.nums.map((n) => {
                        const isPicked = picked.includes(n);
                        return (
                          <Ball
                            key={n}
                            n={n}
                            size="sm"
                            dashedRing={isPicked}
                            dashedRingColor={GOLD}
                          />
                        );
                      })}
                    </View>
                    <Pressable
                      onPress={() => saveOneRecommendation(i, r.nums)}
                      disabled={savedSet[i]}
                      style={({ pressed }) => [
                        styles.saveDot,
                        {
                          backgroundColor: savedSet[i] ? palette.green500 : 'rgba(232,176,78,0.18)',
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      {savedSet[i]
                        ? <Icon.check color="#fff" size={12} weight={3} />
                        : <Icon.plus color={GOLD_DARK} size={12} weight={2.5} />}
                    </Pressable>
                  </View>
                ))}
              </View>

              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginTop: 10, fontSize: 10.5 }}>
                ✦ 노란 점선은 직접 선택한 번호 · 합 100~175, 홀짝/연속수 현실성 필터 적용
              </T>
            </Card>
          );
        })()}

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

        <Disclaimer />
      </ScrollView>

      {/* 저장 토스트 */}
      {savedToast && (
        <View style={[styles.toast, { backgroundColor: t.bgInverse }]} pointerEvents="none">
          <T variant="label1n" style={{ color: t.bgCanvas, fontWeight: '700' }} allowFontScaling={false}>
            {savedToast}
          </T>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   짝궁 행 — 순위 + ball + bar + 점수 + 배수
   ═══════════════════════════════════════════════════════════════════════════ */

function PartnerRow({
  rank, n, lift, raw, max,
}: {
  rank: number;
  n: number;
  lift: number;   // 기하평균 Lift — 정렬 기준
  raw: number;    // 합산 동시출현 (참고용)
  max: number;    // 최상위 lift (bar 너비 계산)
}) {
  const t = useTheme();
  const pct = Math.max(6, (lift / max) * 100);
  const isStrong = lift >= 1.3;
  const isWeak = lift < 1.0;
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
            {
              backgroundColor: isStrong ? GOLD : isWeak ? '#999' : palette.blue500,
              width: `${pct}%`,
            },
          ]}
        />
      </View>
      <View style={{ minWidth: 70, alignItems: 'flex-end' }}>
        <T
          variant="label2"
          allowFontScaling={false}
          style={{
            fontWeight: '800',
            color: isStrong ? GOLD_DARK : isWeak ? '#888' : palette.blue700,
          }}
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

  insRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.md,
  },

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
