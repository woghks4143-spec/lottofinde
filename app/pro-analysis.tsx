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

        {/* Hero — pro-gen과 통일된 콤팩트 디자인 */}
        <View style={[styles.hero, { backgroundColor: t.bgHero }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <View style={[styles.heroBadge, { backgroundColor: GOLD, alignSelf: 'flex-start' }]}>
                <Icon.crown color="#fff" size={12} weight={2.5} />
                <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10, marginLeft: 4, letterSpacing: 0.4 }}>
                  PRO
                </T>
              </View>
              <T variant="headline2" style={{ color: t.fgOnHero, fontWeight: '800', marginTop: 8 }}>
                프로페셔널 분석 도구
              </T>
              <T variant="caption1" style={{ color: t.fgOnHeroMuted, marginTop: 4, fontSize: 12 }}>
                시계열 추이 · 다중 비교 · 정밀 분석
              </T>
            </View>
          </View>
        </View>

        {/* ─── 0. 핀더 예상 제외수 PRO (메인 추천) ───────────────── */}
        <ProFeatureCard
          emoji="🌟"
          tag="PRO"
          title="핀더 예상 제외수"
          desc={
            "핀더 예상 20수 + 예상 제외수 3개를 한 화면에. " +
            "회차 이동(◀▶ / 직접 입력)으로 과거 시점 분석 가능. " +
            "추첨 후 회차에선 실제 본번호와 매칭 점선 표시."
          }
          preview={<PreviewPredict />}
          onPress={() => router.push('/pro-predict' as any)}
        />

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
          title="주간 출현"
          desc={
            "회차 범위 자유 지정(최근 N회 ~ 전체) + 4단계 컬러 티어(자주·보통이상·보통이하·거의 안 나옴)로 분류. " +
            "1~45 7×7 히트맵 + 두 기간 비교 모드 + 번호별 시계열 추이까지. " +
            "Hot/Cold 자동 추출로 PRO답게 한눈에 패턴 파악."
          }
          preview={<PreviewWeekly />}
          onPress={() => router.push('/pro-weekly' as any)}
        />

        {/* ─── 2. 궁합수 PRO ───────────────────────────────── */}
        <ProFeatureCard
          emoji="🤝"
          tag="PRO"
          title="궁합수"
          desc={
            "두 가지 모드 탭으로 분석. (1) 궁합수 — 1~5개 번호 합산 짝궁 TOP 10 + 안 어울리는 번호 BOTTOM 5 + 궁합 트리오. " +
            "(2) 당첨 궁합 — 직전 회차 본번호의 짝궁 TOP 10이 다음 회차에 얼마나 적중했는지 확인. " +
            "PRO 전용 점수 모델로 단순 빈도가 아닌 의미 있는 동행 강도를 측정."
          }
          preview={<PreviewCompat />}
          onPress={() => router.push('/pro-compat' as any)}
        />

        {/* ─── 3. 회귀분석 PRO ─────────────────────────────── */}
        <ProFeatureCard
          emoji="🔁"
          tag="PRO"
          title="회귀분석"
          desc={
            "광범위한 회귀 범위로 자유 분석 + 두 가지 TOP 10 랭킹(📊 회귀률 / 🔥 최근 연속 회귀)을 탭 전환. " +
            "회차별 상세에서 이월 번호 컬러 / 안 이월 muted로 즉시 식별. " +
            "진입 즉시 결과 표시 (사전 계산 캐시)."
          }
          preview={<PreviewRegression />}
          onPress={() => router.push('/pro-regression' as any)}
        />

        {/* ─── 4. 분석법 비교 PRO ──────────────────────────── */}
        <ProFeatureCard
          emoji="🧪"
          tag="PRO"
          title="분석법 비교"
          desc={
            "종합·동일날짜·이월수·이웃수·-45 + 끝수·시루까지 7가지 분석법을 한 회차에서 비교. " +
            "회차 이동(◀▶ / 직접 입력)으로 자유롭게 시점 전환. " +
            "추첨 예정 회차엔 다음 회차 후보, 추첨 완료 회차엔 실제 매칭 결과를 점선 강조."
          }
          preview={<PreviewMethods />}
          onPress={() => router.push('/pro-analysis-methods' as any)}
        />

        {/* ─── 5. 패턴 분석 PRO ────────────────────────────── */}
        <ProFeatureCard
          emoji="🎯"
          tag="PRO"
          title="패턴 분석"
          desc={
            "JH필터 10종을 한 화면 종합 시트(전체 패턴 그리드)와 개별 시트(필터별 상세)로 분석. " +
            "7×7 그리드에서 패턴 영역은 보라 보더, 본번호는 빨강, 보너스는 파랑으로 즉시 시각화. " +
            "회차 이동 + 과거 적중 이력 비교."
          }
          preview={<PreviewPattern />}
          onPress={() => router.push('/pro-pattern-analysis' as any)}
        />

        {/* ─── 6. 출현 분석 PRO ────────────────────────────── */}
        <ProFeatureCard
          emoji="🎨"
          tag="PRO"
          title="출현 분석"
          desc={
            "1~45 모든 번호의 통계 지표 TOP(주기 초과·장기 미출현·핫) + 추천 TOP 10(GOLD 1~3등) + 번호 구간 추천을 한 화면에. " +
            "회차 이동으로 과거 시점 분석 + 다음 회차 본번호와 적중 비교 (1위 구간 적중 표시). " +
            "정렬 4종(번호순·출현 많음·장기 미출현·임박도)으로 관점 전환."
          }
          preview={<PreviewAppearance />}
          onPress={() => router.push('/pro-appearance-stats' as any)}
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
  const t = useTheme();
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
      {/* 짝궁 TOP 3 미리보기 */}
      {partners.map((p, i) => (
        <View key={p.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 56 }}>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: t.fgGold, fontWeight: '700' }}>
              짝궁 {i + 1}위
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
   미리보기 — 핀더 예상 제외수 PRO
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewPredict() {
  const t = useTheme();
  // mock — 20수 중 상위 10개만 미니 그리드로 표시
  const top10 = [7, 13, 17, 22, 27, 30, 34, 38, 41, 45];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '800', color: t.fgGold }}>
          🌟 핀더 예상 제외수 TOP 10
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
          📊 PRO 전용 분석
        </T>
        <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: '#888', fontWeight: '700' }}>
          정밀 예상수 20수 + 제외수 3개
        </T>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   미리보기 — 회귀분석 PRO
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewRegression() {
  const t = useTheme();
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
      <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '800', color: t.fgGold, marginTop: 2 }}>
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
   미리보기 — 패턴 분석 PRO
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewPattern() {
  // mock — JH필터 4종 미리보기 칩 (크기 다양함)
  const filters = [
    { label: 'JH필터 1', size: 13, color: palette.green700 },
    { label: 'JH필터 3', size: 13, color: palette.purple500 },
    { label: 'JH필터 5', size: 25, color: palette.blue700 },
    { label: 'JH필터 7', size: 32, color: '#a37116' },
  ];
  return (
    <View style={{ gap: 8 }}>
      {filters.map((f) => (
        <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 2,
            borderRadius: 99,
            backgroundColor: f.color + '20',
            minWidth: 70, alignItems: 'center',
          }}>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '800', color: f.color }}>
              {f.label}
            </T>
          </View>
          <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, color: '#888', fontWeight: '600' }}>
            영역 {f.size}개
          </T>
          <View style={{ flex: 1 }} />
          <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: palette.red500, fontWeight: '800' }}>
            {Math.floor(Math.random() * 3) + 1}개 출현
          </T>
        </View>
      ))}
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   미리보기 — 출현 분석 PRO
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewAppearance() {
  // mock — 3개 번호의 stat 카드 미리보기 (막대 + 임박도)
  const rows = [
    { n: 7, count: 172, ratio: 0.95, stars: 5, label: '🚨' },
    { n: 23, count: 156, ratio: 0.86, stars: 3, label: '🌙' },
    { n: 41, count: 148, ratio: 0.81, stars: 2, label: '🔥' },
  ];
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => (
        <View key={r.n} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T allowFontScaling={false} style={{ fontSize: 12, width: 16 }}>{r.label}</T>
          <Ball n={r.n} size="xs" />
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(127,127,127,0.18)', overflow: 'hidden' }}>
            <View style={{ width: `${r.ratio * 100}%`, height: '100%', backgroundColor: palette.blue500 }} />
          </View>
          <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: palette.blue700, fontWeight: '800', minWidth: 36 }}>
            {r.count}회
          </T>
          <T variant="caption2" allowFontScaling={false} style={{ fontSize: 9, color: palette.red500, fontWeight: '800' }}>
            {'★'.repeat(r.stars)}
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
    { label: '예상수 분석',     free: '10수',                pro: '20수 + 예상 제외수 3개' },
    { label: '회차 범위',       free: '5/10/15/20/30 고정', pro: '1~전체 자유 지정' },
    { label: '티어 분류',       free: '상위/하위 5',         pro: '4단계 + 시계열 추이' },
    { label: '궁합수 선택',     free: '1개만',               pro: '최대 5개 합산' },
    { label: '궁합 점수',       free: '단순 횟수',           pro: 'PRO 전용 점수 모델' },
    { label: '궁합 트리오',     free: '✗',                  pro: 'TOP 10' },
    { label: '안 어울리는 번호', free: 'BOTTOM 5',            pro: 'BOTTOM 5 (다중 번호)' },
    { label: '회귀 K 범위',     free: '1~100',               pro: '1~500' },
    { label: '회귀 TOP 10',    free: '✗',                  pro: '회귀률 + 연속 회귀' },
    { label: '분석법 비교',     free: '5종',                pro: '7종 (+끝수·시루)' },
    { label: '패턴 분석',       free: '4종 위치 패턴',       pro: 'JH필터 10종 + 종합' },
    { label: '출현 분석',       free: '히트맵',              pro: '추천 TOP 10 + 구간 추천' },
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
        <T variant="caption2" allowFontScaling={false} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: t.fgGold, fontWeight: '800' }}>PRO</T>
      </View>
      {rows.map((r, i) => (
        <View
          key={i}
          style={[styles.compRow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.borderDivider }]}
        >
          <T variant="caption1" color="primary" style={{ flex: 2, fontWeight: '600' }}>{r.label}</T>
          <T variant="caption1" color="tertiary" allowFontScaling={false} style={{ flex: 1, textAlign: 'center' }}>{r.free}</T>
          <T variant="caption1" allowFontScaling={false} style={{ flex: 1, textAlign: 'center', color: t.fgGold, fontWeight: '800' }}>{r.pro}</T>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: { borderRadius: radius.xl + 2, padding: 14 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
  },

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
