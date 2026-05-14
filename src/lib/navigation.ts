/**
 * 네비게이션 헬퍼 — 안전한 뒤로가기.
 *
 * `router.back()`만 호출하면 expo-router의 내비게이션 스택이 비어 있을 때
 * 아무 일도 안 일어남 (특히 SSR/직접 URL 진입/HMR 새로고침 후). 이 훅은:
 *   1) router.canGoBack() ? router.back() — 정상 케이스
 *   2) Web: window.history.back() — 브라우저 히스토리 fallback
 *   3) router.replace(fallback) — 끝내 갈 곳 없으면 fallback 페이지
 */
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

export function useSafeBack(fallback: string = '/') {
  const router = useRouter();
  return () => {
    try {
      if (router.canGoBack()) {
        router.back();
        return;
      }
    } catch {
      // canGoBack 자체가 throw하는 경우(드뭄) — 다음 fallback으로
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history.length > 1) {
      try { window.history.back(); return; } catch {}
    }
    router.replace(fallback as any);
  };
}
