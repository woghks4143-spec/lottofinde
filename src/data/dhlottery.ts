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

/** smok95 미러 (FALLBACK 소스) — GitHub Actions cron 지연 시 직접 조회.
 *  추첨 직후 빠르게 갱신되며 당첨번호+당첨금+판매점 모두 제공. */
const ENDPOINT_SMOK_RESULT = 'https://smok95.github.io/lotto/results/';
const ENDPOINT_SMOK_STORES = 'https://smok95.github.io/lotto/winning-stores/';

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

// ─── smok95 직접 fetch (FALLBACK) ───────────────────────────────────────────
// GitHub Actions cron이 지연될 때(토요일 밤 흔함) 앱이 smok95에서 직접 최신
// 결과를 가져와 즉시 표시. 모바일 앱이라 CORS 무관.

/** smok95 구매방식 문자열 → 우리 method 타입. */
function smokMethod(combo: string | undefined): 'auto' | 'manual' | 'mixed' | 'unknown' {
  const c = String(combo || '').trim();
  if (/자동/.test(c)) return /수동|반자동|혼합/.test(c) ? 'mixed' : 'auto';
  if (/반자동|혼합/.test(c)) return 'mixed';
  if (/수동/.test(c)) return 'manual';
  return 'unknown';
}

/** smok95 division 배열 → 우리 prizes 구조.
 *  smok95 형식: divisions 배열의 순서가 1~5등, 각 { prize(1게임당), winners }. */
function smokDivisionsToPrizes(divisions: any[]): Draw['prizes'] | undefined {
  if (!Array.isArray(divisions)) return undefined;
  const keys: Array<keyof NonNullable<Draw['prizes']>> = ['first', 'second', 'third', 'fourth', 'fifth'];
  const prizes: NonNullable<Draw['prizes']> = {};
  for (let i = 0; i < divisions.length && i < 5; i++) {
    const d = divisions[i];
    if (!d) continue;
    const amount = Number(d.prize ?? d.prize_per_winner ?? 0) || 0;
    const winners = Number(d.winners ?? d.winner_count ?? 0) || 0;
    if (amount > 0 || winners > 0) {
      prizes[keys[i]] = { amount, winners };
    }
  }
  return Object.keys(prizes).length ? prizes : undefined;
}

/**
 * smok95에서 한 회차 결과 + 판매점 가져와 Draw로 변환.
 * GitHub raw가 아직 그 회차를 안 가졌을 때 폴백으로 사용.
 */
async function fetchFromSmok(drwNo: number): Promise<Draw | null> {
  if (!Number.isInteger(drwNo) || drwNo < 1) return null;
  try {
    const res = await fetchWithTimeout(`${ENDPOINT_SMOK_RESULT}${drwNo}.json`);
    if (!res.ok) return null;
    const j = await res.json();
    // smok95 형식: { draw_no, numbers:[6], bonus_no, date, divisions, total_sales_amount, winners_combination }
    const nums = Array.isArray(j?.numbers) ? j.numbers.map(Number) : null;
    if (!nums || nums.length !== 6 || j?.bonus_no == null) {
      log(`smok round ${drwNo}: invalid structure`);
      return null;
    }
    const draw: Draw = {
      round: Number(j.draw_no ?? drwNo),
      date: String(j.date ?? '').slice(0, 10),
      nums: [...nums].sort((a, b) => a - b),
      bonus: Number(j.bonus_no),
      totalSales: j.total_sales_amount != null ? Number(j.total_sales_amount) : undefined,
      prizes: smokDivisionsToPrizes(j.divisions),
    };
    // 1등 요약
    if (draw.prizes?.first) {
      draw.firstWinAmount = draw.prizes.first.amount;
      draw.firstWinners = draw.prizes.first.winners;
    }

    // 판매점 (winning-stores) — 별도 엔드포인트, 실패해도 무시
    try {
      const sres = await fetchWithTimeout(`${ENDPOINT_SMOK_STORES}${drwNo}.json`);
      if (sres.ok) {
        const arr = await sres.json();
        if (Array.isArray(arr)) {
          const stores = arr
            .map((s: any): import('./lotto').WinningStore => ({
              rank: 1, // smok95 winning-stores는 1등 배출점
              name: String(s?.name || '').trim(),
              address: String(s?.address || '').trim(),
              method: smokMethod(s?.combination ?? s?.method),
            }))
            .filter((s) => s.name);
          if (stores.length) draw.topStores = stores;
        }
      }
    } catch { /* 판매점 실패는 무시 */ }

    log(`smok round ${drwNo}: ✓ (nums=${draw.nums.join(',')}, stores=${draw.topStores?.length ?? 0})`);
    return draw;
  } catch (e) {
    log(`smok round ${drwNo}: error`, (e as Error)?.message);
    return null;
  }
}

/** smok95 최신 회차 번호 조회. */
async function fetchSmokLatestRound(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(`${ENDPOINT_SMOK_RESULT}latest.json`);
    if (!res.ok) return null;
    const j = await res.json();
    const n = Number(j?.draw_no);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
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
 * 한 회차의 모든 정보 가져오기.
 * 1순위 GitHub raw → 실패 시 smok95 직접 폴백.
 *
 * GitHub Actions cron 지연으로 최신 회차가 아직 GitHub에 없을 때도
 * smok95에서 즉시 가져와 사용자에게 빠르게 노출.
 */
export async function fetchRound(drwNo: number): Promise<Draw | null> {
  const gh = await fetchFromGitHub(drwNo);
  if (gh) return gh;
  return fetchFromSmok(drwNo);
}

/** fetchRound와 동일 (legacy 이름 호환). */
export async function fetchRoundFull(drwNo: number): Promise<Draw | null> {
  return fetchRound(drwNo);
}

/**
 * `latestKnown`보다 최신 회차들 yield.
 * 1순위 GitHub index → 거기 없는 회차는 smok95 직접 폴백.
 */
export async function* fetchSince(latestKnown: number, limit = 20): AsyncGenerator<Draw> {
  if (Platform.OS === 'web') return; // 웹에선 사용 안 함 (CORS 안전)

  const index = await fetchEnrichedIndex();
  const ghRounds = index ? index.rounds.filter((n) => n > latestKnown) : [];

  // GitHub에 있는 최신 회차들 (오름차순)
  const ghSet = new Set(ghRounds);
  let yielded = 0;

  for (const drw of [...ghRounds].sort((a, b) => a - b)) {
    if (yielded >= limit) break;
    const d = await fetchFromGitHub(drw);
    if (d) { yield d; yielded++; }
  }

  // GitHub이 아직 못 가진 최신 회차가 smok95엔 있을 수 있음 → 폴백.
  // smok95 최신 회차까지 latestKnown+1 부터 채워봄.
  if (yielded < limit) {
    const smokLatest = await fetchSmokLatestRound();
    if (smokLatest && smokLatest > latestKnown) {
      const ghMax = ghRounds.length ? Math.max(...ghRounds) : latestKnown;
      for (let drw = Math.max(latestKnown, ghMax) + 1; drw <= smokLatest; drw++) {
        if (yielded >= limit) break;
        if (ghSet.has(drw)) continue; // 이미 GitHub에서 처리됨
        const d = await fetchFromSmok(drw);
        if (d) { yield d; yielded++; }
      }
    }
  }
}
