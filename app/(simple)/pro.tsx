/**
 * PRO 탭 — 카탈로그 메인.
 *
 * 12개 PRO 기능을 한 화면에서 발견할 수 있는 카탈로그.
 * 각 카드는 "← 일반: XX" 매핑으로 "이게 업그레이드된 기능이구나"를 즉시 알려준다.
 *
 *   히어로 (👑 골드 + 다크) → 가치 칩 → 조합 생성 6개 → 번호 분석 6개 → 비교표
 *
 * 카드 탭 → 해당 기능의 디테일 페이지 (/pro-ai 등)
 * 섹션 헤더 우상단 "자세히 보기 →" → 카탈로그 깊이 페이지 (/pro-gen, /pro-analysis)
 */
import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import { useJachanism } from '@/src/store/jachanism';
import {
  POOL_SIZE_DISPLAY, USER_LIMIT, BACKTEST_BASE_N,
  computeBacktest,
  getDayStatus, msToNextReceive, formatCountdown, fmtCount,
  type JachanismStatus,
} from '@/src/lib/jachanism';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

// ─── PRO 골드 톤 ─────────────────────────────────────────────────
const GOLD = '#e8b04e';
const GOLD_SOFT = '#fff4dc';
const GOLD_DARK = '#a37116';

type Feature = {
  emoji: string;
  title: string;
  subtitle: string;
  fromFree: string;
  tag: string;
  href: string;
};

const GEN_FEATURES: Feature[] = [
  { emoji: '✨', title: '귀찮이즘 조합', subtitle: '주간 자동 분석 50조합 (수~토 받기)', fromFree: '— (PRO 전용)', tag: 'PRO', href: '/pro-jachanism' },
  { emoji: '🎛️', title: '조합 필터링',  subtitle: '5그룹 다중 필터로 정밀하게 조합 추출', fromFree: '조합 필터링',  tag: 'PRO', href: '/pro-filter' },
  { emoji: '🔮', title: '핀더분석 조합', subtitle: '원하는 분석 결과만 골라서 조합 추출',  fromFree: '— (PRO 전용)', tag: 'PRO', href: '/pro-finder-combo' },
];

const ANALYSIS_FEATURES: Feature[] = [
  { emoji: '🌟', title: '핀더 예상 제외수',  subtitle: '핀더 예상 20수 + 예상 제외수 3개 + 적중 분포',     fromFree: '예상수 10수 분석', tag: 'PRO', href: '/pro-predict' },
  { emoji: '📊', title: '주간 출현',    subtitle: '회차 범위 자유 + 4단계 티어 + 시계열 추이',   fromFree: '특정 주간 출현',  tag: 'PRO', href: '/pro-weekly' },
  { emoji: '🤝', title: '궁합수',       subtitle: '다중 번호 + 짝궁 TOP 10 + 안 어울리는 BOTTOM 5 + 트리오', fromFree: '궁합수 분석',     tag: 'PRO', href: '/pro-compat' },
  { emoji: '🔁', title: '회귀분석',     subtitle: '회귀률 TOP 10 + 최근 연속 회귀 TOP 10 (탭 전환)', fromFree: '회귀 분석',   tag: 'PRO', href: '/pro-regression' },
  { emoji: '🧪', title: '분석법 비교',  subtitle: '종합·동일날짜·이월수·이웃수·-45 + 끝수·시루', fromFree: '분석법 비교',    tag: 'PRO', href: '/pro-analysis-methods' },
  { emoji: '🎯', title: '패턴 분석',    subtitle: 'JH필터 10종 + 종합 시트 · 회차별 결과 비교',           fromFree: '패턴 분석',      tag: 'PRO', href: '/pro-pattern-analysis' },
  { emoji: '🎨', title: '출현 분석',    subtitle: '1~45번 출현 통계 · 주기·빈도·구간 분석',                fromFree: '출현 분석',      tag: 'PRO', href: '/pro-appearance-stats' },
];

export default function Pro() {
  const t = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon.crown color={GOLD} size={20} weight={2} />
            <T variant="heading1" color="primary">PRO</T>
            <View style={[styles.previewPill, { backgroundColor: palette.green500 }]}>
              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 9.5, fontWeight: '800' }}>
                미리보기
              </T>
            </View>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}>

        {/* Premium Hero */}
        <PremiumHero scheme={t.scheme} />

        {/* 활성화 상태 배너 */}
        <View style={[styles.statusBanner, { backgroundColor: 'rgba(0,191,64,0.08)', borderColor: 'rgba(0,191,64,0.3)' }]}>
          <Icon.check color={palette.green700} size={14} weight={2.8} />
          <T variant="caption1" style={{ color: palette.green700, fontWeight: '800', marginLeft: 6 }} allowFontScaling={false}>
            모든 PRO 기능 활성화됨 · 미리보기 모드
          </T>
        </View>

        {/* ─── 조합 생성 섹션 ─────────────────────────────────── */}
        <SectionHeader
          emoji="🎰"
          title="조합 생성"
          count={GEN_FEATURES.length}
          onMore={() => router.push('/pro-gen' as any)}
        />
        <View style={{ gap: 8 }}>
          {GEN_FEATURES.map((f) => (
            f.href === '/pro-jachanism' ? (
              <JachanismCard key={f.href} onPress={() => router.push(f.href as any)} />
            ) : (
              <ProFeatureRow key={f.href} feature={f} onPress={() => router.push(f.href as any)} />
            )
          ))}
        </View>

        {/* ─── 번호 분석 섹션 ─────────────────────────────────── */}
        <SectionHeader
          emoji="📊"
          title="번호 분석"
          count={ANALYSIS_FEATURES.length}
          onMore={() => router.push('/pro-analysis' as any)}
        />
        <View style={{ gap: 8 }}>
          {ANALYSIS_FEATURES.map((f) => (
            <ProFeatureRow key={f.href} feature={f} onPress={() => router.push(f.href as any)} />
          ))}
        </View>

        {/* ─── 무료 vs PRO 비교 ─────────────────────────────── */}
        <Card padding={18} style={{ marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon.crown color={GOLD} size={18} weight={2} />
            <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
              무료 vs PRO 한눈에
            </T>
          </View>
          <T variant="caption1" color="tertiary" style={{ marginBottom: 12 }}>
            무엇이 달라지는지 비교
          </T>
          <CompareTable t={t} />
        </Card>

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Premium Hero — 다크 배경 + 부드러운 호흡 골드 후광
   ═══════════════════════════════════════════════════════════════════════════ */

function PremiumHero({ scheme }: { scheme: 'light' | 'dark' }) {
  const isLight = scheme === 'light';

  // 라이트 모드: 샴페인 크림 / 다크 모드: 웜 차콜
  const heroBg = isLight ? '#f4ead4' : '#1c1814';
  const titleColor = isLight ? '#2c2316' : '#ffffff';
  const bodyColor = isLight ? 'rgba(58, 47, 30, 0.72)' : 'rgba(255,255,255,0.65)';
  const goldText = isLight ? '#a37116' : GOLD;
  const dividerColor = isLight ? 'rgba(163,113,22,0.18)' : 'rgba(232,176,78,0.18)';

  return (
    <View style={[styles.hero, { backgroundColor: heroBg }]}>
      {/* 정적 골드 워시 */}
      <View
        style={[
          styles.heroGoldWash,
          { backgroundColor: GOLD, opacity: isLight ? 0.10 : 0.07 },
        ]}
      />

      {/* 상단: PREMIUM 배지 + 타이틀 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={[
            styles.crownWrapCompact,
            isLight && {
              backgroundColor: 'rgba(232,176,78,0.22)',
              borderColor: 'rgba(163,113,22,0.45)',
            },
          ]}
        >
          <Icon.crown color={isLight ? '#a37116' : GOLD} size={20} weight={2} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="caption2" allowFontScaling={false} style={{ color: goldText, letterSpacing: 2.5, fontWeight: '800', fontSize: 9.5 }}>
            PREMIUM
          </T>
          <T variant="headline1" style={{ color: titleColor, fontWeight: '900', marginTop: 1, letterSpacing: -0.3 }}>
            전문가용 분석 스튜디오
          </T>
        </View>
      </View>

      {/* 하단: 기능 칩 */}
      <View style={styles.valueChipsCompact}>
        <ValueChip emoji="📊" label="정밀" lightMode={isLight} />
        <ValueChip emoji="∞" label="무제한" lightMode={isLight} />
        <ValueChip emoji="🔍" label="회차자유" lightMode={isLight} />
        <ValueChip emoji="🎯" label="백테스트" lightMode={isLight} />
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   섹션 헤더 — "🎰 조합 생성" + 우측 "자세히 보기 →"
   ═══════════════════════════════════════════════════════════════════════════ */

function SectionHeader({ emoji, title, count, onMore }: {
  emoji: string;
  title: string;
  count: number;
  onMore: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <T allowFontScaling={false} style={{ fontSize: 22 }}>{emoji}</T>
        <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>
          {title}
        </T>
        <T variant="caption1" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 11 }}>
          {count}개 기능
        </T>
      </View>
      <Pressable onPress={onMore} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
        <T variant="caption1" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800' }}>
          자세히 →
        </T>
      </Pressable>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRO 기능 행 — 좌측 골드 보더 + 이모지 + 제목 + 태그 + 부제 + ← 일반: XX
   ═══════════════════════════════════════════════════════════════════════════ */

function ProFeatureRow({ feature, onPress }: { feature: Feature; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <View style={[styles.featRow, { backgroundColor: t.bgSurface, borderColor: t.borderDivider }]}>
        {/* 좌측 골드 보더 — 4px */}
        <View style={[styles.featBorder, { backgroundColor: GOLD }]} />

        {/* 이모지 박스 */}
        <View style={[styles.featIcon, { backgroundColor: GOLD_SOFT }]}>
          <T allowFontScaling={false} style={{ fontSize: 22 }}>{feature.emoji}</T>
        </View>

        {/* 콘텐츠 */}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <T variant="headline2" color="primary" style={{ fontWeight: '800' }} numberOfLines={1}>
              {feature.title}
            </T>
            <View style={[styles.featTag, { backgroundColor: GOLD }]}>
              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 9 }}>
                {feature.tag}
              </T>
            </View>
          </View>
          <T variant="caption1" color="secondary" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={1}>
            {feature.subtitle}
          </T>
        </View>

        {/* Chev */}
        <Icon.chev color={GOLD} size={16} weight={2.2} />
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   귀찮이즘 조합 카드 — 카탈로그에서 바로 상태 + 30회 결과 + 풀 정보 확인
   ═══════════════════════════════════════════════════════════════════════════ */

function JachanismCard({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  const latestRound = useHistory((s) => s.latestRound);
  const drawsMap = useHistory((s) => s.draws);
  const targetRound = latestRound + 1;
  const entry = useJachanism((s) => s.weekly[targetRound]);
  const backtest = useJachanism((s) => s.backtest);
  const computing = useJachanism((s) => s.computing);
  const setBacktest = useJachanism((s) => s.setBacktest);
  const setComputing = useJachanism((s) => s.setComputing);

  // 캐시가 없으면 카탈로그에서도 백테스트 트리거 (computing 플래그로 중복 방지)
  useEffect(() => {
    if (!latestRound) return;
    if (backtest && backtest.latestRound === latestRound) return;
    if (computing) return;
    let cancelled = false;
    (async () => {
      setComputing(true);
      try {
        const stats = await computeBacktest(drawsMap, latestRound, BACKTEST_BASE_N);
        if (!cancelled) setBacktest({ latestRound, ...stats });
      } catch {
        if (!cancelled) setComputing(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestRound]);

  const status: JachanismStatus = useMemo(() => {
    if (drawsMap[targetRound]) return 'done';
    return getDayStatus();
  }, [drawsMap, targetRound]);

  const countdown = useMemo(() => {
    if (status !== 'locked') return null;
    const ms = msToNextReceive();
    return ms != null ? formatCountdown(ms) : null;
  }, [status]);

  const statsReady = backtest != null && backtest.latestRound === latestRound;

  // 상태별 표시
  const statusInfo = useMemo(() => {
    if (status === 'done') {
      return { label: '🎉 결과 보기', bg: palette.red500 + '20', color: palette.red500 };
    }
    if (status === 'drawing') {
      return { label: '⏳ 추첨 진행', bg: '#ea580c20', color: '#ea580c' };
    }
    if (status === 'active') {
      if (entry) {
        return { label: '✅ 받기 완료', bg: palette.blue700 + '20', color: palette.blue700 };
      }
      return { label: '✨ 받기 가능', bg: palette.green700 + '20', color: palette.green700 };
    }
    // locked
    return { label: `🔒 ${countdown ?? '대기'}`, bg: '#88888820', color: '#888' };
  }, [status, entry, countdown]);

  // 등수별 색상
  const rankColors = [palette.red500, '#ea580c', GOLD_DARK, palette.blue700, palette.green700];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <View style={[styles.jachanCard, { backgroundColor: t.bgSurface, borderColor: t.borderDivider }]}>
        {/* 좌측 골드 보더 */}
        <View style={[styles.featBorder, { backgroundColor: GOLD }]} />

        {/* 헤더 — 아이콘 + 제목 + 상태 칩 */}
        <View style={styles.jachanHeader}>
          <View style={[styles.featIcon, { backgroundColor: GOLD_SOFT }]}>
            <T allowFontScaling={false} style={{ fontSize: 22 }}>✨</T>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <T variant="headline2" color="primary" style={{ fontWeight: '800' }}>
                귀찮이즘 조합
              </T>
              <View style={[styles.featTag, { backgroundColor: GOLD }]}>
                <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 9 }}>
                  PRO
                </T>
              </View>
            </View>
            <T variant="caption1" color="secondary" style={{ fontSize: 12, lineHeight: 16, marginTop: 2 }}>
              주간 자동 분석 50조합 · 수~토 받기
            </T>
          </View>
          <View style={[styles.statusChip, { backgroundColor: statusInfo.bg }]}>
            <T variant="caption2" allowFontScaling={false} style={{ color: statusInfo.color, fontWeight: '800', fontSize: 10 }}>
              {statusInfo.label}
            </T>
          </View>
        </View>

        {/* 30회 결과 — 실측 또는 분석 중 */}
        <View style={[styles.jachanStats, { borderTopColor: t.borderDivider }]}>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '700', marginBottom: 6 }}>
            📊 최근 {BACKTEST_BASE_N}회 분석 결과 {statsReady ? '(실측)' : ''}
          </T>
          {statsReady && backtest ? (
            <View style={styles.rankMiniRow}>
              {[backtest.rank1, backtest.rank2, backtest.rank3, backtest.rank4, backtest.rank5].map((count, i) => (
                <View key={i} style={[styles.rankMini, { backgroundColor: rankColors[i] + '15' }]}>
                  <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: rankColors[i], fontWeight: '700' }}>
                    {i + 1}등
                  </T>
                  <T
                    variant="caption2"
                    allowFontScaling={false}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    style={{ fontSize: 11, color: rankColors[i], fontWeight: '900', marginTop: 2 }}
                  >
                    {fmtCount(count)}
                  </T>
                </View>
              ))}
            </View>
          ) : (
            <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, paddingVertical: 8 }}>
              과거 회차 백테스트 분석 중... 페이지 진입 시 자동 완료
            </T>
          )}
        </View>

        {/* 풀 정보 — 한 줄 */}
        <View style={styles.jachanInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
            <T allowFontScaling={false} style={{ fontSize: 11 }}>👤</T>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, color: t.fgSecondary, fontWeight: '600' }}>
              최대 {USER_LIMIT}조합/주
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <T allowFontScaling={false} style={{ fontSize: 11 }}>📦</T>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, color: GOLD_DARK, fontWeight: '800' }}>
              {POOL_SIZE_DISPLAY}
            </T>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 9.5, color: t.fgTertiary, marginLeft: 2 }}>
              조합 풀
            </T>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   가치 칩 — 히어로 안의 4개 칩
   ═══════════════════════════════════════════════════════════════════════════ */

function ValueChip({ emoji, label, lightMode }: { emoji: string; label: string; lightMode?: boolean }) {
  return (
    <View
      style={[
        styles.valueChip,
        lightMode && {
          backgroundColor: 'rgba(163, 113, 22, 0.10)',
          borderColor: 'rgba(163, 113, 22, 0.28)',
        },
      ]}
    >
      <T allowFontScaling={false} style={{ fontSize: 12 }}>{emoji}</T>
      <T
        variant="caption2"
        allowFontScaling={false}
        style={{
          color: lightMode ? '#5a4a30' : '#fff',
          fontWeight: '700',
          fontSize: 10.5,
          marginLeft: 4,
        }}
      >
        {label}
      </T>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   무료 vs PRO 비교표
   ═══════════════════════════════════════════════════════════════════════════ */

function CompareTable({ t }: { t: ReturnType<typeof useTheme> }) {
  const rows: { label: string; free: string; pro: string }[] = [
    { label: '조합 생성 도구',    free: '1개',          pro: '3개' },
    { label: '번호 분석 도구',    free: '5개',          pro: '7개' },
    { label: '귀찮이즘 조합',     free: '✗',           pro: '주간 50조합' },
    { label: '핀더분석 조합',     free: '✗',           pro: '다중 분석 합성' },
    { label: '회귀 분석 범위',    free: '1~100',        pro: '1~500' },
    { label: '회차 이동 분석',    free: '제한',         pro: '전 회차 자유' },
    { label: '예상 제외수',       free: '✗',           pro: '✓' },
    { label: 'JH필터 패턴',       free: '✗',           pro: '10종' },
    { label: '실측 백테스트',     free: '제한',         pro: '30~100회' },
  ];

  return (
    <View>
      <View style={[styles.compHead, { borderBottomColor: t.borderDivider }]}>
        <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ flex: 2, fontSize: 11 }}>기능</T>
        <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>무료</T>
        <T variant="caption2" allowFontScaling={false} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: GOLD_DARK, fontWeight: '800' }}>
          PRO
        </T>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  previewPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },

  // ── Premium Hero ───────────────────────────────────────────
  hero: {
    borderRadius: radius.xl + 4,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  /** 정적 골드 워시 — 우측 상단에 은은하게 비추는 라운드 그라데이션. */
  heroGoldWash: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  crownWrap: {
    width: 78,
    height: 78,
    borderRadius: 24,
    backgroundColor: 'rgba(232,176,78,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(232,176,78,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 10,
  },
  crownWrapCompact: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(232,176,78,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(232,176,78,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
  },
  valueChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 18,
    justifyContent: 'center',
  },
  valueChipsCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 10,
  },
  valueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(232,176,78,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(232,176,78,0.35)',
  },

  // ── 활성화 배너 ───────────────────────────────────────────
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  // ── 섹션 헤더 ─────────────────────────────────────────────
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 2,
  },

  // ── PRO 기능 행 ──────────────────────────────────────────
  // ── 귀찮이즘 카드 (확장형) ───────────────────────────
  jachanCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: 12,
  },
  jachanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 14,
    paddingRight: 12,
    paddingBottom: 12,
    gap: 12,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  jachanStats: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  rankMiniRow: {
    flexDirection: 'row',
    gap: 4,
  },
  rankMini: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: radius.sm,
    minHeight: 44,
  },
  jachanInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 8,
  },

  featRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 14,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 12,
  },
  featBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  featIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
  },

  // ── 비교표 ───────────────────────────────────────────────
  compHead: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  compRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    alignItems: 'center',
  },
});
