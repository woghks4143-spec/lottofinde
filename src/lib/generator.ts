/**
 * 번호 생성기 — 5 modes per PRD §5.2.2.
 *
 * - random      : 1~45 완전 랜덤 (Fisher-Yates)
 * - weighted    : 최근 60회 빈도 + Laplace-1 smoothing 비복원 추출
 * - statBased   : 최근 100회 hot + 12회차 이상 미출현 sleeper + 직전 회차 동행수 시드
 * - patternFit  : 합 100-175, 끝수합 18-35, AC≥7, 홀짝 ∈ {3:3,4:2,2:4}, 연속수 ≤2
 * - meaning     : 사용자 시드(생일·기념일 자리수) 우선, 부족분 랜덤
 *
 * Each `generateOne` is deterministic given a seeded RNG, but we use
 * `Math.random` by default for ergonomic UX. The history-dependent modes are
 * idempotent: stale `ctx.history` just produces stale weights, no crashes.
 */
import { ac, frequency, longestConsecutive, oddEven, roundsMissing, sort6, tailSum, total, type Draw } from '@/src/data/lotto';

export type GenMode = 'random' | 'weighted' | 'statBased' | 'patternFit' | 'average' | 'meaning';

export const GEN_MODES: { id: GenMode; label: string; hint: string }[] = [
  { id: 'random',    label: '완전 랜덤',  hint: '1~45 균등 분포로 무작위 추출' },
  { id: 'weighted',  label: '최근 트렌드', hint: '최근 60회에 자주 나온 번호 위주' },
  { id: 'statBased', label: '통계 기반',  hint: '잘 나오는 수 + 잠수 번호 + 직전 동행수' },
  { id: 'patternFit', label: '패턴 균형', hint: '합·끝수합·AC·홀짝·연속수 조건 충족' },
  { id: 'average',   label: '평균 조합',  hint: '8개 분석 지표가 모두 평균 범위인 조합' },
  { id: 'meaning',   label: '의미 부여',  hint: '생일/기념일 숫자를 시드로 사용' },
];

export type GenContext = {
  history: Draw[];        // newest-first; pass useHistory.getState().getAll()
  seedNumbers?: number[]; // for 'meaning' mode
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick one index from `weights` proportional to value. Returns the index. */
function weightedPick(weights: number[]): number {
  let sum = 0;
  for (const w of weights) sum += w;
  if (sum <= 0) return Math.floor(Math.random() * weights.length);
  let r = Math.random() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

function uniqueAscending(ns: number[]): number[] {
  return sort6(Array.from(new Set(ns)).slice(0, 6));
}

// ─────────────────────────────────────────────────────────────────────────────
// Modes

function genRandom(): number[] {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  return sort6(shuffle(pool).slice(0, 6));
}

function genWeighted(ctx: GenContext): number[] {
  const recent = ctx.history.slice(0, 60);
  const { count } = frequency(recent);
  // Laplace-1 smoothing so rare numbers still have non-zero probability.
  const weights = Array.from({ length: 46 }, (_, i) => (i === 0 ? 0 : count[i] + 1));
  const picked = new Set<number>();
  while (picked.size < 6) {
    const idx = weightedPick(weights);
    if (idx < 1 || picked.has(idx)) continue;
    picked.add(idx);
    weights[idx] = 0;
  }
  return sort6([...picked]);
}

function genStatBased(ctx: GenContext): number[] {
  // 다양성 확보: 결정적 시드를 줄이고 가중랜덤 비중을 늘림.
  // 매번 호출 시 다른 5게임이 나오도록 시드 자체도 약간 셔플.
  const window = ctx.history.slice(0, 100);
  const { top, count } = frequency(window);
  const miss = roundsMissing(window);

  // 잠수번호 풀 — miss ≥ 12회차인 번호들 중 랜덤 2개 (셔플)
  const sleeperPool: number[] = [];
  for (let n = 1; n <= 45; n++) if (miss[n] >= 12) sleeperPool.push(n);
  const sleeperPicked = shuffle(sleeperPool).slice(0, 2);

  // hot 풀 — top 8 중 랜덤 1~2개
  const hotPool = top.slice(0, 8).map((t) => t.n);
  const hotPicked = shuffle(hotPool).slice(0, Math.random() < 0.5 ? 1 : 2);

  // 직전 회차 동행수 — 50% 확률로 1개
  const carry = ctx.history[0]?.nums ?? [];
  const carryPicked = carry.length > 0 && Math.random() < 0.5
    ? [carry[Math.floor(Math.random() * carry.length)]]
    : [];

  const picked = new Set<number>([...sleeperPicked, ...hotPicked, ...carryPicked]);
  // 나머지는 빈도 가중치로 채움
  const weights = Array.from({ length: 46 }, (_, i) => (i === 0 || picked.has(i) ? 0 : count[i] + 1));
  let safety = 0;
  while (picked.size < 6 && safety < 60) {
    const idx = weightedPick(weights);
    if (idx >= 1 && !picked.has(idx)) {
      picked.add(idx);
      weights[idx] = 0;
    }
    safety++;
  }
  // 가중랜덤이 막히면 순수 랜덤으로 마무리
  while (picked.size < 6) {
    const idx = 1 + Math.floor(Math.random() * 45);
    if (!picked.has(idx)) picked.add(idx);
  }
  return sort6([...picked]);
}

function isPatternFit(ns: number[]): boolean {
  const s = total(ns);
  if (s < 100 || s > 175) return false;
  const ts = tailSum(ns);
  if (ts < 18 || ts > 35) return false;
  if (ac(ns) < 7) return false;
  const [odd, even] = oddEven(ns);
  const okSplit =
    (odd === 3 && even === 3) ||
    (odd === 4 && even === 2) ||
    (odd === 2 && even === 4);
  if (!okSplit) return false;
  if (longestConsecutive(ns) > 2) return false;
  return true;
}

function genPatternFit(): number[] {
  for (let i = 0; i < 200; i++) {
    const n = genRandom();
    if (isPatternFit(n)) return n;
  }
  return genRandom(); // fallback rather than block UI
}

/**
 * 평균 조합 — 8개 분석 지표가 "전체 회차 평균 범위"에 모두 들어가는 조합.
 *
 * 6각형/8각형으로 비유한 '다지표 평균'을 코드로 구현. 실제 1223회 통계를
 * 바탕으로 각 지표의 평균 ± 범위를 정함. 모든 지표를 동시에 통과해야 하므로
 * 매우 자연스러운 "전형적인 당첨 회차" 같은 조합이 나온다.
 *
 * 검증 8개 지표:
 *   1) 합 110~165 (평균 138, ±1σ)
 *   2) 끝수합 20~32 (평균 26)
 *   3) 십의자리합 8~14 (평균 11)
 *   4) 앞세수합 35~55
 *   5) 홀짝: 2:4 / 3:3 / 4:2만 (차이 ≤ 2)
 *   6) 저:고: 2:4 / 3:3 / 4:2만
 *   7) AC ≥ 7 (충분히 흩어짐)
 *   8) 최장 연속수 ≤ 2
 */
function genAverage(): number[] {
  for (let i = 0; i < 1000; i++) {
    const n = genRandom();
    if (isAverageCombo(n)) return n;
  }
  return genRandom();
}

function isAverageCombo(nums: number[]): boolean {
  // 1. 합 110~165
  const s = total(nums);
  if (s < 110 || s > 165) return false;
  // 2. 끝수합 20~32
  const ts = tailSum(nums);
  if (ts < 20 || ts > 32) return false;
  // 3. 십의자리합 8~14
  const ths = nums.reduce((sum, n) => sum + Math.floor(n / 10), 0);
  if (ths < 8 || ths > 14) return false;
  // 4. 앞세수합 35~55
  const sorted = [...nums].sort((a, b) => a - b);
  const f3 = sorted[0] + sorted[1] + sorted[2];
  if (f3 < 35 || f3 > 55) return false;
  // 5. 홀짝 차이 ≤ 2 (5:1, 6:0 차단)
  const [odd, even] = oddEven(nums);
  if (Math.abs(odd - even) > 2) return false;
  // 6. 저:고 차이 ≤ 2
  let low = 0;
  for (const n of nums) if (n <= 22) low++;
  if (Math.abs(low - (6 - low)) > 2) return false;
  // 7. AC ≥ 7
  if (ac(nums) < 7) return false;
  // 8. 최장 연속수 ≤ 2
  if (longestConsecutive(nums) > 2) return false;
  return true;
}

/**
 * 의미 부여 — 시드 일부 + 자유 랜덤 + 기본 균형 검증.
 *
 * 핵심 원칙 (사용자 신뢰 회복):
 *   1. 시드는 1~3개만 선택 (전체 6자리를 강제하지 않음)
 *   2. 나머지 자리는 자유 랜덤 — 진짜 당첨 회차처럼 자연스러운 분포
 *   3. 만들어진 조합은 "기본 균형" 검증 통과해야 채택:
 *      - 합 100~175 (실제 당첨 95% 범위)
 *      - 홀짝 6:0/0:6 차단
 *      - 저:고 6:0/0:6 차단
 *      - 한 구간(10개 단위) 4개 이상 금지
 *      - 3개 이상 연속수 금지
 *   4. 50번 시도해도 못 만들면 시드 1개 + 균형 검증 없이 fallback
 *
 * 결과: 매 게임마다 시드 종류·개수·채움이 모두 달라져 다양성 ↑,
 *       동시에 비현실적 조합 자동 차단.
 */
function genMeaning(ctx: GenContext): number[] {
  const seedPool = (ctx.seedNumbers ?? [])
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 45);
  if (seedPool.length === 0) return genRandom();

  for (let attempt = 0; attempt < 50; attempt++) {
    // 매번 시드 개수 1~3개 랜덤 (시드 풀 크기에 맞춰 상한)
    const maxK = Math.min(3, seedPool.length);
    const k = 1 + Math.floor(Math.random() * maxK);
    const seeds = shuffle(seedPool).slice(0, k);

    const picked = new Set<number>(seeds);
    // 나머지는 자유 랜덤
    while (picked.size < 6) {
      picked.add(1 + Math.floor(Math.random() * 45));
    }
    const arr = sort6([...picked]);
    if (isNaturalCombo(arr)) return arr;
  }

  // 50번 시도 실패 — 시드 1개 + 균형 검증 없이 (안전망)
  const seeds = shuffle(seedPool).slice(0, 1);
  const picked = new Set<number>(seeds);
  while (picked.size < 6) {
    picked.add(1 + Math.floor(Math.random() * 45));
  }
  return sort6([...picked]);
}

/**
 * "자연스러운 조합" 판정 — 실제 당첨 회차에서 거의 항상 만족하는 기본 조건.
 * 너무 strict하면 시드 사용이 어려워지므로 극단만 차단.
 */
function isNaturalCombo(nums: number[]): boolean {
  // 1. 합 100~175 (실제 당첨 약 90~95%가 이 범위)
  const s = total(nums);
  if (s < 100 || s > 175) return false;

  // 2. 홀짝 극단(6:0, 0:6) 차단
  const [odd] = oddEven(nums);
  if (odd === 0 || odd === 6) return false;

  // 3. 저:고 극단 차단 (1~22 vs 23~45)
  let low = 0;
  for (const n of nums) if (n <= 22) low++;
  if (low === 0 || low === 6) return false;

  // 4. 한 구간(10개 단위)에 4개 이상 몰리는 조합 차단
  const seg = [0, 0, 0, 0, 0];
  for (const n of nums) {
    if (n <= 10) seg[0]++;
    else if (n <= 20) seg[1]++;
    else if (n <= 30) seg[2]++;
    else if (n <= 40) seg[3]++;
    else seg[4]++;
  }
  if (Math.max(...seg) >= 4) return false;

  // 5. 3개 이상 연속수 차단 (드물어서 의도성이 의심됨)
  if (longestConsecutive(nums) >= 3) return false;

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API

export function generateOne(mode: GenMode, ctx: GenContext): number[] {
  switch (mode) {
    case 'random':     return genRandom();
    case 'weighted':   return genWeighted(ctx);
    case 'statBased':  return genStatBased(ctx);
    case 'patternFit': return genPatternFit();
    case 'average':    return genAverage();
    case 'meaning':    return genMeaning(ctx);
  }
}

export function generateMany(mode: GenMode, ctx: GenContext, n: number): number[][] {
  // 1차: dedup으로 다양성 확보
  const out: number[][] = [];
  const seen = new Set<string>();
  let safety = 0;
  while (out.length < n && safety < n * 20) {
    const g = generateOne(mode, ctx);
    const k = g.join(',');
    if (!seen.has(k)) { seen.add(k); out.push(g); }
    safety++;
  }
  // 2차: 결정적인 모드(statBased 등)는 시도해도 중복만 나올 수 있다.
  // 그 경우 dedup 없이 추가 — 같은 조합이라도 N개 채워서 빈 화면 방지.
  while (out.length < n) {
    out.push(generateOne(mode, ctx));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 가중치 뽑기 — 사용자가 직접 1~45의 가중치를 지정한 뒤 6개 비복원 추출

/**
 * 사용자 지정 가중치(45개)를 받아 6개 비복원 추출.
 * weights는 길이 45 (인덱스 0이 번호 1에 대응).
 * 모든 값이 0이면 균등 분포로 폴백.
 */
export function generateWithWeights(weights: number[]): number[] {
  const w = new Array(46).fill(0); // index 0 미사용
  let total = 0;
  for (let i = 0; i < 45; i++) {
    const v = Math.max(0, weights[i] ?? 0);
    w[i + 1] = v;
    total += v;
  }
  if (total <= 0) {
    // 모두 0 → 균등 랜덤 폴백
    for (let i = 1; i <= 45; i++) w[i] = 1;
  }
  const picked = new Set<number>();
  while (picked.size < 6) {
    // weightedPick: linear scan over w[1..45]
    let sum = 0;
    for (let i = 1; i <= 45; i++) sum += w[i];
    if (sum <= 0) {
      // 남은 가중치 0이면 균등 폴백
      for (let i = 1; i <= 45; i++) if (!picked.has(i)) w[i] = 1;
      continue;
    }
    let r = Math.random() * sum;
    for (let i = 1; i <= 45; i++) {
      r -= w[i];
      if (r < 0) {
        if (!picked.has(i)) { picked.add(i); w[i] = 0; }
        break;
      }
    }
  }
  return sort6([...picked]);
}

/**
 * 가중치 프리셋 — 영상 참조 앱의 9개 모드를 우리 식으로 8개로 정리.
 * 각 프리셋은 (ctx) → number[45] 가중치 0~100을 반환.
 */
export type WeightPreset =
  | 'equal'      // 동등 (모두 50)
  | 'hot'        // 최다출현 (최근 60회 빈도 비례)
  | 'cold'       // 미출현 (최근 60회 안 나온 순)
  | 'carryOver'  // 직전 회차 동행수
  | 'odd'        // 홀수 가중
  | 'even'       // 짝수 가중
  | 'low'        // 작은수 1~22 가중
  | 'high';      // 큰수 23~45 가중

export const WEIGHT_PRESETS: Array<{ id: WeightPreset; label: string; icon: string }> = [
  { id: 'equal',    label: '동등',     icon: '⚖️' },
  { id: 'hot',      label: '최다출현', icon: '🔥' },
  { id: 'cold',     label: '미출현',   icon: '❄️' },
  { id: 'carryOver',label: '직전동행', icon: '🔗' },
  { id: 'odd',      label: '홀수',     icon: '①' },
  { id: 'even',     label: '짝수',     icon: '②' },
  { id: 'low',      label: '작은수',   icon: '↓' },
  { id: 'high',     label: '큰수',     icon: '↑' },
];

/**
 * 가중치 스케일: 0~10 (사용자 정밀 조정 친화).
 *   - 0  = 절대 안 뽑음 (제외와 동일 효과)
 *   - 5  = 균등 (기본)
 *   - 10 = 강조 (자주 뽑힘)
 *
 * 영상 참조 앱은 약 7~8단계의 슬라이더였으나, 0~10이 손가락 탭으로
 * +/- 1단계씩 조정하기에 가장 적당함.
 */
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 10;
export const WEIGHT_DEFAULT = 5;

/**
 * 프리셋 → 가중치(45개, 0~10). ctx.history는 newest-first.
 *
 * 설계 원칙: "기본 5, 강조 8~10, 비강조 1~3" 식으로 명확한 시각적 대비.
 */
export function presetWeights(preset: WeightPreset, ctx: GenContext): number[] {
  const w = new Array(45).fill(WEIGHT_DEFAULT);
  switch (preset) {
    case 'equal':
      return w;
    case 'hot': {
      // 최근 60회 빈도 → 1~10 매핑
      const recent = ctx.history.slice(0, 60);
      const { count } = frequency(recent);
      const cs = count.slice(1);
      const max = Math.max(...cs, 1);
      for (let i = 0; i < 45; i++) {
        w[i] = Math.round(1 + (cs[i] / max) * 9); // 1~10
      }
      return w;
    }
    case 'cold': {
      const recent = ctx.history.slice(0, 60);
      const { count } = frequency(recent);
      const cs = count.slice(1);
      const max = Math.max(...cs, 1);
      for (let i = 0; i < 45; i++) {
        w[i] = Math.round(1 + (1 - cs[i] / max) * 9);
      }
      return w;
    }
    case 'carryOver': {
      const prev = ctx.history[0];
      if (!prev) return w;
      const pool = new Set<number>([...prev.nums, prev.bonus]);
      for (let i = 0; i < 45; i++) w[i] = pool.has(i + 1) ? 9 : 3;
      return w;
    }
    case 'odd':
      for (let i = 0; i < 45; i++) w[i] = (i + 1) % 2 === 1 ? 9 : 2;
      return w;
    case 'even':
      for (let i = 0; i < 45; i++) w[i] = (i + 1) % 2 === 0 ? 9 : 2;
      return w;
    case 'low':
      for (let i = 0; i < 45; i++) w[i] = (i + 1) <= 22 ? 8 : 2;
      return w;
    case 'high':
      for (let i = 0; i < 45; i++) w[i] = (i + 1) >= 23 ? 8 : 2;
      return w;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 조건 조합 — 고정수·예상수·제외수 기반 (중급자 모드)

export type ConditionOpts = {
  /** 반드시 포함되는 번호 (최대 6개) */
  fixed: number[];
  /** 후보 풀 — 나머지 자리가 이 풀에서 뽑힘. 비어있으면 1~45 전체. */
  candidates: number[];
  /** 절대 포함 안 되는 번호 */
  excluded: number[];
};

/**
 * 한 게임 생성:
 *   1) 고정수 N개 그대로 포함
 *   2) 남은 (6 - N)자리는 (후보 풀 - 고정수 - 제외수)에서 무작위 추출
 *   3) 풀이 부족하면 1~45에서 (제외수만 빼고) 보충
 */
export function genConditionPick(opts: ConditionOpts): number[] {
  const fixed = opts.fixed.filter((n) => n >= 1 && n <= 45).slice(0, 6);
  if (fixed.length === 6) return sort6(fixed);

  const slots = 6 - fixed.length;
  const fixedSet = new Set(fixed);
  const excludedSet = new Set(opts.excluded);

  // 1차 풀: 후보 풀이 명시되면 그것만, 아니면 1~45 전체
  const primary = opts.candidates.length > 0
    ? opts.candidates.filter((n) => !fixedSet.has(n) && !excludedSet.has(n))
    : Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => !fixedSet.has(n) && !excludedSet.has(n));

  // 2차 폴백 풀: 풀이 부족할 때 사용
  const fallback = Array.from({ length: 45 }, (_, i) => i + 1)
    .filter((n) => !fixedSet.has(n) && !excludedSet.has(n));

  const pool = primary.length >= slots ? primary : fallback;
  if (pool.length < slots) {
    // 제외수가 너무 많아 슬롯 못 채우면 fixed만 반환 (이상 케이스)
    return sort6([...fixed, ...pool]);
  }

  const filled = shuffle(pool).slice(0, slots);
  return sort6([...fixed, ...filled]);
}

/**
 * 여러 게임 — 매번 셔플로 다양성 확보. 같은 시드 풀이라도 결과가 다름.
 */
export function generateConditionMany(opts: ConditionOpts, n: number): number[][] {
  const out: number[][] = [];
  const seen = new Set<string>();
  let safety = 0;
  while (out.length < n && safety < n * 30) {
    const g = genConditionPick(opts);
    const k = g.join(',');
    if (!seen.has(k)) { seen.add(k); out.push(g); }
    safety++;
  }
  // 작은 풀이라 중복이 불가피하면 그대로 추가
  while (out.length < n) out.push(genConditionPick(opts));
  return out;
}

/**
 * Parse `birthdayInput` like "19920514" / "920514" / "5/14" → an array of
 * 1-45 candidate seed numbers for 'meaning' mode.
 *
 * Date-aware: 8자리(YYYYMMDD) / 6자리(YYMMDD) / 4자리(MMDD) 형식을 우선 인식해
 * 월/일/연도 2자리를 추출. 그 외에는 슬라이딩 윈도우로 1~2자리 후보를 모은다.
 *
 * 예) "19960628" → 의미 있는 시드: 6(월), 28(일), 19(YY 앞2), 96(>45 skip)
 *    + 슬라이딩 윈도우: 1, 2, 6, 8, 9, 19, 28
 */
export function parseSeedInput(input: string): number[] {
  const out = new Set<number>();
  const digits = input.replace(/[^0-9]/g, '');
  if (!digits) return [];
  const addIf = (v: number) => { if (v >= 1 && v <= 45) out.add(v); };

  // 1. 날짜 형식 우선 인식 — 의미 있는 단위(월·일·연도뒤2자리)
  if (digits.length === 8) {
    // YYYYMMDD: 1996/06/28
    addIf(parseInt(digits.slice(2, 4), 10));  // YY 앞2 (19)
    addIf(parseInt(digits.slice(4, 6), 10));  // MM (6)
    addIf(parseInt(digits.slice(6, 8), 10));  // DD (28)
  } else if (digits.length === 6) {
    // YYMMDD: 960628
    addIf(parseInt(digits.slice(0, 2), 10));
    addIf(parseInt(digits.slice(2, 4), 10));
    addIf(parseInt(digits.slice(4, 6), 10));
  } else if (digits.length === 4) {
    // MMDD: 0628
    addIf(parseInt(digits.slice(0, 2), 10));
    addIf(parseInt(digits.slice(2, 4), 10));
  }

  // 2. 각 자리 단일 숫자 (1~9)
  for (let i = 0; i < digits.length; i++) addIf(parseInt(digits[i], 10));

  // 3. 두 자리 슬라이딩 윈도우
  for (let i = 0; i + 1 < digits.length; i++) {
    addIf(parseInt(digits.slice(i, i + 2), 10));
  }

  return [...out];
}
