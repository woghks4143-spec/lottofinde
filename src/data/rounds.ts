/**
 * Typed accessor for src/data/rounds.json — the bundled-seed entry point.
 *
 * @deprecated Use `useHistory` from `@/src/data/historyStore` in new code.
 * This module remains as a static cache for build-time / one-shot reads;
 * runtime mutations (top-up after dhlottery fetch) only flow through
 * historyStore. Existing imports here will still work but won't reflect
 * post-boot updates.
 */
import seed from './rounds.json';
import type { Draw } from './lotto';

const file = seed as unknown as {
  __mock?: boolean;
  fetchedAt: string;
  latestRound: number;
  count: number;
  rounds: Draw[];
};

/** Newest → oldest. */
export const rounds: Draw[] = [...file.rounds].sort((a, b) => b.round - a.round);

/** The single newest draw (the "최신 결과" banner). */
export const latestDraw: Draw = rounds[0];

/** Convenience: last N draws, newest first. */
export function lastN(n: number): Draw[] {
  return rounds.slice(0, n);
}

/** True when the bundled JSON is synthetic — show a "비공식 시드" hint in UI. */
export const isMockData: boolean = !!file.__mock;
