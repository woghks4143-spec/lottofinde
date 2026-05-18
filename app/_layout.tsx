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
  // auto-update on native (web is CORS-blocked, see dhlottery.ts). 부팅 시에는
  // 새 회차 확인 + 부가 정보(등위·판매점)까지 끌어옴.
  useEffect(() => {
    useHistory.getState().hydrate();
    const t = setTimeout(() => { useHistory.getState().autoUpdate().catch(() => {}); }, 200);
    return () => clearTimeout(t);
  }, []);

  // 앱이 백그라운드 → 포그라운드로 돌아올 때마다 자동 최신화 (cooldown 30분).
  // 토요일 추첨 후 일·월·화 사이 사용자가 앱을 열면 새 회차가 즉시 반영된다.
  const lastFocusTopUpAt = useRef<number>(0);
  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      if (next !== 'active') return;
      const now = Date.now();
      if (now - lastFocusTopUpAt.current < 30 * 60_000) return; // 30분 쿨다운
      lastFocusTopUpAt.current = now;
      useHistory.getState().autoUpdate().catch(() => {});
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
          <Stack.Screen name="round/[round]" options={{ animation: 'slide_from_right' }} />
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
          <Stack.Screen name="regression" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="scan" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-gen" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-analysis" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-filter" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-weekly" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-compat" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-cross" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-mc" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-network" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-regression" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-analysis-methods" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-predict" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-jachanism" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="pro-performance" options={{ animation: 'slide_from_right' }} />
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
