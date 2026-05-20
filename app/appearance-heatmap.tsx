/**
 * 출현 분석 — /appearance-heatmap
 *
 * 회차별 당첨번호를 1~45 격자로 시각화.
 *   - 가로축: 회차 (최근 → 과거, 사용자가 N=10/20/30/50 선택)
 *   - 세로축: 1~45번
 *   - 셀이 칠해져 있으면 그 회차에 출현
 *   - 번호 구간별 다른 색:
 *       1~10  : 노랑
 *       11~20 : 파랑
 *       21~30 : 핑크
 *       31~45 : 다크
 *
 * 추가 인사이트:
 *   - 최근 N회 자주 나온 번호 TOP 5 (핫)
 *   - 최근 N회 한 번도 안 나온 번호 (콜드)
 *
 * ※ 통계 시각화 도구. 다음 회차 결과를 예측하는 것이 아닙니다.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { useHistory } from '@/src/data/historyStore';
import { useTheme } from '@/src/design/theme';
import { radius } from '@/src/design/tokens';

const RANGE_N = 50;

/** 번호 구간별 색상 — 1~10/11~20/21~30/31~45. */
function zoneColor(n: number): { bg: string; fg: string; bgEmpty: string } {
  if (n <= 10) return { bg: '#f5b400', fg: '#ffffff', bgEmpty: 'rgba(245,180,0,0.10)' };   // 노랑
  if (n <= 20) return { bg: '#3aa1ff', fg: '#ffffff', bgEmpty: 'rgba(58,161,255,0.10)' };  // 파랑
  if (n <= 30) return { bg: '#ff6c7a', fg: '#ffffff', bgEmpty: 'rgba(255,108,122,0.10)' }; // 핑크
  return { bg: '#2c3346', fg: '#ffffff', bgEmpty: 'rgba(44,51,70,0.10)' };                  // 다크
}

export default function AppearanceHeatmap() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);

  // 최근 50회차 (최근부터 과거 순)
  const rounds = useMemo(() => {
    const arr: number[] = [];
    for (let r = latestRound; r >= Math.max(earliestRound, latestRound - RANGE_N + 1); r--) {
      if (drawsMap[r]) arr.push(r);
    }
    return arr;
  }, [drawsMap, latestRound, earliestRound]);

  // 번호별 출현 회차 set
  const appearance = useMemo(() => {
    const map: Record<number, Set<number>> = {};
    for (let n = 1; n <= 45; n++) map[n] = new Set();
    for (const r of rounds) {
      const d = drawsMap[r];
      if (!d) continue;
      for (const n of d.nums) map[n].add(r);
    }
    return map;
  }, [rounds, drawsMap]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="출현 분석" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        {/* 안내 */}
        <View style={[styles.tipCard, { backgroundColor: t.bgSurface2, borderColor: t.borderWeak }]}>
          <T allowFontScaling={false} style={{ fontSize: 16, marginRight: 8 }}>💡</T>
          <T variant="caption1" color="secondary" style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
            가로축은 회차(최근→과거), 세로축은 1~45번이에요. 칠해진 셀이 해당 회차의 당첨번호예요.
          </T>
        </View>

        {/* 히트맵 카드 — 좌우 패딩 축소로 셀에 더 많은 공간 할당 */}
        <Card padding={10}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            🎨 회차별 당첨번호 패턴
          </T>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 4 }}>
            {rounds.length > 0
              ? `${rounds[rounds.length - 1]}회 ~ ${rounds[0]}회 (${rounds.length}회 표시)`
              : '데이터 없음'}
          </T>

          {rounds.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              <View>
                {/* 헤더: 회차 번호 */}
                <View style={{ flexDirection: 'row', marginBottom: 4, marginLeft: HEADER_W }}>
                  {rounds.map((r) => (
                    <View key={r} style={[styles.cellHeader]}>
                      <T variant="caption2" color="tertiary" compact allowFontScaling={false} style={{ fontSize: 10, fontWeight: '700' }}>
                        {r}
                      </T>
                    </View>
                  ))}
                </View>

                {/* 행 45개 (1~45) */}
                {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
                  const z = zoneColor(n);
                  return (
                    <View key={n} style={styles.row}>
                      {/* 좌측 번호 라벨 */}
                      <View style={styles.numLabel}>
                        <T variant="caption2" color="tertiary" compact allowFontScaling={false} style={{ fontSize: 11, fontWeight: '700' }}>
                          {n}
                        </T>
                      </View>
                      {/* 회차별 셀 */}
                      {rounds.map((r) => {
                        const drawn = appearance[n].has(r);
                        return (
                          <View
                            key={r}
                            style={[
                              styles.cell,
                              {
                                backgroundColor: drawn ? z.bg : z.bgEmpty,
                                borderColor: drawn ? z.bg : 'rgba(127,127,127,0.08)',
                              },
                            ]}
                          >
                            {drawn && (
                              <T variant="caption2" compact allowFontScaling={false} style={{ color: z.fg, fontSize: 10, fontWeight: '900' }}>
                                {n}
                              </T>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* 범례 */}
          <View style={styles.legendRow}>
            <LegendChip label="1~10" color="#f5b400" />
            <LegendChip label="11~20" color="#3aa1ff" />
            <LegendChip label="21~30" color="#ff6c7a" />
            <LegendChip label="31~45" color="#2c3346" />
          </View>
        </Card>

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.legendChip, { borderColor: color }]}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '700' }}>
        {label}
      </T>
    </View>
  );
}

const CELL_SIZE = 24;
const HEADER_W = 26;

const styles = StyleSheet.create({
  root: { flex: 1 },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },

  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
  numLabel: {
    width: HEADER_W,
    height: CELL_SIZE,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellHeader: {
    width: CELL_SIZE + 1,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(127,127,127,0.12)',
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
