/**
 * PRO 패턴 분석 — /pro-pattern-analysis
 *
 * 11개 시트로 구성:
 *   - 종합: JH필터 1~10 결과를 한 곳에서
 *   - JH필터 1 ~ JH필터 10: 개별 필터 상세 (현재 회차 + 과거 5회차)
 *
 * 알고리즘 명세는 src/lib/jhFilters.ts에 격리되어 있으며 UI에는 절대 노출되지 않는다.
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { useProGuard } from '@/src/lib/useProGuard';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import type { Draw } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';
import {
  JH_FILTER_COUNT, jhFilterLabel,
  computeJhFilter, computeAllJhFilters,
} from '@/src/lib/jhFilters';

const GOLD = '#e8b04e';

const PAST_WINDOW = 5;

/** 시트 ID: 'overall' | 'jh-1' ~ 'jh-10' */
type SheetId = 'overall' | `jh-${number}`;

const SHEETS: { id: SheetId; label: string }[] = [
  { id: 'overall', label: '종합' },
  ...Array.from({ length: JH_FILTER_COUNT }, (_, i) => ({
    id: `jh-${i + 1}` as const,
    label: jhFilterLabel(i + 1),
  })),
];

/** JH필터 톤 — 10개 필터를 색상으로 구분. */
const FILTER_TONES = [
  palette.green700,   // 1
  palette.blue700,    // 2
  palette.purple500,  // 3
  '#a37116',          // 4 (gold)
  palette.green700,   // 5
  palette.blue700,    // 6
  palette.purple500,  // 7
  '#a37116',          // 8
  palette.green700,   // 9
  palette.blue700,    // 10
];

// ─── 메인 ────────────────────────────────────────────────────────────────────

export default function ProPatternAnalysis() {
  const isPro = useProGuard();
  const t = useTheme();
  const goBack = useSafeBack('/pro-analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const latestDraw = useHistory((s) => s.getLatest());
  const earliestRound = useHistory((s) => s.earliestRound);

  const upcomingRound = latestRound + 1;
  const [round, setRound] = useState<number>(upcomingRound);
  const [sheet, setSheet] = useState<SheetId>('overall');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInput, setPickerInput] = useState('');

  const isUpcoming = round === upcomingRound;

  const upcomingDate = useMemo(() => {
    if (!latestDraw) return null;
    const [y, m, day] = latestDraw.date.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, day + 7));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }, [latestDraw]);

  const target = useMemo(() => {
    if (isUpcoming) {
      return upcomingDate
        ? { round: upcomingRound, date: upcomingDate, nums: [] as number[], bonus: 0 }
        : null;
    }
    return drawsMap[round] ?? null;
  }, [isUpcoming, upcomingDate, upcomingRound, drawsMap, round]);

  const prevDraw = useMemo(() => {
    if (isUpcoming) return drawsMap[latestRound] ?? null;
    return drawsMap[round - 1] ?? null;
  }, [isUpcoming, drawsMap, latestRound, round]);

  const jumpTo = (n: number) => {
    const clamped = Math.max(earliestRound, Math.min(upcomingRound, Math.round(n)));
    setRound(clamped);
    setPickerOpen(false);
    setPickerInput('');
  };
  const submitPicker = () => {
    const n = parseInt(pickerInput.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(n)) return;
    jumpTo(n);
  };

  const titleNode = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon.crown color={GOLD} size={18} weight={2} />
      <T variant="heading1" color="primary">패턴 분석</T>
    </View>
  );

  if (!target) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
        <AppBar title={titleNode} onBack={goBack} />
        <View style={styles.empty}>
          <T variant="body2r" color="tertiary">회차 데이터를 찾을 수 없어요.</T>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title={titleNode} onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* 분석 대상 hero — 다른 PRO 화면들과 통일 디자인 */}
        <View style={[styles.targetCard, { backgroundColor: t.bgHero }]}>
          <View style={styles.targetHead}>
            <Pressable
              onPress={() => round > earliestRound && setRound(round - 1)}
              disabled={round <= earliestRound}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: t.bgOnHeroPill,
                opacity: round <= earliestRound ? 0.3 : pressed ? 0.7 : 1,
              }]}
            >
              <Icon.chevLeft color={t.fgOnHero} size={20} weight={2.5} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              {isUpcoming ? (
                <View style={styles.upcomingPill}>
                  <T variant="caption2" style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 }} allowFontScaling={false}>
                    🔮 추첨 예정
                  </T>
                </View>
              ) : (
                <T variant="caption1" style={{ color: t.fgOnHeroMuted }}>분석 대상</T>
              )}
              <T variant="title3" style={{ color: t.fgOnHero, fontWeight: '800', marginTop: 4 }}>
                제 {target.round}회
              </T>
              <T variant="caption1" style={{ color: t.fgOnHeroFaint, marginTop: 2 }}>
                {target.date}{isUpcoming ? ' (예정)' : ''}
              </T>
            </View>
            <Pressable
              onPress={() => round < upcomingRound && setRound(round + 1)}
              disabled={round >= upcomingRound}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: t.bgOnHeroPill,
                opacity: round >= upcomingRound ? 0.3 : pressed ? 0.7 : 1,
              }]}
            >
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <Icon.chevLeft color={t.fgOnHero} size={20} weight={2.5} />
              </View>
            </Pressable>
          </View>
          <View style={{ marginTop: 14, alignItems: 'center' }}>
            {isUpcoming ? (
              <View style={[styles.upcomingNumsBox, { backgroundColor: t.bgOnHeroPill, borderColor: t.borderOnHero }]}>
                <T variant="label1n" style={{ color: t.fgOnHero, textAlign: 'center', fontWeight: '700' }}>
                  당첨번호 발표 전
                </T>
              </View>
            ) : (
              <BallRow nums={target.nums} bonus={target.bonus} size="sm" style={{ gap: 4 }} />
            )}
          </View>
        </View>

        {/* 빠른 회차 이동 */}
        <View style={styles.jumpRow}>
          <JumpBtn
            label={`최신 ${latestRound}회`}
            active={round === latestRound}
            onPress={() => setRound(latestRound)}
          />
          <JumpBtn
            label={`분석 ${upcomingRound}회`}
            active={round === upcomingRound}
            onPress={() => setRound(upcomingRound)}
            tone="upcoming"
          />
          <JumpBtn
            label="회차 입력"
            active={false}
            onPress={() => { setPickerInput(String(round)); setPickerOpen(true); }}
            tone="input"
          />
        </View>

        {/* 시트 탭 (가로 스크롤) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}
        >
          {SHEETS.map((s) => {
            const on = sheet === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSheet(s.id)}
                style={({ pressed }) => [
                  styles.tabBtn,
                  {
                    backgroundColor: on ? t.bgAccent : t.bgSurface,
                    borderColor: on ? 'transparent' : t.borderWeak,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <T variant="caption1" style={{ color: on ? '#fff' : t.fgSecondary, fontWeight: '700' }}>
                  {s.label}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 시트 본문 */}
        {sheet === 'overall' ? (
          <OverallView target={target} isUpcoming={isUpcoming} prevDraw={prevDraw} />
        ) : (
          <FilterDetailView
            filterId={parseInt(sheet.slice(3), 10)}
            target={target}
            isUpcoming={isUpcoming}
            prevDraw={prevDraw}
            round={round}
            drawsMap={drawsMap}
            latestRound={latestRound}
            earliestRound={earliestRound}
          />
        )}

        <Disclaimer short />
      </ScrollView>

      {/* 회차 점프 모달 */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.modalWrap} pointerEvents="box-none">
          <View style={[styles.modalSheet, { backgroundColor: t.bgSurface }]}>
            <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>회차로 이동</T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
              {earliestRound}회 ~ {upcomingRound}회 (분석 예정 포함)
            </T>
            <View style={[styles.pickerRow, { borderColor: t.borderNormal, backgroundColor: t.bgSurface2 }]}>
              <TextInput
                value={pickerInput}
                onChangeText={(v) => setPickerInput(v.replace(/[^0-9]/g, '').slice(0, 5))}
                onSubmitEditing={submitPicker}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder={`회차 수 입력 (예: ${latestRound})`}
                placeholderTextColor={t.fgTertiary}
                style={[styles.pickerInput, { color: t.fgPrimary }]}
                returnKeyType="go"
              />
              <Pressable
                onPress={submitPicker}
                style={({ pressed }) => [styles.goBtn, { backgroundColor: palette.blue500, opacity: pressed ? 0.85 : 1 }]}
              >
                <T variant="label1n" style={{ color: '#fff', fontWeight: '800' }} allowFontScaling={false}>이동</T>
              </Pressable>
            </View>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={6} style={{ marginTop: 12, alignSelf: 'center' }}>
              <T variant="caption1" color="tertiary" style={{ fontWeight: '600' }}>취소</T>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 종합 — JH필터 1~10 결과를 한 곳에서.
// ═══════════════════════════════════════════════════════════════════════════
function OverallView({ target, isUpcoming, prevDraw }: {
  target: Draw; isUpcoming: boolean; prevDraw: Draw | null;
}) {
  const results = useMemo(() => computeAllJhFilters(prevDraw), [prevDraw]);
  const targetSet = isUpcoming ? null : new Set(target.nums);

  return (
    <View style={[styles.overallWrap, { backgroundColor: 'rgba(101,65,242,0.10)', borderColor: 'rgba(101,65,242,0.30)' }]}>
      <View style={styles.overallHead}>
        <View style={[styles.overallBadge, { backgroundColor: palette.purple500 }]}>
          <T variant="caption2" style={{ color: '#fff', fontWeight: '800', fontSize: 10.5, letterSpacing: 0.4 }} allowFontScaling={false}>
            🎯 종합 시트
          </T>
        </View>
        <T variant="label1n" color="primary" style={{ fontWeight: '800', marginTop: 6 }}>
          {target.round}회 JH필터 10종 결과
        </T>
      </View>

      {results.map((r, i) => (
        <FilterCard
          key={r.id}
          label={r.label}
          nums={r.nums}
          highlightSet={targetSet}
          accent={FILTER_TONES[i]}
        />
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 개별 JH필터 상세 — 7x7 그리드 시각화 + 현재 회차 + 과거 5회차.
// ═══════════════════════════════════════════════════════════════════════════
function FilterDetailView({
  filterId, target, isUpcoming, prevDraw, round, drawsMap, latestRound, earliestRound,
}: {
  filterId: number;
  target: Draw;
  isUpcoming: boolean;
  prevDraw: Draw | null;
  round: number;
  drawsMap: Record<number, Draw>;
  latestRound: number;
  earliestRound: number;
}) {
  const targetArea = useMemo(() => new Set(computeJhFilter(filterId, prevDraw)), [filterId, prevDraw]);

  // 과거 5회차 결과 (각각의 영역 + 해당 회차 본번호)
  const pastResults = useMemo(() => {
    const arr: { draw: Draw; area: Set<number> }[] = [];
    const startR = isUpcoming ? latestRound : round - 1;
    for (let r = startR; r >= startR - PAST_WINDOW + 1 && r >= earliestRound; r--) {
      const d = drawsMap[r];
      const prev = drawsMap[r - 1] ?? null;
      if (!d) continue;
      arr.push({ draw: d, area: new Set(computeJhFilter(filterId, prev)) });
    }
    return arr;
  }, [filterId, round, isUpcoming, latestRound, earliestRound, drawsMap]);

  return (
    <View style={{ gap: 10 }}>
      {/* 시트 라벨 */}
      <View style={{ marginTop: 4, marginBottom: 4 }}>
        <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
          {jhFilterLabel(filterId)}
        </T>
      </View>

      {/* 분석 대상 회차 (포커스 강조) */}
      <FilterGridCard draw={target} area={targetArea} isFocus isUpcoming={isUpcoming} />

      {/* 과거 회차들 */}
      {pastResults.map(({ draw, area }) => (
        <FilterGridCard key={draw.round} draw={draw} area={area} isFocus={false} isUpcoming={false} />
      ))}
    </View>
  );
}

/** 필터 그리드 카드 — 7x7 셀. 영역 안 + 본번호 = 빨강 / 영역 안 + 보너스 = 파랑 / 영역만 = 흰 테두리. */
function FilterGridCard({ draw, area, isFocus, isUpcoming }: {
  draw: Draw;
  area: Set<number>;
  isFocus: boolean;
  isUpcoming: boolean;
}) {
  const mainSet = new Set(draw.nums);
  const isBonus = (n: number) => !isUpcoming && draw.bonus === n;

  const matchedMain = isUpcoming ? 0 : draw.nums.filter((n) => area.has(n)).length;
  const matchedBonus = !isUpcoming && draw.bonus && area.has(draw.bonus) ? 1 : 0;

  return (
    <Card padding={14} style={isFocus ? { borderColor: palette.blue500, borderWidth: 1.5 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {isFocus && <T variant="caption1" style={{ color: palette.blue700, fontWeight: '800' }}>분석 대상</T>}
        <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{draw.round}회</T>
        <T variant="caption1" color="tertiary">{draw.date}{isUpcoming && isFocus ? ' (예정)' : ''}</T>
        <View style={{ flex: 1 }} />
        {!isUpcoming && (matchedMain + matchedBonus > 0 ? (
          <T variant="caption1" style={{ color: palette.red500, fontWeight: '800' }}>
            {matchedMain}개{matchedBonus > 0 ? ' + 보너스' : ''} 출현
          </T>
        ) : (
          <T variant="caption2" color="tertiary" style={{ fontSize: 10.5 }}>출현 없음</T>
        ))}
      </View>
      <Grid7x7 area={area} mainSet={mainSet} isBonus={isBonus} hideMain={isUpcoming} />
    </Card>
  );
}

/** 7x7 그리드. 영역 셀은 흰 테두리, 본번호는 빨강 배경, 보너스는 파랑 배경. */
function Grid7x7({ area, mainSet, isBonus, hideMain }: {
  area: Set<number>;
  mainSet: Set<number>;
  isBonus: (n: number) => boolean;
  hideMain: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 3 }}>
      {Array.from({ length: 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: 7 }, (_, c) => {
            const n = r * 7 + c + 1;
            if (n > 45) {
              return <View key={c} style={[styles.gridCell, { backgroundColor: 'transparent', borderColor: 'transparent' }]} />;
            }

            const inArea = area.has(n);
            const isMain = !hideMain && mainSet.has(n);
            const isBon = !hideMain && isBonus(n);

            // 배경: 본번호(빨강) > 보너스(파랑) > 영역만(연한 보라) > 비활성
            let bg: string = 'transparent';
            let fg = t.fgTertiary;
            let weight: '600' | '800' = '600';
            if (isMain)      { bg = palette.red500;                 fg = '#fff';            weight = '800'; }
            else if (isBon)  { bg = palette.blue500;                fg = '#fff';            weight = '800'; }
            else if (inArea) { bg = 'rgba(101,65,242,0.08)';        fg = palette.purple500; weight = '800'; }

            // 테두리: 예상수(inArea) 셀은 보라 보더로 강조 (라이트/다크 모두 또렷이 보임).
            // 적중(본번호/보너스가 inArea와 겹친 경우) 보더를 더 두껍게 → "이 번호가
            // 예상에서 나왔다"는 시각적 강조.
            const isHit = inArea && (isMain || isBon);
            let borderColor: string = 'transparent';
            let borderW = 0;
            if (isHit)        { borderColor = palette.purple500; borderW = 2.5; }
            else if (inArea)  { borderColor = palette.purple500; borderW = 1.8; }

            return (
              <View
                key={c}
                style={[
                  styles.gridCell,
                  { backgroundColor: bg, borderColor, borderWidth: borderW },
                ]}
              >
                <T
                  variant="caption1"
                  compact
                  style={{ color: fg, fontWeight: weight, fontSize: 13 }}
                  allowFontScaling={false}
                >
                  {n}
                </T>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── 공통 카드 ──────────────────────────────────────────────────────────────

function FilterCard({ label, subLabel, nums, highlightSet, accent, focus, hitOverride, bonusForLabel }: {
  label: string;
  subLabel?: string;
  nums: number[];
  highlightSet: Set<number> | null;
  accent: string;
  focus?: boolean;
  hitOverride?: number;
  bonusForLabel?: number;
}) {
  const t = useTheme();
  const bg = accent + '15';

  const hitCount = hitOverride ?? (
    highlightSet ? nums.filter((n) => highlightSet.has(n)).length : null
  );

  return (
    <Card padding={12} style={focus ? { borderColor: accent, borderWidth: 1.5 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <View style={[styles.cardLabel, { backgroundColor: bg }]}>
          <T variant="caption2" style={{ color: accent, fontWeight: '800', fontSize: 10.5 }} allowFontScaling={false}>
            {label}
          </T>
        </View>
        {subLabel ? (
          <T variant="caption1" color="tertiary" style={{ fontSize: 11 }}>{subLabel}</T>
        ) : null}
        <View style={{ flex: 1 }} />
        {hitCount != null ? (
          hitCount > 0 ? (
            <T variant="caption1" style={{ color: palette.red500, fontWeight: '800' }}>
              {hitCount}개 출현
            </T>
          ) : (
            <T variant="caption2" color="tertiary" style={{ fontSize: 10.5 }}>출현 없음</T>
          )
        ) : (
          <T variant="caption1" style={{ color: accent, fontWeight: '800' }}>{nums.length}개</T>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {nums.length === 0
          ? <T variant="caption1" color="tertiary" style={{ fontStyle: 'italic' }}>영역 없음</T>
          : nums.map((n) => (
              <Ball
                key={n}
                n={n}
                size="sm"
                dashedRing={highlightSet?.has(n) ?? false}
              />
            ))}
      </View>
    </Card>
  );
}

function JumpBtn({ label, active, onPress, tone }: {
  label: string; active: boolean; onPress: () => void;
  tone?: 'upcoming' | 'input';
}) {
  const t = useTheme();
  const activeBg = tone === 'upcoming' ? palette.purple500 : palette.blue500;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.jumpBtn,
        {
          backgroundColor: active ? activeBg : t.bgSurface,
          borderColor: active ? 'transparent' : t.borderWeak,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <T variant="caption1" style={{ color: active ? '#fff' : t.fgSecondary, fontWeight: '700' }} allowFontScaling={false}>
        {label}
      </T>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  targetCard: { borderRadius: radius.xl, padding: 18 },
  targetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // 회차 이동 버튼 — 둥근 사각형 + Icon.chevLeft (다른 PRO 화면들과 통일)
  navArrow: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  upcomingPill: {
    backgroundColor: palette.purple500,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  // "당첨번호 발표 전" 박스 — bg/borderColor는 인라인 (t.bgOnHeroPill/borderOnHero)
  upcomingNumsBox: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    width: '100%',
  },

  jumpRow: {
    flexDirection: 'row',
    gap: 6,
  },
  jumpBtn: {
    flex: 1,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabBtn: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  overallWrap: {
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 10,
  },
  overallHead: {
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  overallBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  cardLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },

  gridCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xl,
    padding: 20,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  pickerInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 8,
    outlineStyle: 'none' as any,
  },
  goBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
