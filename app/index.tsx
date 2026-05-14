/**
 * Entry route — funnels users to the right starting point:
 *   first launch → /onboarding/welcome
 *   returning user (any guide) → /(simple)/home
 *
 * 가이드(초급자/전문가)는 안내 콘텐츠만 다르고 실제 기능은 모든 사용자 동일.
 * 따라서 시작 화면도 모두 (simple)/home으로 통일.
 */
import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSettings } from '@/src/store/settings';
import { useTheme } from '@/src/design/theme';

export default function Index() {
  const router = useRouter();
  const { onboardingDone } = useSettings();
  const t = useTheme();

  useEffect(() => {
    const target = !onboardingDone ? '/onboarding/welcome' : '/(simple)/home';
    // Defer to next tick so Root Layout's Stack has time to mount.
    const id = setTimeout(() => {
      try { router.replace(target as any); } catch {}
    }, 0);
    return () => clearTimeout(id);
  }, [onboardingDone, router]);

  return <View style={{ flex: 1, backgroundColor: t.bgSurface }} />;
}
