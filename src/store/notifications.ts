/**
 * 알림 설정 store — 사용자 선호 + 권한 상태.
 *
 * 알림은 모두 로컬 알림 (expo-notifications). 서버/푸시 토큰 없이도 동작.
 * 토요일 추첨 임박 / 추첨 결과 / 수요일 받기 시작 등 정기 알림 스케줄링.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type NotificationPrefs = {
  /** 마스터 토글 — 켜져있어도 개별 토글에 따라 발송. */
  enabled: boolean;
  /** 토요일 19:00 — 구매 마감 1시간 전 안내. */
  drawingReminder: boolean;
  /** 토요일 21:00 — 추첨 결과 발표 (8:35 추첨 직후 ~ 20분). */
  resultReminder: boolean;
  /** 수요일 00:00 — 귀찮이즘 받기 시작 알림 (PRO 멤버용). */
  weeklyReceive: boolean;
};

type NotificationState = NotificationPrefs & {
  set: (patch: Partial<NotificationPrefs>) => void;
};

const initial: NotificationPrefs = {
  enabled: false,
  drawingReminder: true,
  resultReminder: true,
  weeklyReceive: true,
};

export const useNotifications = create<NotificationState>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set((s) => ({ ...s, ...patch })),
    }),
    {
      name: 'lottofinder.notifications.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
