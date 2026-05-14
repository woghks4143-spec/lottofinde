/**
 * 시뮬레이터 엔진 — DFS + 가지치기 + reservoir sampling.
 *
 * C(45, 6) = 8,145,060이라 단순 열거는 모바일에서도 무리. include/exclude를
 * domain에서 미리 제거하고, DFS 진행 중 합 범위에 들 수 없으면 가지치기한다.
 * 6개 완성 시점에서 AC/끝수합/홀짝/연속수/동행수를 마지막 검증.
 *
 * 채택된 combo를 모두 메모리에 들고 있을 필요는 없으므로 reservoir sampling
 * (Algorithm L)로 sampleSize개만 보관. PRD F-006이 정한 1,000,000건 카운트
 * 상한을 넘으면 `truncated=true`로 멈춤.
 *
 * UI 반응성을 위해 50ms마다 setTimeout(0)로 yield. 진행률 콜백 지원.
 */
import { ac, longestConsecutive, sort6, tailSum, total, type Draw } from '@/src/data/lotto';
import { migrateRule, type Rule, type Ratio } from '@/src/store/rules';

const HARD_CAP = 1_000_000;
const YIELD_INTERVAL_MS = 50;

export type Filter = {
  include: Set<number>;
  exclude: Set<number>;
  sumMin: number; sumMax: number;
  tailSumMin: number; tailSumMax: number;
  acMin: number; acMax: number;
  /** 허용할 홀:짝 비율. 빈 set = 모두 허용. */
  oddEvenAllow: Set<string>;
  /** 허용할 저:고 비율. 빈 set = 모두 허용. */
  highLowAllow: Set<string>;
  /**
   * 허용할 "가장 긴 연속 묶음 길이" 집합 (1~6).
   * 1 = 연속수 없음(모든 단독), 2/3/4/5/6 = 그 길이가 최장. 빈 set = 자유.
   */
  longestRunAllow: Set<number>;
  carryOverPool: Set<number>;  // 직전 회차 nums + bonus
  /** 허용할 이월수 정확한 개수(0~6) 집합. 빈 set = 자유. */
  carryOverAllow: Set<number>;
};

export type SimResult = {
  count: number;
  samples: number[][];
  truncated: boolean;
  elapsedMs: number;
};

export function ruleToFilter(rule: Rule, prevDraw: Draw | null): Filter {
  const r = migrateRule(rule);
  return {
    include: new Set(r.include),
    exclude: new Set(r.exclude),
    sumMin: r.sumMin, sumMax: r.sumMax,
    tailSumMin: r.tailSumMin, tailSumMax: r.tailSumMax,
    acMin: r.acMin, acMax: r.acMax,
    oddEvenAllow: new Set(r.oddEvenAllow ?? []),
    highLowAllow: new Set(r.highLowAllow ?? []),
    longestRunAllow: new Set(r.longestRunAllow ?? []),
    carryOverPool: new Set(prevDraw ? [...prevDraw.nums, prevDraw.bonus] : []),
    carryOverAllow: new Set(r.carryOverAllow ?? []),
  };
}

/** "x:y" 형식 비율이 허용 set 안에 있는지. 빈 set은 모두 허용. */
function ratioAllowed(allow: Set<string>, a: number, b: number): boolean {
  if (allow.size === 0) return true;
  return allow.has(`${a}:${b}`);
}

function fullyValid(picked: number[], f: Filter): boolean {
  const s = total(picked);
  if (s < f.sumMin || s > f.sumMax) return false;
  const ts = tailSum(picked);
  if (ts < f.tailSumMin || ts > f.tailSumMax) return false;
  const a = ac(picked);
  if (a < f.acMin || a > f.acMax) return false;
  let odd = 0, low = 0;
  for (const n of picked) {
    if (n % 2 === 1) odd++;
    if (n <= 22) low++;
  }
  if (!ratioAllowed(f.oddEvenAllow, odd, 6 - odd)) return false;
  if (!ratioAllowed(f.highLowAllow, low, 6 - low)) return false;
  // 연속수 검증 — 가장 긴 묶음 길이가 허용 set 안에 있어야 함. 빈 set = 자유.
  if (f.longestRunAllow.size > 0) {
    const longest = longestConsecutive(picked); // 1 = 단독만, 2 = 2연속, ...
    if (!f.longestRunAllow.has(longest)) return false;
  }
  // 이월수 검증 — 정확한 개수가 허용 set 안에 있어야 함. 빈 set = 자유.
  if (f.carryOverAllow.size > 0) {
    let hits = 0;
    for (const n of picked) if (f.carryOverPool.has(n)) hits++;
    if (!f.carryOverAllow.has(hits)) return false;
  }
  return true;
}

/**
 * Sum of the smallest `k` values in `arr[i..]` (assuming arr is ascending).
 * Used for min-possible-remaining bound during DFS.
 */
function smallestKSum(arr: number[], from: number, k: number): number {
  let s = 0;
  for (let i = from; i < from + k && i < arr.length; i++) s += arr[i];
  return s;
}

/**
 * Sum of the largest `k` values in `arr[..to]`. Since `arr` is ascending,
 * we sum the last `k` items up to index `to`.
 */
function largestKSum(arr: number[], to: number, k: number): number {
  let s = 0;
  for (let i = to; i > to - k && i >= 0; i--) s += arr[i];
  return s;
}

export async function countOrSample(
  filter: Filter,
  mode: 'count' | 'sample',
  sampleSize = 100,
  onProgress?: (acceptedSoFar: number) => void,
): Promise<SimResult> {
  const startedAt = Date.now();

  // Build domain ascending: [1..45] − exclude − include
  const inc = [...filter.include].filter((n) => n >= 1 && n <= 45);
  const incSet = new Set(inc);
  const domain: number[] = [];
  for (let n = 1; n <= 45; n++) {
    if (filter.exclude.has(n)) continue;
    if (incSet.has(n)) continue;
    domain.push(n);
  }
  const slotsRemaining = 6 - inc.length;
  if (slotsRemaining < 0 || domain.length < slotsRemaining) {
    return { count: 0, samples: [], truncated: false, elapsedMs: Date.now() - startedAt };
  }

  const incSum = inc.reduce((s, n) => s + n, 0);

  const reservoir: number[][] = [];
  let count = 0;
  let truncated = false;
  let lastYield = Date.now();
  const wantSamples = mode === 'sample';

  // DFS state: picks of indices into `domain`. We pick in increasing index
  // order to enumerate combinations (not permutations).
  const sel: number[] = []; // selected domain indices
  let curSum = incSum;

  async function dfs(startIdx: number): Promise<void> {
    if (count >= HARD_CAP) { truncated = true; return; }

    // Yield to event loop periodically so UI stays responsive.
    if (Date.now() - lastYield > YIELD_INTERVAL_MS) {
      lastYield = Date.now();
      onProgress?.(count);
      await new Promise<void>((r) => setTimeout(r, 0));
      if (count >= HARD_CAP) { truncated = true; return; }
    }

    if (sel.length === slotsRemaining) {
      // Assemble the full 6-number candidate.
      const combo = inc.slice();
      for (const idx of sel) combo.push(domain[idx]);
      combo.sort((a, b) => a - b);
      if (fullyValid(combo, filter)) {
        count++;
        if (count >= HARD_CAP) { truncated = true; return; }
        if (wantSamples) {
          if (reservoir.length < sampleSize) {
            reservoir.push(combo);
          } else {
            // Algorithm R: replace position j with prob k/i (1-based "i = count")
            const j = Math.floor(Math.random() * count);
            if (j < sampleSize) reservoir[j] = combo;
          }
        }
      }
      return;
    }

    const need = slotsRemaining - sel.length;
    // Loop over choices for the next slot.
    const lastChoice = domain.length - need; // we still need `need` slots
    for (let i = startIdx; i <= lastChoice; i++) {
      const v = domain[i];
      // Sum-prune: with `need` slots left, min possible sum from `domain[i..]` is
      // sum of `need` smallest (i.e. domain[i], domain[i+1], …), max is `need`
      // largest (i.e. domain[lastChoice], …, last).
      const minRem = smallestKSum(domain, i, need);
      const maxRem = largestKSum(domain, domain.length - 1, need);
      if (curSum + minRem > filter.sumMax) return; // sums only grow ⇒ all later i fail too
      if (curSum + maxRem < filter.sumMin) {
        // raising i can only lower min sum further but raises start; check next i instead of return.
        continue;
      }
      sel.push(i);
      curSum += v;
      await dfs(i + 1);
      curSum -= v;
      sel.pop();
      if (count >= HARD_CAP) return;
    }
  }

  await dfs(0);
  onProgress?.(count);
  return { count, samples: reservoir, truncated, elapsedMs: Date.now() - startedAt };
}
