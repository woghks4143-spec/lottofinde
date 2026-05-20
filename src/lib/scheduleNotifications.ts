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
import type { NotificationPrefs } from '@/src/store/notifications';

const CHANNEL_ID = 'lottofinder-default';
const IDENTIFIER_PREFIX = 'lottofinder/';

// Notifications.Weekday: Sun=1, Mon=2, ..., Sat=7
const WEEKDAY_SAT = 7;
const WEEKDAY_WED = 4;

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

/** Android 채널 (한 번만 등록). */
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '로또핀더 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
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
      WEEKDAY_WED, 0, 0,
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

/** 즉시 테스트 알림 발송 (사용자가 동작 확인용). */
export async function sendTestNotification(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 로또핀더 테스트 알림',
        body: '알림이 정상적으로 동작합니다!',
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, channelId: CHANNEL_ID },
    });
    return true;
  } catch {
    return false;
  }
}
