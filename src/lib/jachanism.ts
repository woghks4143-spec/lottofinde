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
export const BACKTEST_BASE_N = 52;            // 최근 1년 (52주)
export const BACKTEST_BASE_LABEL = '최근 1년';  // UI 라벨

export type JachanismStatus = 'locked' | 'active' | 'drawing' | 'done';

/* ─── 상태 판정 ─────────────────────────────────────── */

/**
 * 운영 사이클:
 *   - 월(1) 09:00 KST: 새 조합 자동 생성 (GitHub Actions or 실행.bat)
 *   - 수(3) 00:00 ~ 토(6) 20:00: 받기 가능 ('active')
 *   - 토(6) 20:00 ~ 추첨 결과 수신 전: 추첨 대기 ('drawing')
 *   - 일(0)·월(1)·화(2): 잠금 ('locked')
 *
 * 로또 구매 마감: 매주 토요일 20:00 (KST)
 * 추첨: 매주 토요일 20:35 (KST)
 */
export const RECEIVE_END_HOUR = 20; // 토요일 20시 구매 마감

export function getDayStatus(now: Date = new Date()): JachanismStatus {
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 6) {
    // 토요일: 20시 전까지 받기, 20시부터 추첨 대기
    return hour < RECEIVE_END_HOUR ? 'active' : 'drawing';
  }
  if (day >= 3 && day <= 5) return 'active'; // 수·목·금
  return 'locked';                            // 일·월·화
}

/**
 * 다음 받기 시작(=다음 수요일 00:00)까지 남은 ms.
 * 잠금 상태가 아닐 때는 null.
 */
export function msToNextReceive(now: Date = new Date()): number | null {
  const day = now.getDay();
  let daysToWed: number;
  if (day === 0) daysToWed = 3;       // 일 → 3일 후 수요일
  else if (day === 1) daysToWed = 2;  // 월 → 2일 후 수요일
  else if (day === 2) daysToWed = 1;  // 화 → 1일 후 수요일
  else return null;
  const target = new Date(now);
  target.setDate(now.getDate() + daysToWed);
  target.setHours(0, 0, 0, 0);
  return target.getTime() - now.getTime();
}

/**
 * 토요일 20시(받기 마감)까지 남은 ms.
 * active 상태가 아니거나 토요일 20시 이후면 null.
 */
export function msToReceiveEnd(now: Date = new Date()): number | null {
  const day = now.getDay();
  const hour = now.getHours();
  if (day < 3) return null;                       // 일·월·화: 아직 시작 전
  if (day === 6 && hour >= RECEIVE_END_HOUR) return null; // 토요일 20시 이후: 이미 종료
  const target = new Date(now);
  const daysToSat = 6 - day;
  target.setDate(now.getDate() + daysToSat);
  target.setHours(RECEIVE_END_HOUR, 0, 0, 0);
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
/** 사전 계산된 풀/백테스트는 동일한 repo의 data/jachanism/에 저장됨. */
const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/woghks4143-spec/lottofinde/main/data/jachanism';

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
  const url = `${GITHUB_RAW_BASE}/pool_${round}.json`;
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
 * 사전 계산된 백테스트 결과를 GitHub raw에서 fetch.
 * 매주 월요일 GitHub Actions가 갱신함. 클라이언트 계산 불필요 → 즉시 표시.
 * 시간 기반 query로 CDN 캐시 회피 (1시간 단위로 새 URL).
 */
export async function fetchPrecomputedBacktest(): Promise<BacktestStats | null> {
  const url = `${GITHUB_RAW_BASE}/backtest.json?t=${Math.floor(Date.now() / 3600_000)}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    if (
      !json ||
      typeof json.rank1 !== 'number' ||
      typeof json.roundsTested !== 'number'
    ) return null;
    return {
      rank1: json.rank1,
      rank2: json.rank2,
      rank3: json.rank3,
      rank4: json.rank4,
      rank5: json.rank5,
      roundsTested: json.roundsTested,
      totalCombosTested: json.totalCombosTested,
      computedAt: json.computedAt,
    };
  } catch {
    return null;
  }
}

/**
 * 회차의 주간 풀에서 deviceSeed로 결정적 USER_LIMIT개 슬롯을 뽑은 뒤,
 * 그중 [offset, offset+count) 범위만 반환. 부분 수령 시 다음 N개를 가져올 때 사용.
 *
 * deviceSeed × round 시드는 고정이므로, 같은 기기는 항상 같은 순서로 50개를 받는다.
 */
export function pickUserCombosFromPool(
  pool: WeeklyPool,
  round: number,
  deviceSeed: string,
  offset = 0,
  count = USER_LIMIT,
): number[][] {
  const seed = hashString(`${deviceSeed}_${round}`);
  const rng = mulberry32(seed);
  const idx = Array.from({ length: pool.combos.length }, (_, i) => i);
  const totalSlots = Math.min(USER_LIMIT, idx.length);
  for (let i = 0; i < totalSlots; i++) {
    const j = i + Math.floor(rng() * (idx.length - i));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const start = Math.max(0, Math.min(offset, totalSlots));
  const end = Math.max(start, Math.min(offset + count, totalSlots));
  return idx.slice(start, end).map((i) => pool.combos[i].slice().sort((a, b) => a - b));
}

/**
 * 로컬 폴백용 — 회차 N개를 deviceSeed로 결정적 생성. offset/count로 부분 수령 지원.
 * 풀(GitHub)이 없을 때 사용.
 */
export function generateUserCombosRange(
  round: number,
  deviceSeed: string,
  offset = 0,
  count = USER_LIMIT,
): number[][] {
  const all = generateUserCombos(round, deviceSeed);
  const start = Math.max(0, Math.min(offset, all.length));
  const end = Math.max(start, Math.min(offset + count, all.length));
  return all.slice(start, end);
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

/**
 * 숫자 → "1,234개" 표기 (시니어 친화: K/M 약어 없이 풀숫자 + 쉼표).
 * compact 인자는 하위 호환을 위해 받지만 무시한다.
 */
export function fmtCount(n: number, _compact = false): string {
  return `${n.toLocaleString()}개`;
}
