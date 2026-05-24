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
  hits,
  bonus,
  rankBadge,
  style,
}: {
  nums: number[];
  /** 'A'/'B'/'C'... 또는 순번. 없으면 미표시. */
  label?: string;
  /** + 버튼 핸들러 (없으면 + 버튼 숨김). */
  onSave?: () => void;
  saved?: boolean;
  /** 일치 강조할 번호들 (당첨 확인용 — BallRow 점선 ring). */
  hits?: number[];
  /** 보너스 번호 (있으면 우측 끝에 점선 ring). */
  bonus?: number;
  /** 우상단 등수 칩 (당첨 결과 표시용). 1등이면 카드에 골드 보더 강조. */
  rankBadge?: { rank: number; color: string };
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

  // 1~3등이면 카드에 골드 보더 강조 (당첨 결과 시각화)
  const isWin = !!rankBadge && rankBadge.rank <= 3;

  return (
    <Pressable onPress={goDetail} style={style}>
      <Card padding={14} style={isWin ? { borderWidth: 2, borderColor: '#e8b04e' } : undefined}>
        {/* 1행: 라벨 + (당첨 시) 등수 badge + 저장 버튼 */}
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
          {rankBadge && (
            <View style={[styles.rankBadge, { backgroundColor: rankBadge.color }]}>
              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>
                {rankBadge.rank}등
              </T>
            </View>
          )}
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
                  marginLeft: rankBadge ? 8 : 0,
                },
              ]}
            >
              {saved
                ? <Icon.check color="#fff" size={16} weight={3} />
                : <Icon.plus color={palette.blue700} size={16} weight={2.5} />}
            </Pressable>
          )}
        </View>

        {/* 2행: BallRow (크게) — hits/bonus 있으면 일치 강조 */}
        <View style={{ marginTop: 12, alignItems: 'center' }}>
          <BallRow nums={nums} size="md" hits={hits} bonus={bonus} />
        </View>

        {/* 3행: 요약 칩 4개 + 자세히 칩 — 한 줄 강제.
            칩 크기·폰트를 압축해 좁은 폰에서도 5개가 한 줄에 들어가게 함. */}
        <View style={[styles.bottomRow, { borderTopColor: t.borderDivider }]}>
          <MetaPill label="합" value={String(sum)} tone="blue" />
          <MetaPill label="홀짝" value={oe} tone="purple" />
          <MetaPill label="저고" value={hl} tone="green" />
          <MetaPill label="AC" value={String(acV)} tone="amber" />
          <View style={[styles.detailChip, { backgroundColor: palette.blue50 }]}>
            <T variant="caption1" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '800', fontSize: 10.5 }}>
              자세히
            </T>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

type PillTone = 'blue' | 'purple' | 'green' | 'amber';

const PILL_TONES: Record<PillTone, { bg: string; labelFg: string; valueFg: string }> = {
  blue:   { bg: 'rgba(0,102,255,0.08)',   labelFg: 'rgba(0,75,192,0.65)',  valueFg: palette.blue700 },
  purple: { bg: 'rgba(101,65,242,0.08)',  labelFg: 'rgba(101,65,242,0.70)', valueFg: palette.purple500 },
  green:  { bg: 'rgba(0,191,64,0.10)',    labelFg: 'rgba(0,138,46,0.70)',   valueFg: palette.green700 },
  amber:  { bg: 'rgba(251,196,0,0.12)',   labelFg: 'rgba(122,88,0,0.75)',   valueFg: '#7a5800' },
};

function MetaPill({ label, value, tone }: { label: string; value: string; tone: PillTone }) {
  const c = PILL_TONES[tone];
  // label + value를 하나의 Text 안에 nested로 묶어 좁은 폭에서도 한 줄에 표시.
  // 별도 Text 두 개면 RN이 label("홀짝")을 한 글자씩 wrap해 "홀\n짝"으로 잘리는
  // 케이스가 있음 — 한 텍스트 노드로 묶으면 wrap 단위가 단어 전체가 된다.
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <T
        variant="caption1"
        allowFontScaling={false}
        numberOfLines={1}
        style={{ fontSize: 11, color: c.valueFg, fontWeight: '800' }}
      >
        <T allowFontScaling={false} style={{ fontSize: 9.5, color: c.labelFg, fontWeight: '700' }}>
          {label}{' '}
        </T>
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
    flexWrap: 'nowrap',          // 한 줄 강제 — 자세히가 항상 같은 줄
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  pill: {
    // 단일 Text가 들어가므로 flexDirection 불필요.
    // baseline align은 두 줄로 wrap될 때 측정이 틀어지는 케이스가 있어 제거.
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  detailChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  saveBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rankBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
});
