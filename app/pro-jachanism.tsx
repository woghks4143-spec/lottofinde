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
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import { rank as computeRank } from '@/src/data/lotto';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { useJachanism } from '@/src/store/jachanism';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';
import {
  POOL_SIZE, POOL_SIZE_DISPLAY, USER_LIMIT, BACKTEST_BASE_N,
  computeBacktest, generateUserCombosRange, fmtCount,
  getDayStatus, msToNextReceive, msToReceiveEnd, formatCountdown,
  fetchWeeklyPool, pickUserCombosFromPool,
  type BacktestStats, type JachanismStatus,
} from '@/src/lib/jachanism';

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

  // 백테스트 계산 트리거 — 캐시가 없거나 latestRound가 바뀌었으면 비동기 계산
  useEffect(() => {
    if (!latestRound) return;
    if (backtestCache && backtestCache.latestRound === latestRound) return;
    if (computing) return;

    let cancelled = false;
    (async () => {
      setComputing(true);
      try {
        const stats = await computeBacktest(
          drawsMap, latestRound, BACKTEST_BASE_N,
          (d, t) => { if (!cancelled) setProgress({ done: d, total: t }); },
        );
        if (!cancelled) {
          setBacktest({ latestRound, ...stats });
          setProgress(null);
        }
      } catch {
        if (!cancelled) setComputing(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestRound]);

  const backtestStats: BacktestStats | null = useMemo(() => {
    if (!backtestCache || backtestCache.latestRound !== latestRound) return null;
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

  /** 상태 판정: 요일 + 데이터 보유 여부 기반. */
  const status: Status = useMemo(() => {
    if (drawsMap[targetRound]) return 'done';
    return getDayStatus();
  }, [drawsMap, targetRound]);


  /** 현재까지 받은 조합 수 / 남은 수령 가능 수. */
  const receivedCount = entry?.combos.length ?? 0;
  const remainingCount = Math.max(0, USER_LIMIT - receivedCount);

  /** 선택한 수령 개수 (사용자가 [5개] 같은 칩을 누르면 세팅, [조합받기] 누르면 실행). */
  const [selectedCount, setSelectedCount] = useState<number | null>(null);

  /** 받기 액션 — 자동으로 보관함에 저장. */
  const [receiving, setReceiving] = useState(false);
  const handleReceive = async () => {
    if (status !== 'active' || receiving) return;
    if (selectedCount == null) return;
    const take = Math.max(1, Math.min(selectedCount, remainingCount));
    if (take === 0) return;
    setReceiving(true);
    try {
      const offset = receivedCount;
      // 1순위: GitHub 주간 풀
      const pool = await fetchWeeklyPool(targetRound);
      let combos: number[][];
      if (pool && pool.combos.length >= USER_LIMIT) {
        combos = pickUserCombosFromPool(pool, targetRound, deviceSeed, offset, take);
      } else {
        // 폴백: 로컬 알고리즘
        combos = generateUserCombosRange(targetRound, deviceSeed, offset, take);
      }
      // 1) 회차 기록에 저장
      receive(targetRound, combos);
      // 2) 보관함에 자동 저장 (귀찮이즘 source로 표시)
      const games = combos.map((c) => ({
        nums: c,
        source: 'jachanism' as const,
        round: targetRound,
      }));
      const res = addMany(games);
      // 칩 선택 초기화
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
              <T variant="title2" allowFontScaling={false} style={{ color: t.fgOnHero, fontWeight: '900' }}>
                분석 진행 중
              </T>
              <T variant="body2r" style={{ color: t.fgOnHeroMuted, marginTop: 6, textAlign: 'center' }}>
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
              <T variant="title2" allowFontScaling={false} style={{ color: t.fgOnHero, fontWeight: '900' }}>
                {receivedCount === 0 ? '이번 주 분석 완료' : `${receivedCount}개 받음 · ${remainingCount}개 더 받기 가능`}
              </T>
              <T variant="body2r" style={{ color: t.fgOnHeroMuted, marginTop: 6, textAlign: 'center' }}>
                받고 싶은 개수를 골라주세요 (이번 주 최대 50개)
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
                <Icon.sparkle color="#fff" size={16} weight={2.5} />
                <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', marginLeft: 6, fontSize: 15 }}>
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
              <T variant="title2" allowFontScaling={false} style={{ color: t.fgOnHero, fontWeight: '900' }}>
                이번 주 50조합 받기 완료
              </T>
              <T variant="body2r" style={{ color: t.fgOnHeroMuted, marginTop: 6, textAlign: 'center' }}>
                아래에서 50조합 확인 · 보관함 저장 가능
              </T>
            </View>
          )}

          {status === 'drawing' && (
            <View style={styles.heroBody}>
              <T allowFontScaling={false} style={styles.heroEmoji}>⏳</T>
              <T variant="title2" allowFontScaling={false} style={{ color: t.fgOnHero, fontWeight: '900' }}>
                추첨 진행 중
              </T>
              <T variant="body2r" style={{ color: t.fgOnHeroMuted, marginTop: 6, textAlign: 'center' }}>
                토요일 20:35 추첨 후 결과 공개
              </T>
            </View>
          )}

          {status === 'done' && (
            <View style={styles.heroBody}>
              <T allowFontScaling={false} style={styles.heroEmoji}>🎉</T>
              <T variant="title2" allowFontScaling={false} style={{ color: t.fgOnHero, fontWeight: '900' }}>
                {targetRound}회 추첨 완료
              </T>
              <T variant="body2r" style={{ color: t.fgOnHeroMuted, marginTop: 6, textAlign: 'center' }}>
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

            <View style={{ marginTop: 12, gap: 8 }}>
              {entry.combos.map((c, i) => {
                // 추첨 완료 시 등수 표시
                const drawn = status === 'done' ? drawsMap[targetRound] : null;
                const r = drawn ? computeRank(c, drawn.nums, drawn.bonus) : null;
                return (
                  <View
                    key={i}
                    style={[styles.comboRow, {
                      backgroundColor: t.bgSurface2,
                      borderColor: r != null && r <= 3 ? GOLD : t.borderDivider,
                      borderWidth: r != null && r <= 3 ? 2 : 1,
                    }]}
                  >
                    <View style={styles.labelBox}>
                      <T variant="caption2" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 11 }}>
                        #{i + 1}
                      </T>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {c.map((n) => {
                        const isMain = drawn?.nums.includes(n);
                        const isBonus = !isMain && drawn?.bonus === n;
                        return (
                          <Ball
                            key={n}
                            n={n}
                            size="sm"
                            dashedRing={isMain || isBonus}
                            dashedRingColor={isMain ? palette.red500 : isBonus ? palette.purple500 : undefined}
                          />
                        );
                      })}
                    </View>
                    {r != null && (
                      <View style={[styles.rankPill, { backgroundColor: r === 1 ? palette.red500 : r === 2 ? '#ea580c' : r === 3 ? GOLD_DARK : r === 4 ? palette.blue700 : palette.green700 }]}>
                        <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>
                          {r}등
                        </T>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* 이번 주 분석 풀 — 총 풀 + 내 한도 (남은 조합은 백엔드 연동 시 추가) */}
        <Card padding={14}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
            📦 이번 주 분석 풀
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
            한 사람당 최대 {USER_LIMIT}조합 · 중복 없이 발급
          </T>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={[styles.poolStatBox, { backgroundColor: 'rgba(232,176,78,0.10)', borderColor: GOLD }]}>
              <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: GOLD_DARK, fontWeight: '700' }}>
                총 분석 풀
              </T>
              <T variant="title3" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '900', fontSize: 17, marginTop: 4 }}>
                {POOL_SIZE_DISPLAY}
              </T>
              <T variant="caption2" allowFontScaling={false} style={{ fontSize: 9, color: GOLD_DARK, opacity: 0.7, marginTop: 1 }}>
                조합
              </T>
            </View>
            <View style={[styles.poolStatBox, { backgroundColor: 'rgba(0,102,255,0.10)', borderColor: palette.blue700 }]}>
              <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10, color: palette.blue700, fontWeight: '700' }}>
                내 한도
              </T>
              <T variant="title3" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '900', fontSize: 22, marginTop: 4 }}>
                {USER_LIMIT}
              </T>
              <T variant="caption2" allowFontScaling={false} style={{ fontSize: 9, color: palette.blue700, opacity: 0.7, marginTop: 1 }}>
                조합/주
              </T>
            </View>
          </View>
        </Card>

        {/* 최근 30회 백테스트 결과 — 실측 데이터 */}
        <Card padding={16}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
              📊 최근 {BACKTEST_BASE_N}회 분석 결과
            </T>
            {backtestStats && (
              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5 }}>
                (실측)
              </T>
            )}
          </View>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
            {POOL_SIZE_DISPLAY} 조합 풀 기준 누적 — 당첨 보장 X
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
                분석 중...
              </T>
              {progress && (
                <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 11 }}>
                  {progress.done} / {progress.total} 회차
                </T>
              )}
              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 4 }}>
                실제 과거 회차에 대해 백테스트 진행 중 (1회만 계산 후 캐시)
              </T>
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
  // 기본 옵션: 5, 10, 20, 남은 전체 (중복/한도 초과는 자동 제거)
  const presets = Array.from(new Set([5, 10, 20, remaining]))
    .filter((n) => n >= 1 && n <= remaining)
    .sort((a, b) => a - b);

  return (
    <View style={styles.pickerWrap}>
      {presets.map((n) => {
        const isMax = n === remaining;
        const on = selected === n;
        const baseBg = isMax ? 'rgba(232,176,78,0.15)' : 'rgba(255,255,255,0.10)';
        const baseBorder = isMax ? 'rgba(232,176,78,0.5)' : 'rgba(255,255,255,0.20)';
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
              style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}
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

  hero: { borderRadius: radius.xl + 2, padding: 22, alignItems: 'center' },
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
    alignItems: 'center', paddingVertical: 20,
  },
  /** emoji는 lineHeight = fontSize × 1.2로 명시해서 텍스트와 겹침 방지. */
  heroEmoji: {
    fontSize: 56,
    lineHeight: 72,
    marginBottom: 16,
    textAlign: 'center',
  },
  countdownPill: {
    marginTop: 14,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  receiveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 28, paddingVertical: 14,
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
    gap: 8,
    marginTop: 18,
  },
  pickerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    minWidth: 70,
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
