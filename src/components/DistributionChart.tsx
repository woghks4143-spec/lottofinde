/**
 * DistributionChart — 어떤 지표(합·끝수합·AC 등)에 대해
 *   1) 1223회차 전체에서 그 지표의 분포 막대그래프
 *   2) 현재 조합의 값 위치를 빨간 라인 + 화살표로 표시
 *   3) 평균·표준편차·확률범위(%) 메타 정보
 *
 * 영상 참조 앱은 차트 한 개에 라벨이 빽빽함. 우리는:
 *   - 더 큰 막대 + 부드러운 색 그라데이션
 *   - "확률범위"를 큰 숫자로 강조 (이 값이 전체에서 얼마나 흔한가?)
 *   - "내 값" 라벨이 화살표와 함께 정확히 위치 표시
 *
 * SVG 의존성 없이 View로만 그리므로 RN-Web 호환.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from './Text';
import { Card } from './Card';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export type DistConfig = {
  /** 0..N (X축 값 → 빈도) */
  values: number[];
  /** X축 최소값 (예: 합이면 21, 끝수합이면 6) */
  min: number;
  /** X축 최대값 */
  max: number;
  /** 현재 조합의 값 */
  current: number;
  /** 화면에 표시할 지표 이름 */
  title: string;
  /** 화면에 표시할 부제 */
  subtitle?: string;
  /** 단위 (예: '점', '회') */
  unit?: string;
};

/**
 * 회차 데이터에서 [지표값 → 빈도] 분포를 미리 계산할 때 쓰는 헬퍼.
 */
export function buildDistribution(
  values: number[],
  min: number,
  max: number,
): number[] {
  const bins = new Array(max - min + 1).fill(0);
  for (const v of values) {
    if (v >= min && v <= max) bins[v - min]++;
  }
  return bins;
}

export function DistributionChart({
  title, subtitle, values, min, max, current, unit = '',
}: DistConfig) {
  const t = useTheme();

  const stats = useMemo(() => {
    const total = values.reduce((s, c) => s + c, 0);
    let sumWeighted = 0;
    for (let i = 0; i < values.length; i++) sumWeighted += (min + i) * values[i];
    const mean = total > 0 ? sumWeighted / total : 0;
    let varianceSum = 0;
    for (let i = 0; i < values.length; i++) {
      const v = min + i;
      varianceSum += values[i] * (v - mean) ** 2;
    }
    const stddev = total > 0 ? Math.sqrt(varianceSum / total) : 0;
    const maxBin = Math.max(1, ...values);
    const myBinIdx = Math.max(0, Math.min(values.length - 1, current - min));
    const myFreq = values[myBinIdx] ?? 0;
    const pct = total > 0 ? (myFreq / total) * 100 : 0;
    return { mean, stddev, maxBin, total, myFreq, pct };
  }, [values, min, max, current]);

  // 현재 위치 비율 (0~1) — 차트에서의 가로 위치
  const cursorRatio = (current - min) / Math.max(1, max - min);

  return (
    <Card padding={16}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
            {title}
          </T>
          {subtitle && (
            <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
              {subtitle}
            </T>
          )}
        </View>
        <View style={styles.currentPill}>
          <T variant="caption2" style={{ color: palette.blue700, fontSize: 10 }} allowFontScaling={false}>
            내 값
          </T>
          <T variant="heading2" style={{ color: palette.blue700, fontWeight: '800', marginLeft: 6 }} allowFontScaling={false}>
            {current}{unit}
          </T>
        </View>
      </View>

      {/* 메타 정보 — 평균 / 표준편차 / 확률범위 */}
      <View style={styles.metaRow}>
        <MetaItem label="평균" value={stats.mean.toFixed(1)} />
        <MetaItem label="표준편차" value={stats.stddev.toFixed(2)} />
        <MetaItem
          label="확률범위"
          value={`${stats.pct.toFixed(2)}%`}
          tone={stats.pct > 3 ? 'accent' : stats.pct < 1 ? 'danger' : 'primary'}
        />
        <MetaItem label="출현" value={`${stats.myFreq}회`} />
      </View>

      {/* 히스토그램 막대 */}
      <View style={styles.chartArea}>
        <View style={styles.bars}>
          {values.map((c, i) => {
            const h = (c / stats.maxBin) * 100;
            const isCurrent = i === current - min;
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(h, c > 0 ? 2 : 0)}%`,
                    backgroundColor: isCurrent
                      ? palette.red500
                      : c > 0
                      ? palette.blue300
                      : 'transparent',
                  },
                ]}
              />
            );
          })}
        </View>

        {/* 현재 위치 화살표 */}
        <View
          pointerEvents="none"
          style={[
            styles.cursor,
            { left: `${cursorRatio * 100}%` },
          ]}
        >
          <View style={[styles.cursorLine, { backgroundColor: palette.red500 }]} />
          <View style={styles.cursorTriangle} />
        </View>
      </View>

      {/* X축 */}
      <View style={styles.xAxis}>
        <T variant="caption2" color="tertiary" style={{ fontSize: 10 }}>{min}</T>
        <T variant="caption2" color="tertiary" style={{ fontSize: 10 }}>
          {Math.round((min + max) / 2)}
        </T>
        <T variant="caption2" color="tertiary" style={{ fontSize: 10 }}>{max}</T>
      </View>
    </Card>
  );
}

function MetaItem({
  label, value, tone = 'primary',
}: { label: string; value: string; tone?: 'primary' | 'accent' | 'danger' }) {
  const t = useTheme();
  const fg =
    tone === 'accent' ? palette.blue700
    : tone === 'danger' ? palette.red500
    : t.fgPrimary;
  return (
    <View style={styles.metaItem}>
      <T variant="caption2" color="tertiary" style={{ fontSize: 10 }} allowFontScaling={false}>
        {label}
      </T>
      <T variant="label1n" style={{ color: fg, fontWeight: '800', marginTop: 2 }} allowFontScaling={false}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  currentPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,102,255,0.10)',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  metaItem: { alignItems: 'center', flex: 1 },
  chartArea: {
    height: 80,
    marginTop: 4,
    position: 'relative',
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  bar: {
    flex: 1,
    minHeight: 0,
    borderTopLeftRadius: 1.5,
    borderTopRightRadius: 1.5,
  },
  cursor: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    alignItems: 'center',
    transform: [{ translateX: -0.5 }],
  },
  cursorLine: {
    width: 1.5,
    flex: 1,
    opacity: 0.85,
  },
  cursorTriangle: {
    position: 'absolute',
    bottom: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: palette.red500,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
