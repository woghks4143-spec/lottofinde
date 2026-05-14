/**
 * 가중치 뽑기 — /weighted-pick.
 *
 * 1~45 각 번호의 가중치를 사용자가 직접 조정하거나 프리셋으로 일괄 설정.
 * "+뽑기" 누르면 가중치 분포에 비례해서 6개 비복원 추출 × N게임 생성.
 *
 * 레퍼런스 앱(영상)은 좌측 세로 프리셋 + 우측 슬라이더 11개 묶음으로 좁고
 * 답답함. 우리는 위쪽 가로 프리셋 (8개 칩) + 아래 슬라이더 리스트 (1~45,
 * 1줄당 1번호)로 가독성 우선. 다크모드/저시력 모드 모두 잘 보임.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { CombinationCard } from '@/src/components/CombinationCard';
import { Disclaimer } from '@/src/components/Disclaimer';
import { useHistory } from '@/src/data/historyStore';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import {
  WEIGHT_MAX, WEIGHT_MIN, WEIGHT_PRESETS,
  generateWithWeights, presetWeights,
  type WeightPreset,
} from '@/src/lib/generator';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const GAME_OPTIONS = [1, 3, 5, 10] as const;

export default function WeightedPick() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/gen');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const addSaved = useSavedNumbers((s) => s.add);

  const allDraws = useMemo(() => {
    return Object.keys(drawsMap)
      .map((k) => Number(k))
      .sort((a, b) => b - a)
      .map((r) => drawsMap[r]);
  }, [drawsMap, latestRound]);

  const ctx = useMemo(() => ({ history: allDraws }), [allDraws]);

  const [preset, setPreset] = useState<WeightPreset | null>('equal');
  // 슬라이더 값 배열 (인덱스 i = 번호 i+1)
  const [weights, setWeights] = useState<number[]>(() => presetWeights('equal', { history: [] }));
  const [gameCount, setGameCount] = useState<number>(5);
  const [picks, setPicks] = useState<number[][]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // 프리셋 적용 — 슬라이더 일괄 갱신, 사용자가 수동 조정 시작하면 preset = null
  const applyPreset = (id: WeightPreset) => {
    setPreset(id);
    setWeights(presetWeights(id, ctx));
  };

  const setWeight = (i: number, v: number) => {
    setWeights((arr) => {
      const next = arr.slice();
      next[i] = v;
      return next;
    });
    setPreset(null); // 수동 조정 시 프리셋 활성 해제
  };

  const onDraw = () => {
    const out: number[][] = [];
    const seen = new Set<string>();
    let safety = 0;
    while (out.length < gameCount && safety < gameCount * 20) {
      const g = generateWithWeights(weights);
      const key = g.join(',');
      if (!seen.has(key)) { seen.add(key); out.push(g); }
      safety++;
    }
    setPicks(out);
  };

  const onSave = (i: number) => {
    const nums = picks[i];
    if (!nums) return;
    const res = addSaved({ nums, round: null, source: 'gen' });
    setToast(res.ok ? '보관함에 저장했어요' : res.reason === 'duplicate' ? '이미 저장한 번호예요' : '보관함 가득 참');
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="가중치 뽑기" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>

        {/* 프리셋 가로 스크롤 */}
        <Card padding={14}>
          <View style={styles.headRow}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>프리셋</T>
            {preset === null && (
              <Chip label="수동 조정 중" tone="purple" compact />
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {WEIGHT_PRESETS.map((p) => {
                const on = preset === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => applyPreset(p.id)}
                    style={({ pressed }) => [
                      styles.presetChip,
                      {
                        backgroundColor: on ? t.bgAccent : t.bgSurface,
                        borderColor: on ? 'transparent' : t.borderWeak,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <T allowFontScaling={false} style={{ fontSize: 16, marginRight: 6 }}>{p.icon}</T>
                    <T
                      variant="label1n"
                      style={{ color: on ? '#fff' : t.fgSecondary, fontWeight: '700' }}
                      allowFontScaling={false}
                    >
                      {p.label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <T variant="caption1" color="tertiary" style={{ marginTop: 10, lineHeight: 17 }}>
            프리셋을 선택하면 전체 슬라이더가 자동 조정돼요. 그 다음 슬라이더를 직접 움직여 미세 조정도 가능합니다.
          </T>
        </Card>

        {/* 게임 수 선택 */}
        <Card padding={14}>
          <View style={styles.headRow}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>게임 수</T>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {GAME_OPTIONS.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setGameCount(n)}
                  style={({ pressed }) => [
                    styles.gameChip,
                    {
                      backgroundColor: gameCount === n ? t.bgAccent : t.bgSurface,
                      borderColor: gameCount === n ? 'transparent' : t.borderWeak,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <T
                    variant="label1n"
                    style={{ color: gameCount === n ? '#fff' : t.fgSecondary, fontWeight: '700' }}
                    allowFontScaling={false}
                  >
                    {n}게임
                  </T>
                </Pressable>
              ))}
            </View>
          </View>
        </Card>

        {/* 번호별 가중치 - 수동 조정 (1~10단계) */}
        <Card padding={14}>
          <View style={styles.headRow}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>번호별 가중치</T>
            <T variant="caption1" color="tertiary">
              {WEIGHT_MIN} ~ {WEIGHT_MAX} · 0이면 제외
            </T>
          </View>
          <T variant="caption1" color="tertiary" style={{ marginTop: 4, marginBottom: 8, lineHeight: 17 }}>
            바를 끌거나 + / − 버튼으로 1단계씩 조정하세요.
          </T>
          <View>
            {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => (
              <WeightSliderRow
                key={n}
                n={n}
                value={weights[n - 1]}
                onChange={(v) => setWeight(n - 1, v)}
              />
            ))}
          </View>
        </Card>

        {/* 결과 — CombinationCard로 일관된 표시 (탭하면 상세) */}
        {picks.length > 0 && (
          <View style={{ gap: 10 }}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700', marginTop: 4 }}>
              뽑은 결과 ({picks.length}게임)
            </T>
            <T variant="caption1" color="tertiary">
              각 조합을 탭하면 직전 회차 동행수·역대 매칭까지 자세히 볼 수 있어요.
            </T>
            {picks.map((nums, i) => (
              <CombinationCard
                key={i}
                nums={nums}
                label={String.fromCharCode(65 + i)}
                onSave={() => onSave(i)}
              />
            ))}
          </View>
        )}

        <Disclaimer />
      </ScrollView>

      {/* 하단 고정 CTA */}
      <View style={[styles.bottomBar, { backgroundColor: t.bgSurface, borderTopColor: t.borderDivider }]}>
        <Button
          title={`${gameCount}게임 뽑기`}
          variant="primary"
          size="lg"
          full
          onPress={onDraw}
        />
      </View>

      {toast && (
        <View style={[styles.toast, { backgroundColor: t.bgInverse }]} pointerEvents="none">
          <T variant="label1n" style={{ color: t.scheme === 'dark' ? t.fgPrimary : '#fff' }}>{toast}</T>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── WeightSliderRow ─────────────────────────────────────────────────────────

/**
 * 한 번호의 가중치 조정 행:
 *   [Ball] [−] [━━━━━━━━░░░] [+]  [값]
 *
 * 점/세그먼트 없이 부드러운 한 줄 막대로 시각화 (환공포증 친화).
 * 막대를 직접 탭/드래그해서 빠른 대략 조정, +/− 버튼으로 1단계씩 정밀 조정.
 */
function WeightSliderRow({
  n, value, onChange,
}: { n: number; value: number; onChange: (v: number) => void }) {
  const t = useTheme();
  const trackWidth = useRef(0);

  const dec = () => onChange(Math.max(WEIGHT_MIN, value - 1));
  const inc = () => onChange(Math.min(WEIGHT_MAX, value + 1));

  // 막대 탭 → 위치 기반 값 설정 (0~10 단계로 스냅)
  const setFromX = (x: number) => {
    const w = trackWidth.current;
    if (w <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / w));
    const v = Math.round(ratio * WEIGHT_MAX);
    onChange(v);
  };

  // PanResponder로 드래그 조정
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const valueColor =
    value === 0 ? t.fgDisabled
    : value >= 8 ? palette.blue700
    : value <= 2 ? palette.red500
    : t.fgPrimary;
  const barFillColor =
    value === 0 ? t.borderDivider
    : value >= 8 ? palette.blue500
    : value <= 2 ? palette.red500
    : palette.blue300;

  return (
    <View style={styles.sliderRow}>
      <Ball n={n} size="xs" />

      <Pressable
        onPress={dec}
        disabled={value <= WEIGHT_MIN}
        hitSlop={6}
        style={({ pressed }) => [
          styles.stepBtn,
          {
            backgroundColor: value <= WEIGHT_MIN ? t.borderDivider : t.bgSurface,
            borderColor: t.borderWeak,
            opacity: value <= WEIGHT_MIN ? 0.45 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <T variant="label1n" color={value <= WEIGHT_MIN ? 'disabled' : 'secondary'} style={{ fontWeight: '700' }}>
          −
        </T>
      </Pressable>

      {/* 단일 막대 — 탭/드래그로 값 설정 */}
      <View
        style={styles.trackHit}
        onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
        {...responder.panHandlers}
      >
        <View style={[styles.track, { backgroundColor: t.borderDivider }]} />
        <View
          style={[
            styles.trackFill,
            {
              backgroundColor: barFillColor,
              width: `${(value / WEIGHT_MAX) * 100}%`,
            },
          ]}
        />
      </View>

      <Pressable
        onPress={inc}
        disabled={value >= WEIGHT_MAX}
        hitSlop={6}
        style={({ pressed }) => [
          styles.stepBtn,
          {
            backgroundColor: value >= WEIGHT_MAX ? t.borderDivider : t.bgSurface,
            borderColor: t.borderWeak,
            opacity: value >= WEIGHT_MAX ? 0.45 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <T variant="label1n" color={value >= WEIGHT_MAX ? 'disabled' : 'secondary'} style={{ fontWeight: '700' }}>
          +
        </T>
      </Pressable>

      <T
        variant="label1n"
        style={{ minWidth: 24, textAlign: 'right', fontWeight: '800', color: valueColor }}
        allowFontScaling={false}
      >
        {value}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  presetChip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  stepBtn: {
    width: 28, height: 28, borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  trackHit: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 8,
    borderRadius: 4,
    width: '100%',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 10,
    height: 8,
    borderRadius: 4,
  },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: palette.blue50,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  toast: {
    position: 'absolute',
    left: 24, right: 24, bottom: 100,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
});
