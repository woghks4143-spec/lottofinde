/**
 * 기능 탭 — 부가 기능 hub + 화면 설정.
 *
 * 1) 화면 설정 — 테마(시스템/라이트/다크), 큰 글씨
 * 2) 기능 — 당첨 확인, 가중치 뽑기, 판매점, 알림(준비중) 등
 */
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';
import { useSettings, type DarkPref } from '@/src/store/settings';

type Entry = {
  emoji: string;
  title: string;
  desc: string;
  onPress: () => void;
  comingSoon?: boolean;
};

export default function Features() {
  const t = useTheme();
  const router = useRouter();

  const darkMode = useSettings((s) => s.darkMode);
  const setDarkMode = useSettings((s) => s.setDarkMode);
  const seniorText = useSettings((s) => s.seniorText);
  const setSeniorText = useSettings((s) => s.setSeniorText);

  const entries: Entry[] = [
    {
      emoji: '✅',
      title: '당첨 확인',
      desc: 'QR 스캔 또는 직접 입력으로 회차 매칭 확인',
      onPress: () => router.push('/(simple)/check' as any),
    },
    {
      emoji: '🎛️',
      title: '가중치 뽑기',
      desc: '1~45 각 번호의 확률을 직접 조정해 뽑기',
      onPress: () => router.push('/weighted-pick' as any),
    },
    {
      emoji: '📍',
      title: '판매점 찾기',
      desc: '동행복권 공식 판매점 안내',
      onPress: () => Linking.openURL('https://dhlottery.co.kr/store.do?method=topStore').catch(() => {}),
    },
    {
      emoji: '🔔',
      title: '알림 설정',
      desc: '추첨 임박·당첨 결과 푸시 알림',
      onPress: () => {},
      comingSoon: true,
    },
    {
      emoji: '💾',
      title: '데이터 백업',
      desc: '내 번호·룰을 파일로 백업/복원',
      onPress: () => {},
      comingSoon: true,
    },
    {
      emoji: 'ℹ️',
      title: '책임 있는 구매',
      desc: '복권은 책임 있는 범위에서 즐겨주세요',
      onPress: () => Linking.openURL('https://www.dhlottery.co.kr/contents.do?method=responsibilityGame1').catch(() => {}),
    },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="기능" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}>

        {/* 화면 설정 */}
        <View style={styles.sectionHead}>
          <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>
            🎨 화면 설정
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
            테마와 글자 크기를 바꿔보세요
          </T>
        </View>

        {/* 테마 카드 */}
        <Card padding={16}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: palette.softFill }]}>
              <T allowFontScaling={false} style={{ fontSize: 24 }}>
                {darkMode === 'light' ? '☀️' : darkMode === 'dark' ? '🌙' : '🌓'}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="headline2" color="primary" style={{ fontWeight: '700' }}>
                테마
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 4, lineHeight: 17 }}>
                시스템 설정을 따르거나 직접 선택해요
              </T>
            </View>
          </View>

          <View style={[styles.segWrap, { backgroundColor: t.bgSurface2, borderColor: t.borderDivider }]}>
            <SegBtn label="시스템" active={darkMode === 'system'} onPress={() => setDarkMode('system')} />
            <SegBtn label="라이트" active={darkMode === 'light'}  onPress={() => setDarkMode('light')} />
            <SegBtn label="다크"   active={darkMode === 'dark'}   onPress={() => setDarkMode('dark')} />
          </View>
        </Card>

        {/* 큰 글씨 카드 */}
        <Card padding={16}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: palette.softFill }]}>
              <T allowFontScaling={false} style={{ fontSize: 24 }}>🔠</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="headline2" color="primary" style={{ fontWeight: '700' }}>
                큰 글씨
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 4, lineHeight: 17 }}>
                본문과 라벨을 크게 표시해 가독성 향상
              </T>
            </View>
            <Switch
              value={seniorText}
              onValueChange={setSeniorText}
              trackColor={{ false: t.bgSurface2, true: palette.purple500 }}
              thumbColor="#fff"
              ios_backgroundColor={t.bgSurface2}
            />
          </View>
        </Card>

        {/* 기능 */}
        <View style={[styles.sectionHead, { marginTop: 18 }]}>
          <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>
            🛠 기능
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
            앱 부가 도구와 외부 링크
          </T>
        </View>

        {entries.map((e, i) => (
          <Pressable
            key={i}
            onPress={e.onPress}
            disabled={e.comingSoon}
            style={({ pressed }) => [{ opacity: pressed && !e.comingSoon ? 0.92 : 1 }]}
          >
            <Card padding={16}>
              <View style={styles.row}>
                <View style={[styles.iconBox, { backgroundColor: palette.softFill }]}>
                  <T allowFontScaling={false} style={{ fontSize: 24 }}>{e.emoji}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <T variant="headline2" color="primary" style={{ fontWeight: '700' }}>
                      {e.title}
                    </T>
                    {e.comingSoon && (
                      <View style={[styles.soonChip, { backgroundColor: palette.purple50 }]}>
                        <T variant="caption2" style={{ color: palette.purple500, fontWeight: '700', fontSize: 10 }} allowFontScaling={false}>
                          준비 중
                        </T>
                      </View>
                    )}
                  </View>
                  <T variant="caption1" color="tertiary" style={{ marginTop: 4, lineHeight: 17 }}>
                    {e.desc}
                  </T>
                </View>
                {!e.comingSoon && <Icon.chev color={t.fgTertiary} />}
              </View>
            </Card>
          </Pressable>
        ))}
        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── 보조 컴포넌트 ────────────────────────────────────────────────── */

function SegBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segBtn,
        active && { backgroundColor: t.bgSurface, borderColor: palette.purple500 },
      ]}
    >
      <T
        variant="caption1"
        allowFontScaling={false}
        style={{
          color: active ? palette.purple500 : t.fgSecondary,
          fontWeight: active ? '800' : '600',
          fontSize: 13,
        }}
      >
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sectionHead: { marginTop: 4, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconBox: {
    width: 52, height: 52, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  soonChip: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.pill,
  },
  segWrap: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
    marginTop: 14,
  },
  segBtn: {
    flex: 1,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
