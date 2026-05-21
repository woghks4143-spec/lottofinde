/**
 * PatternGrid — 1~45 격자에 조합 6개 번호 위치를 시각화.
 *
 * 영상 참조 앱은 격자 위에 연결선을 그렸지만, 6개 번호 사이의 선은 의미가
 * 모호함 (왜 1번부터 16번을 잇는지?). 대신 우리는:
 *   1) 격자에 6개 번호만 컬러 ball, 나머지는 흐린 점
 *   2) 좌측에 구간(1~10, 11~20 …)별 개수 사이드바 추가
 *   3) 하단에 "분포 한 줄 요약" — 어느 구간이 비었는지 즉시 식별
 *
 * 결과: 영상보다 정보 밀도가 높고 가독성이 좋다.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Card } from './Card';
import { useTheme } from '@/src/design/theme';
import { ballColor, palette, radius } from '@/src/design/tokens';

const GRID_GAP = 4;
const GRID_COLS = 7;

const SEGMENTS: Array<[number, number, string]> = [
  [1, 10, '1~10'],
  [11, 20, '11~20'],
  [21, 30, '21~30'],
  [31, 40, '31~40'],
  [41, 45, '41~45'],
];

export function PatternGrid({ nums }: { nums: number[] }) {
  const t = useTheme();
  const mySet = new Set(nums);

  // 격자 너비를 측정해서 셀 크기를 정확히 계산 → 항상 7컬럼 보장.
  // 부모(카드) 너비/사이드바 너비에 따라 % 계산이 어긋나는 문제 해결.
  const [gridW, setGridW] = useState(0);
  const cellSize = gridW > 0
    ? Math.floor((gridW - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS)
    : 0;

  // 구간별 개수 — 분포 사이드바
  const segCounts = SEGMENTS.map(([lo, hi]) => {
    let c = 0;
    for (const n of nums) if (n >= lo && n <= hi) c++;
    return c;
  });
  const maxSeg = Math.max(1, ...segCounts);

  // 격자: 9칸 너비, 5행
  return (
    <Card padding={16}>
      <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
        분포 패턴
      </T>
      <T variant="caption1" color="tertiary" style={{ marginBottom: 14 }}>
        1~45 중 6개 번호가 어디에 분포해 있는지
      </T>

      <View style={styles.row}>
        {/* 좌측 구간 사이드바 — 라벨 너비 고정으로 게이지 시작점 정렬 */}
        <View style={styles.segCol}>
          {SEGMENTS.map(([lo, hi, label], i) => {
            const c = segCounts[i];
            const fill = (c / maxSeg) * 100;
            return (
              <View key={label} style={styles.segItem}>
                <T
                  variant="caption1"
                  color={c > 0 ? 'primary' : 'tertiary'}
                  style={styles.segLabel}
                  allowFontScaling={false}
                >
                  {label}
                </T>
                <View style={[styles.segTrack, { backgroundColor: t.borderDivider }]}>
                  <View
                    style={[
                      styles.segFill,
                      {
                        width: `${fill}%`,
                        backgroundColor: c > 0 ? palette.blue500 : 'transparent',
                      },
                    ]}
                  />
                </View>
                <T variant="caption1" color={c > 0 ? 'accent' : 'tertiary'} style={styles.segCount} allowFontScaling={false}>
                  {c}
                </T>
              </View>
            );
          })}
        </View>

        {/* 우측 7×7 격자 — 7행 × 7열 = 49칸 (45개 숫자 + 4개 빈 칸).
            onLayout으로 측정한 너비 기반으로 셀 크기 동적 계산 → 항상 정확히 7컬럼. */}
        <View
          style={styles.grid}
          onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
        >
          {cellSize > 0 && Array.from({ length: 49 }, (_, i) => i + 1).map((n) => {
            // 46~49는 빈 자리 — 시각적 자리 차지하되 표시 X
            if (n > 45) {
              return <View key={n} style={[{ width: cellSize, height: cellSize }, styles.cellEmpty]} />;
            }
            const hit = mySet.has(n);
            return (
              <View
                key={n}
                style={[
                  styles.cell,
                  { width: cellSize, height: cellSize },
                  hit
                    ? { backgroundColor: ballColor(n) }
                    : { backgroundColor: 'transparent', borderColor: t.borderDivider, borderWidth: 1 },
                ]}
              >
                <T
                  variant="caption1"
                  style={{
                    color: hit ? '#fff' : t.fgTertiary,
                    fontWeight: hit ? '800' : '600',
                    fontSize: Math.max(10, Math.min(13, cellSize * 0.42)),
                    opacity: hit ? 1 : 0.7,
                  }}
                  allowFontScaling={false}
                >
                  {n}
                </T>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  segCol: {
    width: 108,
    gap: 10,
  },
  segItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // 라벨 너비 고정 — "1~10"부터 "41~45"까지 모두 같은 시작점에서 게이지가 시작.
  segLabel: {
    fontSize: 11,
    fontWeight: '700',
    width: 44,
  },
  segCount: {
    fontWeight: '700',
    minWidth: 12,
    textAlign: 'right',
    fontSize: 11,
  },
  segTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  segFill: {
    height: '100%',
    borderRadius: 2,
  },
  // 7열 그리드 — 셀 크기는 onLayout으로 측정한 너비 기반 동적 계산.
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  cell: {
    // width/height는 인라인으로 동적 부여 (cellSize).
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    backgroundColor: 'transparent',
    opacity: 0,
  },
});
