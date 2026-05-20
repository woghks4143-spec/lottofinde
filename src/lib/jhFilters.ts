/**
 * JH 필터 — 10가지 영역 분석 알고리즘. (내부 전용, UI에서 절대 노출 X)
 *
 * 각 필터는 직전 회차(prev)를 입력으로 받아 다음 회차의 후보 영역을 반환한다.
 * UI에는 결과 번호만 노출하며, 알고리즘 명칭/원리는 절대 표시하지 않는다.
 */
import type { Draw } from '@/src/data/lotto';

const COLS = 7;
const ROWS = 7;

function rowOf(n: number): number { return Math.floor((n - 1) / COLS); }
function colOf(n: number): number { return (n - 1) % COLS; }

function rcToNum(r: number, c: number): number | null {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  const n = r * COLS + c + 1;
  return (n >= 1 && n <= 45) ? n : null;
}

function rowNums(r: number): number[] {
  const arr: number[] = [];
  for (let c = 0; c < COLS; c++) {
    const n = rcToNum(r, c);
    if (n) arr.push(n);
  }
  return arr;
}

function colNums(c: number): number[] {
  const arr: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    const n = rcToNum(r, c);
    if (n) arr.push(n);
  }
  return arr;
}

function dedupSort(arr: number[]): number[] {
  return [...new Set(arr)].sort((a, b) => a - b);
}

// ─── 필터 1 ── 4번째 행 + 2번째 열 (동적, 12~13칸) ────────────
function f1(prev: Draw): number[] {
  const s = [...prev.nums].sort((a, b) => a - b);
  return dedupSort([...rowNums(rowOf(s[3])), ...colNums(colOf(s[1]))]);
}

// ─── 필터 2 ── 보너스 행 + 2번째 열 (동적, 12~13칸) ──────────
function f2(prev: Draw): number[] {
  const s = [...prev.nums].sort((a, b) => a - b);
  return dedupSort([...rowNums(rowOf(prev.bonus)), ...colNums(colOf(s[1]))]);
}

// ─── 필터 3 ── 고정 13수 (행 0 ∪ 열 2) ────────────────────────
const STATIC_13 = [1, 2, 3, 4, 5, 6, 7, 10, 17, 24, 31, 38, 45];
function f3(): number[] {
  return [...STATIC_13];
}

// ─── 필터 4 ── 3번째 행 + 2번째 열 (동적, 12~13칸) ────────────
function f4(prev: Draw): number[] {
  const s = [...prev.nums].sort((a, b) => a - b);
  return dedupSort([...rowNums(rowOf(s[2])), ...colNums(colOf(s[1]))]);
}

// ─── 필터 5 ── 끝수합 존 (21~29칸) ────────────────────────────
function f5(prev: Draw): number[] {
  const es = prev.nums.reduce((sum, n) => sum + (n % 10), 0);
  let endings: Set<number>;
  if (es < 20) endings = new Set([5, 6, 7, 8, 9]);
  else if (es > 30) endings = new Set([0, 1, 2, 3, 4, 5]);
  else endings = new Set([3, 4, 5, 6, 7]);
  const arr: number[] = [];
  for (let n = 1; n <= 45; n++) {
    if (endings.has(n % 10)) arr.push(n);
  }
  return arr;
}

// ─── 필터 6 ── 합계 회귀 존 (21~23칸) ─────────────────────────
function f6(prev: Draw): number[] {
  const sum = prev.nums.reduce((s, n) => s + n, 0);
  let lo: number, hi: number;
  if (sum < 130) { lo = 25; hi = 45; }
  else if (sum > 160) { lo = 1; hi = 21; }
  else { lo = 12; hi = 34; }
  const arr: number[] = [];
  for (let n = lo; n <= hi; n++) arr.push(n);
  return arr;
}

// ─── 필터 7 ── 양방향 대각선 합집합 (평균 32칸) ────────────────
function f7(prev: Draw): number[] {
  const set = new Set<number>();
  for (const num of prev.nums) {
    const r = rowOf(num);
    const c = colOf(num);
    for (let d = -7; d <= 7; d++) {
      const n1 = rcToNum(r + d, c + d);
      const n2 = rcToNum(r + d, c - d);
      if (n1) set.add(n1);
      if (n2) set.add(n2);
    }
  }
  return dedupSort([...set]);
}

// ─── 필터 8 ── 3×3 박스 합집합 (평균 30칸) ────────────────────
function f8(prev: Draw): number[] {
  const set = new Set<number>();
  for (const num of prev.nums) {
    const r = rowOf(num);
    const c = colOf(num);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const n = rcToNum(r + dr, c + dc);
        if (n) set.add(n);
      }
    }
  }
  return dedupSort([...set]);
}

// ─── 필터 9 ── ±7 차감 (평균 30칸) ────────────────────────────
function f9(prev: Draw): number[] {
  const all = new Set<number>();
  for (let n = 1; n <= 45; n++) all.add(n);
  for (const num of prev.nums) {
    all.delete(num);
    if (num - 7 >= 1) all.delete(num - 7);
    if (num + 7 <= 45) all.delete(num + 7);
  }
  return dedupSort([...all]);
}

// ─── 필터 10 ── 평균 ±10 (평균 21칸) ──────────────────────────
function f10(prev: Draw): number[] {
  const avg = Math.floor(prev.nums.reduce((s, n) => s + n, 0) / 6);
  const lo = Math.max(1, avg - 10);
  const hi = Math.min(45, avg + 10);
  const arr: number[] = [];
  for (let n = lo; n <= hi; n++) arr.push(n);
  return arr;
}

/* ════════════════════════════════════════════════════════════════════
   공개 API — 필터 ID로 영역 계산
   ════════════════════════════════════════════════════════════════════ */

export const JH_FILTER_COUNT = 10;

/** 필터 ID(1~10)에 해당하는 라벨. UI에 노출되는 유일한 텍스트. */
export function jhFilterLabel(id: number): string {
  return `JH필터 ${id}`;
}

/**
 * 필터 ID(1~10)와 직전 회차로 영역(번호 리스트, 오름차순)을 계산.
 * 직전 회차가 없을 경우 고정형 필터(3)만 결과 반환, 나머지는 빈 배열.
 */
export function computeJhFilter(id: number, prev: Draw | null): number[] {
  if (id === 3) return f3();
  if (!prev) return [];
  switch (id) {
    case 1:  return f1(prev);
    case 2:  return f2(prev);
    case 4:  return f4(prev);
    case 5:  return f5(prev);
    case 6:  return f6(prev);
    case 7:  return f7(prev);
    case 8:  return f8(prev);
    case 9:  return f9(prev);
    case 10: return f10(prev);
    default: return [];
  }
}

/** 10개 필터를 한 번에 계산. */
export function computeAllJhFilters(prev: Draw | null): { id: number; label: string; nums: number[] }[] {
  return Array.from({ length: JH_FILTER_COUNT }, (_, i) => {
    const id = i + 1;
    return { id, label: jhFilterLabel(id), nums: computeJhFilter(id, prev) };
  });
}
