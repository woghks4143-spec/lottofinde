/**
 * 동일날짜 분석 — /same-date
 *
 * 분석 대상 회차의 양력 월/일과 같은 날짜에 추첨된 과거 회차 비교.
 * 예) 1223회=2026-05-09 → 5/9에 추첨된 910회·649회·336회 …
 *
 * 매칭된 번호는 점선 링(dashedRing)으로 강조.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

export default function SameDate() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const latestDraw = useHistory((s) => s.getLatest());
  const earliestRound = useHistory((s) => s.earliestRound);

  // 기본은 "다음 회차" (추첨 예정). 사용자가 좌측 화살표로 과거로 갈 수 있음.
  const upcomingRound = latestRound + 1;
  const [round, setRound] = useState<number>(upcomingRound);

  /** 분석 대상이 추첨 예정 회차인지 — 본번호 없음. */
  const isUpcoming = round === upcomingRound;

  /**
   * 추첨 예정 회차의 예상 추첨일 — 직전 회차 date + 7일.
   *
   * ⚠️ Date 객체의 toISOString()은 UTC 기준이라 로컬 자정 → UTC -1day 으로 변환되는
   * timezone 버그가 생긴다. Date.UTC()로 UTC 자정을 만들고 getUTC*로 추출해야 안전.
   */
  const upcomingDate = useMemo(() => {
    if (!latestDraw) return null;
    const [y, m, day] = latestDraw.date.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, day + 7));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }, [latestDraw]);

  /** 비교할 기준 (실제 회차 또는 추첨 예정 가상 객체). */
  const target = useMemo(() => {
    if (isUpcoming) {
      return upcomingDate ? { round: upcomingRound, date: upcomingDate, nums: [] as number[], bonus: 0 } : null;
    }
    return drawsMap[round] ?? null;
  }, [isUpcoming, upcomingDate, upcomingRound, drawsMap, round]);

  /** 분석 대상 양력 월/일에 추첨된 과거 회차들. */
  const sameDate = useMemo(() => {
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
        <AppBar title="동일날짜 분석" onBack={goBack} />
        <View style={styles.empty}>
          <T variant="body2r" color="tertiary">회차 데이터를 찾을 수 없어요.</T>
        </View>
      </SafeAreaView>
    );
  }

  const targetSet = new Set(target.nums);
  // 각 회차 일치 카운트 합산 (요약용) — 추첨 예정이면 0.
  const totalHits = isUpcoming ? 0 : sameDate.reduce(
    (s, d) => s + d.nums.filter((n) => targetSet.has(n)).length,
    0,
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="동일날짜 분석" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* 분석 대상 회차 (라이트/다크 자동 분기) */}
        <View style={[styles.targetCard, { backgroundColor: t.bgHero }]}>
          <View style={styles.targetHead}>
            <Pressable
              onPress={goPrev}
              disabled={round <= earliestRound}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: t.bgOnHeroPill,
                opacity: round <= earliestRound ? 0.3 : pressed ? 0.6 : 1,
              }]}
            >
              <T variant="label1n" style={{ color: t.fgOnHero, fontWeight: '800' }} allowFontScaling={false}>‹</T>
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
              onPress={goNext}
              disabled={round >= upcomingRound}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: t.bgOnHeroPill,
                opacity: round >= upcomingRound ? 0.3 : pressed ? 0.6 : 1,
              }]}
            >
              <T variant="label1n" style={{ color: t.fgOnHero, fontWeight: '800' }} allowFontScaling={false}>›</T>
            </Pressable>
          </View>
          <View style={{ marginTop: 14, alignItems: 'center' }}>
            {isUpcoming ? (
              <View style={styles.upcomingNumsBox}>
                <T variant="caption1" style={{ color: t.fgOnHeroMuted, textAlign: 'center' }}>
                  당첨번호 발표 전 — 아래는 같은 날짜에 추첨됐던 과거 회차예요
                </T>
              </View>
            ) : (
              <BallRow nums={target.nums} bonus={target.bonus} size="md" />
            )}
          </View>
        </View>

        {/* 설명 + 요약 */}
        <Card padding={14}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
            같은 날짜에 추첨된 과거 회차
          </T>
          <T variant="caption1" color="tertiary" style={{ lineHeight: 18 }}>
            양력 <T variant="caption1" style={{ fontWeight: '800', color: palette.blue700 }}>
              {target.date.slice(5).replace('-', '월 ')}일
            </T>에 추첨된 이전 회차 {sameDate.length}개
            {!isUpcoming && ' · 분석 대상 본번호와 일치한 번호는 점선으로 표시'}
          </T>
          {!isUpcoming && sameDate.length > 0 && (
            <View style={[styles.summary, { borderTopColor: t.borderDivider }]}>
              <T variant="caption1" color="tertiary">합계 일치</T>
              <T variant="label1n" style={{ color: palette.red500, fontWeight: '800' }}>
                {totalHits}개
              </T>
            </View>
          )}
        </Card>

        {sameDate.length === 0 ? (
          <Card padding={28}>
            <T variant="caption1" color="tertiary" style={{ textAlign: 'center' }}>
              같은 날짜에 추첨된 과거 회차가 없어요.
            </T>
          </Card>
        ) : (
          sameDate.map((d) => {
            const hitCount = d.nums.filter((n) => targetSet.has(n)).length;
            return (
              <View key={d.round} style={[styles.pastRow, { borderColor: t.borderDivider, backgroundColor: t.bgSurface }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{d.round}회</T>
                  <T variant="caption1" color="tertiary">{d.date}</T>
                  <View style={{ flex: 1 }} />
                  {hitCount > 0 ? (
                    <T variant="caption1" style={{ color: palette.red500, fontWeight: '800' }}>
                      {hitCount}개 일치
                    </T>
                  ) : (
                    <T variant="caption2" color="tertiary" style={{ fontSize: 10.5 }}>일치 없음</T>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                  {d.nums.map((n) => (
                    <Ball key={n} n={n} size="sm" dashedRing={targetSet.has(n)} />
                  ))}
                </View>
              </View>
            );
          })
        )}

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

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

  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },

  pastRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
