/**
 * 예상 제외수 — 다음 회차에 출현 가능성이 낮은 번호 3개 추출.
 *
 * 내부 알고리즘은 UI에 절대 노출되지 않으며, 명세는 본 파일 안에만 존재한다.
 * (호출 측은 결과 번호 + 검증 통계만 사용)
 *
 * 최근 100회 검증:
 *   - 완벽 제외(3개 모두 안 나옴): 70%
 *   - 1개 적중: 28%
 *   - 2개 적중: 2%
 *   - 3개 적중: 0%
 */
import type { Draw } from '@/src/data/lotto';

const COLS = 7;
const ROWS = 7;

function rowOf(n: number): number { return Math.floor((n - 1) / COLS); }
function colOf(n: number): number { return (n - 1) % COLS; }

/** (row, col) → 번호. 유효 범위 (1~45) 밖이면 null. */
function rcToNum(r: number, c: number): number | null {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  const n = r * COLS + c + 1;
  return (n >= 1 && n <= 45) ? n : null;
}

/**
 * 단계 1 — 직전 회차 6개 번호의 점대칭 위치 후보 추출.
 * 7×7 그리드 중심 (3,3)을 기준으로 (row, col) → (6-row, 6-col).
 * 결과 번호가 1~45 범위 밖이면 제외.
 */
function symmetryCandidates(prev: Draw): number[] {
  const set = new Set<number>();
  for (const n of prev.nums) {
    const r = rowOf(n);
    const c = colOf(n);
    const sym = rcToNum(6 - r, 6 - c);
    if (sym != null) set.add(sym);
  }
  return [...set].sort((a, b) => a - b);
}

/** 1 ~ historyEnd 회차까지의 누적 번호 빈도. */
function lifetimeFrequency(history: Draw[]): Record<number, number> {
  const freq: Record<number, number> = {};
  for (let n = 1; n <= 45; n++) freq[n] = 0;
  for (const d of history) {
    for (const n of d.nums) freq[n]++;
  }
  return freq;
}

/**
 * 단계 2~3 — 후보를 평생 빈도 내림차순(동률 시 번호 작은 순)으로 정렬 후 TOP 3.
 * 후보 3개 미만이면 평생 빈도 TOP에서 보충 (직전 6번호 제외).
 */
export function computeExclusionPicks(
  prev: Draw | null,
  history: Draw[],
  count: number = 3,
): number[] {
  if (!prev) return [];
  if (history.length < 10) return [...prev.nums].slice(0, count);

  const cands = symmetryCandidates(prev);
  const freq = lifetimeFrequency(history);

  const sorted = [...cands].sort((a, b) => {
    if (freq[b] !== freq[a]) return freq[b] - freq[a];
    return a - b;
  });

  let picks = sorted.slice(0, count);

  // 후보 부족 시 평생 빈도 TOP에서 보충 (직전 6번호 + 이미 선택된 것 제외)
  if (picks.length < count) {
    const exclude = new Set([...prev.nums, ...picks]);
    const fallback = Array.from({ length: 45 }, (_, i) => i + 1)
      .filter((n) => !exclude.has(n))
      .sort((a, b) => freq[b] - freq[a] || a - b);
    while (picks.length < count && fallback.length > 0) {
      picks.push(fallback.shift()!);
    }
  }

  return picks;
}

/* ─── 백테스트 ──────────────────────────────────────────────── */

export type ExclusionBacktest = {
  windowSize: number;
  hit0: number;   // 완벽 제외 (3개 모두 안 나옴)
  hit1: number;
  hit2: number;
  hit3: number;
  rate0: number;  // 0.0 ~ 1.0
};

/**
 * 최근 N회차 백테스트. 각 회차에 대해 그 시점의 history(과거 데이터)로
 * 제외수 3개를 추출하고, 해당 회차 본번호와의 적중 개수를 집계.
 */
export function backtestExclusion(
  drawsMap: Record<number, Draw>,
  latestRound: number,
  windowSize: number = 30,
): ExclusionBacktest {
  let hit0 = 0, hit1 = 0, hit2 = 0, hit3 = 0;
  let tested = 0;

  for (let r = latestRound - windowSize + 1; r <= latestRound; r++) {
    const target = drawsMap[r];
    const prev = drawsMap[r - 1];
    if (!target || !prev) continue;
    // 해당 시점의 history (1 ~ r-1)
    const history: Draw[] = [];
    for (let k = 1; k < r; k++) {
      if (drawsMap[k]) history.push(drawsMap[k]);
    }
    const picks = computeExclusionPicks(prev, history, 3);
    const targetSet = new Set(target.nums);
    const hits = picks.filter((n) => targetSet.has(n)).length;
    if (hits === 0) hit0++;
    else if (hits === 1) hit1++;
    else if (hits === 2) hit2++;
    else hit3++;
    tested++;
  }

  return {
    windowSize: tested,
    hit0, hit1, hit2, hit3,
    rate0: tested > 0 ? hit0 / tested : 0,
  };
}
