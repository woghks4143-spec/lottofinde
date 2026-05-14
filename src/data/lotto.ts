/**
 * Pure functions for the 6/45 lotto math used across the app — sum, tail-sum
 * (끝수합), AC (arithmetic complexity), odd/even split, consecutive runs, hits
 * count vs. a winning row. Same definitions the user already uses in their
 * Excel sheets so on-screen numbers match.
 */

export type Numbers6 = [number, number, number, number, number, number];

/** Sort ascending and return a new tuple. */
export function sort6(ns: number[]): Numbers6 {
  if (ns.length !== 6) throw new Error('expected 6 numbers');
  return [...ns].sort((a, b) => a - b) as Numbers6;
}

/** Plain sum. */
export function total(ns: number[]): number {
  return ns.reduce((s, n) => s + n, 0);
}

/** 끝수합 — sum of ones-digits (n % 10). Also called 일의자리합. */
export function tailSum(ns: number[]): number {
  return ns.reduce((s, n) => s + (n % 10), 0);
}

/** 십의자리합 — sum of tens-digits (floor(n / 10)). */
export function tensSum(ns: number[]): number {
  return ns.reduce((s, n) => s + Math.floor(n / 10), 0);
}

/**
 * 앞세수합 — sum of the three smallest of the six.
 * Independent of the input order; we sort defensively.
 */
export function firstThreeSum(ns: number[]): number {
  const sorted = [...ns].sort((a, b) => a - b);
  return sorted.slice(0, 3).reduce((s, n) => s + n, 0);
}

/** 뒷세수합 — sum of the three largest of the six. */
export function lastThreeSum(ns: number[]): number {
  const sorted = [...ns].sort((a, b) => a - b);
  return sorted.slice(-3).reduce((s, n) => s + n, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 수학적 특성 분석 — 소수 / 합성수 / 완전제곱수 / 배수 / 끝자리 / 연속·연번

/** 1~45 범위 소수 (총 14개). 자주 쓰여서 상수로. */
export const PRIMES_1_45: ReadonlyArray<number> =
  [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];

/** 1~45 범위 완전제곱수 (총 6개). 1=1², 4=2², 9=3², 16=4², 25=5², 36=6². */
export const PERFECT_SQUARES_1_45: ReadonlyArray<number> =
  [1, 4, 9, 16, 25, 36];

const PRIME_SET = new Set<number>(PRIMES_1_45);
const SQUARE_SET = new Set<number>(PERFECT_SQUARES_1_45);

/** 표준편차 — 분산도. 6개 번호가 얼마나 흩어져 있는지. */
export function stdDev(ns: number[]): number {
  const n = ns.length;
  if (n === 0) return 0;
  const mean = ns.reduce((s, x) => s + x, 0) / n;
  const variance = ns.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

/** 조합 안의 소수 번호들 (2, 3, 5, …). */
export function primesIn(ns: number[]): number[] {
  return ns.filter((n) => PRIME_SET.has(n));
}

/** 조합 안의 합성수 번호들 (1, 소수 제외 = 4, 6, 8, 9, 10, …). */
export function compositesIn(ns: number[]): number[] {
  return ns.filter((n) => n !== 1 && !PRIME_SET.has(n));
}

/** 조합 안의 완전제곱수 번호들. */
export function perfectSquaresIn(ns: number[]): number[] {
  return ns.filter((n) => SQUARE_SET.has(n));
}

/** 특정 수의 배수에 해당하는 번호들. */
export function multiplesOf(ns: number[], k: number): number[] {
  if (k <= 0) return [];
  return ns.filter((n) => n % k === 0);
}

/**
 * 끝자리별 그룹 — `{0: [10,20,...], 1: [1,11,...], ...}` 형태.
 * 영상 참조 앱의 "동일 끝수: (6) 1수" 같은 표시에 활용.
 */
export function tailDigitGroups(ns: number[]): Record<number, number[]> {
  const g: Record<number, number[]> = {};
  for (const n of ns) {
    const d = n % 10;
    (g[d] ??= []).push(n);
  }
  return g;
}

/**
 * 끝자리 중복이 있는 자리들의 요약.
 *   [3, 13, 23] → [{ digit: 3, nums: [3,13,23] }]
 *   [1, 11, 22] → [{ digit: 1, nums: [1,11] }] (22는 단독이라 제외)
 */
export function tailDigitDupes(ns: number[]): Array<{ digit: number; nums: number[] }> {
  const g = tailDigitGroups(ns);
  return Object.entries(g)
    .filter(([_, arr]) => arr.length >= 2)
    .map(([d, arr]) => ({ digit: Number(d), nums: arr }))
    .sort((a, b) => b.nums.length - a.nums.length);
}

/** 정렬된 조합에서 인접한 연속 쌍의 개수 (예: [1,2,3,18] → 2쌍: 1-2, 2-3). */
export function consecutivePairs(ns: number[]): number {
  const sorted = [...ns].sort((a, b) => a - b);
  let pairs = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) pairs++;
  }
  return pairs;
}

/**
 * 길이 ≥ `minLen`인 연속수 묶음(run)의 개수.
 *   - [1,2,3,18,20]      → 1개  (1-2-3 한 묶음)
 *   - [1,2,4,5,7,8]      → 3개  (1-2 / 4-5 / 7-8)
 *   - [1,2,3,4,5,6]      → 1개  (1-2-3-4-5-6 한 묶음)
 *   - [1,2,5,6,9,10]     → 3개
 *   - [3,7,11,15,20,30]  → 0개  (모두 단독)
 *
 * "2연속이 N묶음"·"3연속이 N묶음" 같은 사용자 직관과 일치한다.
 */
export function consecutiveRuns(ns: number[], minLen = 2): number {
  if (ns.length === 0) return 0;
  const sorted = [...ns].sort((a, b) => a - b);
  let runs = 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run++;
    } else {
      if (run >= minLen) runs++;
      run = 1;
    }
  }
  if (run >= minLen) runs++;
  return runs;
}

/**
 * **정확히** 길이 `exactLen`인 연속수 묶음의 개수.
 *
 * 묶음 분류 기준은 "단절"이다 — 더 긴 묶음의 부분은 카운트되지 않는다.
 *   - [1,2,3,4]          → exactLen=4 일 때 1개,  exactLen=2 일 때 0개 (3은 4의 일부)
 *   - [1,2, 5,6, 9,10]   → exactLen=2 일 때 3개,  exactLen=3 일 때 0개
 *   - [1,2,3, 5,6]       → exactLen=3 일 때 1개,  exactLen=2 일 때 1개 (각각 별개)
 *
 * "X연속 묶음이 정확히 N개" 같은 사용자 직관을 그대로 구현.
 */
export function runsOfExactLength(ns: number[], exactLen: number): number {
  if (ns.length === 0 || exactLen < 1) return 0;
  const sorted = [...ns].sort((a, b) => a - b);
  let count = 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run++;
    } else {
      if (run === exactLen) count++;
      run = 1;
    }
  }
  if (run === exactLen) count++;
  return count;
}

/** 길이 ≥ len인 연속 구간이 하나라도 존재하면 true. (예: 3자리 연속) */
export function hasConsecRunOfLength(ns: number[], len: number): boolean {
  return longestConsecutive(ns) >= len;
}

/** 두 회차 번호 집합의 교집합 — 동행수/이월수 계산용. */
export function intersect(a: number[], b: number[]): number[] {
  const set = new Set(b);
  return a.filter((n) => set.has(n));
}

/**
 * 이전 회차 번호의 ±1 범위에 속한 번호들 (이웃수).
 * `withBonus`가 true면 prev.bonus도 포함.
 */
export function neighborsOf(
  combo: number[],
  prev: { nums: number[]; bonus: number },
  withBonus = false,
): number[] {
  const adj = new Set<number>();
  const pool = withBonus ? [...prev.nums, prev.bonus] : prev.nums;
  for (const p of pool) {
    if (p > 1) adj.add(p - 1);
    adj.add(p);
    if (p < 45) adj.add(p + 1);
  }
  return combo.filter((n) => adj.has(n));
}

/** Odd / even split, e.g. [4, 2] for 4 odd + 2 even. */
export function oddEven(ns: number[]): [odd: number, even: number] {
  let odd = 0;
  for (const n of ns) if (n % 2 === 1) odd++;
  return [odd, ns.length - odd];
}

/** Odd:even as a "x:y" label (sorted by larger first). */
export function oddEvenLabel(ns: number[]): string {
  const [odd, even] = oddEven(ns);
  return odd >= even ? `${odd}:${even}` : `${even}:${odd}`;
}

/**
 * 저고 (low/high) split — count of numbers in 1..22 vs 23..45.
 * The 45 numbers split evenly-ish at 22.5. Returns [low, high].
 */
export function highLow(ns: number[]): [low: number, high: number] {
  let low = 0;
  for (const n of ns) if (n <= 22) low++;
  return [low, ns.length - low];
}

/** 저고 as a "x:y" label (low : high, in that order). */
export function highLowLabel(ns: number[]): string {
  const [lo, hi] = highLow(ns);
  return `${lo}:${hi}`;
}

/**
 * Arithmetic Complexity (AC value) — number of distinct positive differences
 * between any 2 of the 6 numbers, minus 5. Range: 0–10. Higher = more "random
 * looking". A 6-consecutive run gives AC=0; six random scattered numbers
 * trends to 9–10.
 */
export function ac(ns: number[]): number {
  if (ns.length !== 6) return 0;
  const diffs = new Set<number>();
  for (let i = 0; i < 6; i++) {
    for (let j = i + 1; j < 6; j++) {
      diffs.add(Math.abs(ns[i] - ns[j]));
    }
  }
  return Math.max(0, diffs.size - 5);
}

/**
 * Longest run of consecutive integers, e.g. [3,4,5,18,30] → 3.
 * Used in simulator's "연속수 최대 N" rule.
 */
export function longestConsecutive(ns: number[]): number {
  const sorted = [...ns].sort((a, b) => a - b);
  let best = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) run++;
    else { if (run > best) best = run; run = 1; }
  }
  return Math.max(best, run);
}

/** Numbers in `pick` that also appear in `winning`. */
export function hits(pick: number[], winning: number[]): number[] {
  const w = new Set(winning);
  return pick.filter((n) => w.has(n));
}

/** Rank for a single ticket against a draw. */
export type Rank = 1 | 2 | 3 | 4 | 5 | null;
export function rank(pick: number[], winning: number[], bonus: number): Rank {
  const h = hits(pick, winning).length;
  const hasBonus = pick.includes(bonus);
  if (h === 6) return 1;
  if (h === 5 && hasBonus) return 2;
  if (h === 5) return 3;
  if (h === 4) return 4;
  if (h === 3) return 5;
  return null;
}

/**
 * Frequency map over a slice of historical draws.
 * Returns count[n] for n=1..45 plus a sorted-desc top list.
 */
export type FreqResult = {
  count: number[];                       // length 46, index 0 unused
  top: Array<{ n: number; c: number }>;  // sorted desc
  bottom: Array<{ n: number; c: number }>;
};

export function frequency(draws: Array<{ nums: number[] }>): FreqResult {
  const count = new Array(46).fill(0);
  for (const d of draws) for (const n of d.nums) count[n]++;
  const ranked = count
    .map((c, n) => ({ n, c }))
    .slice(1) // drop index 0
    .sort((a, b) => b.c - a.c);
  return { count, top: ranked.slice(0, 5), bottom: ranked.slice(-5).reverse() };
}

/**
 * 동시출현(궁합수) 매트릭스 — 46×46 (index 0은 미사용).
 *
 * coMatrix[a][b] = a와 b가 같은 회차에 함께 나온 횟수.
 * 대칭 행렬이고, 대각선은 항상 0 (자기 자신은 카운트하지 않음).
 *
 * 사용 예:
 *   const m = coOccurrence(draws);
 *   // 7번과 가장 자주 함께 나온 번호 5개:
 *   const best = topCompanions(m, 7, 5);
 */
export function coOccurrence(
  draws: Array<{ nums: number[] }>,
): number[][] {
  const m: number[][] = Array.from({ length: 46 }, () => new Array(46).fill(0));
  for (const d of draws) {
    const ns = d.nums;
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j];
        m[a][b]++;
        m[b][a]++;
      }
    }
  }
  return m;
}

/**
 * 어떤 번호 `n`과 가장 자주 함께 나온 번호 top-k.
 * 반환: [{n: 짝번호, c: 함께 나온 횟수}], desc by count.
 */
export function topCompanions(
  coMatrix: number[][],
  n: number,
  k: number,
): Array<{ n: number; c: number }> {
  if (n < 1 || n > 45) return [];
  const row = coMatrix[n];
  const items: Array<{ n: number; c: number }> = [];
  for (let i = 1; i <= 45; i++) {
    if (i === n) continue;
    items.push({ n: i, c: row[i] });
  }
  items.sort((a, b) => b.c - a.c);
  return items.slice(0, k);
}

/**
 * 어떤 번호 `n`과 가장 안 어울린 번호 bottom-k (가장 적게 함께 나온 번호).
 */
export function bottomCompanions(
  coMatrix: number[][],
  n: number,
  k: number,
): Array<{ n: number; c: number }> {
  if (n < 1 || n > 45) return [];
  const row = coMatrix[n];
  const items: Array<{ n: number; c: number }> = [];
  for (let i = 1; i <= 45; i++) {
    if (i === n) continue;
    items.push({ n: i, c: row[i] });
  }
  items.sort((a, b) => a.c - b.c);
  return items.slice(0, k);
}

/**
 * Rounds since last appearance — how many of the most-recent draws each
 * number has been missing from. Used for "잠수번호" callout.
 */
export function roundsMissing(
  draws: Array<{ round: number; nums: number[] }>,
): number[] {
  // Process latest-first.
  const sorted = [...draws].sort((a, b) => b.round - a.round);
  const miss = new Array(46).fill(sorted.length); // default = "never seen"
  for (let i = 0; i < sorted.length; i++) {
    for (const n of sorted[i].nums) {
      if (miss[n] === sorted.length) miss[n] = i; // first time we see it
    }
  }
  return miss;
}

/** 한 등위의 당첨 정보 (1게임당 당첨금 / 당첨자 수). */
export type Prize = {
  /** 1게임당 당첨금 (원). */
  amount: number;
  /** 해당 등위 당첨 게임 수. */
  winners: number;
};

/** 1·2등 당첨 판매점. */
export type WinningStore = {
  /** 1등 또는 2등 배출점. */
  rank: 1 | 2;
  /** 판매점 상호명. */
  name: string;
  /** 소재지. */
  address: string;
  /** 구매 방식. 자동/수동/반자동. 2등은 자료 없음 → 'unknown'. */
  method: 'auto' | 'manual' | 'mixed' | 'unknown';
};

/**
 * A 6/45 ticket as drawn.
 *
 * 필수 필드는 회차/날짜/번호/보너스. 나머지는 동행복권에서 가져오는 부가 정보로,
 * 시드에는 1등 정보까지만 포함되고, 등위별 당첨 정보·판매점은 네이티브에서
 * 페치할 때 채워진다 (`historyStore.enrichRound(n)`).
 */
export type Draw = {
  round: number;
  date: string; // ISO date, e.g. '2025-05-09'
  nums: number[]; // length 6, ascending
  bonus: number;
  /** 1등 1게임당 당첨금. */
  firstWinAmount?: number;
  /** 1등 당첨 게임 수. */
  firstWinners?: number;
  /** 총 판매금액 (원). */
  totalSales?: number;
  /** 1~5등 등위별 당첨 정보 (필요한 등위만 채워짐). */
  prizes?: {
    first?:  Prize;
    second?: Prize;
    third?:  Prize;
    fourth?: Prize;
    fifth?:  Prize;
  };
  /** 1·2등 당첨 판매점 목록. */
  topStores?: WinningStore[];
};
