/**
 * CombinationCard — 한 조합(6개 번호)을 카드 한 장으로 보여준다.
 *
 * 한눈에 보이는 정보:
 *   - 라벨 (A/B/C 등 또는 순번)
 *   - BallRow
 *   - 미니 요약 (합 · 홀짝 · AC) — 한 줄
 *
 * 카드 자체를 탭하면 `/combo?nums=...`로 push → 풍부한 분석 화면.
 * 우측에 "+" 버튼이 있으면 onSave로 보관함에 저장.
 *
 * 가중치 뽑기 / 번호 받기 / 시뮬레이터 결과 등 어디서나 일관된 UX로 재사용.
 */
import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { T } from './Text';
import { BallRow } from './BallRow';
import { Card } from './Card';
import { Icon } from './Icons';
import { ac, highLowLabel, oddEvenLabel, total } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export function CombinationCard({
  nums,
  label,
  onSave,
  saved,
  style,
}: {
  nums: number[];
  /** 'A'/'B'/'C'... 또는 순번. 없으면 미표시. */
  label?: string;
  /** + 버튼 핸들러 (없으면 + 버튼 숨김). */
  onSave?: () => void;
  saved?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const router = useRouter();

  const sum = total(nums);
  const oe = oddEvenLabel(nums);
  const hl = highLowLabel(nums);
  const acV = ac(nums);

  const goDetail = () => {
    router.push(`/combo?nums=${nums.join(',')}` as any);
  };

  return (
    <Pressable onPress={goDetail} style={style}>
      <Card padding={14}>
        {/* 1행: 라벨 + 저장 버튼 */}
        <View style={styles.topRow}>
          {label && (
            <View style={styles.labelBadge}>
              <T variant="label1n" style={{ color: palette.blue700, fontWeight: '800', fontSize: 13 }} allowFontScaling={false}>
                {label}
              </T>
            </View>
          )}
          <T variant="caption1" color="tertiary" style={{ flex: 1, marginLeft: 10 }}>
            게임
          </T>
          {onSave && (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onSave(); }}
              disabled={saved}
              hitSlop={6}
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  backgroundColor: saved ? palette.green500 : t.bgAccentSoft,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {saved
                ? <Icon.check color="#fff" size={16} weight={3} />
                : <Icon.plus color={palette.blue700} size={16} weight={2.5} />}
            </Pressable>
          )}
        </View>

        {/* 2행: BallRow (크게) */}
        <View style={{ marginTop: 12, alignItems: 'center' }}>
          <BallRow nums={nums} size="md" />
        </View>

        {/* 3행: 요약 칩 + 상세 링크 */}
        <View style={[styles.bottomRow, { borderTopColor: t.borderDivider }]}>
          <MetaPill label="합" value={String(sum)} />
          <MetaPill label="홀짝" value={oe} />
          <MetaPill label="저고" value={hl} />
          <MetaPill label="AC" value={String(acV)} />
          <View style={{ flex: 1 }} />
          <T variant="caption1" style={{ color: palette.blue700, fontWeight: '700' }}>
            자세히 →
          </T>
        </View>
      </Card>
    </Pressable>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: 'rgba(112,115,124,0.10)' }]}>
      <T variant="caption2" style={{ fontSize: 10, color: t.fgTertiary }} allowFontScaling={false}>
        {label}
      </T>
      <T variant="caption1" color="primary" style={{ fontWeight: '800', marginLeft: 5, fontSize: 13 }} allowFontScaling={false}>
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: palette.blue50,
    alignItems: 'center', justifyContent: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  saveBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});
