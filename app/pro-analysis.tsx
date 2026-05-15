/**
 * PRO 번호 분석 — /pro-analysis
 *
 * PRO 결제 후 잠금 해제될 고급 번호 분석 도구가 들어갈 페이지.
 * 현재는 placeholder + 잠금 CTA. 콘텐츠 확정되면 채운다.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const GOLD = '#e8b04e';
const GOLD_SOFT = '#fff4dc';
const GOLD_DARK = '#a37116';

export default function ProAnalysis() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/pro');
  const isLocked = true;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon.crown color={GOLD} size={18} weight={2} />
            <T variant="heading1" color="primary">PRO 번호 분석</T>
          </View>
        }
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        <View style={[styles.hero, { backgroundColor: palette.neutral950 }]}>
          <View style={[styles.heroBadge, { backgroundColor: GOLD }]}>
            <Icon.crown color="#fff" size={14} weight={2.5} />
            <T variant="caption2" style={{ color: '#fff', fontWeight: '800', fontSize: 10.5, marginLeft: 4, letterSpacing: 0.4 }} allowFontScaling={false}>
              PRO
            </T>
          </View>
          <T variant="title2" style={{ color: '#fff', fontWeight: '800', marginTop: 14 }}>
            전문가 수준 분석
          </T>
          <T variant="body2r" style={{ color: 'rgba(255,255,255,0.78)', marginTop: 8, lineHeight: 22 }}>
            기본 분석을 넘어 더 깊이 있는 통계와{'\n'}패턴 분석 도구로 데이터를 살펴봐요.
          </T>
          <View style={styles.heroChips}>
            <Chip label="고급 통계" tone="invert" />
            <Chip label="심층 패턴" tone="invert" />
            <Chip label="회차 리포트" tone="invert" />
          </View>
        </View>

        <Card padding={20}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <View style={[styles.lockChip, { backgroundColor: GOLD_SOFT }]}>
              <Icon.lock color={GOLD_DARK} size={14} weight={2.2} />
            </View>
            <T variant="headline1" color="primary">곧 만나요</T>
          </View>
          <T variant="body2r" color="secondary" style={{ lineHeight: 22 }}>
            PRO 전용 번호 분석 기능을 준비 중입니다.{'\n'}
            정식 공개 시 가장 먼저 알려드릴게요.
          </T>
        </Card>

        <Pressable
          disabled={isLocked}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: GOLD, opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <Icon.lock color="#fff" size={16} weight={2.5} />
          <T variant="body1n" style={{ color: '#fff', fontWeight: '800', marginLeft: 8 }}>
            곧 만나요
          </T>
        </Pressable>
        <T variant="caption1" color="tertiary" style={{ textAlign: 'center' }}>
          결제 시스템은 정식 출시 이후 연동됩니다.
        </T>

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { borderRadius: radius.xl + 2, padding: 22 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },
  lockChip: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  cta: {
    height: 52,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
