/**
 * 시뮬레이터 엔진 — iterative DFS + 가지치기 + reservoir sampling.
 *
 * C(45, 6) = 8,145,060이라 단순 열거는 모바일에서도 무리. include/exclude를
 * domain에서 미리 제거하고, DFS 진행 중 합 범위에 들 수 없으면 가지치기한다.
 * 6개 완성 시점에서 AC/끝수합/홀짝/연속수/동행수를 마지막 검증.
 *
 * 성능 최적화:
 *   - **iterative DFS** (async/await 재귀 제거) — 매 노드마다 Promise 생성 X
 *   - **prefix sum** — smallestKSum O(k) → O(1)
 *   - **maxRemTable 사전 계산** — 변하지 않는 큰값 N개 합을 미리
 *   - **100k 노드마다 yield** — Promise overhead 최소화
 *
 * 채택된 combo를 모두 메모리에 들고 있을 필요는 없으므로 reservoir sampling
 * (Algorithm L)로 sampleSize개만 보관. PRD F-006이 정한 1,000,000건 카운트
 * 상한을 넘으면 `truncated=true`로 멈춤.
 */
import { ac, longestConsecutive, sort6, tailSum, total, type Draw } from '@/src/data/lotto';
import { migrateRule, type Rule, type Ratio } from '@/src/store/rules';

const HARD_CAP = 1_000_000;
/** UI 반응성과 추출 속도의 균형 — 100,000 DFS 노드마다 한 번 yield. */
const YIELD_NODES = 100_000;

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

  // include는 사전 정렬 — 매 채택마다 sort 호출 회피.
  const inc = [...filter.include].filter((n) => n >= 1 && n <= 45).sort((a, b) => a - b);
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
  const wantSamples = mode === 'sample';

  // ─── 사전 계산 — DFS 매 노드에서의 합 계산을 O(1)로 ────────────────────────
  // prefixSum[i] = domain[0..i-1] 합. smallestKSum(from, k) = prefixSum[from+k] - prefixSum[from]
  const prefixSum = new Array(domain.length + 1);
  prefixSum[0] = 0;
  for (let i = 0; i < domain.length; i++) prefixSum[i + 1] = prefixSum[i] + domain[i];

  // 남은 슬롯 k에 대해 도메인 끝에서 가장 큰 k개의 합 — 변하지 않으므로 사전 계산.
  const maxRemTable = new Array(slotsRemaining + 1).fill(0);
  for (let k = 0; k <= slotsRemaining; k++) {
    let s = 0;
    for (let i = domain.length - 1; i > domain.length - 1 - k && i >= 0; i--) s += domain[i];
    maxRemTable[k] = s;
  }

  // ─── iterative DFS — async/await 재귀 제거로 Promise overhead ↓ ─────────────
  // 스택: sel[depth] = 도메인 인덱스, nextI[depth] = 다음 시도 i. depth는 sel.length.
  const sel = new Array(slotsRemaining); // selected domain indices
  const nextI = new Array(slotsRemaining + 1); // [d] = depth d에서 다음 시도할 도메인 인덱스
  let depth = 0;
  let curSum = incSum;
  let count = 0;
  let truncated = false;
  let nodesSinceYield = 0;
  const reservoir: number[][] = [];

  nextI[0] = 0;

  outer: while (true) {
    nodesSinceYield++;
    if (nodesSinceYield >= YIELD_NODES) {
      nodesSinceYield = 0;
      onProgress?.(count);
      // 이벤트 루프에 양보 — UI 갱신 / 입력 처리
      await new Promise<void>((r) => setTimeout(r, 0));
      if (count >= HARD_CAP) { truncated = true; break; }
    }

    if (depth === slotsRemaining) {
      // 6개 완성 — 검증 후 채택
      const combo = inc.slice();
      for (let d = 0; d < slotsRemaining; d++) combo.push(domain[sel[d]]);
      // inc는 정렬됨, sel은 ascending 순서로 채워짐 → 두 정렬된 배열을 merge
      combo.sort((a, b) => a - b);
      if (fullyValid(combo, filter)) {
        count++;
        if (count >= HARD_CAP) { truncated = true; break; }
        if (wantSamples) {
          if (reservoir.length < sampleSize) {
            reservoir.push(combo);
          } else {
            const j = Math.floor(Math.random() * count);
            if (j < sampleSize) reservoir[j] = combo;
          }
        }
      }
      // 한 단계 위로 backtrack
      if (depth === 0) break;
      depth--;
      curSum -= domain[sel[depth]];
      continue;
    }

    const i = nextI[depth];
    const need = slotsRemaining - depth;
    const lastChoice = domain.length - need;

    if (i > lastChoice) {
      // 이 레벨 종료, 한 단계 위로
      if (depth === 0) break;
      depth--;
      curSum -= domain[sel[depth]];
      continue;
    }

    // sum prune (O(1) prefix sum 사용)
    const minRem = prefixSum[i + need] - prefixSum[i];
    if (curSum + minRem > filter.sumMax) {
      // sums only grow → 이 레벨 종료
      if (depth === 0) break;
      depth--;
      curSum -= domain[sel[depth]];
      continue;
    }
    const maxRem = maxRemTable[need];
    if (curSum + maxRem < filter.sumMin) {
      nextI[depth] = i + 1;
      continue;
    }

    // 채택: i를 선택, 다음 레벨로 진입
    sel[depth] = i;
    curSum += domain[i];
    nextI[depth] = i + 1;          // 부모의 다음 iteration용
    depth++;
    nextI[depth] = i + 1;          // 새 레벨 시작
  }

  onProgress?.(count);
  return { count, samples: reservoir, truncated, elapsedMs: Date.now() - startedAt };
}
