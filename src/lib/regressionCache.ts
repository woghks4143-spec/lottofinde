/**
 * 회귀분석 ranking 캐시 — 3단계 최적화로 진입 속도 개선.
 *
 *   1) Module cache (RAM)   — 같은 세션 내 같은 회차 재진입 시 0ms
 *   2) AsyncStorage cache   — 앱 재시작 후에도 즉시 표시
 *   3) Boot prewarm         — 앱 시작 시 백그라운드로 미리 계산
 *
 * 회차 데이터가 변경되면 (새 회차 추가 등) latestRound 키로 자동 invalidation.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Draw } from '@/src/data/lotto';

export type StreakItem = { k: number; streak: number; totalOverlap: number };
export type RateItem = { k: number; avg: number; rate: number; lift: number; pairs: number };
export type RegressionRanking = {
  streak: StreakItem[];
  rate: RateItem[];
  computedAt: number;
};

// K=1..RATE_RANK_RANGE (회귀분석 화면과 동일 상수)
const RATE_RANK_RANGE = 500;
const EXPECTED_OVERLAP = 6 * 6 / 45;

// ─── L1: Module-level RAM cache ──────────────────────────────────────────────
// 같은 세션 내에서 같은 effectiveRound 재진입 시 즉시 반환.
const memCache = new Map<number, RegressionRanking>();

// ─── L2: AsyncStorage 영속 캐시 ───────────────────────────────────────────────
// 앱 재시작해도 즉시 표시. latestRound 키로 자동 invalidation.
const STORAGE_KEY = 'lottofinder.regression.v1';

type StorageShape = { round: number; data: RegressionRanking };

/** 영속 캐시 — 마지막으로 prewarm한 회차의 ranking. */
export async function loadPersistedRanking(round: number): Promise<RegressionRanking | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StorageShape = JSON.parse(raw);
    if (parsed.round !== round) return null; // 회차 바뀌면 무효
    return parsed.data;
  } catch {
    return null;
  }
}

async function savePersistedRanking(round: number, data: RegressionRanking): Promise<void> {
  try {
    const payload: StorageShape = { round, data };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore — 캐시 실패해도 화면은 정상 동작
  }
}

// ─── 계산 함수 ─────────────────────────────────────────────────────────────
/**
 * K=1..500 streak/rate ranking 계산.
 * draws는 newest-first (effectiveRound부터 1회차까지).
 * 약 600K * 2 ops — 모바일에서 300~600ms 소요. 한 번 계산하면 캐시.
 */
export function computeRegressionRanking(draws: Draw[]): RegressionRanking {
  // streak ranking
  const streakItems: StreakItem[] = [];
  for (let kx = 1; kx <= RATE_RANK_RANGE; kx++) {
    let streak = 0;
    let totalOverlap = 0;
    for (let i = 0; i < draws.length - kx; i++) {
      const target = draws[i];
      const source = draws[i + kx];
      if (!target || !source) break;
      const sourceSet = new Set(source.nums);
      let cnt = 0;
      for (const n of target.nums) if (sourceSet.has(n)) cnt++;
      if (cnt > 0) { streak++; totalOverlap += cnt; }
      else break;
    }
    streakItems.push({ k: kx, streak, totalOverlap });
  }
  streakItems.sort((a, b) => b.streak - a.streak || b.totalOverlap - a.totalOverlap);

  // rate ranking
  const rateItems: RateItem[] = [];
  for (let kx = 1; kx <= RATE_RANK_RANGE; kx++) {
    let total = 0;
    let pairs = 0;
    for (let i = 0; i < draws.length - kx; i++) {
      const target = draws[i];
      const source = draws[i + kx];
      if (!target || !source) continue;
      const sourceSet = new Set(source.nums);
      for (const n of target.nums) if (sourceSet.has(n)) total++;
      pairs++;
    }
    if (pairs === 0) continue;
    const avg = total / pairs;
    rateItems.push({
      k: kx, avg,
      rate: (avg / 6) * 100,
      lift: avg / EXPECTED_OVERLAP,
      pairs,
    });
  }
  rateItems.sort((a, b) => b.rate - a.rate);

  return { streak: streakItems, rate: rateItems, computedAt: Date.now() };
}

// ─── 통합 API ───────────────────────────────────────────────────────────────
/**
 * Ranking 가져오기 — 3단계 캐시 순회.
 *   1) memCache (RAM, 즉시)
 *   2) AsyncStorage (50ms, 비동기)
 *   3) compute (500ms, 동기)
 *
 * 호출 측은 결과를 받으면 setState. 동기 계산 트리거되면 별도로 InteractionManager로 감싸 사용.
 */
export function getMemCached(round: number): RegressionRanking | null {
  return memCache.get(round) ?? null;
}

export function setCached(round: number, data: RegressionRanking): void {
  memCache.set(round, data);
  // 영속 캐시 — 가장 최근 round만 저장 (디스크 한 슬롯)
  savePersistedRanking(round, data);
}

/**
 * 앱 부트 시 1회 호출 — 백그라운드로 latestRound 기준 ranking 미리 계산.
 * 이미 캐시에 있으면 skip. 계산 완료 시 mem + AsyncStorage에 자동 저장.
 *
 * 사용 예 (_layout.tsx):
 *   useEffect(() => {
 *     InteractionManager.runAfterInteractions(() => {
 *       prewarmRegression(latestRound, drawsArray);
 *     });
 *   }, [latestRound]);
 */
export async function prewarmRegression(round: number, draws: Draw[]): Promise<void> {
  if (memCache.has(round)) return; // 이미 RAM에 있음

  // 1) AsyncStorage 먼저 확인 (앱 재시작 직후)
  const persisted = await loadPersistedRanking(round);
  if (persisted) {
    memCache.set(round, persisted);
    return;
  }

  // 2) 계산
  if (draws.length < 20) return;
  const data = computeRegressionRanking(draws);
  setCached(round, data);
}
