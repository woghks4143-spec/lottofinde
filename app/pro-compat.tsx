/**
 * PRO 궁합수 — /pro-compat
 *
 * 일반 모드의 "궁합수 분석"을 전문가급으로 확장하되 평이한 한글 유지.
 *
 *   1. 다중 번호 선택 (1~5개) — 여러 번호의 합산 궁합 분석
 *   2. 합산 궁합 TOP 10 — 선택한 번호들과 가장 자주 함께 나온 번호
 *   3. 자동 추천 조합 5개 — 선택 번호 + TOP 짝궁으로 6자리 완성
 *   4. 궁합 트리오 TOP 10 — 같은 회차에 자주 등장한 3개 묶음
 *   5. 평이한 인사이트 — "X번을 같이 고르면 Y번이 평균보다 N배 자주 나왔어요"
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
import { NumPicker } from '@/src/components/NumPicker';
import { useHistory } from '@/src/data/historyStore';
import { coOccurrence } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const GOLD = '#e8b04e';
const GOLD_SOFT = '#fff4dc';
const GOLD_DARK = '#a37116';

const MAX_PICK = 5;

type Range = 'all' | 500 | 300 | 100 | 50;
const RANGES: Range[] = [50, 100, 300, 500, 'all'];

export default function ProCompat() {
  const t = useTheme();
  const goBack = useSafeBack('/pro-analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);

  const [picked, setPicked] = useState<number[]>([7, 13, 27]);
  const [range, setRange] = useState<Range>('all');

  // newest-first 회차 배열
  const allDraws = useMemo(() => {
    return Object.keys(drawsMap)
      .map((k) => Number(k))
      .sort((a, b) => b - a)
      .map((r) => drawsMap[r]);
  }, [drawsMap, latestRound]);

  const draws = useMemo(() => {
    if (range === 'all') return allDraws;
    return allDraws.slice(0, range);
  }, [allDraws, range]);

  /** 동시출현 매트릭스 — 회차 범위 변경 시만 재계산. */
  const coMatrix = useMemo(() => coOccurrence(draws), [draws]);

  /**
   * 짝궁 점수 — Lift 기반 (관측 ÷ 기대).
   *
   * 단순 합산의 빈도 편향(자주 나오는 번호가 무조건 상위)을 제거하기 위해,
   * 각 picked p에 대해 "우연이라면 같이 나올 횟수(expected)" 대비 "실제 같이
   * 나온 횟수(actual)" 비율을 계산하고 picked 전체에 대해 **기하평균**.
   *
   *   expected_p = freq[n] × freq[p] / totalDraws   (독립 가정)
   *   lift_p     = (actual_p + 1) / (expected_p + 1) (Laplace-1 smoothing)
   *   score(n)   = (∏ lift_p)^(1/k)                   (기하평균)
   *
   * Lift = 1.0 은 우연 수준, 1.3+ 은 뚜렷한 동행, 0.7 이하는 회피 경향.
   * 기하평균이라 picked 한 명한테라도 안 맞으면 점수가 떨어지는 게 장점.
   */
  const partners = useMemo(() => {
    if (picked.length === 0) return [];
    const totalDraws = draws.length;
    if (totalDraws === 0) return [];
    const pickedSet = new Set(picked);

    // 전체 빈도
    const freq = new Array(46).fill(0);
    for (const d of draws) for (const n of d.nums) freq[n]++;

    const items: { n: number; lift: number; raw: number }[] = [];
    for (let n = 1; n <= 45; n++) {
      if (pickedSet.has(n)) continue;
      let product = 1;
      let raw = 0;
      for (const p of picked) {
        const actual = coMatrix[n][p];
        const expected = (freq[n] * freq[p]) / totalDraws;
        // Laplace-1 smoothing: 0/0이나 극단치 방지
        const lift = (actual + 1) / (expected + 1);
        product *= lift;
        raw += actual;
      }
      const geomean = Math.pow(product, 1 / picked.length);
      items.push({ n, lift: geomean, raw });
    }
    items.sort((a, b) => b.lift - a.lift);
    return items;
  }, [coMatrix, picked, draws]);

  /** 안 어울리는 번호 BOTTOM 5 — lift가 가장 낮은 5개 (덜 함께 나온 번호). */
  const worstPartners = useMemo(() => {
    if (partners.length === 0) return [];
    return [...partners].sort((a, b) => a.lift - b.lift).slice(0, 5);
  }, [partners]);
  const maxPartnerLiftBottom = Math.max(
    ...worstPartners.map((p) => p.lift),
    0.01,
  );

  /** 궁합 트리오 — 같은 회차에 자주 함께 등장한 3개 묶음. */
  const trios = useMemo(() => {
    const counter = new Map<string, number>();
    for (const d of draws) {
      const ns = d.nums; // 6개 본번호 (이미 정렬됨)
      // C(6,3) = 20 triples per draw
      for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
          for (let k = j + 1; k < 6; k++) {
            const key = `${ns[i]}-${ns[j]}-${ns[k]}`;
            counter.set(key, (counter.get(key) ?? 0) + 1);
          }
        }
      }
    }
    const items: { trio: number[]; c: number }[] = [];
    counter.forEach((c, key) => {
      const trio = key.split('-').map(Number);
      items.push({ trio, c });
    });
    items.sort((a, b) => b.c - a.c || a.trio[0] - b.trio[0]);
    return items.slice(0, 10);
  }, [draws]);

  // ─── 핸들러 ─────────────────────────────────────────────
  const toggleNumber = (n: number) => {
    if (picked.includes(n)) {
      setPicked(picked.filter((x) => x !== n));
    } else if (picked.length < MAX_PICK) {
      setPicked([...picked, n]);
    }
  };

  const clearPicked = () => setPicked([]);

  const maxPartnerLift = Math.max(0.01, partners[0]?.lift ?? 1);
  const maxTrioCount = Math.max(1, trios[0]?.c ?? 1);

  // ─── 출현 통계 (선택 번호 모두의 평균 출현률 등은 단순화) ─────────
  const selectedAppearance = useMemo(() => {
    if (picked.length === 0) return 0;
    let totalHits = 0;
    for (const d of draws) {
      for (const p of picked) {
        if (d.nums.includes(p)) totalHits++;
      }
    }
    return picked.length > 0 ? totalHits / picked.length : 0;
  }, [draws, picked]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon.crown color={GOLD} size={18} weight={2} />
            <T variant="heading1" color="primary">궁합수</T>
          </View>
        }
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>

        {/* Hero — 선택한 번호 + 분석 범위 (라이트/다크 자동 분기) */}
        <View style={[styles.hero, { backgroundColor: t.bgHero }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroBadge, { backgroundColor: GOLD }]}>
              <Icon.crown color="#fff" size={12} weight={2.5} />
              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10, marginLeft: 4, letterSpacing: 0.4 }}>
                PRO
              </T>
            </View>
            <T variant="caption1" allowFontScaling={false} style={{ color: t.fgOnHeroFaint, fontSize: 11 }}>
              {range === 'all'
                ? `전체 ${earliestRound}~${latestRound}회`
                : `최근 ${range}회 (${(latestRound ?? 0) - range + 1}~${latestRound})`}
            </T>
          </View>
          <T variant="caption1" style={{ color: t.fgOnHeroMuted, fontWeight: '600', marginTop: 10 }}>
            선택한 번호 ({picked.length}/{MAX_PICK})
          </T>
          <View style={styles.heroBalls}>
            {picked.length === 0 ? (
              <T variant="body2r" style={{ color: t.fgOnHeroFaint, marginTop: 4 }}>
                1~5개 번호를 골라보세요
              </T>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {picked.map((n) => (
                  <Ball key={n} n={n} size="md" />
                ))}
              </View>
            )}
          </View>
          {picked.length > 0 && (
            <T variant="caption1" style={{ color: 'rgba(255,255,255,0.78)', marginTop: 12, fontSize: 12 }}>
              평균 {selectedAppearance.toFixed(1)}회 출현 · {draws.length}회차 분석
            </T>
          )}
        </View>

        {/* 분석 범위 세그먼티드 */}
        <View style={[styles.segWrap, { backgroundColor: 'rgba(112,115,124,0.10)' }]}>
          {RANGES.map((r) => {
            const on = range === r;
            const label = r === 'all' ? '전체' : `${r}회`;
            return (
              <Pressable
                key={String(r)}
                onPress={() => setRange(r)}
                style={({ pressed }) => [
                  styles.segOpt,
                  on && [styles.segOptActive, { backgroundColor: t.bgSurface }],
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <T
                  variant="label1n"
                  style={{
                    color: on ? GOLD_DARK : t.fgSecondary,
                    fontWeight: on ? '800' : '600',
                    fontSize: 13,
                  }}
                  allowFontScaling={false}
                >
                  {label}
                </T>
              </Pressable>
            );
          })}
        </View>

        {/* 번호 선택 그리드 */}
        <Card padding={14}>
          <View style={styles.cardHead}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
              번호 선택 (최대 {MAX_PICK}개)
            </T>
            {picked.length > 0 && (
              <Pressable onPress={clearPicked} hitSlop={8}>
                <T variant="caption1" allowFontScaling={false} style={{ color: palette.red500, fontWeight: '700' }}>
                  초기화
                </T>
              </Pressable>
            )}
          </View>
          <NumPicker
            mode="multi"
            selected={picked}
            onToggle={toggleNumber}
            style={{ marginTop: 10 }}
          />
          {picked.length >= MAX_PICK && (
            <T variant="caption1" color="tertiary" style={{ marginTop: 8, fontSize: 11.5 }}>
              최대 {MAX_PICK}개까지 선택할 수 있어요
            </T>
          )}
        </Card>

        {/* 짝궁 TOP 10 — Lift 기반 (빈도 편향 제거) */}
        {picked.length > 0 && (
          <Card padding={16}>
            <View>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                🤝 짝궁 TOP 10
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                선택한 {picked.length}개 번호와 우연보다 자주 같이 나온 정도 (배수) 기준
              </T>
            </View>
            <View style={{ marginTop: 12, gap: 8 }}>
              {partners.slice(0, 10).map((p, i) => (
                <PartnerRow
                  key={p.n}
                  rank={i + 1}
                  n={p.n}
                  lift={p.lift}
                  raw={p.raw}
                  max={maxPartnerLift}
                />
              ))}
            </View>
          </Card>
        )}

        {/* 안 어울리는 번호 BOTTOM 5 — Lift 가장 낮음 */}
        {picked.length > 0 && worstPartners.length > 0 && (
          <Card padding={16}>
            <View>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                💔 안 어울리는 번호 BOTTOM 5
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                선택한 {picked.length}개 번호와 가장 적게 함께 나온 번호
              </T>
            </View>
            <View style={{ marginTop: 12, gap: 8 }}>
              {worstPartners.map((p, i) => (
                <PartnerRow
                  key={p.n}
                  rank={i + 1}
                  n={p.n}
                  lift={p.lift}
                  raw={p.raw}
                  max={maxPartnerLiftBottom}
                  worst
                />
              ))}
            </View>
          </Card>
        )}

        {/* 궁합 트리오 TOP 10 */}
        <Card padding={16}>
          <View>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
              🎯 궁합 트리오 TOP 10
            </T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
              같은 회차에 함께 나온 3개 묶음 순위 (선택과 무관)
            </T>
          </View>
          <View style={{ marginTop: 12, gap: 8 }}>
            {trios.map((tr, i) => (
              <TrioRow
                key={i}
                rank={i + 1}
                trio={tr.trio}
                count={tr.c}
                max={maxTrioCount}
              />
            ))}
          </View>
        </Card>

        <Disclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   짝궁 행 — 순위 + ball + bar + 점수 + 배수
   ═══════════════════════════════════════════════════════════════════════════ */

function PartnerRow({
  rank, n, lift, raw, max, worst,
}: {
  rank: number;
  n: number;
  lift: number;   // 기하평균 Lift — 정렬 기준
  raw: number;    // 합산 동시출현 (참고용)
  max: number;    // 최상위 lift (bar 너비 계산)
  worst?: boolean; // BOTTOM 5 모드 — 빨강 톤
}) {
  const t = useTheme();
  const pct = Math.max(6, (lift / max) * 100);
  const isStrong = !worst && lift >= 1.3;
  const isWeak = !worst && lift < 1.0;
  const barColor = worst ? palette.red500 : isStrong ? GOLD : isWeak ? '#999' : palette.blue500;
  const valColor = worst ? palette.red500 : isStrong ? GOLD_DARK : isWeak ? '#888' : palette.blue700;
  return (
    <View style={styles.barRow}>
      <T variant="caption1" color="tertiary" style={{ width: 18, textAlign: 'center', fontWeight: '700' }} allowFontScaling={false}>
        {rank}
      </T>
      <Ball n={n} size="sm" />
      <View style={[styles.barTrack, { backgroundColor: t.borderDivider }]}>
        <View
          style={[
            styles.barFill,
            { backgroundColor: barColor, width: `${pct}%` },
          ]}
        />
      </View>
      <View style={{ minWidth: 70, alignItems: 'flex-end' }}>
        <T
          variant="label2"
          allowFontScaling={false}
          style={{ fontWeight: '800', color: valColor }}
        >
          {lift.toFixed(2)}배
        </T>
        <T
          variant="caption2"
          allowFontScaling={false}
          style={{ fontSize: 10, color: '#888', fontWeight: '600' }}
        >
          동시 {raw}회
        </T>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   트리오 행 — 순위 + 3개 ball + count
   ═══════════════════════════════════════════════════════════════════════════ */

function TrioRow({
  rank, trio, count, max,
}: {
  rank: number;
  trio: number[];
  count: number;
  max: number;
}) {
  const t = useTheme();
  const pct = Math.max(6, (count / max) * 100);
  return (
    <View style={styles.barRow}>
      <T variant="caption1" color="tertiary" style={{ width: 18, textAlign: 'center', fontWeight: '700' }} allowFontScaling={false}>
        {rank}
      </T>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {trio.map((n) => <Ball key={n} n={n} size="sm" />)}
      </View>
      <View style={[styles.barTrack, { backgroundColor: t.borderDivider, marginLeft: 4 }]}>
        <View style={[styles.barFill, { backgroundColor: palette.blue500, width: `${pct}%` }]} />
      </View>
      <T variant="label2" color="primary" style={{ minWidth: 40, textAlign: 'right', fontWeight: '700' }}>
        {count}회
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: { borderRadius: radius.xl + 2, padding: 18, overflow: 'hidden' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, alignSelf: 'flex-start',
  },
  heroBalls: { minHeight: 44 },

  segWrap: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    gap: 2,
  },
  segOpt: {
    flex: 1,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segOptActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },

  // ── 추천 조합 결과 ───────────────────────────────────
  recActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  refreshBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  saveAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: radius.pill,
  },
  labelBox: {
    width: 32, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  saveDot: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
  },

  toast: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.pill,
    shadowColor: '#000', shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8, elevation: 8,
  },
});
