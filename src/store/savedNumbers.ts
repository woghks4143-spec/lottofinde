/**
 * savedNumbers — Zustand store for the user's saved lottery tickets (PRD F-004).
 *
 * Capacity capped at 1,000 entries per PRD. Each `SavedGame` is a single
 * 6-number combo with optional grouping by receipt and post-draw result.
 *
 * Duplicate detection: same sorted nums + same round (or both nulls).
 * Persisted to AsyncStorage under `lottofinder.saved.v1`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Rank } from '@/src/data/lotto';
import { rank, sort6 } from '@/src/data/lotto';
import { useHistory } from '@/src/data/historyStore';

export type GameSource = 'qr' | 'manual' | 'gen' | 'simulator';
export type GameLabel = 'A' | 'B' | 'C' | 'D' | 'E';

export type SavedGame = {
  id: string;
  nums: number[];               // length 6, ascending
  createdAt: number;            // epoch ms
  round: number | null;         // null = "다음 회차"
  source: GameSource;
  label?: GameLabel;
  receiptId?: string;
  memo?: string;
  result?: {
    rank: Rank;
    hits: number[];
    payout: number;             // 0 when no rank
    checkedAt: number;
  };
};

// 5,000건 — AsyncStorage 안전 범위 (~1.5MB) 내에서 일반 사용자가
// 충분히 쓸 수 있는 한도. 그 이상에서는 필터·정렬 등이 체감상 느려질 수 있음.
const LIMIT = 5000;

function genId(): string {
  // crypto.randomUUID is widely available (web, RN 0.71+) but guard anyway.
  // The bare-bones fallback is acceptable for local-only IDs.
  try {
    // @ts-ignore — RN's global crypto may not type randomUUID.
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type SavedNumbersState = {
  games: SavedGame[];

  /** Returns ok:false with reason 'limit' or 'duplicate' when blocked. */
  add: (g: Omit<SavedGame, 'id' | 'createdAt'> & { id?: string; createdAt?: number })
    => { ok: true; id: string } | { ok: false; reason: 'limit' | 'duplicate' };
  addMany: (gs: Array<Omit<SavedGame, 'id' | 'createdAt'>>)
    => { added: number; skipped: number; reasons: Array<'limit' | 'duplicate'> };

  remove: (id: string) => void;
  /** 특정 회차의 모든 게임 일괄 삭제. round=null 은 "다음 회차" 그룹. */
  removeRound: (round: number | null) => { removed: number };
  clear: () => void;
  byRound: (round: number | null) => SavedGame[];
  totalPayout: () => number;

  /**
   * Run rank() for every game whose `round` is now in history and whose
   * `result` is still undefined. No-op if nothing to do.
   */
  syncResults: () => { updated: number };
};

function keyFor(nums: number[], round: number | null): string {
  return `${round ?? 'next'}|${sort6(nums).join(',')}`;
}

export const useSavedNumbers = create<SavedNumbersState>()(
  persist(
    (set, get) => ({
      games: [],

      add: (g) => {
        const games = get().games;
        if (games.length >= LIMIT) return { ok: false, reason: 'limit' };
        const k = keyFor(g.nums, g.round);
        if (games.some((x) => keyFor(x.nums, x.round) === k)) {
          return { ok: false, reason: 'duplicate' };
        }
        const id = g.id ?? genId();
        const created: SavedGame = {
          id,
          createdAt: g.createdAt ?? Date.now(),
          nums: sort6(g.nums),
          round: g.round,
          source: g.source,
          label: g.label,
          receiptId: g.receiptId,
          memo: g.memo,
          result: g.result,
        };
        set({ games: [created, ...games] });
        return { ok: true, id };
      },

      addMany: (gs) => {
        const reasons: Array<'limit' | 'duplicate'> = [];
        let added = 0;
        for (const g of gs) {
          const res = get().add(g);
          if (res.ok) added++;
          else reasons.push(res.reason);
        }
        return { added, skipped: gs.length - added, reasons };
      },

      remove: (id) => set({ games: get().games.filter((g) => g.id !== id) }),
      removeRound: (round) => {
        const before = get().games.length;
        const next = get().games.filter((g) => g.round !== round);
        set({ games: next });
        return { removed: before - next.length };
      },
      clear: () => set({ games: [] }),
      byRound: (round) => get().games.filter((g) => g.round === round),
      totalPayout: () => get().games.reduce((s, g) => s + (g.result?.payout ?? 0), 0),

      syncResults: () => {
        const history = useHistory.getState();
        const games = get().games;
        let updated = 0;
        const next = games.map((g) => {
          if (g.result || g.round == null) return g;
          const draw = history.getRound(g.round);
          if (!draw) return g;
          const r = rank(g.nums, draw.nums, draw.bonus);
          const hits = g.nums.filter((n) => draw.nums.includes(n));
          const payout = computePayout(r, draw);
          updated++;
          return { ...g, result: { rank: r, hits, payout, checkedAt: Date.now() } };
        });
        if (updated > 0) set({ games: next });
        return { updated };
      },
    }),
    {
      name: 'lottofinder.saved.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ games: s.games }),
    },
  ),
);

/**
 * Rough payout — only rank 1 uses the historical `firstWinAmount` (if known).
 * Ranks 2-5 have well-known fixed prize bands but vary by round; we expose
 * conservative typical amounts. The user can override per-game via memo.
 */
function computePayout(r: Rank, draw: { firstWinAmount?: number; firstWinners?: number }): number {
  if (r === null) return 0;
  if (r === 1) {
    if (draw.firstWinAmount && draw.firstWinners) return Math.floor(draw.firstWinAmount); // per-winner share
    return 0;
  }
  // Approximate typical 2~5등 prizes (KRW)
  if (r === 2) return 50_000_000;
  if (r === 3) return 1_500_000;
  if (r === 4) return 50_000;
  if (r === 5) return 5_000;
  return 0;
}
