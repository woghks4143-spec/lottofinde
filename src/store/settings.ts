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
 *
 * 사용 경험(Q1)을 가장 우선시한다. 초보자가 "통계 분석에 관심 있다"고 한들
 * 아직 로또 자체를 모르기 때문에 인지 부담이 큰 Expert 모드를 강요하면
 * 이탈 위험이 크다. 따라서:
 *
 *   - newbie (아직 사본 적 없음)    → 무조건 Simple
 *   - sometimes (가끔 사봄)         → 무조건 Simple
 *   - weekly (매주 산다) + stats 선택 → Expert
 *   - weekly + stats 미선택          → Simple
 *   - expert (자칭 전문가/오래 해봄) → Expert
 *
 * PRD H1 KPI: Expert 전환 ≥ 15% 유지.
 */
export function recommendMode(
  q1: Q1Answer | null,
  q2: Q2Answer[],
): AppMode {
  // 자칭 전문가는 무조건 Expert
  if (q1 === 'expert') return 'expert';
  // 초보 (안 사봤거나 가끔 산다) → 인지 부담 최소화 위해 Simple
  if (q1 === 'newbie' || q1 === 'sometimes') return 'simple';
  // 매주 구매자 — 통계 도구 선택 시에만 Expert
  if (q1 === 'weekly' && q2.includes('stats')) return 'expert';
  return 'simple';
}
