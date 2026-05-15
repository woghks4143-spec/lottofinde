/**
 * 예상수 10수 분석 — 무료 분석법들을 결합해 다음 회차에 나올 가능성이 있는 10개 번호를 추출.
 *
 * 8가지 분석법이 각자 후보 번호를 투표(+1):
 *   1) Hot       — 최근 30회 출현 빈도 Top 5
 *   2) Cold      — 가장 오래 미출현 Top 3
 *   3) 이월수     — 직전 회차 본번호 6개
 *   4) 이웃수     — 직전 회차 본번호 ±1
 *   5) -45 분석  — 45 − 직전 회차 본번호
 *   6) 동일날짜   — 직전과 동일한 월·일에 추첨된 과거 회차들의 번호
 *   7) 궁합수     — 직전 회차 각 번호의 Top 2 동행수
 *   8) 회귀 분석   — 1~10회귀 누적 carry-over Top 5
 *
 * 최종 점수 = 각 번호가 받은 투표 수. 동점은 작은 번호 우선.
 *
 * 같은 함수로 과거 회차에 대해 호출하면 backtest 가능 — 그 회차 이전 데이터만 사용.
 */
import type { Draw } from '@/src/data/lotto';
import { coOccurrence, frequency, roundsMissing, topCompanions } from '@/src/data/lotto';

export type MethodId =
  | 'hot' | 'cold' | 'carry' | 'neighbor' | 'comp45'
  | 'sameDate' | 'companion' | 'regression';

export const METHOD_META: Record<MethodId, { emoji: string; label: string; short: string }> = {
  hot:        { emoji: '🔥', label: '빈도 (Hot)',   short: '최근 30회 인기' },
  cold:       { emoji: '❄️', label: '미출현 (Cold)', short: '오래 안 나온 잠수' },
  carry:      { emoji: '⚡', label: '이월수',        short: '직전 회차 그대로' },
  neighbor:   { emoji: '🔗', label: '이웃수',        short: '직전 ±1' },
  comp45:     { emoji: '🔄', label: '-45 분석',      short: '45 − 직전 번호' },
  sameDate:   { emoji: '📅', label: '동일날짜',      short: '같은 월·일' },
  companion:  { emoji: '🤝', label: '궁합수',        short: '직전 동행수' },
  regression: { emoji: '🔁', label: '회귀 분석',     short: '1~10회귀 carry' },
};

export type Predict10Result = {
  /** 최종 추천 10개 (오름차순). */
  picks: number[];
  /** 번호별 점수 (1~45). */
  score: number[];
  /** 번호별 투표한 방법 목록. */
  perNumber: Map<number, MethodId[]>;
  /** 각 방법이 낸 후보 번호 목록. */
  methodOutput: Record<MethodId, number[]>;
};

const RECENT_WINDOW = 30;
const REG_K_MAX = 10;
const REG_SAMPLE = 30;

/**
 * 특정 회차 R을 예측 — R 이전 데이터만 사용해 10수 추출.
 *
 * @param drawsMap  전체 회차 맵
 * @param targetRound  예측 대상 회차 (이 회차의 이전 자료만 사용)
 */
export function predict10(
  drawsMap: Record<number, Draw>,
  targetRound: number,
): Predict10Result {
  // R 이전 회차들 (최신 → 과거)
  const before: Draw[] = [];
  for (let r = targetRound - 1; r >= 1; r--) {
    const d = drawsMap[r];
    if (d) before.push(d);
  }
  if (before.length < 2) return emptyResult();

  const prev = before[0]; // 직전 회차
  const recent = before.slice(0, RECENT_WINDOW);

  // 1) Hot — recent 30회 빈도 Top 5
  const freq = frequency(recent);
  const hot = freq.top.slice(0, 5).map((x) => x.n);

  // 2) Cold — 미출현 Top 3
  const missing = roundsMissing(before);
  const cold = Array.from({ length: 45 }, (_, i) => i + 1)
    .map((n) => ({ n, miss: missing[n] ?? 0 }))
    .sort((a, b) => b.miss - a.miss)
    .slice(0, 3)
    .map((x) => x.n);

  // 3) 이월수 — 직전 본번호 6
  const carry = [...prev.nums];

  // 4) 이웃수 — 직전 ±1 (1..45 범위 유지, 직전과 중복 제외)
  const prevSet = new Set(prev.nums);
  const neighborSet = new Set<number>();
  for (const n of prev.nums) {
    if (n > 1 && !prevSet.has(n - 1)) neighborSet.add(n - 1);
    if (n < 45 && !prevSet.has(n + 1)) neighborSet.add(n + 1);
  }
  const neighbor = [...neighborSet].sort((a, b) => a - b);

  // 5) -45 분석 — 45 − 직전 (직전 본번호와 중복은 제외)
  const comp45 = prev.nums
    .map((n) => 45 - n)
    .filter((n) => n >= 1 && n <= 45 && !prevSet.has(n));
  const comp45Uniq = [...new Set(comp45)].sort((a, b) => a - b);

  // 6) 동일날짜 — 직전과 동일한 mm-dd의 과거 회차들 빈도 Top
  const prevDate = parseDate(prev.date);
  const sameDateFreq = new Array(46).fill(0);
  if (prevDate) {
    for (const d of before) {
      if (d.round === prev.round) continue;
      const dd = parseDate(d.date);
      if (dd && dd.m === prevDate.m && dd.d === prevDate.d) {
        for (const n of d.nums) sameDateFreq[n]++;
      }
    }
  }
  const sameDate = sameDateFreq
    .map((s, n) => ({ s, n }))
    .slice(1)
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.n - b.n)
    .slice(0, 6)
    .map((x) => x.n);

  // 7) 궁합수 — 직전 본번호 각각의 Top 2 동행수 (전체 히스토리 기반)
  const coMatrix = coOccurrence(before);
  const companionSet = new Set<number>();
  for (const n of prev.nums) {
    const comps = topCompanions(coMatrix, n, 2);
    for (const c of comps) companionSet.add(c.n);
  }
  // 직전 본번호 자체는 제외
  for (const n of prev.nums) companionSet.delete(n);
  const companion = [...companionSet].sort((a, b) => a - b);

  // 8) 회귀 분석 — k=1..10, 최근 30 쌍에서 carry-over 빈도 누적 Top 5
  const regScore = new Array(46).fill(0);
  for (let k = 1; k <= REG_K_MAX; k++) {
    const limit = Math.min(REG_SAMPLE, before.length - k);
    for (let i = 0; i < limit; i++) {
      const tgt = before[i];
      const src = before[i + k];
      const tgtSet = new Set(tgt.nums);
      for (const n of src.nums) {
        if (tgtSet.has(n)) regScore[n]++;
      }
    }
  }
  const regression = regScore
    .map((s, n) => ({ s, n }))
    .slice(1)
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.n - b.n)
    .slice(0, 5)
    .map((x) => x.n);

  // ─── 집계 ─────────────────────────────────────────────────────────
  const methodOutput: Record<MethodId, number[]> = {
    hot, cold, carry, neighbor, comp45: comp45Uniq,
    sameDate, companion, regression,
  };

  const score = new Array(46).fill(0);
  const perNumber = new Map<number, MethodId[]>();
  for (const [mid, nums] of Object.entries(methodOutput) as Array<[MethodId, number[]]>) {
    for (const n of nums) {
      if (n < 1 || n > 45) continue;
      score[n]++;
      if (!perNumber.has(n)) perNumber.set(n, []);
      perNumber.get(n)!.push(mid);
    }
  }

  // 점수 desc, 동점은 번호 asc로 → 상위 10개 → 번호 asc 정렬
  const picks = score
    .map((s, n) => ({ s, n }))
    .slice(1)
    .sort((a, b) => b.s - a.s || a.n - b.n)
    .slice(0, 10)
    .map((x) => x.n)
    .sort((a, b) => a - b);

  return { picks, score, perNumber, methodOutput };
}

/**
 * Backtest — 지난 N회 동안 매 회차마다 그 이전 데이터로 예측해 보고
 * 실제 당첨번호 6개와 몇 개가 일치했는지 측정.
 */
export type BacktestResult = {
  samples: Array<{ round: number; hits: number; matched: number[] }>;
  /** 평균 적중 (10개 중 몇 개). */
  avgHits: number;
  /** 최고 적중 회차. */
  best: { round: number; hits: number } | null;
  /** hits 분포 [0개, 1개, 2개, ..., 6개]. */
  distribution: number[];
};

export function backtest(
  drawsMap: Record<number, Draw>,
  fromRound: number,
  toRound: number,
): BacktestResult {
  const samples: Array<{ round: number; hits: number; matched: number[] }> = [];
  const dist = [0, 0, 0, 0, 0, 0, 0];

  for (let r = fromRound; r <= toRound; r++) {
    const target = drawsMap[r];
    if (!target) continue;
    const { picks } = predict10(drawsMap, r);
    if (picks.length === 0) continue;
    const pickSet = new Set(picks);
    const matched = target.nums.filter((n) => pickSet.has(n));
    const hits = matched.length;
    samples.push({ round: r, hits, matched });
    if (hits >= 0 && hits <= 6) dist[hits]++;
  }

  const avgHits = samples.length
    ? samples.reduce((a, b) => a + b.hits, 0) / samples.length
    : 0;
  let best: { round: number; hits: number } | null = null;
  for (const s of samples) {
    if (!best || s.hits > best.hits) best = { round: s.round, hits: s.hits };
  }

  return { samples, avgHits, best, distribution: dist };
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────

function parseDate(iso: string): { m: number; d: number } | null {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { m, d };
}

function emptyResult(): Predict10Result {
  return {
    picks: [],
    score: new Array(46).fill(0),
    perNumber: new Map(),
    methodOutput: {
      hot: [], cold: [], carry: [], neighbor: [], comp45: [],
      sameDate: [], companion: [], regression: [],
    },
  };
}
