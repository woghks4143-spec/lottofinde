/**
 * 조합 상세 분석 — /combo?nums=1,5,12,23,34,45
 *
 * 한 조합(6개 번호)의 모든 분석을 한 화면에 정리:
 *   1) 큰 ball row + 8지표 (합/끝수합/십합/앞·뒷세수합/홀짝/저고/AC)
 *   2) 직전 회차와 비교 — 동행수 / 이웃수
 *   3) 패턴 — 연속수, 5의 배수, 끝수 등
 *   4) 역대 회차 매칭 — 이 조합으로 만약 모든 회차에 응모했다면 1~5등 몇 번?
 *   5) 6개 번호의 출현 빈도 (전체 회차 기준)
 *
 * 회차 상세 페이지와 디자인이 일관되도록 hero + 카드 섹션 구조 동일.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { DistributionChart, buildDistribution } from '@/src/components/DistributionChart';
import { Disclaimer } from '@/src/components/Disclaimer';
import { PatternGrid } from '@/src/components/PatternGrid';
import { PerNumberCompat } from '@/src/components/PerNumberCompat';
import { useHistory } from '@/src/data/historyStore';
import {
  ac, compositesIn, consecutivePairs, firstThreeSum, frequency,
  hasConsecRunOfLength, highLowLabel, intersect, lastThreeSum,
  longestConsecutive, multiplesOf, neighborsOf, oddEvenLabel,
  perfectSquaresIn, primesIn, rank, sort6, stdDev, tailDigitDupes,
  tailSum, tensSum, total,
} from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function Combo() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/home');
  const params = useLocalSearchParams<{ nums: string }>();
  const [showAllHits, setShowAllHits] = useState(false);

  const nums = useMemo(() => parseNums(params.nums), [params.nums]);

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);
  const latestDraw = useHistory((s) => s.getLatest());

  const allDraws = useMemo(() => {
    return Object.keys(drawsMap)
      .map((k) => Number(k))
      .sort((a, b) => b - a)
      .map((r) => drawsMap[r]);
  }, [drawsMap, latestRound]);

  // 직전 회차와의 동행수(이월수) / 이웃수 — nums-only 및 +bonus 버전 둘 다
  const compare = useMemo(() => {
    const empty = {
      carryOver: [] as number[],
      carryOverBonus: [] as number[],
      neighbor: [] as number[],
      neighborBonus: [] as number[],
    };
    if (!latestDraw || nums.length !== 6) return empty;
    return {
      carryOver: intersect(nums, latestDraw.nums),
      carryOverBonus: intersect(nums, [...latestDraw.nums, latestDraw.bonus]),
      neighbor: neighborsOf(nums, latestDraw, false),
      neighborBonus: neighborsOf(nums, latestDraw, true),
    };
  }, [latestDraw, nums]);

  // 역대 매칭 — 이 조합으로 모든 회차에 응모했다면 어느 회차에서 1~5등?
  type RankHit = { round: number; date: string; rank: Exclude<ReturnType<typeof rank>, null> };
  const rankResult = useMemo(() => {
    const counts: Record<'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'none', number> = {
      r1: 0, r2: 0, r3: 0, r4: 0, r5: 0, none: 0,
    };
    const hits: RankHit[] = [];
    if (nums.length !== 6) return { counts, hits };
    for (const d of allDraws) {
      const r = rank(nums, d.nums, d.bonus);
      if (r === 1) counts.r1++;
      else if (r === 2) counts.r2++;
      else if (r === 3) counts.r3++;
      else if (r === 4) counts.r4++;
      else if (r === 5) counts.r5++;
      else { counts.none++; continue; }
      hits.push({ round: d.round, date: d.date, rank: r });
    }
    // hits는 newest-first로 정렬 (allDraws가 이미 newest-first)
    return { counts, hits };
  }, [allDraws, nums]);
  const rankCounts = rankResult.counts;
  const rankHits = rankResult.hits;

  // 각 번호의 출현 빈도 (전체 회차 기준)
  const freqByNum = useMemo(() => {
    const { count } = frequency(allDraws);
    return nums.map((n) => ({ n, c: count[n] ?? 0 }));
  }, [allDraws, nums]);

  // 히스토그램용 — 전체 회차의 합/끝수합/AC 분포
  const distributions = useMemo(() => {
    if (allDraws.length === 0) {
      return { sum: [], tail: [], ac: [] };
    }
    const sums: number[] = [];
    const tails: number[] = [];
    const acs: number[] = [];
    for (const d of allDraws) {
      sums.push(total(d.nums));
      tails.push(tailSum(d.nums));
      acs.push(ac(d.nums));
    }
    return {
      sum: buildDistribution(sums, 21, 255),
      tail: buildDistribution(tails, 6, 45),
      ac: buildDistribution(acs, 0, 10),
    };
  }, [allDraws]);

  // Invalid combo
  if (nums.length !== 6) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
        <AppBar title="조합 상세" onBack={goBack} />
        <View style={styles.empty}>
          <T variant="heading2" color="primary">잘못된 조합이에요</T>
          <T variant="body2r" color="tertiary" style={{ marginTop: 6, textAlign: 'center' }}>
            6개의 번호(1~45)가 필요해요. URL: /combo?nums=1,5,12,23,34,45
          </T>
        </View>
      </SafeAreaView>
    );
  }

  const consec = longestConsecutive(nums);
  const sortedNums = [...nums].sort((a, b) => a - b);
  const odd = sortedNums.filter((n) => n % 2 === 1);
  const even = sortedNums.filter((n) => n % 2 === 0);
  const low = sortedNums.filter((n) => n <= 22);
  const high = sortedNums.filter((n) => n >= 23);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="조합 상세" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* Hero — 조합 ball만 (지표는 아래 분석결과로) */}
        <View style={[styles.hero, { backgroundColor: palette.neutral950 }]}>
          <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>
            추천 조합
          </T>
          <View style={{ marginTop: 14, alignItems: 'center' }}>
            <BallRow nums={sortedNums} size="lg" />
          </View>
        </View>

        {/* 분석결과 종합 — 모든 지표 카테고리별로 정리 */}
        <AnalysisTable nums={nums} />

        {/* 직전 회차 비교 — 동행수 / 이웃수 (보볼 포함 버전 포함) */}
        {latestDraw && (
          <Card padding={16}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                  직전 회차 비교
                </T>
                <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
                  {latestDraw.round}회 ({latestDraw.date}) 기준
                </T>
              </View>
            </View>
            <View style={{ marginTop: 10, marginBottom: 14, alignItems: 'flex-start' }}>
              <T variant="caption1" color="tertiary" style={{ marginBottom: 6 }}>
                직전 회차 당첨번호
              </T>
              <BallRow nums={latestDraw.nums} bonus={latestDraw.bonus} size="xs" />
            </View>
            <CompareRow
              label="이월수 (동행)"
              hint="직전 회차 본번호와 일치"
              count={compare.carryOver.length}
              nums={compare.carryOver}
              tone={compare.carryOver.length >= 2 ? 'accent' : 'neutral'}
            />
            <CompareRow
              label="이월수 (보볼 포함)"
              hint="보너스번호까지 포함"
              count={compare.carryOverBonus.length}
              nums={compare.carryOverBonus}
              tone={compare.carryOverBonus.length >= 2 ? 'accent' : 'neutral'}
            />
            <View style={{ height: 1, backgroundColor: t.borderDivider, marginVertical: 10 }} />
            <CompareRow
              label="이웃수"
              hint="직전 회차 본번호의 ±1 범위"
              count={compare.neighbor.length}
              nums={compare.neighbor}
              tone={compare.neighbor.length >= 2 ? 'accent' : 'neutral'}
            />
            <CompareRow
              label="이웃수 (보볼 포함)"
              hint="보너스 ±1까지 포함"
              count={compare.neighborBonus.length}
              nums={compare.neighborBonus}
              tone={compare.neighborBonus.length >= 2 ? 'accent' : 'neutral'}
            />
          </Card>
        )}


        {/* 패턴 분석 */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 14 }}>
            패턴 분석
          </T>
          <DetailRow label="홀" subLabel={`${odd.length}개`} nums={odd} />
          <DetailRow label="짝" subLabel={`${even.length}개`} nums={even} />
          <View style={{ height: 1, backgroundColor: t.borderDivider, marginVertical: 10 }} />
          <DetailRow label="저" subLabel="1~22" nums={low} />
          <DetailRow label="고" subLabel="23~45" nums={high} />
          <View style={{ height: 1, backgroundColor: t.borderDivider, marginVertical: 10 }} />
          <View style={styles.statRow}>
            <T variant="body2r" color="secondary">최장 연속수</T>
            <Chip
              label={`${consec}개`}
              tone={consec >= 3 ? 'danger' : consec === 2 ? 'accent' : 'neutral'}
              compact
            />
          </View>
        </Card>

        {/* 분포 패턴 — 1~45 격자 시각화 */}
        <PatternGrid nums={nums} />

        {/* 분포 차트 3종 — 전체 회차 vs 이 조합 */}
        <DistributionChart
          title="총합 분포"
          subtitle={`전체 ${allDraws.length}회차 vs 내 조합`}
          values={distributions.sum}
          min={21} max={255}
          current={total(nums)}
        />
        <DistributionChart
          title="끝수합 분포"
          subtitle="끝자리 합이 전체에서 얼마나 흔한가"
          values={distributions.tail}
          min={6} max={45}
          current={tailSum(nums)}
        />
        <DistributionChart
          title="AC값 분포"
          subtitle="흩어진 정도가 전체에서 얼마나 흔한가"
          values={distributions.ac}
          min={0} max={10}
          current={ac(nums)}
        />

        {/* 6개 번호별 궁합수 */}
        <PerNumberCompat nums={nums} allDraws={allDraws} />

        {/* 과거 당첨 내역 — 가상 매칭 카운트 + 매칭 회차 리스트 */}
        <Card padding={16}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                과거 당첨 내역
              </T>
            </View>
          </View>
          <View style={{ marginTop: 12, gap: 8 }}>
            <RankBar label="1등 (6개)" count={rankCounts.r1} max={allDraws.length} color={palette.purple500} />
            <RankBar label="2등 (5+보)" count={rankCounts.r2} max={allDraws.length} color={palette.purple500} />
            <RankBar label="3등 (5개)" count={rankCounts.r3} max={allDraws.length} color={palette.blue500} />
            <RankBar label="4등 (4개)" count={rankCounts.r4} max={allDraws.length} color={palette.blue500} />
            <RankBar label="5등 (3개)" count={rankCounts.r5} max={allDraws.length} color={palette.green500} />
            <RankBar label="미당첨" count={rankCounts.none} max={allDraws.length} color={t.borderDivider} mute />
          </View>

          {/* 매칭된 회차 리스트 — 1·2·3·4·5등에 한해 회차별로 나열 */}
          {rankHits.length > 0 && (
            <View style={[styles.hitsBox, { borderTopColor: t.borderDivider }]}>
              <T variant="caption1" color="tertiary" style={{ marginBottom: 10, fontWeight: '600' }}>
                매칭 회차 {rankHits.length}건 (최신 순)
              </T>
              <View style={{ gap: 8 }}>
                {(showAllHits ? rankHits : rankHits.slice(0, 20)).map((hit) => (
                  <MatchRow
                    key={hit.round}
                    hit={hit}
                    winning={drawsMap[hit.round]?.nums ?? []}
                    bonus={drawsMap[hit.round]?.bonus ?? 0}
                    myNums={nums}
                  />
                ))}
                {rankHits.length > 20 && (
                  <Pressable
                    onPress={() => setShowAllHits((v) => !v)}
                    style={({ pressed }) => [
                      styles.moreBtn,
                      { backgroundColor: t.bgAccentSoft, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <T variant="label1n" style={{ color: palette.blue700, fontWeight: '700' }}>
                      {showAllHits ? '접기 ▴' : `+ ${rankHits.length - 20}건 더 보기 ▾`}
                    </T>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          <T variant="caption1" color="tertiary" style={{ marginTop: 14, lineHeight: 17 }}>
            ※ 통계 분석일 뿐 미래 당첨을 보장하지 않아요.
          </T>
        </Card>

        {/* 6개 번호 빈도 */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 12 }}>
            각 번호의 전체 출현 횟수
          </T>
          <View style={{ gap: 8 }}>
            {freqByNum.map((x) => (
              <View key={x.n} style={styles.freqRow}>
                <Ball n={x.n} size="xs" />
                <T variant="body2r" color="secondary" style={{ flex: 1 }}>
                  {((x.c / allDraws.length) * 100).toFixed(1)}% 출현
                </T>
                <T variant="label2" color="primary" style={{ fontWeight: '700' }}>
                  {x.c}회
                </T>
              </View>
            ))}
          </View>
        </Card>

        <Disclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function DetailRow({ label, subLabel, nums }: { label: string; subLabel?: string; nums: number[] }) {
  return (
    <View style={styles.detailRow}>
      <View style={{ width: 80 }}>
        <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{label}</T>
        {subLabel && <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>{subLabel}</T>}
      </View>
      <View style={styles.detailBalls}>
        {nums.length > 0
          ? nums.map((n) => <Ball key={n} n={n} size="sm" />)
          : <T variant="caption1" color="tertiary">없음</T>}
      </View>
    </View>
  );
}

function CompareRow({
  label, hint, count, nums, tone,
}: {
  label: string; hint: string; count: number; nums: number[];
  tone: 'accent' | 'neutral';
}) {
  return (
    <View style={{ paddingVertical: 6 }}>
      <View style={styles.compareHead}>
        <View style={{ flex: 1 }}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{label}</T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>{hint}</T>
        </View>
        <Chip
          label={`${count}개`}
          tone={count > 0 ? tone : 'neutral'}
          compact
        />
      </View>
      {nums.length > 0 && (
        <View style={styles.compareBalls}>
          {nums.map((n) => <Ball key={n} n={n} size="sm" />)}
        </View>
      )}
    </View>
  );
}

/**
 * 매칭 회차 한 줄 — 회차/날짜 + 그 회차 당첨번호 (사용자 조합과 일치하는 수만
 * 컬러로 강조, 나머지는 outline) + 등수 칩.
 */
function MatchRow({
  hit, winning, bonus, myNums,
}: {
  hit: { round: number; date: string; rank: 1 | 2 | 3 | 4 | 5 };
  winning: number[];
  bonus: number;
  myNums: number[];
}) {
  const t = useTheme();
  const mySet = useMemo(() => new Set(myNums), [myNums]);
  const tone =
    hit.rank === 1 || hit.rank === 2 ? 'purple'
    : hit.rank === 3 || hit.rank === 4 ? 'accent'
    : 'success';
  const sortedWinning = [...winning].sort((a, b) => a - b);
  return (
    <View style={[styles.matchRow, { borderColor: t.borderDivider }]}>
      <View style={{ width: 70 }}>
        <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{hit.round}회</T>
        <T variant="caption2" color="tertiary" style={{ fontSize: 10, marginTop: 2 }}>{hit.date}</T>
      </View>
      <View style={styles.matchBalls}>
        {sortedWinning.map((n) => (
          <Ball
            key={n}
            n={n}
            size="xs"
            dashedRing={mySet.has(n)}
            dashedRingColor={palette.blue500}
          />
        ))}
        <T variant="caption1" style={{ color: t.fgTertiary, marginHorizontal: 2 }} allowFontScaling={false}>+</T>
        <Ball
          n={bonus}
          size="xs"
          dashedRing={mySet.has(bonus)}
          dashedRingColor={palette.blue500}
        />
      </View>
      <Chip label={`${hit.rank}등`} tone={tone} compact />
    </View>
  );
}

function RankBar({
  label, count, max, color, mute,
}: { label: string; count: number; max: number; color: string; mute?: boolean }) {
  const t = useTheme();
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={styles.rankRow}>
      <T variant="caption1" color={mute ? 'tertiary' : 'primary'} style={{ width: 80, fontWeight: '600' }}>
        {label}
      </T>
      <View style={[styles.rankTrack, { backgroundColor: t.borderDivider }]}>
        <View style={[styles.rankFill, { backgroundColor: color, width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }]} />
      </View>
      <T variant="label2" color={mute ? 'tertiary' : 'primary'} style={{ minWidth: 56, textAlign: 'right', fontWeight: '700' }}>
        {count}회
      </T>
    </View>
  );
}

// ─── AnalysisTable — 카테고리별 칩 그리드 (참조 앱 흰표와 차별화) ───────────

function AnalysisTable({ nums }: { nums: number[] }) {
  const router = useRouter();
  // 모든 지표 계산
  const sumV = total(nums);
  const tailSumV = tailSum(nums);
  const tensV = tensSum(nums);
  const firstV = firstThreeSum(nums);
  const lastV = lastThreeSum(nums);
  const acV = ac(nums);
  const sd = stdDev(nums);
  const oddN = nums.filter((n) => n % 2 === 1).length;
  const evenN = 6 - oddN;
  const lowN = nums.filter((n) => n <= 22).length;
  const highN = 6 - lowN;
  const has3InRow = hasConsecRunOfLength(nums, 3);
  const consec = longestConsecutive(nums);
  const consecPairs = consecutivePairs(nums);
  const tailDupes = tailDigitDupes(nums);
  const squares = perfectSquaresIn(nums);
  const primes = primesIn(nums);
  const composites = compositesIn(nums);
  const m3 = multiplesOf(nums, 3).length;
  const m4 = multiplesOf(nums, 4).length;
  const m5 = multiplesOf(nums, 5).length;

  const tailDupSummary = tailDupes.length === 0
    ? '없음'
    : tailDupes.map((d) => `${d.digit}끝×${d.nums.length}`).join(' · ');

  return (
    <Card padding={16}>
      <View style={styles.analysisHead}>
        <View style={{ flex: 1 }}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
            분석결과
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
            지표를 탭하면 자세히 알아볼 수 있어요
          </T>
        </View>
        <Pressable
          onPress={() => router.push('/glossary' as any)}
          hitSlop={6}
          style={({ pressed }) => [
            styles.helpBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <T variant="caption1" style={{ color: palette.blue700, fontWeight: '700' }} allowFontScaling={false}>
            ? 용어 설명
          </T>
        </Pressable>
      </View>

      {/* ─ 1. 기본 통계 ─ */}
      <Section title="기본 통계">
        <Stat termId="sum" label="합" value={sumV} tone="primary" big />
        <Stat termId="ac" label="AC" value={acV} tone={acV >= 7 ? 'accent' : 'primary'} big />
        <Stat termId="stddev" label="표준편차" value={sd.toFixed(2)} />
      </Section>

      {/* ─ 2. 균형 ─ */}
      <Section title="균형">
        <Stat termId="oddeven" label="홀:짝" value={`${oddN}:${evenN}`} tone={oddN === 3 ? 'accent' : 'primary'} />
        <Stat termId="lowhigh" label="저:고" value={`${lowN}:${highN}`} tone={lowN === 3 ? 'accent' : 'primary'} />
        <Stat termId="tailsum" label="끝수합" value={tailSumV} />
        <Stat termId="tenssum" label="십의자리합" value={tensV} />
        <Stat termId="first3" label="앞세수합" value={firstV} />
        <Stat termId="last3" label="뒷세수합" value={lastV} />
      </Section>

      {/* ─ 3. 수학적 특성 ─ */}
      <Section title="수학적 특성">
        <Stat termId="squares" label="완전제곱수" value={`${squares.length}개`}
          sub={squares.length > 0 ? squares.join(', ') : undefined}
          tone={squares.length > 0 ? 'purple' : 'mute'} />
        <Stat termId="primes" label="소수" value={`${primes.length}개`}
          sub={primes.length > 0 ? primes.join(', ') : undefined}
          tone={primes.length > 0 ? 'purple' : 'mute'} />
        <Stat termId="composites" label="합성수" value={`${composites.length}개`}
          tone={composites.length > 0 ? 'primary' : 'mute'} />
      </Section>

      {/* ─ 4. 배수 ─ */}
      <Section title="배수">
        <Stat termId="m3" label="3의 배수" value={`${m3}개`} tone={m3 > 0 ? 'primary' : 'mute'} />
        <Stat termId="m4" label="4의 배수" value={`${m4}개`} tone={m4 > 0 ? 'primary' : 'mute'} />
        <Stat termId="m5" label="5의 배수" value={`${m5}개`} tone={m5 > 0 ? 'primary' : 'mute'} />
      </Section>

      {/* ─ 5. 연속·중복 패턴 ─ */}
      <Section title="연속·중복 패턴" last>
        <Stat termId="consec3" label="3자리 연속" value={has3InRow ? 'O' : 'X'}
          tone={has3InRow ? 'danger' : 'mute'} />
        <Stat termId="longestRun" label="최장 연속수" value={`${consec}개`}
          tone={consec >= 3 ? 'danger' : consec === 2 ? 'accent' : 'mute'} />
        <Stat termId="pair" label="연번(한쌍)" value={`${consecPairs}개`}
          tone={consecPairs > 0 ? 'accent' : 'mute'} />
        <Stat termId="tailDup" label="동일 끝수"
          value={tailDupes.length === 0 ? '없음' : `${tailDupes.length}그룹`}
          sub={tailDupes.length > 0 ? tailDupSummary : undefined}
          tone={tailDupes.length > 0 ? 'accent' : 'mute'} />
      </Section>
    </Card>
  );
}

function Section({
  title, last, children,
}: { title: string; last?: boolean; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.section, !last && { borderBottomWidth: 1, borderBottomColor: t.borderDivider }]}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionDot, { backgroundColor: palette.blue500 }]} />
        <T variant="caption1" color="secondary" style={{ fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase', fontSize: 11 }} allowFontScaling={false}>
          {title}
        </T>
      </View>
      <View style={styles.statGrid}>{children}</View>
    </View>
  );
}

type StatTone = 'primary' | 'accent' | 'purple' | 'danger' | 'mute';

function Stat({
  termId, label, value, sub, tone = 'primary', big,
}: {
  termId?: string;
  label: string;
  value: string | number;
  sub?: string;
  tone?: StatTone;
  big?: boolean;
}) {
  const t = useTheme();
  const router = useRouter();
  const fg = (() => {
    if (tone === 'mute') return t.fgTertiary;
    if (tone === 'accent') return palette.blue500;
    if (tone === 'purple') return palette.purple500;
    if (tone === 'danger') return palette.red500;
    return t.fgPrimary;
  })();
  const bg = (() => {
    if (tone === 'mute') return 'rgba(112,115,124,0.06)';
    if (tone === 'accent') return 'rgba(0,102,255,0.10)';
    if (tone === 'purple') return 'rgba(101,65,242,0.10)';
    if (tone === 'danger') return 'rgba(255,66,66,0.10)';
    return 'rgba(112,115,124,0.06)';
  })();
  const onPress = termId
    ? () => router.push(`/glossary?focus=${termId}` as any)
    : undefined;
  return (
    <Pressable
      onPress={onPress}
      disabled={!termId}
      style={({ pressed }) => [
        styles.statCell,
        { backgroundColor: bg, opacity: pressed && termId ? 0.85 : 1 },
      ]}
    >
      <View style={styles.statLabelRow}>
        <T variant="caption1" color="tertiary" style={{ fontSize: 11 }} allowFontScaling={false}>
          {label}
        </T>
        {termId && (
          <T variant="caption2" color="tertiary" style={{ fontSize: 10, opacity: 0.6 }} allowFontScaling={false}>
            ?
          </T>
        )}
      </View>
      <T
        variant={big ? 'heading2' : 'headline2'}
        style={{ color: fg, fontWeight: '800', marginTop: 2 }}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {value}
      </T>
      {sub && (
        <T variant="caption2" color="tertiary" style={{ fontSize: 10, marginTop: 2 }} allowFontScaling={false} numberOfLines={1}>
          {sub}
        </T>
      )}
    </Pressable>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNums(s?: string): number[] {
  if (!s) return [];
  const parts = s.split(',').map((p) => parseInt(p.trim(), 10));
  if (parts.length !== 6) return [];
  if (parts.some((n) => !Number.isFinite(n) || n < 1 || n > 45)) return [];
  if (new Set(parts).size !== 6) return [];
  return sort6(parts);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  hero: { borderRadius: radius.xl + 2, padding: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  detailBalls: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compareHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compareBalls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 0 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  rankFill: { height: '100%', borderRadius: 5 },
  hitsBox: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  matchBalls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    flexWrap: 'wrap',
  },
  moreBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analysisHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 8,
  },
  helpBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,102,255,0.10)',
    alignSelf: 'flex-start',
  },
  section: {
    paddingVertical: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionDot: {
    width: 4, height: 14, borderRadius: 2,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCell: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
  },
  statLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
