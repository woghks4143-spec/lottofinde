/**
 * 번호별 출현 통계 — 1회차부터 최신 회차까지 전체 누적 분석.
 *
 * 각 번호(1~45)에 대해 다음을 계산:
 *   - 총 출현 횟수 / 출현률
 *   - 최장 연속 출현 (몇 회차 연달아 나왔나)
 *   - 최장 미출현 구간 (몇 회차 연달아 안 나왔나)
 *   - 현재 미출현 회차 수 (마지막 출현 이후)
 *   - 평균 출현 주기 (회차 단위)
 *   - 임박도 (현재 미출현 / 평균 주기)
 *   - 최근 출현 회차 5개
 *   - 최근 N회 출현 횟수 (핫 지표)
 */
import type { Draw } from '@/src/data/lotto';

export type NumberStats = {
  n: number;
  totalAppearances: number;
  appearanceRate: number;
  longestStreak: number;
  longestGap: number;
  currentGap: number;
  avgInterval: number;
  lastAppearance: number | null;
  overdueScore: number;       // 현재 미출현 / 평균 주기 (>1 = 평균 초과)
  recentRounds: number[];      // 최근 5개 출현 회차 (오름차순)
  recentNAppearances: number;  // 최근 N회(보통 30회) 출현 횟수
  recommendScore: number;      // 0~100 종합 추천 점수 (임박+핫+빈도 가중합)
};

/**
 * 전체 회차 데이터로부터 1~45 각 번호의 통계 계산.
 * earliestRound ~ latestRound 범위 안에서만 분석.
 */
export function computeAllNumberStats(
  drawsMap: Record<number, Draw>,
  latestRound: number,
  earliestRound: number,
  recentWindow: number = 30,
): NumberStats[] {
  const stats: NumberStats[] = [];
  const totalRounds = latestRound - earliestRound + 1;

  // 1) 각 번호별 출현 회차 리스트 (오름차순) 만들기
  const appearancesPerNum: Record<number, number[]> = {};
  for (let n = 1; n <= 45; n++) appearancesPerNum[n] = [];

  for (let r = earliestRound; r <= latestRound; r++) {
    const d = drawsMap[r];
    if (!d) continue;
    for (const n of d.nums) {
      appearancesPerNum[n].push(r);
    }
  }

  // 2) 각 번호별 통계 산출
  for (let n = 1; n <= 45; n++) {
    const apps = appearancesPerNum[n];
    if (apps.length === 0) {
      stats.push({
        n,
        totalAppearances: 0,
        appearanceRate: 0,
        longestStreak: 0,
        longestGap: totalRounds,
        currentGap: totalRounds,
        avgInterval: 0,
        lastAppearance: null,
        overdueScore: 0,
        recentRounds: [],
        recentNAppearances: 0,
        recommendScore: 0,
      });
      continue;
    }

    // 최장 연속 출현 — 연속된 회차에 등장한 횟수의 최대
    let longestStreak = 1;
    let curStreak = 1;
    for (let i = 1; i < apps.length; i++) {
      if (apps[i] === apps[i - 1] + 1) {
        curStreak++;
        if (curStreak > longestStreak) longestStreak = curStreak;
      } else {
        curStreak = 1;
      }
    }

    // 최장 미출현 — 출현 사이 가장 큰 간격 (앞/뒤 끝 포함)
    let longestGap = apps[0] - earliestRound; // 시작 ~ 첫 출현 직전
    for (let i = 1; i < apps.length; i++) {
      const gap = apps[i] - apps[i - 1] - 1;
      if (gap > longestGap) longestGap = gap;
    }
    const endGap = latestRound - apps[apps.length - 1];
    if (endGap > longestGap) longestGap = endGap;

    // 현재 미출현 = 마지막 출현 이후
    const currentGap = endGap;

    // 평균 출현 주기 = 첫출현 ~ 마지막출현 / (출현-1)
    const span = apps[apps.length - 1] - apps[0];
    const avgInterval = apps.length > 1 ? span / (apps.length - 1) : 0;

    // 임박도 = 현재 미출현 / 평균 주기 (1.0 = 정상, >1 = 평균 초과)
    const overdueScore = avgInterval > 0 ? currentGap / avgInterval : 0;

    // 최근 N회 출현 횟수
    const recentNAppearances = apps.filter((r) => r >= latestRound - recentWindow + 1).length;

    // 추천 점수 = 임박도(50%) + 최근 핫(30%) + 빈도 정상화(20%)
    // - 임박도: 평균 주기 대비 현재 미출현 (cap 2.5배)
    // - 핫: 최근 N회 출현 / 기대치 (6/45 × N)
    // - 빈도 정상화: 평균(6/45)에서 벗어날수록 감점 (극단치 회피)
    const overdueNorm = Math.min(overdueScore, 2.5) / 2.5;
    const expectedRecent = recentWindow * (6 / 45);
    const hotNorm = expectedRecent > 0
      ? Math.min(recentNAppearances / (expectedRecent * 2), 1)
      : 0;
    const normalRate = 6 / 45;
    const rateDiff = Math.abs(apps.length / totalRounds - normalRate) / normalRate;
    const freqNorm = Math.max(0, 1 - rateDiff);
    const recommendScore = overdueNorm * 50 + hotNorm * 30 + freqNorm * 20;

    stats.push({
      n,
      totalAppearances: apps.length,
      appearanceRate: apps.length / totalRounds,
      longestStreak,
      longestGap,
      currentGap,
      avgInterval,
      lastAppearance: apps[apps.length - 1],
      overdueScore,
      recentRounds: apps.slice(-5),
      recentNAppearances,
      recommendScore,
    });
  }

  return stats;
}

/** 임박도 별점 (0~5). */
export function overdueStars(score: number): number {
  if (score >= 2.0) return 5;
  if (score >= 1.5) return 4;
  if (score >= 1.0) return 3;
  if (score >= 0.5) return 2;
  if (score > 0) return 1;
  return 0;
}

/* ─── 번호 구간 분석 ──────────────────────────────────── */

export type RangeBand = {
  label: string;       // "1~10" 같은 구간 라벨
  from: number;
  to: number;
  numbers: number[];   // 1~10
  avgScore: number;    // 평균 추천 점수
  totalRecentAppearances: number;
  avgOverdue: number;
};

/** 1~10 / 11~20 / 21~30 / 31~45 네 구간으로 묶어서 평균 추천 점수 계산. */
export function computeRangeBands(stats: NumberStats[]): RangeBand[] {
  const ranges: { label: string; from: number; to: number }[] = [
    { label: '1~10',  from: 1,  to: 10 },
    { label: '11~20', from: 11, to: 20 },
    { label: '21~30', from: 21, to: 30 },
    { label: '31~45', from: 31, to: 45 },
  ];

  return ranges.map((r) => {
    const inRange = stats.filter((s) => s.n >= r.from && s.n <= r.to);
    const avgScore = inRange.length > 0
      ? inRange.reduce((sum, s) => sum + s.recommendScore, 0) / inRange.length
      : 0;
    const totalRecent = inRange.reduce((sum, s) => sum + s.recentNAppearances, 0);
    const avgOverdue = inRange.length > 0
      ? inRange.reduce((sum, s) => sum + s.overdueScore, 0) / inRange.length
      : 0;
    return {
      label: r.label,
      from: r.from,
      to: r.to,
      numbers: inRange.map((s) => s.n),
      avgScore,
      totalRecentAppearances: totalRecent,
      avgOverdue,
    };
  });
}
