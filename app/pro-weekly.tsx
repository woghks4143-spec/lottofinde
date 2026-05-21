/**
 * PRO 주간 출현 — /pro-weekly
 *
 * 일반 모드의 "특정 주간 출현"을 전문가급으로 확장하되
 * UI는 통계 용어 없이 누구나 이해할 수 있게 평이한 한글로.
 *
 *   1. 회차 범위 자유 지정 (5~100 + 직접 입력)
 *   2. 4단계 (자주 / 보통 이상 / 보통 이하 / 거의 안 나옴)
 *   3. 번호별 시계열 추이 (셀 탭 시 모달)
 *   4. 기간 비교 (최근 vs 이전 · 변화량 표시)
 *   5. 평이한 인사이트 자동 안내
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line as SvgLine } from 'react-native-svg';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import { frequency } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const GOLD = '#e8b04e';
const GOLD_DARK = '#a37116';

const RANGE_PRESETS = [5, 10, 20, 30, 50, 100];

// 4단계 — 통계 용어 대신 평이한 한글 라벨
type Tier = 'hot' | 'warm' | 'cold' | 'frozen';
const TIER_META: Record<Tier, { emoji: string; label: string; full: string; color: string; soft: string }> = {
  hot:    { emoji: '🔥', label: '자주',       full: '자주 나온 번호',    color: palette.red500,  soft: 'rgba(255,66,66,0.10)' },
  warm:   { emoji: '🌡', label: '보통 이상',   full: '보통보다 자주',     color: '#ea580c',       soft: 'rgba(234,88,12,0.10)' },
  cold:   { emoji: '❄️', label: '보통 이하',   full: '보통보다 드물게',   color: palette.blue500, soft: 'rgba(0,102,255,0.10)' },
  frozen: { emoji: '🧊', label: '거의 안 나옴', full: '거의 안 나온 번호', color: '#888',          soft: 'rgba(136,136,136,0.10)' },
};

export default function ProWeekly() {
  const t = useTheme();
  const goBack = useSafeBack('/pro-analysis');
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);
  const drawsMap = useHistory((s) => s.draws);

  const [weeks, setWeeks] = useState<number>(20);
  const [compareMode, setCompareMode] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [selectedNum, setSelectedNum] = useState<number | null>(null);

  /** 최근 N회 (분석 대상) + 이전 N회 (비교용). */
  const slices = useMemo(() => {
    if (!latestRound || !earliestRound) return null;
    const recent: { round: number; nums: number[] }[] = [];
    const fromR = Math.max(earliestRound, latestRound - weeks + 1);
    for (let r = latestRound; r >= fromR; r--) {
      const d = drawsMap[r];
      if (d) recent.push({ round: r, nums: d.nums });
    }
    const prev: { round: number; nums: number[] }[] = [];
    const prevTo = fromR - 1;
    const prevFrom = Math.max(earliestRound, prevTo - weeks + 1);
    for (let r = prevTo; r >= prevFrom; r--) {
      const d = drawsMap[r];
      if (d) prev.push({ round: r, nums: d.nums });
    }
    return { recent, prev, recentRange: [fromR, latestRound], prevRange: [prevFrom, prevTo] };
  }, [drawsMap, latestRound, earliestRound, weeks]);

  /** 분석 — 빈도, 평균, 티어, 인사이트. */
  const analysis = useMemo(() => {
    if (!slices) return null;
    const freq = frequency(slices.recent);
    const prevFreq = compareMode && slices.prev.length > 0 ? frequency(slices.prev) : null;

    const counts = freq.count.slice(1);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;

    // 가장 자주 나온 / 가장 안 나온
    const ranked = Array.from({ length: 45 }, (_, i) => i + 1).sort(
      (a, b) => freq.count[b] - freq.count[a],
    );
    const topNum = ranked[0];
    const topCount = freq.count[topNum];
    // 동률 처리: 최저 횟수 가진 모든 번호 찾기
    const minCount = freq.count[ranked[44]];
    const minNums = ranked.filter((n) => freq.count[n] === minCount).sort((a, b) => a - b);

    // 변화량 (compare)
    const changeMap = new Map<number, number>();
    if (prevFreq) {
      for (let n = 1; n <= 45; n++) {
        changeMap.set(n, freq.count[n] - prevFreq.count[n]);
      }
    }

    // 티어 분류
    const tier = new Map<number, Tier>();
    ranked.forEach((n, idx) => {
      if (idx < 9) tier.set(n, 'hot');
      else if (idx < 23) tier.set(n, 'warm');
      else if (idx < 37) tier.set(n, 'cold');
      else tier.set(n, 'frozen');
    });
    const tierGroups: Record<Tier, number[]> = { hot: [], warm: [], cold: [], frozen: [] };
    for (let n = 1; n <= 45; n++) tierGroups[tier.get(n)!].push(n);

    // 티어별 통계 — 회차당 평균 출현 개수 + 직전 회차 적중 개수
    const winSize = slices.recent.length;
    const tierStats: Record<Tier, { totalApp: number; avgPerRound: number; latestHit: number }> = {
      hot:    { totalApp: 0, avgPerRound: 0, latestHit: 0 },
      warm:   { totalApp: 0, avgPerRound: 0, latestHit: 0 },
      cold:   { totalApp: 0, avgPerRound: 0, latestHit: 0 },
      frozen: { totalApp: 0, avgPerRound: 0, latestHit: 0 },
    };
    const latestNums = slices.recent[0]?.nums ?? []; // 가장 최근 회차의 본번호
    (['hot', 'warm', 'cold', 'frozen'] as Tier[]).forEach((tierName) => {
      const nums = tierGroups[tierName];
      const totalApp = nums.reduce((sum, n) => sum + freq.count[n], 0);
      const latestHit = nums.filter((n) => latestNums.includes(n)).length;
      tierStats[tierName] = {
        totalApp,
        avgPerRound: winSize > 0 ? totalApp / winSize : 0,
        latestHit,
      };
    });

    // 평이한 인사이트
    type Insight = { emoji: string; text: string; color: string };
    const insights: Insight[] = [];
    // 평균 대비 매우 자주
    const aboveAvg = topCount - mean;
    if (aboveAvg >= 2) {
      insights.push({
        emoji: '🔥',
        text: `${topNum}번이 ${topCount}회 출현 — 평균보다 ${aboveAvg.toFixed(1)}회 더 자주 나왔어요`,
        color: palette.red500,
      });
    }
    if (minCount === 0 && minNums.length > 0) {
      let zeroText: string;
      if (minNums.length === 1) {
        zeroText = `${minNums[0]}번이 한 번도 안 나왔어요`;
      } else if (minNums.length <= 3) {
        zeroText = `${minNums.join('·')}번이 한 번도 안 나왔어요`;
      } else {
        zeroText = `${minNums.slice(0, 3).join('·')} 등 ${minNums.length}개 번호가 한 번도 안 나왔어요`;
      }
      insights.push({ emoji: '🧊', text: zeroText, color: palette.blue700 });
    } else if (minCount < mean - 1.5) {
      insights.push({
        emoji: '🧊',
        text: `${minNums[0]}번이 ${minCount}회만 출현 — 평균보다 ${(mean - minCount).toFixed(1)}회 적게 나왔어요`,
        color: palette.blue700,
      });
    }
    // 큰 변화 (compare)
    if (prevFreq) {
      const changes = Array.from({ length: 45 }, (_, i) => i + 1).sort(
        (a, b) => (changeMap.get(b) || 0) - (changeMap.get(a) || 0),
      );
      const upN = changes[0];
      const upDelta = changeMap.get(upN) || 0;
      const downN = changes[44];
      const downDelta = changeMap.get(downN) || 0;
      if (upDelta >= 3) {
        insights.push({
          emoji: '📈',
          text: `${upN}번이 이전 ${weeks}회보다 +${upDelta}회 더 자주 나왔어요`,
          color: palette.red500,
        });
      }
      if (downDelta <= -3) {
        insights.push({
          emoji: '📉',
          text: `${downN}번이 이전 ${weeks}회보다 ${downDelta}회 적게 나왔어요`,
          color: palette.blue700,
        });
      }
    }

    return {
      freq, prevFreq, mean, changeMap, tier, tierGroups, tierStats, insights,
      topNum, topCount, minNums, minCount,
    };
  }, [slices, compareMode, weeks]);

  /** 선택된 번호의 추이. */
  const trendData = useMemo(() => {
    if (selectedNum == null || !slices) return null;
    const hits = slices.recent.map((d) => ({
      round: d.round,
      hit: d.nums.includes(selectedNum),
    }));
    const total = hits.filter((h) => h.hit).length;
    // 가장 최근에 나온 시점 (없으면 null)
    const lastHitIdx = hits.findIndex((h) => h.hit);
    return { hits, total, lastHitIdx };
  }, [selectedNum, slices]);

  const applyCustom = () => {
    const n = parseInt(customInput.replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(n) && n > 0) {
      const maxN = (latestRound || 1) - (earliestRound || 0) + 1;
      setWeeks(Math.min(Math.max(1, n), maxN));
      setPickerOpen(false);
      setCustomInput('');
    }
  };

  if (!slices || !analysis) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
        <AppBar title="주간 출현" onBack={goBack} />
        <View style={{ padding: 24 }}>
          <T variant="body2r" color="secondary">데이터가 부족합니다.</T>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon.crown color={GOLD} size={16} weight={2} />
            <T variant="heading1" color="primary">주간 출현</T>
          </View>
        }
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* 히어로 — 상황 한 줄로 요약 (라이트/다크 자동 분기) */}
        <View style={[styles.hero, { backgroundColor: t.bgHero }]}>
          <View style={[styles.proPill, { backgroundColor: GOLD }]}>
            <Icon.crown color="#fff" size={12} weight={2.5} />
            <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10, marginLeft: 3 }}>PRO</T>
          </View>
          <T variant="title3" style={{ color: t.fgOnHero, fontWeight: '800', marginTop: 12 }}>
            최근 {weeks}회차에서…
          </T>
          <T variant="caption1" style={{ color: t.fgOnHeroMuted, marginTop: 2 }}>
            {slices.recentRange[0]}회 ~ {slices.recentRange[1]}회 분석 결과
          </T>

          {/* Top / Bottom 하이라이트 */}
          <View style={styles.heroHighlight}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T allowFontScaling={false} style={{ fontSize: 22 }}>🔥</T>
              <View style={{ flex: 1 }}>
                <T variant="caption2" allowFontScaling={false} style={{ color: t.fgOnHeroMuted, fontSize: 10.5 }}>
                  가장 자주 나온 번호
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Ball n={analysis.topNum} size="sm" />
                  <T variant="label1n" style={{ color: t.fgOnHero, fontWeight: '800' }}>
                    {analysis.topCount}회 출현
                  </T>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.heroHighlight}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T allowFontScaling={false} style={{ fontSize: 22 }}>🧊</T>
              <View style={{ flex: 1 }}>
                <T variant="caption2" allowFontScaling={false} style={{ color: t.fgOnHeroMuted, fontSize: 10.5 }}>
                  가장 안 나온 번호
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  {analysis.minNums.slice(0, 5).map((n) => <Ball key={n} n={n} size="sm" />)}
                  <T variant="label1n" style={{ color: t.fgOnHero, fontWeight: '800' }}>
                    {analysis.minCount}회 {analysis.minCount === 0 ? '(한 번도 안 나옴)' : ''}
                  </T>
                </View>
              </View>
            </View>
          </View>

          <T variant="caption2" allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.5)', marginTop: 14, fontSize: 10.5 }}>
            💡 6개씩 {weeks}회 = 총 {slices.recent.length * 6}개 번호가 나왔고, 한 번호당 평균 {analysis.mean.toFixed(1)}회 출현이에요
          </T>
        </View>

        {/* 회차 범위 선택 */}
        <Card padding={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
              📅 분석 기간
            </T>
            <Pressable
              onPress={() => setCompareMode((v) => !v)}
              style={({ pressed }) => [
                styles.compareToggle,
                {
                  backgroundColor: compareMode ? GOLD : t.bgSurface2,
                  borderColor: compareMode ? GOLD : t.borderDivider,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <T variant="caption2" allowFontScaling={false} style={{ color: compareMode ? '#fff' : t.fgSecondary, fontWeight: '800', fontSize: 11 }}>
                이전 기간과 비교 {compareMode ? 'ON' : 'OFF'}
              </T>
            </Pressable>
          </View>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginBottom: 10, fontSize: 10.5 }}>
            몇 회차를 분석할지 선택
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {RANGE_PRESETS.map((n) => {
              const on = weeks === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setWeeks(n)}
                  style={({ pressed }) => [
                    styles.chip,
                    { backgroundColor: on ? GOLD : t.bgSurface2, borderColor: on ? GOLD : t.borderDivider, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <T variant="caption1" allowFontScaling={false} style={{ color: on ? '#fff' : t.fgSecondary, fontWeight: '800', fontSize: 12 }}>
                    최근 {n}회
                  </T>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: t.bgSurface, borderColor: t.borderNormal, opacity: pressed ? 0.85 : 1, borderStyle: 'dashed' },
              ]}
            >
              <T variant="caption1" allowFontScaling={false} style={{ color: t.fgSecondary, fontWeight: '800', fontSize: 12 }}>
                직접 입력
              </T>
            </Pressable>
          </View>
          {compareMode && slices.prev.length > 0 && (
            <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginTop: 10, fontSize: 10.5 }}>
              비교 기간: {slices.prevRange[0]}회 ~ {slices.prevRange[1]}회 ({slices.prev.length}회)
            </T>
          )}
        </Card>

        {/* 자동 인사이트 */}
        {analysis.insights.length > 0 && (
          <Card padding={16}>
            <T variant="label1n" color="primary" style={{ fontWeight: '800', marginBottom: 4 }}>
              💡 한눈에 보기
            </T>
            <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginBottom: 10, fontSize: 10.5 }}>
              이번 분석에서 눈에 띄는 점
            </T>
            <View style={{ gap: 6 }}>
              {analysis.insights.map((it, i) => (
                <View key={i} style={[styles.insightRow, { backgroundColor: 'rgba(0,0,0,0.02)', borderColor: t.borderDivider }]}>
                  <T allowFontScaling={false} style={{ fontSize: 16 }}>{it.emoji}</T>
                  <T variant="caption1" color="primary" style={{ flex: 1, marginLeft: 8, lineHeight: 18, fontWeight: '600' }}>
                    {it.text}
                  </T>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* 범례 + 그리드 */}
        <Card padding={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
              🎯 1~45 번호 분포
            </T>
            <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5 }}>
              탭하면 상세
            </T>
          </View>
          {/* 범례 */}
          <View style={styles.legend}>
            {(['hot', 'warm', 'cold', 'frozen'] as Tier[]).map((tier) => (
              <View key={tier} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={[styles.legendDot, { backgroundColor: TIER_META[tier].color }]} />
                <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10 }}>
                  {TIER_META[tier].label}
                </T>
              </View>
            ))}
          </View>
          <View style={styles.grid}>
            {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
              const tierName = analysis.tier.get(n)!;
              const tierColor = TIER_META[tierName].color;
              const count = analysis.freq.count[n];
              return (
                <Pressable
                  key={n}
                  onPress={() => setSelectedNum(n)}
                  style={({ pressed }) => [
                    styles.gridCell,
                    {
                      backgroundColor: tierColor,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <T variant="label1n" compact allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                    {n}
                  </T>
                  <T variant="caption2" compact allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 8.5, marginTop: 1, fontWeight: '700' }}>
                    {count}회
                  </T>
                  {compareMode && (
                    <View style={styles.changeBadge}>
                      <T variant="caption2" compact allowFontScaling={false} style={{ color: '#fff', fontSize: 7.5, fontWeight: '800' }}>
                        {fmtChange(analysis.changeMap.get(n) || 0)}
                      </T>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginTop: 10, fontSize: 10.5, lineHeight: 14 }}>
            셀 안의 숫자는 {weeks}회차 동안 출현 횟수 · 색상은 4단계 그룹
            {compareMode ? ' · 우상단 작은 숫자는 이전 기간 대비 변화량' : ''}
          </T>
        </Card>

        {/* 4단계 그룹별 분포 */}
        <Card padding={14}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            🌡 4단계 그룹
          </T>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginTop: 2, marginBottom: 10, fontSize: 10.5 }}>
            각 그룹의 회차당 평균 출현 수 — 통계적으로 안정된 추천 풀 만들 때 참고
          </T>
          <View style={{ gap: 8 }}>
            {(['hot', 'warm', 'cold', 'frozen'] as Tier[]).map((tier) => {
              const meta = TIER_META[tier];
              const nums = analysis.tierGroups[tier];
              const stat = analysis.tierStats[tier];
              return (
                <View key={tier} style={[styles.tierCard, { backgroundColor: meta.soft, borderColor: meta.color + '33' }]}>
                  {/* 헤더 — 라벨 + 평균 stat pill */}
                  <View style={styles.tierHead}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <T allowFontScaling={false} style={{ fontSize: 16 }}>{meta.emoji}</T>
                      <T variant="label1n" allowFontScaling={false} style={{ fontWeight: '800', color: meta.color, fontSize: 13 }}>
                        {meta.full}
                      </T>
                      <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5 }}>
                        ({nums.length}개)
                      </T>
                    </View>
                    <View style={[styles.tierAvgPill, { backgroundColor: meta.color }]}>
                      <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10.5 }}>
                        회차당 평균 {stat.avgPerRound.toFixed(1)}개
                      </T>
                    </View>
                  </View>
                  {/* 부가 정보 — 직전 회차 매칭 */}
                  <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginTop: 4, fontSize: 10, lineHeight: 14 }}>
                    {weeks}회 동안 총 {stat.totalApp}개 출현 · 직전 회차에는 {stat.latestHit}개 매칭
                  </T>
                  {/* 번호 공들 */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                    {nums.map((n) => (
                      <Pressable key={n} onPress={() => setSelectedNum(n)}>
                        <Ball n={n} size="sm" />
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        <Disclaimer />
      </ScrollView>

      {/* 직접 입력 모달 */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: t.bgSurface }]} onPress={(e) => e.stopPropagation()}>
            <T variant="headline2" color="primary" style={{ fontWeight: '800' }}>회차 직접 입력</T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 4 }}>
              최근 몇 회차를 볼까요? (최대 {(latestRound || 1) - (earliestRound || 0) + 1}회)
            </T>
            <TextInput
              value={customInput}
              onChangeText={setCustomInput}
              placeholder="예: 50"
              placeholderTextColor={t.fgTertiary}
              keyboardType="number-pad"
              style={[styles.input, { borderColor: t.borderNormal, color: t.fgPrimary, backgroundColor: t.bgCanvas }]}
              autoFocus
              onSubmitEditing={applyCustom}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable onPress={() => setPickerOpen(false)} style={[styles.modalBtn, { backgroundColor: t.bgSurface2, borderColor: t.borderNormal }]}>
                <T variant="body2n" color="secondary" style={{ fontWeight: '700' }}>취소</T>
              </Pressable>
              <Pressable onPress={applyCustom} style={[styles.modalBtn, { backgroundColor: GOLD, borderColor: GOLD }]}>
                <T variant="body2n" style={{ color: t.fgOnHero, fontWeight: '800' }}>적용</T>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 번호 상세 모달 */}
      <Modal visible={selectedNum != null} transparent animationType="fade" onRequestClose={() => setSelectedNum(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedNum(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: t.bgSurface, maxWidth: 380 }]} onPress={(e) => e.stopPropagation()}>
            {selectedNum != null && trendData && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Ball n={selectedNum} size="lg" />
                    <View>
                      <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>
                        {selectedNum}번
                      </T>
                      {(() => {
                        const tier = analysis.tier.get(selectedNum)!;
                        const meta = TIER_META[tier];
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <T allowFontScaling={false} style={{ fontSize: 12 }}>{meta.emoji}</T>
                            <T variant="caption1" allowFontScaling={false} style={{ color: meta.color, fontWeight: '800', fontSize: 12 }}>
                              {meta.full}
                            </T>
                          </View>
                        );
                      })()}
                    </View>
                  </View>
                  <Pressable onPress={() => setSelectedNum(null)} hitSlop={8}>
                    <Icon.close color={t.fgSecondary} size={20} />
                  </Pressable>
                </View>

                {/* 핵심 통계 — 한 줄 문장으로 */}
                <View style={[styles.trendSummary, { backgroundColor: t.bgSurface2 }]}>
                  <T variant="caption1" color="primary" style={{ lineHeight: 20 }}>
                    최근 <T variant="caption1" color="primary" style={{ fontWeight: '800' }}>{trendData.hits.length}회차</T> 중{' '}
                    <T variant="caption1" allowFontScaling={false} style={{ fontWeight: '800', color: trendData.total > 0 ? palette.red500 : palette.blue700 }}>
                      {trendData.total}회
                    </T>{' '}
                    출현 ({Math.round((trendData.total / trendData.hits.length) * 100)}%)
                  </T>
                  {trendData.lastHitIdx >= 0 ? (
                    <T variant="caption1" color="secondary" style={{ marginTop: 4 }}>
                      가장 최근: <T variant="caption1" color="primary" style={{ fontWeight: '700' }}>{trendData.lastHitIdx === 0 ? '직전 회차' : `${trendData.lastHitIdx}회차 전`}</T>
                    </T>
                  ) : (
                    <T variant="caption1" color="secondary" style={{ marginTop: 4 }}>
                      이 기간에는 <T variant="caption1" style={{ color: palette.blue700, fontWeight: '700' }}>한 번도 안 나왔어요</T>
                    </T>
                  )}
                </View>

                <T variant="caption1" color="secondary" style={{ marginTop: 14, fontWeight: '700' }}>
                  📊 {trendData.hits.length}회차 출현 흐름
                </T>
                <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginTop: 2, fontSize: 10.5 }}>
                  왼쪽이 가장 옛날, 오른쪽이 가장 최근
                </T>
                <TrendChart hits={trendData.hits} t={t} />

                {/* 출현 회차 목록 */}
                {trendData.total > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <T variant="caption1" color="secondary" allowFontScaling={false} style={{ fontWeight: '700', marginBottom: 6 }}>
                      🔵 출현한 회차 {trendData.total}개
                    </T>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {trendData.hits
                        .filter((h) => h.hit)
                        .map((h) => h.round)
                        .sort((a, b) => b - a)
                        .map((r) => (
                          <View key={r} style={[styles.roundPill, { backgroundColor: 'rgba(0,102,255,0.10)', borderColor: 'rgba(0,102,255,0.30)' }]}>
                            <T variant="caption2" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '800', fontSize: 11 }}>
                              {r}회
                            </T>
                          </View>
                        ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── 트렌드 차트 — 점만 (출현 = 큰 파랑, 미출현 = 작은 회색) ──── */

function TrendChart({ hits, t }: { hits: { round: number; hit: boolean }[]; t: ReturnType<typeof useTheme> }) {
  const W = 320;
  const H = 56;
  const PAD = 12;
  const ordered = [...hits].reverse();
  const innerW = W - PAD * 2;
  const dx = ordered.length > 1 ? innerW / (ordered.length - 1) : 0;
  const cy = H / 2;

  return (
    <View style={{ marginTop: 6, alignItems: 'center' }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <SvgLine x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke={t.borderDivider} strokeWidth="1" />
        {ordered.map((o, i) => (
          <Circle
            key={i}
            cx={PAD + i * dx}
            cy={cy}
            r={o.hit ? 5.5 : 2.5}
            fill={o.hit ? palette.blue500 : 'rgba(150,150,150,0.45)'}
            stroke={o.hit ? '#fff' : undefined}
            strokeWidth={o.hit ? 1.5 : 0}
          />
        ))}
      </Svg>
    </View>
  );
}

/* ─── 헬퍼 ─────────────────────────────────────────────────── */

function fmtChange(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '0';
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: { borderRadius: radius.xl + 2, padding: 22 },
  proPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  heroHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
  },

  compareToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },

  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  legendDot: {
    width: 10, height: 10, borderRadius: 3,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridCell: {
    width: '10.5%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  changeBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 3,
    borderRadius: 4,
  },

  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    gap: 10,
  },
  tierCard: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  tierHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tierAvgPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  roundPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },

  trendSummary: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
  },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: radius.xl, padding: 20 },
  input: {
    marginTop: 12, height: 44, borderRadius: radius.md, borderWidth: 1,
    paddingHorizontal: 12, fontSize: 16,
  },
  modalBtn: {
    flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
