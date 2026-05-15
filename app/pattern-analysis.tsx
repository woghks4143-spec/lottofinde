/**
 * 패턴 분석 — /pattern-analysis
 *
 * 7x7 그리드 위에 1~45 번호를 배치하고 다양한 위치 패턴으로 분석한다.
 * 분석 대상 회차의 본번호가 각 패턴 "영역" 안에 있으면 빨강(본번호) / 파랑(보너스).
 *
 * 4가지 패턴:
 *   1) 모서리        — 7x7 그리드의 외각 가장자리 영역
 *   2) 보너스 가로세로 — 직전 회차 보너스의 행/열 영역
 *   3) 대각선         — NW-SE + NE-SW 두 대각선 영역
 *   4) 당첨 X자       — 직전 회차 본번호들의 X자(두 대각선) 영역을 모두 지운 후 살아남은 영역
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { useHistory } from '@/src/data/historyStore';
import type { Draw } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

type Pattern = 'overall' | 'corner' | 'bonus-cross' | 'diagonal' | 'x-pattern';

const TABS: { id: Pattern; label: string }[] = [
  { id: 'overall',     label: '종합' },
  { id: 'corner',      label: '모서리' },
  { id: 'bonus-cross', label: '보너스 가로세로' },
  { id: 'diagonal',    label: '대각선' },
  { id: 'x-pattern',   label: '당첨 X자' },
];

const PAST_WINDOW = 5;

// ─── 그리드 / 패턴 헬퍼 ──────────────────────────────────────────────────────

const COLS = 7;
const ROWS = 7;

/** 1~45 번호 → (row, col) 좌표. 1=(0,0), 7=(0,6), 8=(1,0), ..., 45=(6,3). */
function rowCol(n: number): [number, number] {
  return [Math.floor((n - 1) / COLS), (n - 1) % COLS];
}

/**
 * 모서리 영역.
 *   - 좌상 2x2 (1, 2, 8, 9)
 *   - 우상 2x2 (6, 7, 13, 14)
 *   - 좌하 2x2 (29, 30, 36, 37) + 마지막 행 미완 (43, 44, 45)
 *   - 우하 2x2 (34, 35, 41, 42)
 * 총 19개 셀.
 */
function cornerArea(): Set<number> {
  const set = new Set<number>();
  const addCell = (r: number, c: number) => {
    const n = r * COLS + c + 1;
    if (n >= 1 && n <= 45) set.add(n);
  };
  // 좌상 / 우상 2x2
  for (let r = 0; r <= 1; r++) {
    for (let c = 0; c <= 1; c++) addCell(r, c);
    for (let c = COLS - 2; c <= COLS - 1; c++) addCell(r, c);
  }
  // 좌하 / 우하 2x2 (rows 4~5)
  for (let r = ROWS - 3; r <= ROWS - 2; r++) {
    for (let c = 0; c <= 1; c++) addCell(r, c);
    for (let c = COLS - 2; c <= COLS - 1; c++) addCell(r, c);
  }
  // 마지막 행 (43, 44, 45)
  for (let c = 0; c < COLS; c++) addCell(ROWS - 1, c);
  return set;
}

/** 보너스 번호의 가로 행 + 세로 열 영역. */
function bonusCrossArea(bonus: number): Set<number> {
  const [br, bc] = rowCol(bonus);
  const set = new Set<number>();
  for (let n = 1; n <= 45; n++) {
    const [r, c] = rowCol(n);
    if (r === br || c === bc) set.add(n);
  }
  return set;
}

/** NW-SE + NE-SW 두 대각선 영역. */
function diagonalArea(): Set<number> {
  const set = new Set<number>();
  for (let n = 1; n <= 45; n++) {
    const [r, c] = rowCol(n);
    if (r === c || r + c === ROWS - 1) set.add(n);
  }
  return set;
}

/** 직전 회차 본번호들의 X자(두 대각선) 영역에 들어가는 셀들 (= "지워진" 셀). */
function xEliminated(prevNums: number[]): Set<number> {
  const set = new Set<number>();
  for (const num of prevNums) {
    const [r, c] = rowCol(num);
    for (let n = 1; n <= 45; n++) {
      const [nr, nc] = rowCol(n);
      if (nr - nc === r - c) set.add(n);       // NW-SE 대각선
      if (nr + nc === r + c) set.add(n);       // NE-SW 대각선
    }
  }
  return set;
}

/** X자 영역 후 살아남은 셀들 (= 다음 회차 후보 영역). */
function xSurvived(prevNums: number[]): Set<number> {
  const elim = xEliminated(prevNums);
  const set = new Set<number>();
  for (let n = 1; n <= 45; n++) if (!elim.has(n)) set.add(n);
  return set;
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

export default function PatternAnalysis() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const latestDraw = useHistory((s) => s.getLatest());
  const earliestRound = useHistory((s) => s.earliestRound);

  const upcomingRound = latestRound + 1;
  const [round, setRound] = useState<number>(upcomingRound);
  const [pattern, setPattern] = useState<Pattern>('corner');
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

  const past = useMemo(() => {
    const arr: Draw[] = [];
    const startRound = isUpcoming ? latestRound : round - 1;
    for (let r = startRound; r >= startRound - PAST_WINDOW + 1 && r >= earliestRound; r--) {
      const d = drawsMap[r];
      if (d) arr.push(d);
    }
    return arr;
  }, [drawsMap, round, isUpcoming, latestRound, earliestRound]);

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

  if (!target) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
        <AppBar title="패턴 분석" onBack={goBack} />
        <View style={styles.empty}>
          <T variant="body2r" color="tertiary">회차 데이터를 찾을 수 없어요.</T>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="패턴 분석" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* 분석 대상 hero */}
        <View style={[styles.targetCard, { backgroundColor: palette.neutral950 }]}>
          <View style={styles.targetHead}>
            <Pressable
              onPress={() => round > earliestRound && setRound(round - 1)}
              disabled={round <= earliestRound}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: 'rgba(255,255,255,0.10)',
                opacity: round <= earliestRound ? 0.3 : pressed ? 0.6 : 1,
              }]}
            >
              <T variant="label1n" style={{ color: '#fff', fontWeight: '800' }} allowFontScaling={false}>‹</T>
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              {isUpcoming ? (
                <View style={styles.upcomingPill}>
                  <T variant="caption2" style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 }} allowFontScaling={false}>
                    🔮 추첨 예정
                  </T>
                </View>
              ) : (
                <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)' }}>분석 대상</T>
              )}
              <T variant="title3" style={{ color: '#fff', fontWeight: '800', marginTop: 4 }}>
                제 {target.round}회
              </T>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                {target.date}{isUpcoming ? ' (예정)' : ''}
              </T>
            </View>
            <Pressable
              onPress={() => round < upcomingRound && setRound(round + 1)}
              disabled={round >= upcomingRound}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: 'rgba(255,255,255,0.10)',
                opacity: round >= upcomingRound ? 0.3 : pressed ? 0.6 : 1,
              }]}
            >
              <T variant="label1n" style={{ color: '#fff', fontWeight: '800' }} allowFontScaling={false}>›</T>
            </Pressable>
          </View>
          <View style={{ marginTop: 14, alignItems: 'center' }}>
            {isUpcoming ? (
              <View style={styles.upcomingNumsBox}>
                <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                  당첨번호 발표 전 — 직전 {latestRound}회 기반 패턴 영역 표시
                </T>
              </View>
            ) : (
              <BallRow nums={target.nums} bonus={target.bonus} size="md" />
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

        {/* 패턴 탭 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}
        >
          {TABS.map((tab) => {
            const on = pattern === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setPattern(tab.id)}
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
                  {tab.label}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>

        {pattern === 'overall' ? (
          <OverallView target={target} isUpcoming={isUpcoming} prevDraw={prevDraw} />
        ) : (
          <>
            {/* 패턴 설명 */}
            <PatternDescription pattern={pattern} />

            {/* 분석 대상 그리드 */}
            <PatternGridCard
              draw={target}
              isFocus
              isUpcoming={isUpcoming}
              areaOf={(d) => computeArea(pattern, d, prevDraw)}
            />

            {/* 과거 회차 그리드들 */}
            {past.map((d) => {
              const prevOfD = drawsMap[d.round - 1] ?? null;
              return (
                <PatternGridCard
                  key={d.round}
                  draw={d}
                  isFocus={false}
                  isUpcoming={false}
                  areaOf={() => computeArea(pattern, d, prevOfD)}
                />
              );
            })}
          </>
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

/** 현재 패턴에 따라 영역(Set<number>) 계산. */
function computeArea(pattern: Exclude<Pattern, 'overall'>, draw: Draw, prevDraw: Draw | null): Set<number> {
  switch (pattern) {
    case 'corner':
      return cornerArea();
    case 'bonus-cross':
      return prevDraw ? bonusCrossArea(prevDraw.bonus) : new Set();
    case 'diagonal':
      return diagonalArea();
    case 'x-pattern':
      return prevDraw ? xSurvived(prevDraw.nums) : new Set();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 종합 — 4개 패턴 결과를 한 곳에서. 보라 배경으로 다른 탭과 시각 차별.
// ═══════════════════════════════════════════════════════════════════════════
function OverallView({ target, isUpcoming, prevDraw }: {
  target: Draw; isUpcoming: boolean; prevDraw: Draw | null;
}) {
  const t = useTheme();
  const cornerNums = useMemo(() => [...cornerArea()].sort((a, b) => a - b), []);
  const bonusNums = useMemo(
    () => prevDraw ? [...bonusCrossArea(prevDraw.bonus)].sort((a, b) => a - b) : [],
    [prevDraw],
  );
  const diagonalNums = useMemo(() => [...diagonalArea()].sort((a, b) => a - b), []);
  const xSurvivedNums = useMemo(
    () => prevDraw ? [...xSurvived(prevDraw.nums)].sort((a, b) => a - b) : [],
    [prevDraw],
  );
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
          {target.round}회 4가지 패턴 결과
        </T>
      </View>

      <PatternCandidateCard label="모서리"          nums={cornerNums}    highlightSet={targetSet} tone="success" />
      <PatternCandidateCard label="보너스 가로세로"   nums={bonusNums}     highlightSet={targetSet} tone="accent" />
      <PatternCandidateCard label="대각선"           nums={diagonalNums}  highlightSet={targetSet} tone="purple" />
      <PatternCandidateCard label="당첨 X자"         nums={xSurvivedNums} highlightSet={targetSet} tone="warning" />
    </View>
  );
}

/** 패턴 후보 카드 — 영역 내 모든 셀 + 본번호 일치는 점선 강조. */
function PatternCandidateCard({ label, nums, highlightSet, tone }: {
  label: string; nums: number[];
  highlightSet: Set<number> | null;
  tone: 'success' | 'accent' | 'purple' | 'warning';
}) {
  const t = useTheme();
  const accent =
    tone === 'success' ? palette.green700 :
    tone === 'accent'  ? palette.blue700 :
    tone === 'purple'  ? palette.purple500 :
    /* warning */        '#a37116';
  const bg =
    tone === 'success' ? 'rgba(0,191,64,0.08)' :
    tone === 'accent'  ? 'rgba(0,102,255,0.08)' :
    tone === 'purple'  ? 'rgba(101,65,242,0.08)' :
    /* warning */        'rgba(255,193,7,0.12)';

  const hitCount = highlightSet ? nums.filter((n) => highlightSet.has(n)).length : null;

  return (
    <Card padding={12}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={[styles.cardLabel, { backgroundColor: bg }]}>
          <T variant="caption2" style={{ color: accent, fontWeight: '800', fontSize: 10.5 }} allowFontScaling={false}>
            {label}
          </T>
        </View>
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
          : nums.map((n) => <Ball key={n} n={n} size="sm" dashedRing={highlightSet?.has(n) ?? false} />)}
      </View>
    </Card>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function PatternDescription({ pattern }: { pattern: Pattern }) {
  const titles: Record<Pattern, string> = {
    'overall':     '종합 시트',
    'corner':      '모서리 패턴',
    'bonus-cross': '보너스 가로세로 패턴',
    'diagonal':    '대각선 패턴',
    'x-pattern':   '당첨 X자 패턴',
  };
  return (
    <View style={{ marginTop: 4, marginBottom: 4 }}>
      <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>{titles[pattern]}</T>
    </View>
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

/** 패턴 그리드 카드 — 7x7 셀. 영역 안 + 본번호 = 빨강 / 영역 안 + 보너스 = 파랑 / 영역 안 = 회색 outline / 그 외 = X 회색. */
function PatternGridCard({ draw, isFocus, isUpcoming, areaOf }: {
  draw: Draw;
  isFocus: boolean;
  isUpcoming: boolean;
  areaOf: (d: Draw) => Set<number>;
}) {
  const t = useTheme();
  const area = areaOf(draw);
  const mainSet = new Set(draw.nums);
  const isBonus = (n: number) => !isUpcoming && draw.bonus === n;

  // 영역 안에 들어간 본번호/보너스 카운트
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

/**
 * 7x7 그리드. 패턴 영역 셀은 **흰 테두리**로 강조하고, 본번호는 빨강 배경.
 * 영역 + 본번호가 겹치면 빨강 배경 + 흰 테두리 (가장 강한 강조).
 */
function Grid7x7({ area, mainSet, isBonus, hideMain }: {
  area: Set<number>;
  mainSet: Set<number>;
  isBonus: (n: number) => boolean;
  hideMain: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 3 }}>
      {Array.from({ length: ROWS }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: COLS }, (_, c) => {
            const n = r * COLS + c + 1;
            if (n > 45) {
              return <View key={c} style={[styles.gridCell, { backgroundColor: 'transparent', borderColor: 'transparent' }]} />;
            }

            const inArea = area.has(n);
            const isMain = !hideMain && mainSet.has(n);
            const isBon = !hideMain && isBonus(n);

            // 배경 색상: 본번호(빨강) > 보너스(파랑) > 영역만(옅은 흰) > 비활성
            let bg = 'transparent';
            let fg = t.fgTertiary;
            let weight: '600' | '800' = '600';
            if (isMain)      { bg = palette.red500;             fg = '#fff';      weight = '800'; }
            else if (isBon)  { bg = palette.blue500;            fg = '#fff';      weight = '800'; }
            else if (inArea) { bg = 'rgba(255,255,255,0.06)';   fg = t.fgPrimary; weight = '800'; }

            // 테두리: 영역 안이면 흰색 (본번호/보너스 위에 얹어져 강조)
            const border = inArea ? '#fff' : 'transparent';
            const borderW = inArea ? 1.5 : 0;

            return (
              <View
                key={c}
                style={[
                  styles.gridCell,
                  { backgroundColor: bg, borderColor: border, borderWidth: borderW },
                ]}
              >
                <T
                  variant="caption1"
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  targetCard: { borderRadius: radius.xl, padding: 18 },
  targetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navArrow: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  upcomingPill: {
    backgroundColor: palette.purple500,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  upcomingNumsBox: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
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

  // 종합 시트
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

  // 7x7 그리드 — 모바일에서 한 화면에 들어가도록 컴팩트하게
  gridCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },

  // 모달
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
