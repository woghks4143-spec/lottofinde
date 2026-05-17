/**
 * PRO 조합 생성 — /pro-gen
 *
 * PRO 조합 생성 영역의 카탈로그 페이지. 각 카드는 풍부한 미리보기 + 디테일 페이지 연결.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const GOLD = '#e8b04e';
const GOLD_SOFT = '#fff4dc';
const GOLD_DARK = '#a37116';

export default function ProGen() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/pro');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon.crown color={GOLD} size={18} weight={2} />
            <T variant="heading1" color="primary">PRO 조합 생성</T>
          </View>
        }
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: palette.neutral950 }]}>
          <View style={[styles.heroBadge, { backgroundColor: GOLD }]}>
            <Icon.crown color="#fff" size={14} weight={2.5} />
            <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10.5, marginLeft: 4, letterSpacing: 0.4 }}>
              PRO
            </T>
          </View>
          <T variant="title2" style={{ color: '#fff', fontWeight: '800', marginTop: 14 }}>
            프로페셔널 조합 엔진
          </T>
          <T variant="body2r" style={{ color: 'rgba(255,255,255,0.82)', marginTop: 8, lineHeight: 22 }}>
            일반 조합 필터링으로는 불가능한 다차원 + 회차 관계 + 패턴 조건까지.
          </T>
          <View style={styles.heroChips}>
            <Chip label="🎛️ 13가지 필터" tone="invert" />
            <Chip label="📊 깔때기 시각화" tone="invert" />
            <Chip label="∞ 프리셋 저장" tone="invert" />
          </View>
        </View>

        {/* 섹션 헤더 */}
        <View style={styles.sectionHead}>
          <T variant="caption1" color="tertiary" style={{ letterSpacing: 0.4, fontWeight: '700' }}>
            PRO 전용 기능
          </T>
          <T variant="caption2" allowFontScaling={false} style={{ color: palette.green700, fontWeight: '800', fontSize: 11 }}>
            ✓ 활성화됨
          </T>
        </View>

        {/* ─── 1. 조합 필터링 (PRO) ─────────────────────────────── */}
        <ProFeatureCard
          emoji="🎛️"
          tag="PRO"
          title="조합 필터링"
          fromFree="조합 필터링"
          desc="13가지 필터(번호·통계·패턴·회차 관계)를 다단계로 조합해 정밀한 조건의 조합만 추출. 필터별 후보 감소를 깔때기로 시각화하고 프리셋으로 저장/재사용."
          preview={<PreviewFilter />}
          onPress={() => router.push('/pro-filter' as any)}
        />

        {/* 비교표 */}
        <ComparisonTable />

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   미리보기 — 프로 필터링 조합생성
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewFilter() {
  const t = useTheme();
  const groups = [
    { label: '번호', count: 3, color: '#0066ff' },
    { label: '통계', count: 4, color: GOLD },
    { label: '패턴', count: 2, color: palette.purple500 },
    { label: '회차 관계', count: 1, color: palette.red500 },
  ];
  return (
    <View>
      {/* 필터 그룹 칩 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {groups.map((g) => (
          <View key={g.label} style={[styles.groupChip, { backgroundColor: t.bgSurface, borderColor: g.color }]}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: g.color }} />
            <T variant="caption2" allowFontScaling={false} style={{ color: g.color, fontWeight: '800', fontSize: 10.5, marginLeft: 4 }}>
              {g.label} {g.count}
            </T>
          </View>
        ))}
      </View>

      {/* 깔때기 — 후보 감소 시각화 */}
      <View style={{ gap: 4 }}>
        <FunnelRow label="전체 가능" value="8,145,060" pct={100} t={t} />
        <FunnelRow label="번호 필터" value="4,234,123" pct={52} t={t} />
        <FunnelRow label="통계 필터" value="287,432" pct={3.5} t={t} />
        <FunnelRow label="패턴·관계" value="1,247" pct={0.015} t={t} accent />
      </View>
    </View>
  );
}

function FunnelRow({ label, value, pct, t, accent }: {
  label: string; value: string; pct: number; t: ReturnType<typeof useTheme>; accent?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <T
        variant="caption2"
        allowFontScaling={false}
        style={{ width: 56, fontSize: 10, fontWeight: '700', color: '#999' }}
      >
        {label}
      </T>
      <View style={[styles.funnelTrack, { backgroundColor: t.bgSurface }]}>
        <View
          style={{
            width: `${Math.max(2, pct)}%`,
            height: '100%',
            borderRadius: 4,
            backgroundColor: accent ? palette.green500 : GOLD,
          }}
        />
      </View>
      <T
        variant="caption2"
        allowFontScaling={false}
        style={{ minWidth: 70, textAlign: 'right', fontSize: 10, fontWeight: '800', color: accent ? palette.green700 : '#888' }}
      >
        {value}
      </T>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   공통 보조 컴포넌트
   ═══════════════════════════════════════════════════════════════════════════ */

function ProFeatureCard({ emoji, tag, title, fromFree, desc, preview, onPress }: {
  emoji: string;
  tag: string;
  title: string;
  fromFree: string;
  desc: string;
  preview: React.ReactNode;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <Card padding={16}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={[styles.featIcon, { backgroundColor: GOLD_SOFT }]}>
            <T allowFontScaling={false} style={{ fontSize: 24 }}>{emoji}</T>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <T variant="headline2" color="primary" style={{ fontWeight: '800' }}>{title}</T>
              <View style={[styles.tag, { backgroundColor: GOLD }]}>
                <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 9 }}>
                  {tag}
                </T>
              </View>
            </View>
            <T variant="caption1" color="tertiary" style={{ marginTop: 6, lineHeight: 17 }}>
              {desc}
            </T>
          </View>
          <Icon.chev color={GOLD} size={16} weight={2.2} />
        </View>

        <View style={[styles.preview, { backgroundColor: t.bgSurface2, borderColor: t.borderDivider }]}>
          {preview}
        </View>
      </Card>
    </Pressable>
  );
}

function ComparisonTable() {
  const t = useTheme();
  const rows = [
    { label: '필터 차원',         free: '8개',     pro: '13개' },
    { label: '회차 관계 필터',     free: '이월수만', pro: '4종' },
    { label: '패턴 필터',         free: '✗',       pro: '4종' },
    { label: '깔때기 시각화',     free: '✗',       pro: '✓' },
    { label: '프리셋 저장',       free: '✗',       pro: '∞ 무제한' },
  ];
  return (
    <Card padding={16}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Icon.crown color={GOLD} size={16} weight={2.2} />
        <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
          무료 vs PRO 비교
        </T>
      </View>
      <T variant="caption1" color="tertiary" style={{ marginBottom: 12 }}>
        조합 생성 영역
      </T>
      <View style={[styles.compHead, { borderBottomColor: t.borderDivider }]}>
        <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ flex: 2, fontSize: 11 }}>기능</T>
        <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>무료</T>
        <T variant="caption2" allowFontScaling={false} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: GOLD_DARK, fontWeight: '800' }}>PRO</T>
      </View>
      {rows.map((r, i) => (
        <View
          key={i}
          style={[styles.compRow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.borderDivider }]}
        >
          <T variant="caption1" color="primary" style={{ flex: 2, fontWeight: '600' }}>{r.label}</T>
          <T variant="caption1" color="tertiary" allowFontScaling={false} style={{ flex: 1, textAlign: 'center' }}>{r.free}</T>
          <T variant="caption1" allowFontScaling={false} style={{ flex: 1, textAlign: 'center', color: GOLD_DARK, fontWeight: '800' }}>{r.pro}</T>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: {
    borderRadius: radius.xl + 2,
    padding: 22,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },

  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },

  featIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 6, paddingVertical: 1.5,
    borderRadius: radius.pill,
  },
  preview: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  funnelTrack: {
    flex: 1,
    height: 10,
    borderRadius: 4,
    overflow: 'hidden',
  },

  compHead: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  compRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'center',
  },
});
