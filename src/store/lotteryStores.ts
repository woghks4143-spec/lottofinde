/**
 * 1등/2등 배출점 스토어 — 번들된 stores.json을 로드.
 *
 * stores.json은 scripts/aggregate-stores.mjs가 회차별 enriched 데이터에서
 * 집계한 결과. ~5,000개 판매점, 각각 위경도 포함.
 *
 * 향후 자동 업데이트: aggregate-stores를 GitHub Actions에서 fetch 직후 실행하고
 * stores.json도 raw URL에서 갱신할 수 있게 확장 가능. 현재는 번들로만 사용.
 */
import { create } from 'zustand';
import seed from '@/src/data/stores.json';

export type LotteryStore = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  count1st: number;
  count2nd: number;
  lastWin1st?: { round: number; date: string };
  lastWin2nd?: { round: number; date: string };
};

type StoresShape = {
  updatedAt: string;
  latestRound: number;
  count: number;
  stores: LotteryStore[];
};

type State = {
  updatedAt: string;
  latestRound: number;
  stores: LotteryStore[];
};

const seedTyped = seed as StoresShape;

export const useLotteryStores = create<State>(() => ({
  updatedAt: seedTyped.updatedAt,
  latestRound: seedTyped.latestRound,
  stores: seedTyped.stores,
}));
