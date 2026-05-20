/**
 * 알림 설정 — /notifications
 *
 * 사용자가 원하는 알림을 켜고 끌 수 있는 화면.
 * 모두 로컬 알림 (expo-notifications). 서버 없이 동작.
 */
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { useNotifications } from '@/src/store/notifications';
import {
  requestNotificationPermission,
  rescheduleAll,
  sendTestNotification,
  clearScheduledNotifications,
} from '@/src/lib/scheduleNotifications';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

type PermStatus = 'unknown' | 'granted' | 'denied' | 'unsupported';

export default function NotificationsSettings() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/features');
  const prefs = useNotifications();

  const [permStatus, setPermStatus] = useState<PermStatus>('unknown');
  const [toast, setToast] = useState<string | null>(null);
  const isWeb = Platform.OS === 'web';

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // 권한 상태 조회
  useEffect(() => {
    if (isWeb) {
      setPermStatus('unsupported');
      return;
    }
    Notifications.getPermissionsAsync()
      .then(({ status }) => {
        setPermStatus(status === 'granted' ? 'granted' : 'denied');
      })
      .catch(() => setPermStatus('denied'));
  }, [isWeb]);

  // prefs 변경 시 알림 재스케줄
  useEffect(() => {
    if (isWeb) return;
    if (permStatus !== 'granted') return;
    rescheduleAll(prefs).catch(() => {});
  }, [prefs.enabled, prefs.drawingReminder, prefs.resultReminder, prefs.weeklyReceive, permStatus, isWeb]);

  const handleEnableToggle = async () => {
    if (!prefs.enabled) {
      // 켜기: 권한 먼저 요청
      const granted = await requestNotificationPermission();
      if (!granted) {
        showToast('알림 권한이 필요해요. 설정에서 허용해주세요');
        setPermStatus('denied');
        return;
      }
      setPermStatus('granted');
      prefs.set({ enabled: true });
      showToast('알림이 켜졌어요');
    } else {
      // 끄기: 알림 모두 해제
      await clearScheduledNotifications();
      prefs.set({ enabled: false });
      showToast('알림이 꺼졌어요');
    }
  };

  const handleTest = async () => {
    if (permStatus !== 'granted') {
      showToast('먼저 알림을 켜주세요');
      return;
    }
    const ok = await sendTestNotification();
    showToast(ok ? '2초 후 테스트 알림이 옵니다' : '테스트 알림 발송 실패');
  };

  const openSystemSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:').catch(() => {});
    } else {
      Linking.openSettings().catch(() => {});
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="알림 설정" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* 웹 안내 */}
        {isWeb && (
          <Card padding={14}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T allowFontScaling={false} style={{ fontSize: 20 }}>📱</T>
              <View style={{ flex: 1 }}>
                <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                  모바일 앱에서만 동작해요
                </T>
                <T variant="caption1" color="tertiary" style={{ fontSize: 11.5, marginTop: 2 }}>
                  웹 미리보기에서는 알림 기능이 동작하지 않습니다.
                </T>
              </View>
            </View>
          </Card>
        )}

        {/* 권한 거부 안내 */}
        {!isWeb && permStatus === 'denied' && prefs.enabled && (
          <Card padding={14}>
            <T variant="label1n" style={{ color: palette.red500, fontWeight: '800' }}>
              ⚠️ 알림 권한이 꺼져 있어요
            </T>
            <T variant="caption1" color="tertiary" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 17 }}>
              시스템 설정에서 로또핀더의 알림을 허용해주세요.
            </T>
            <Pressable
              onPress={openSystemSettings}
              style={({ pressed }) => [styles.settingsBtn, { borderColor: palette.red500, opacity: pressed ? 0.85 : 1 }]}
            >
              <T variant="caption1" style={{ color: palette.red500, fontWeight: '800' }}>
                ⚙ 시스템 설정 열기
              </T>
            </Pressable>
          </Card>
        )}

        {/* 마스터 토글 */}
        <Card padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                🔔 알림 전체 켜기
              </T>
              <T variant="caption1" color="tertiary" style={{ fontSize: 11.5, marginTop: 2 }}>
                {prefs.enabled
                  ? '주간 정기 알림이 발송됩니다'
                  : '알림을 받으려면 켜주세요'}
              </T>
            </View>
            <Switch on={prefs.enabled} onPress={handleEnableToggle} disabled={isWeb} />
          </View>
        </Card>

        {/* 개별 알림 설정 */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            📋 알림 종류
          </T>
          <T variant="caption1" color="tertiary" style={{ fontSize: 11, marginTop: 2 }}>
            받고 싶은 알림만 선택하세요
          </T>

          <View style={{ marginTop: 14, gap: 10 }}>
            <NotificationRow
              icon="🎲"
              title="추첨 임박 알림"
              desc="매주 토요일 19:00 · 구매 마감 1시간 전"
              on={prefs.drawingReminder}
              disabled={!prefs.enabled}
              onToggle={() => prefs.set({ drawingReminder: !prefs.drawingReminder })}
            />
            <NotificationRow
              icon="🏆"
              title="추첨 결과 알림"
              desc="매주 토요일 21:00 · 추첨 후 결과 확인"
              on={prefs.resultReminder}
              disabled={!prefs.enabled}
              onToggle={() => prefs.set({ resultReminder: !prefs.resultReminder })}
            />
            <NotificationRow
              icon="✨"
              title="귀찮이즘 받기 시작"
              desc="매주 수요일 00:00 · 50조합 받기 시작 (PRO)"
              on={prefs.weeklyReceive}
              disabled={!prefs.enabled}
              onToggle={() => prefs.set({ weeklyReceive: !prefs.weeklyReceive })}
            />
          </View>
        </Card>

        {/* 테스트 알림 */}
        {!isWeb && prefs.enabled && permStatus === 'granted' && (
          <Card padding={14}>
            <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
              🧪 알림 동작 테스트
            </T>
            <T variant="caption1" color="tertiary" style={{ fontSize: 11.5, marginTop: 4 }}>
              2초 후에 테스트 알림이 와요. 잘 도착하는지 확인해보세요.
            </T>
            <Pressable
              onPress={handleTest}
              style={({ pressed }) => [styles.testBtn, { backgroundColor: palette.blue500, opacity: pressed ? 0.85 : 1 }]}
            >
              <T variant="caption1" style={{ color: '#fff', fontWeight: '800' }}>
                테스트 알림 보내기
              </T>
            </Pressable>
          </Card>
        )}

        {/* 안내 */}
        <View style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, textAlign: 'center', lineHeight: 16 }}>
            ※ 모든 알림은 기기 내부에서 발송되며,{'\n'}
            서버나 외부 푸시 서비스를 사용하지 않습니다.
          </T>
        </View>
      </ScrollView>

      {toast && (
        <View style={[styles.toast, { backgroundColor: t.bgInverse }]} pointerEvents="none">
          <T variant="label1n" style={{ color: t.bgCanvas, fontWeight: '700' }} allowFontScaling={false}>
            {toast}
          </T>
        </View>
      )}
    </SafeAreaView>
  );
}

function NotificationRow({ icon, title, desc, on, disabled, onToggle }: {
  icon: string;
  title: string;
  desc: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      style={({ pressed }) => [
        styles.notiRow,
        {
          backgroundColor: t.bgSurface2,
          borderColor: on && !disabled ? palette.blue500 : t.borderDivider,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <T allowFontScaling={false} style={{ fontSize: 22, width: 30 }}>{icon}</T>
      <View style={{ flex: 1 }}>
        <T variant="caption1" color="primary" style={{ fontWeight: '700', fontSize: 12.5 }}>
          {title}
        </T>
        <T variant="caption2" color="tertiary" style={{ fontSize: 10.5, marginTop: 2 }}>
          {desc}
        </T>
      </View>
      <Switch on={on && !disabled} onPress={onToggle} disabled={disabled} />
    </Pressable>
  );
}

function Switch({ on, onPress, disabled }: { on: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.switchTrack,
        { backgroundColor: on ? palette.blue500 : 'rgba(127,127,127,0.3)' },
      ]}
    >
      <View
        style={[
          styles.switchThumb,
          { left: on ? 24 : 2, backgroundColor: '#fff' },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  settingsBtn: {
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: 10,
  },

  notiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    position: 'absolute',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },

  testBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
  },

  toast: {
    position: 'absolute',
    bottom: 80, alignSelf: 'center',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: radius.pill,
  },
});
