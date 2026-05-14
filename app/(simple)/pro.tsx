/**
 * PRO 탭 — 결제 잠금 영역의 진입점.
 *
 * 현재는 콘텐츠가 아직 확정되지 않아 "곧 만나요" 안내 + 결제 안내 화면을
 * placeholder로 두고, 사용자가 PRO에 들어갈 분석 기능을 정의하면 그때
 * 본격적으로 채운다.
 *
 * 디자인 방향:
 *   - 깊은 보라/네이비 hero (Expert 모드의 purple 액센트와 결을 맞춤)
 *   - 황금색 강조 (crown 아이콘 + "PRO" 배지)
 *   - 미리보기 카드 4~5장 (각 기능 타이틀 + 잠금 자물쇠) — 추후 실제 메뉴로 교체
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Button } from '@/src/components/Button';
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

export default function Pro() {
  const t = useTheme();
  // 결제 상태는 아직 시스템 미연동. 항상 isLocked = true.
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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
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

        {/* 곧 만나요 카드 — 콘텐츠 미확정 */}
        <Card padding={20}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <View style={[styles.lockChip, { backgroundColor: GOLD_SOFT }]}>
              <Icon.lock color={GOLD_DARK} size={14} weight={2.2} />
            </View>
            <T variant="headline1" color="primary">PRO 콘텐츠 준비 중</T>
          </View>
          <T variant="body2r" color="secondary" style={{ lineHeight: 22 }}>
            PRO 전용 분석 기능을 구성 중입니다. 정식 공개 시 가장 먼저 알려드릴게요.
          </T>
          <View style={{ marginTop: 14, gap: 8 }}>
            <Bullet>📈 곧 추가될 고급 통계 도구</Bullet>
            <Bullet>🎯 정밀한 패턴 매칭 분석</Bullet>
            <Bullet>📊 회차별 심층 비교 리포트</Bullet>
            <Bullet>🔔 우선 알림 & 광고 없는 사용 경험</Bullet>
          </View>
        </Card>

        {/* Placeholder 잠금 카드 4장 (실제 메뉴는 추후 정의 후 교체) */}
        <View style={{ gap: 10 }}>
          <T variant="caption1" color="tertiary" style={{ marginTop: 8, marginBottom: 2, letterSpacing: 0.4 }}>
            COMING SOON
          </T>
          <LockedItem title="기능 1" subtitle="추후 공개" />
          <LockedItem title="기능 2" subtitle="추후 공개" />
          <LockedItem title="기능 3" subtitle="추후 공개" />
          <LockedItem title="기능 4" subtitle="추후 공개" />
        </View>

        {/* 결제 CTA — 아직 비활성 */}
        <View style={{ marginTop: 12, gap: 10 }}>
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

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <T variant="body2r" color="secondary" style={{ lineHeight: 22 }}>
      {children}
    </T>
  );
}

function LockedItem({ title, subtitle }: { title: string; subtitle: string }) {
  const t = useTheme();
  return (
    <Card padding={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.itemIcon, { backgroundColor: palette.softFill }]}>
          <Icon.lock color={t.fgTertiary} size={16} weight={2} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{title}</T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>{subtitle}</T>
        </View>
        <Chip label="PRO" tone="purple" compact />
      </View>
    </Card>
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
  lockChip: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  itemIcon: {
    width: 36, height: 36, borderRadius: 10,
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
