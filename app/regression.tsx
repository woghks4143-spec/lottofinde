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
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
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

const QUICK_KS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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
  const [pickerOpen, setPickerOpen] = useState(false);

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
    setPickerOpen(false);
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
            {/* 회귀 선택 chip row */}
            <View>
              <T variant="caption1" color="tertiary" style={{ letterSpacing: 0.4, marginBottom: 8 }}>
                회귀 선택
              </T>
              <View style={styles.chipRow}>
                {QUICK_KS.map((n) => (
                  <KChip key={n} k={n} active={n === k} onPress={() => pickK(n)} />
                ))}
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  style={[
                    styles.chip,
                    {
                      borderColor: k > 10 ? palette.purple500 : t.borderNormal,
                      backgroundColor: k > 10 ? palette.purple500 : t.bgSurface,
                    },
                  ]}
                >
                  <T
                    variant="caption1"
                    style={{
                      color: k > 10 ? '#fff' : t.fgSecondary,
                      fontWeight: '700',
                    }}
                  >
                    {k > 10 ? `${k}` : '더 보기'}
                  </T>
                  <Icon.chev color={k > 10 ? '#fff' : t.fgTertiary} size={11} weight={2.2} />
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

      {/* 회귀 picker modal (1~100) */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: t.bgSurface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T variant="headline2" color="primary" style={{ fontWeight: '800' }}>
                회귀 선택
              </T>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <Icon.close color={t.fgSecondary} size={20} weight={2} />
              </Pressable>
            </View>
            <T variant="caption1" color="tertiary" style={{ marginTop: 4, marginBottom: 12 }}>
              1 ~ {MAX_K}회귀 중 선택
            </T>
            <View style={{ gap: 6 }}>
              {Array.from({ length: 10 }).map((_, row) => (
                <View key={row} style={{ flexDirection: 'row', gap: 6 }}>
                  {Array.from({ length: 10 }).map((_, col) => {
                    const n = row * 10 + col + 1;
                    const active = n === k;
                    return (
                      <Pressable
                        key={col}
                        onPress={() => pickK(n)}
                        style={[
                          styles.gridCell,
                          {
                            backgroundColor: active ? palette.purple500 : t.bgSurface2,
                            borderColor: active ? palette.purple500 : t.borderDivider,
                          },
                        ]}
                      >
                        <T
                          variant="caption1"
                          compact
                          allowFontScaling={false}
                          style={{
                            color: active ? '#fff' : t.fgPrimary,
                            fontWeight: active ? '800' : '600',
                            fontSize: 12,
                          }}
                        >
                          {n}
                        </T>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    minWidth: 36,
    height: 32,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.xl,
    padding: 20,
  },
  gridCell: {
    flex: 1,
    aspectRatio: 1,
    minWidth: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
