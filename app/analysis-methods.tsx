/**
 * 분석법 비교 — /analysis-methods
 *
 * 추첨 예정 회차(latestRound + 1)를 기본으로 분석한다. 사용자가 좌측 화살표로
 * 과거 회차로 이동하면 그 회차에 대한 분석을 볼 수 있다.
 *
 * 탭:
 *   1) 종합     — 직전 회차 기반의 "다음 회차 예상 후보" 또는 실제 매칭 결과
 *   2) 이월수    — 직전 회차 본번호가 이번에 다시 나왔는지
 *   3) 이웃수    — 직전 회차 본번호의 ±1이 이번에 나왔는지
 *   4) 보수(45-N) — 직전 회차 본번호의 45-N이 이번에 나왔는지 (사진 형식의 표)
 *   5) AC값      — 추첨된 회차의 본번호 흩어진 정도 (예정 회차엔 N/A)
 *
 * (소수·합성수, 배수, 동일날짜는 별도 페이지)
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
import { intersect, neighborsOf, type Draw } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

type Method = 'overall' | 'same-date' | 'carry-over' | 'neighbor' | 'complement';

const TABS: { id: Method; label: string }[] = [
  { id: 'overall',    label: '종합' },
  { id: 'same-date',  label: '동일날짜' },
  { id: 'carry-over', label: '이월수' },
  { id: 'neighbor',   label: '이웃수' },
  { id: 'complement', label: '-45 분석' },
];

const PAST_WINDOW = 10; // 보수 분석 사진처럼 과거 10회차 표시

export default function AnalysisMethods() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const latestDraw = useHistory((s) => s.getLatest());
  const earliestRound = useHistory((s) => s.earliestRound);

  const upcomingRound = latestRound + 1;
  const [round, setRound] = useState<number>(upcomingRound);
  const [method, setMethod] = useState<Method>('overall');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInput, setPickerInput] = useState('');

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

  const isUpcoming = round === upcomingRound;

  /** 추첨 예정 회차의 예상 추첨일 (직전 + 7일, UTC 안전). */
  const upcomingDate = useMemo(() => {
    if (!latestDraw) return null;
    const [y, m, day] = latestDraw.date.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, day + 7));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }, [latestDraw]);

  /** 분석 대상 (예정이면 virtual draw). */
  const target = useMemo(() => {
    if (isUpcoming) {
      return upcomingDate
        ? { round: upcomingRound, date: upcomingDate, nums: [] as number[], bonus: 0 }
        : null;
    }
    return drawsMap[round] ?? null;
  }, [isUpcoming, upcomingDate, upcomingRound, drawsMap, round]);

  /** 직전 회차 (이월·이웃·보수 비교 기준). 예정 회차면 = latestRound. */
  const prevDraw = useMemo(() => {
    if (isUpcoming) return drawsMap[latestRound] ?? null;
    return drawsMap[round - 1] ?? null;
  }, [isUpcoming, drawsMap, latestRound, round]);

  /** 과거 N개 회차 (보수 분석 표용). 분석 대상의 직전 회차부터. */
  const past = useMemo(() => {
    const arr: Draw[] = [];
    const startRound = isUpcoming ? latestRound : round - 1;
    for (let r = startRound; r >= startRound - PAST_WINDOW + 1 && r >= earliestRound; r--) {
      const d = drawsMap[r];
      if (d) arr.push(d);
    }
    return arr;
  }, [drawsMap, round, isUpcoming, latestRound, earliestRound]);

  /** 분석 대상의 동일날짜 과거 회차들 (종합 탭에서도 사용). */
  const sameDate = useMemo<Draw[]>(() => {
    if (!target) return [];
    const [, mm, dd] = target.date.split('-');
    const out: Draw[] = [];
    for (let r = round - 1; r >= earliestRound; r--) {
      const d = drawsMap[r];
      if (!d) continue;
      const parts = d.date.split('-');
      if (parts[1] === mm && parts[2] === dd) out.push(d);
    }
    return out;
  }, [target, drawsMap, round, earliestRound]);

  const goPrev = () => { if (round > earliestRound) setRound(round - 1); };
  const goNext = () => { if (round < upcomingRound) setRound(round + 1); };

  if (!target) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
        <AppBar title="분석법 비교" onBack={goBack} />
        <View style={styles.empty}>
          <T variant="body2r" color="tertiary">회차 데이터를 찾을 수 없어요.</T>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="분석법 비교" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* 분석 대상 hero */}
        <View style={[styles.targetCard, { backgroundColor: palette.neutral950 }]}>
          <View style={styles.targetHead}>
            <Pressable
              onPress={goPrev}
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
              onPress={goNext}
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
                <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 18 }}>
                  당첨번호 발표 전 — 직전 {latestRound}회 기반 예상 후보 분석
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

        {/* 분석법 탭 (가로 스크롤) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}
        >
          {TABS.map((tab) => {
            const on = method === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setMethod(tab.id)}
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

        {/* 분석법별 view */}
        {method === 'overall' && (
          <OverallView target={target} isUpcoming={isUpcoming} prevDraw={prevDraw} sameDate={sameDate} />
        )}
        {method === 'same-date' && <SameDateView target={target} isUpcoming={isUpcoming} drawsMap={drawsMap} earliestRound={earliestRound} round={round} />}
        {method === 'carry-over' && <CarryOverView target={target} isUpcoming={isUpcoming} prevDraw={prevDraw} past={past} drawsMap={drawsMap} />}
        {method === 'neighbor' && <NeighborView target={target} isUpcoming={isUpcoming} prevDraw={prevDraw} past={past} drawsMap={drawsMap} />}
        {method === 'complement' && <ComplementView target={target} isUpcoming={isUpcoming} prevDraw={prevDraw} past={past} drawsMap={drawsMap} />}

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

// ═══════════════════════════════════════════════════════════════════════════
// 종합 — 4개 분석법 후보. 추첨 후 회차면 당첨된 번호는 점선 강조.
// ═══════════════════════════════════════════════════════════════════════════
function OverallView({ target, isUpcoming, prevDraw, sameDate }: {
  target: Draw; isUpcoming: boolean; prevDraw: Draw | null; sameDate: Draw[];
}) {
  // 이월수 후보
  const carryCands = useMemo(
    () => prevDraw ? [...prevDraw.nums].sort((a, b) => a - b) : [],
    [prevDraw],
  );
  // 이웃수 후보
  const neighborCands = useMemo(() => {
    if (!prevDraw) return [];
    const set = new Set<number>();
    for (const n of prevDraw.nums) {
      if (n > 1) set.add(n - 1);
      if (n < 45) set.add(n + 1);
    }
    for (const n of prevDraw.nums) set.delete(n);
    return [...set].sort((a, b) => a - b);
  }, [prevDraw]);
  // -45 후보
  const complementCands = useMemo(() => {
    if (!prevDraw) return [];
    const set = new Set<number>();
    for (const n of [...prevDraw.nums, prevDraw.bonus]) {
      const c = 45 - n;
      if (c >= 1 && c <= 45) set.add(c);
    }
    return [...set].sort((a, b) => a - b);
  }, [prevDraw]);
  // 동일날짜 후보 (과거 동일날짜 회차들의 본번호 union — 중복 제거)
  const sameDateCands = useMemo(() => {
    const set = new Set<number>();
    for (const d of sameDate) for (const n of d.nums) set.add(n);
    return [...set].sort((a, b) => a - b);
  }, [sameDate]);

  // 분석 대상이 추첨된 회차이면 본번호와 일치한 후보를 강조
  const targetSet = isUpcoming ? null : new Set(target.nums);

  if (!prevDraw) {
    return (
      <Card padding={20}>
        <T variant="caption1" color="tertiary" style={{ textAlign: 'center' }}>
          직전 회차 데이터가 없어 후보를 계산할 수 없어요.
        </T>
      </Card>
    );
  }

  return (
    <View style={[styles.overallWrap, { backgroundColor: 'rgba(101,65,242,0.10)', borderColor: 'rgba(101,65,242,0.30)' }]}>
      <View style={styles.overallHead}>
        <View style={[styles.overallBadge, { backgroundColor: palette.purple500 }]}>
          <T variant="caption2" style={{ color: '#fff', fontWeight: '800', fontSize: 10.5, letterSpacing: 0.4 }} allowFontScaling={false}>
            🎯 종합 시트
          </T>
        </View>
        <T variant="label1n" color="primary" style={{ fontWeight: '800', marginTop: 6 }}>
          {target.round}회 4가지 분석 결과
        </T>
      </View>

      <CandidateCard label="이월수"     nums={carryCands}      highlightSet={targetSet} tone="success" />
      <CandidateCard label="이웃수"     nums={neighborCands}   highlightSet={targetSet} tone="accent" />
      <CandidateCard label="-45 분석"   nums={complementCands} highlightSet={targetSet} tone="purple" />
      <CandidateCard label="동일날짜"   nums={sameDateCands}   highlightSet={targetSet} tone="warning" />
    </View>
  );
}

/** 후보 카드 — highlightSet 안의 번호는 점선 강조 + 우측 "N개 출현" 카운트. */
function CandidateCard({ label, nums, highlightSet, tone }: {
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
          ? <T variant="caption1" color="tertiary" style={{ fontStyle: 'italic' }}>후보 없음</T>
          : nums.map((n) => <Ball key={n} n={n} size="sm" dashedRing={highlightSet?.has(n) ?? false} />)}
      </View>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 동일날짜 — 같은 양력 월/일에 추첨된 과거 회차
// ═══════════════════════════════════════════════════════════════════════════
function SameDateView({ target, isUpcoming, drawsMap, earliestRound, round }: {
  target: Draw; isUpcoming: boolean; drawsMap: Record<number, Draw>; earliestRound: number; round: number;
}) {
  const t = useTheme();
  const sameDate = useMemo(() => {
    const [, mm, dd] = target.date.split('-');
    const out: Draw[] = [];
    for (let r = round - 1; r >= earliestRound; r--) {
      const d = drawsMap[r];
      if (!d) continue;
      const parts = d.date.split('-');
      if (parts[1] === mm && parts[2] === dd) out.push(d);
    }
    return out;
  }, [target.date, drawsMap, round, earliestRound]);

  const targetSet = isUpcoming ? null : new Set(target.nums);

  // 총 일치 (중복 제거) — 분석 대상 본번호가 과거 동일날짜 회차들에 나온 unique 개수
  const totalUniqueHits = useMemo(() => {
    if (!targetSet) return 0;
    const matched = new Set<number>();
    for (const d of sameDate) {
      for (const n of d.nums) if (targetSet.has(n)) matched.add(n);
    }
    return matched.size;
  }, [targetSet, sameDate]);

  return (
    <View style={{ gap: 10 }}>
      <SectionTitle
        title="동일날짜 분석"
        sub={`양력 ${target.date.slice(5).replace('-', '월 ')}일에 추첨된 이전 회차 ${sameDate.length}개`}
      />
      {targetSet && sameDate.length > 0 && (
        <View style={[styles.totalHitsBox, { backgroundColor: palette.softFill, borderColor: t.borderWeak }]}>
          <View style={{ flex: 1 }}>
            <T variant="caption1" color="tertiary">전체 동일날짜 회차에서</T>
            <T variant="label1n" color="primary" style={{ fontWeight: '700', marginTop: 2 }}>
              총 {totalUniqueHits}개 출현 (중복 제거)
            </T>
          </View>
          <View style={[styles.totalHitsPill, { backgroundColor: palette.red500 }]}>
            <T variant="label1n" style={{ color: '#fff', fontWeight: '900' }} allowFontScaling={false}>
              {totalUniqueHits} / {target.nums.length}
            </T>
          </View>
        </View>
      )}
      {sameDate.length === 0 ? (
        <Card padding={20}>
          <T variant="caption1" color="tertiary" style={{ textAlign: 'center' }}>
            같은 날짜에 추첨된 과거 회차가 없어요.
          </T>
        </Card>
      ) : (
        sameDate.map((d) => {
          const hits = targetSet ? d.nums.filter((n) => targetSet.has(n)) : [];
          return (
            <PastAnalysisRow
              key={d.round}
              round={d.round}
              date={d.date}
              comparedTo={null}
              displayNums={d.nums}
              highlightSet={new Set(hits)}
              count={hits.length}
            />
          );
        })
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 이월수 / 이웃수 (분석 대상 + 과거 회차 표)
// ═══════════════════════════════════════════════════════════════════════════
function CarryOverView({ target, isUpcoming, prevDraw, past, drawsMap }: {
  target: Draw; isUpcoming: boolean; prevDraw: Draw | null; past: Draw[]; drawsMap: Record<number, Draw>;
}) {
  return (
    <View style={{ gap: 10 }}>
      <SectionTitle title="이월수 분석" sub="직전 회차 본번호가 다음 회차에 다시 나왔는지" />
      {isUpcoming ? (
        prevDraw && (
          <CandidateCard
            label={`${target.round}회 이월수 후보`}
            sub={`${prevDraw.round}회 본번호 그대로`}
            nums={[...prevDraw.nums].sort((a, b) => a - b)}
            tone="success"
          />
        )
      ) : (
        <FocusCard
          round={target.round}
          date={target.date}
          nums={target.nums}
          compareRound={prevDraw?.round ?? null}
          highlightSet={new Set(prevDraw ? intersect(target.nums, prevDraw.nums) : [])}
          count={prevDraw ? intersect(target.nums, prevDraw.nums).length : 0}
        />
      )}
      {past.map((d) => {
        const prevD = drawsMap[d.round - 1];
        if (!prevD) return null;
        const carry = intersect(d.nums, prevD.nums);
        return (
          <PastAnalysisRow
            key={d.round}
            round={d.round}
            date={d.date}
            comparedTo={prevD.round}
            displayNums={d.nums}
            highlightSet={new Set(carry)}
            count={carry.length}
          />
        );
      })}
    </View>
  );
}

function NeighborView({ target, isUpcoming, prevDraw, past, drawsMap }: {
  target: Draw; isUpcoming: boolean; prevDraw: Draw | null; past: Draw[]; drawsMap: Record<number, Draw>;
}) {
  const neighborCands = useMemo(() => {
    if (!prevDraw) return [];
    const set = new Set<number>();
    for (const n of prevDraw.nums) {
      if (n > 1) set.add(n - 1);
      if (n < 45) set.add(n + 1);
    }
    for (const n of prevDraw.nums) set.delete(n);
    return [...set].sort((a, b) => a - b);
  }, [prevDraw]);

  return (
    <View style={{ gap: 10 }}>
      <SectionTitle title="이웃수 분석" sub="직전 회차 본번호의 ±1이 다음 회차에 나왔는지" />
      {isUpcoming ? (
        prevDraw && (
          <CandidateCard
            label={`${target.round}회 이웃수 후보`}
            sub={`${prevDraw.round}회 본번호의 ±1`}
            nums={neighborCands}
            tone="accent"
          />
        )
      ) : (
        <FocusCard
          round={target.round}
          date={target.date}
          nums={target.nums}
          compareRound={prevDraw?.round ?? null}
          highlightSet={new Set(prevDraw ? neighborsOf(target.nums, prevDraw, false).filter((n) => !intersect(target.nums, prevDraw.nums).includes(n)) : [])}
          count={prevDraw ? neighborsOf(target.nums, prevDraw, false).filter((n) => !intersect(target.nums, prevDraw.nums).includes(n)).length : 0}
        />
      )}
      {past.map((d) => {
        const prevD = drawsMap[d.round - 1];
        if (!prevD) return null;
        const carry = intersect(d.nums, prevD.nums);
        const neighbors = neighborsOf(d.nums, prevD, false).filter((n) => !carry.includes(n));
        return (
          <PastAnalysisRow
            key={d.round}
            round={d.round}
            date={d.date}
            comparedTo={prevD.round}
            displayNums={d.nums}
            highlightSet={new Set(neighbors)}
            count={neighbors.length}
          />
        );
      })}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 보수 (45 - N) — 사진 형식의 표
// ═══════════════════════════════════════════════════════════════════════════
function ComplementView({ target, isUpcoming, prevDraw, past, drawsMap }: {
  target: Draw; isUpcoming: boolean; prevDraw: Draw | null; past: Draw[]; drawsMap: Record<number, Draw>;
}) {
  // -45 후보: 직전 회차 본번호+보너스의 45-N (1~45 범위만)
  const complementCands = useMemo(() => {
    if (!prevDraw) return [];
    const set = new Set<number>();
    for (const n of [...prevDraw.nums, prevDraw.bonus]) {
      const c = 45 - n;
      if (c >= 1 && c <= 45) set.add(c);
    }
    return [...set].sort((a, b) => a - b);
  }, [prevDraw]);

  // 분석 대상이 실제 회차일 때: 직전 회차 -45 값 중 이번 회차에 나온 것
  const targetComplements = useMemo(() => {
    if (!prevDraw || isUpcoming) return [];
    const pool = new Set<number>();
    for (const n of [...prevDraw.nums, prevDraw.bonus]) {
      const c = 45 - n;
      if (c >= 1 && c <= 45) pool.add(c);
    }
    return target.nums.filter((n) => pool.has(n));
  }, [prevDraw, target, isUpcoming]);

  return (
    <View style={{ gap: 10 }}>
      <SectionTitle
        title="-45 분석"
        sub="직전 회차 본번호+보너스의 45-N이 다음 회차에 나왔는지"
      />
      {isUpcoming ? (
        prevDraw && (
          <CandidateCard
            label={`${target.round}회 -45 후보`}
            sub={`${prevDraw.round}회 본번호+보너스의 45-N`}
            nums={complementCands}
            tone="purple"
          />
        )
      ) : (
        <FocusCard
          round={target.round}
          date={target.date}
          nums={target.nums}
          compareRound={prevDraw?.round ?? null}
          highlightSet={new Set(targetComplements)}
          count={targetComplements.length}
        />
      )}
      {past.map((d) => {
        const prevD = drawsMap[d.round - 1];
        if (!prevD) return null;
        // d 회차의 -45 후보 (= d-1회차 본번호+보너스의 45-N) 중 d 회차에 실제 나온 것
        const pool = new Set<number>();
        for (const n of [...prevD.nums, prevD.bonus]) {
          const c = 45 - n;
          if (c >= 1 && c <= 45) pool.add(c);
        }
        const hits = d.nums.filter((n) => pool.has(n));
        return (
          <PastAnalysisRow
            key={d.round}
            round={d.round}
            date={d.date}
            comparedTo={prevD.round}
            displayNums={d.nums}
            highlightSet={new Set(hits)}
            count={hits.length}
          />
        );
      })}
    </View>
  );
}

// ─── Shared subcomponents ───────────────────────────────────────────────────

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>{title}</T>
      <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>{sub}</T>
    </View>
  );
}

function FocusCard({
  round, date, nums, compareRound, highlightSet, count,
}: {
  round: number;
  date: string;
  nums: number[];
  compareRound: number | null;
  highlightSet: Set<number>;
  /** 일치(점선 강조) 개수 */
  count: number;
}) {
  return (
    <Card padding={14} style={{ borderColor: palette.blue500, borderWidth: 1.5 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T variant="caption1" style={{ color: palette.blue700, fontWeight: '800' }}>분석 대상</T>
        <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{round}회</T>
        <T variant="caption1" color="tertiary">{date}</T>
        {compareRound != null && (
          <T variant="caption2" color="tertiary" style={{ fontSize: 10.5 }}>vs {compareRound}회</T>
        )}
        <View style={{ flex: 1 }} />
        <T variant="label1n" style={{ color: palette.blue700, fontWeight: '800' }}>{count}개 출현</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
        {nums.map((n, i) => (
          <Ball key={`${n}-${i}`} n={n} size="sm" dashedRing={highlightSet.has(n)} />
        ))}
      </View>
    </Card>
  );
}

/** 과거 회차 1행 — 회차 헤더 + Ball 그리드 + 우측 "N개 출현". */
function PastAnalysisRow({ round, date, comparedTo, displayNums, highlightSet, count }: {
  round: number;
  date: string;
  comparedTo: number | null;
  displayNums: number[];
  highlightSet: Set<number>;
  count: number;
}) {
  const t = useTheme();
  return (
    <View style={[styles.pastRow, { borderColor: t.borderDivider, backgroundColor: t.bgSurface }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{round}회</T>
        <T variant="caption1" color="tertiary">{date}</T>
        {comparedTo != null && (
          <T variant="caption2" color="tertiary" style={{ fontSize: 10.5 }}>vs {comparedTo}회</T>
        )}
        <View style={{ flex: 1 }} />
        {count > 0 ? (
          <T variant="caption1" style={{ color: palette.red500, fontWeight: '800' }}>{count}개 출현</T>
        ) : (
          <T variant="caption2" color="tertiary" style={{ fontSize: 10.5 }}>출현 없음</T>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {displayNums.map((n, i) => (
          <Ball key={`${n}-${i}`} n={n} size="sm" dashedRing={highlightSet.has(n)} />
        ))}
      </View>
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

  tabBtn: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 빠른 회차 점프
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

  // 회차 점프 모달
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

  // 동일날짜 총 일치
  totalHitsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  totalHitsPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },

  notice: {
    padding: 12,
    borderRadius: radius.md,
  },

  cardLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },

  // 종합 시트 (분석법 비교) — 패턴 분석과 동일 디자인
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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
  },

  pastRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },

});
