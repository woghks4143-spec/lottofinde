/**
 * Runtime fetcher for dhlottery.co.kr data.
 *
 * 데이터 소스 전략 (우선순위):
 *   1) GitHub raw URL — 매주 토요일 GitHub Actions가 로그인하여 수집해둔 JSON
 *      • 가장 안정 (정부 보다도 안정적, 우리 통제 100%)
 *      • 차단 0% (raw.githubusercontent.com은 어디서도 안 막힘)
 *      • 1·2등 판매점, 1~5등 prize, methodCounts 다 포함
 *   2) (직접 fetch는 더 이상 시도하지 않음)
 *      • dhlottery WAF가 익명 자동화 요청을 모두 차단함
 *      • RN fetch, RN WebView, Playwright, curl 모두 차단됨
 *      • 로그인된 세션만 통과 → 서버측 자동화로 해결
 *
 * 호출 측은 실패 시 null/[] 받음 → 번들된 rounds.json으로 fallback.
 */
import { Platform } from 'react-native';
import type { Draw } from './lotto';

/** GitHub Actions로 매주 자동 수집되는 enriched 데이터 (PRIMARY 소스). */
const ENDPOINT_GH_ENRICHED = 'https://raw.githubusercontent.com/woghks4143-spec/lottofinde/main/data/enriched/';

const TIMEOUT_MS = 10_000;

/** 디버그 로깅 토글. */
const DEBUG = __DEV__;
function log(...args: unknown[]) {
  if (DEBUG) console.log('[dhlottery]', ...args);
}

// ─── 날짜/회차 유틸 ──────────────────────────────────────────────────────────

/**
 * round 1 was drawn 2002-12-07 (Saturday). Each subsequent Saturday adds 1.
 * Returns the round that should be available right now.
 */
export function expectedLatestRound(today: Date = new Date()): number {
  const start = Date.UTC(2002, 11, 7);
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dow = d.getUTCDay();
  const daysBack = (dow + 1) % 7; // Sat=6→0, Sun=0→1, ...
  const sat = d.getTime() - daysBack * 86_400_000;
  return 1 + Math.floor((sat - start) / (7 * 86_400_000));
}

/**
 * 현재 시각이 동행복권 추첨 결과 공개 윈도우 안인지 확인.
 *
 * 공식 일정 (KST):
 *   - 토 20:35 추첨 → 20:50 등위 정보 → 21:00 1·2등 판매점
 *   - GitHub Actions가 22:30, 23:00, 23:30 KST에 자동 수집
 *
 * 이 함수: 토 20:30 ~ 일 03:00 KST → true
 */
export function isDrawWindow(now: Date = new Date()): boolean {
  const kstMs = now.getTime() + 9 * 3600_000;
  const kst = new Date(kstMs);
  const dow = kst.getUTCDay();
  const hour = kst.getUTCHours();
  const min = kst.getUTCMinutes();

  if (dow === 6 && (hour > 20 || (hour === 20 && min >= 30))) return true;
  if (dow === 0 && hour < 3) return true;
  return false;
}

/** 다음 토 20:30 KST까지 남은 ms. */
export function msUntilNextDraw(now: Date = new Date()): number {
  const kstMs = now.getTime() + 9 * 3600_000;
  const kst = new Date(kstMs);
  const dow = kst.getUTCDay();
  const daysUntilSat = (6 - dow + 7) % 7;
  const target = new Date(kst);
  target.setUTCDate(kst.getUTCDate() + daysUntilSat);
  target.setUTCHours(20, 30, 0, 0);
  if (target.getTime() <= kst.getTime()) {
    target.setUTCDate(target.getUTCDate() + 7);
  }
  return target.getTime() - kst.getTime();
}

// ─── GitHub raw fetch (PRIMARY 데이터 소스) ─────────────────────────────────

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * GitHub raw에서 한 회차 데이터 가져오기.
 * 우리 GitHub Actions가 매주 수집해둔 enriched JSON.
 */
async function fetchFromGitHub(drwNo: number): Promise<Draw | null> {
  if (!Number.isInteger(drwNo) || drwNo < 1) return null;
  // 캐시 회피를 위한 timestamp는 raw.githubusercontent.com에선 무시되지만 안전 차원으로
  const url = `${ENDPOINT_GH_ENRICHED}${drwNo}.json?t=${Math.floor(Date.now() / 3600_000)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      log(`fetch round ${drwNo}: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    if (!json || typeof json.round !== 'number' || !Array.isArray(json.nums)) {
      log(`fetch round ${drwNo}: invalid JSON structure`);
      return null;
    }
    log(`fetch round ${drwNo}: ✓ (nums=${json.nums.join(',')}, bonus=${json.bonus})`);
    return json as Draw;
  } catch (e) {
    log(`fetch round ${drwNo}: error`, (e as Error)?.message);
    return null;
  }
}

/**
 * 전체 회차 인덱스 가져오기. GitHub Actions가 매번 갱신함.
 * { updatedAt, rounds: [최신부터 정렬된 회차 번호 배열] }
 */
async function fetchEnrichedIndex(): Promise<{ updatedAt: string; rounds: number[] } | null> {
  const url = `${ENDPOINT_GH_ENRICHED}index.json?t=${Math.floor(Date.now() / 3600_000)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !Array.isArray(json.rounds)) return null;
    return json;
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * 한 회차의 모든 정보 가져오기 (GitHub raw).
 * 실패 시 null.
 *
 * 동행복권 직접 fetch는 모두 차단되므로 우리 GitHub 미러만 시도.
 */
export async function fetchRound(drwNo: number): Promise<Draw | null> {
  return fetchFromGitHub(drwNo);
}

/** fetchRound와 동일 (legacy 이름 호환). */
export async function fetchRoundFull(drwNo: number): Promise<Draw | null> {
  return fetchFromGitHub(drwNo);
}

/**
 * `latestKnown`보다 최신 회차들 yield.
 * GitHub index에서 누락된 회차들만 차례로 가져옴.
 */
export async function* fetchSince(latestKnown: number, limit = 20): AsyncGenerator<Draw> {
  if (Platform.OS === 'web') return; // 웹에선 사용 안 함 (CORS 안전)

  const index = await fetchEnrichedIndex();
  if (!index) return;

  // index.rounds는 최신부터 정렬됨. latestKnown 보다 큰 것들만.
  const newer = index.rounds.filter((n) => n > latestKnown).sort((a, b) => a - b);
  let yielded = 0;
  for (const drw of newer) {
    if (yielded >= limit) break;
    const d = await fetchFromGitHub(drw);
    if (d) {
      yield d;
      yielded++;
    }
  }
}
