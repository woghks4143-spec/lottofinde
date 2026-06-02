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
  const isPro = useMembership((s) => s.isProActive());
  const loading = useMembership((s) => s.loading);
  const router = useRouter();

  useEffect(() => {
    // 부팅 직후 RevenueCat 검증 중일 땐 잠시 기다림
    if (loading) return;
    if (!isPro) {
      router.replace('/pro-membership' as any);
    }
  }, [isPro, loading, router]);

  return isPro;
}
