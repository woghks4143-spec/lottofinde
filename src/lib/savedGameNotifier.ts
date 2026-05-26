/**
 * 보관함 게임 당첨 결과 알림 — 추첨예정이었던 회차가 추첨되면 자동 푸시.
 *
 * 동작:
 *   1. 보관함의 모든 게임에서 round 값들 수집
 *   2. drawsMap에 해당 회차 데이터가 있는지(=추첨 완료) 확인
 *   3. 아직 알림 안 보낸 회차만 골라 알림 발송
 *   4. 알림 보낸 회차는 notifiedRounds Set에 추가 (AsyncStorage 영속)
 *
 * 호출 시점: _layout.tsx에서 autoUpdate 후 (새 회차 hydrate 직후).
 * 알림 권한 X면 그냥 skip.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Draw } from '@/src/data/lotto';
import { rank } from '@/src/data/lotto';
import type { SavedGame } from '@/src/store/savedNumbers';
import type { NotificationPrefs } from '@/src/store/notifications';
import { sendInstantNotification } from './scheduleNotifications';

const NOTIFIED_KEY = 'lottofinder.notifiedRounds.v1';

type NotifiedRoundsShape = number[];

async function loadNotifiedRounds(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as NotifiedRoundsShape;
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function saveNotifiedRounds(set: Set<number>): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

/**
 * 첫 실행 시 — 현재 시점까지의 보관함 회차 중 이미 추첨된 회차를 모두 "알림 보낸 것"으로
 * 기록만 해둠 (실제 알림 X). 이렇게 하면 사용자가 앱을 설치한 후 이미 결과를 본 회차에
 * 대해서는 알림이 가지 않음. "추첨예정이었던 회차가 추첨되는 시점"만 잡음.
 *
 * 호출 시점: 앱 부트 시 1회. notifiedRounds AsyncStorage가 비어있을 때만 의미 있음.
 */
export async function seedNotifiedRoundsFromExisting(
  savedGames: SavedGame[],
  drawsMap: Record<number, Draw>,
): Promise<void> {
  const existing = await loadNotifiedRounds();
  if (existing.size > 0) return; // 이미 시드됐음 — skip

  const seeded = new Set<number>();
  for (const g of savedGames) {
    if (g.round != null && drawsMap[g.round]) {
      seeded.add(g.round);
    }
  }
  if (seeded.size > 0) {
    await saveNotifiedRounds(seeded);
  } else {
    // 빈 Set이라도 저장해서 다음 호출에 "이미 시드됨" 표시
    await saveNotifiedRounds(new Set([0])); // sentinel
  }
}

/**
 * 보관함 게임을 스캔해서 새로 추첨된 회차에 대해 알림 발송.
 *
 * @param savedGames 보관함 전체
 * @param drawsMap   회차 데이터 (추첨 완료 여부 확인)
 * @param prefs      알림 설정 (savedGameResult가 false거나 마스터 off면 skip)
 * @returns 알림 보낸 회차 개수
 */
export async function notifySavedGameResults(
  savedGames: SavedGame[],
  drawsMap: Record<number, Draw>,
  prefs: NotificationPrefs,
): Promise<number> {
  if (Platform.OS === 'web') return 0;
  if (!prefs.enabled || !prefs.savedGameResult) return 0;

  // 권한 확인 (없으면 조용히 skip)
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return 0;
  } catch {
    return 0;
  }

  const notified = await loadNotifiedRounds();

  // 보관함 회차별로 게임 그룹화 — 한 회차에 게임 여러 개여도 알림은 1개
  const roundGames = new Map<number, SavedGame[]>();
  for (const g of savedGames) {
    if (g.round == null) continue;          // 추첨예정 = round null → skip
    if (notified.has(g.round)) continue;     // 이미 알림 보낸 회차 → skip
    if (!drawsMap[g.round]) continue;        // 아직 추첨 안 됨 → skip
    const arr = roundGames.get(g.round) ?? [];
    arr.push(g);
    roundGames.set(g.round, arr);
  }

  if (roundGames.size === 0) return 0;

  let sentCount = 0;
  for (const [round, games] of roundGames.entries()) {
    const drawn = drawsMap[round];
    if (!drawn) continue;

    // 등수 계산 — 가장 좋은 등수 + 당첨 게임 수
    let bestRank: number | null = null;
    let winCount = 0;
    for (const g of games) {
      const r = rank(g.nums, drawn.nums, drawn.bonus);
      if (r != null) {
        winCount++;
        if (bestRank == null || r < bestRank) bestRank = r;
      }
    }

    const numsStr = drawn.nums.join(', ');
    const bonus = drawn.bonus;
    const title = bestRank != null
      ? `🎉 ${round}회 ${bestRank}등 당첨!`
      : `📊 ${round}회 추첨 결과`;
    const body = bestRank != null
      ? `보관함 ${games.length}게임 중 ${winCount}게임 당첨. 당첨번호: ${numsStr} + ${bonus}`
      : `당첨번호: ${numsStr} + ${bonus}\n보관함 ${games.length}게임은 모두 미당첨이에요.`;

    const ok = await sendInstantNotification(
      title,
      body,
      `lottofinder/result_${round}`,
    );
    if (ok) {
      notified.add(round);
      sentCount++;
    }
  }

  if (sentCount > 0) {
    await saveNotifiedRounds(notified);
  }
  return sentCount;
}
