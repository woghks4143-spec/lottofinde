/**
 * PRO 조합 생성 — /pro-gen
 *
 * PRO 조합 생성 영역의 카탈로그 페이지. 각 카드는 풍부한 미리보기 + 디테일 페이지 연결.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';
import { useHistory } from '@/src/data/historyStore';
import { fetchPoolState, type PoolState } from '@/src/lib/firebase';
import { getDayStatus, POOL_SIZE_DISPLAY } from '@/src/lib/jachanism';

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

        {/* Hero — 콤팩트 */}
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
                프로페셔널 조합 엔진
              </T>
              <T variant="caption1" style={{ color: t.fgOnHeroMuted, marginTop: 4, fontSize: 12 }}>
                자동 분석 · 다중 필터 · 분석 합성
              </T>
            </View>
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

        {/* ─── 1. 귀찮이즘 조합 (PRO 전용) ─────────────────────── */}
        <ProFeatureCard
          emoji="✨"
          tag="PRO"
          title="귀찮이즘 조합"
          fromFree="— (PRO 전용)"
          desc={
            "분석이 귀찮은 분을 위한 PRO 멤버십 전용 기능. 매주 자동 분석으로 50조합을 받을 수 있어요. " +
            "수 10시 ~ 토 20시 받기 가능 · 전 세계 사용자 중복 X · 토요일 추첨 후 등수 자동 표시. (참고용 — 당첨 보장 X)"
          }
          preview={<PreviewJachanism />}
          onPress={() => router.push('/pro-jachanism' as any)}
        />

        {/* ─── 2. 조합 필터링 (PRO) ─────────────────────────────── */}
        <ProFeatureCard
          emoji="🎛️"
          tag="PRO"
          title="조합 필터링"
          fromFree="조합 필터링"
          desc={
            "다양한 PRO 필터를 그룹(번호·합계와 비율·연속과 끝수·수학 속성·회차 관계)으로 묶어 정밀하게 조합 추출. " +
            "단계별 후보 감소를 깔때기로 시각화하고, 합계/끝수합 범위는 슬라이더 또는 직접 입력으로 정밀 설정. " +
            "평균치 자동 적용 + 무제한 프리셋 저장으로 매주 같은 조건 즉시 재사용."
          }
          preview={<PreviewFilter />}
          onPress={() => router.push('/pro-filter' as any)}
        />

        {/* ─── 3. 핀더분석 조합 (PRO) ──────────────────────────── */}
        <ProFeatureCard
          emoji="🔮"
          tag="PRO"
          title="핀더분석 조합"
          fromFree="— (PRO 전용)"
          desc={
            "사용자가 직접 1~45 번호에서 예상수/고정수/제외수를 고르고, PRO 분석 결과(출현·패턴·예상수·궁합·회귀)를 필터(N~M개 포함) 조건으로 적용해 추출. " +
            "분석을 풀에 합치는 게 아니라 정밀한 조건 필터로 사용하기 때문에 결과가 매번 일관됨."
          }
          preview={<PreviewFinderCombo />}
          onPress={() => router.push('/pro-finder-combo' as any)}
        />

        {/* 비교표 */}
        <ComparisonTable />

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   미리보기 — 귀찮이즘 조합 (주간 사이클)
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewJachanism() {
  const t = useTheme();
  const latestRound = useHistory((s) => s.latestRound);
  const targetRound = latestRound + 1;

  // 요일 기반 상태 — 수요일 이전(locked)이면 풀 정보 표시 안 함
  // 개발 모드는 잠금 우회 (테스트용)
  const realDayStatus = getDayStatus();
  const dayStatus = __DEV__ && realDayStatus === 'locked' ? 'active' : realDayStatus;
  const canShowPool = dayStatus !== 'locked';

  // 실시간 풀 상태 (수요일 이후만 fetch)
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  useEffect(() => {
    if (!targetRound || !canShowPool) return;
    let cancelled = false;
    fetchPoolState(targetRound)
      .then((s) => { if (!cancelled && s) setPoolState(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [targetRound, canShowPool]);

  const days = [
    { d: '일', state: '분석', color: palette.purple500 },
    { d: '월', state: '대기', color: '#999' },
    { d: '화', state: '대기', color: '#999' },
    { d: '수', state: '받기', color: palette.green700, active: true },
    { d: '목', state: '받기', color: palette.green700, active: true },
    { d: '금', state: '받기', color: palette.green700, active: true },
    { d: '토', state: '추첨', color: palette.red500 },
  ];

  const total = poolState?.total ?? 0;
  const consumed = poolState?.consumed ?? 0;
  const remaining = Math.max(0, total - consumed);
  const pct = total > 0 ? Math.min(100, (consumed / total) * 100) : 0;
  const isHot = total > 0 && remaining < total * 0.5;

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 10 }}>
        {days.map((d) => (
          <View
            key={d.d}
            style={[
              styles.dayChip,
              {
                backgroundColor: d.active ? d.color + '20' : t.bgSurface,
                borderColor: d.active ? d.color : t.borderDivider,
                borderWidth: d.active ? 1.5 : 1,
              },
            ]}
          >
            <T
              variant="caption2"
              allowFontScaling={false}
              style={{ fontSize: 10, fontWeight: '800', color: d.active ? d.color : '#888' }}
            >
              {d.d}
            </T>
            <T
              variant="caption2"
              allowFontScaling={false}
              style={{ fontSize: 8, color: d.active ? d.color : '#aaa', marginTop: 1 }}
            >
              {d.state}
            </T>
          </View>
        ))}
      </View>

      {/* 풀 정보 — 수요일 이후만 실시간 표시 */}
      {canShowPool && total > 0 ? (
        <View style={[styles.poolPreview, { backgroundColor: GOLD + '12', borderColor: GOLD }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, color: t.fgGold, fontWeight: '800' }}>
              🎁 이번주 남은 조합
            </T>
            {isHot && (
              <View style={{ backgroundColor: 'rgba(255,66,66,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 }}>
                <T variant="caption2" allowFontScaling={false} style={{ color: palette.red500, fontWeight: '800', fontSize: 9 }}>
                  ⚡ 빠르게 발급 중
                </T>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
            <T variant="label1n" allowFontScaling={false} style={{ color: t.fgGold, fontWeight: '900', fontSize: 20 }}>
              {remaining.toLocaleString('ko')}
            </T>
            <T variant="caption2" allowFontScaling={false} style={{ color: t.fgGold, opacity: 0.6, marginLeft: 4, fontSize: 11 }}>
              / {total.toLocaleString('ko')}
            </T>
            <T variant="caption2" allowFontScaling={false} style={{ marginLeft: 'auto', color: t.fgGold, fontSize: 10, opacity: 0.7 }}>
              {consumed.toLocaleString('ko')}개 발급
            </T>
          </View>
          {/* Progress bar */}
          <View style={{ marginTop: 6, height: 4, borderRadius: 2, backgroundColor: GOLD + '30', overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(2, pct)}%`, height: '100%', backgroundColor: GOLD, borderRadius: 2 }} />
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <T allowFontScaling={false} style={{ fontSize: 13 }}>✨</T>
        <T variant="caption2" allowFontScaling={false} style={{ fontSize: 11, color: t.fgGold, fontWeight: '800' }}>
          50조합 / 주
        </T>
        <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, color: '#888' }}>
          · {canShowPool ? '사람마다 다른 조합 보장' : `${POOL_SIZE_DISPLAY} 조합 풀에서`}
        </T>
      </View>
    </View>
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
   미리보기 — 핀더분석 조합
   ═══════════════════════════════════════════════════════════════════════════ */

function PreviewFinderCombo() {
  // mock — 분석 선택 + 가중치 합쳐진 풀 미리보기
  const sources = [
    { label: '추천 TOP 10', selected: true, color: palette.blue500 },
    { label: 'JH필터 3', selected: true, color: palette.purple500 },
    { label: '이월수', selected: true, color: GOLD },
    { label: '회귀 분석', selected: false, color: '#888' },
  ];
  // 가상의 풀 (중복 가중치 시각화)
  const poolNums = [
    { n: 7, w: 3 },
    { n: 12, w: 2 },
    { n: 18, w: 1 },
    { n: 23, w: 2 },
    { n: 33, w: 1 },
    { n: 41, w: 1 },
  ];
  return (
    <View style={{ gap: 8 }}>
      {/* 선택 체크박스 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {sources.map((s) => (
          <View
            key={s.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 99,
              backgroundColor: s.selected ? s.color + '20' : 'transparent',
              borderWidth: 1,
              borderColor: s.selected ? s.color : 'rgba(127,127,127,0.25)',
            }}
          >
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 9, fontWeight: '900', color: s.selected ? s.color : '#999' }}>
              {s.selected ? '✓' : '○'}
            </T>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '700', color: s.selected ? s.color : '#888' }}>
              {s.label}
            </T>
          </View>
        ))}
      </View>
      {/* 풀 미리보기 (가중치 ×N) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '700', color: '#888' }}>
          풀:
        </T>
        {poolNums.map((p) => (
          <View key={p.n} style={{ position: 'relative' }}>
            <Ball n={p.n} size="xs" />
            {p.w > 1 && (
              <View style={{
                position: 'absolute',
                top: -3, right: -3,
                backgroundColor: palette.red500,
                borderRadius: 6,
                paddingHorizontal: 3,
                paddingVertical: 0,
                minWidth: 12,
                alignItems: 'center',
              }}>
                <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 7, fontWeight: '900' }}>
                  ×{p.w}
                </T>
              </View>
            )}
          </View>
        ))}
      </View>
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
    { label: '조합 생성 도구',    free: '랜덤·가중·통계 등', pro: '귀찮이즘 · 필터링 · 핀더분석' },
    { label: '주간 자동 분석',    free: '✗',                pro: '귀찮이즘 조합 50개/주' },
    { label: '필터 그룹',         free: '제한적',            pro: '5그룹 다중 필터' },
    { label: '회차 관계 필터',     free: '이월수만',          pro: '다양한 회차 관계' },
    { label: '깔때기 시각화',     free: '✗',                pro: '✓' },
    { label: '핀더분석 조합',     free: '✗',                pro: '다중 분석 합성 추출' },
    { label: '프리셋 저장',       free: '✗',                pro: '∞ 무제한' },
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

  hero: {
    borderRadius: radius.xl + 2,
    padding: 14,
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

  // 귀찮이즘 풀 미리보기 — FOMO 카드
  poolPreview: {
    marginTop: 4,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },

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

  dayChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
