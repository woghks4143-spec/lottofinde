/**
 * Root layout — loads Pretendard, holds the splash until ready, wraps the
 * tree in ThemeProvider, and renders a Stack so route groups (`onboarding`,
 * `(simple)`) can be hidden-headered.
 *
 * Note: on web, the font hook can stay "loading" indefinitely if the .otf
 * URLs never get requested (no Text uses them yet), so we add a 1.5s
 * fallback to show the UI in fallback fonts.
 */
import 'react-native-gesture-handler';
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/src/design/theme';
import { FONT_ASSETS } from '@/src/design/fonts';
import { useHistory } from '@/src/data/historyStore';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { useNotifications } from '@/src/store/notifications';
import { prewarmRegression } from '@/src/lib/regressionCache';
import { notifySavedGameResults, seedNotifiedRoundsFromExisting } from '@/src/lib/savedGameNotifier';
import { isDrawWindow } from '@/src/data/dhlottery';
import { init as initRevenueCat } from '@/src/lib/revenuecat';
import { useMembership } from '@/src/store/membership';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = Font.useFonts(FONT_ASSETS);
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loaded || error || forceShow) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error, forceShow]);

  // Boot sequence for round-history cache: hydrate bundled seed immediately so
  // every screen renders against real data, then kick off a non-blocking
  // auto-update on native (web is CORS-blocked, see dhlottery.ts).
  //
  // autoUpdate는 내부적으로 추첨 윈도우(토 20:30 ~ 일 03:00 KST)가 아니면
  // 페치를 스킵한다. 단, 최신 회차의 부가 정보가 빠져있으면 catch-up용으로
  // enrich만 시도한다. 일~금 + 토 새벽엔 네트워크 0회.
  useEffect(() => {
    useHistory.getState().hydrate();

    // RevenueCat 초기화 + PRO 멤버십 상태 동기화 (부팅 시 1회)
    (async () => {
      await initRevenueCat();
      void useMembership.getState().refresh();
    })();

    // 부트 후 1회: 현재 시점까지 이미 추첨된 회차들을 "알림 보낸 것"으로 시드.
    // → 앱 설치 시점 이전의 결과는 알림 X. 추첨예정이었던 회차가 새로 추첨됐을 때만 알림.
    const seedTimer = setTimeout(() => {
      const { draws } = useHistory.getState();
      const { games } = useSavedNumbers.getState();
      seedNotifiedRoundsFromExisting(games, draws).catch(() => {});
    }, 300);

    // 추첨 데이터 자동 업데이트 — 끝나면 보관함 게임 결과 알림 검사
    const t = setTimeout(async () => {
      try {
        await useHistory.getState().autoUpdate();
      } catch {}
      // autoUpdate 직후 알림 검사 — 새 회차가 hydrate됐으면 알림 발송
      try {
        const { draws } = useHistory.getState();
        const { games } = useSavedNumbers.getState();
        const prefs = useNotifications.getState();
        await notifySavedGameResults(games, draws, prefs);
      } catch {}
    }, 200);

    // 회귀분석 ranking prewarm — 부트 후 1.5초쯤 백그라운드로 계산.
    // 사용자가 PRO → 회귀분석 진입했을 때 이미 캐시 hit → 즉시 표시.
    const prewarmTimer = setTimeout(() => {
      const { latestRound, earliestRound, draws } = useHistory.getState();
      if (!latestRound || !earliestRound) return;
      const drawArr = [];
      for (let r = latestRound; r >= earliestRound; r--) {
        const d = draws[r];
        if (d) drawArr.push(d);
      }
      if (drawArr.length >= 20) {
        prewarmRegression(latestRound, drawArr).catch(() => {});
      }
    }, 1500);

    return () => {
      clearTimeout(t);
      clearTimeout(prewarmTimer);
      clearTimeout(seedTimer);
    };
  }, []);

  // 앱이 백그라운드 → 포그라운드로 돌아올 때 자동 최신화.
  // - 추첨 윈도우 안 (토 20:30 ~ 일 03:00): 쿨다운 10분 (당첨번호→등위→판매점 순차 공개 대응)
  // - 윈도우 밖: 쿨다운 6시간 (어차피 새 회차 없으니 자주 시도할 이유 없음)
  // autoUpdate 내부 가드가 윈도우 밖이면 네트워크 호출 자체를 안 하므로,
  // 여기 쿨다운은 단순히 호출 빈도를 더 줄이는 보조 가드 역할이다.
  const lastFocusTopUpAt = useRef<number>(0);
  useEffect(() => {
    const handler = async (next: AppStateStatus) => {
      if (next !== 'active') return;
      const now = Date.now();
      const cooldownMs = isDrawWindow() ? 10 * 60_000 : 6 * 3600_000;
      if (now - lastFocusTopUpAt.current < cooldownMs) return;
      lastFocusTopUpAt.current = now;
      try {
        await useHistory.getState().autoUpdate();
      } catch {}
      // 포그라운드 복귀 + autoUpdate 후 보관함 결과 알림 검사
      try {
        const { draws } = useHistory.getState();
        const { games } = useSavedNumbers.getState();
        const prefs = useNotifications.getState();
        await notifySavedGameResults(games, draws, prefs);
      } catch {}
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, []);

  if (!loaded && !error && !forceShow) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedStatusBar />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(simple)" />
          <Stack.Screen name="round/[round]" options={{ animation: 'none' }} />
          <Stack.Screen name="compat" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="weighted-pick" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pick" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="condition-pick" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="manual-pick" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="simulator" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="rules" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="combo" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="glossary" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="weekly" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="predict" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="analysis-methods" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="same-date" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pattern-analysis" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="appearance-heatmap" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="regression" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="scan" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-gen" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-analysis" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-filter" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-weekly" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-compat" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-regression" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-analysis-methods" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-pattern-analysis" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-appearance-stats" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-finder-combo" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-predict" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-jachanism" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="store-finder" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-membership" options={{ animation: 'slide_from_right', presentation: 'modal' }} />
          <Stack.Screen name="data-backup" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="responsible-purchase" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="contact" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="privacy-policy" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="terms-of-service" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** 테마 설정(`darkMode`)에 따라 상태바 아이콘 색을 자동 전환. */
function ThemedStatusBar() {
  const t = useTheme();
  return <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />;
}
