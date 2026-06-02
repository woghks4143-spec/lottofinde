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
import React, { useEffect, useMemo, useState } from 'react';
import { InteractionManager, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
import {
  computeRegressionRanking, getMemCached, setCached, loadPersistedRanking,
  type StreakItem, type RateItem,
} from '@/src/lib/regressionCache';
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
  const isPro = useProGuard();
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
  const [round, setRound] = useState<number>(0);
  // 첫 진입 시 latestRound가 hydrate되면 즉시 round 세팅 (분석 회차 바로 표시)
  useEffect(() => {
    if (round === 0 && latestRound > 0) setRound(latestRound);
  }, [latestRound, round]);
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
  // 무거운 ranking 계산 — 3단계 캐시 (mem → AsyncStorage → compute).
  // 같은 회차 재진입 시 0ms, 앱 재시작 후에도 AsyncStorage hit으로 즉시 표시.
  const [kStreakRanking, setKStreakRanking] = useState<StreakItem[]>([]);
  const [kRateRanking, setKRateRanking] = useState<RateItem[]>([]);
  const [rankingReady, setRankingReady] = useState(false);

  useEffect(() => {
    if (draws.length === 0) return;

    // L1: memCache 즉시 확인 (동기, 0ms)
    const cached = getMemCached(effectiveRound);
    if (cached) {
      setKStreakRanking(cached.streak);
      setKRateRanking(cached.rate);
      setRankingReady(true);
      return;
    }

    setRankingReady(false);
    let cancelled = false;

    (async () => {
      // L2: AsyncStorage 비동기 확인 (50ms 정도)
      const persisted = await loadPersistedRanking(effectiveRound);
      if (cancelled) return;
      if (persisted) {
        setCached(effectiveRound, persisted); // mem cache에도 hydrate
        setKStreakRanking(persisted.streak);
        setKRateRanking(persisted.rate);
        setRankingReady(true);
        return;
      }

      // L3: 계산 — InteractionManager로 frame 후
      InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        const data = computeRegressionRanking(draws);
        setCached(effectiveRound, data); // mem + AsyncStorage 동시 저장
        if (cancelled) return;
        setKStreakRanking(data.streak);
        setKRateRanking(data.rate);
        setRankingReady(true);
      });
    })();

    return () => { cancelled = true; };
  }, [draws, effectiveRound]);

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

        {/* Hero — 일반 분석법 비교 / 핀더 예상 제외수 디자인과 통일 */}
        <View style={[styles.hero, { backgroundColor: t.bgHero }]}>
          <View style={styles.heroNavRow}>
            <Pressable
              onPress={goPrev}
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
                  <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 }}>
                    🔮 추첨 예정
                  </T>
                </View>
              ) : (
                <T variant="caption1" style={{ color: t.fgOnHeroMuted }}>분석 대상</T>
              )}
              <T variant="title3" style={{ color: t.fgOnHero, fontWeight: '800', marginTop: 4 }}>
                제 {round}회
              </T>
              <T variant="caption1" style={{ color: t.fgOnHeroFaint, marginTop: 2 }}>
                {targetDate}{isUpcoming ? ' (예정)' : ''}
              </T>
            </View>
            <Pressable
              onPress={goNext}
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
          {/* 당첨번호 BallRow (분석법 비교/핀더 예상 제외수와 동일) */}
          <View style={{ marginTop: 14, alignItems: 'center' }}>
            {isUpcoming || !drawsMap[round] ? (
              <View style={[styles.upcomingNumsBox, { backgroundColor: t.bgOnHeroPill, borderColor: t.borderOnHero }]}>
                <T variant="label1n" style={{ color: t.fgOnHero, textAlign: 'center', fontWeight: '700' }}>
                  당첨번호 발표 전
                </T>
              </View>
            ) : (
              <BallRow nums={drawsMap[round].nums} bonus={drawsMap[round].bonus} size="sm" style={{ gap: 4 }} />
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

        {/* K 요약 카드 — 현재 선택한 K의 통계 */}
        <Card padding={14}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <T variant="title2" color="primary" allowFontScaling={false} style={{ fontWeight: '900', fontSize: 24 }}>
              {k}회귀
            </T>
            <T variant="caption1" color="tertiary" allowFontScaling={false} style={{ fontSize: 11.5 }}>
              {k}회차 전과 비교
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <T variant="caption1" color="secondary" allowFontScaling={false} style={{ fontWeight: '700', fontSize: 12 }}>
              평균 {kAnalysis.avg.toFixed(2)}개 이월
            </T>
            <T variant="caption1" allowFontScaling={false} style={{
              color: kAnalysis.lift >= 1.05 ? GOLD_DARK : '#888',
              fontWeight: '800', fontSize: 12,
            }}>
              · 출현률 {((kAnalysis.avg / 6) * 100).toFixed(1)}%
            </T>
          </View>
        </Card>

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
                ? `${round}회 기준 · 평균 이월률이 가장 높은 K (탭해서 선택)`
                : `${round}회 기준 · 가장 길게 연속 이월 중인 K (탭해서 선택)`}
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
              광범위한 회귀 범위 중 선택 (PRO 전용)
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
  round, nums, overlap, isLast, isLatest,
}: {
  round: number;
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
      <View style={{ width: 52 }}>
        <T variant="label2" color="primary" allowFontScaling={false} style={{ fontWeight: '800', fontSize: 13 }}>
          {round}
        </T>
      </View>
      <View style={styles.detailMid}>
        {nums.map((n) => {
          // 이월된 번호 = filled (풀 컬러). 그 외 = muted (흰 배경 + 컬러 보더/글자)
          // 최신 회차는 전부 filled (다음 회차에 무엇이 이월될지 모름).
          const isFilled = isLatest || overlapSet.has(n);
          return (
            <Ball key={n} n={n} size="sm" muted={!isFilled} ringPad={1} noShadow />
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
        // count=0 — 회색 작은 dash "—"로 의도적 빈 상태 (직각 빈 박스보다 깔끔)
        <View style={[styles.countPill, { backgroundColor: 'rgba(150,150,150,0.12)' }]}>
          <T variant="caption2" allowFontScaling={false} style={{ color: '#aaa', fontWeight: '700', fontSize: 11 }}>
            —
          </T>
        </View>
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
  // 회차 이동 버튼 — 둥근 사각형 (분석법 비교/핀더 예상 제외수와 통일)
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
  // "당첨번호 발표 전" 박스 — 예정 회차 또는 데이터 없을 때
  upcomingNumsBox: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    width: '100%',
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
    flexWrap: 'nowrap',     // 한 줄 강제 (줄 안 맞는 wrap 제거)
    gap: 2,
  },
  // 적중 개수 칩 — 명시적 캡슐 모양 (가로 36, 세로 22로 약 1.6:1 비율 보장)
  countPill: {
    minWidth: 36,
    height: 22,
    paddingHorizontal: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
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
