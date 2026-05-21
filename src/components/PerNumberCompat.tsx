/**
 * PerNumberCompat — 조합 6개 번호 각각에 대해, 그 번호와 가장 자주 함께 나온
 * TOP K 짝꿍을 한 줄씩 보여준다.
 *
 * 영상 참조 앱: 6개 번호 × 5개 짝꿍 = 36개 ball + 횟수. 정보량은 많은데 가로
 * 폭이 좁아서 압축됨.
 * 우리: 한 행을 더 넓게 쓰고, 짝꿍 옆에 작은 횟수 라벨, 그리고 행 끝에
 * **모든 6개와 자주 어울리는 "공통 짝꿍"**(평균 친화도 가장 높은 1개)을
 * 한 줄로 별도 표시 — 영상에 없는 추가 인사이트.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Ball } from './Ball';
import { Card } from './Card';
import { useTheme } from '@/src/design/theme';
import { coOccurrence, topCompanions } from '@/src/data/lotto';
import type { Draw } from '@/src/data/lotto';
import { palette, radius } from '@/src/design/tokens';

export function PerNumberCompat({ nums, allDraws }: { nums: number[]; allDraws: Draw[] }) {
  const t = useTheme();

  const coMatrix = useMemo(() => coOccurrence(allDraws), [allDraws]);
  const myNumsSet = useMemo(() => new Set(nums), [nums]);
  const sortedMyNums = useMemo(() => [...nums].sort((a, b) => a - b), [nums]);

  // 각 번호의 TOP 5 짝꿍
  const rows = useMemo(() => {
    return sortedMyNums.map((n) => ({
      n,
      companions: topCompanions(coMatrix, n, 5),
    }));
  }, [sortedMyNums, coMatrix]);

  // 공통 짝꿍 — 6개 번호 모두와의 평균 동시출현 횟수가 가장 높은 번호
  const commonBuddy = useMemo(() => {
    const score = new Array(46).fill(0);
    for (let candidate = 1; candidate <= 45; candidate++) {
      if (myNumsSet.has(candidate)) continue;
      let s = 0;
      for (const myN of nums) s += coMatrix[myN][candidate];
      score[candidate] = s;
    }
    let best = 0; let bestScore = -1;
    for (let i = 1; i <= 45; i++) {
      if (score[i] > bestScore) { bestScore = score[i]; best = i; }
    }
    return { n: best, total: bestScore, avg: bestScore / 6 };
  }, [coMatrix, myNumsSet, nums]);

  return (
    <Card padding={16}>
      <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 4 }}>
        번호별 궁합수 TOP 5
      </T>
      <T variant="caption1" color="tertiary" style={{ marginBottom: 14 }}>
        조합 각 번호와 가장 자주 함께 나온 번호
      </T>

      {/* 행 6개 — 메인 공도 짝꿍과 동일한 column 구조로 만들어 공의 vertical 위치를 맞춤.
          모든 공이 같은 ringPad={1} + 행 alignItems: 'flex-start' → 공의 top이 일치. */}
      <View style={{ gap: 8 }}>
        {rows.map(({ n, companions }) => (
          <View key={n} style={[styles.row, { borderColor: t.borderDivider }]}>
            {/* 메인 공 — 짝꿍과 동일한 column wrap (텍스트 자리는 투명 placeholder로 height 통일) */}
            <View style={styles.companionItem}>
              <Ball n={n} size="sm" ringPad={1} />
              <T variant="caption2" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 3, opacity: 0 }}>
                {/* 짝꿍의 "N회" 텍스트 자리와 동일한 layout 확보용 */}
                0회
              </T>
            </View>
            <T variant="caption1" color="tertiary" style={styles.arrow} allowFontScaling={false}>
              ↔
            </T>
            <View style={styles.companions}>
              {companions.map((x) => (
                <View key={x.n} style={styles.companionItem}>
                  <Ball n={x.n} size="sm" ringPad={1} />
                  <T variant="caption2" color="tertiary" style={{ fontSize: 10.5, marginTop: 3, fontWeight: '600' }} allowFontScaling={false}>
                    {x.c}회
                  </T>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* 공통 짝꿍 — 영상에 없는 부가 인사이트 */}
      {commonBuddy.n > 0 && (
        <View style={[styles.buddyBox, { backgroundColor: 'rgba(101,65,242,0.10)' }]}>
          <T variant="caption1" style={{ color: palette.purple500, fontWeight: '700', fontSize: 11.5, letterSpacing: 0.3 }} allowFontScaling={false}>
            🎯 6개 번호와 가장 자주 함께 나온 번호
          </T>
          <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ball n={commonBuddy.n} size="sm" />
            <View style={{ flex: 1 }}>
              <T variant="label1n" style={{ color: palette.purple500, fontWeight: '800' }}>
                {commonBuddy.n}번
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 1 }}>
                평균 {commonBuddy.avg.toFixed(1)}회 (총 {commonBuddy.total}회 동시 출현)
              </T>
            </View>
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // flex-start: 메인 공과 짝꿍 공이 모두 행 top에서 시작 → 공 vertical 위치 일치
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  companions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  companionItem: {
    alignItems: 'center',
    minWidth: 32,
  },
  // ↔ 화살표는 공의 vertical center에 오도록 살짝 marginTop
  arrow: {
    marginHorizontal: 6,
    marginTop: 8,
  },
  buddyBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.lg,
  },
});
