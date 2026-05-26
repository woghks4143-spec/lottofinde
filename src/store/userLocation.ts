/**
 * 사용자 위치 — 한 번 가져오면 5분간 캐시.
 *
 * 매 화면 진입마다 expo-location의 getCurrentPositionAsync를 다시 호출하면:
 *   - 매번 GPS 하드웨어 깨우기 (1~3초)
 *   - 미해결 요청이 백그라운드에 누적 → 큐가 꽉 차서 점점 느려짐
 *
 * 이 스토어는 1회 호출 결과를 메모리에 갖고 있다가 5분간 재사용.
 * loading 플래그로 동시 호출도 방지.
 */
import { create } from 'zustand';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type Coords = { lat: number; lng: number };
export type PermStatus = 'unknown' | 'granted' | 'denied' | 'unsupported';

type State = {
  coords: Coords | null;
  fetchedAt: number;
  permission: PermStatus;
  loading: boolean;
  error: string | null;

  /** 캐시가 유효하면 noop. 아니면 권한 확인 + 위치 가져오기. */
  ensure: () => Promise<void>;
  /** 강제로 새로 가져오기 (사용자가 새로고침 누름). */
  refresh: () => Promise<void>;
};

const CACHE_TTL_MS = 5 * 60_000; // 5분

async function doFetch(set: (s: Partial<State>) => void) {
  try {
    const { status: existing } = await Location.getForegroundPermissionsAsync();
    let granted = existing === 'granted';
    if (!granted) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      granted = status === 'granted';
    }
    if (!granted) {
      set({ permission: 'denied', loading: false });
      return;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    set({
      permission: 'granted',
      coords: { lat: loc.coords.latitude, lng: loc.coords.longitude },
      fetchedAt: Date.now(),
      loading: false,
      error: null,
    });
  } catch (e) {
    set({
      error: (e as Error)?.message ?? '위치 조회 실패',
      loading: false,
    });
  }
}

export const useUserLocation = create<State>((set, get) => ({
  coords: null,
  fetchedAt: 0,
  permission: 'unknown',
  loading: false,
  error: null,

  ensure: async () => {
    if (Platform.OS === 'web') {
      set({ permission: 'unsupported', loading: false });
      return;
    }
    const s = get();
    if (s.loading) return; // 이미 진행 중
    // 캐시 hit — 권한 granted + coords 있음 + TTL 안 지남
    if (
      s.permission === 'granted' &&
      s.coords &&
      Date.now() - s.fetchedAt < CACHE_TTL_MS
    ) {
      return;
    }
    set({ loading: true, error: null });
    await doFetch((patch) => set(patch));
  },

  refresh: async () => {
    if (Platform.OS === 'web') return;
    const s = get();
    if (s.loading) return;
    set({ loading: true, error: null, fetchedAt: 0 });
    await doFetch((patch) => set(patch));
  },
}));
