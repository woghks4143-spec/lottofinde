/**
 * Runtime fetcher for dhlottery.co.kr endpoints.
 *
 * 동행복권은 3개의 엔드포인트를 제공한다:
 *   1) JSON: `common.do?method=getLottoNumber&drwNo=N`
 *      → 회차/날짜/번호 6개/보너스 + 1등 정보 + 총판매액
 *   2) HTML: `gameResult.do?method=byWin&drwNo=N`
 *      → 1~5등 등위별 당첨 정보 표
 *   3) HTML: `store.do?method=topStore&pageGubun=L645&drwNo=N`
 *      → 1·2등 당첨 판매점 목록
 *
 * Historical note (2026-05): dhlottery wrapped these endpoints in a JS-rendered
 * interstitial on `www.dhlottery.co.kr`, so the **web** platform can no longer
 * fetch them directly (CORS + HTML response). Native targets (iOS/Android) work.
 *
 * Design: 절대 throw하지 않는다. 실패는 `null` 또는 빈 배열로 반환되어, 호출 측은
 * 부가 정보 없이 시드/번들된 데이터로 진행할 수 있다.
 */
import { Platform } from 'react-native';
import type { Draw, WinningStore } from './lotto';
import { parseGameResultHtml, parseTopStoreHtml } from './dhlotteryParse';

const ENDPOINT_JSON  = 'https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=';
const ENDPOINT_PRIZE = 'https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo=';
const ENDPOINT_STORE = 'https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645&drwNo=';

const TIMEOUT_MS = 10_000;
const RETRY_LIMIT = 3;

/** 동행복권이 봇을 차단하지 않도록 일반 브라우저 헤더 흉내. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
};

type DhJsonResponse = {
  returnValue: 'success' | 'fail';
  drwNo: number;
  drwNoDate: string;
  drwtNo1: number; drwtNo2: number; drwtNo3: number;
  drwtNo4: number; drwtNo5: number; drwtNo6: number;
  bnusNo: number;
  firstWinamnt?: number;
  firstPrzwnerCo?: number;
  firstAccumamnt?: number;
  totSellamnt?: number;
};

/**
 * round 1 was drawn 2002-12-07 (Saturday). Each subsequent Saturday adds 1.
 * Returns the round that should be available right now (Sat ≥21:00 KST).
 */
export function expectedLatestRound(today: Date = new Date()): number {
  const start = Date.UTC(2002, 11, 7);
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dow = d.getUTCDay();
  const daysBack = (dow + 1) % 7; // Sat=6→0, Sun=0→1, ...
  const sat = d.getTime() - daysBack * 86_400_000;
  return 1 + Math.floor((sat - start) / (7 * 86_400_000));
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: COMMON_HEADERS });
  } finally {
    clearTimeout(t);
  }
}

/** 최대 RETRY_LIMIT번 재시도. 매 시도마다 timeout 적용. */
async function fetchTextWithRetry(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        if (attempt < RETRY_LIMIT) continue;
        return null;
      }
      return await res.text();
    } catch {
      if (attempt < RETRY_LIMIT) {
        // 지수 백오프: 200ms → 600ms → 1200ms
        await new Promise((r) => setTimeout(r, 200 * Math.pow(3, attempt - 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ─── JSON: 1등 정보 + 번호 ────────────────────────────────────────────────────

/** 한 회차의 기본 정보(번호/1등). 실패 시 null. */
export async function fetchRound(drwNo: number): Promise<Draw | null> {
  if (!Number.isInteger(drwNo) || drwNo < 1) return null;
  const text = await fetchTextWithRetry(`${ENDPOINT_JSON}${drwNo}`);
  if (!text) return null;
  if (!text.trim().startsWith('{')) return null; // HTML interstitial 방어
  try {
    const j = JSON.parse(text) as DhJsonResponse;
    if (j.returnValue !== 'success') return null;
    const nums = [j.drwtNo1, j.drwtNo2, j.drwtNo3, j.drwtNo4, j.drwtNo5, j.drwtNo6];
    if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 45)) return null;
    if (!Number.isInteger(j.bnusNo) || j.bnusNo < 1 || j.bnusNo > 45) return null;
    return {
      round: j.drwNo,
      date: j.drwNoDate,
      nums: nums.sort((a, b) => a - b),
      bonus: j.bnusNo,
      firstWinAmount: j.firstWinamnt,
      firstWinners: j.firstPrzwnerCo,
      totalSales: j.totSellamnt,
    };
  } catch {
    return null;
  }
}

// ─── HTML: 1~5등 + 1·2등 판매점 ──────────────────────────────────────────────

/** 등위별 당첨 정보. 실패 시 null. */
export async function fetchPrizes(drwNo: number): Promise<{
  prizes: NonNullable<Draw['prizes']>;
  totalSales?: number;
} | null> {
  if (Platform.OS === 'web') return null; // CORS
  const html = await fetchTextWithRetry(`${ENDPOINT_PRIZE}${drwNo}`);
  if (!html) return null;
  return parseGameResultHtml(html);
}

/** 1·2등 당첨 판매점. 실패 시 빈 배열. */
export async function fetchTopStores(drwNo: number): Promise<WinningStore[]> {
  if (Platform.OS === 'web') return [];
  const html = await fetchTextWithRetry(`${ENDPOINT_STORE}${drwNo}`);
  if (!html) return [];
  return parseTopStoreHtml(html);
}

/**
 * 한 회차의 모든 정보 (JSON + HTML 2종)를 병렬 페치해 합쳐 반환.
 * 기본 정보(JSON)가 실패하면 null. 부가 정보(HTML)는 실패해도 기본 정보로 반환.
 */
export async function fetchRoundFull(drwNo: number): Promise<Draw | null> {
  const [basicRes, prizeRes, storeRes] = await Promise.allSettled([
    fetchRound(drwNo),
    fetchPrizes(drwNo),
    fetchTopStores(drwNo),
  ]);

  const basic = basicRes.status === 'fulfilled' ? basicRes.value : null;
  if (!basic) return null;

  const draw: Draw = { ...basic };

  if (prizeRes.status === 'fulfilled' && prizeRes.value) {
    draw.prizes = prizeRes.value.prizes;
    if (prizeRes.value.totalSales && !draw.totalSales) {
      draw.totalSales = prizeRes.value.totalSales;
    }
  }
  if (storeRes.status === 'fulfilled' && storeRes.value.length > 0) {
    draw.topStores = storeRes.value;
  }

  return draw;
}

/**
 * `latestKnown` 보다 최신 회차들을 차례로 yield. 기본 정보만 빠르게 가져옴
 * (부가 정보는 사용자가 회차를 열어볼 때 on-demand로 채움). 가장 최신 회차
 * 페치가 실패하면 엔드포인트가 막힌 것으로 판단해 즉시 중단.
 */
export async function* fetchSince(latestKnown: number, limit = 20): AsyncGenerator<Draw> {
  const target = expectedLatestRound();
  if (target <= latestKnown) return;
  let yielded = 0;
  for (let drw = target; drw > latestKnown && yielded < limit; drw--) {
    const r = await fetchRound(drw);
    if (!r) {
      if (drw === target) return; // 최신부터 실패 → 엔드포인트 문제
      continue;
    }
    yield r;
    yielded++;
  }
}
