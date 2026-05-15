/**
 * PRO 탭 — 두 섹션으로 나뉜 PRO 기능 카탈로그.
 *
 * 세로 1: PRO 조합 생성 (헤더 카드 + 기능 미리보기 4개)
 * 세로 2: PRO 번호 분석 (헤더 카드 + 기능 미리보기 4개)
 *
 * 헤더 카드를 탭하면 각 상세 페이지로 이동:
 *   - /pro-gen      : PRO 조합 생성
 *   - /pro-analysis : PRO 번호 분석
 *
 * 결제 시스템은 정식 출시 후 연동.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

// PRO 골드 톤 (브랜드 컬러로 고정 — 추후 디자인 시스템에 추가 검토)
const GOLD = '#e8b04e';
const GOLD_SOFT = '#fff4dc';
const GOLD_DARK = '#a37116';

type Feature = { emoji: string; title: string; desc: string };

const GEN_FEATURES: Feature[] = [
  { emoji: '🧠', title: 'AI 패턴 학습',     desc: '최근 회차 흐름을 학습한 가중 추천' },
  { emoji: '🎯', title: '정밀 조합 엔진',   desc: '합·끝수합·AC·홀짝·연속수 동시 최적화' },
  { emoji: '🔁', title: '회차 가중 추출',   desc: '최근성과 미출현을 균형 있게 반영' },
  { emoji: '👤', title: '개인 맞춤 룰',     desc: '저장한 룰을 결합해 자동 조합' },
];

const ANALYSIS_FEATURES: Feature[] = [
  { emoji: '📈', title: '심층 회차 리포트', desc: '회차별 분포·이상치·핵심 지표 요약' },
  { emoji: '🧬', title: '고급 패턴 분석',   desc: '다중 패턴 교차로 적중 후보 추출' },
  { emoji: '🔮', title: '확률 가중 예측',   desc: '통계 모델 기반 다음 회차 시나리오' },
  { emoji: '🗺️', title: '번호 관계 지도',   desc: '궁합·반발 네트워크 한눈에 보기' },
];

export default function Pro() {
  const t = useTheme();
  const router = useRouter();
  const isLocked = true;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon.crown color={GOLD} size={20} weight={2} />
            <T variant="heading1" color="primary">PRO</T>
            <View style={[styles.betaPill, { backgroundColor: GOLD_SOFT }]}>
              <T variant="caption2" style={{ color: GOLD_DARK, fontSize: 10, fontWeight: '700' }} allowFontScaling={false}>
                준비 중
              </T>
            </View>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Icon.crown color="#fff" size={32} weight={2} />
          </View>
          <T variant="title2" style={{ color: '#fff', fontWeight: '800', marginTop: 12, textAlign: 'center' }}>
            더 깊은 분석을 만나보세요
          </T>
          <T variant="body2r" style={{ color: 'rgba(255,255,255,0.78)', marginTop: 6, textAlign: 'center', lineHeight: 22 }}>
            전문가 수준의 패턴 분석과 고급 통계 도구를{'\n'}PRO에서 잠금 해제할 수 있습니다.
          </T>
          <View style={styles.heroChips}>
            <Chip label="광고 없음" tone="invert" />
            <Chip label="고급 분석" tone="invert" />
            <Chip label="우선 업데이트" tone="invert" />
          </View>
        </View>

        {/* 섹션 1: PRO 조합 생성 */}
        <ProSection
          emoji="🎰"
          title="PRO 조합 생성"
          subtitle="고급 알고리즘으로 더 정밀한 조합"
          features={GEN_FEATURES}
          onPress={() => router.push('/pro-gen' as any)}
        />

        {/* 섹션 2: PRO 번호 분석 */}
        <ProSection
          emoji="📊"
          title="PRO 번호 분석"
          subtitle="심층 통계 + 고급 패턴 분석"
          features={ANALYSIS_FEATURES}
          onPress={() => router.push('/pro-analysis' as any)}
        />

        {/* 결제 CTA */}
        <View style={{ marginTop: 4, gap: 10 }}>
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
        </View>

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

/** PRO 섹션 — 헤더 카드(탭 가능) + 기능 미리보기 그리드. */
function ProSection({ emoji, title, subtitle, features, onPress }: {
  emoji: string;
  title: string;
  subtitle: string;
  features: Feature[];
  onPress: () => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      {/* 섹션 헤더 — 탭하면 상세 페이지 이동 */}
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
        <Card padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={[styles.proIcon, { backgroundColor: GOLD_SOFT }]}>
              <T allowFontScaling={false} style={{ fontSize: 26 }}>{emoji}</T>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T variant="headline2" color="primary" style={{ fontWeight: '800' }}>{title}</T>
                <View style={[styles.proBadge, { backgroundColor: GOLD }]}>
                  <T variant="caption2" style={{ color: '#fff', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 }} allowFontScaling={false}>
                    PRO
                  </T>
                </View>
              </View>
              <T variant="caption1" color="tertiary" style={{ marginTop: 4 }}>{subtitle}</T>
            </View>
            <Icon.chev color={GOLD_DARK} size={16} weight={2} />
          </View>
        </Card>
      </Pressable>

      {/* 기능 미리보기 — 잠금 상태로 노출 */}
      <View style={styles.featureGrid}>
        {features.map((f, i) => (
          <FeatureTile key={i} feature={f} />
        ))}
      </View>
    </View>
  );
}

/** 잠금 상태의 기능 미리보기 타일. */
function FeatureTile({ feature }: { feature: Feature }) {
  const t = useTheme();
  return (
    <View style={[styles.featureTile, { backgroundColor: t.bgSurface, borderColor: t.borderDivider }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <T allowFontScaling={false} style={{ fontSize: 18 }}>{feature.emoji}</T>
        <View style={[styles.featureLockPill, { backgroundColor: GOLD_SOFT }]}>
          <Icon.lock color={GOLD_DARK} size={9} weight={2.2} />
        </View>
      </View>
      <T variant="label1n" color="primary" style={{ fontWeight: '700', marginTop: 8 }} numberOfLines={1}>
        {feature.title}
      </T>
      <T variant="caption2" color="tertiary" style={{ marginTop: 2, lineHeight: 16 }} numberOfLines={2}>
        {feature.desc}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    backgroundColor: palette.neutral950,
    borderRadius: radius.xl + 2,
    padding: 24,
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: GOLD,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
    justifyContent: 'center',
  },
  betaPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  proIcon: {
    width: 48, height: 48, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  proBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTile: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 0,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
  },
  featureLockPill: {
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cta: {
    height: 56,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
});
