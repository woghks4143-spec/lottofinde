/**
 * 귀찮이즘 조합 PRO — /pro-jachanism
 *
 * 주간 운영 사이클:
 *   토요일 추첨 → 월요일 09:00 자동 분석 → 수요일 00:00 받기 시작 → 토요일 20:00 받기 마감
 *   → 토요일 추첨 → 결과 확인 → 다시 일요일 사이클 시작
 *
 * 사용자는 회차당 50조합을 받을 수 있고, 받은 조합은 영속 저장되어 추첨 후
 * 등수 결과까지 확인할 수 있다.
 *
 * 본 화면은 통계 분석 도구가 제공하는 참고용 정보이며 당첨을 보장하지 않습니다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { Card } from '@/src/components/Card';
import { CombinationCard } from '@/src/components/CombinationCard';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import { rank as computeRank } from '@/src/data/lotto';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { useJachanism } from '@/src/store/jachanism';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';
import {
  POOL_SIZE, POOL_SIZE_DISPLAY, USER_LIMIT, BACKTEST_BASE_N, BACKTEST_BASE_LABEL,
  generateUserCombosRange, fmtCount,
  getDayStatus, msToNextReceive, msToReceiveEnd, formatCountdown,
  fetchWeeklyPool, pickUserCombosFromPool, fetchPrecomputedBacktest,
  type BacktestStats, type JachanismStatus,
} from '@/src/lib/jachanism';
import { fetchPoolState, allocateSlots, type PoolState } from '@/src/lib/firebase';

const GOLD = '#e8b04e';
const GOLD_SOFT = '#fff4dc';
const GOLD_DARK = '#a37116';
const USER_COMBO_COUNT = USER_LIMIT;

type Status = JachanismStatus;

/* ═══════════════════════════════════════════════════════════════════════════
   메인 페이지
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ProJachanism() {
  const t = useTheme();
  const goBack = useSafeBack('/pro-gen');
  const latestRound = useHistory((s) => s.latestRound);
  const drawsMap = useHistory((s) => s.draws);
  const targetRound = latestRound + 1;

  const deviceSeed = useJachanism((s) => s.deviceSeed);
  const entry = useJachanism((s) => s.weekly[targetRound]);
  const receive = useJachanism((s) => s.receive);
  const clearRound = useJachanism((s) => s.clear);
  const backtestCache = useJachanism((s) => s.backtest);
  const setBacktest = useJachanism((s) => s.setBacktest);
  const computing = useJachanism((s) => s.computing);
  const setComputing = useJachanism((s) => s.setComputing);

  const addMany = useSavedNumbers((s) => s.addMany);

  const [toast, setToast] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // 백테스트 결과 fetch — 서버(GitHub raw)에서 사전 계산된 결과만 받음.
  // 매주 월요일 GitHub Actions가 갱신 → 사용자는 기다리지 않고 즉시 결과 표시.
  useEffect(() => {
    if (!latestRound) return;
    if (
      backtestCache &&
      backtestCache.latestRound === latestRound &&
      backtestCache.roundsTested === BACKTEST_BASE_N
    ) return; // 이미 최신 결과 캐시됨

    let cancelled = false;
    (async () => {
      const stats = await fetchPrecomputedBacktest();
      if (cancelled) return;
      if (stats) {
        // 서버 결과로 캐시 갱신
        setBacktest({ latestRound, ...stats });
      }
      // 서버 결과 없으면 기존 캐시 유지 (또는 번들 seed)
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestRound]);

  const backtestStats: BacktestStats | null = useMemo(() => {
    if (!backtestCache || backtestCache.latestRound !== latestRound) return null;
    // 30회짜리 옛 캐시 또는 분석 회차 수 변경된 경우 → invalid, 다시 계산 대기
    if (backtestCache.roundsTested !== BACKTEST_BASE_N) return null;
    return {
      rank1: backtestCache.rank1,
      rank2: backtestCache.rank2,
      rank3: backtestCache.rank3,
      rank4: backtestCache.rank4,
      rank5: backtestCache.rank5,
      roundsTested: backtestCache.roundsTested,
      totalCombosTested: backtestCache.totalCombosTested,
      computedAt: backtestCache.computedAt,
    };
  }, [backtestCache, latestRound]);

  /** 상태 판정: 요일 + 데이터 보유 여부 기반.
   *  개발 모드(__DEV__)에서는 항상 'active'로 강제 — 요일 무관 테스트 가능.
   *  Production 빌드에선 정상 요일 로직 작동. */
  const realStatus: Status = useMemo(() => {
    if (drawsMap[targetRound]) return 'done';
    return getDayStatus();
  }, [drawsMap, targetRound]);
  const status: Status = __DEV__ && realStatus === 'locked' ? 'active' : realStatus;


  /** 현재까지 받은 조합 수 / 남은 수령 가능 수. */
  const receivedCount = entry?.combos.length ?? 0;
  const remainingCount = Math.max(0, USER_LIMIT - receivedCount);

  /** Firebase에서 실시간 풀 상태 (total + 전 세계 누적 consumed). */
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const refreshPoolState = async () => {
    if (!targetRound) return;
    const state = await fetchPoolState(targetRound);
    if (state) setPoolState(state);
  };
  useEffect(() => {
    if (!targetRound) return;
    let cancelled = false;
    fetchPoolState(targetRound)
      .then((state) => { if (!cancelled && state) setPoolState(state); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [targetRound]);

  const thisWeekPoolSize = poolState?.total ?? null;
  const thisWeekConsumed = poolState?.consumed ?? 0;
  const thisWeekRemaining = poolState ? Math.max(0, poolState.total - poolState.consumed) : null;

  /** 선택한 수령 개수 (사용자가 [5개] 같은 칩을 누르면 세팅, [조합받기] 누르면 실행). */
  const [selectedCount, setSelectedCount] = useState<number | null>(null);

  /** 받기 액션 — Firebase에서 atomic 슬롯 할당 + 자동 보관함 저장. */
  const [receiving, setReceiving] = useState(false);
  const handleReceive = async () => {
    if (status !== 'active' || receiving) return;
    if (selectedCount == null) return;
    const take = Math.max(1, Math.min(selectedCount, remainingCount));
    if (take === 0) return;
    setReceiving(true);
    try {
      // 1) Firebase에서 atomic 슬롯 할당 (전 세계 unique)
      const allocation = await allocateSlots(targetRound, deviceSeed, take);
      console.log('[jachanism] allocateSlots result:', allocation);

      // 2) 풀이 준비 안 됐거나 슬롯 부족 → 로컬 폴백
      let combos: number[][];
      const pool = await fetchWeeklyPool(targetRound);
      console.log('[jachanism] fetchWeeklyPool result:',
        pool ? `combos.length=${pool.combos.length}` : 'null');

      if (allocation && pool && pool.combos.length > allocation.to) {
        // ✅ 글로벌 슬롯 할당 성공 — 받은 슬롯 번호의 조합 사용
        combos = pool.combos.slice(
          allocation.to - take + 1,
          allocation.to + 1,
        );
        // 풀 상태 갱신 (Firebase 응답에서 받은 최신값)
        setPoolState({
          total: allocation.total,
          consumed: allocation.consumed,
          updatedAt: Date.now(),
        });
        console.log('[jachanism] ✅ Firebase 슬롯 할당 성공:',
          `from=${allocation.to - take + 1}, to=${allocation.to}, consumed→${allocation.consumed}`);
      } else if (pool && pool.combos.length >= USER_LIMIT) {
        // GitHub 풀은 있지만 Firebase 못 받음 → 기존 deviceSeed 방식
        const offset = receivedCount;
        combos = pickUserCombosFromPool(pool, targetRound, deviceSeed, offset, take);
        console.warn('[jachanism] ⚠️ Firebase 실패, deviceSeed 폴백 사용');
      } else {
        // 풀 자체가 없음 → 로컬 알고리즘 폴백
        const offset = receivedCount;
        combos = generateUserCombosRange(targetRound, deviceSeed, offset, take);
        console.warn('[jachanism] ⚠️ 풀 없음, 로컬 알고리즘 폴백 사용');
      }

      // 3) 회차 기록에 저장
      receive(targetRound, combos);
      // 4) 보관함에 자동 저장
      const games = combos.map((c) => ({
        nums: c,
        source: 'jachanism' as const,
        round: targetRound,
      }));
      const res = addMany(games);
      setSelectedCount(null);
      showToast(
        `${combos.length}조합 받기·저장 완료` +
        (res.skipped > 0 ? ` (${res.skipped}개 중복)` : '') +
        (receivedCount + combos.length >= USER_LIMIT ? ' · 한도 도달' : '')
      );
    } finally {
      setReceiving(false);
    }
  };

  /** 등수 결과 (추첨 완료 시). */
  const rankBreakdown = useMemo(() => {
    if (status !== 'done' || !entry) return null;
    const drawn = drawsMap[targetRound];
    if (!drawn) return null;
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const c of entry.combos) {
      const r = computeRank(c, drawn.nums, drawn.bonus);
      if (r != null) counts[r as number]++;
    }
    return counts;
  }, [status, entry, drawsMap, targetRound]);

  /** 카운트다운: 잠금이면 다음 수요일까지, active면 토요일 20시까지. */
  const countdown = useMemo(() => {
    if (status === 'locked') {
      const ms = msToNextReceive();
      return ms != null ? formatCountdown(ms) : null;
    }
    if (status === 'active') {
      const ms = msToReceiveEnd();
      return ms != null ? formatCountdown(ms) : null;
    }
    return null;
  }, [status]);

  /* ─── 렌더 ─────────────────────────────────────────────── */

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon.crown color={GOLD} size={18} weight={2} />
            <T variant="heading1" color="primary">귀찮이즘 조합</T>
          </View>
        }
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>

        {/* 테스트 모드 배너 (개발 빌드에서만) */}
        {__DEV__ && (
          <View style={{
            padding: 10,
            borderRadius: radius.md,
            backgroundColor: 'rgba(101,65,242,0.10)',
            borderWidth: 1,
            borderColor: palette.purple500,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T variant="caption1" allowFontScaling={false} style={{ color: palette.purple500, fontWeight: '800', fontSize: 11 }}>
                🧪 개발 테스트 모드
              </T>
              <Pressable
                onPress={() => {
                  clearRound(targetRound);
                  showToast(`${targetRound}회 로컬 받기 기록 초기화 — 다시 받을 수 있음`);
                }}
                style={({ pressed }) => ({
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 6,
                  backgroundColor: palette.purple500,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10 }}>
                  내 받기 기록 초기화
                </T>
              </Pressable>
            </View>
            <T variant="caption2" color="tertiary" style={{ marginTop: 4, fontSize: 10.5 }}>
              {realStatus === 'locked'
                ? '원래 일요일은 잠금 상태(분석 중)지만, 개발 빌드라 받기 활성화됨. Production 빌드에선 수요일 00:00부터만 받기 가능.'
                : '받기 누른 후 콘솔 로그(Metro)에서 [firebase] / [jachanism] 메시지 확인.'}
            </T>
            <T variant="caption2" color="tertiary" style={{ marginTop: 4, fontSize: 9.5, fontFamily: 'monospace' }}>
              현재: 받음 {receivedCount}/50 · Firebase consumed {thisWeekConsumed}/{thisWeekPoolSize ?? '?'}
            </T>
          </View>
        )}

        {/* Hero — 상태별 메인 카드 (라이트/다크 자동 분기) */}
        <View style={[styles.hero, { backgroundColor: t.bgHero }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroBadge, { backgroundColor: GOLD }]}>
              <Icon.crown color="#fff" size={12} weight={2.5} />
              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10, marginLeft: 4, letterSpacing: 0.4 }}>
                PRO 멤버십
              </T>
            </View>
            <T variant="caption1" allowFontScaling={false} style={{ color: t.fgOnHeroFaint, fontSize: 11 }}>
              {targetRound}회 자동 분석
            </T>
          </View>

          {status === 'locked' && (
            <View style={styles.heroBody}>
              <T allowFontScaling={false} style={styles.heroEmoji}>🔒</T>
              <T variant="label1n" allowFontScaling={false} style={{ color: t.fgOnHero, fontWeight: '900', fontSize: 16 }}>
                분석 진행 중
              </T>
              <T variant="caption1" style={{ color: t.fgOnHeroMuted, marginTop: 3, textAlign: 'center', fontSize: 11.5 }}>
                수요일 00:00부터 받을 수 있어요
              </T>
              {countdown && (
                <View style={[styles.countdownPill, { backgroundColor: 'rgba(232,176,78,0.18)', borderColor: GOLD }]}>
                  <T variant="caption1" allowFontScaling={false} style={{ color: GOLD, fontWeight: '800' }}>
                    ⏱ {countdown} 남음
                  </T>
                </View>
              )}
            </View>
          )}

          {status === 'active' && remainingCount > 0 && (
            <View style={styles.heroBody}>
              <T allowFontScaling={false} style={styles.heroEmoji}>{receivedCount === 0 ? '✨' : '🎁'}</T>
              <T variant="label1n" allowFontScaling={false} style={{ color: t.fgOnHero, fontWeight: '900', fontSize: 16 }}>
                {receivedCount === 0 ? '이번 주 분석 완료' : `${receivedCount}개 받음 · ${remainingCount}개 더 받기 가능`}
              </T>
              <T variant="caption1" style={{ color: t.fgOnHeroMuted, marginTop: 3, textAlign: 'center', fontSize: 11.5 }}>
                받고 싶은 개수를 골라주세요 (최대 50개)
              </T>
              <ReceiveCountPicker
                remaining={remainingCount}
                selected={selectedCount}
                disabled={receiving}
                onSelect={setSelectedCount}
              />
              <Pressable
                onPress={handleReceive}
                disabled={selectedCount == null || receiving}
                style={({ pressed }) => [
                  styles.receiveBtn,
                  {
                    backgroundColor: GOLD,
                    opacity: selectedCount == null ? 0.4 : receiving ? 0.7 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Icon.sparkle color="#fff" size={14} weight={2.5} />
                <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', marginLeft: 5, fontSize: 13.5 }}>
                  {receiving
                    ? '받는 중...'
                    : selectedCount != null
                      ? `${selectedCount}개 조합받기`
                      : '개수를 먼저 골라주세요'}
                </T>
              </Pressable>
            </View>
          )}

          {status === 'active' && remainingCount === 0 && (
            <View style={styles.heroBody}>
              <T allowFontScaling={false} style={styles.heroEmoji}>✅</T>
              <T variant="label1n" allowFontScaling={false} style={{ color: t.fgOnHero, fontWeight: '900', fontSize: 16 }}>
                이번 주 50조합 받기 완료
              </T>
              <T variant="caption1" style={{ color: t.fgOnHeroMuted, marginTop: 3, textAlign: 'center', fontSize: 11.5 }}>
                아래에서 50조합 확인 · 보관함 자동 저장
              </T>
            </View>
          )}

          {status === 'drawing' && (
            <View style={styles.heroBody}>
              <T allowFontScaling={false} style={styles.heroEmoji}>⏳</T>
              <T variant="label1n" allowFontScaling={false} style={{ color: t.fgOnHero, fontWeight: '900', fontSize: 16 }}>
                추첨 진행 중
              </T>
              <T variant="caption1" style={{ color: t.fgOnHeroMuted, marginTop: 3, textAlign: 'center', fontSize: 11.5 }}>
                토요일 20:35 추첨 후 결과 공개
              </T>
            </View>
          )}

          {status === 'done' && (
            <View style={styles.heroBody}>
              <T allowFontScaling={false} style={styles.heroEmoji}>🎉</T>
              <T variant="label1n" allowFontScaling={false} style={{ color: t.fgOnHero, fontWeight: '900', fontSize: 16 }}>
                {targetRound}회 추첨 완료
              </T>
              <T variant="caption1" style={{ color: t.fgOnHeroMuted, marginTop: 3, textAlign: 'center', fontSize: 11.5 }}>
                받은 조합의 등수 결과를 확인하세요
              </T>
            </View>
          )}
        </View>

        {/* 등수 결과 카드 (추첨 완료 시) */}
        {status === 'done' && entry && rankBreakdown && (
          <Card padding={16}>
            <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
              🏆 내 받은 조합 {entry.combos.length}개 등수 결과
            </T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
              {targetRound}회 추첨 기준 · 자동 분석 결과 (참고용)
            </T>
            <View style={{ marginTop: 12, gap: 8 }}>
              <RankRow rank={1} count={rankBreakdown[1]} color={palette.red500} icon="🏆" />
              <RankRow rank={2} count={rankBreakdown[2]} color="#ea580c" icon="🥈" />
              <RankRow rank={3} count={rankBreakdown[3]} color={GOLD_DARK} icon="🥉" />
              <RankRow rank={4} count={rankBreakdown[4]} color={palette.blue700} icon="4등" />
              <RankRow rank={5} count={rankBreakdown[5]} color={palette.green700} icon="5등" />
            </View>
          </Card>
        )}

        {/* 받은 조합 카드 — 자동 저장됨 (보관함에 즉시 반영) */}
        {entry && (
          <Card padding={16}>
            <View>
              <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                ✨ 받은 조합 {entry.combos.length}개
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                💾 보관함 자동 저장 · 내 번호에서 회차별로 확인 가능
              </T>
            </View>

            <View style={{ marginTop: 12, gap: 10 }}>
              {entry.combos.map((c, i) => {
                // 추첨 완료 시 등수 + 일치 번호 표시
                const drawn = status === 'done' ? drawsMap[targetRound] : null;
                const r = drawn ? computeRank(c, drawn.nums, drawn.bonus) : null;
                const allHits = drawn
                  ? c.filter((n) => drawn.nums.includes(n) || drawn.bonus === n)
                  : undefined;
                const rankColor =
                  r === 1 ? palette.red500
                  : r === 2 ? '#ea580c'
                  : r === 3 ? GOLD_DARK
                  : r === 4 ? palette.blue700
                  : r === 5 ? palette.green700
                  : '#888';
                return (
                  <CombinationCard
                    key={i}
                    nums={c}
                    label={`#${i + 1}`}
                    hits={allHits}
                    rankBadge={r != null ? { rank: r, color: rankColor } : undefined}
                  />
                );
              })}
            </View>
          </Card>
        )}

        {/* 이번 주 분석 풀 — 실시간 글로벌 카운터 + Progress bar (FOMO) */}
        <Card padding={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
              📦 이번 주 분석 풀 (실시간)
            </T>
            {thisWeekRemaining != null && thisWeekRemaining < (thisWeekPoolSize ?? 0) * 0.5 && (
              <View style={{
                backgroundColor: 'rgba(255,66,66,0.12)',
                paddingHorizontal: 8, paddingVertical: 3,
                borderRadius: radius.pill,
              }}>
                <T variant="caption2" allowFontScaling={false} style={{ color: palette.red500, fontWeight: '800', fontSize: 10 }}>
                  ⚡ 절반 이상 발급됨
                </T>
              </View>
            )}
          </View>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
            평균 {POOL_SIZE_DISPLAY} · 한 사람당 최대 {USER_LIMIT}조합 · 중복 X
          </T>

          {/* 큰 숫자: 남은 조합 강조 (FOMO) */}
          <View style={[styles.poolHero, { backgroundColor: 'rgba(232,176,78,0.10)', borderColor: GOLD }]}>
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 11, color: GOLD_DARK, fontWeight: '700' }}>
              남은 조합
            </T>
            {thisWeekRemaining != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                <T variant="title1" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '900', fontSize: 32 }}>
                  {thisWeekRemaining.toLocaleString('ko')}
                </T>
                {thisWeekPoolSize != null && (
                  <T variant="caption1" allowFontScaling={false} style={{ color: GOLD_DARK, opacity: 0.6, marginLeft: 6, fontSize: 12 }}>
                    / {thisWeekPoolSize.toLocaleString('ko')}
                  </T>
                )}
              </View>
            ) : (
              <T variant="label1r" color="tertiary" style={{ marginTop: 4, fontStyle: 'italic' }}>
                풀 계산 중...
              </T>
            )}
            <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: GOLD_DARK, opacity: 0.7, marginTop: 2 }}>
              지금까지 {thisWeekConsumed.toLocaleString('ko')}개 발급됨
            </T>

            {/* Progress bar */}
            {thisWeekPoolSize != null && thisWeekPoolSize > 0 && (
              <View style={{
                marginTop: 10,
                width: '100%',
                height: 6,
                borderRadius: 3,
                backgroundColor: 'rgba(232,176,78,0.2)',
                overflow: 'hidden',
              }}>
                <View style={{
                  width: `${Math.min(100, (thisWeekConsumed / thisWeekPoolSize) * 100)}%`,
                  height: '100%',
                  backgroundColor: GOLD,
                  borderRadius: 3,
                }} />
              </View>
            )}
          </View>

          {/* 내 한도 (작게) */}
          <View style={[styles.myLimitBox, { backgroundColor: 'rgba(0,102,255,0.08)', borderColor: 'rgba(0,102,255,0.3)' }]}>
            <T variant="caption1" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '700', fontSize: 12 }}>
              받은 조합
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <T variant="label1n" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '900', fontSize: 18 }}>
                {receivedCount}
              </T>
              <T variant="caption1" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '700', fontSize: 12, opacity: 0.6, marginLeft: 2 }}>
                /{USER_LIMIT}
              </T>
              <T variant="caption1" allowFontScaling={false} style={{ color: palette.blue700, opacity: 0.7, fontSize: 11, marginLeft: 8 }}>
                · 남은 {remainingCount}개
              </T>
            </View>
          </View>
        </Card>

        {/* 최근 1년 PRO 분석 결과 */}
        <Card padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
              📊 최근 1년 PRO 분석 결과
            </T>
            {backtestStats && (
              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5 }}>
                (실측)
              </T>
            )}
          </View>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
            {POOL_SIZE_DISPLAY} 조합 풀 기준 누적 · 결과는 매주 자연스럽게 변동 · 당첨 보장 X
          </T>

          {backtestStats ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              <BacktestRow rank={1} icon="🏆" count={backtestStats.rank1} color={palette.red500} />
              <BacktestRow rank={2} icon="🥈" count={backtestStats.rank2} color="#ea580c" />
              <BacktestRow rank={3} icon="🥉" count={backtestStats.rank3} color={GOLD_DARK} />
              <BacktestRow rank={4} icon="4" count={backtestStats.rank4} color={palette.blue700} />
              <BacktestRow rank={5} icon="5" count={backtestStats.rank5} color={palette.green700} />
            </View>
          ) : (
            <View style={{ marginTop: 16, paddingVertical: 24, alignItems: 'center', gap: 8 }}>
              <T variant="caption1" color="primary" style={{ fontWeight: '700' }}>
                분석 결과 불러오는 중...
              </T>
              {progress && (
                <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 11 }}>
                  {progress.done} / {progress.total} 회차
                </T>
              )}
            </View>
          )}
        </Card>

        {/* 정보 카드 — 동작 방식 안내 */}
        <Card padding={14}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 8 }}>
            📋 어떻게 동작하나요?
          </T>
          <View style={{ gap: 6 }}>
            <InfoLine icon="📊" text={`매주 일요일 통계 분석 자동 실행 (${POOL_SIZE_DISPLAY} 조합 풀)`} />
            <InfoLine icon="📅" text="수요일 00:00 ~ 토요일 20:00까지 50조합 받기" />
            <InfoLine icon="🎉" text="토요일 추첨 후 등수 결과 자동 확인" />
            <InfoLine icon="💎" text="PRO 멤버십 가입 시 모든 PRO 분석 기능 무제한" />
          </View>
        </Card>

        {/* 안내 — 참고용 강조 */}
        <View style={[styles.noticeBox, { backgroundColor: 'rgba(255,193,7,0.08)', borderColor: 'rgba(255,193,7,0.4)' }]}>
          <T variant="caption1" color="primary" style={{ fontSize: 12, fontWeight: '700', marginBottom: 4 }}>
            ⚠ 참고용 안내
          </T>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 11, lineHeight: 16 }}>
            본 결과는 통계 분석 도구가 제공하는 정보이며, 당첨을 보장하지 않습니다.
            본 앱은 로또 구매 대행을 하지 않으며, 사용자는 본인의 책임 하에 참고로만 이용해야 합니다.
          </T>
        </View>

        <Disclaimer short />
      </ScrollView>

      {toast && (
        <View style={[styles.toast, { backgroundColor: t.bgInverse }]} pointerEvents="none">
          <T variant="label1n" style={{ color: t.bgCanvas, fontWeight: '700' }} allowFontScaling={false}>
            {toast}
          </T>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ─── 서브 컴포넌트 ────────────────────────────────────── */

function RankRow({ rank, count, color, icon }: {
  rank: number; count: number; color: string; icon: string;
}) {
  const t = useTheme();
  const hasHit = count > 0;
  return (
    <View style={[styles.rankRow, { backgroundColor: hasHit ? color + '15' : t.bgSurface2, borderColor: hasHit ? color : t.borderDivider }]}>
      <T allowFontScaling={false} style={{ fontSize: 18, width: 36 }}>{icon}</T>
      <T variant="label1n" color="primary" style={{ flex: 1, fontWeight: '700' }}>
        {rank}등
      </T>
      <T variant="label1n" allowFontScaling={false} style={{ fontWeight: '900', color: hasHit ? color : '#888', fontSize: 16 }}>
        {count}개
      </T>
    </View>
  );
}

function BacktestRow({
  rank, icon, count, color,
}: { rank: number; icon: string; count: number; color: string }) {
  const t = useTheme();
  return (
    <View style={[styles.backtestRow, { backgroundColor: t.bgSurface2, borderColor: t.borderDivider }]}>
      <View style={[styles.backtestIcon, { backgroundColor: color + '20' }]}>
        <T allowFontScaling={false} style={{ fontSize: rank <= 3 ? 16 : 11, fontWeight: '800', color }}>
          {icon}{rank > 3 ? '등' : ''}
        </T>
      </View>
      <T variant="label1n" color="primary" style={{ flex: 1, fontWeight: '700' }}>
        {rank}등
      </T>
      <T variant="label1n" allowFontScaling={false} style={{ fontWeight: '900', color, fontSize: 15 }}>
        {fmtCount(count)}
      </T>
    </View>
  );
}

function InfoLine({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <T allowFontScaling={false} style={{ fontSize: 14, width: 18 }}>{icon}</T>
      <T variant="caption1" color="primary" style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
        {text}
      </T>
    </View>
  );
}

/** 받기 개수 선택 칩. 선택만 하고 실제 받기는 별도 버튼에서 트리거. */
function ReceiveCountPicker({
  remaining, selected, disabled, onSelect,
}: {
  remaining: number;
  selected: number | null;
  disabled: boolean;
  onSelect: (count: number) => void;
}) {
  const t = useTheme();
  // 기본 옵션: 5, 10, 20, 남은 전체 (중복/한도 초과는 자동 제거)
  const presets = Array.from(new Set([5, 10, 20, remaining]))
    .filter((n) => n >= 1 && n <= remaining)
    .sort((a, b) => a - b);

  return (
    <View style={styles.pickerWrap}>
      {presets.map((n) => {
        const isMax = n === remaining;
        const on = selected === n;
        // 라이트모드(연한 보라 hero)에서도 또렷이 보이도록 GOLD 톤으로 통일
        const baseBg = isMax ? 'rgba(232,176,78,0.18)' : 'rgba(232,176,78,0.10)';
        const baseBorder = isMax ? GOLD : 'rgba(232,176,78,0.45)';
        const textColor = on ? '#fff' : GOLD_DARK;
        return (
          <Pressable
            key={n}
            onPress={() => !disabled && onSelect(n)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.pickerBtn,
              {
                backgroundColor: on ? GOLD : baseBg,
                borderColor: on ? GOLD : baseBorder,
                opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <T
              variant="label1n"
              allowFontScaling={false}
              style={{ color: textColor, fontWeight: '800', fontSize: 13 }}
            >
              {isMax && n > 1 ? `남은 ${n}개 전체` : `${n}개`}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: { borderRadius: radius.xl + 2, padding: 14, alignItems: 'center' },
  heroTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', alignSelf: 'stretch',
  },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
  },
  heroBody: {
    alignItems: 'center', paddingVertical: 10,
  },
  /** emoji는 lineHeight = fontSize × 1.2로 명시해서 텍스트와 겹침 방지. */
  heroEmoji: {
    fontSize: 24,
    lineHeight: 32,
    marginBottom: 2,
    textAlign: 'center',
  },
  countdownPill: {
    marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  receiveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 24, paddingVertical: 11,
    borderRadius: radius.pill,
    shadowColor: GOLD,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },

  // 받기 개수 선택 picker
  pickerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  pickerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    minWidth: 64,
    alignItems: 'center',
  },

  // 등수 결과
  rankRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1,
    gap: 8,
  },

  // 조합 행
  labelBox: {
    width: 32, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  rankPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
    minWidth: 36, alignItems: 'center',
  },
  comboRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: radius.md, borderWidth: 1, gap: 10,
  },

  // 풀 정보 박스
  poolStatBox: {
    flex: 1,
    paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  poolHero: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'flex-start',
  },
  myLimitBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // 백테스트 결과 row
  backtestRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: radius.md, borderWidth: 1,
    gap: 10,
  },
  backtestIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  noticeBox: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  toast: {
    position: 'absolute',
    bottom: 32, alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.pill,
    shadowColor: '#000', shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8, elevation: 8,
  },
});
