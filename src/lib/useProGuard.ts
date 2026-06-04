/**
 * PRO 권한 가드 훅 — PRO 기능 화면에서 무료 사용자를 결제 화면으로 리다이렉트.
 *
 * 사용 예:
 *   export default function ProJachanism() {
 *     const isPro = useProGuard();
 *     if (!isPro) return null; // 리다이렉트 중 빈 화면
 *     return <ScrollView>...</ScrollView>;
 *   }
 *
 * 동작:
 *   - PRO 활성 → 그대로 통과
 *   - 비활성 → /pro-membership으로 replace (뒤로가기 시 PRO 화면 안 보임)
 *   - 로딩 중(부팅 직후) → 잠시 기다린 후 다시 체크
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useMembership } from '@/src/store/membership';

export function useProGuard(): boolean {
  // 상태값(isPro/expiresAt/lastVerifiedAt)을 직접 구독해서, 값이 바뀌면 재평가.
  // selector 안에서 isProActive() 함수를 호출하면 화면 전환 타이밍에 따라
  // 흔들릴 수 있어, 원시 상태를 구독하고 isProActive()는 effect에서만 호출.
  const isPro = useMembership((s) => s.isPro);
  const expiresAt = useMembership((s) => s.expiresAt);
  const lastVerifiedAt = useMembership((s) => s.lastVerifiedAt);
  const loading = useMembership((s) => s.loading);
  const router = useRouter();

  // 실제 PRO 판정은 store의 isProActive()로 일원화 (grace·캐시 로직 공유).
  const active = useMembership.getState().isProActive();

  useEffect(() => {
    // 부팅 직후 RevenueCat 검증 중일 땐 잠시 기다림
    if (loading) return;
    if (!useMembership.getState().isProActive()) {
      router.replace('/pro-membership' as any);
    }
    // isPro/expiresAt/lastVerifiedAt 변화 시 재평가
  }, [isPro, expiresAt, lastVerifiedAt, loading, router]);

  return active;
}
