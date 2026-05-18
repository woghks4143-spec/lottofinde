/**
 * 귀찮이즘 조합 공유 헬퍼 — 상태 판정, 카운트다운, 백테스트, 조합 생성.
 *
 * 백테스트 데이터는 mock이 아닌 실제 시뮬레이션:
 *   computeBacktest()가 최근 N회차에 대해 회차별 시드로 조합을 생성하고
 *   실제 당첨 번호와 매칭해 등수 카운트. 비동기 + 청크 단위 yield로
 *   UI를 막지 않으며, 결과는 Zustand 캐시에 보관해 재계산 회피.
 *
 * 알고리즘 단순화 안내: spec의 JACKPOT_UNION 풀 알고리즘은 백엔드 전용 (~1GB
 * 메모리, 회차당 ~10초). 클라이언트 mock으로는 동등 효과 재현 불가하므로,
 * 현실성 필터(합·끝수합·홀짝·AC·연속) 기반 균등 추출로 대체.
 */
import { rank as computeRank } from '@/src/data/lotto';
import type { Draw } from '@/src/data/lotto';

export const POOL_SIZE = 85000;              // 내부 계산용 (디스플레이는 "약 8~9만개")
export const POOL_SIZE_DISPLAY = '약 8~9만개'; // UI 공통 표기
export const USER_LIMIT = 50;
export const BACKTEST_BASE_N = 30;

export type JachanismStatus = 'locked' | 'active' | 'drawing' | 'done';

/* ─── 상태 판정 ─────────────────────────────────────── */

export function getDayStatus(now: Date = new Date()): JachanismStatus {
  const day = now.getDay();
  if (day === 6) return 'drawing';
  if (day >= 3 && day <= 5) return 'active';
  return 'locked';
}

export function msToNextReceive(now: Date = new Date()): number | null {
  const day = now.getDay();
  let daysToWed: number;
  if (day === 0) daysToWed = 3;
  else if (day === 1) daysToWed = 2;
  else if (day === 2) daysToWed = 1;
  else return null;
  const target = new Date(now);
  target.setDate(now.getDate() + daysToWed);
  target.setHours(0, 0, 0, 0);
  return target.getTime() - now.getTime();
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '곧 공개';
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}일 ${h}시간`;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

/* ─── PRNG / 해시 ───────────────────────────────────── */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ─── 조합 생성 (필터 통과 6번호) ───────────────────── */

function computeAC(nums: number[]): number {
  const diffs = new Set<number>();
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      diffs.add(nums[j] - nums[i]);
    }
  }
  return diffs.size - 5;
}

/** 단일 6조합 생성 (현실성 필터 적용, 실패 시 null). */
export function genRealisticCombo(rng: () => number): number[] | null {
  const arr = Array.from({ length: 45 }, (_, i) => i + 1);
  for (let i = 0; i < 6; i++) {
    const j = i + Math.floor(rng() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const combo = arr.slice(0, 6).sort((a, b) => a - b);

  const sum = combo.reduce((a, b) => a + b, 0);
  if (sum < 100 || sum > 175) return null;
  const odd = combo.filter((n) => n % 2 === 1).length;
  if (odd === 0 || odd === 6) return null;
  const tail = combo.reduce((a, b) => a + (b % 10), 0);
  if (tail < 14 || tail > 38) return null;
  if (computeAC(combo) < 7) return null;
  let cur = 1;
  for (let i = 1; i < 6; i++) {
    if (combo[i] === combo[i - 1] + 1) {
      cur++;
      if (cur >= 3) return null;
    } else cur = 1;
  }
  return combo;
}

/** USER_LIMIT개의 unique 조합 생성 (deviceSeed × round 시드). */
export function generateUserCombos(round: number, deviceSeed: string): number[][] {
  const seed = hashString(`${deviceSeed}_${round}`);
  const rng = mulberry32(seed);
  const combos: number[][] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (combos.length < USER_LIMIT && attempts < 50000) {
    attempts++;
    const c = genRealisticCombo(rng);
    if (!c) continue;
    const key = c.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    combos.push(c);
  }
  return combos;
}

/* ─── GitHub 주간 풀 fetch ─────────────────────────── */

/**
 * 매주 일요일 Python 스크립트가 업로드한 회차별 ~85K 풀을 GitHub raw URL에서 가져옴.
 * 캐시 우선 → 실패 시 로컬 알고리즘 폴백.
 *
 * URL: https://raw.githubusercontent.com/{owner}/{repo}/main/weekly_combos/round_NNNN.json
 */
const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/woghks4143-spec/lottofinde/main/weekly_combos';

export type WeeklyPool = {
  round: number;
  basedOnLatest: number;
  count: number;
  algorithm: string;
  combos: number[][];
};

/**
 * 회차의 주간 풀을 GitHub에서 가져온다.
 * 네트워크 실패/파일 없음 시 null 반환 → 호출 측이 로컬 폴백 사용.
 */
export async function fetchWeeklyPool(round: number): Promise<WeeklyPool | null> {
  const url = `${GITHUB_RAW_BASE}/round_${String(round).padStart(4, '0')}.json`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as WeeklyPool;
    if (!json?.combos || !Array.isArray(json.combos) || json.combos.length === 0) return null;
    return json;
  } catch {
    return null;
  }
}

/**
 * 회차의 주간 풀에서 deviceSeed로 결정적 USER_LIMIT개를 뽑아온다.
 * 풀이 없으면 null → generateUserCombos로 폴백 가능.
 */
export function pickUserCombosFromPool(
  pool: WeeklyPool,
  round: number,
  deviceSeed: string,
): number[][] {
  const seed = hashString(`${deviceSeed}_${round}`);
  const rng = mulberry32(seed);
  // Fisher-Yates partial shuffle: 앞 USER_LIMIT개만 섞기
  const idx = Array.from({ length: pool.combos.length }, (_, i) => i);
  const take = Math.min(USER_LIMIT, idx.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rng() * (idx.length - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, take).map((i) => pool.combos[i].slice().sort((a, b) => a - b));
}

/* ─── 백테스트 ──────────────────────────────────────── */

export type BacktestStats = {
  rank1: number;
  rank2: number;
  rank3: number;
  rank4: number;
  rank5: number;
  roundsTested: number;
  totalCombosTested: number;
  computedAt: number;
};

/**
 * 회차별 시드로 POOL_SIZE 조합을 생성해 실제 당첨번호와 매칭. 각 회차당 한 번
 * yield 하여 UI 응답성 유지. ~10-15초 (web JS 기준, 단 1회만 실행).
 */
export async function computeBacktest(
  drawsMap: Record<number, Draw>,
  latestRound: number,
  n: number = BACKTEST_BASE_N,
  onProgress?: (done: number, total: number) => void,
): Promise<BacktestStats> {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let roundsTested = 0;
  let totalCombos = 0;

  const startR = Math.max(1, latestRound - n + 1);
  for (let r = startR; r <= latestRound; r++) {
    // UI에 yield (다음 round 시작 전 한 번)
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const actual = drawsMap[r];
    if (!actual) continue;
    roundsTested++;

    // 회차 시드 → 동일 회차는 항상 동일 풀
    const rng = mulberry32(hashString(`backtest_v1_${r}`));
    const seen = new Set<string>();
    let generated = 0;
    let attempts = 0;
    const maxAttempts = POOL_SIZE * 5;

    while (generated < POOL_SIZE && attempts < maxAttempts) {
      attempts++;
      const combo = genRealisticCombo(rng);
      if (!combo) continue;
      const key = combo.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      generated++;

      const rk = computeRank(combo, actual.nums, actual.bonus);
      if (rk != null) counts[rk as 1 | 2 | 3 | 4 | 5]++;
    }
    totalCombos += generated;
    onProgress?.(roundsTested, n);
  }

  return {
    rank1: counts[1],
    rank2: counts[2],
    rank3: counts[3],
    rank4: counts[4],
    rank5: counts[5],
    roundsTested,
    totalCombosTested: totalCombos,
    computedAt: Date.now(),
  };
}

/* ─── 표시 포맷 ─────────────────────────────────────── */

/** 숫자 → "1,234개" 또는 "1.2K개" 표기 (compact: 카드용 짧은 표기). */
export function fmtCount(n: number, compact = false): string {
  if (compact && n >= 10000) return `${Math.round(n / 1000).toLocaleString()}K개`;
  if (compact && n >= 1000) return `${(n / 1000).toFixed(1)}K개`;
  return `${n.toLocaleString()}개`;
}
