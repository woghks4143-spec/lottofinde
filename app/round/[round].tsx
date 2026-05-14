/**
 * 회차 상세 페이지 — /round/[round].
 *
 * 한 회차의 모든 분석을 전문가 수준으로 한 화면에 정리한다:
 *   1) Hero — 당첨 번호 + 보너스 + 회차/날짜/당첨금
 *   2) 당첨 번호 요약 — 합·끝수합·십합·앞/뒷세수합·홀짝·저고·AC·표준편차
 *   3) 수학적 특성 — 소수·합성수·완전제곱수·3의 배수·5의 배수·끝자리 중복·연속수
 *   4) 홀짝·저고 분포 — Ball로 시각화
 *   5) 구간별 분포 — 1-10/11-20/21-30/31-40/41-45 막대 차트
 *   6) 직전 회차 비교 — 이월수·보너스 이월·이웃수
 *   7) 출현 시점 분석 — 5주내 / 6~10주내 / 10주내 미출현
 *   8) 이전·다음 회차 네비게이션 + 회차 점프 (상단 타이틀 탭)
 *
 * 라우팅: `/round/1223` → useLocalSearchParams<{round: string}>()
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar, IconBtn } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import {
  ac, compositesIn, consecutivePairs, firstThreeSum, highLow, highLowLabel,
  intersect, lastThreeSum, multiplesOf, neighborsOf, oddEven, oddEvenLabel,
  perfectSquaresIn, primesIn, stdDev, tailDigitDupes, tailSum, tensSum, total,
} from '@/src/data/lotto';
import type { Draw, WinningStore } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function RoundDetail() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/home');
  const params = useLocalSearchParams<{ round: string }>();
  const round = parseInt(params.round, 10);

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);

  const draw = useHistory((s) => s.getRound(round));
  const prevDraw = useHistory((s) => s.getRound(round - 1));
  const enrichState = useHistory((s) => s.enrichState[round]);
  const enrichRound = useHistory((s) => s.enrichRound);

  // 회차 진입 시 등위/판매점 정보가 없으면 백그라운드로 페치 (네이티브만).
  useEffect(() => {
    if (!draw) return;
    if (Platform.OS === 'web') return;
    const hasFull = !!draw.prizes && !!draw.topStores && draw.topStores.length > 0;
    if (hasFull) return;
    enrichRound(round).catch(() => {});
  }, [round, draw?.prizes, draw?.topStores, enrichRound]);

  // 회차 점프 다이얼로그
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInput, setPickerInput] = useState('');
  const jumpTo = (target: number) => {
    const clamped = Math.max(earliestRound, Math.min(latestRound, Math.round(target)));
    setPickerOpen(false);
    setPickerInput('');
    if (clamped !== round) router.replace(`/round/${clamped}` as any);
  };
  const submitPicker = () => {
    const n = parseInt(pickerInput.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(n)) return;
    jumpTo(n);
  };

  // 출현 시점 분석: 현재 회차 직전 10주의 모든 번호를 모으고, 각 구간 매칭
  const appearance = useMemo(() => {
    if (!draw) return { recent5: [], recent6to10: [], missing10: [] };
    return computeAppearance(draw, drawsMap, round);
  }, [draw, drawsMap, round]);

  if (!draw) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
        <AppBar title={`${round}회`} onBack={goBack} />
        <View style={styles.empty}>
          <T variant="heading2" color="primary">회차 데이터가 없어요</T>
          <T variant="body2r" color="tertiary" style={{ marginTop: 6, textAlign: 'center' }}>
            보유 회차 범위: {earliestRound}~{latestRound}회
          </T>
        </View>
      </SafeAreaView>
    );
  }

  const sortedNums = [...draw.nums].sort((a, b) => a - b);

  // 요약 지표
  const sumV = total(draw.nums);
  const tailV = tailSum(draw.nums);
  const tensV = tensSum(draw.nums);
  const firstV = firstThreeSum(draw.nums);
  const lastV = lastThreeSum(draw.nums);
  const oeLabel = oddEvenLabel(draw.nums);
  const hlLabel = highLowLabel(draw.nums);
  const acV = ac(draw.nums);
  const sdV = stdDev(draw.nums);

  // 수학적 특성
  const primes = primesIn(draw.nums);
  const composites = compositesIn(draw.nums);
  const squares = perfectSquaresIn(draw.nums);
  const mult3 = multiplesOf(draw.nums, 3);
  const mult5 = multiplesOf(draw.nums, 5);
  const dupes = tailDigitDupes(draw.nums);
  const consec = consecutivePairs(draw.nums);

  // 홀짝·저고
  const [oddC, evenC] = oddEven(draw.nums);
  const [lowC, highC] = highLow(draw.nums);
  const odd = sortedNums.filter((n) => n % 2 === 1);
  const even = sortedNums.filter((n) => n % 2 === 0);
  const low = sortedNums.filter((n) => n <= 22);
  const high = sortedNums.filter((n) => n >= 23);

  // 구간별 분포 (1-10, 11-20, 21-30, 31-40, 41-45)
  const segments = useMemo(() => {
    const ranges: Array<{ label: string; from: number; to: number }> = [
      { label: '1~10',  from: 1,  to: 10 },
      { label: '11~20', from: 11, to: 20 },
      { label: '21~30', from: 21, to: 30 },
      { label: '31~40', from: 31, to: 40 },
      { label: '41~45', from: 41, to: 45 },
    ];
    return ranges.map((r) => ({
      ...r,
      nums: sortedNums.filter((n) => n >= r.from && n <= r.to),
    }));
  }, [sortedNums]);

  // 직전 회차 비교
  const prevCompare = useMemo(() => {
    if (!prevDraw) return null;
    return {
      prev: prevDraw,
      carryOver: intersect(draw.nums, prevDraw.nums),                         // 동행수: 본번호 ∩ 본번호
      carryWithBonus: intersect(draw.nums, [...prevDraw.nums, prevDraw.bonus]).filter((n) => n === prevDraw.bonus), // 보너스만 따로
      neighbors: neighborsOf(draw.nums, prevDraw, false),                     // 이웃수 ±1 (직전 본번호 기준)
    };
  }, [draw, prevDraw]);

  const goPrev = () => {
    if (round > earliestRound) router.replace(`/round/${round - 1}` as any);
  };
  const goNext = () => {
    if (round < latestRound) router.replace(`/round/${round + 1}` as any);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        onBack={goBack}
        title={
          <Pressable
            onPress={() => { setPickerInput(String(round)); setPickerOpen(true); }}
            style={({ pressed }) => [styles.titleBtn, { backgroundColor: pressed ? t.bgSurface2 : 'transparent' }]}
            hitSlop={6}
          >
            <T variant="heading1" color="primary" style={{ fontWeight: '800' }}>
              {round}회 상세
            </T>
            <T variant="caption1" color="tertiary" style={{ marginLeft: 6, fontSize: 14, fontWeight: '700' }} allowFontScaling={false}>
              ▾
            </T>
          </Pressable>
        }
        trailing={
          <IconBtn onPress={() => { setPickerInput(String(round)); setPickerOpen(true); }}>
            <Icon.filter color={t.fgSecondary} />
          </IconBtn>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 + 64 /* 하단 고정 네비 높이 보정 */ }}>

        {/* Hero: 회차 정보 + 당첨번호 */}
        <View style={[styles.hero, { backgroundColor: palette.neutral950 }]}>
          <View style={styles.heroHead}>
            <View>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>
                {koreanDate(draw.date)}
              </T>
              <T variant="title2" style={{ color: '#fff', fontWeight: '800', marginTop: 2 }}>
                제 {draw.round}회 당첨번호
              </T>
            </View>
            {round === latestRound && (
              <View style={styles.latestPill}>
                <T variant="caption1" style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                  최신
                </T>
              </View>
            )}
          </View>
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <BallRow nums={draw.nums} bonus={draw.bonus} size="lg" />
          </View>
          {draw.firstWinAmount ? (
            <View style={[styles.heroFoot, { borderTopColor: 'rgba(255,255,255,0.08)' }]}>
              <T variant="label1r" style={{ color: 'rgba(255,255,255,0.7)' }}>1등 당첨금</T>
              <T variant="label1n" style={{ color: '#fff', fontWeight: '700' }}>
                {formatWon(draw.firstWinAmount)}
                {draw.firstWinners ? <T variant="caption1" style={{ color: 'rgba(255,255,255,0.55)' }}>{`  ${draw.firstWinners}명`}</T> : null}
              </T>
            </View>
          ) : null}
          {draw.totalSales ? (
            <View style={styles.heroSales}>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                총 판매금액 {formatWon(draw.totalSales)}
              </T>
            </View>
          ) : null}
        </View>

        {/* ───── 등위별 당첨 정보 (1~5등) ───── */}
        <PrizeBreakdownCard draw={draw} loading={enrichState === 'loading'} failed={enrichState === 'failed'} />

        {/* ───── 1·2등 당첨 판매점 ───── */}
        <TopStoresCard draw={draw} loading={enrichState === 'loading'} failed={enrichState === 'failed'} />

        {/* ───── 당첨 번호 요약 ───── */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 12 }}>
            당첨 번호 요약
          </T>
          <View style={styles.statGrid}>
            <StatCell label="합" value={sumV} />
            <StatCell label="끝수합" value={tailV} />
            <StatCell label="십합" value={tensV} />
            <StatCell label="AC값" value={acV} hint={acHint(acV)} />
            <StatCell label="앞세수합" value={firstV} />
            <StatCell label="뒷세수합" value={lastV} />
            <StatCell label="홀:짝" value={oeLabel} />
            <StatCell label="저:고" value={hlLabel} />
          </View>
          <View style={[styles.statFootRow, { borderTopColor: t.borderDivider }]}>
            <View style={{ flex: 1 }}>
              <T variant="caption1" color="tertiary" style={{ fontSize: 11 }}>표준편차</T>
              <T variant="label1n" color="primary" style={{ fontWeight: '800', marginTop: 2 }} allowFontScaling={false}>
                {sdV.toFixed(1)}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="caption1" color="tertiary" style={{ fontSize: 11 }}>연속수</T>
              <T variant="label1n" color="primary" style={{ fontWeight: '800', marginTop: 2 }} allowFontScaling={false}>
                {consec}쌍
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="caption1" color="tertiary" style={{ fontSize: 11 }}>총합 등급</T>
              <T variant="label1n" color="primary" style={{ fontWeight: '800', marginTop: 2 }} allowFontScaling={false}>
                {sumBand(sumV)}
              </T>
            </View>
          </View>
        </Card>

        {/* ───── 수학적 특성 ───── */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
            수학적 특성
          </T>
          <T variant="caption1" color="tertiary" style={{ marginBottom: 14 }}>
            번호의 수학적 분류로 조합의 성격을 확인해요
          </T>
          <PropertyRow label="소수" hint="2·3·5·7·11·13·17·19·23·29·31·37·41·43" count={primes.length} nums={primes} />
          <PropertyRow label="합성수" hint="소수가 아닌 수 (1·4·6·8·…)" count={composites.length} nums={composites} />
          <PropertyRow label="완전제곱수" hint="1·4·9·16·25·36" count={squares.length} nums={squares} />
          <PropertyRow label="3의 배수" hint="3·6·9·…·45" count={mult3.length} nums={mult3} />
          <PropertyRow label="5의 배수" hint="5·10·15·…·45" count={mult5.length} nums={mult5} />
          {dupes.length > 0 ? (
            <View style={styles.propRow}>
              <View style={{ width: 100 }}>
                <T variant="label1n" color="primary" style={{ fontWeight: '700', fontSize: 13 }}>끝자리 중복</T>
                <T variant="caption2" color="tertiary" style={{ marginTop: 2, fontSize: 10 }}>같은 끝수</T>
              </View>
              <View style={styles.propBalls}>
                {dupes.map((d, i) => (
                  <View key={i} style={styles.dupGroup}>
                    <View style={[styles.dupChip, { backgroundColor: palette.softFill, borderColor: t.borderWeak }]}>
                      <T variant="caption2" color="secondary" style={{ fontSize: 10, fontWeight: '700' }} allowFontScaling={false}>
                        ⋯{d.digit}
                      </T>
                    </View>
                    {d.nums.map((n) => <Ball key={n} n={n} size="sm" />)}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <PropertyRow label="끝자리 중복" hint="같은 끝수 번호" count={0} nums={[]} emptyText="없음" isLast />
          )}
        </Card>

        {/* ───── 홀짝·저고 분포 ───── */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
            홀짝·저고 분포
          </T>
          <T variant="caption1" color="tertiary" style={{ marginBottom: 14 }}>
            홀/짝과 저(1~22)/고(23~45)로 6개 번호를 분류
          </T>
          <DetailRow label="홀" subLabel={`${oddC}개`} nums={odd} />
          <DetailRow label="짝" subLabel={`${evenC}개`} nums={even} />
          <View style={{ height: 1, backgroundColor: t.borderDivider, marginVertical: 10 }} />
          <DetailRow label="저" subLabel={`${lowC}개 · 1~22`} nums={low} />
          <DetailRow label="고" subLabel={`${highC}개 · 23~45`} nums={high} />
        </Card>

        {/* ───── 구간별 분포 ───── */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
            구간별 분포
          </T>
          <T variant="caption1" color="tertiary" style={{ marginBottom: 14 }}>
            10단위 구간별로 몇 개가 나왔는지
          </T>
          {segments.map((s, i) => (
            <SegmentRow key={i} label={s.label} count={s.nums.length} nums={s.nums} isLast={i === segments.length - 1} />
          ))}
        </Card>

        {/* ───── 직전 회차 비교 ───── */}
        {prevCompare && (
          <Card padding={16}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
              직전 회차 비교
            </T>
            <T variant="caption1" color="tertiary" style={{ marginBottom: 14 }}>
              {prevCompare.prev.round}회와 겹치는 번호
            </T>
            <CompareRow
              label="이월수"
              description="직전 회차에 똑같이 나온 본번호"
              nums={prevCompare.carryOver}
              tone="success"
              emptyText="없음"
            />
            <CompareRow
              label="보너스 이월"
              description={`직전 보너스 ${prevCompare.prev.bonus}번이 본번호로`}
              nums={prevCompare.carryWithBonus}
              tone="accent"
              emptyText="해당 없음"
            />
            <CompareRow
              label="이웃수"
              description="직전 번호의 ±1번 (이월수 제외)"
              nums={prevCompare.neighbors.filter((n) => !prevCompare.carryOver.includes(n))}
              tone="warning"
              emptyText="없음"
              isLast
            />
          </Card>
        )}

        {/* ───── 출현 시점 분석 ───── */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
            출현 시점 분석
          </T>
          <T variant="caption1" color="tertiary" style={{ marginBottom: 14 }}>
            이번 회차 번호들이 최근에 얼마나 자주 나왔는지
          </T>
          <CompareRow
            label="5주내 출현"
            description="직전 5회차 안에 나옴"
            nums={appearance.recent5}
            tone="success"
            emptyText="해당 없음"
          />
          <CompareRow
            label="6~10주내 출현"
            description="6~10회차 전에 나옴"
            nums={appearance.recent6to10}
            tone="accent"
            emptyText="해당 없음"
          />
          <CompareRow
            label="10주내 미출현"
            description="10회차 동안 안 나옴 (잠수번호)"
            nums={appearance.missing10}
            tone="danger"
            emptyText="모두 최근 출현"
            isLast
          />
        </Card>

        <Disclaimer />
      </ScrollView>

      {/* ───── 회차 네비 (하단 고정) ───── */}
      <View style={[styles.navBar, { backgroundColor: t.bgSurface, borderTopColor: t.borderDivider }]}>
        <NavBtn
          label={`← ${round - 1}회`}
          disabled={round <= earliestRound}
          onPress={goPrev}
        />
        <NavBtn
          label={`${round + 1}회 →`}
          disabled={round >= latestRound}
          onPress={goNext}
        />
      </View>

      {/* ───── 회차 점프 모달 ───── */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.modalWrap} pointerEvents="box-none">
          <View style={[styles.modalSheet, { backgroundColor: t.bgSurface }]}>
            <View style={styles.modalHead}>
              <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>회차로 이동</T>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8} style={styles.modalClose}>
                <Icon.close color={t.fgSecondary} />
              </Pressable>
            </View>
            <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
              현재 {round}회 · 전체 {earliestRound}~{latestRound}회
            </T>

            {/* 직접 입력 */}
            <View style={[styles.inputRow, { borderColor: t.borderNormal, backgroundColor: t.bgSurface2 }]}>
              <TextInput
                value={pickerInput}
                onChangeText={(v) => setPickerInput(v.replace(/[^0-9]/g, '').slice(0, 5))}
                onSubmitEditing={submitPicker}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder={`${earliestRound} ~ ${latestRound}`}
                placeholderTextColor={t.fgTertiary}
                style={[styles.input, { color: t.fgPrimary }]}
                returnKeyType="go"
              />
              <Pressable
                onPress={submitPicker}
                style={({ pressed }) => [
                  styles.goBtn,
                  { backgroundColor: palette.blue500, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <T variant="label1n" style={{ color: '#fff', fontWeight: '800' }} allowFontScaling={false}>
                  이동
                </T>
              </Pressable>
            </View>

            {/* 상대 점프 */}
            <T variant="caption1" color="tertiary" style={{ marginTop: 18, marginBottom: 6 }}>
              빠른 이동
            </T>
            <View style={styles.jumpRow}>
              {[-100, -10, -1, +1, +10, +100].map((delta) => {
                const target = round + delta;
                const disabled = target < earliestRound || target > latestRound;
                return (
                  <Pressable
                    key={delta}
                    onPress={() => jumpTo(target)}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.jumpBtn,
                      {
                        backgroundColor: disabled ? t.bgSurface2 : t.bgSurface,
                        borderColor: t.borderWeak,
                        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <T
                      variant="caption1"
                      color={disabled ? 'tertiary' : 'primary'}
                      style={{ fontWeight: '700', fontSize: 12 }}
                      allowFontScaling={false}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </T>
                  </Pressable>
                );
              })}
            </View>

            {/* 빠른 진입 */}
            <View style={styles.shortcutRow}>
              <Pressable
                onPress={() => jumpTo(latestRound)}
                disabled={round === latestRound}
                style={({ pressed }) => [
                  styles.shortcutBtn,
                  {
                    backgroundColor: round === latestRound ? t.bgSurface2 : 'rgba(0,102,255,0.10)',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <T variant="label1n" style={{ color: round === latestRound ? t.fgTertiary : palette.blue700, fontWeight: '700' }} allowFontScaling={false}>
                  ⇥ 최신 {latestRound}회
                </T>
              </Pressable>
              <Pressable
                onPress={() => jumpTo(earliestRound)}
                disabled={round === earliestRound}
                style={({ pressed }) => [
                  styles.shortcutBtn,
                  {
                    backgroundColor: round === earliestRound ? t.bgSurface2 : palette.softFill,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <T variant="label1n" color={round === earliestRound ? 'tertiary' : 'primary'} style={{ fontWeight: '700' }} allowFontScaling={false}>
                  ⇤ {earliestRound}회
                </T>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

/** 등위별 당첨 정보 카드 (1~5등 표). */
function PrizeBreakdownCard({ draw, loading, failed }: { draw: Draw; loading: boolean; failed: boolean }) {
  const t = useTheme();
  const p = draw.prizes;
  // 시드 데이터(첫 1등 정보만)도 표시할 수 있도록 폴백
  const rows: Array<{ label: string; key: keyof NonNullable<Draw['prizes']> | 'firstFromSeed'; amount?: number; winners?: number; tone: string }> = [
    {
      label: '1등',
      key: 'first',
      amount: p?.first?.amount ?? draw.firstWinAmount,
      winners: p?.first?.winners ?? draw.firstWinners,
      tone: palette.blue700,
    },
    { label: '2등', key: 'second', amount: p?.second?.amount, winners: p?.second?.winners, tone: palette.green700 },
    { label: '3등', key: 'third',  amount: p?.third?.amount,  winners: p?.third?.winners,  tone: palette.purple500 },
    { label: '4등', key: 'fourth', amount: p?.fourth?.amount, winners: p?.fourth?.winners, tone: t.fgSecondary },
    { label: '5등', key: 'fifth',  amount: p?.fifth?.amount,  winners: p?.fifth?.winners,  tone: t.fgTertiary },
  ];
  const hasAnySecondPlus = !!(p?.second || p?.third || p?.fourth || p?.fifth);

  return (
    <Card padding={16}>
      <View style={styles.cardHeadRow}>
        <View style={{ flex: 1 }}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
            등위별 당첨 정보
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
            1게임당 당첨금 × 당첨 게임 수
          </T>
        </View>
        {loading && <ActivityIndicator size="small" color={palette.blue500} />}
      </View>

      {!hasAnySecondPlus && !loading && !failed && Platform.OS === 'web' && (
        <View style={[styles.noticeBox, { backgroundColor: palette.softFill }]}>
          <T variant="caption1" color="tertiary" style={{ lineHeight: 17 }}>
            웹 미리보기에서는 1등 정보만 표시됩니다. 모바일 앱에서는 2~5등과 판매점 정보까지 자동으로 가져와요.
          </T>
        </View>
      )}
      {failed && (
        <View style={[styles.noticeBox, { backgroundColor: 'rgba(255,66,66,0.08)' }]}>
          <T variant="caption1" style={{ color: palette.red500, lineHeight: 17 }}>
            동행복권에서 정보를 가져오지 못했어요. 잠시 후 다시 시도됩니다.
          </T>
        </View>
      )}

      <View style={{ marginTop: 12 }}>
        {rows.map((r, i) => (
          <View
            key={r.label}
            style={[
              styles.prizeRow,
              i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.borderDivider },
            ]}
          >
            <View style={[styles.prizeBadge, { backgroundColor: palette.softFill }]}>
              <T variant="label1n" style={{ color: r.tone, fontWeight: '800', fontSize: 13 }} allowFontScaling={false}>
                {r.label}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              {r.amount && r.amount > 0 ? (
                <T variant="label1n" color="primary" style={{ fontWeight: '800' }} allowFontScaling={false}>
                  {formatWon(r.amount)}
                </T>
              ) : (
                <T variant="label1r" color="tertiary" style={{ fontStyle: 'italic' }}>
                  {loading ? '가져오는 중…' : '—'}
                </T>
              )}
              {r.winners != null && r.winners >= 0 ? (
                <T variant="caption1" color="tertiary" style={{ marginTop: 2 }} allowFontScaling={false}>
                  {r.winners.toLocaleString('ko')}명 당첨
                </T>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** 1·2등 당첨 판매점 카드. */
function TopStoresCard({ draw, loading, failed }: { draw: Draw; loading: boolean; failed: boolean }) {
  const t = useTheme();
  const stores = draw.topStores ?? [];
  const firsts = stores.filter((s) => s.rank === 1);
  const seconds = stores.filter((s) => s.rank === 2);

  return (
    <Card padding={16}>
      <View style={styles.cardHeadRow}>
        <View style={{ flex: 1 }}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
            당첨 판매점
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
            1·2등 배출점 (자동/수동/반자동 표시)
          </T>
        </View>
        {loading && <ActivityIndicator size="small" color={palette.blue500} />}
      </View>

      {stores.length === 0 ? (
        <View style={[styles.noticeBox, { backgroundColor: palette.softFill, marginTop: 12 }]}>
          <T variant="caption1" color="tertiary" style={{ lineHeight: 18 }}>
            {Platform.OS === 'web'
              ? '웹 미리보기에서는 판매점 정보를 가져올 수 없어요. 모바일 앱에서 확인해 주세요.'
              : loading
                ? '동행복권에서 판매점 정보를 가져오는 중…'
                : failed
                  ? '판매점 정보를 가져오지 못했어요.'
                  : '판매점 정보가 아직 없어요.'}
          </T>
        </View>
      ) : (
        <View style={{ marginTop: 12, gap: 14 }}>
          {firsts.length > 0 && <StoreSection rank={1} stores={firsts} />}
          {seconds.length > 0 && <StoreSection rank={2} stores={seconds} />}
        </View>
      )}
    </Card>
  );
}

function StoreSection({ rank, stores }: { rank: 1 | 2; stores: WinningStore[] }) {
  const t = useTheme();
  return (
    <View>
      <View style={styles.storeHead}>
        <View style={[styles.storeRankPill, { backgroundColor: rank === 1 ? 'rgba(0,102,255,0.12)' : 'rgba(0,191,64,0.12)' }]}>
          <T variant="caption1" style={{ color: rank === 1 ? palette.blue700 : palette.green700, fontWeight: '800', fontSize: 11 }} allowFontScaling={false}>
            {rank}등
          </T>
        </View>
        <T variant="caption1" color="tertiary">{stores.length}곳 배출</T>
      </View>
      <View style={{ gap: 8, marginTop: 8 }}>
        {stores.map((s, i) => (
          <View key={i} style={[styles.storeItem, { borderColor: t.borderDivider }]}>
            <View style={styles.storeNameRow}>
              <T variant="label1n" color="primary" style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {s.name}
              </T>
              {s.method !== 'unknown' && <MethodChip method={s.method} />}
            </View>
            <T variant="caption1" color="tertiary" style={{ marginTop: 4, lineHeight: 17 }} numberOfLines={2}>
              {s.address || '주소 미상'}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

function MethodChip({ method }: { method: WinningStore['method'] }) {
  const config = {
    auto:    { label: '자동', fg: palette.blue700,    bg: 'rgba(0,102,255,0.12)' },
    manual:  { label: '수동', fg: palette.purple500,  bg: 'rgba(101,65,242,0.12)' },
    mixed:   { label: '반자동', fg: palette.green700, bg: 'rgba(0,191,64,0.12)' },
    unknown: { label: '미상', fg: '#888',             bg: 'rgba(112,115,124,0.10)' },
  }[method];
  return (
    <View style={[styles.methodChip, { backgroundColor: config.bg }]}>
      <T variant="caption2" style={{ color: config.fg, fontWeight: '800', fontSize: 10 }} allowFontScaling={false}>
        {config.label}
      </T>
    </View>
  );
}

/** 4-column stat grid cell — 라벨 위 / 값 아래 세로 정렬. */
function StatCell({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.statCell, { backgroundColor: palette.softFill, borderColor: t.borderWeak }]}>
      <T variant="caption2" color="tertiary" style={{ fontSize: 10, fontWeight: '600' }} allowFontScaling={false}>
        {label}
      </T>
      <T variant="label1n" color="primary" style={{ fontWeight: '800', marginTop: 4, fontSize: 16 }} allowFontScaling={false}>
        {value}
      </T>
      {hint ? (
        <T variant="caption2" color="tertiary" style={{ fontSize: 9.5, marginTop: 2 }} allowFontScaling={false}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

function PropertyRow({
  label, hint, count, nums, emptyText = '없음', isLast,
}: { label: string; hint?: string; count: number; nums: number[]; emptyText?: string; isLast?: boolean }) {
  return (
    <View style={[styles.propRow, isLast && { borderBottomWidth: 0 }]}>
      <View style={{ width: 100 }}>
        <View style={styles.propLabelRow}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', fontSize: 13 }} allowFontScaling={false}>
            {label}
          </T>
          <T variant="caption2" style={{ color: count > 0 ? palette.blue700 : palette.neutral500, fontWeight: '800', fontSize: 11 }} allowFontScaling={false}>
            {count}개
          </T>
        </View>
        {hint ? <T variant="caption2" color="tertiary" style={{ marginTop: 2, fontSize: 9.5 }} numberOfLines={2}>{hint}</T> : null}
      </View>
      <View style={styles.propBalls}>
        {nums.length > 0
          ? nums.map((n) => <Ball key={n} n={n} size="sm" />)
          : <T variant="caption1" color="tertiary" style={{ fontStyle: 'italic' }}>{emptyText}</T>}
      </View>
    </View>
  );
}

function SegmentRow({ label, count, nums, isLast }: { label: string; count: number; nums: number[]; isLast?: boolean }) {
  const t = useTheme();
  // 막대 너비: 6개 만점이지만 한 구간에 6개 다 들어올 일은 사실상 없음. 4를 만점으로 (= 80%).
  const widthPct = Math.min(100, (count / 4) * 100);
  const barColor = count >= 3 ? palette.blue500 : count >= 1 ? palette.green500 : palette.neutral500;

  return (
    <View style={[styles.segRow, isLast && { borderBottomWidth: 0 }]}>
      <View style={{ width: 58 }}>
        <T variant="caption1" color="secondary" style={{ fontWeight: '700' }} allowFontScaling={false}>
          {label}
        </T>
      </View>
      <View style={[styles.segTrack, { backgroundColor: t.borderDivider }]}>
        <View style={[styles.segFill, { width: `${widthPct}%`, backgroundColor: barColor }]} />
      </View>
      <View style={{ width: 38, alignItems: 'flex-end' }}>
        <T variant="label1n" color="primary" style={{ fontWeight: '800' }} allowFontScaling={false}>
          {count}개
        </T>
      </View>
    </View>
  );
}

function DetailRow({ label, subLabel, nums }: { label: string; subLabel?: string; nums: number[] }) {
  return (
    <View style={styles.detailRow}>
      <View style={{ width: 80 }}>
        <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{label}</T>
        {subLabel && <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>{subLabel}</T>}
      </View>
      <View style={styles.detailBalls}>
        {nums.map((n) => <Ball key={n} n={n} size="sm" />)}
        {nums.length === 0 && (
          <T variant="caption1" color="tertiary">없음</T>
        )}
      </View>
    </View>
  );
}

function CompareRow({
  label, description, nums, tone, emptyText, isLast,
}: {
  label: string; description: string; nums: number[];
  tone: 'success' | 'accent' | 'danger' | 'warning';
  emptyText: string; isLast?: boolean;
}) {
  const t = useTheme();
  const dotColor =
    tone === 'success' ? palette.green500
    : tone === 'accent' ? palette.blue500
    : tone === 'warning' ? palette.purple500
    : palette.red500;
  // Chip tone fallback
  const chipTone: 'success' | 'accent' | 'danger' | 'purple' =
    tone === 'warning' ? 'purple' : tone;
  return (
    <View style={[styles.apprRow, !isLast && { borderBottomWidth: 1, borderBottomColor: t.borderDivider }]}>
      <View style={styles.apprHead}>
        <View style={[styles.apprDot, { backgroundColor: dotColor }]} />
        <View style={{ flex: 1 }}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{label}</T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 1 }}>{description}</T>
        </View>
        <Chip
          label={nums.length > 0 ? `${nums.length}개` : '0'}
          tone={nums.length > 0 ? chipTone : 'neutral'}
          compact
        />
      </View>
      <View style={styles.apprBalls}>
        {nums.length > 0
          ? nums.map((n) => <Ball key={n} n={n} size="sm" />)
          : <T variant="caption1" color="tertiary" style={{ fontStyle: 'italic' }}>{emptyText}</T>}
      </View>
    </View>
  );
}

function NavBtn({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.navBtn,
        {
          backgroundColor: disabled ? t.borderDivider : t.bgSurface,
          borderColor: t.borderWeak,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <T
        variant="label1n"
        color={disabled ? 'disabled' : 'primary'}
        style={{ fontWeight: '700' }}
      >
        {label}
      </T>
    </Pressable>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeAppearance(
  draw: Draw,
  drawsMap: Record<number, Draw>,
  round: number,
): { recent5: number[]; recent6to10: number[]; missing10: number[] } {
  const cur = draw.nums;
  const setR1to5 = new Set<number>();
  const setR6to10 = new Set<number>();
  for (let i = 1; i <= 5; i++) {
    const d = drawsMap[round - i];
    if (d) for (const n of d.nums) setR1to5.add(n);
  }
  for (let i = 6; i <= 10; i++) {
    const d = drawsMap[round - i];
    if (d) for (const n of d.nums) setR6to10.add(n);
  }
  const recent5: number[] = [];
  const recent6to10: number[] = [];
  const missing10: number[] = [];
  for (const n of cur) {
    if (setR1to5.has(n)) recent5.push(n);
    else if (setR6to10.has(n)) recent6to10.push(n);
    else missing10.push(n);
  }
  return { recent5, recent6to10, missing10 };
}

function koreanDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function formatWon(n: number): string {
  if (n <= 0) return '0원';
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const won = n % 10_000;
  // 1만원 미만 (예: 5등 5,000원) → 원 단위로 표시
  if (eok === 0 && man === 0) return `${won.toLocaleString('ko')}원`;
  if (eok === 0) return `${man.toLocaleString('ko')}만원`;
  if (man === 0) return `${eok}억원`;
  return `${eok}억 ${man.toLocaleString('ko')}만원`;
}

function acHint(v: number): string {
  if (v <= 5) return '낮음';
  if (v <= 7) return '평균';
  if (v <= 9) return '높음';
  return '매우 높음';
}

function sumBand(s: number): string {
  if (s < 100) return '저';
  if (s <= 175) return '균형';
  if (s <= 200) return '고';
  return '매우 고';
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  hero: { borderRadius: radius.xl + 2, padding: 18 },
  heroHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  latestPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
  },
  heroFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  heroSales: {
    marginTop: 6,
    alignItems: 'flex-end',
  },

  // ── 카드 공통 헤더
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  noticeBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
  },

  // ── 등위별 당첨 정보
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  prizeBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 당첨 판매점
  storeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeRankPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  storeItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },

  // ── 요약 그리드: 4 columns × 2 rows
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statCell: {
    // ((100% - 3*6) / 4) using flexBasis won't work in RN strictly; use width via percent
    flexGrow: 1,
    flexBasis: '23%',
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statFootRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },

  // ── 수학적 특성
  propRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,115,124,0.10)',
    alignItems: 'center',
  },
  propLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  propBalls: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  dupGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dupChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },

  // ── 구간별 분포
  segRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,115,124,0.10)',
  },
  segTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  segFill: {
    height: '100%',
    borderRadius: 5,
  },

  // ── 홀짝/저고
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  detailBalls: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },

  // ── 비교/출현
  apprRow: {
    paddingVertical: 12,
  },
  apprHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  apprDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  apprBalls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    paddingLeft: 18,
  },

  // ── 네비 (하단 고정 바)
  navBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  navBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 타이틀 버튼 (탭하면 모달 오픈)
  titleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: radius.md,
  },

  // ── 회차 점프 모달
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
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  inputRow: {
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
  input: {
    flex: 1,
    fontSize: 18,
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
  jumpRow: {
    flexDirection: 'row',
    gap: 6,
  },
  jumpBtn: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  shortcutBtn: {
    flex: 1,
    height: 42,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
