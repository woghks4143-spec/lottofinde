/**
 * 알림 스케줄링 — 사용자 선호에 따라 주간 반복 로컬 알림 등록/해제.
 *
 * 모두 로컬 알림 (서버 X). expo-notifications.
 *   - 추첨 임박: 매주 토 19:00
 *   - 추첨 결과: 매주 토 21:00
 *   - 받기 시작:  매주 수 00:00
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { NotificationPrefs } from '@/src/store/notifications';

// v2: importance HIGH로 올리기 위한 새 채널. Android는 한 번 만든 채널의
// importance를 코드로 올릴 수 없어서, 이전 'lottofinder-default'(DEFAULT)와
// 다른 ID를 써야 새 설정이 반영됨.
const CHANNEL_ID = 'lottofinder-default-v2';
const IDENTIFIER_PREFIX = 'lottofinder/';

/**
 * 포그라운드 알림 핸들러 — 이게 없으면 앱이 켜져 있을 때 알림이 조용히 무시됨!
 * expo-notifications SDK 53+ 신 API: shouldShowBanner / shouldShowList
 * (구 API의 shouldShowAlert는 deprecated)
 *
 * 모듈 로드 시점에 1회 등록 (side-effect). _layout / notifications 화면에서
 * 이 파일을 import하면 자동으로 적용됨.
 */
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        // 구 API 호환 (일부 환경에서 신 API만 보면 무시되는 케이스 대비)
        shouldShowAlert: true,
      } as Notifications.NotificationBehavior),
    });
  } catch {
    // 핸들러 등록 실패해도 앱 부팅엔 영향 없음
  }
}

/**
 * Expo Go 환경인지 — Expo SDK 53+부터 expo-notifications가 Expo Go에서 지원 안 됨.
 * Dev Client APK 또는 EAS Build에서만 알림 작동.
 */
export function isExpoGo(): boolean {
  try {
    return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  } catch {
    return false;
  }
}

// Notifications.Weekday: Sun=1, Mon=2, ..., Sat=7
const WEEKDAY_SAT = 7;
const WEEKDAY_WED = 4;

/**
 * 즉시 발송 — 보관함 게임 회차의 추첨 결과 등 이벤트 기반 알림.
 * 호출 즉시 시스템 트레이에 표시. 주간 스케줄과 별개.
 */
export async function sendInstantNotification(
  title: string,
  body: string,
  identifier?: string,
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: identifier ?? `${IDENTIFIER_PREFIX}instant_${Date.now()}`,
      content: { title, body, sound: 'default' },
      trigger: null, // 즉시
    });
    return true;
  } catch {
    return false;
  }
}

/** 권한 요청. 결과: granted/denied. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Android 채널 (한 번만 등록).
 * importance HIGH = 화면 상단 헤드업 배너 + 소리 + 진동.
 * DEFAULT면 알림 트레이에만 뜨고 화면엔 안 보여서 "안 왔다"고 느낌.
 *
 * 구버전 채널(lottofinder-default, DEFAULT importance)이 남아있을 수 있어서
 * 정리 차원에서 삭제 시도. 실패해도 무시.
 */
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  try {
    // 구 채널 정리 (한 번만 효과 있음)
    await Notifications.deleteNotificationChannelAsync('lottofinder-default').catch(() => {});
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '로또핀더 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  } catch {}
}

/** 기존 등록된 로또핀더 알림 모두 해제. */
export async function clearScheduledNotifications() {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const s of scheduled) {
      if (s.identifier.startsWith(IDENTIFIER_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(s.identifier);
      }
    }
  } catch {}
}

/**
 * 사용자 선호에 맞춰 모든 알림을 다시 스케줄링.
 * 기존 알림을 다 해제하고, 새로 등록.
 */
export async function rescheduleAll(prefs: NotificationPrefs): Promise<{ ok: boolean; scheduled: number; reason?: string }> {
  if (Platform.OS === 'web') {
    return { ok: false, scheduled: 0, reason: 'web' };
  }
  await ensureChannel();
  await clearScheduledNotifications();

  if (!prefs.enabled) {
    return { ok: true, scheduled: 0 };
  }

  let count = 0;
  const tasks: Promise<unknown>[] = [];

  if (prefs.drawingReminder) {
    tasks.push(scheduleWeekly(
      `${IDENTIFIER_PREFIX}drawing`,
      '🎲 로또 추첨 1시간 전',
      '오늘 8시 35분 추첨이에요. 구매 마감은 8시까지!',
      WEEKDAY_SAT, 19, 0,
    ));
    count++;
  }
  if (prefs.resultReminder) {
    tasks.push(scheduleWeekly(
      `${IDENTIFIER_PREFIX}result`,
      '🏆 로또 추첨 결과 발표',
      '결과 확인하러 가볼까요?',
      WEEKDAY_SAT, 21, 0,
    ));
    count++;
  }
  if (prefs.weeklyReceive) {
    tasks.push(scheduleWeekly(
      `${IDENTIFIER_PREFIX}weekly`,
      '✨ 귀찮이즘 조합 받기 시작',
      '이번 주 50조합 받을 수 있어요. (PRO 멤버 전용)',
      WEEKDAY_WED, 10, 0,
    ));
    count++;
  }
  try {
    await Promise.all(tasks);
    return { ok: true, scheduled: count };
  } catch (e) {
    return { ok: false, scheduled: 0, reason: (e as Error).message };
  }
}

async function scheduleWeekly(
  identifier: string,
  title: string,
  body: string,
  weekday: number,
  hour: number,
  minute: number,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
}

/**
 * 즉시 테스트 알림 발송 (사용자가 동작 확인용).
 * 결과: { ok, reason } — 실패 시 reason에 사용자 친화적 에러 메시지.
 */
export async function sendTestNotification(): Promise<{ ok: boolean; reason?: string }> {
  if (Platform.OS === 'web') {
    return { ok: false, reason: '웹에서는 알림이 지원되지 않아요.' };
  }
  // Expo Go 차단 — SDK 53+부터 expo-notifications 미지원
  if (isExpoGo()) {
    return {
      ok: false,
      reason: 'Expo Go에서는 알림이 작동하지 않아요. Dev Client 또는 정식 빌드에서 테스트해주세요.',
    };
  }
  // 권한 재확인
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return { ok: false, reason: '알림 권한이 없어요. 설정 → 알림에서 권한을 허용해주세요.' };
    }
  } catch (e) {
    return { ok: false, reason: `권한 확인 실패: ${(e as Error)?.message ?? 'unknown'}` };
  }
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 로또핀더 테스트 알림',
        body: '알림이 정상적으로 동작합니다!',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sticky: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        channelId: CHANNEL_ID,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `발송 실패: ${(e as Error)?.message ?? 'unknown'}` };
  }
}
