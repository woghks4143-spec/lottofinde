/**
 * 궁합수 분석 — /compat?n=<숫자>
 *
 * 사용자가 1~45 중 하나를 선택하면, 선택한 회차 범위 기준
 *   - 가장 자주 함께 나온 번호 TOP 10
 *   - 가장 안 어울린 번호 BOTTOM 5
 * 를 막대 그래프로 보여준다.
 *
 * 회차 범위 선택: 50 / 100 / 300 / 500 / 전체
 * 단기 트렌드(50~100회)와 장기 패턴(전체)이 다를 수 있어 둘 다 분석 가능.
 *
 * 동시출현 매트릭스는 useMemo로 캐싱 (회차 범위 또는 history 변경 시만 재계산).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { NumPicker } from '@/src/components/NumPicker';
import { useHistory } from '@/src/data/historyStore';
import { bottomCompanions, coOccurrence, topCompanions } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { ballColor, palette, radius } from '@/src/design/tokens';

export default function Compat() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/home');
  const params = useLocalSearchParams<{ n?: string }>();

  // 1~45 selector default = 1 (or from query)
  const initialN = (() => {
    const p = parseInt(params.n ?? '', 10);
    return Number.isFinite(p) && p >= 1 && p <= 45 ? p : 1;
  })();
  const [selected, setSelected] = useState<number>(initialN);

  // 분석 회차 범위 — 'all' | 500 | 300 | 100 | 50
  type Range = 'all' | 500 | 300 | 100 | 50;
  const [range, setRange] = useState<Range>('all');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);

  // 전체 회차 array (newest-first, 한 번만 계산)
  const allDraws = useMemo(() => {
    return Object.keys(drawsMap)
      .map((k) => Number(k))
      .sort((a, b) => b - a)
      .map((r) => drawsMap[r]);
  }, [drawsMap, latestRound]);

  // 분석에 쓸 회차 슬라이스
  const draws = useMemo(() => {
    if (range === 'all') return allDraws;
    return allDraws.slice(0, range);
  }, [allDraws, range]);

  // 동시출현 매트릭스 (회차 범위 또는 history 변경 시만 재계산)
  const coMatrix = useMemo(() => coOccurrence(draws), [draws]);

  // 현재 선택 번호의 top/bottom 짝
  const top = useMemo(() => topCompanions(coMatrix, selected, 10), [coMatrix, selected]);
  const bottom = useMemo(() => bottomCompanions(coMatrix, selected, 5), [coMatrix, selected]);

  // 선택된 번호 자체의 출현 횟수 (해당 범위 내)
  const selectedAppearance = useMemo(() => {
    let c = 0;
    for (const d of draws) if (d.nums.includes(selected)) c++;
    return c;
  }, [draws, selected]);

  const maxTopCount = Math.max(1, ...top.map((x) => x.c));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="궁합수 분석" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* Hero: 선택 번호 + 출현 통계 (선택 범위 기준) */}
        <View style={[styles.hero, { backgroundColor: palette.neutral950 }]}>
          <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>
            분석 대상 번호
          </T>
          <View style={styles.heroRow}>
            <View style={[styles.heroBall, { backgroundColor: ballColor(selected) }]}>
              <T variant="title1" style={{ color: '#fff', fontWeight: '800' }} allowFontScaling={false}>
                {selected}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="title3" style={{ color: '#fff', fontWeight: '800' }}>
                {selected}번
              </T>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>
                {draws.length}회차 중 {selectedAppearance}회 출현
                {'  '}({draws.length > 0 ? ((selectedAppearance / draws.length) * 100).toFixed(1) : '0.0'}%)
              </T>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.55)', marginTop: 2, fontSize: 11 }}>
                {range === 'all'
                  ? `전체 ${earliestRound}~${latestRound}회차`
                  : `최근 ${range}회차 (${latestRound - range + 1}~${latestRound}회)`}
              </T>
            </View>
          </View>
        </View>

        {/* 분석 범위 선택 — 세그먼티드 컨트롤 (한 줄, 통합 컨테이너) */}
        <View style={[styles.segWrap, { backgroundColor: 'rgba(112,115,124,0.10)' }]}>
          {([50, 100, 300, 500, 'all'] as const).map((r) => {
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
                    color: on ? palette.blue700 : t.fgSecondary,
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
          <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 10 }}>
            번호 선택
          </T>
          <NumPicker
            mode="multi"
            selected={[selected]}
            onToggle={(n) => setSelected(n)}
          />
        </Card>

        {/* TOP 10 잘 어울리는 번호 */}
        <Card padding={16}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                🤝 잘 어울리는 번호 TOP 10
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
                {range === 'all' ? '전체 회차' : `최근 ${range}회`}에서 {selected}번과 가장 자주 함께 나온 번호
              </T>
            </View>
          </View>
          <View style={{ marginTop: 12, gap: 8 }}>
            {top.map((x, i) => (
              <BarRow
                key={x.n}
                rank={i + 1}
                n={x.n}
                count={x.c}
                max={maxTopCount}
                tone="accent"
              />
            ))}
          </View>
        </Card>

        {/* BOTTOM 5 안 어울리는 번호 */}
        <Card padding={16}>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                💔 안 어울리는 번호 BOTTOM 5
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
                {range === 'all' ? '전체 회차' : `최근 ${range}회`}에서 {selected}번과 가장 적게 함께 나온 번호
              </T>
            </View>
          </View>
          <View style={{ marginTop: 12, gap: 8 }}>
            {bottom.map((x, i) => (
              <BarRow
                key={x.n}
                rank={i + 1}
                n={x.n}
                count={x.c}
                max={maxTopCount}
                tone="danger"
              />
            ))}
          </View>
        </Card>

        <Disclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── BarRow: 순위 + ball + bar + count ───────────────────────────────────────

function BarRow({
  rank, n, count, max, tone,
}: {
  rank: number;
  n: number;
  count: number;
  max: number;
  tone: 'accent' | 'danger';
}) {
  const t = useTheme();
  const fill = tone === 'accent' ? palette.blue500 : palette.red500;
  const pct = Math.max(6, (count / max) * 100); // 최소 6% (시각적 무게)
  return (
    <View style={styles.barRow}>
      <T variant="caption1" color="tertiary" style={{ width: 18, textAlign: 'center', fontWeight: '700' }} allowFontScaling={false}>
        {rank}
      </T>
      <Ball n={n} size="sm" />
      <View style={[styles.barTrack, { backgroundColor: t.borderDivider }]}>
        <View style={[styles.barFill, { backgroundColor: fill, width: `${pct}%` }]} />
      </View>
      <T variant="label2" color="primary" style={{ minWidth: 36, textAlign: 'right', fontWeight: '700' }}>
        {count}회
      </T>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { borderRadius: radius.xl + 2, padding: 18 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  heroBall: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 6,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
});
