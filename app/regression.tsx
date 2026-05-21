/**
 * 회귀 분석 — /regression (무료 버전)
 *
 * "N회귀" = N회차 떨어진 두 회차의 당첨번호 중 겹치는 번호를 본다.
 *
 *   1회귀 = 직전 회차 → 현재 회차에서 다시 나온 번호
 *   2회귀 = 2회차 전  → 현재 회차에서 다시 나온 번호
 *   ...
 *   100회귀까지 선택 가능
 *
 * 화면 = (1) 회귀 chip 선택 + (2) 모든 회차의 이월 번호 리스트.
 * 통계/분포/평균 같은 심층 분석은 PRO 버전에서 제공.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { BallRow } from '@/src/components/BallRow';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import type { Draw } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const QUICK_KS = [1, 3, 5, 10] as const;
const MIN_K = 1;
const MAX_K = 100;

type Row = {
  target: Draw;
  overlap: number[];
};

export default function Regression() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);

  const [k, setK] = useState<number>(1);
  // K 입력 박스의 임시 상태 — focus 시 비워서 기존 값에 덧붙는 현상 방지.
  const [editingK, setEditingK] = useState<string | null>(null);

  /** 모든 회차에 대해 (target, target-K) 쌍의 이월 번호 계산. 최신 → 과거. */
  const rows: Row[] = useMemo(() => {
    if (!latestRound || !earliestRound) return [];
    const out: Row[] = [];
    for (let r = latestRound; r >= earliestRound + k; r--) {
      const target = drawsMap[r];
      const source = drawsMap[r - k];
      if (!target || !source) continue;
      const targetSet = new Set(target.nums);
      const overlap = source.nums.filter((n) => targetSet.has(n)).sort((a, b) => a - b);
      out.push({ target, overlap });
    }
    return out;
  }, [drawsMap, latestRound, earliestRound, k]);

  const pickK = (n: number) => {
    setK(n);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="회귀 분석" onBack={goBack} />

      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.target.round)}
        contentContainerStyle={{ paddingBottom: 24 }}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        ListHeaderComponent={
          <View style={{ padding: 16, paddingBottom: 8, gap: 12 }}>
            {/* 회귀 선택 — 빠른 칩 4개 + Stepper(−/+) 조합.
                자주 쓰는 값은 칩으로 한 번에, 11~100 같은 값은 ± 버튼으로 정밀 조정.
                10×10 그리드는 셀이 작아 잘못 누르기 쉬워서 제거. */}
            <View>
              <T variant="caption1" color="tertiary" style={{ letterSpacing: 0.4, marginBottom: 8 }}>
                회귀 선택
              </T>
              {/* 빠른 칩 4개 — 균등 분포 */}
              <View style={styles.chipRow}>
                {QUICK_KS.map((n) => (
                  <KChip key={n} k={n} active={n === k} onPress={() => pickK(n)} />
                ))}
              </View>
              {/* Stepper — 1씩 증감하면서 1~100 자유롭게 */}
              <View style={[styles.stepperRow, { borderColor: t.borderWeak, backgroundColor: t.bgSurface }]}>
                <Pressable
                  onPress={() => pickK(Math.max(MIN_K, k - 1))}
                  disabled={k <= MIN_K}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    { backgroundColor: t.bgSurface2, opacity: k <= MIN_K ? 0.35 : pressed ? 0.7 : 1 },
                  ]}
                >
                  <T variant="title3" allowFontScaling={false} style={{ color: t.fgPrimary, fontWeight: '800', fontSize: 22 }}>
                    −
                  </T>
                </Pressable>
                <View style={styles.stepperValue}>
                  {/* 숫자 부분을 직접 입력 가능 — focus 시 박스를 비워서 기존 값에
                      덧붙는 현상 방지. blur 시 입력값을 1~100으로 clamp 후 K 반영. */}
                  <TextInput
                    value={editingK !== null ? editingK : String(k)}
                    onFocus={() => setEditingK('')}
                    onChangeText={(text) => {
                      // 숫자만 (다른 문자 무시), 최대 3자리
                      const digits = text.replace(/[^0-9]/g, '').slice(0, 3);
                      setEditingK(digits);
                    }}
                    onBlur={() => {
                      if (editingK !== null && editingK !== '') {
                        const n = parseInt(editingK, 10);
                        if (Number.isFinite(n)) {
                          setK(Math.max(MIN_K, Math.min(MAX_K, n)));
                        }
                      }
                      setEditingK(null);
                    }}
                    onSubmitEditing={() => {
                      // 키보드의 완료/엔터 버튼 — 즉시 적용 후 blur 효과
                      if (editingK !== null && editingK !== '') {
                        const n = parseInt(editingK, 10);
                        if (Number.isFinite(n)) {
                          setK(Math.max(MIN_K, Math.min(MAX_K, n)));
                        }
                      }
                      setEditingK(null);
                    }}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={3}
                    allowFontScaling={false}
                    style={styles.stepperInput}
                  />
                  <T variant="caption1" color="tertiary" allowFontScaling={false} style={{ fontSize: 12, marginLeft: 4 }}>
                    회귀
                  </T>
                </View>
                <Pressable
                  onPress={() => pickK(Math.min(MAX_K, k + 1))}
                  disabled={k >= MAX_K}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    { backgroundColor: t.bgSurface2, opacity: k >= MAX_K ? 0.35 : pressed ? 0.7 : 1 },
                  ]}
                >
                  <T variant="title3" allowFontScaling={false} style={{ color: t.fgPrimary, fontWeight: '800', fontSize: 22 }}>
                    +
                  </T>
                </Pressable>
              </View>
            </View>

            {/* 헤더 요약 */}
            <View style={[styles.header, { backgroundColor: palette.purple500 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <T variant="title3" style={{ color: '#fff', fontWeight: '800' }}>
                  {k}회귀
                </T>
                <T variant="body2r" style={{ color: 'rgba(255,255,255,0.78)' }}>
                  · {k}회차 전과 비교
                </T>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => <RegressionRow row={item} />}
        ListEmptyComponent={
          <View style={{ padding: 24, alignItems: 'center' }}>
            <T variant="body2r" color="secondary">데이터가 부족합니다.</T>
          </View>
        }
        ListFooterComponent={
          <View style={{ padding: 16 }}>
            <Disclaimer short />
          </View>
        }
      />

    </SafeAreaView>
  );
}

/* ─── 회차 행 ─────────────────────────────────────────────────────── */

function RegressionRow({ row }: { row: Row }) {
  const t = useTheme();
  const count = row.overlap.length;
  const isEmpty = count === 0;
  return (
    <View style={[styles.row, { borderTopColor: t.borderDivider }]}>
      <View style={{ width: 70 }}>
        <T variant="label1n" color={isEmpty ? 'secondary' : 'primary'} style={{ fontWeight: '800' }}>
          {row.target.round}
        </T>
        <T variant="caption2" color="tertiary" style={{ marginTop: 2 }}>
          {row.target.date.slice(2)}
        </T>
      </View>
      <View style={styles.midCol}>
        {isEmpty ? (
          <T variant="caption1" color="tertiary" allowFontScaling={false} style={{ fontSize: 13 }}>
            이월 없음
          </T>
        ) : (
          <BallRow nums={row.overlap} size="sm" />
        )}
      </View>
      {!isEmpty && (
        <View style={[styles.countPill, { backgroundColor: countBg(count) }]}>
          <T
            variant="caption2"
            allowFontScaling={false}
            style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}
          >
            {count}
          </T>
        </View>
      )}
    </View>
  );
}

function KChip({ k, active, onPress }: { k: number; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? palette.purple500 : t.borderNormal,
          backgroundColor: active ? palette.purple500 : t.bgSurface,
        },
      ]}
    >
      <T
        variant="caption1"
        allowFontScaling={false}
        style={{
          color: active ? '#fff' : t.fgSecondary,
          fontWeight: '700',
          fontSize: 13,
        }}
      >
        {k}
      </T>
    </Pressable>
  );
}

function countBg(count: number): string {
  if (count === 1) return '#d97706';
  if (count === 2) return '#ea580c';
  return palette.red500;
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1, // 4개 칩 균등 분포
    height: 36,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Stepper — 빠른 칩으로 부족할 때 정밀 조정 (1~100)
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  stepperBtn: {
    width: 48,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 2,
  },
  // 숫자 직접 입력용 — TextInput을 큰 숫자처럼 보이게 스타일
  stepperInput: {
    color: palette.purple500,
    fontWeight: '900',
    fontSize: 22,
    textAlign: 'center',
    minWidth: 56,
    padding: 0, // RN-Web 기본 padding 제거
  },

  header: {
    borderRadius: radius.lg,
    padding: 14,
  },


  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  midCol: {
    flex: 1,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  countPill: {
    minWidth: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
  },

});
