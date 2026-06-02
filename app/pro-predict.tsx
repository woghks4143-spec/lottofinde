/**
 * 핀더 예상 제외수 — /pro-predict
 *
 * 모든 분석법(일반 + PRO, 중복 제거)을 합쳐서 20수 예상.
 * 백테스트로 각 분석법의 최근 정확도를 측정해 가중치를 부여하고, 가중 투표
 * 결과 상위 20수를 추출한다.
 *
 * No-future-leakage: 분석 대상 회차 R의 예상수는 1..R-1 데이터만 사용.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { useProGuard } from '@/src/lib/useProGuard';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import type { Draw } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';
import { computeExclusionPicks, backtestExclusion } from '@/src/lib/exclusionFilter';

const GOLD = '#e8b04e';
const GOLD_DARK = '#a37116';
const TRAIN_N = 60;          // 가중치 학습 윈도우 — lift 추정 안정화
const TEST_N = 30;           // 정확도 검증 윈도우 (target - 30 ~ target - 1)
const TOP_PICKS = 20;        // 핀더 예상 제외수 개수
const RANDOM = 6 / 45;       // 우연 정밀도

/* ═══════════════════════════════════════════════════════════════════════════
   분석법 정의 — 각 메소드는 target 회차에 대한 추천 번호 배열을 반환.
   주의: target 회차의 미래 데이터는 절대 사용하지 않음.
   ═══════════════════════════════════════════════════════════════════════════ */

// 메소드 추천 — 보너스볼 기여는 0.5로, 본번호 기여는 1.0으로 가중
type RecW = { n: number; w: number };
type MethodFn = (target: number, drawsMap: Record<number, Draw>) => number[] | RecW[];

/** 메소드 결과를 가중치 포함 형태로 정규화 (number[]는 모두 w=1). */
function asWeighted(recs: number[] | RecW[]): RecW[] {
  if (recs.length === 0) return [];
  if (typeof (recs as any)[0] === 'number') {
    return (recs as number[]).map((n) => ({ n, w: 1 }));
  }
  return recs as RecW[];
}

/** Hot 최근 100회 — 빈도 TOP 10. */
function mHot(target: number, drawsMap: Record<number, Draw>): number[] {
  const freq = new Array(46).fill(0);
  const from = Math.max(1, target - 100);
  for (let r = from; r <= target - 1; r++) {
    const d = drawsMap[r];
    if (d) for (const n of d.nums) freq[n]++;
  }
  const arr: { n: number; c: number }[] = [];
  for (let n = 1; n <= 45; n++) arr.push({ n, c: freq[n] });
  arr.sort((a, b) => b.c - a.c || a.n - b.n);
  return arr.slice(0, 10).map((x) => x.n);
}

/** Cold (잠수번호) — 가장 오랫동안 미출현한 번호 TOP 10. */
function mCold(target: number, drawsMap: Record<number, Draw>): number[] {
  const lastSeen = new Array(46).fill(-1);
  for (let r = target - 1; r >= 1; r--) {
    const d = drawsMap[r];
    if (!d) continue;
    for (const n of d.nums) {
      if (lastSeen[n] < 0) lastSeen[n] = r;
    }
  }
  const arr: { n: number; gap: number }[] = [];
  for (let n = 1; n <= 45; n++) {
    const gap = lastSeen[n] < 0 ? target : target - lastSeen[n];
    arr.push({ n, gap });
  }
  arr.sort((a, b) => b.gap - a.gap || a.n - b.n);
  return arr.slice(0, 10).map((x) => x.n);
}

/** 이월수 — 직전 회차 본번호 그대로. */
function mCarry(target: number, drawsMap: Record<number, Draw>): number[] {
  const prev = drawsMap[target - 1];
  return prev ? [...prev.nums] : [];
}

/** 이웃수 — 직전 회차 본번호의 ±1 (자기 자신 제외). */
function mNeighbor(target: number, drawsMap: Record<number, Draw>): number[] {
  const prev = drawsMap[target - 1];
  if (!prev) return [];
  const set = new Set<number>();
  for (const n of prev.nums) {
    if (n > 1) set.add(n - 1);
    if (n < 45) set.add(n + 1);
  }
  for (const n of prev.nums) set.delete(n);
  return [...set];
}

/** -45 분석 — 직전 회차 본번호+보너스의 45-N. 보너스 기여는 0.5 weight. */
function mComplement(target: number, drawsMap: Record<number, Draw>): RecW[] {
  const prev = drawsMap[target - 1];
  if (!prev) return [];
  // 본번호에서 도출되는 45-N (weight 1)
  const fromNums = new Set<number>();
  for (const n of prev.nums) {
    const c = 45 - n;
    if (c >= 1 && c <= 45) fromNums.add(c);
  }
  const result: RecW[] = [];
  for (const c of fromNums) result.push({ n: c, w: 1 });
  // 보너스에서 도출되는 45-N — 본번호 기여와 중복되지 않으면 weight 0.5
  const cb = 45 - prev.bonus;
  if (cb >= 1 && cb <= 45 && !fromNums.has(cb)) {
    result.push({ n: cb, w: 0.5 });
  }
  return result;
}

/** 동일날짜 — 같은 양력 월/일에 추첨된 과거 회차들의 본번호 union. */
function mSameDate(target: number, drawsMap: Record<number, Draw>): number[] {
  // target의 날짜 결정: 실제 회차가 있으면 그 날짜, 없으면 직전+7일
  let targetDate: string | null = null;
  if (drawsMap[target]) {
    targetDate = drawsMap[target].date;
  } else if (drawsMap[target - 1]) {
    const [y, m, d] = drawsMap[target - 1].date.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 7));
    targetDate = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
  }
  if (!targetDate) return [];
  const [, mm, dd] = targetDate.split('-');
  const set = new Set<number>();
  for (let r = target - 1; r >= 1; r--) {
    const d = drawsMap[r];
    if (!d) continue;
    const parts = d.date.split('-');
    if (parts[1] === mm && parts[2] === dd) {
      for (const n of d.nums) set.add(n);
    }
  }
  return [...set];
}

/** 궁합수 Lift — 직전 회차 6개 각각의 Top 5 Lift companions union. */
function mCompatLift(target: number, drawsMap: Record<number, Draw>): number[] {
  const prev = drawsMap[target - 1];
  if (!prev) return [];
  // 1..target-1 의 동시출현 매트릭스 + 빈도
  const co: number[][] = Array.from({ length: 46 }, () => new Array(46).fill(0));
  const freq = new Array(46).fill(0);
  let total = 0;
  for (let r = 1; r <= target - 1; r++) {
    const d = drawsMap[r];
    if (!d) continue;
    total++;
    const ns = d.nums;
    for (const n of ns) freq[n]++;
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        co[ns[i]][ns[j]]++;
        co[ns[j]][ns[i]]++;
      }
    }
  }
  if (total === 0) return [];
  const set = new Set<number>();
  for (const p of prev.nums) {
    const cands: { n: number; lift: number }[] = [];
    for (let n = 1; n <= 45; n++) {
      if (n === p) continue;
      const expected = (freq[n] * freq[p]) / total;
      const lift = (co[p][n] + 1) / (expected + 1);
      cands.push({ n, lift });
    }
    cands.sort((a, b) => b.lift - a.lift);
    for (let i = 0; i < 5 && i < cands.length; i++) set.add(cands[i].n);
  }
  return [...set];
}

/** target 시점의 최근 연속 K-회귀 streak ranking (K=1..50). */
function getRegRanking(target: number, drawsMap: Record<number, Draw>): { k: number; streak: number }[] {
  // newest-first 배열 (1..target-1)
  const arr: Draw[] = [];
  for (let r = target - 1; r >= Math.max(1, target - 500); r--) {
    const d = drawsMap[r];
    if (d) arr.push(d);
  }
  if (arr.length < 2) return [];

  const ranking: { k: number; streak: number }[] = [];
  for (let k = 1; k <= 50; k++) {
    let streak = 0;
    for (let i = 0; i < arr.length - k; i++) {
      const t = arr[i];
      const s = arr[i + k];
      const sSet = new Set(s.nums);
      let hit = false;
      for (const n of t.nums) if (sSet.has(n)) { hit = true; break; }
      if (hit) streak++;
      else break;
    }
    if (streak >= 1) ranking.push({ k, streak });
  }
  ranking.sort((a, b) => b.streak - a.streak || a.k - b.k);
  return ranking;
}

/** 회귀 rank N의 source(target - K) 본번호. */
function mRegRank(target: number, drawsMap: Record<number, Draw>, rankIdx: number): number[] {
  const ranking = getRegRanking(target, drawsMap);
  const r = ranking[rankIdx];
  if (!r) return [];
  const src = drawsMap[target - r.k];
  return src ? [...src.nums] : [];
}

const mReg1 = (t: number, m: Record<number, Draw>) => mRegRank(t, m, 0);
const mReg2 = (t: number, m: Record<number, Draw>) => mRegRank(t, m, 1);
const mReg3 = (t: number, m: Record<number, Draw>) => mRegRank(t, m, 2);

/* ─── 비밀 메소드 — 끝수 & 시루 (의도적으로 익명화) ───────────────── */

function pickTop3Endings(freq: number[]): number[] {
  return freq
    .map((c, i) => ({ d: i, c }))
    .sort((a, b) => b.c - a.c || a.d - b.d)
    .slice(0, 3)
    .map((x) => x.d)
    .sort((a, b) => a - b);
}

/** 끝수 — A·B 추천 끝수에 해당하는 1~45 전체 번호. */
function mEndings(target: number, drawsMap: Record<number, Draw>): number[] {
  const prev = drawsMap[target - 1];
  if (!prev) return [];
  const pool = new Set(prev.nums);
  const xs: number[] = [];
  for (let r = 1; r < prev.round; r++) {
    const d = drawsMap[r];
    if (!d) continue;
    let s = 0;
    for (const n of d.nums) if (pool.has(n)) s++;
    if (s >= 3) xs.push(r);
  }
  if (xs.length === 0) return [];

  const f1 = new Array(10).fill(0);
  for (const r of xs) {
    const d = drawsMap[r];
    if (!d) continue;
    for (const n of d.nums) f1[n % 10]++;
  }
  const a = pickTop3Endings(f1);

  const f2 = new Array(10).fill(0);
  let yc = 0;
  for (const r of xs) {
    const d = drawsMap[r + 1];
    if (!d) continue;
    yc++;
    for (const n of d.nums) f2[n % 10]++;
  }
  const b = yc > 0 ? pickTop3Endings(f2) : [];

  const endingSet = new Set<number>([...a, ...b]);
  const out: number[] = [];
  for (let n = 1; n <= 45; n++) {
    if (endingSet.has(n % 10)) out.push(n);
  }
  return out;
}

/** 시루 — 직전 회차 7개의 두 윈도우 aggregate TOP5 합집합 외 번호. 보너스 weight 0.5. */
function mSiru(target: number, drawsMap: Record<number, Draw>): number[] {
  const prev = drawsMap[target - 1];
  if (!prev) return [];
  // 본번호 6개 (w=1) + 보너스볼 (w=0.5, 본번호와 중복 아닐 때만)
  const psW: { n: number; w: number }[] = prev.nums.map((n) => ({ n, w: 1 }));
  if (!prev.nums.includes(prev.bonus)) psW.push({ n: prev.bonus, w: 0.5 });

  const z = 5;
  const upper = prev.round;
  const lower = upper - 299;

  const w1 = new Array(46).fill(0);
  const w2 = new Array(46).fill(0);
  let any = false;
  for (let r = 1; r <= upper; r++) {
    const d = drawsMap[r];
    if (!d) continue;
    any = true;
    const ns = d.nums;
    const inLow = r >= lower;
    let cnt = 0;
    for (const p of psW) if (ns.includes(p.n)) cnt += p.w;
    if (cnt === 0) continue;
    for (const y of ns) {
      let adj = 0;
      for (const p of psW) if (p.n === y) { adj = p.w; break; }
      const c = cnt - adj;
      if (c > 0) {
        w1[y] += c;
        if (inLow) w2[y] += c;
      }
    }
  }
  if (!any) return [];

  const s1: { y: number; c: number }[] = [];
  const s2: { y: number; c: number }[] = [];
  for (let y = 1; y <= 45; y++) {
    s1.push({ y, c: w1[y] });
    s2.push({ y, c: w2[y] });
  }
  s1.sort((a, b) => b.c - a.c || a.y - b.y);
  s2.sort((a, b) => b.c - a.c || a.y - b.y);

  const seen = new Set<number>();
  for (let i = 0; i < z && i < s1.length; i++) seen.add(s1[i].y);
  for (let i = 0; i < z && i < s2.length; i++) seen.add(s2[i].y);

  const out: number[] = [];
  for (let n = 1; n <= 45; n++) if (!seen.has(n)) out.push(n);
  return out;
}

/* ─── 메소드 카탈로그 ─────────────────────────────────────── */

const METHODS: { id: string; label: string; fn: MethodFn }[] = [
  { id: 'hot',       label: 'Hot 빈도',     fn: mHot },
  { id: 'cold',      label: '잠수번호',     fn: mCold },
  { id: 'carry',     label: '이월수',       fn: mCarry },
  { id: 'neighbor',  label: '이웃수',       fn: mNeighbor },
  { id: 'complement',label: '-45 분석',     fn: mComplement },
  { id: 'samedate',  label: '동일날짜',     fn: mSameDate },
  { id: 'compat',    label: '궁합수 Lift',  fn: mCompatLift },
  { id: 'reg1',      label: '회귀 1등',     fn: mReg1 },
  { id: 'reg2',      label: '회귀 2등',     fn: mReg2 },
  { id: 'reg3',      label: '회귀 3등',     fn: mReg3 },
  { id: 'endings',   label: '끝수',         fn: mEndings },
  { id: 'siru',      label: '시루',         fn: mSiru },
];

/* ═══════════════════════════════════════════════════════════════════════════
   메인 페이지
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ProPredict() {
  const isPro = useProGuard();
  const t = useTheme();
  const goBack = useSafeBack('/pro-analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);
  const latestDraw = useHistory((s) => s.getLatest());

  const upcomingRound = latestRound + 1;
  const [round, setRound] = useState<number>(upcomingRound);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInput, setPickerInput] = useState('');


  const isUpcoming = round === upcomingRound;

  /**
   * 앙상블 (단순화 V2) — Lift 가중 voting + Train(60) / Test(30) 분리.
   *
   *   - 제거된 기법: per-number prior, anti-recommend, decorrelation, stacking
   *     (overfitting 위험 + train/test 사이즈에서 통계적 검증 어려움)
   *   - 유지: train/test 분리 (정확도 측정의 honesty), lift 가중치
   *   - 확장: train 30 → 60 (lift 추정 안정화)
   *
   * No-future-leakage: 모든 데이터가 target round 이전 90회차 안에서만 사용.
   */
  const ensemble = useMemo(() => {
    type BT = {
      id: string; label: string;
      avgHits: number; avgRecsSize: number;
      precision: number; lift: number; rounds: number;
    };

    // Windows
    const targetForBT = round > latestRound ? latestRound + 1 : round;
    const testEnd = targetForBT - 1;
    const testStart = Math.max(earliestRound + 1, testEnd - TEST_N + 1);
    const trainEnd = testStart - 1;
    const trainStart = Math.max(earliestRound + 1, trainEnd - TRAIN_N + 1);

    const empty = {
      backtest: [] as BT[],
      prediction: [] as { n: number; score: number; methods: string[] }[],
      overallAccuracy: { avg: 0, rounds: 0 },
    };
    if (trainStart > trainEnd || testStart > testEnd) return empty;

    // Train backtest: 메소드별 가중 적중 / 가중 추천 수 / lift
    // (보너스볼 기여는 w=0.5로 hits·size 양쪽에 동일 적용)
    const backtest: BT[] = [];
    for (const m of METHODS) {
      let totalHits = 0, totalSize = 0, rounds = 0;
      for (let r = trainStart; r <= trainEnd; r++) {
        const actual = drawsMap[r];
        if (!actual) continue;
        const recs = asWeighted(m.fn(r, drawsMap));
        if (recs.length === 0) continue;
        const actSet = new Set(actual.nums);
        let hitW = 0, totalW = 0;
        for (const rec of recs) {
          totalW += rec.w;
          if (actSet.has(rec.n)) hitW += rec.w;
        }
        totalHits += hitW;
        totalSize += totalW;
        rounds++;
      }
      const avgHits = rounds > 0 ? totalHits / rounds : 0;
      const avgRecsSize = rounds > 0 ? totalSize / rounds : 0;
      const precision = avgRecsSize > 0 ? avgHits / avgRecsSize : 0;
      const lift = precision / RANDOM;
      backtest.push({ id: m.id, label: m.label, avgHits, avgRecsSize, precision, lift, rounds });
    }
    const btMap = new Map(backtest.map((b) => [b.id, b]));

    // Scoring — lift × rec.w 가중 voting (보너스 기여는 자동 0.5)
    const scoreRound = (recsByMethod: Map<string, RecW[]>) => {
      const scores: { n: number; score: number }[] = [];
      for (let n = 1; n <= 45; n++) scores.push({ n, score: 0 });
      for (const m of METHODS) {
        const recs = recsByMethod.get(m.id) ?? [];
        const bt = btMap.get(m.id);
        if (!bt) continue;
        const weight = Math.max(0.1, Math.min(5, bt.lift));
        for (const rec of recs) {
          scores[rec.n - 1].score += weight * rec.w;
        }
      }
      scores.sort((a, b) => b.score - a.score || a.n - b.n);
      return scores;
    };

    // Test accuracy (display) — 본번호 일치 = 1.0, 보너스 일치 = 0.5
    // (최대 6.5점 / 라운드)
    let totalHits = 0, testedRounds = 0;
    for (let r = testStart; r <= testEnd; r++) {
      const actual = drawsMap[r];
      if (!actual) continue;
      const recs = new Map<string, RecW[]>();
      for (const m of METHODS) recs.set(m.id, asWeighted(m.fn(r, drawsMap)));
      const top = scoreRound(recs).slice(0, TOP_PICKS).map((x) => x.n);
      const actSet = new Set(actual.nums);
      let hits = 0;
      for (const n of top) {
        if (actSet.has(n)) hits += 1;
        else if (n === actual.bonus) hits += 0.5;
      }
      totalHits += hits;
      testedRounds++;
    }
    const overallAccuracy = {
      avg: testedRounds > 0 ? totalHits / testedRounds : 0,
      rounds: testedRounds,
    };

    // Prediction at target round
    const targetRecs = new Map<string, RecW[]>();
    for (const m of METHODS) targetRecs.set(m.id, asWeighted(m.fn(round, drawsMap)));
    const allScores = scoreRound(targetRecs);

    const methodsVoted = new Map<number, string[]>();
    for (const m of METHODS) {
      const recs = targetRecs.get(m.id) ?? [];
      for (const rec of recs) {
        if (!methodsVoted.has(rec.n)) methodsVoted.set(rec.n, []);
        methodsVoted.get(rec.n)!.push(m.label);
      }
    }

    // 점수 desc로 TOP 20 선정 후, 화면 표시는 작은 수 → 큰 수로 정렬
    const prediction = allScores
      .slice(0, TOP_PICKS)
      .map((s) => ({
        n: s.n,
        score: s.score,
        methods: methodsVoted.get(s.n) ?? [],
      }))
      .sort((a, b) => a.n - b.n);

    return { backtest, prediction, overallAccuracy };
  }, [round, drawsMap, latestRound, earliestRound]);

  const { backtest, prediction, overallAccuracy } = ensemble;

  /** 분석 대상 회차 정보. */
  const targetInfo = useMemo(() => {
    if (isUpcoming) {
      if (!latestDraw) return null;
      const [y, m, d] = latestDraw.date.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + 7));
      const date = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      return { round: upcomingRound, date, nums: null as number[] | null, bonus: 0 };
    }
    const d = drawsMap[round];
    return d ? { round: d.round, date: d.date, nums: d.nums, bonus: d.bonus } : null;
  }, [round, isUpcoming, drawsMap, latestDraw, upcomingRound]);

  /** 분석 대상이 추첨 완료된 회차이면 본번호+보너스 적중 (보너스=0.5). */
  const targetHits = useMemo(() => {
    if (!targetInfo || !targetInfo.nums) return null;
    const predSet = new Set(prediction.map((p) => p.n));
    const mainHits = targetInfo.nums.filter((n) => predSet.has(n));
    const bonusHit = predSet.has(targetInfo.bonus);
    const score = mainHits.length + (bonusHit ? 0.5 : 0);
    return { mainHits, bonusHit, score };
  }, [targetInfo, prediction]);

  /** 예상 제외수 3개 — 직전 회차 + 누적 회차 기반. */
  const exclusion = useMemo(() => {
    const prev = drawsMap[round - 1] ?? null;
    const history: Draw[] = [];
    for (let r = earliestRound; r < round; r++) {
      if (drawsMap[r]) history.push(drawsMap[r]);
    }
    const picks = computeExclusionPicks(prev, history, 3);

    // 분석 대상 회차가 추첨 완료 상태면 적중 개수 측정
    let hits: number | null = null;
    let hitNums: number[] = [];
    if (targetInfo?.nums) {
      const tSet = new Set(targetInfo.nums);
      hitNums = picks.filter((n) => tSet.has(n));
      hits = hitNums.length;
    }

    return { picks, hits, hitNums };
  }, [round, drawsMap, earliestRound, targetInfo]);

  /** 제외수 백테스트 (최근 30회) — latestRound 변경 시 1회만 계산. */
  const exclusionBacktest = useMemo(() => {
    return backtestExclusion(drawsMap, latestRound, 30);
  }, [drawsMap, latestRound]);

  const goPrev = () => { if (round > earliestRound) setRound(round - 1); };
  const goNext = () => { if (round < upcomingRound) setRound(round + 1); };

  const jumpTo = (n: number) => {
    const clamped = Math.max(earliestRound, Math.min(upcomingRound, Math.round(n)));
    setRound(clamped);
    setPickerOpen(false);
    setPickerInput('');
  };
  const submitPicker = () => {
    const n = parseInt(pickerInput.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(n)) return;
    jumpTo(n);
  };


  if (!targetInfo) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
        <AppBar
          title={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon.crown color={GOLD} size={18} weight={2} />
              <T variant="heading1" color="primary">핀더 예상 제외수</T>
            </View>
          }
          onBack={goBack}
        />
        <View style={styles.empty}>
          <T variant="body2r" color="tertiary">회차 데이터를 찾을 수 없어요.</T>
        </View>
      </SafeAreaView>
    );
  }

  const actualSet = targetInfo.nums ? new Set(targetInfo.nums) : null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon.crown color={GOLD} size={18} weight={2} />
            <T variant="heading1" color="primary">핀더 예상 제외수</T>
          </View>
        }
        onBack={goBack}
      />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>

        {/* 분석 대상 hero — 일반모드 "분석법 비교" 디자인과 통일 */}
        <View style={[styles.hero, { backgroundColor: t.bgHero }]}>
          <View style={styles.heroNav}>
            <Pressable
              onPress={goPrev}
              disabled={round <= earliestRound}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: t.bgOnHeroPill,
                opacity: round <= earliestRound ? 0.3 : pressed ? 0.7 : 1,
              }]}
            >
              <Icon.chevLeft color={t.fgOnHero} size={20} weight={2.5} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              {isUpcoming ? (
                <View style={styles.upcomingPill}>
                  <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 }}>
                    🔮 추첨 예정
                  </T>
                </View>
              ) : (
                <T variant="caption1" style={{ color: t.fgOnHeroMuted }}>분석 대상</T>
              )}
              <T variant="title3" style={{ color: t.fgOnHero, fontWeight: '800', marginTop: 4 }}>
                제 {targetInfo.round}회
              </T>
              <T variant="caption1" style={{ color: t.fgOnHeroFaint, marginTop: 2 }}>
                {targetInfo.date}{isUpcoming ? ' (예정)' : ''}
              </T>
            </View>
            <Pressable
              onPress={goNext}
              disabled={round >= upcomingRound}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: t.bgOnHeroPill,
                opacity: round >= upcomingRound ? 0.3 : pressed ? 0.7 : 1,
              }]}
            >
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <Icon.chevLeft color={t.fgOnHero} size={20} weight={2.5} />
              </View>
            </Pressable>
          </View>
          <View style={{ marginTop: 14, alignItems: 'center' }}>
            {isUpcoming || !targetInfo.nums ? (
              <View style={[styles.upcomingNumsBox, { backgroundColor: t.bgOnHeroPill, borderColor: t.borderOnHero }]}>
                <T variant="label1n" style={{ color: t.fgOnHero, textAlign: 'center', fontWeight: '700' }}>
                  당첨번호 발표 전
                </T>
              </View>
            ) : (
              <BallRow nums={targetInfo.nums} bonus={targetInfo.bonus} size="sm" style={{ gap: 4 }} />
            )}
          </View>
        </View>

        {/* 빠른 회차 이동 */}
        <View style={styles.jumpRow}>
          <JumpBtn
            label={`최신 ${latestRound}회`}
            active={round === latestRound}
            onPress={() => setRound(latestRound)}
          />
          <JumpBtn
            label={`분석 ${upcomingRound}회`}
            active={round === upcomingRound}
            onPress={() => setRound(upcomingRound)}
            tone="upcoming"
          />
          <JumpBtn
            label="회차 입력"
            active={false}
            onPress={() => { setPickerInput(String(round)); setPickerOpen(true); }}
            tone="input"
          />
        </View>

        {/* 핀더 예상 제외수 20수 카드 */}
        <Card padding={16}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                🌟 핀더 예상 제외수 20수
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                통계상 출현률 높은 20개 번호
              </T>
            </View>
            {targetHits != null && (() => {
              const display = targetHits.bonusHit
                ? `${targetHits.mainHits.length}.5`
                : `${targetHits.mainHits.length}`;
              const bg = targetHits.score >= 3.5 ? palette.red500
                       : targetHits.score >= 2 ? '#ea580c'
                       : '#888';
              return (
                <View style={[styles.hitBadge, { backgroundColor: bg }]}>
                  <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                    {display} / 6.5
                  </T>
                  <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 9, fontWeight: '700', opacity: 0.85, marginTop: -2 }}>
                    적중
                  </T>
                </View>
              );
            })()}
          </View>

          {/* 5×4 그리드 — 번호 작은 수부터 큰 수 순 */}
          <View style={styles.predGrid}>
            {prediction.map((p) => {
              const isMain = actualSet?.has(p.n);
              const isBonus = !isMain && targetInfo?.bonus != null && p.n === targetInfo.bonus;
              return (
                <View key={p.n} style={styles.predCell}>
                  <Ball
                    n={p.n}
                    size="md"
                    dashedRing={isMain || isBonus}
                    dashedRingColor={isMain ? palette.red500 : isBonus ? palette.purple500 : undefined}
                  />
                </View>
              );
            })}
          </View>

          {targetHits != null && (
            <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 8, textAlign: 'center' }}>
              ✦ 🔴 빨간 점선 = 본번호 일치 (+1) · 🟣 보라 점선 = 보너스볼 일치 (+0.5)
              {targetHits.mainHits.length > 0 && ` · 본번호 ${targetHits.mainHits.join(', ')}`}
              {targetHits.bonusHit && ` · 보너스 ${targetInfo?.bonus}`}
            </T>
          )}

          {/* 최근 회차 평균 매칭 */}
          <View style={styles.exclusionStatBox}>
            <T variant="caption1" color="primary" style={{ fontWeight: '700', fontSize: 11.5, marginBottom: 8 }}>
              📊 최근 회차 평균 매칭
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <T
                variant="title2"
                allowFontScaling={false}
                style={{
                  fontWeight: '900',
                  color: overallAccuracy.avg >= 3 ? palette.red500
                       : overallAccuracy.avg >= 2.5 ? GOLD_DARK
                       : t.fgSecondary,
                }}
              >
                {overallAccuracy.avg.toFixed(2)}개
              </T>
              <T variant="caption1" color="tertiary" style={{ fontSize: 12 }}>
                평균 적중 / 6.5개 만점 (보너스 0.5)
              </T>
            </View>
          </View>
        </Card>

        {/* 예상 제외수 3개 카드 */}
        <Card padding={16}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                🚫 예상 제외수 3개
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                통계상 출현률 낮은 3개 번호
              </T>
            </View>
            {exclusion.hits != null && (
              <View
                style={[
                  styles.hitBadge,
                  {
                    backgroundColor:
                      exclusion.hits === 0 ? palette.green700
                      : exclusion.hits === 1 ? '#888'
                      : exclusion.hits === 2 ? '#ea580c'
                      : palette.red500,
                  },
                ]}
              >
                <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                  {exclusion.hits}개
                </T>
                <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 9, fontWeight: '700', opacity: 0.85, marginTop: -2 }}>
                  적중
                </T>
              </View>
            )}
          </View>

          {/* 제외수 3개 가로 나열 */}
          <View style={styles.exclusionRow}>
            {exclusion.picks.length === 0 ? (
              <T variant="caption1" color="tertiary" style={{ fontStyle: 'italic' }}>
                직전 회차 데이터 부족
              </T>
            ) : (
              exclusion.picks.map((n) => {
                const isHit = exclusion.hitNums.includes(n);
                return (
                  <View key={n} style={styles.exclusionCell}>
                    <Ball
                      n={n}
                      size="lg"
                      dashedRing={isHit}
                      dashedRingColor={isHit ? palette.red500 : undefined}
                    />
                    {isHit && (
                      <T variant="caption2" allowFontScaling={false} style={{ color: palette.red500, fontSize: 10, fontWeight: '800', marginTop: 4 }}>
                        출현
                      </T>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* 최근 회차 적중 분포 */}
          {exclusionBacktest.windowSize > 0 && (
            <View style={styles.exclusionStatBox}>
              <T variant="caption1" color="primary" style={{ fontWeight: '700', fontSize: 11.5, marginBottom: 8 }}>
                최근 회차 적중 분포
              </T>
              <View style={styles.exclusionStatRow}>
                <StatChip label="0개" count={exclusionBacktest.hit0} total={exclusionBacktest.windowSize} tone="success" />
                <StatChip label="1개" count={exclusionBacktest.hit1} total={exclusionBacktest.windowSize} tone="neutral" />
                <StatChip label="2개" count={exclusionBacktest.hit2} total={exclusionBacktest.windowSize} tone="warning" />
                <StatChip label="3개" count={exclusionBacktest.hit3} total={exclusionBacktest.windowSize} tone="danger" />
              </View>
              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, marginTop: 6 }}>
                ✓ 적중 0개 = 제외 성공 · 통계 분석 결과로 당첨을 보장하지 않음
              </T>
            </View>
          )}
        </Card>

        <Disclaimer />
      </ScrollView>

      {/* 회차 점프 모달 */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.modalWrap} pointerEvents="box-none">
          <View style={[styles.modalSheet, { backgroundColor: t.bgSurface }]}>
            <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>회차로 이동</T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
              {earliestRound}회 ~ {upcomingRound}회 (분석 예정 포함)
            </T>
            <View style={[styles.pickerRow, { borderColor: t.borderNormal, backgroundColor: t.bgSurface2 }]}>
              <TextInput
                value={pickerInput}
                onChangeText={(v) => setPickerInput(v.replace(/[^0-9]/g, '').slice(0, 5))}
                onSubmitEditing={submitPicker}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder={`회차 수 입력 (예: ${latestRound})`}
                placeholderTextColor={t.fgTertiary}
                style={[styles.pickerInput, { color: t.fgPrimary }]}
                returnKeyType="go"
              />
              <Pressable
                onPress={submitPicker}
                style={({ pressed }) => [styles.goBtn, { backgroundColor: palette.blue500, opacity: pressed ? 0.85 : 1 }]}
              >
                <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800' }}>이동</T>
              </Pressable>
            </View>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={6} style={{ marginTop: 12, alignSelf: 'center' }}>
              <T variant="caption1" color="tertiary" style={{ fontWeight: '600' }}>취소</T>
            </Pressable>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

/** 백테스트 분포 칩 — "0개 21회" 같이 라벨+카운트 표시. */
function StatChip({ label, count, total, tone }: {
  label: string; count: number; total: number;
  tone: 'success' | 'neutral' | 'warning' | 'danger';
}) {
  const color =
    tone === 'success' ? palette.green700 :
    tone === 'warning' ? '#ea580c' :
    tone === 'danger'  ? palette.red500 :
    /* neutral */         '#888';
  const bg =
    tone === 'success' ? 'rgba(0,191,64,0.12)' :
    tone === 'warning' ? 'rgba(234,88,12,0.12)' :
    tone === 'danger'  ? 'rgba(248,72,79,0.12)' :
    /* neutral */         'rgba(127,127,127,0.10)';
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={{
      flex: 1,
      backgroundColor: bg,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: radius.md,
      alignItems: 'center',
    }}>
      <T variant="caption2" allowFontScaling={false} style={{ color, fontSize: 10, fontWeight: '700' }}>
        {label}
      </T>
      <T variant="label1n" allowFontScaling={false} style={{ color, fontSize: 16, fontWeight: '900', marginTop: 2 }}>
        {count}
      </T>
      <T variant="caption2" allowFontScaling={false} style={{ color, fontSize: 9, opacity: 0.7, marginTop: 1 }}>
        {pct}%
      </T>
    </View>
  );
}

function JumpBtn({ label, active, onPress, tone }: {
  label: string; active: boolean; onPress: () => void;
  tone?: 'upcoming' | 'input';
}) {
  const t = useTheme();
  const activeBg = tone === 'upcoming' ? palette.purple500 : palette.blue500;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.jumpBtn, {
        backgroundColor: active ? activeBg : t.bgSurface,
        borderColor: active ? 'transparent' : t.borderWeak,
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <T variant="caption1" style={{ color: active ? '#fff' : t.fgSecondary, fontWeight: '700' }} allowFontScaling={false}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  hero: { borderRadius: radius.xl, padding: 18 },
  heroNav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // 회차 이동 버튼 — 둥근 사각형 + Icon.chevLeft (일반모드 분석법 비교와 동일)
  navArrow: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  upcomingPill: {
    backgroundColor: palette.purple500,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99,
  },
  // "당첨번호 발표 전" 박스 — 예정 회차 또는 데이터 없을 때
  upcomingNumsBox: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    width: '100%',
  },

  jumpRow: { flexDirection: 'row', gap: 6 },
  jumpBtn: {
    flex: 1, height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hitBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    minWidth: 60,
  },

  predGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 14,
  },

  // 예상 제외수 카드
  exclusionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 14,
    marginBottom: 8,
  },
  exclusionCell: {
    alignItems: 'center',
  },
  exclusionStatBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(127,127,127,0.15)',
  },
  exclusionStatRow: {
    flexDirection: 'row',
    gap: 6,
  },
  predCell: {
    width: '20%',
    alignItems: 'center',
    paddingVertical: 6,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },

  // 추천 조합 카드 (pro-compat/pro-filter와 통일)
  comboActions: {
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
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  comboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
  },

  // 회차 점프 모달
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xl,
    padding: 20,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  pickerInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 8,
    outlineStyle: 'none' as any,
  },
  goBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
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
