/**
 * 기능 탭 — 부가 기능 hub.
 *
 * 분석 외 기능들을 한 화면에 모았다.
 * 추후 추가: 알림 설정, 백업/복원, 테마, 책임 있는 구매 안내 등.
 */
import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

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

const styles = StyleSheet.create({
  root: { flex: 1 },
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
});
