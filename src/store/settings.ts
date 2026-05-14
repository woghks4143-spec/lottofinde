/**
 * Global settings store — persists user mode, onboarding answers, and
 * display preferences to AsyncStorage so they survive app restarts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AppMode = 'simple' | 'expert';
export type DarkPref = 'light' | 'dark' | 'system';
export type Q1Answer = 'sometimes' | 'weekly' | 'expert' | 'newbie';
export type Q2Answer =
  | 'auto-check' // 당첨 자동 확인
  | 'recommend'  // 번호 받아보기
  | 'store'      // 판매점 찾기
  | 'stats'      // 통계로 분석
  | 'history'    // 내 번호 관리
  | 'reminder';  // 추첨 알림

type SettingsState = {
  // Onboarding
  onboardingDone: boolean;
  q1: Q1Answer | null;
  q2: Q2Answer[];          // up to 2
  // App
  mode: AppMode;
  // Display
  darkMode: DarkPref;
  seniorText: boolean;
  // Mandatory disclaimer toggle is locked-on per PRD F-007 — no state needed.

  // Actions
  setQ1: (a: Q1Answer) => void;
  toggleQ2: (a: Q2Answer) => void;
  setMode: (m: AppMode) => void;
  finishOnboarding: (m: AppMode) => void;
  setDarkMode: (d: DarkPref) => void;
  setSeniorText: (on: boolean) => void;
  reset: () => void;
};

const initial = {
  onboardingDone: false,
  q1: null as Q1Answer | null,
  q2: [] as Q2Answer[],
  mode: 'simple' as AppMode,
  darkMode: 'system' as DarkPref,
  seniorText: false,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...initial,
      setQ1: (a) => set({ q1: a }),
      toggleQ2: (a) => {
        const cur = get().q2;
        if (cur.includes(a)) return set({ q2: cur.filter((x) => x !== a) });
        if (cur.length >= 2) return; // cap at 2
        set({ q2: [...cur, a] });
      },
      setMode: (m) => set({ mode: m }),
      finishOnboarding: (m) => set({ mode: m, onboardingDone: true }),
      setDarkMode: (d) => set({ darkMode: d }),
      setSeniorText: (on) => set({ seniorText: on }),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'lottofinder.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * Recommendation logic for the H1 result screen.
 * Returns 'expert' when the user signals analyst behaviour, else 'simple'.
 * Mirrors PRD H1 KPI target: Expert conversion ≥ 15%.
 */
export function recommendMode(
  q1: Q1Answer | null,
  q2: Q2Answer[],
): AppMode {
  if (q1 === 'expert') return 'expert';                 // self-id'd analyst
  if (q2.includes('stats')) return 'expert';            // wants stats tools
  return 'simple';
}
