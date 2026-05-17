/**
 * 조건 조합 (중급자 모드) — /condition-pick
 *
 * 사용자가 직접 통제 가능한 3가지 입력:
 *   - 고정수 (반드시 포함, 최대 6개)
 *   - 예상수 (후보 풀, 비어있으면 1~45 전체)
 *   - 제외수 (절대 포함 안 됨)
 *
 * UI 원칙:
 *   - 세그먼티드 컨트롤로 현재 입력 모드를 전환 (고정/예상/제외)
 *   - 1~45 그리드는 모든 상태를 동시에 보여줌 (파/초/빨/회색 구분)
 *   - 한 번호는 단 하나의 상태만 가짐 (다른 모드 선택 시 자동 이동)
 *   - 선택 요약 카드로 현재 조건과 풀 크기 즉시 표시
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { CombinationCard } from '@/src/components/CombinationCard';
import { Disclaimer } from '@/src/components/Disclaimer';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { generateConditionMany } from '@/src/lib/generator';
import { useTheme } from '@/src/design/theme';
import { ballColor, palette, radius } from '@/src/design/tokens';

type Mode = 'fixed' | 'candidates' | 'excluded';

const MODE_INFO: Record<Mode, { label: string; color: string; bg: string }> = {
  fixed:      { label: '고정수', color: palette.blue500,   bg: 'rgba(0,102,255,0.10)' },
  candidates: { label: '예상수', color: palette.green500,  bg: 'rgba(0,191,64,0.10)' },
  excluded:   { label: '제외수', color: palette.red500,    bg: 'rgba(255,66,66,0.10)' },
};

const GAME_OPTIONS = [1, 3, 5, 10] as const;

export default function ConditionPick() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/gen');
  const addSaved = useSavedNumbers((s) => s.add);

  const [mode, setMode] = useState<Mode>('fixed');
  const [fixed, setFixed] = useState<number[]>([]);
  const [candidates, setCandidates] = useState<number[]>([]);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [gameCount, setGameCount] = useState<number>(5);
  const [picks, setPicks] = useState<number[][]>([]);
  const [savedSet, setSavedSet] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  const fixedSet = useMemo(() => new Set(fixed), [fixed]);
  const candSet = useMemo(() => new Set(candidates), [candidates]);
  const excSet = useMemo(() => new Set(excluded), [excluded]);

  /** 어느 모드에 속한 번호인지 — 한 번호는 단 하나의 상태만 가질 수 있음. */
  const stateOf = (n: number): Mode | null => {
    if (fixedSet.has(n)) return 'fixed';
    if (candSet.has(n)) return 'candidates';
    if (excSet.has(n)) return 'excluded';
    return null;
  };

  const toggle = (n: number) => {
    const cur = stateOf(n);
    // 이미 현재 모드에 있으면 → 해제
    if (cur === mode) {
      if (mode === 'fixed') setFixed(fixed.filter((x) => x !== n));
      else if (mode === 'candidates') setCandidates(candidates.filter((x) => x !== n));
      else setExcluded(excluded.filter((x) => x !== n));
      return;
    }
    // 다른 모드에 있으면 그 모드에서 제거하고 현재 모드에 추가
    if (cur === 'fixed') setFixed(fixed.filter((x) => x !== n));
    else if (cur === 'candidates') setCandidates(candidates.filter((x) => x !== n));
    else if (cur === 'excluded') setExcluded(excluded.filter((x) => x !== n));

    if (mode === 'fixed') {
      if (fixed.length >= 6) {
        setToast('고정수는 최대 6개까지');
        return;
      }
      setFixed([...fixed, n].sort((a, b) => a - b));
    } else if (mode === 'candidates') {
      setCandidates([...candidates, n].sort((a, b) => a - b));
    } else {
      setExcluded([...excluded, n].sort((a, b) => a - b));
    }
  };

  const onDraw = () => {
    const out = generateConditionMany({ fixed, candidates, excluded }, gameCount);
    setPicks(out);
    setSavedSet({});
  };

  const onSave = (i: number) => {
    const nums = picks[i];
    if (!nums) return;
    const res = addSaved({ nums, round: null, source: 'gen' });
    if (res.ok) {
      setSavedSet((s) => ({ ...s, [i]: true }));
      setToast('보관함에 저장했어요');
    } else if (res.reason === 'duplicate') {
      setToast('이미 저장한 번호예요');
    } else {
      setToast('보관함이 가득 찼어요');
    }
  };

  // toast 자동 해제
  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  const clearAll = () => {
    setFixed([]);
    setCandidates([]);
    setExcluded([]);
  };

  // 풀 크기 계산
  const poolSize = (() => {
    if (fixed.length === 6) return 0;
    const base = candidates.length > 0
      ? candidates.length
      : 45 - fixed.length - excluded.length;
    return Math.max(0, base);
  })();
  const slots = Math.max(0, 6 - fixed.length);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="조건 조합" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>

        {/* Hero */}
        <Card padding={14}>
          <View style={styles.heroRow}>
            <View style={[styles.heroIcon, { backgroundColor: 'rgba(101,65,242,0.10)' }]}>
              <T allowFontScaling={false} style={{ fontSize: 28 }}>🧩</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>조건 조합</T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 4, lineHeight: 18 }}>
                고정수·예상수·제외수를 직접 지정해 원하는 조합을 만들어요
              </T>
            </View>
          </View>
        </Card>

        {/* 모드 셀렉터 — 세그먼티드 */}
        <View style={[styles.segWrap, { backgroundColor: 'rgba(112,115,124,0.10)' }]}>
          {(['fixed', 'candidates', 'excluded'] as const).map((m) => {
            const on = mode === m;
            const info = MODE_INFO[m];
            const count = m === 'fixed' ? fixed.length : m === 'candidates' ? candidates.length : excluded.length;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={({ pressed }) => [
                  styles.segOpt,
                  on && [styles.segOptActive, { backgroundColor: t.bgSurface }],
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <T
                  variant="label1n"
                  style={{
                    color: on ? info.color : t.fgSecondary,
                    fontWeight: on ? '800' : '600',
                    fontSize: 13,
                  }}
                  allowFontScaling={false}
                >
                  {info.label} {count > 0 ? `${count}` : ''}
                </T>
              </Pressable>
            );
          })}
        </View>

        {/* 번호 그리드 — 1~45 (모든 상태 동시 표시) */}
        <Card padding={14}>
          <View style={styles.gridHead}>
            <T variant="caption1" color="tertiary" style={{ lineHeight: 17 }}>
              번호 탭 → {MODE_INFO[mode].label}으로 분류
            </T>
            {(fixed.length + candidates.length + excluded.length) > 0 && (
              <Pressable onPress={clearAll} hitSlop={6}>
                <T variant="caption1" color="danger" style={{ fontWeight: '700' }}>모두 해제</T>
              </Pressable>
            )}
          </View>
          <View style={styles.grid}>
            {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
              const state = stateOf(n);
              const info = state ? MODE_INFO[state] : null;
              return (
                <Pressable
                  key={n}
                  onPress={() => toggle(n)}
                  style={({ pressed }) => [
                    styles.cell,
                    state ? { backgroundColor: info!.color }
                          : { backgroundColor: 'transparent', borderColor: t.borderWeak, borderWidth: 1 },
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  {!state && (
                    <View
                      pointerEvents="none"
                      style={[styles.cellDot, { backgroundColor: ballColor(n), opacity: 0.5 }]}
                    />
                  )}
                  <T
                    variant="label1n"
                    style={{
                      color: state ? '#fff' : t.fgSecondary,
                      fontWeight: '700',
                      fontSize: 14,
                      textDecorationLine: state === 'excluded' ? 'line-through' : 'none',
                    }}
                    allowFontScaling={false}
                  >
                    {n}
                  </T>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.legendRow}>
            <Legend color={palette.blue500} label="고정수" />
            <Legend color={palette.green500} label="예상수" />
            <Legend color={palette.red500} label="제외수" strike />
          </View>
        </Card>

        {/* 현재 조건 요약 */}
        <Card padding={14} flat style={{ backgroundColor: palette.softFill }}>
          <T variant="caption1" color="secondary" style={{ lineHeight: 18 }}>
            고정수 <T variant="caption1" style={{ color: palette.blue700, fontWeight: '800' }}>{fixed.length}</T>개
            {' · '}
            예상수 <T variant="caption1" style={{ color: palette.green700, fontWeight: '800' }}>{candidates.length}</T>개
            {' · '}
            제외수 <T variant="caption1" style={{ color: palette.red500, fontWeight: '800' }}>{excluded.length}</T>개
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 4, lineHeight: 18 }}>
            {fixed.length === 6
              ? '고정수 6개가 다 차서 그대로 5게임에 사용돼요.'
              : `${slots}자리를 ${poolSize}개 풀에서 무작위 추출 → ${gameCount}게임`}
          </T>
        </Card>

        {/* 게임 수 */}
        <Card padding={14}>
          <View style={styles.gameRow}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>게임 수</T>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {GAME_OPTIONS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setGameCount(c)}
                  style={({ pressed }) => [
                    styles.gameChip,
                    {
                      backgroundColor: gameCount === c ? t.bgAccent : t.bgSurface,
                      borderColor: gameCount === c ? 'transparent' : t.borderWeak,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <T
                    variant="label1n"
                    style={{ color: gameCount === c ? '#fff' : t.fgSecondary, fontWeight: '700' }}
                    allowFontScaling={false}
                  >
                    {c}게임
                  </T>
                </Pressable>
              ))}
            </View>
          </View>
        </Card>

        {/* 결과 */}
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
                saved={savedSet[i]}
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
          disabled={poolSize === 0 && fixed.length < 6}
          onPress={onDraw}
        />
      </View>

      {toast && (
        <View style={[styles.toast, { backgroundColor: t.bgInverse }]} pointerEvents="none">
          <T variant="label1n" style={{ color: t.bgCanvas, fontWeight: '700' }}>{toast}</T>
        </View>
      )}
    </SafeAreaView>
  );
}

function Legend({ color, label, strike }: { color: string; label: string; strike?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <T variant="caption1" color="tertiary" style={{ marginLeft: 4, textDecorationLine: strike ? 'line-through' : 'none' }} allowFontScaling={false}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 56, height: 56, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  segWrap: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    gap: 2,
  },
  segOpt: {
    flex: 1,
    height: 38,
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
  gridHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cell: {
    width: 40, height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cellDot: {
    position: 'absolute',
    top: 4, right: 4,
    width: 5, height: 5,
    borderRadius: 2.5,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(112,115,124,0.10)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  gameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gameChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
