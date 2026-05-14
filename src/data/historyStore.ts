/**
 * historyStore — Zustand store that caches all known rounds and exposes
 * accessors used by every Lotto screen.
 *
 * Lifecycle:
 *   1. `hydrate()` runs at app boot (`app/_layout.tsx`), merging the bundled
 *      `rounds.json` (seeded from the user's Excel — 회차 400~1209) into the
 *      persisted state. Cheap & synchronous-feeling.
 *   2. `topUp()` runs ~200ms after first paint, only on native platforms where
 *      CORS doesn't block the dhlottery endpoint. Appends any newer rounds.
 *
 * Notes:
 *   - Persisted to AsyncStorage under `lottofinder.history.v1`. AsyncStorage on
 *     web is `localStorage`-backed, so reloading the dev page keeps state.
 *   - We index by round number (sparse Record<number, Draw>) so reads are O(1).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import type { Draw } from './lotto';
import seed from './rounds.json';
import { fetchRoundFull, fetchSince } from './dhlottery';
import { DEMO_ROUND_EXTRAS } from './dhlotteryDemo';

type SeedFile = {
  fetchedAt: string;
  source?: string;
  __mock?: boolean;
  latestRound: number;
  count: number;
  rounds: Draw[];
};

const seedFile = seed as unknown as SeedFile;

// Pre-build the initial state from the bundled seed so first render already
// has draws — avoids "blank home" while persist middleware async-rehydrates.
function buildInitialState() {
  const draws: Record<number, Draw> = {};
  for (const d of seedFile.rounds) draws[d.round] = d;
  const rounds = Object.keys(draws).map((k) => Number(k));
  return {
    draws,
    latestRound: rounds.length ? Math.max(...rounds) : 0,
    earliestRound: rounds.length ? Math.min(...rounds) : 0,
    isMock: !!seedFile.__mock,
  };
}
const seedState = buildInitialState();

type EnrichState = 'idle' | 'loading' | 'done' | 'failed';

type HistoryState = {
  draws: Record<number, Draw>;
  latestRound: number;       // max(round)
  earliestRound: number;     // min(round) — UI shows "회차 400~1209" honesty banner
  lastFetchedAt: number | null;
  isMock: boolean;
  /** round → 'loading'|'done'|'failed'. 동일 회차를 동시에 두 번 페치 방지. */
  enrichState: Record<number, EnrichState>;
  _hydrated: boolean;

  hydrate: () => void;
  topUp: () => Promise<{ added: number }>;
  /** 등위별 정보 + 판매점을 fetchRoundFull로 채워넣음. 이미 채워졌으면 noop. */
  enrichRound: (n: number) => Promise<boolean>;
  /** 새 회차가 나왔는지 확인하고 부가 정보까지 가져옴 (앱 포커스/주기 트리거). */
  autoUpdate: () => Promise<{ added: number; enriched: number }>;
  ingest: (newDraws: Draw[]) => number;
  /** 기존 회차 1건을 새 정보로 머지 (enrich 결과 반영). */
  upsertRound: (d: Draw) => void;

  getLatest: () => Draw | null;
  getRound: (n: number) => Draw | null;
  getRange: (from: number, to: number) => Draw[];   // inclusive, newest-first
  getLast: (n: number) => Draw[];                   // newest-first
  getAll: () => Draw[];                             // newest-first
};

export const useHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      ...seedState,
      lastFetchedAt: null,
      enrichState: {},
      _hydrated: true,

      hydrate: () => {
        const wasHydrated = get()._hydrated;
        const merged = { ...get().draws };

        // 시드 머지 (최초 1회만)
        if (!wasHydrated) {
          for (const d of seedFile.rounds) {
            if (!merged[d.round]) merged[d.round] = d;
          }
        }

        // 웹 전용 데모 머지 — idempotent. 매번 호출돼도 안전.
        // 모바일에서는 절대 머지되지 않는다. 모바일은 실제 fetchRoundFull이 채움.
        let demoMerged = false;
        if (Platform.OS === 'web') {
          for (const [roundStr, extras] of Object.entries(DEMO_ROUND_EXTRAS)) {
            const r = Number(roundStr);
            if (merged[r] && !merged[r].prizes && !merged[r].topStores) {
              merged[r] = { ...merged[r], ...extras };
              demoMerged = true;
            }
          }
        }

        if (wasHydrated && !demoMerged) return; // 아무 것도 안 바뀌었으면 set 생략

        const rounds = Object.keys(merged).map((k) => Number(k));
        set({
          draws: merged,
          latestRound: rounds.length ? Math.max(...rounds) : 0,
          earliestRound: rounds.length ? Math.min(...rounds) : 0,
          isMock: !!seedFile.__mock,
          _hydrated: true,
        });
      },

      topUp: async () => {
        // Web: dhlottery endpoint is HTML-wrapped → skip silently.
        if (Platform.OS === 'web') return { added: 0 };
        let added = 0;
        try {
          for await (const d of fetchSince(get().latestRound, 20)) {
            get().ingest([d]);
            added++;
          }
        } catch {
          // Network errors: swallow. The bundled seed is the source of truth.
        }
        set({ lastFetchedAt: Date.now() });
        return { added };
      },

      enrichRound: async (n) => {
        if (Platform.OS === 'web') return false;
        const existing = get().draws[n];
        // 이미 등위·판매점 둘 다 있으면 스킵
        if (existing?.prizes && existing.topStores && existing.topStores.length > 0) {
          return true;
        }
        const st = get().enrichState[n];
        if (st === 'loading' || st === 'done') return st === 'done';

        set((s) => ({ enrichState: { ...s.enrichState, [n]: 'loading' } }));
        const full = await fetchRoundFull(n);
        if (!full) {
          set((s) => ({ enrichState: { ...s.enrichState, [n]: 'failed' } }));
          return false;
        }
        get().upsertRound(full);
        set((s) => ({ enrichState: { ...s.enrichState, [n]: 'done' } }));
        return true;
      },

      autoUpdate: async () => {
        if (Platform.OS === 'web') return { added: 0, enriched: 0 };
        // 1) 새 회차 발견 → 기본 정보 ingest
        const { added } = await get().topUp();
        // 2) 신규로 들어온 최신 회차들에 부가 정보 채우기 (최근 추가된 회차만)
        let enriched = 0;
        if (added > 0) {
          const cur = get().latestRound;
          for (let i = 0; i < added; i++) {
            const r = cur - i;
            const ok = await get().enrichRound(r);
            if (ok) enriched++;
          }
        }
        return { added, enriched };
      },

      ingest: (newDraws) => {
        const cur = { ...get().draws };
        let added = 0;
        for (const d of newDraws) {
          if (!cur[d.round]) { cur[d.round] = d; added++; }
        }
        if (added === 0) return 0;
        const rounds = Object.keys(cur).map((k) => Number(k));
        set({
          draws: cur,
          latestRound: Math.max(...rounds),
          earliestRound: Math.min(...rounds),
          isMock: false,
        });
        return added;
      },

      upsertRound: (d) => {
        const cur = { ...get().draws };
        const prev = cur[d.round];
        // 기존 필드 유지하면서 새 값 덮어쓰기 (페치한 부가 정보가 더 풍부)
        cur[d.round] = { ...prev, ...d };
        const rounds = Object.keys(cur).map((k) => Number(k));
        set({
          draws: cur,
          latestRound: Math.max(...rounds),
          earliestRound: Math.min(...rounds),
        });
      },

      getLatest: () => {
        const { latestRound, draws } = get();
        return latestRound ? draws[latestRound] ?? null : null;
      },
      getRound: (n) => get().draws[n] ?? null,
      getRange: (from, to) => {
        const [lo, hi] = from <= to ? [from, to] : [to, from];
        const out: Draw[] = [];
        const d = get().draws;
        for (let r = hi; r >= lo; r--) if (d[r]) out.push(d[r]);
        return out;
      },
      getLast: (n) => {
        const { latestRound } = get();
        return get().getRange(Math.max(1, latestRound - n + 1), latestRound);
      },
      getAll: () => {
        const d = get().draws;
        return Object.keys(d)
          .map((k) => Number(k))
          .sort((a, b) => b - a)
          .map((r) => d[r]);
      },
    }),
    {
      name: 'lottofinder.history.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only the data — not the methods (Zustand drops them anyway).
      partialize: (s) => ({
        draws: s.draws,
        latestRound: s.latestRound,
        earliestRound: s.earliestRound,
        lastFetchedAt: s.lastFetchedAt,
        isMock: s.isMock,
      }),
      // After rehydration from storage, re-merge the bundled seed so updates
      // to the shipped rounds.json file flow through even if the user already
      // had an older cache.
      onRehydrateStorage: () => (state) => {
        if (state) state._hydrated = false;
      },
    },
  ),
);

