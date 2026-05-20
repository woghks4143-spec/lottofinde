/**
 * PRO 회귀 분석 — /pro-regression
 *
 * 무료 모드의 "K=N 회귀에서 어느 번호 몇 개 이월" 리스트에 두 가지 PRO 랭킹 추가.
 * 두 랭킹은 한 카드에서 탭으로 전환.
 *
 *   1. 📊 회귀률 TOP 10
 *        — K=1..100 중 평균 이월률(%) 가장 높은 K 순위
 *   2. 🔥 최근 연속 회귀 TOP 10
 *        — K=1..100 중 최근 가장 길게 연속으로 이월이 발생 중인 K 순위
 *
 *   둘 다 행 탭으로 즉시 해당 K 선택 가능.
 *
 *   3. 📋 회차별 상세 리스트 — 무료 버전과 동일
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import type { Draw } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const GOLD = '#e8b04e';
const GOLD_DARK = '#a37116';
const PURPLE = palette.purple500;

const QUICK_KS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MAX_K = 500;                // PRO 모드는 최대 500회귀까지
const RATE_RANK_RANGE = 500;      // K값 랭킹 — 1~500 중 TOP 10
const PICKER_PAGES = 5;           // 모달은 100씩 5페이지 (1-100, 101-200, ...)
const DETAIL_LIMIT = 100;         // 회차별 상세 — 최근 100회 (perf 안전)

// 우연 기대 이월 개수 = 6 × (6/45) ≈ 0.8개
const EXPECTED_OVERLAP = 6 * 6 / 45;

export default function ProRegression() {
  const t = useTheme();
  const goBack = useSafeBack('/pro-analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);

  const [k, setK] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPage, setPickerPage] = useState(0); // 0=1-100, 1=101-200, ..., 4=401-500
  const [rankTab, setRankTab] = useState<'rate' | 'streak'>('rate');

  // 분석 대상 회차 — 선택한 회차의 시점에서 K-회귀 분석을 본다.
  // 기본값: latestRound (가장 최근 데이터). 사용자가 과거 회차로 이동하면
  // 그 회차 시점의 회귀률 / 최근 연속 회귀 / 회차별 상세가 재계산됨.
  const upcomingRound = latestRound + 1;
  const [round, setRound] = useState<number>(latestRound);
  const [roundPickerOpen, setRoundPickerOpen] = useState(false);
  const [roundPickerInput, setRoundPickerInput] = useState('');
  const isUpcoming = round === upcomingRound;
  // 분석에 쓸 "효과적인" 최신 회차 — 예정 회차 선택 시엔 latestRound 데이터까지 사용
  const effectiveRound = isUpcoming ? latestRound : round;

  // 모달 열 때 현재 K가 속한 페이지로 자동 이동
  const openPicker = () => {
    setPickerPage(Math.floor((k - 1) / 100));
    setPickerOpen(true);
  };

  const goPrev = () => { if (round > earliestRound) setRound(round - 1); };
  const goNext = () => { if (round < upcomingRound) setRound(round + 1); };

  const openRoundPicker = () => {
    setRoundPickerInput(String(round));
    setRoundPickerOpen(true);
  };
  const submitRoundPicker = () => {
    const n = parseInt(roundPickerInput.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(earliestRound, Math.min(upcomingRound, n));
    setRound(clamped);
    setRoundPickerOpen(false);
    setRoundPickerInput('');
  };

  /** 분석 대상 회차의 추첨일 (예정 회차일 땐 latestDraw + 7일 추정). */
  const targetDate = useMemo(() => {
    if (isUpcoming) {
      const latest = drawsMap[latestRound];
      if (!latest) return '';
      const [y, m, d] = latest.date.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + 7));
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    }
    return drawsMap[round]?.date ?? '';
  }, [isUpcoming, drawsMap, latestRound, round]);

  // 선택한 회차 시점의 회차 배열 (newest-first, 1..effectiveRound)
  // → 모든 분석(회귀률, 최근 연속, 회차별 상세)이 이 시점 데이터만 사용.
  const draws = useMemo(() => {
    const arr: Draw[] = [];
    for (let r = effectiveRound; r >= earliestRound; r--) {
      const d = drawsMap[r];
      if (d) arr.push(d);
    }
    return arr;
  }, [drawsMap, effectiveRound, earliestRound]);

  /** 선택한 K의 회차별 분석 — 회차 list (당첨번호 6개 + 이월된 번호) + 평균/Lift. */
  const kAnalysis = useMemo(() => {
    type Row = { round: number; date: string; nums: number[]; overlap: number[] };
    const rows: Row[] = [];
    for (let i = 0; i < draws.length - k; i++) {
      const target = draws[i];
      const source = draws[i + k];
      if (!target || !source) continue;
      const targetSet = new Set(target.nums);
      const overlap = source.nums.filter((n) => targetSet.has(n)).sort((a, b) => a - b);
      rows.push({ round: target.round, date: target.date, nums: target.nums, overlap });
    }
    const counts = rows.map((r) => r.overlap.length);
    const avg = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const lift = avg / EXPECTED_OVERLAP;
    return { rows, avg, lift };
  }, [draws, k]);

  /**
   * 🔥 최근 연속 K-회귀 streak 랭킹 — K값별 TOP 10.
   *
   * 각 K=1..100에 대해, 최신 pair (draws[0], draws[k])부터 거꾸로 가면서
   * 어떤 번호든 1개 이상 이월된 회차가 연속으로 몇 회차 이어졌는지 카운트.
   * 적어도 1개 이월이 끊기면 break.
   *
   *   K=1 streak=4 → "직전 회차와 비교한 이월이 최근 4회차 연속 발생 중"
   */
  const kStreakRanking = useMemo(() => {
    type Item = { k: number; streak: number; totalOverlap: number };
    const items: Item[] = [];
    for (let kx = 1; kx <= RATE_RANK_RANGE; kx++) {
      let streak = 0;
      let totalOverlap = 0;
      for (let i = 0; i < draws.length - kx; i++) {
        const target = draws[i];
        const source = draws[i + kx];
        if (!target || !source) break;
        const sourceSet = new Set(source.nums);
        let cnt = 0;
        for (const n of target.nums) if (sourceSet.has(n)) cnt++;
        if (cnt > 0) {
          streak++;
          totalOverlap += cnt;
        } else {
          break;
        }
      }
      items.push({ k: kx, streak, totalOverlap });
    }
    items.sort((a, b) => b.streak - a.streak || b.totalOverlap - a.totalOverlap);
    return items;
  }, [draws]);

  /**
   * 📊 K값 전체 출현률 TOP 10.
   *
   * K=1..RATE_RANK_RANGE 각각에 대해 평균 이월 개수를 계산하고,
   * 출현률(%) = 평균 이월 / 6 × 100 기준으로 정렬.
   *
   * 행을 탭하면 해당 K가 즉시 선택됨.
   */
  const kRateRanking = useMemo(() => {
    type Item = { k: number; avg: number; rate: number; lift: number; pairs: number };
    const items: Item[] = [];
    for (let kx = 1; kx <= RATE_RANK_RANGE; kx++) {
      let total = 0;
      let pairs = 0;
      for (let i = 0; i < draws.length - kx; i++) {
        const target = draws[i];
        const source = draws[i + kx];
        if (!target || !source) continue;
        const sourceSet = new Set(source.nums);
        for (const n of target.nums) if (sourceSet.has(n)) total++;
        pairs++;
      }
      if (pairs === 0) continue;
      const avg = total / pairs;
      items.push({
        k: kx,
        avg,
        rate: (avg / 6) * 100,
        lift: avg / EXPECTED_OVERLAP,
        pairs,
      });
    }
    items.sort((a, b) => b.rate - a.rate);
    return items;
  }, [draws]);

  const pickK = (n: number) => {
    setK(n);
    setPickerOpen(false);
  };

  const detailRows = useMemo(
    () => kAnalysis.rows.slice(0, DETAIL_LIMIT),
    [kAnalysis],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon.crown color={GOLD} size={18} weight={2} />
            <T variant="heading1" color="primary">회귀분석</T>
          </View>
        }
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>

        {/* Hero — 분석 대상 회차 + K 요약 */}
        <View style={[styles.hero, { backgroundColor: palette.neutral950 }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroBadge, { backgroundColor: GOLD }]}>
              <Icon.crown color="#fff" size={12} weight={2.5} />
              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10, marginLeft: 4, letterSpacing: 0.4 }}>
                PRO
              </T>
            </View>
            <T variant="caption1" allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>
              {earliestRound}~{latestRound}회 · 분석 {draws.length}회차
            </T>
          </View>

          {/* 회차 네비게이터 */}
          <View style={[styles.heroNavRow, { marginTop: 12 }]}>
            <Pressable
              onPress={goPrev}
              disabled={round <= earliestRound}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: 'rgba(255,255,255,0.10)',
                opacity: round <= earliestRound ? 0.3 : pressed ? 0.6 : 1,
              }]}
            >
              <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800' }}>‹</T>
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              {isUpcoming ? (
                <View style={styles.upcomingPill}>
                  <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 }}>
                    🔮 추첨 예정
                  </T>
                </View>
              ) : (
                <T variant="caption1" allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.6)' }}>
                  분석 대상
                </T>
              )}
              <T variant="title3" style={{ color: '#fff', fontWeight: '800', marginTop: 4 }}>
                제 {round}회
              </T>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                {targetDate}{isUpcoming ? ' (예정)' : ''}
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
              <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800' }}>›</T>
            </Pressable>
          </View>

          {/* K 요약 — 선택한 회차 시점의 K-회귀 통계 */}
          <View style={styles.heroKBlock}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <T variant="title2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 24 }}>
                {k}회귀
              </T>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                · {k}회차 전과 비교
              </T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <T variant="caption1" allowFontScaling={false} style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                평균 {kAnalysis.avg.toFixed(2)}개 이월
              </T>
              <T variant="caption1" allowFontScaling={false} style={{
                color: kAnalysis.lift >= 1.05 ? GOLD : kAnalysis.lift < 0.95 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.78)',
                fontWeight: '800',
                fontSize: 12,
              }}>
                · 출현률 {((kAnalysis.avg / 6) * 100).toFixed(1)}%
              </T>
            </View>
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
            active={isUpcoming}
            onPress={() => setRound(upcomingRound)}
            tone="upcoming"
          />
          <JumpBtn
            label="회차 입력"
            active={false}
            onPress={openRoundPicker}
            tone="input"
          />
        </View>

        {/* K 선택 chips */}
        <Card padding={14}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 10 }}>
            회귀 선택
          </T>
          <View style={styles.chipRow}>
            {QUICK_KS.map((n) => (
              <KChip key={n} k={n} active={n === k} onPress={() => pickK(n)} />
            ))}
            <Pressable
              onPress={openPicker}
              style={[
                styles.chip,
                {
                  borderColor: k > 10 ? PURPLE : t.borderDivider,
                  backgroundColor: k > 10 ? PURPLE : t.bgSurface,
                },
              ]}
            >
              <T variant="caption1" allowFontScaling={false} style={{
                color: k > 10 ? '#fff' : t.fgSecondary,
                fontWeight: '700',
                fontSize: 13,
              }}>
                {k > 10 ? `${k}` : '더 보기'}
              </T>
              <Icon.chev color={k > 10 ? '#fff' : t.fgTertiary} size={11} weight={2.2} />
            </Pressable>
          </View>
        </Card>

        {/* 회귀 K 랭킹 — 탭으로 두 가지 전환 */}
        <Card padding={16}>
          <View>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
              {rankTab === 'rate' ? '📊 회귀률 TOP 10' : '🔥 최근 연속 회귀 TOP 10'}
            </T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
              {rankTab === 'rate'
                ? `${round}회 기준 · 1~${RATE_RANK_RANGE}회귀 중 평균 이월률이 가장 높은 K (탭해서 선택)`
                : `${round}회 기준 · 1~${RATE_RANK_RANGE}회귀 중 가장 길게 연속 이월 중인 K (탭해서 선택)`}
            </T>
          </View>

          {/* 탭 스위처 */}
          <View style={[styles.tabRow, { backgroundColor: 'rgba(112,115,124,0.10)', marginTop: 12 }]}>
            <Pressable
              onPress={() => setRankTab('rate')}
              style={({ pressed }) => [
                styles.tabBtn,
                rankTab === 'rate' && [styles.tabBtnActive, { backgroundColor: t.bgSurface }],
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <T variant="caption1" allowFontScaling={false} style={{
                color: rankTab === 'rate' ? PURPLE : t.fgSecondary,
                fontWeight: rankTab === 'rate' ? '800' : '600',
                fontSize: 13,
              }}>
                📊 회귀률
              </T>
            </Pressable>
            <Pressable
              onPress={() => setRankTab('streak')}
              style={({ pressed }) => [
                styles.tabBtn,
                rankTab === 'streak' && [styles.tabBtnActive, { backgroundColor: t.bgSurface }],
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <T variant="caption1" allowFontScaling={false} style={{
                color: rankTab === 'streak' ? GOLD_DARK : t.fgSecondary,
                fontWeight: rankTab === 'streak' ? '800' : '600',
                fontSize: 13,
              }}>
                🔥 최근 연속 회귀
              </T>
            </Pressable>
          </View>

          {/* 랭킹 리스트 */}
          <View style={{ marginTop: 12, gap: 6 }}>
            {rankTab === 'rate' ? (
              (() => {
                const top = kRateRanking.slice(0, 10);
                const max = top[0]?.rate ?? 1;
                const min = top[top.length - 1]?.rate ?? 0;
                return top.map((item, i) => (
                  <KRankRow
                    key={item.k}
                    rank={i + 1}
                    kValue={item.k}
                    primary={item.rate}
                    primaryLabel={`${item.rate.toFixed(1)}%`}
                    secondaryLabel={`평균 ${item.avg.toFixed(2)}개`}
                    max={max}
                    min={min}
                    isSelected={item.k === k}
                    onPress={() => pickK(item.k)}
                  />
                ));
              })()
            ) : (
              (() => {
                const top = kStreakRanking.slice(0, 10);
                const max = top[0]?.streak ?? 1;
                const min = top[top.length - 1]?.streak ?? 0;
                return top.map((item, i) => (
                  <KRankRow
                    key={item.k}
                    rank={i + 1}
                    kValue={item.k}
                    primary={item.streak}
                    primaryLabel={item.streak === 0 ? '연속 없음' : `${item.streak}회 연속`}
                    secondaryLabel={`총 ${item.totalOverlap}개 이월`}
                    max={max}
                    min={min}
                    isSelected={item.k === k}
                    onPress={() => pickK(item.k)}
                  />
                ));
              })()
            )}
          </View>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginTop: 8, fontSize: 10.5 }}>
            {rankTab === 'rate'
              ? `✦ 우연 기대값 = ${((EXPECTED_OVERLAP / 6) * 100).toFixed(1)}% (${EXPECTED_OVERLAP.toFixed(2)}개)`
              : `✦ 연속 = 1개 이상 이월된 회차가 최신부터 끊김 없이 이어진 횟수`}
          </T>
        </Card>

        {/* 📋 회차별 상세 — 무료 모드와 동일 (최근 100회) */}
        <Card padding={16}>
          <View>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
              📋 {k}회귀 회차별 상세
            </T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
              {k}회차 전과 비교했을 때 이월된 번호와 개수 (최근 {Math.min(DETAIL_LIMIT, detailRows.length)}회차)
            </T>
          </View>
          <View style={{ marginTop: 12 }}>
            {detailRows.length === 0 ? (
              <View style={styles.emptyBox}>
                <T variant="caption1" color="tertiary">데이터가 부족합니다.</T>
              </View>
            ) : (
              detailRows.map((row, idx) => (
                <DetailRow
                  key={row.round}
                  round={row.round}
                  date={row.date}
                  nums={row.nums}
                  overlap={row.overlap}
                  isLast={idx === detailRows.length - 1}
                  isLatest={idx === 0}
                />
              ))
            )}
          </View>
        </Card>

        <Disclaimer />
      </ScrollView>

      {/* Round picker modal — 회차 직접 입력 */}
      <Modal
        visible={roundPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRoundPickerOpen(false)}
      >
        <Pressable style={styles.roundModalBackdrop} onPress={() => setRoundPickerOpen(false)} />
        <View style={styles.roundModalWrap} pointerEvents="box-none">
          <View style={[styles.roundModalSheet, { backgroundColor: t.bgSurface }]}>
            <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>회차로 이동</T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
              {earliestRound}회 ~ {upcomingRound}회 (분석 예정 포함)
            </T>
            <View style={[styles.roundPickerRow, { borderColor: t.borderNormal, backgroundColor: t.bgSurface2 }]}>
              <TextInput
                value={roundPickerInput}
                onChangeText={(v) => setRoundPickerInput(v.replace(/[^0-9]/g, '').slice(0, 5))}
                onSubmitEditing={submitRoundPicker}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder={`회차 수 입력 (예: ${latestRound})`}
                placeholderTextColor={t.fgTertiary}
                style={[styles.roundPickerInput, { color: t.fgPrimary }]}
                returnKeyType="go"
              />
              <Pressable
                onPress={submitRoundPicker}
                style={({ pressed }) => [styles.roundGoBtn, { backgroundColor: palette.blue500, opacity: pressed ? 0.85 : 1 }]}
              >
                <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800' }}>이동</T>
              </Pressable>
            </View>
            <Pressable onPress={() => setRoundPickerOpen(false)} hitSlop={6} style={{ marginTop: 12, alignSelf: 'center' }}>
              <T variant="caption1" color="tertiary" style={{ fontWeight: '600' }}>취소</T>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* K picker modal (1~500, 5페이지) */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: t.bgSurface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T variant="headline2" color="primary" style={{ fontWeight: '800' }}>
                회귀 선택
              </T>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <Icon.close color={t.fgSecondary} size={20} weight={2} />
              </Pressable>
            </View>
            <T variant="caption1" color="tertiary" style={{ marginTop: 4, marginBottom: 12 }}>
              1 ~ {MAX_K}회귀 중 선택 (PRO 전용)
            </T>

            {/* 100단위 페이지 탭 */}
            <View style={[styles.pageTabRow, { backgroundColor: 'rgba(112,115,124,0.10)' }]}>
              {Array.from({ length: PICKER_PAGES }).map((_, p) => {
                const on = pickerPage === p;
                const start = p * 100 + 1;
                const end = (p + 1) * 100;
                const kInThisPage = k >= start && k <= end;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPickerPage(p)}
                    style={({ pressed }) => [
                      styles.pageTab,
                      on && [styles.pageTabActive, { backgroundColor: t.bgSurface }],
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <T variant="caption2" allowFontScaling={false} style={{
                      color: on ? PURPLE : t.fgSecondary,
                      fontWeight: on ? '800' : '600',
                      fontSize: 11,
                    }}>
                      {start}~{end}
                    </T>
                    {kInThisPage && !on && (
                      <View style={[styles.pageTabDot, { backgroundColor: PURPLE }]} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={{ gap: 6, marginTop: 12 }}>
              {Array.from({ length: 10 }).map((_, row) => (
                <View key={row} style={{ flexDirection: 'row', gap: 6 }}>
                  {Array.from({ length: 10 }).map((_, col) => {
                    const n = pickerPage * 100 + row * 10 + col + 1;
                    const active = n === k;
                    return (
                      <Pressable
                        key={col}
                        onPress={() => pickK(n)}
                        style={[
                          styles.gridCell,
                          {
                            backgroundColor: active ? PURPLE : t.bgSurface2,
                            borderColor: active ? PURPLE : t.borderDivider,
                          },
                        ]}
                      >
                        <T variant="caption1" compact allowFontScaling={false} style={{
                          color: active ? '#fff' : t.fgPrimary,
                          fontWeight: active ? '800' : '600',
                          fontSize: n >= 100 ? 10 : 12, // 3자리 숫자는 살짝 작게
                        }}>
                          {n}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   서브 컴포넌트
   ═══════════════════════════════════════════════════════════════════════════ */

function JumpBtn({ label, active, onPress, tone }: {
  label: string; active: boolean; onPress: () => void;
  tone?: 'upcoming' | 'input';
}) {
  const t = useTheme();
  const activeBg = tone === 'upcoming' ? palette.purple500 : palette.blue500;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.jumpBtn, {
        backgroundColor: active ? activeBg : t.bgSurface,
        borderColor: active ? 'transparent' : t.borderDivider,
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <T variant="caption1" allowFontScaling={false} style={{
        color: active ? '#fff' : t.fgSecondary,
        fontWeight: '700',
        fontSize: 13,
      }}>
        {label}
      </T>
    </Pressable>
  );
}

function KChip({ k, active, onPress }: { k: number; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? PURPLE : t.borderDivider,
          backgroundColor: active ? PURPLE : t.bgSurface,
        },
      ]}
    >
      <T variant="caption1" allowFontScaling={false} style={{
        color: active ? '#fff' : t.fgSecondary,
        fontWeight: '700',
        fontSize: 13,
      }}>
        {k}
      </T>
    </Pressable>
  );
}

/**
 * KRankRow — 두 랭킹(회귀률 / 연속 회귀)에 공통으로 쓰는 행.
 *
 *   - 막대 너비는 TOP 10 내에서 min~max로 정규화(20~100%)
 *     → 값이 비슷해도 시각적 차이가 명확히 보임
 *   - 색상은 순위 기반:
 *       1~3위 = 골드 (탑 퍼포머)
 *       4~7위 = 보라 (중간)
 *       8~10위 = 회색 (낮음)
 *   - 선택된 K는 외곽 보더 + 배경 하이라이트
 */
function KRankRow({
  rank, kValue, primary, primaryLabel, secondaryLabel, max, min, isSelected, onPress,
}: {
  rank: number;
  kValue: number;
  primary: number;
  primaryLabel: string;
  secondaryLabel: string;
  max: number;
  min: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const range = max - min;
  const pct = range > 0.001
    ? Math.max(20, 20 + ((primary - min) / range) * 80) // 20~100% 정규화
    : 60;

  // 순위 기반 색상
  const color = rank <= 3 ? GOLD : rank <= 7 ? PURPLE : '#9aa0a6';
  const textColor = rank <= 3 ? GOLD_DARK : rank <= 7 ? PURPLE : '#888';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rateRow,
        {
          backgroundColor: isSelected ? 'rgba(101,65,242,0.10)' : t.bgSurface2,
          borderColor: isSelected ? PURPLE : t.borderDivider,
          borderWidth: isSelected ? 2 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <T variant="caption1" allowFontScaling={false} style={{
        width: 18, textAlign: 'center', fontWeight: '800',
        color: textColor,
        fontSize: 13,
      }}>
        {rank}
      </T>
      <View style={[styles.kBadge, { backgroundColor: isSelected ? PURPLE : color + '30' }]}>
        <T variant="caption2" allowFontScaling={false} style={{
          color: isSelected ? '#fff' : textColor,
          fontWeight: '800',
          fontSize: 11,
        }}>
          {kValue}회귀
        </T>
      </View>
      <View style={[styles.barTrack, { backgroundColor: t.borderDivider }]}>
        <View
          style={[
            styles.barFill,
            { backgroundColor: color, width: `${pct}%` },
          ]}
        />
      </View>
      <View style={{ minWidth: 70, alignItems: 'flex-end' }}>
        <T variant="label2" allowFontScaling={false} style={{
          fontWeight: '800',
          color: textColor,
        }}>
          {primaryLabel}
        </T>
        <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: '#888', fontWeight: '600' }}>
          {secondaryLabel}
        </T>
      </View>
    </Pressable>
  );
}

/**
 * DetailRow — 한 회차의 당첨번호 6개 전부 표시.
 *
 *   - 이월된 번호(overlap) → 풀 컬러
 *   - 이월 안 된 번호 → 반투명 (opacity 0.25)
 *   - isLatest (최신 회차, 첫 행) → 6개 모두 풀 컬러 ("아직 어떤 게 다시 나올지 모름")
 */
function DetailRow({
  round, date, nums, overlap, isLast, isLatest,
}: {
  round: number;
  date: string;
  nums: number[];
  overlap: number[];
  isLast: boolean;
  isLatest: boolean;
}) {
  const t = useTheme();
  const overlapSet = useMemo(() => new Set(overlap), [overlap]);
  const count = overlap.length;
  return (
    <View style={[styles.detailRow, !isLast && { borderBottomWidth: 1, borderBottomColor: t.borderDivider }]}>
      <View style={{ width: 64 }}>
        <T variant="label2" color="primary" allowFontScaling={false} style={{ fontWeight: '800' }}>
          {round}
        </T>
        <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, marginTop: 1 }}>
          {date.slice(2)}
        </T>
      </View>
      <View style={styles.detailMid}>
        {nums.map((n) => {
          // 최신 회차는 전부 풀 컬러, 그 외에는 이월된 번호만 풀 컬러
          const opacity = isLatest || overlapSet.has(n) ? 1 : 0.25;
          return (
            <View key={n} style={{ opacity }}>
              <Ball n={n} size="sm" />
            </View>
          );
        })}
      </View>
      {isLatest ? (
        <View style={[styles.countPill, { backgroundColor: '#9aa0a6' }]}>
          <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>
            ?
          </T>
        </View>
      ) : count > 0 ? (
        <View style={[styles.countPill, { backgroundColor: countBg(count) }]}>
          <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>
            {count}
          </T>
        </View>
      ) : (
        <View style={[styles.countPill, { backgroundColor: 'transparent' }]} />
      )}
    </View>
  );
}

function countBg(count: number): string {
  if (count === 1) return '#d97706';
  if (count === 2) return '#ea580c';
  return palette.red500;
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: { borderRadius: radius.xl + 2, padding: 18 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, alignSelf: 'flex-start',
  },
  heroNavRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  heroKBlock: {
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },

  // 빠른 회차 이동
  jumpRow: { flexDirection: 'row', gap: 6 },
  jumpBtn: {
    flex: 1, height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  // 회차 입력 모달
  roundModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  roundModalWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  roundModalSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xl,
    padding: 20,
  },
  roundPickerRow: {
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
  roundPickerInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 8,
    outlineStyle: 'none' as any,
  },
  roundGoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    minWidth: 36, height: 32,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 2,
  },

  emptyBox: {
    paddingVertical: 16, paddingHorizontal: 12,
    alignItems: 'center',
  },

  // 탭 스위처 (두 랭킹 전환)
  tabRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    gap: 2,
  },
  tabBtn: {
    flex: 1, height: 36,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },

  // 랭킹 row (공통)
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
  },
  kBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
    minWidth: 50, alignItems: 'center',
  },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },

  // 회차별 상세
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  detailMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
  },
  countPill: {
    minWidth: 28,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
  },

  // K picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xl,
    padding: 20,
  },
  pageTabRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    gap: 2,
  },
  pageTab: {
    flex: 1,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pageTabActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  pageTabDot: {
    position: 'absolute',
    top: 4, right: 6,
    width: 5, height: 5,
    borderRadius: 2.5,
  },
  gridCell: {
    flex: 1, aspectRatio: 1, minWidth: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
