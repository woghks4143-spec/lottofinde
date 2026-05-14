/**
 * 특정 주간 출현 — /weekly
 *
 * 최근 N주(5/10/15/20/30 또는 직접 입력) 동안 1~45 번호별 출현 횟수를
 * 집계해 자주 나온 / 안 나온 번호 랭킹과 전체 그리드를 보여준다.
 *
 * 데이터 소스: `useHistory.getLast(N)` — 시드(1~1223회) 캐시 기반.
 * 알고리즘: `frequency()`가 N×6번 카운트 후 [top, bottom] 정렬해 반환.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { useHistory } from '@/src/data/historyStore';
import { frequency } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const PRESET_WEEKS = [5, 10, 15, 20, 30];

export default function Weekly() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/analysis');
  const [weeks, setWeeks] = useState<number>(10);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [sortMode, setSortMode] = useState<'natural' | 'freq'>('natural');

  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);
  const draws = useHistory((s) => s.draws);

  // 최근 N회차 (실제 보유 데이터 안에서)
  const slice = useMemo(() => {
    const from = Math.max(earliestRound, latestRound - weeks + 1);
    const out: { round: number; nums: number[] }[] = [];
    for (let r = latestRound; r >= from; r--) {
      const d = draws[r];
      if (d) out.push({ round: r, nums: d.nums });
    }
    return { items: out, from, to: latestRound };
  }, [draws, latestRound, earliestRound, weeks]);

  const freq = useMemo(() => frequency(slice.items), [slice.items]);

  // 0~maxCount 비율 (시각화용)
  const maxCount = useMemo(() => {
    let m = 0;
    for (let n = 1; n <= 45; n++) if (freq.count[n] > m) m = freq.count[n];
    return m;
  }, [freq]);

  /**
   * 1~45 번호의 빈도순 정렬 (내림차순) — 6위, 10위 등 중간 순위를 시각적으로
   * 식별할 수 있게 그리드 색상과 정렬에 활용.
   */
  const rankedNums = useMemo(() => {
    return Array.from({ length: 45 }, (_, i) => i + 1)
      .sort((a, b) => freq.count[b] - freq.count[a]);
  }, [freq]);
  /** 번호 → 1~45 순위 매핑 (1위가 가장 자주 나온 번호). */
  const rankOf = useMemo(() => {
    const m = new Map<number, number>();
    rankedNums.forEach((n, i) => m.set(n, i + 1));
    return m;
  }, [rankedNums]);

  const applyCustom = () => {
    const n = parseInt(customInput.replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(n) && n > 0) {
      setWeeks(Math.min(Math.max(1, n), latestRound - earliestRound + 1));
      setCustomMode(false);
      setCustomInput('');
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="특정 주간 출현" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* 주간 범위 선택 */}
        <Card padding={14}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 8 }}>
            기간 선택
          </T>
          <View style={styles.weekRow}>
            {PRESET_WEEKS.map((w) => {
              const on = !customMode && weeks === w;
              return (
                <Pressable
                  key={w}
                  onPress={() => { setWeeks(w); setCustomMode(false); }}
                  style={({ pressed }) => [
                    styles.weekBtn,
                    {
                      backgroundColor: on ? t.bgAccent : t.bgSurface,
                      borderColor: on ? 'transparent' : t.borderWeak,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <T variant="caption1" style={{ color: on ? '#fff' : t.fgSecondary, fontWeight: '700' }}>
                    {w}주
                  </T>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setCustomMode(true)}
              style={({ pressed }) => [
                styles.weekBtn,
                {
                  backgroundColor: customMode ? t.bgAccent : t.bgSurface,
                  borderColor: customMode ? 'transparent' : t.borderWeak,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <T variant="caption1" style={{ color: customMode ? '#fff' : t.fgSecondary, fontWeight: '700' }}>
                직접 입력
              </T>
            </Pressable>
          </View>

          {customMode && (
            <View style={{ marginTop: 10 }}>
              <View style={[styles.customRow, { borderColor: t.borderNormal, backgroundColor: t.bgSurface2 }]}>
                <TextInput
                  value={customInput}
                  onChangeText={(v) => setCustomInput(v.replace(/[^0-9]/g, '').slice(0, 4))}
                  onSubmitEditing={applyCustom}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder="회차 수 입력 (예: 50)"
                  placeholderTextColor={t.fgTertiary}
                  style={[styles.customInput, { color: t.fgPrimary }]}
                  returnKeyType="go"
                />
                <Pressable
                  onPress={applyCustom}
                  style={({ pressed }) => [styles.applyBtn, { backgroundColor: palette.blue500, opacity: pressed ? 0.85 : 1 }]}
                >
                  <T variant="label1n" style={{ color: '#fff', fontWeight: '800' }} allowFontScaling={false}>적용</T>
                </Pressable>
              </View>
              <T variant="caption2" color="tertiary" style={{ marginTop: 6, marginLeft: 4, fontSize: 11 }}>
                최소 1, 최대 {latestRound - earliestRound + 1}회까지 입력할 수 있어요
              </T>
            </View>
          )}

          <T variant="caption1" color="tertiary" style={{ marginTop: 12, lineHeight: 18 }}>
            최근 <T variant="caption1" style={{ color: palette.blue700, fontWeight: '800' }}>{weeks}주</T> ·
            {' '}<T variant="caption1" style={{ fontWeight: '700' }}>{slice.from}회 ~ {slice.to}회</T>
            {' '}({slice.items.length}개 회차 분석)
          </T>
        </Card>

        {/* Top-5 자주 나온 번호 */}
        <Card padding={16}>
          <View style={styles.cardHead}>
            <View style={[styles.tonePill, { backgroundColor: 'rgba(255,66,66,0.10)' }]}>
              <T variant="caption2" style={{ color: palette.red500, fontWeight: '800', fontSize: 10 }} allowFontScaling={false}>
                🔥 HOT
              </T>
            </View>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>자주 나온 번호 (Top 5)</T>
          </View>
          <View style={styles.rankList}>
            {freq.top.map((it, i) => (
              <RankRow key={it.n} rank={i + 1} n={it.n} count={it.c} total={slice.items.length} maxCount={maxCount} tone="hot" />
            ))}
          </View>
        </Card>

        {/* Bottom-5 안 나온 번호 */}
        <Card padding={16}>
          <View style={styles.cardHead}>
            <View style={[styles.tonePill, { backgroundColor: 'rgba(0,102,255,0.10)' }]}>
              <T variant="caption2" style={{ color: palette.blue700, fontWeight: '800', fontSize: 10 }} allowFontScaling={false}>
                ❄️ COLD
              </T>
            </View>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>잠수 번호 (Bottom 5)</T>
          </View>
          <View style={styles.rankList}>
            {freq.bottom.map((it, i) => (
              <RankRow key={it.n} rank={i + 1} n={it.n} count={it.c} total={slice.items.length} maxCount={maxCount} tone="cold" />
            ))}
          </View>
        </Card>

        {/* 1~45 전체 그리드 */}
        <Card padding={14}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                전체 출현 횟수
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
                1~45 모든 번호의 {weeks}주간 출현 횟수
              </T>
            </View>
            {/* 정렬 토글 */}
            <View style={[styles.sortToggle, { backgroundColor: t.bgSurface2 }]}>
              {(['natural', 'freq'] as const).map((m) => {
                const on = sortMode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setSortMode(m)}
                    style={({ pressed }) => [
                      styles.sortBtn,
                      on && [styles.sortBtnActive, { backgroundColor: t.bgSurface }],
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <T variant="caption2" style={{ color: on ? palette.blue700 : t.fgSecondary, fontWeight: on ? '800' : '600', fontSize: 11 }} allowFontScaling={false}>
                      {m === 'natural' ? '번호순' : '빈도순'}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.grid, { marginTop: 14 }]}>
            {(sortMode === 'natural'
              ? Array.from({ length: 45 }, (_, i) => i + 1)
              : rankedNums
            ).map((n) => {
              const c = freq.count[n];
              const ratio = maxCount > 0 ? c / maxCount : 0;
              const rank = rankOf.get(n) ?? 0;
              const col = colorForRank(rank, t.fgSecondary);
              return (
                <View key={n} style={styles.gridCell}>
                  <Ball n={n} size="xs" />
                  <View style={[styles.countBar, { backgroundColor: t.borderDivider }]}>
                    <View style={[styles.countFill, { width: `${Math.max(ratio * 100, 6)}%`, backgroundColor: col.fill }]} />
                  </View>
                  <T variant="caption2" style={{ fontSize: 10, color: col.text, fontWeight: col.bold ? '800' : '600', minWidth: 16, textAlign: 'right' }} allowFontScaling={false}>
                    {c}
                  </T>
                </View>
              );
            })}
          </View>
        </Card>

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * 3단계 색상 매핑 — Top 5 / Bottom 5 / 보통.
 * 빈도순 모드에서는 위치 자체가 순위이므로 색상은 단순하게 유지.
 */
function colorForRank(rank: number, defaultText: string): { fill: string; text: string; bold: boolean } {
  if (rank <= 5)  return { fill: palette.red500,    text: palette.red500,  bold: true };
  if (rank > 40)  return { fill: palette.blue500,   text: palette.blue700, bold: true };
  return            { fill: palette.neutral500,     text: defaultText,     bold: false };
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function RankRow({
  rank, n, count, total, maxCount, tone,
}: {
  rank: number; n: number; count: number; total: number; maxCount: number;
  tone: 'hot' | 'cold';
}) {
  const t = useTheme();
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const fill = tone === 'hot' ? palette.red500 : palette.blue500;
  const bgFill = tone === 'hot' ? 'rgba(255,66,66,0.10)' : 'rgba(0,102,255,0.10)';
  const ratio = maxCount > 0 ? count / maxCount : 0;

  return (
    <View style={styles.rankRow}>
      <View style={[styles.rankNum, { backgroundColor: bgFill }]}>
        <T variant="caption2" style={{ color: fill, fontWeight: '800', fontSize: 11 }} allowFontScaling={false}>
          {rank}
        </T>
      </View>
      <Ball n={n} size="sm" />
      <View style={{ flex: 1 }}>
        <View style={[styles.rankBar, { backgroundColor: t.borderDivider }]}>
          <View style={[styles.rankFill, { width: `${Math.max(ratio * 100, 6)}%`, backgroundColor: fill }]} />
        </View>
      </View>
      <View style={{ minWidth: 60, alignItems: 'flex-end' }}>
        <T variant="label1n" color="primary" style={{ fontWeight: '800' }} allowFontScaling={false}>
          {count}회
        </T>
        <T variant="caption2" color="tertiary" style={{ fontSize: 10 }} allowFontScaling={false}>
          {pct}%
        </T>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // 주간 선택
  weekRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weekBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  customInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 8,
    outlineStyle: 'none' as any,
  },
  applyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
  },

  // 카드 헤더
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tonePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },

  // 랭킹 행
  rankList: { gap: 10 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankNum: {
    width: 22, height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  rankFill: {
    height: '100%',
    borderRadius: 4,
  },

  // 정렬 토글
  sortToggle: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    gap: 2,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  sortBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },

  // 색상 범례
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // 전체 그리드 — 5컬럼 (45 / 5 = 9행)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  gridCell: {
    width: '18.5%', // 5컬럼 + gap 보정
    minWidth: 60,
    flexGrow: 1,
    flexBasis: '18%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  countBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  countFill: {
    height: '100%',
    borderRadius: 2,
  },
});
