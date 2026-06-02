/**
 * PRO 멤버십 상태 store.
 *
 * RevenueCat과 연동되어 PRO 권한·만료·체험 상태를 관리.
 * - 부팅 시 RevenueCat에서 fetch
 * - 결제·복원 직후 즉시 갱신
 * - 24시간 캐시 (오프라인 대응)
 * - 만료 시 자동 만료 처리
 *
 * 사용 예:
 *   const isPro = useMembership((s) => s.isProActive());
 *   if (!isPro) { router.push('/pro-membership'); return; }
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  getCustomerInfo,
  isProActiveFromCustomerInfo,
  getProExpiresAt,
  isInTrial,
} from '@/src/lib/revenuecat';

/** 캐시 신뢰 기간 — 마지막 검증 후 이 시간 안이면 캐시 사용. */
const CACHE_TTL_MS = 24 * 60 * 60_000; // 24시간

export type MembershipState = {
  /** RevenueCat에서 마지막 확인된 PRO 활성 여부. */
  isPro: boolean;
  /** PRO 만료일 (ms timestamp). null이면 활성 X. */
  expiresAt: number | null;
  /** 무료 체험 중인지. */
  isInTrial: boolean;
  /** 체험 종료일 (체험 중일 때만). */
  trialEndsAt: number | null;
  /** 마지막 RevenueCat 동기화 시각. */
  lastVerifiedAt: number;
  /** 로딩 중 여부 (UI 표시용). */
  loading: boolean;
  /** 마지막 에러 (있으면). */
  error: string | null;

  /** RevenueCat에서 최신 상태 가져오기. 결제 후·부팅 시 호출. */
  refresh: () => Promise<void>;
  /** 캐시 + 만료 확인. PRO 권한 체크 시 사용. */
  isProActive: () => boolean;
  /** PRO 만료까지 남은 일 수 (음수면 만료). */
  daysUntilExpiry: () => number | null;
};

export const useMembership = create<MembershipState>()(
  persist(
    (set, get) => ({
      isPro: false,
      expiresAt: null,
      isInTrial: false,
      trialEndsAt: null,
      lastVerifiedAt: 0,
      loading: false,
      error: null,

      refresh: async () => {
        if (get().loading) return;
        set({ loading: true, error: null });
        try {
          const info = await getCustomerInfo();
          const active = isProActiveFromCustomerInfo(info);
          const expiresAt = getProExpiresAt(info);
          const inTrial = isInTrial(info);
          set({
            isPro: active,
            expiresAt,
            isInTrial: inTrial,
            trialEndsAt: inTrial ? expiresAt : null,
            lastVerifiedAt: Date.now(),
            loading: false,
            error: null,
          });
        } catch (e) {
          set({
            loading: false,
            error: (e as Error)?.message ?? 'PRO 상태 확인 실패',
          });
        }
      },

      isProActive: () => {
        const s = get();
        // 만료일 확인 — 만료됐으면 false
        if (s.expiresAt != null && s.expiresAt < Date.now()) return false;
        // 캐시 신뢰 기간 안이면 isPro 그대로 신뢰
        if (Date.now() - s.lastVerifiedAt < CACHE_TTL_MS) {
          return s.isPro;
        }
        // 캐시 만료 — 백그라운드로 refresh 트리거하지만 현재 isPro 그대로 반환
        // (UI 끊김 방지). 새 결과는 다음 호출 시 반영.
        void s.refresh();
        return s.isPro;
      },

      daysUntilExpiry: () => {
        const s = get();
        if (s.expiresAt == null) return null;
        const ms = s.expiresAt - Date.now();
        return Math.ceil(ms / (24 * 60 * 60_000));
      },
    }),
    {
      name: 'lottofinder.membership.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // 로딩·에러는 영속 X
      partialize: (s) => ({
        isPro: s.isPro,
        expiresAt: s.expiresAt,
        isInTrial: s.isInTrial,
        trialEndsAt: s.trialEndsAt,
        lastVerifiedAt: s.lastVerifiedAt,
      }),
    },
  ),
);
