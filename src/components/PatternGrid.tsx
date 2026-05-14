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
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Card } from './Card';
import { useTheme } from '@/src/design/theme';
import { ballColor, palette, radius } from '@/src/design/tokens';

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
        {/* 좌측 구간 사이드바 */}
        <View style={styles.segCol}>
          {SEGMENTS.map(([lo, hi, label], i) => {
            const c = segCounts[i];
            const fill = (c / maxSeg) * 100;
            return (
              <View key={label} style={styles.segItem}>
                <T variant="caption1" color={c > 0 ? 'primary' : 'tertiary'} style={{ fontSize: 11, fontWeight: '700' }} allowFontScaling={false}>
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
                <T variant="caption1" color={c > 0 ? 'accent' : 'tertiary'} style={{ fontWeight: '700', minWidth: 18, textAlign: 'right', fontSize: 11 }} allowFontScaling={false}>
                  {c}
                </T>
              </View>
            );
          })}
        </View>

        {/* 우측 격자 */}
        <View style={styles.grid}>
          {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
            const hit = mySet.has(n);
            return (
              <View
                key={n}
                style={[
                  styles.cell,
                  hit
                    ? { backgroundColor: ballColor(n) }
                    : { backgroundColor: 'transparent', borderColor: t.borderDivider, borderWidth: 1 },
                ]}
              >
                <T
                  variant="caption1"
                  style={{
                    color: hit ? '#fff' : t.fgTertiary,
                    fontWeight: hit ? '800' : '500',
                    fontSize: 10.5,
                    opacity: hit ? 1 : 0.55,
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

      {/* 하단 요약 */}
      <View style={[styles.summaryRow, { borderTopColor: t.borderDivider }]}>
        <T variant="caption1" color="tertiary">
          {summaryText(segCounts)}
        </T>
      </View>
    </Card>
  );
}

/** "1~10 1개 · 11~20 1개 · 21~30 2개 · 31~40 1개 · 41~45 1개" 한 줄 요약. */
function summaryText(counts: number[]): string {
  return counts
    .map((c, i) => `${SEGMENTS[i][2]} ${c}`)
    .join(' · ');
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  segCol: {
    width: 130,
    gap: 8,
    justifyContent: 'space-between',
  },
  segItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  cell: {
    width: '10.5%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
