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

/** GitHub Action으로 매주 자동 수집되는 enriched 데이터 — 동행복권 봇 차단 우회용. */
const ENDPOINT_GH_ENRICHED = 'https://raw.githubusercontent.com/woghks4143-spec/lottofinde/main/data/enriched/';

const TIMEOUT_MS = 10_000;
const RETRY_LIMIT = 3;

/** 동행복권이 봇을 차단하지 않도록 일반 브라우저 헤더 흉내.
 *  봇 감지 페이지(iSwaitPage/tracer)를 우회하기 위해 더 풍부한 헤더 + Referer 추가. */
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const COMMON_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://dhlottery.co.kr/',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?1',
  'Sec-Ch-Ua-Platform': '"Android"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
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

/**
 * 현재 시각이 동행복권 추첨 결과 공개 윈도우 안인지 확인한다.
 *
 * 공식 일정 (KST 기준):
 *   - 토요일 20:35 — MBC 추첨 생방송
 *   - 토요일 20:40~20:50 — 당첨번호 공개
 *   - 토요일 20:50~21:00 — 등위별 인원/당첨금 공개
 *   - 토요일 21:00~다음날 새벽 — 1·2등 배출 판매점 공개
 *
 * 이 함수는 "새 회차 데이터가 나올 가능성이 있는 시간대"를 반환한다:
 *   - 토요일 20:30 ~ 다음날(일) 03:00 KST → true (적극 페치)
 *   - 그 외 시간 → false (이미 최신, 페치 스킵)
 *
 * 일요일~금요일 + 토요일 새벽~저녁은 새 회차가 나올 리 없으므로 페치하지 않는다.
 * → 동행복권 서버 부하 ↓, 사용자 데이터/배터리 ↓
 */
export function isDrawWindow(now: Date = new Date()): boolean {
  // KST = UTC+9. 서버/디바이스 타임존 무관하게 계산.
  const kstMs = now.getTime() + 9 * 3600_000;
  const kst = new Date(kstMs);
  const dow = kst.getUTCDay(); // 0=일, 6=토
  const hour = kst.getUTCHours();
  const min = kst.getUTCMinutes();

  // 토요일 20:30 이후
  if (dow === 6 && (hour > 20 || (hour === 20 && min >= 30))) return true;
  // 일요일 03:00 이전
  if (dow === 0 && hour < 3) return true;
  return false;
}

/**
 * 다음 토요일 20:30 KST까지 남은 밀리초.
 * 추첨 윈도우 밖에서 "다음 추첨까지 N시간" 같은 UI에 쓸 수 있다.
 */
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
  const url = `${ENDPOINT_PRIZE}${drwNo}`;
  const html = await fetchTextWithRetry(url);
  if (!html) return null;
  return parseGameResultHtml(html);
}

/** 1·2등 당첨 판매점. 실패 시 빈 배열. */
export async function fetchTopStores(drwNo: number): Promise<WinningStore[]> {
  if (Platform.OS === 'web') return [];
  const url = `${ENDPOINT_STORE}${drwNo}`;
  const html = await fetchTextWithRetry(url);
  if (!html) return [];
  return parseTopStoreHtml(html);
}

/**
 * GitHub Action으로 매주 자동 수집된 enriched 데이터를 raw.githubusercontent.com에서 받음.
 * 동행복권이 봇 차단을 강화한 경우의 fallback. 서버에서 미리 파싱해둔 JSON이라 안정적.
 */
async function fetchFromGitHub(drwNo: number): Promise<Draw | null> {
  if (Platform.OS === 'web') return null;
  const url = `${ENDPOINT_GH_ENRICHED}${drwNo}.json?t=${Date.now()}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !json.round || !Array.isArray(json.nums)) return null;
    return json as Draw;
  } catch {
    return null;
  }
}

/**
 * 한 회차의 모든 정보 (JSON + HTML 2종)를 병렬 페치해 합쳐 반환.
 * 동행복권 봇 차단이 강해지면 직접 fetch가 봇 페이지를 받음 → GitHub fallback으로 보완.
 * 기본 정보(JSON)가 실패하면 null. 부가 정보(HTML)는 실패해도 기본 정보로 반환.
 */
export async function fetchRoundFull(drwNo: number): Promise<Draw | null> {
  const [basicRes, prizeRes, storeRes] = await Promise.allSettled([
    fetchRound(drwNo),
    fetchPrizes(drwNo),
    fetchTopStores(drwNo),
  ]);

  const basic = basicRes.status === 'fulfilled' ? basicRes.value : null;
  // 직접 fetch에서 등위/판매점이 안 나왔으면 GitHub fallback 시도
  const directPrize = prizeRes.status === 'fulfilled' ? prizeRes.value : null;
  const directStores = storeRes.status === 'fulfilled' ? storeRes.value : [];
  const needsFallback = !directPrize || directStores.length === 0;

  if (needsFallback) {
    const gh = await fetchFromGitHub(drwNo);
    if (gh) {
      // GitHub 데이터를 기본/등위/판매점 모두 우선. 직접 fetch한 게 있으면 그 위에 머지.
      const merged: Draw = { ...gh };
      if (basic) {
        // basic의 totalSales가 더 신선할 수 있음
        if (basic.totalSales && !merged.totalSales) merged.totalSales = basic.totalSales;
      }
      if (directPrize) {
        merged.prizes = directPrize.prizes;
        if (directPrize.totalSales) merged.totalSales = directPrize.totalSales;
      }
      if (directStores.length > 0) merged.topStores = directStores;
      return merged;
    }
  }

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
