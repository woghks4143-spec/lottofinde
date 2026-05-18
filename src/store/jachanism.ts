/**
 * 귀찮이즘 조합 — PRO 멤버십 전용 주간 자동 분석 기능.
 *
 * 매주 토요일 추첨 후 일요일 분석 → 수~금 받기 → 토 추첨.
 * 한 회차당 받은 조합 50개를 보관하며, 추첨 완료 후 등수 결과를 함께 표시한다.
 *
 * deviceSeed는 첫 실행 시 1회만 생성·영속되어, 같은 기기는 같은 회차에서
 * 항상 동일한 50조합을 생성한다. (실제 서비스에서는 서버가 사용자별 unique
 * 조합을 발급하지만, 클라이언트 단독 운영 시에도 기기 단위 안정성을 보장.)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import backtestSeed from '@/src/data/backtest_seed.json';

export type JachanismEntry = {
  round: number;
  receivedAt: number;
  combos: number[][]; // 50조합, 각 조합 6개 번호 (오름차순)
};

/** 백테스트 캐시 — latestRound 기준 1회 계산 후 영속. */
export type BacktestCache = {
  latestRound: number;
  rank1: number; rank2: number; rank3: number; rank4: number; rank5: number;
  roundsTested: number;
  totalCombosTested: number;
  computedAt: number;
};

type JachanismState = {
  /** 첫 생성 시 1회만 만들어지는 기기 식별 시드. */
  deviceSeed: string;
  /** 회차별 받은 조합 (round → entry). */
  weekly: Record<number, JachanismEntry>;
  /** 30회 백테스트 결과 캐시 (latestRound 변경 시 무효). */
  backtest: BacktestCache | null;
  /** 백테스트 계산 중 중복 실행 방지 플래그. */
  computing: boolean;

  /** 조합 50개를 해당 회차에 기록. */
  receive: (round: number, combos: number[][]) => void;
  has: (round: number) => boolean;
  /** 개발/테스트용: 특정 회차 받기 기록 삭제. */
  clear: (round: number) => void;
  /** 백테스트 결과 저장. */
  setBacktest: (cache: BacktestCache) => void;
  setComputing: (b: boolean) => void;
};

function genSeed(): string {
  // 36진수 무작위 + 타임스탬프 — 기기/세션 단위로 충돌 거의 없음
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 출시 시점에 미리 계산된 30회차 백테스트 시드.
 * Python 스크립트(backtest.py)가 생성한 결과이며, app/src/data/backtest_seed.json에 번들됨.
 * 첫 실행 사용자는 계산 대기 없이 즉시 통계를 본다.
 */
const seedCache: BacktestCache = {
  latestRound: backtestSeed.latestRound,
  rank1: backtestSeed.rank1,
  rank2: backtestSeed.rank2,
  rank3: backtestSeed.rank3,
  rank4: backtestSeed.rank4,
  rank5: backtestSeed.rank5,
  roundsTested: backtestSeed.roundsTested,
  totalCombosTested: backtestSeed.totalCombosTested,
  computedAt: backtestSeed.computedAt,
};

export const useJachanism = create<JachanismState>()(
  persist(
    (set, get) => ({
      deviceSeed: genSeed(),
      weekly: {},
      backtest: seedCache,  // 번들된 30회 결과 (latestRound 일치 시 즉시 사용)
      computing: false,

      receive: (round, combos) =>
        set((state) => ({
          weekly: {
            ...state.weekly,
            [round]: { round, receivedAt: Date.now(), combos },
          },
        })),

      has: (round) => round in get().weekly,

      clear: (round) =>
        set((state) => {
          const next = { ...state.weekly };
          delete next[round];
          return { weekly: next };
        }),

      setBacktest: (cache) => set({ backtest: cache, computing: false }),
      setComputing: (b) => set({ computing: b }),
    }),
    {
      name: 'lottofinder.jachanism.v2',  // v2: 번들 백테스트 시드 도입
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      // 기존 persist 데이터에 backtest가 없거나 latestRound 불일치면 seed 사용
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as Partial<JachanismState>) };
        const p = persistedState as Partial<JachanismState> | undefined;
        if (!p?.backtest || p.backtest.latestRound !== seedCache.latestRound) {
          merged.backtest = seedCache;
        }
        return merged;
      },
      // deviceSeed는 첫 마운트 시 store가 만든 값으로 영속됨 → 이후엔 그대로 사용
    },
  ),
);
