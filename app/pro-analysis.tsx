/**
 * PRO 번호 분석 — /pro-analysis
 *
 * PRO 번호 분석 영역의 카탈로그 페이지.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
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
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/pro');

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

        {/* ─── 0. 솔이 예상수 PRO (메인 추천) ───────────────── */}
        <ProFeatureCard
          emoji="🌟"
          tag="PRO"
          title="솔이 예상수 PRO"
          desc="일반 모드의 예상수 10수 분석을 넘어 10가지 분석법(이월수·이웃수·-45·동일날짜·궁합수 Lift·회귀 패턴·끝수·시루 등)을 백테스트 가중치로 합쳐서 20수 예측. 최근 30회 시스템 정확도 + 메소드별 정밀도 표시."
          preview={<PreviewPredict />}
          onPress={() => router.push('/pro-predict' as any)}
        />

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: palette.neutral950 }]}>
          <View style={[styles.heroBadge, { backgroundColor: GOLD }]}>
            <Icon.crown color="#fff" size={14} weight={2.5} />
            <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10.5, marginLeft: 4, letterSpacing: 0.4 }}>
              PRO
            </T>
          </View>
          <T variant="title2" style={{ color: '#fff', fontWeight: '800', marginTop: 14 }}>
            전문가용 분석 도구
          </T>
          <T variant="body2r" style={{ color: 'rgba(255,255,255,0.82)', marginTop: 8, lineHeight: 22 }}>
            일반 분석으로는 부족한 깊이의 시계열·티어·다중 비교 분석을 PRO에서.
          </T>
          <View style={styles.heroChips}>
            <Chip label="📊 자유 범위" tone="invert" />
            <Chip label="🔥 4단계 티어" tone="invert" />
            <Chip label="📈 시계열 추이" tone="invert" />
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

        {/* ─── 1. 주간 출현 PRO ─────────────────────────────── */}
        <ProFeatureCard
          emoji="📊"
          tag="PRO"
          title="주간 출현 PRO"
          desc="일반 모드의 5/10/15/20/30주 고정 칩을 넘어 회차 범위 자유 지정 + 4단계 티어(자주/보통이상/보통이하/거의안나옴) + 번호별 시계열 추이 + 두 기간 비교 + 평이한 인사이트까지."
          preview={<PreviewWeekly />}
          onPress={() => router.push('/pro-weekly' as any)}
        />

        {/* ─── 2. 궁합수 PRO ───────────────────────────────── */}
        <ProFeatureCard
          emoji="🤝"
          tag="PRO"
          title="궁합수 PRO"
          desc="일반 모드의 단일 번호 분석을 넘어 다중 번호(최대 5개) 합산 궁합 + 궁합 트리오 TOP 10(3개 짝궁) + 자동 추천 조합 5개 생성 + 평균 대비 궁합 강도까지."
          preview={<PreviewCompat />}
          onPress={() => router.push('/pro-compat' as any)}
        />

        {/* ─── 3. 회귀분석 PRO ─────────────────────────────── */}
        <ProFeatureCard
          emoji="🔁"
          tag="PRO"
          title="회귀분석 PRO"
          desc="일반 모드의 100회귀 단순 리스트를 넘어 1~500회귀까지 확장 + 두 가지 TOP 10 랭킹(📊 회귀률 / 🔥 최근 연속 회귀)을 같은 카드에서 탭 전환. 행 탭으로 K 즉시 적용."
          preview={<PreviewRegression />}
          onPress={() => router.push('/pro-regression' as any)}
        />

        {/* ─── 4. 분석법 비교 PRO ──────────────────────────── */}
        <ProFeatureCard
          emoji="🧪"
          tag="PRO"
          title="분석법 비교 PRO"
          desc="종합·동일날짜·이월수·이웃수·-45 다섯 가지 분석법을 한 화면에서 회차 이동(◀▶ 또는 회차 직접 입력)으로 비교. 추첨 예정 회차에서는 다음 회차 후보를, 추첨 완료 회차에서는 실제 매칭 결과를 점선 강조로 표시."
          preview={<PreviewMethods />}
          onPress={() => router.push('/pro-analysis-methods' as any)}
        />

        {/* 비교표 */}
        <ComparisonTable />

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   미리보기 — 주간 출현 PRO
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewWeekly() {
  // mock 데이터로 4단계 티어 시각화
  const tiers = [
    { label: '🔥 Hot',    color: palette.red500,    nums: [13, 27, 34] },
    { label: '🌡 Warm',    color: '#ea580c',         nums: [7, 22, 38] },
    { label: '❄️ Cold',    color: palette.blue500,   nums: [11, 19, 41] },
    { label: '🧊 Frozen',  color: '#888',            nums: [4, 30] },
  ];
  return (
    <View style={{ gap: 8 }}>
      {tiers.map((tier) => (
        <View key={tier.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 56 }}>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, fontWeight: '800', color: tier.color }}>
              {tier.label}
            </T>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
            {tier.nums.map((n) => <Ball key={n} n={n} size="xs" />)}
          </View>
        </View>
      ))}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   미리보기 — 궁합수 PRO
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewCompat() {
  // mock — 선택 3개 + 짝궁 3개 (Lift 기반)
  const picked = [7, 13, 27];
  const partners = [
    { n: 34, lift: 1.62, raw: 18 },
    { n: 11, lift: 1.48, raw: 16 },
    { n: 41, lift: 1.31, raw: 14 },
  ];
  return (
    <View style={{ gap: 10 }}>
      {/* 선택 번호 행 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 56 }}>
          <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, fontWeight: '800', color: palette.blue700 }}>
            선택
          </T>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {picked.map((n) => <Ball key={n} n={n} size="xs" />)}
          <T variant="caption2" allowFontScaling={false} style={{ alignSelf: 'center', marginLeft: 4, fontSize: 10.5, color: palette.blue700, fontWeight: '700' }}>
            3개
          </T>
        </View>
      </View>
      {/* 짝궁 TOP 3 — Lift 기반 */}
      {partners.map((p) => (
        <View key={p.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 56 }}>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: GOLD_DARK, fontWeight: '700' }}>
              짝궁 {p.lift}배
            </T>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ball n={p.n} size="xs" />
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, color: '#888', fontWeight: '600' }}>
              동시 {p.raw}회
            </T>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   미리보기 — 솔이 예상수 PRO
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewPredict() {
  // mock — 20수 중 상위 10개만 미니 그리드로 표시
  const top10 = [7, 13, 17, 22, 27, 30, 34, 38, 41, 45];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '800', color: GOLD_DARK }}>
          🌟 솔이 예상수 TOP 10
        </T>
        <T variant="caption2" allowFontScaling={false} style={{ fontSize: 9, color: '#888', fontWeight: '600' }}>
          (20수 중)
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {top10.map((n) => <Ball key={n} n={n} size="xs" />)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: palette.red500, fontWeight: '800' }}>
          📊 최근 30회 백테스트
        </T>
        <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: '#888', fontWeight: '700' }}>
          평균 3.2개 적중 / 우연의 1.20배
        </T>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   미리보기 — 회귀분석 PRO
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewRegression() {
  // mock — 두 가지 K-랭킹 미니 프리뷰 (탭으로 전환되는 모양 암시)
  const rates = [
    { rank: 1, k: 1, rate: 17.3, color: GOLD_DARK },
    { rank: 2, k: 3, rate: 16.1, color: GOLD_DARK },
    { rank: 5, k: 7, rate: 15.4, color: palette.purple500 },
  ];
  const streaks = [
    { rank: 1, k: 2, streak: 5, color: GOLD_DARK },
    { rank: 2, k: 1, streak: 4, color: GOLD_DARK },
  ];
  return (
    <View style={{ gap: 10 }}>
      <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '800', color: palette.purple500 }}>
        📊 회귀률 TOP
      </T>
      {rates.map((r) => (
        <View key={r.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T variant="caption2" allowFontScaling={false} style={{ width: 12, fontSize: 10, fontWeight: '800', color: r.color }}>
            {r.rank}
          </T>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: r.color + '25' }}>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '800', color: r.color }}>
              {r.k}회귀
            </T>
          </View>
          <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, color: '#888', fontWeight: '700' }}>
            {r.rate}%
          </T>
        </View>
      ))}
      <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '800', color: GOLD_DARK, marginTop: 2 }}>
        🔥 최근 연속 회귀 TOP
      </T>
      {streaks.map((s) => (
        <View key={s.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T variant="caption2" allowFontScaling={false} style={{ width: 12, fontSize: 10, fontWeight: '800', color: s.color }}>
            {s.rank}
          </T>
          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: s.color + '25' }}>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '800', color: s.color }}>
              {s.k}회귀
            </T>
          </View>
          <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, color: '#888', fontWeight: '700' }}>
            {s.streak}회 연속
          </T>
        </View>
      ))}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   미리보기 — 분석법 비교 PRO
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewMethods() {
  // mock — 4가지 분석법 후보 미니 칩 (1줄에 분석법 + 후보 1-2개)
  const methods = [
    { label: '이월수',    color: palette.green700, n: 17 },
    { label: '이웃수',    color: palette.blue700,  n: 24 },
    { label: '-45',       color: palette.purple500, n: 38 },
    { label: '동일날짜',  color: '#a37116',        n: 12 },
  ];
  return (
    <View style={{ gap: 8 }}>
      {methods.map((m) => (
        <View key={m.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 2,
            borderRadius: 99,
            backgroundColor: m.color + '20',
            minWidth: 60, alignItems: 'center',
          }}>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '800', color: m.color }}>
              {m.label}
            </T>
          </View>
          <Ball n={m.n} size="xs" dashedRing />
          <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, color: '#888', fontWeight: '600' }}>
            ← 후보 일치
          </T>
        </View>
      ))}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   공통 컴포넌트
   ═══════════════════════════════════════════════════════════════════════════ */

function ProFeatureCard({ emoji, tag, title, desc, preview, onPress }: {
  emoji: string;
  tag: string;
  title: string;
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
    { label: '예상수 분석',     free: '10수 (8방법)',        pro: '20수 (10방법 + 백테스트)' },
    { label: '회차 범위',       free: '5/10/15/20/30 고정', pro: '1~전체 자유 지정' },
    { label: '티어 분류',       free: '상위/하위 5',         pro: '4단계' },
    { label: '시계열 추이',     free: '✗',                  pro: '번호별 추이 차트' },
    { label: '궁합수 선택',     free: '1개만',               pro: '최대 5개 합산' },
    { label: '궁합 점수',       free: '단순 횟수',           pro: 'Lift (우연 대비 배수)' },
    { label: '궁합 트리오',     free: '✗',                  pro: 'TOP 10 (3개 짝궁)' },
    { label: '회귀 K 범위',     free: '1~100',               pro: '1~500 (5배 확장)' },
    { label: '회귀률 TOP 10',   free: '✗',                  pro: '평균 이월률 순위' },
    { label: '최근 연속 회귀 TOP 10', free: '✗',            pro: '진행 중 K-streak' },
    { label: '랭킹 → K 전환',   free: '✗',                  pro: '행 탭 즉시 전환' },
    { label: '분석법 비교 (5종)', free: '✓',                pro: '✓ + 끝수·시루 추가' },
    { label: '자동 추천 조합',  free: '✗',                  pro: '5개 자동 생성' },
    { label: '자동 인사이트',   free: '✗',                  pro: '✓' },
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
        번호 분석 영역
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

  hero: { borderRadius: radius.xl + 2, padding: 22 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, alignSelf: 'flex-start',
  },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16 },

  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 6, marginBottom: 2,
  },

  featIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tag: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: radius.pill },
  preview: { marginTop: 12, padding: 12, borderRadius: radius.md, borderWidth: 1 },

  compHead: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1 },
  compRow: { flexDirection: 'row', paddingVertical: 8, alignItems: 'center' },
});
