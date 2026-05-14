/**
 * 수동 조합 분석 — /manual-pick
 *
 * 사용자가 1~45에서 6개를 직접 선택하면 즉시 그 조합의 균형 점수와
 * 8가지 지표 통과 여부를 보여주는 모드. "이 조합이 좋은지 안 좋은지"를
 * 한눈에 판단할 수 있게 시각화.
 *
 * 점수 계산:
 *   - 8개 균형 조건 중 통과 개수 → 5점 만점 별점
 *   - 8개 모두 통과: 5⭐ "균형 잡힌 조합"
 *   - 6~7개:        4⭐ "괜찮음"
 *   - 4~5개:        3⭐ "보통"
 *   - 2~3개:        2⭐ "주의"
 *   - 0~1개:        1⭐ "이례적"
 */
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { BallRow } from '@/src/components/BallRow';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { NumPicker } from '@/src/components/NumPicker';
import { useHistory } from '@/src/data/historyStore';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import {
  ac, firstThreeSum, highLowLabel, intersect, longestConsecutive,
  oddEvenLabel, rank, tailSum, total,
} from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function ManualPick() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/gen');
  const addSaved = useSavedNumbers((s) => s.add);
  const allDrawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const latestDraw = useHistory((s) => s.getLatest());

  const [selected, setSelected] = React.useState<number[]>([]);
  const [saved, setSaved] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const allDraws = useMemo(() => {
    return Object.keys(allDrawsMap)
      .map((k) => Number(k))
      .sort((a, b) => b - a)
      .map((r) => allDrawsMap[r]);
  }, [allDrawsMap, latestRound]);

  const onToggle = (n: number) => {
    setSelected((s) => {
      if (s.includes(n)) return s.filter((x) => x !== n);
      if (s.length >= 6) {
        setToast('번호는 최대 6개까지');
        return s;
      }
      return [...s, n].sort((a, b) => a - b);
    });
    setSaved(false);
  };

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(id);
  }, [toast]);

  const isComplete = selected.length === 6;

  // 균형 평가 (8개 지표)
  const evalResult = useMemo(() => {
    if (!isComplete) return null;
    return evaluateCombo(selected);
  }, [selected, isComplete]);

  // 직전 회차 이월수
  const carryOver = useMemo(() => {
    if (!isComplete || !latestDraw) return [];
    return intersect(selected, latestDraw.nums);
  }, [selected, isComplete, latestDraw]);

  // 역대 매칭 카운트
  const rankCounts = useMemo(() => {
    if (!isComplete) return { r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 };
    const c = { r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 };
    for (const d of allDraws) {
      const r = rank(selected, d.nums, d.bonus);
      if (r === 1) c.r1++;
      else if (r === 2) c.r2++;
      else if (r === 3) c.r3++;
      else if (r === 4) c.r4++;
      else if (r === 5) c.r5++;
    }
    return c;
  }, [allDraws, selected, isComplete]);

  const onSave = () => {
    if (!isComplete) return;
    const res = addSaved({ nums: selected, round: null, source: 'manual' });
    if (res.ok) {
      setSaved(true);
      setToast('보관함에 저장했어요');
    } else if (res.reason === 'duplicate') {
      setToast('이미 저장한 번호예요');
    } else {
      setToast('보관함이 가득 찼어요');
    }
  };

  const onReset = () => {
    setSelected([]);
    setSaved(false);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="수동 조합 분석" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* Hero */}
        <Card padding={14}>
          <View style={styles.heroRow}>
            <View style={[styles.heroIcon, { backgroundColor: 'rgba(0,191,64,0.10)' }]}>
              <T allowFontScaling={false} style={{ fontSize: 28 }}>✋</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>수동 조합 분석</T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 4, lineHeight: 18 }}>
                직접 6개를 골라보면 그 조합의 균형 점수와 분석이 즉시 나와요
              </T>
            </View>
          </View>
        </Card>

        {/* 번호 선택 그리드 */}
        <Card padding={14}>
          <View style={styles.gridHead}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
              번호 선택 {selected.length}/6
            </T>
            {selected.length > 0 && (
              <Pressable onPress={onReset} hitSlop={6}>
                <T variant="caption1" color="danger" style={{ fontWeight: '700' }}>초기화</T>
              </Pressable>
            )}
          </View>
          <NumPicker
            mode="multi"
            selected={selected}
            onToggle={onToggle}
          />
        </Card>

        {/* 미완성 안내 */}
        {!isComplete && (
          <Card padding={20}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <T allowFontScaling={false} style={{ fontSize: 32, opacity: 0.5 }}>✏️</T>
              <T variant="body2r" color="tertiary" style={{ textAlign: 'center', lineHeight: 20 }}>
                6개를 모두 선택하면 {'\n'}이 조합의 균형 점수가 자동으로 나와요
              </T>
            </View>
          </Card>
        )}

        {/* 분석 결과 — 6개 선택 시 */}
        {isComplete && evalResult && (
          <>
            {/* 선택한 조합 미리보기 */}
            <Card padding={16}>
              <T variant="caption1" color="tertiary" style={{ marginBottom: 10 }}>
                선택한 조합
              </T>
              <View style={{ alignItems: 'center' }}>
                <BallRow nums={selected} size="lg" />
              </View>
            </Card>

            {/* 균형 점수 + 실패 지표 종합 안내 */}
            <Card padding={16}>
              <View style={styles.scoreHead}>
                <View style={{ flex: 1 }}>
                  <T variant="caption1" color="tertiary" style={{ fontWeight: '600' }}>
                    균형 점수
                  </T>
                  <View style={styles.starsRow}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <T
                        key={i}
                        allowFontScaling={false}
                        style={{
                          fontSize: 22,
                          color: i < evalResult.stars ? '#fbc400' : 'rgba(112,115,124,0.3)',
                          marginRight: 2,
                        }}
                      >
                        ★
                      </T>
                    ))}
                  </View>
                  <T variant="heading2" color="primary" style={{ fontWeight: '800', marginTop: 4 }}>
                    {evalResult.label}
                  </T>
                </View>
                <View style={[styles.scoreCircle, { backgroundColor: evalResult.bgColor }]}>
                  <T variant="title2" style={{ color: evalResult.fgColor, fontWeight: '800', fontSize: 26 }} allowFontScaling={false}>
                    {evalResult.score10.toFixed(1)}
                  </T>
                  <T variant="caption2" style={{ color: evalResult.fgColor, fontSize: 10 }} allowFontScaling={false}>
                    / 10점
                  </T>
                </View>
              </View>

              {/* 실패한 지표 종합 — 핵심과 일반 모두 한눈에 */}
              {evalResult.failedChecks.length > 0 && (
                <View style={[styles.warnBox, { backgroundColor: 'rgba(255,66,66,0.06)', borderColor: 'rgba(255,66,66,0.20)' }]}>
                  <T variant="caption1" style={{ color: palette.red500, fontWeight: '700', marginBottom: 6 }} allowFontScaling={false}>
                    ⚠ 일반적이지 않은 지표 ({evalResult.failedChecks.length}개)
                  </T>
                  <View style={styles.failChipsRow}>
                    {evalResult.failedChecks.map((c) => (
                      <View
                        key={c.id}
                        style={[
                          styles.failChip,
                          {
                            backgroundColor: c.killer ? 'rgba(255,66,66,0.15)' : 'rgba(255,193,7,0.18)',
                            borderColor: c.killer ? palette.red500 : '#a37116',
                          },
                        ]}
                      >
                        <T
                          variant="caption1"
                          style={{ color: c.killer ? palette.red500 : '#a37116', fontWeight: '700', fontSize: 11.5 }}
                          allowFontScaling={false}
                        >
                          {c.label} {c.value}
                        </T>
                        {c.killer && (
                          <T variant="caption2" style={{ color: palette.red500, fontWeight: '800', fontSize: 9.5, marginLeft: 4 }} allowFontScaling={false}>
                            핵심
                          </T>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </Card>

            {/* 8개 체크리스트 — 중요도(가중치) 표시 */}
            <Card padding={16}>
              <View style={styles.checklistHead}>
                <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                  균형 조건 8가지
                </T>
                <T variant="caption1" color="tertiary">중요도 ●●● ~ ●</T>
              </View>
              <View style={{ gap: 4 }}>
                {evalResult.checks.map((c, i) => (
                  <View key={i} style={[styles.checkRow, { borderColor: t.borderDivider }]}>
                    <View style={[
                      styles.checkIcon,
                      { backgroundColor: c.pass ? 'rgba(0,191,64,0.15)' : 'rgba(255,66,66,0.12)' },
                    ]}>
                      <T allowFontScaling={false} style={{ fontSize: 14, color: c.pass ? palette.green500 : palette.red500 }}>
                        {c.pass ? '✓' : '✗'}
                      </T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.checkLabelRow}>
                        <T variant="label1n" color="primary" style={{ fontWeight: '600' }}>
                          {c.label}
                        </T>
                        {c.killer && (
                          <View style={[styles.killerBadge, { backgroundColor: 'rgba(255,66,66,0.12)' }]}>
                            <T variant="caption2" style={{ color: palette.red500, fontWeight: '700', fontSize: 9.5 }} allowFontScaling={false}>
                              핵심
                            </T>
                          </View>
                        )}
                        <T allowFontScaling={false} style={{ color: 'rgba(112,115,124,0.6)', fontSize: 10, marginLeft: 4 }}>
                          {'●'.repeat(c.weight)}
                        </T>
                      </View>
                      <T variant="caption1" color="tertiary" style={{ marginTop: 1, fontSize: 11 }}>
                        {c.detail}
                      </T>
                    </View>
                    <T
                      variant="label2"
                      style={{ color: c.pass ? palette.green700 : palette.red500, fontWeight: '700' }}
                      allowFontScaling={false}
                    >
                      {c.value}
                    </T>
                  </View>
                ))}
              </View>
            </Card>

            {/* 직전 회차 + 역대 매칭 */}
            <Card padding={16}>
              <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 12 }}>
                추가 정보
              </T>
              <View style={styles.infoRow}>
                <View style={{ flex: 1 }}>
                  <T variant="caption1" color="tertiary">직전 회차 이월수</T>
                  <T variant="heading2" color="primary" style={{ fontWeight: '800', marginTop: 4 }}>
                    {carryOver.length}개
                  </T>
                  {carryOver.length > 0 && (
                    <T variant="caption2" color="tertiary" style={{ marginTop: 2, fontSize: 11 }}>
                      {carryOver.join(', ')}
                    </T>
                  )}
                </View>
                <View style={{ width: 1, backgroundColor: t.borderDivider, marginHorizontal: 12 }} />
                <View style={{ flex: 1 }}>
                  <T variant="caption1" color="tertiary">역대 매칭</T>
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {rankCounts.r1 + rankCounts.r2 + rankCounts.r3 + rankCounts.r4 + rankCounts.r5 === 0 ? (
                      <T variant="caption1" color="tertiary">없음</T>
                    ) : (
                      <>
                        {rankCounts.r1 > 0 && <Chip label={`1등 ${rankCounts.r1}`} tone="purple" compact />}
                        {rankCounts.r2 > 0 && <Chip label={`2등 ${rankCounts.r2}`} tone="purple" compact />}
                        {rankCounts.r3 > 0 && <Chip label={`3등 ${rankCounts.r3}`} tone="accent" compact />}
                        {rankCounts.r4 > 0 && <Chip label={`4등 ${rankCounts.r4}`} tone="accent" compact />}
                        {rankCounts.r5 > 0 && <Chip label={`5등 ${rankCounts.r5}`} tone="success" compact />}
                      </>
                    )}
                  </View>
                </View>
              </View>
            </Card>

            {/* 액션 */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={saved ? '저장됨 ✓' : '보관함에 저장'}
                  variant={saved ? 'outline' : 'primary'}
                  size="lg"
                  full
                  disabled={saved}
                  onPress={onSave}
                />
              </View>
            </View>
            <Pressable
              onPress={() => router.push(`/combo?nums=${selected.join(',')}` as any)}
              style={({ pressed }) => [styles.detailLink, { opacity: pressed ? 0.85 : 1 }]}
            >
              <T variant="label1n" style={{ color: palette.blue700, fontWeight: '700' }}>
                자세한 분석 보기 →
              </T>
            </Pressable>
          </>
        )}

        <Disclaimer />
      </ScrollView>

      {toast && (
        <View style={[styles.toast, { backgroundColor: t.bgInverse }]} pointerEvents="none">
          <T variant="label1n" style={{ color: t.scheme === 'dark' ? t.fgPrimary : '#fff' }}>{toast}</T>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── 균형 평가 (가중치 + Killer 조건) ────────────────────────────────────────
//
// 단순 카운트 대신 각 조건의 통계적 중요도(실제 1223회 통과율)를 가중치로 반영.
// 또한 통과율 90%+ 조건은 "Killer"로 지정 — 깨지면 최대 3★로 캡.
// AC=4 같은 매우 이례적 케이스가 무심코 4★를 받지 않도록.

type CheckId = 'sum' | 'tail' | 'ac' | 'oddEven' | 'highLow' | 'consec' | 'segment' | 'first3';

type CheckDef = {
  id: CheckId;
  label: string;
  detail: string;
  value: string;
  pass: boolean;
  weight: number;     // 1~3 (실제 회차 통과율 기반)
  killer: boolean;    // true: 깨지면 별점 최대 3 cap
};

function evaluateCombo(nums: number[]) {
  const s = total(nums);
  const ts = tailSum(nums);
  const a = ac(nums);
  let odd = 0;
  for (const n of nums) if (n % 2 === 1) odd++;
  let low = 0;
  for (const n of nums) if (n <= 22) low++;
  const consec = longestConsecutive(nums);
  const seg = [0, 0, 0, 0, 0];
  for (const n of nums) {
    if (n <= 10) seg[0]++;
    else if (n <= 20) seg[1]++;
    else if (n <= 30) seg[2]++;
    else if (n <= 40) seg[3]++;
    else seg[4]++;
  }
  const maxSeg = Math.max(...seg);
  const f3 = firstThreeSum(nums);

  const checks: CheckDef[] = [
    {
      id: 'ac', label: 'AC값', detail: '7 이상 (충분히 흩어짐)',
      value: `${a}`, pass: a >= 7, weight: 3, killer: true,
    },
    {
      id: 'segment', label: '구간 분포', detail: '한 구간 3개 이하',
      value: `최대 ${maxSeg}`, pass: maxSeg <= 3, weight: 3, killer: true,
    },
    {
      id: 'sum', label: '합 (총합)', detail: '평균 범위 100~175',
      value: `${s}`, pass: s >= 100 && s <= 175, weight: 3, killer: false,
    },
    {
      id: 'oddEven', label: '홀짝 균형', detail: '극단(6:0 등) 아님',
      value: oddEvenLabel(nums), pass: Math.abs(odd - (6 - odd)) <= 2,
      weight: 2, killer: false,
    },
    {
      id: 'highLow', label: '저:고 균형', detail: '극단(6:0 등) 아님',
      value: highLowLabel(nums), pass: Math.abs(low - (6 - low)) <= 2,
      weight: 2, killer: false,
    },
    {
      id: 'tail', label: '끝수합', detail: '평균 범위 18~35',
      value: `${ts}`, pass: ts >= 18 && ts <= 35, weight: 2, killer: false,
    },
    {
      id: 'consec', label: '연속수', detail: '최장 2개 이하',
      value: `${consec}`, pass: consec <= 2, weight: 1, killer: false,
    },
    {
      id: 'first3', label: '앞세수합', detail: '평균 범위 35~55',
      value: `${f3}`, pass: f3 >= 35 && f3 <= 55, weight: 1, killer: false,
    },
  ];

  const passed = checks.filter((c) => c.pass).length;
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0); // 17점 만점 (내부)
  const passedWeight = checks.filter((c) => c.pass).reduce((sum, c) => sum + c.weight, 0);
  const ratio = passedWeight / totalWeight;
  // 표시는 10점 만점으로 환산
  const score10 = Math.round(ratio * 100) / 10; // 소수점 1자리 (예: 7.6)

  // 별점 매핑 (가중치 비율 기준)
  let stars =
    ratio >= 0.95 ? 5
    : ratio >= 0.80 ? 4
    : ratio >= 0.60 ? 3
    : ratio >= 0.35 ? 2
    : 1;

  // Killer 조건 깨지면 최대 3★로 캡 — "흔치 않은 패턴" 경고
  const killersViolated = checks.filter((c) => c.killer && !c.pass);
  if (killersViolated.length > 0 && stars > 3) stars = 3;
  // 핵심 2개 다 깨지면 더 강하게 — 최대 2★
  if (killersViolated.length >= 2 && stars > 2) stars = 2;

  const label =
    stars === 5 ? '균형이 매우 잘 잡혔어요'
    : stars === 4 ? '괜찮은 조합이에요'
    : stars === 3 ? '보통이에요'
    : stars === 2 ? '한쪽으로 치우쳤어요'
    : '이례적인 조합이에요';

  // 실패한 모든 지표를 칩 리스트로 — 핵심/일반 구분
  const failedChecks = checks.filter((c) => !c.pass);

  const bgColor =
    stars >= 4 ? 'rgba(0,191,64,0.15)'
    : stars === 3 ? 'rgba(0,102,255,0.15)'
    : stars === 2 ? 'rgba(255,193,7,0.18)'
    : 'rgba(255,66,66,0.15)';
  const fgColor =
    stars >= 4 ? palette.green700
    : stars === 3 ? palette.blue700
    : stars === 2 ? '#a37116'
    : palette.red500;

  return {
    checks, passed, passedWeight, totalWeight, score10,
    stars, label, failedChecks, bgColor, fgColor,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 56, height: 56, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  gridHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  starsRow: { flexDirection: 'row', marginTop: 4 },
  warnBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  failChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  failChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  scoreCircle: {
    width: 78, height: 78, borderRadius: 39,
    alignItems: 'center', justifyContent: 'center',
  },
  checklistHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  killerBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
  },
  checkIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  detailLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  toast: {
    position: 'absolute',
    left: 24, right: 24, bottom: 24,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
  },
});
