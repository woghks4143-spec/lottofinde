/**
 * PRO 출현 분석 — /pro-appearance-stats
 *
 * 1번 ~ 45번 각 번호의 출현 패턴을 깊이 분석.
 *   - 총 출현 횟수 / 출현률
 *   - 최장 연속 출현
 *   - 최장 미출현 구간
 *   - 현재 미출현 회차 수
 *   - 평균 출현 주기
 *   - 임박도 (현재 미출현 / 평균 주기)
 *   - 최근 5회 출현 이력
 *
 * 상단에 "주목할 번호" 3종 (임박/장기 미출현/핫) 표시.
 * 정렬 칩으로 4가지 기준 전환 가능.
 * 각 행 탭으로 펼쳐서 최근 출현 이력 확인.
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
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';
import { computeAllNumberStats, computeRangeBands, overdueStars, type NumberStats } from '@/src/lib/appearanceStats';

const GOLD = '#e8b04e';

const SORTS = ['번호순', '출현 많음', '장기 미출현', '임박도'] as const;
type SortKey = typeof SORTS[number];

export default function ProAppearanceStats() {
  const t = useTheme();
  const goBack = useSafeBack('/pro-analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);

  const [sortBy, setSortBy] = useState<SortKey>('임박도');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // 분석 기준 회차 — 기본은 최신, 사용자가 과거 회차 선택 가능
  const [round, setRound] = useState<number>(latestRound);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInput, setPickerInput] = useState('');

  const targetDraw = drawsMap[round] ?? null;
  const totalRoundsAnalyzed = round - earliestRound + 1;

  // 분석 기준 회차의 다음 회차 = 예측 대상 회차. 적중 검증용.
  const nextDraw = drawsMap[round + 1] ?? null;
  const nextSet = useMemo(() => {
    if (!nextDraw) return null;
    return new Set(nextDraw.nums);
  }, [nextDraw]);
  const nextBonus = nextDraw?.bonus ?? null;

  const allStats = useMemo(
    () => computeAllNumberStats(drawsMap, round, earliestRound, 30),
    [drawsMap, round, earliestRound],
  );

  const jumpTo = (n: number) => {
    const clamped = Math.max(earliestRound, Math.min(latestRound, Math.round(n)));
    setRound(clamped);
    setPickerOpen(false);
    setPickerInput('');
  };
  const submitPicker = () => {
    const n = parseInt(pickerInput.replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(n)) jumpTo(n);
  };

  // 주목할 번호 — 임박 TOP 3 / 잠수 TOP 3 / 핫 TOP 3
  const featured = useMemo(() => {
    const overdue = [...allStats]
      .filter((s) => s.totalAppearances > 0)
      .sort((a, b) => b.overdueScore - a.overdueScore)
      .slice(0, 3);
    const longestGap = [...allStats]
      .sort((a, b) => b.currentGap - a.currentGap)
      .slice(0, 3);
    const hot = [...allStats]
      .sort((a, b) => b.recentNAppearances - a.recentNAppearances || a.n - b.n)
      .slice(0, 3);
    return { overdue, longestGap, hot };
  }, [allStats]);

  // 추천 TOP 10 (점수 내림차순)
  const recommendTop10 = useMemo(() => {
    return [...allStats]
      .sort((a, b) => b.recommendScore - a.recommendScore || a.n - b.n)
      .slice(0, 10);
  }, [allStats]);

  // 번호 구간별 평균 추천 점수
  const rangeBands = useMemo(() => {
    const bands = computeRangeBands(allStats);
    return [...bands].sort((a, b) => b.avgScore - a.avgScore);
  }, [allStats]);

  const sortedStats = useMemo(() => {
    const arr = [...allStats];
    switch (sortBy) {
      case '번호순':
        arr.sort((a, b) => a.n - b.n); break;
      case '출현 많음':
        arr.sort((a, b) => b.totalAppearances - a.totalAppearances || a.n - b.n); break;
      case '장기 미출현':
        arr.sort((a, b) => b.currentGap - a.currentGap || a.n - b.n); break;
      case '임박도':
        arr.sort((a, b) => b.overdueScore - a.overdueScore || a.n - b.n); break;
    }
    return arr;
  }, [allStats, sortBy]);

  const titleNode = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon.crown color={GOLD} size={18} weight={2} />
      <T variant="heading1" color="primary">출현 분석</T>
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title={titleNode} onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        {/* 헤더 카드 — 회차 네비게이션 */}
        <View style={[styles.heroCard, { backgroundColor: palette.neutral950 }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroBadge, { backgroundColor: GOLD }]}>
              <Icon.crown color="#fff" size={12} weight={2.5} />
              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10, marginLeft: 4, letterSpacing: 0.4 }}>
                PRO
              </T>
            </View>
            <T variant="caption2" allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>
              1번 ~ 45번 출현 분석
            </T>
          </View>

          <View style={[styles.targetHead, { marginTop: 14 }]}>
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
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)' }}>분석 기준 회차</T>
              <T variant="title2" style={{ color: '#fff', fontWeight: '900', marginTop: 4 }}>
                제 {round}회
              </T>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                {targetDraw ? `${targetDraw.date} · ` : ''}1회 ~ {round}회 ({totalRoundsAnalyzed}회 데이터)
              </T>
            </View>
            <Pressable
              onPress={() => round < latestRound && setRound(round + 1)}
              disabled={round >= latestRound}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: 'rgba(255,255,255,0.10)',
                opacity: round >= latestRound ? 0.3 : pressed ? 0.6 : 1,
              }]}
            >
              <T variant="label1n" style={{ color: '#fff', fontWeight: '800' }} allowFontScaling={false}>›</T>
            </Pressable>
          </View>

          {/* 다음 회차 적중 검증 안내 */}
          {nextDraw && (
            <View style={styles.nextDrawBox}>
              <T variant="caption2" allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10.5, marginBottom: 4 }}>
                ⏭ 다음 {nextDraw.round}회 본번호 (적중 검증용)
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {nextDraw.nums.map((n) => (
                  <View key={n} style={styles.nextNumChip}>
                    <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>
                      {n}
                    </T>
                  </View>
                ))}
                <View style={[styles.nextNumChip, { backgroundColor: 'rgba(149,76,233,0.4)' }]}>
                  <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>
                    +{nextDraw.bonus}
                  </T>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* 빠른 회차 점프 */}
        <View style={styles.jumpRow}>
          <JumpBtn
            label={`최신 ${latestRound}회`}
            active={round === latestRound}
            onPress={() => setRound(latestRound)}
          />
          <JumpBtn
            label="회차 입력"
            active={false}
            onPress={() => { setPickerInput(String(round)); setPickerOpen(true); }}
            tone="input"
          />
        </View>

        {/* 주목할 번호 카드 */}
        <Card padding={14}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            📊 통계 지표 TOP
          </T>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 2 }}>
            세 가지 통계 지표 기준 상위 번호
          </T>

          <View style={{ gap: 10, marginTop: 12 }}>
            <FeaturedRow
              icon="📊"
              label="평균 주기 초과"
              tone="danger"
              items={featured.overdue.map((s) => ({
                n: s.n,
                meta: `${s.currentGap}회 미출현`,
                stars: overdueStars(s.overdueScore),
              }))}
              nextSet={nextSet}
              nextBonus={nextBonus}
            />
            <FeaturedRow
              icon="🌙"
              label="장기 미출현"
              tone="muted"
              items={featured.longestGap.map((s) => ({
                n: s.n,
                meta: `${s.currentGap}회 미출현`,
              }))}
              nextSet={nextSet}
              nextBonus={nextBonus}
            />
            <FeaturedRow
              icon="🔥"
              label="최근 30회 빈도 상위"
              tone="hot"
              items={featured.hot.map((s) => ({
                n: s.n,
                meta: `${s.recentNAppearances}회 출현`,
              }))}
              nextSet={nextSet}
              nextBonus={nextBonus}
            />
          </View>
        </Card>

        {/* 추천 TOP 10 */}
        <Card padding={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                🏆 추천 TOP 10
              </T>
              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 2 }}>
                통계 점수 상위 10개 번호
              </T>
            </View>
            {/* 적중 요약 — 다음 회차 데이터가 있을 때만 */}
            {nextSet && (() => {
              const mainHits = recommendTop10.filter((s) => nextSet.has(s.n)).length;
              const bonusHit = recommendTop10.some((s) => nextBonus === s.n);
              return (
                <View style={[styles.hitSummary, {
                  backgroundColor:
                    mainHits >= 3 ? palette.red500 :
                    mainHits === 2 ? '#ea580c' :
                    mainHits === 1 ? GOLD :
                    '#888',
                }]}>
                  <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                    {mainHits}{bonusHit ? '+B' : ''}
                  </T>
                  <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 9, fontWeight: '700', opacity: 0.85, marginTop: -2 }}>
                    적중
                  </T>
                </View>
              );
            })()}
          </View>
          <View style={styles.top10Grid}>
            {recommendTop10.map((s, idx) => {
              const isMain = nextSet?.has(s.n) ?? false;
              const isBonus = !isMain && nextBonus === s.n;
              const hit = isMain || isBonus;
              return (
                <View key={s.n} style={styles.top10Cell}>
                  <View style={styles.rankBadge}>
                    <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>
                      {idx + 1}
                    </T>
                  </View>
                  <Ball
                    n={s.n}
                    size="md"
                    dashedRing={hit}
                    dashedRingColor={isMain ? palette.red500 : isBonus ? palette.purple500 : undefined}
                  />
                  {hit && (
                    <T variant="caption2" allowFontScaling={false} style={{ color: palette.red500, fontSize: 9, fontWeight: '900', marginTop: 4 }}>
                      {isBonus ? '보너스' : '출현'}
                    </T>
                  )}
                </View>
              );
            })}
          </View>
        </Card>

        {/* 번호 구간 추천 */}
        <Card padding={14}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            📊 번호 구간 추천
          </T>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 2 }}>
            구간별 통계 점수 비교
          </T>
          <View style={{ gap: 8, marginTop: 12 }}>
            {rangeBands.map((b, idx) => (
              <RangeBandRow key={b.label} band={b} rank={idx + 1} maxScore={rangeBands[0].avgScore} />
            ))}
          </View>
        </Card>

        {/* 정렬 칩 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}
        >
          {SORTS.map((s) => {
            const on = sortBy === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSortBy(s)}
                style={({ pressed }) => [
                  styles.sortBtn,
                  {
                    backgroundColor: on ? t.bgAccent : t.bgSurface,
                    borderColor: on ? 'transparent' : t.borderWeak,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <T variant="caption1" style={{ color: on ? '#fff' : t.fgSecondary, fontWeight: '700' }}>
                  {s}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 45개 번호 상세 리스트 */}
        <View style={{ gap: 6 }}>
          {sortedStats.map((s) => (
            <NumberStatRow
              key={s.n}
              stats={s}
              expanded={!!expanded[s.n]}
              onToggle={() => setExpanded((e) => ({ ...e, [s.n]: !e[s.n] }))}
              maxAppearance={Math.max(...allStats.map((x) => x.totalAppearances))}
            />
          ))}
        </View>

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
              {earliestRound}회 ~ {latestRound}회
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
                <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800' }}>이동</T>
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

/* ─── 회차 점프 버튼 ────────────────────────────────────── */
function JumpBtn({ label, active, onPress, tone }: {
  label: string; active: boolean; onPress: () => void;
  tone?: 'input';
}) {
  const t = useTheme();
  const activeBg = palette.blue500;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.jumpBtn, {
        backgroundColor: active ? activeBg : t.bgSurface,
        borderColor: active ? 'transparent' : t.borderWeak,
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <T variant="caption1" style={{ color: active ? '#fff' : t.fgSecondary, fontWeight: '700' }} allowFontScaling={false}>
        {label}
      </T>
    </Pressable>
  );
}

/* ─── 번호 구간 추천 행 ──────────────────────────────────── */
function RangeBandRow({ band, rank, maxScore }: {
  band: { label: string; from: number; to: number; avgScore: number; totalRecentAppearances: number; avgOverdue: number };
  rank: number;
  maxScore: number;
}) {
  const t = useTheme();
  const ratio = maxScore > 0 ? band.avgScore / maxScore : 0;
  const isTop = rank === 1;
  // 구간별 톤 (히트맵과 동일)
  const zoneColor =
    band.from === 1  ? '#f5b400' :
    band.from === 11 ? '#3aa1ff' :
    band.from === 21 ? '#ff6c7a' :
    /* 31~45 */       '#666';

  return (
    <View style={[styles.rangeBandRow, isTop && { backgroundColor: 'rgba(232,176,78,0.08)', borderColor: GOLD }]}>
      <View style={styles.rangeBandLeft}>
        {isTop ? (
          <T allowFontScaling={false} style={{ fontSize: 14 }}>🥇</T>
        ) : (
          <T variant="caption1" color="tertiary" allowFontScaling={false} style={{ fontSize: 11, fontWeight: '700' }}>
            {rank}위
          </T>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.zoneDot, { backgroundColor: zoneColor }]} />
          <T variant="label1n" color="primary" allowFontScaling={false} style={{ fontSize: 13, fontWeight: '800' }}>
            {band.label}
          </T>
        </View>
        {/* 막대 — 상대적 강도만 표시 */}
        <View style={[styles.rangeBarTrack, { marginTop: 6 }]}>
          <View style={[styles.rangeBarFill, { width: `${Math.max(5, ratio * 100)}%`, backgroundColor: zoneColor }]} />
        </View>
      </View>
    </View>
  );
}

/* ─── 주목할 번호 행 (3개 칩) ─────────────────────────────── */
function FeaturedRow({ icon, label, items, tone, nextSet, nextBonus }: {
  icon: string;
  label: string;
  items: { n: number; meta: string; stars?: number }[];
  tone: 'danger' | 'muted' | 'hot';
  nextSet: Set<number> | null;
  nextBonus: number | null;
}) {
  const accent =
    tone === 'danger' ? palette.red500 :
    tone === 'hot'    ? '#ea580c' :
    /* muted */         '#666';
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <T allowFontScaling={false} style={{ fontSize: 14 }}>{icon}</T>
        <T variant="caption1" allowFontScaling={false} style={{ color: accent, fontWeight: '800', fontSize: 11.5 }}>
          {label}
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {items.map((it) => {
          const isMain = nextSet?.has(it.n) ?? false;
          const isBonus = !isMain && nextBonus === it.n;
          const hit = isMain || isBonus;
          return (
            <View key={it.n} style={styles.featuredChip}>
              <Ball
                n={it.n}
                size="md"
                dashedRing={hit}
                dashedRingColor={isMain ? palette.red500 : isBonus ? palette.purple500 : undefined}
              />
              <T variant="caption2" allowFontScaling={false} style={{ color: accent, fontWeight: '700', fontSize: 10, marginTop: 4 }}>
                {it.meta}
              </T>
              {it.stars != null && (
                <T variant="caption2" allowFontScaling={false} style={{ color: accent, fontSize: 9, fontWeight: '800', marginTop: 1 }}>
                  {'★'.repeat(it.stars)}{'☆'.repeat(5 - it.stars)}
                </T>
              )}
              {hit && (
                <T variant="caption2" allowFontScaling={false} style={{ color: palette.red500, fontSize: 9, fontWeight: '900', marginTop: 2 }}>
                  {isBonus ? '보너스' : '출현'}
                </T>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ─── 개별 번호 통계 행 ─────────────────────────────────── */
function NumberStatRow({ stats: s, expanded, onToggle, maxAppearance }: {
  stats: NumberStats;
  expanded: boolean;
  onToggle: () => void;
  maxAppearance: number;
}) {
  const t = useTheme();
  const ratio = maxAppearance > 0 ? s.totalAppearances / maxAppearance : 0;
  const stars = overdueStars(s.overdueScore);

  return (
    <Pressable onPress={onToggle}>
      <Card padding={12}>
        {/* 상단 라인: 번호 / 막대 / 출현 통계 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ball n={s.n} size="md" />

          {/* 막대 그래프 (출현 비율) */}
          <View style={{ flex: 1 }}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.max(2, ratio * 100)}%`, backgroundColor: palette.blue500 },
                ]}
              />
            </View>
            <T variant="caption2" color="secondary" allowFontScaling={false} style={{ fontSize: 10.5, fontWeight: '700', marginTop: 4 }}>
              {s.totalAppearances}회 ({(s.appearanceRate * 100).toFixed(1)}%)
            </T>
          </View>
        </View>

        {/* 하단 라인: 최장 연속 / 최장 미출현 / 현재 미출현 / 임박도 */}
        <View style={styles.statRow}>
          <StatPill label="최장 연속" value={`${s.longestStreak}회`} tone="success" />
          <StatPill label="최장 미출현" value={`${s.longestGap}회`} tone="muted" />
          <StatPill label="현재 미출현" value={`${s.currentGap}회`} tone="warning" />
          <StatPill
            label="임박도"
            value={stars > 0 ? '★'.repeat(stars) + '☆'.repeat(5 - stars) : '☆☆☆☆☆'}
            tone={stars >= 4 ? 'danger' : stars >= 3 ? 'warning' : 'muted'}
          />
        </View>

        {/* 펼쳐졌을 때: 최근 출현 회차 */}
        {expanded && (
          <View style={[styles.expandBox, { borderTopColor: t.borderDivider }]}>
            <T variant="caption2" color="secondary" allowFontScaling={false} style={{ fontSize: 10.5, fontWeight: '700' }}>
              최근 출현 회차 (최대 5개)
            </T>
            {s.recentRounds.length === 0 ? (
              <T variant="caption1" color="tertiary" style={{ fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
                출현 기록 없음
              </T>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {[...s.recentRounds].reverse().map((r) => (
                  <View key={r} style={[styles.roundChip, { backgroundColor: t.bgSurface2 }]}>
                    <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: t.fgSecondary, fontWeight: '700' }}>
                      {r}회
                    </T>
                  </View>
                ))}
              </View>
            )}
            {s.lastAppearance != null && (
              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, marginTop: 8 }}>
                최근 출현: {s.lastAppearance}회 · 그 이후 {s.currentGap}회 동안 미출현
              </T>
            )}
          </View>
        )}
      </Card>
    </Pressable>
  );
}

/* ─── 작은 stat pill ──────────────────────────────────── */
function StatPill({ label, value, tone }: {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'danger' | 'muted';
}) {
  const color =
    tone === 'success' ? palette.green700 :
    tone === 'warning' ? '#ea580c' :
    tone === 'danger'  ? palette.red500 :
    /* muted */          '#888';
  const bg =
    tone === 'success' ? 'rgba(0,191,64,0.10)' :
    tone === 'warning' ? 'rgba(234,88,12,0.10)' :
    tone === 'danger'  ? 'rgba(248,72,79,0.10)' :
    /* muted */          'rgba(127,127,127,0.08)';
  return (
    <View style={[styles.statPill, { backgroundColor: bg }]}>
      <T variant="caption2" allowFontScaling={false} style={{ color, fontSize: 9.5, fontWeight: '700' }}>
        {label}
      </T>
      <T variant="caption1" allowFontScaling={false} style={{ color, fontSize: 11, fontWeight: '900', marginTop: 1 }}>
        {value}
      </T>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },

  heroCard: {
    borderRadius: radius.xl,
    padding: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },

  // 다음 회차 본번호 표시 (적중 검증)
  nextDrawBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  nextNumChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },

  // 추천 TOP 10 적중 요약 배지
  hitSummary: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },

  // 회차 네비게이션
  targetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navArrow: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  jumpRow: { flexDirection: 'row', gap: 6 },
  jumpBtn: {
    flex: 1, height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
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

  featuredChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    backgroundColor: 'rgba(127,127,127,0.06)',
  },

  // 추천 TOP 10 그리드
  top10Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  top10Cell: {
    width: '18.4%',  // 5열 × 8px gap 균등
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(232,176,78,0.06)',
    borderRadius: radius.md,
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  // 구간 추천
  rangeBandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.15)',
  },
  rangeBandLeft: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rangeBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(127,127,127,0.12)',
    overflow: 'hidden',
  },
  rangeBarFill: {
    height: '100%',
    borderRadius: 3,
  },


  sortBtn: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(127,127,127,0.12)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  statRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 10,
  },
  statPill: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    alignItems: 'center',
  },

  expandBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  roundChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
});
