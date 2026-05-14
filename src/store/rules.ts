/**
 * rules — Zustand store for Expert-mode simulator rules.
 *
 * A `Rule` is a saved set of filter conditions the user can reapply in the
 * 시뮬레이터. Created via the simulator builder, persisted to AsyncStorage,
 * editable & re-runnable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** @deprecated v1 단일 선택 enum. v2부터는 `oddEvenAllow`(string[]) 사용. */
export type OddEvenMode =
  | 'any'
  | '3:3-or-4:2'
  | '4:2-or-2:4'
  | '5:1-or-1:5';

/** @deprecated v1 enum. v2부터는 `highLowAllow` 사용. */
export type HighLowMode = OddEvenMode;

/**
 * 비율 표기. 항상 "x:y" 형식 (x+y=6). 가능한 값: '0:6'·'1:5'·'2:4'·'3:3'·'4:2'·'5:1'·'6:0'.
 * 홀짝에서는 "홀:짝", 저고에서는 "저:고".
 */
export type Ratio = '0:6' | '1:5' | '2:4' | '3:3' | '4:2' | '5:1' | '6:0';

export const ALL_RATIOS: Ratio[] = ['0:6', '1:5', '2:4', '3:3', '4:2', '5:1', '6:0'];

/**
 * @deprecated v4 모델. v5부터는 `longestRunAllow` 사용.
 */
export type ConsecutiveRule = {
  runLength: 'any' | 'none' | 2 | 3 | 4;
  runCount: 'any' | 0 | 1 | 2 | 3;
};

export type Rule = {
  id: string;
  name: string;
  include: number[];
  exclude: number[];

  // sum (총합) 6/45 valid range is 21..255 (1+2+3+4+5+6 .. 40+41+42+43+44+45)
  sumMin: number; sumMax: number;
  // tail sum (끝수합) valid range 6..45 (when all tails are between 0 and 9)
  tailSumMin: number; tailSumMax: number;
  // AC (Arithmetic Complexity) 0..10
  acMin: number; acMax: number;

  /** @deprecated v1. v2 이후 oddEvenAllow를 사용. */
  oddEven?: OddEvenMode;
  /** @deprecated v1. v2 이후 highLowAllow를 사용. */
  highLow?: HighLowMode;

  /** 허용할 홀:짝 비율들. 빈 배열 = 모두 허용(자유). */
  oddEvenAllow?: Ratio[];
  /** 허용할 저:고 비율들. 빈 배열 = 모두 허용(자유). */
  highLowAllow?: Ratio[];

  /** @deprecated v1. v2~v4에서 consecutive를 사용. v5부터는 longestRunAllow. */
  consecutiveMax?: number;
  /** @deprecated v2~v4. v5부터는 longestRunAllow. */
  consecutive?: ConsecutiveRule;

  /**
   * 허용할 "가장 긴 연속수 묶음 길이" 집합. v5 이후 모델.
   *   - 1 = 연속수 없음 (모든 번호 단독)
   *   - 2/3/4/5/6 = 가장 긴 묶음이 그 길이
   *   - 빈 배열 = 자유 (모든 패턴 허용)
   *
   * 예: [2, 3] → 가장 긴 연속이 2 또는 3인 조합 (4연속 이상 차단, 단독수 조합 차단)
   */
  longestRunAllow?: number[];

  /** @deprecated v1~v4. v5부터는 carryOverAllow. */
  carryOverMin?: number;
  /**
   * 허용할 "직전 회차 이월수 개수" 집합. v5 이후 모델.
   *   - 0~6 = 이월수 개수 (보너스 포함 풀과의 교집합)
   *   - 빈 배열 = 자유
   *
   * 예: [1, 2] → 이월수 1개 또는 2개인 조합만
   */
  carryOverAllow?: number[];

  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
};

export function defaultRule(name = '새 룰'): Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'lastUsedAt'> {
  return {
    name,
    include: [],
    exclude: [],
    sumMin: 21, sumMax: 255,
    tailSumMin: 6, tailSumMax: 45,
    acMin: 0, acMax: 10,
    oddEvenAllow: [],
    highLowAllow: [],
    longestRunAllow: [],
    carryOverAllow: [],
  };
}

/** v1 → v2 마이그레이션 헬퍼. 옛 enum을 새 배열 형식으로 변환. */
export function migrateRule(r: Rule): Rule {
  const out: Rule = { ...r };
  // 홀짝
  if (out.oddEvenAllow === undefined) {
    const m = out.oddEven ?? 'any';
    out.oddEvenAllow =
      m === '3:3-or-4:2' ? ['3:3', '4:2']
      : m === '4:2-or-2:4' ? ['4:2', '2:4']
      : m === '5:1-or-1:5' ? ['5:1', '1:5']
      : [];
  }
  // 저고
  if (out.highLowAllow === undefined) {
    const m = out.highLow ?? 'any';
    out.highLowAllow =
      m === '3:3-or-4:2' ? ['3:3', '4:2']
      : m === '4:2-or-2:4' ? ['4:2', '2:4']
      : m === '5:1-or-1:5' ? ['5:1', '1:5']
      : [];
  }
  // 연속수: v1~v4 → v5 마이그레이션. v4의 (runLength, runCount)는 더 좁은 의미라서
  // v5의 longestRunAllow로 자동 변환은 best-effort:
  //   - runLength='none' + runCount=0 → [1]
  //   - runLength=숫자  + runCount=숫자(>0) → [runLength]
  //   - 그 외 → []
  if (out.longestRunAllow === undefined) {
    const c = out.consecutive;
    if (c && c.runLength === 'none' && c.runCount === 0) {
      out.longestRunAllow = [1];
    } else if (c && typeof c.runLength === 'number' && typeof c.runCount === 'number' && c.runCount > 0) {
      out.longestRunAllow = [c.runLength];
    } else {
      out.longestRunAllow = [];
    }
  }
  // 이월수: 옛 carryOverMin(=N이상) → 새 carryOverAllow(=정확히 N의 집합)
  // 마이그레이션: carryOverMin=N → [N, N+1, ..., 6]. 0이면 빈 배열(자유).
  if (out.carryOverAllow === undefined) {
    const m = out.carryOverMin ?? 0;
    if (m <= 0) out.carryOverAllow = [];
    else {
      out.carryOverAllow = [];
      for (let i = m; i <= 6; i++) out.carryOverAllow.push(i);
    }
  }
  return out;
}

function genId(): string {
  try {
    // @ts-ignore
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type RulesState = {
  rules: Rule[];
  add: (r: Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'lastUsedAt'>) => Rule;
  update: (id: string, patch: Partial<Rule>) => void;
  remove: (id: string) => void;
  touchUsed: (id: string) => void;
  get: (id: string) => Rule | null;
};

export const useRules = create<RulesState>()(
  persist(
    (set, get) => ({
      rules: [],
      add: (r) => {
        const now = Date.now();
        // ⚠️ ...r 이 마지막에 오면 호출자가 옛 id/createdAt(0)을 함께 넘길 때 덮어써져
        // "56년 전 생성"처럼 보임. 새 id/타임스탬프를 항상 마지막에 둬 덮어쓰기 보장.
        const rule: Rule = { ...r, id: genId(), createdAt: now, updatedAt: now, lastUsedAt: null };
        set({ rules: [rule, ...get().rules] });
        return rule;
      },
      update: (id, patch) => {
        set({
          rules: get().rules.map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r,
          ),
        });
      },
      remove: (id) => set({ rules: get().rules.filter((r) => r.id !== id) }),
      touchUsed: (id) => {
        set({
          rules: get().rules.map((r) =>
            r.id === id ? { ...r, lastUsedAt: Date.now() } : r,
          ),
        });
      },
      get: (id) => get().rules.find((r) => r.id === id) ?? null,
    }),
    {
      name: 'lottofinder.rules.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ rules: s.rules }),
    },
  ),
);
