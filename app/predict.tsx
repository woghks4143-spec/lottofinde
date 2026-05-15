/**
 * 예상수 10수 분석 — /predict
 *
 * 무료 분석법 8가지(Hot/Cold/이월/이웃/-45/동일날짜/궁합/회귀)가 각각 후보를
 * 추출 → 투표 누적 → 상위 10개를 추천.
 *
 * 회차 이동 지원:
 *   - 기본: 다음 회차(latestRound + 1) 예측
 *   - 좌/우 화살표: 1회차씩 이동
 *   - "최신": 다음 회차로 점프
 *   - "회차 입력": 모달로 임의 회차 지정
 *
 * 과거 회차로 이동하면 그 회차의 예측 vs 실제 당첨번호를 비교해 적중 개수를
 * 즉시 보여준다(매치된 공에 초록 링).
 *
 * ⚠️ 로또는 무작위입니다. 통계 참고용일 뿐 당첨을 보장하지 않습니다.
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import { backtest, METHOD_META, predict10, type MethodId } from '@/src/lib/predict10';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const BACKTEST_WINDOW = 20;

export default function Predict() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/analysis');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);
  const latestDraw = useHistory((s) => s.getLatest());

  // 분석 대상 회차 — 기본 = 다음 회차(미추첨), 사용자가 이전 회차도 볼 수 있음.
  const upcomingRound = latestRound + 1;
  const [round, setRound] = useState<number>(upcomingRound);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInput, setPickerInput] = useState('');

  const isUpcoming = round === upcomingRound;
  const minRound = Math.max(2, earliestRound + 1); // 최소 1회차 이상의 prior 데이터 필요
  const maxRound = upcomingRound;

  const jumpTo = (n: number) => {
    const clamped = Math.max(minRound, Math.min(maxRound, Math.round(n)));
    setRound(clamped);
    setPickerOpen(false);
    setPickerInput('');
  };
  const submitPicker = () => {
    const n = parseInt(pickerInput.replace(/[^0-9]/g, ''), 10);
    if (!Number.isFinite(n)) return;
    jumpTo(n);
  };

  // ─── 대상 회차 예측 ────────────────────────────────────────────────
  const prediction = useMemo(() => predict10(drawsMap, round), [drawsMap, round]);

  /** 대상 회차의 실제 결과 (과거 회차일 때만 존재). */
  const actual = useMemo(() => {
    if (round > latestRound) return null;
    return drawsMap[round] ?? null;
  }, [drawsMap, round, latestRound]);

  /** 예측 10수 중 실제 당첨 번호와 일치한 번호 Set. */
  const matchedSet = useMemo(() => {
    if (!actual) return new Set<number>();
    return new Set(prediction.picks.filter((n) => actual.nums.includes(n)));
  }, [actual, prediction.picks]);

  // ─── 백테스트 (대상 회차 이전 N회) ────────────────────────────────
  const back = useMemo(() => {
    if (!latestRound) return null;
    const toR = isUpcoming ? latestRound : round - 1;
    if (toR < minRound) return null;
    const fromR = Math.max(minRound, toR - BACKTEST_WINDOW + 1);
    return backtest(drawsMap, fromR, toR);
  }, [drawsMap, latestRound, round, isUpcoming, minRound]);

  // ─── 대상 회차 추첨일 표시 ────────────────────────────────────────
  const dateLabel = useMemo(() => {
    if (actual) return formatDateLabel(actual.date);
    if (!latestDraw) return '';
    const [y, m, d] = latestDraw.date.split('-').map(Number);
    const offset = (round - latestRound) * 7;
    const next = new Date(Date.UTC(y, m - 1, d + offset));
    return `${next.getUTCFullYear()}년 ${next.getUTCMonth() + 1}월 ${next.getUTCDate()}일 (${['일','월','화','수','목','금','토'][next.getUTCDay()]})`;
  }, [actual, latestDraw, latestRound, round]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="예상수 10수 분석" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* 면책 안내 */}
        <View style={[styles.warnBox, { backgroundColor: 'rgba(255,66,66,0.10)', borderColor: 'rgba(255,66,66,0.30)' }]}>
          <T variant="caption1" style={{ color: palette.red500, lineHeight: 18, fontWeight: '600' }}>
            ⚠️ <T variant="caption1" style={{ color: palette.red500, fontWeight: '800' }}>로또는 무작위</T>입니다.
            8가지 통계 분석법을 결합한 참고 자료일 뿐, <T variant="caption1" style={{ color: palette.red500, fontWeight: '800' }}>당첨을 보장하지 않습니다</T>.
          </T>
        </View>

        {/* 회차 네비게이션 */}
        <View style={styles.navRow}>
          <Pressable
            onPress={() => jumpTo(round - 1)}
            disabled={round <= minRound}
            style={[styles.navBtn, { borderColor: t.borderNormal, backgroundColor: t.bgSurface, opacity: round <= minRound ? 0.4 : 1 }]}
          >
            <Icon.chevLeft color={t.fgSecondary} size={18} weight={2.2} />
          </Pressable>
          <Pressable
            onPress={() => jumpTo(upcomingRound)}
            style={[styles.miniBtn, { borderColor: isUpcoming ? palette.purple500 : t.borderNormal, backgroundColor: isUpcoming ? palette.purple500 : t.bgSurface }]}
          >
            <T
              variant="caption1"
              allowFontScaling={false}
              style={{ color: isUpcoming ? '#fff' : t.fgSecondary, fontWeight: '700', fontSize: 12 }}
            >
              최신 ({upcomingRound})
            </T>
          </Pressable>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={[styles.miniBtn, { borderColor: t.borderNormal, backgroundColor: t.bgSurface }]}
          >
            <T variant="caption1" allowFontScaling={false} style={{ color: t.fgSecondary, fontWeight: '700', fontSize: 12 }}>
              회차 입력
            </T>
          </Pressable>
          <Pressable
            onPress={() => jumpTo(round + 1)}
            disabled={round >= maxRound}
            style={[styles.navBtn, { borderColor: t.borderNormal, backgroundColor: t.bgSurface, opacity: round >= maxRound ? 0.4 : 1 }]}
          >
            <View style={{ transform: [{ scaleX: -1 }] }}>
              <Icon.chevLeft color={t.fgSecondary} size={18} weight={2.2} />
            </View>
          </Pressable>
        </View>

        {/* 헤더 — 대상 회차 + 예측 10수 */}
        <View style={[styles.hero, { backgroundColor: palette.purple500 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.78)', letterSpacing: 0.4 }}>
                DRAW {round}
              </T>
              <T variant="title2" style={{ color: '#fff', fontWeight: '800', marginTop: 4 }}>
                {isUpcoming ? '다음 회차 예상 10수' : `${round}회 예상 10수`}
              </T>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.78)', marginTop: 4 }}>
                {isUpcoming ? '추첨 예정 ' : '추첨일 '}{dateLabel}
              </T>
            </View>
            {actual && (
              <View style={[styles.hitBadge, { backgroundColor: hitBadgeBg(matchedSet.size) }]}>
                <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>
                  적중 {matchedSet.size}/6
                </T>
              </View>
            )}
          </View>
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            {prediction.picks.length === 10 ? (
              <PickGrid picks={prediction.picks} matched={matchedSet} />
            ) : (
              <T variant="body2r" style={{ color: 'rgba(255,255,255,0.78)' }}>
                예측에 필요한 회차 데이터가 부족해요
              </T>
            )}
          </View>
        </View>

        {/* 실제 당첨번호 비교 (과거 회차 전용) */}
        {actual && (
          <Card padding={16}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                🎯 {round}회 실제 당첨번호
              </T>
              <T variant="caption1" color="tertiary">{actual.date}</T>
            </View>
            <BallRow nums={actual.nums} bonus={actual.bonus} size="sm" hits={[...matchedSet]} />
            <T variant="caption1" color={matchedSet.size > 0 ? 'primary' : 'secondary'} style={{ marginTop: 10, lineHeight: 18 }}>
              {matchedSet.size > 0 ? (
                <>
                  예상 10수 중{' '}
                  <T variant="caption1" color="primary" style={{ fontWeight: '800' }}>
                    {[...matchedSet].sort((a, b) => a - b).join(', ')}
                  </T>
                  {`번 (${matchedSet.size}개)이 실제 당첨번호에 포함됐어요.`}
                </>
              ) : (
                '예상 10수 중 일치 번호가 없었습니다.'
              )}
            </T>
          </Card>
        )}

        {/* 백테스트 — 대상 회차 직전 N회 */}
        {back && back.samples.length > 0 && (
          <Card padding={16}>
            <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
              📊 직전 {back.samples.length}회 적중률
            </T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 4, marginBottom: 12, lineHeight: 17 }}>
              동일 알고리즘을 {back.samples[0].round}~{back.samples[back.samples.length - 1].round}회에 적용한 결과
            </T>

            <View style={styles.statsRow}>
              <StatBox label="평균 적중" value={back.avgHits.toFixed(2)} suffix="/ 6" />
              <StatBox label="최고 기록" value={back.best ? String(back.best.hits) : '0'} suffix={back.best ? `· ${back.best.round}회` : ''} />
              <StatBox label="기대치(랜덤)" value="1.33" suffix="/ 6" muted />
            </View>

            <T variant="caption1" color="secondary" style={{ marginTop: 16, marginBottom: 8, fontWeight: '700' }}>
              적중 개수 분포
            </T>
            <View style={{ gap: 6 }}>
              {back.distribution.map((cnt, i) => {
                const pct = back.samples.length ? cnt / back.samples.length : 0;
                const width = Math.max(2, pct * 100);
                const dim = cnt === 0;
                return (
                  <View key={i} style={styles.distRow}>
                    <T variant="caption1" color={dim ? 'tertiary' : 'secondary'} style={{ width: 38, fontWeight: '700' }}>
                      {i}개
                    </T>
                    <View style={[styles.distTrack, { backgroundColor: t.bgSurface2 }]}>
                      <View
                        style={{
                          width: `${width}%`,
                          height: '100%',
                          borderRadius: 4,
                          backgroundColor: hitBarColor(i),
                          opacity: dim ? 0.4 : 1,
                        }}
                      />
                    </View>
                    <T
                      variant="caption1"
                      color={dim ? 'tertiary' : 'primary'}
                      style={{ width: 96, textAlign: 'right', fontWeight: '700' }}
                      numberOfLines={1}
                      allowFontScaling={false}
                    >
                      {(pct * 100).toFixed(1)}% · {cnt}회
                    </T>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* 분석 방법별 기여 */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            🧪 분석 방법별 후보
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 4, marginBottom: 12, lineHeight: 17 }}>
            8가지 분석법이 낸 후보 번호 — 여러 방법에서 동시에 추천될수록 상위 10에 들어감
          </T>
          <View style={{ gap: 12 }}>
            {(Object.keys(METHOD_META) as MethodId[]).map((mid) => (
              <MethodRow
                key={mid}
                methodId={mid}
                nums={prediction.methodOutput[mid]}
                picks={new Set(prediction.picks)}
                matched={matchedSet}
              />
            ))}
          </View>
        </Card>

        <Disclaimer />
      </ScrollView>

      {/* 회차 입력 모달 */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: t.bgSurface }]} onPress={(e) => e.stopPropagation()}>
            <T variant="headline2" color="primary" style={{ fontWeight: '800' }}>
              회차 입력
            </T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 4 }}>
              {minRound} ~ {maxRound}회 (최신은 추첨 예정)
            </T>
            <TextInput
              value={pickerInput}
              onChangeText={setPickerInput}
              placeholder={`예: ${latestRound}`}
              placeholderTextColor={t.fgTertiary}
              keyboardType="number-pad"
              style={[styles.input, { borderColor: t.borderNormal, color: t.fgPrimary, backgroundColor: t.bgCanvas }]}
              autoFocus
              onSubmitEditing={submitPicker}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => setPickerOpen(false)}
                style={[styles.modalBtn, { backgroundColor: t.bgSurface2, borderColor: t.borderNormal }]}
              >
                <T variant="body2n" color="secondary" style={{ fontWeight: '700' }}>취소</T>
              </Pressable>
              <Pressable
                onPress={submitPicker}
                style={[styles.modalBtn, { backgroundColor: palette.purple500, borderColor: palette.purple500 }]}
              >
                <T variant="body2n" style={{ color: '#fff', fontWeight: '800' }}>이동</T>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── 보조 컴포넌트 ──────────────────────────────────────────────────── */

/** 10개를 5×2 그리드. 적중 번호는 초록 dashed ring으로 강조. */
function PickGrid({ picks, matched }: { picks: number[]; matched: Set<number> }) {
  return (
    <View style={styles.pickGrid}>
      {picks.map((n) => (
        <View key={n} style={styles.pickItem}>
          <Ball
            n={n}
            size="md"
            dashedRing={matched.has(n)}
            dashedRingColor={palette.green500}
          />
        </View>
      ))}
    </View>
  );
}

function StatBox({ label, value, suffix, muted }: { label: string; value: string; suffix?: string; muted?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.statBox, { backgroundColor: t.bgSurface2, borderColor: t.borderDivider, opacity: muted ? 0.7 : 1 }]}>
      <T variant="caption2" color="tertiary" numberOfLines={1}>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
        <T variant="title3" color="primary" style={{ fontWeight: '800' }}>{value}</T>
        {suffix && (
          <T variant="caption1" color="tertiary" style={{ marginLeft: 4 }}>{suffix}</T>
        )}
      </View>
    </View>
  );
}

function MethodRow({ methodId, nums, picks, matched }: {
  methodId: MethodId;
  nums: number[];
  picks: Set<number>;
  matched: Set<number>;
}) {
  const t = useTheme();
  const meta = METHOD_META[methodId];
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <T allowFontScaling={false} style={{ fontSize: 16 }}>{meta.emoji}</T>
        <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>{meta.label}</T>
        <T variant="caption2" color="tertiary">· {meta.short}</T>
      </View>
      {nums.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {nums.map((n) => {
            const inTop10 = picks.has(n);
            const isHit = matched.has(n);
            // 적중 > Top10 > 일반
            const bg = isHit ? 'rgba(0,191,64,0.14)'
                     : inTop10 ? 'rgba(101,65,242,0.12)'
                     : t.bgSurface2;
            const border = isHit ? palette.green500
                         : inTop10 ? palette.purple500
                         : t.borderDivider;
            const color = isHit ? palette.green700
                        : inTop10 ? palette.purple500
                        : t.fgSecondary;
            return (
              <View
                key={n}
                style={[
                  styles.methodChip,
                  { backgroundColor: bg, borderColor: border },
                ]}
              >
                <T
                  variant="caption1"
                  allowFontScaling={false}
                  style={{ color, fontWeight: inTop10 || isHit ? '800' : '600', fontSize: 12 }}
                >
                  {n}
                </T>
              </View>
            );
          })}
        </View>
      ) : (
        <T variant="caption1" color="tertiary">후보 없음</T>
      )}
    </View>
  );
}

/* ─── 색·포맷 헬퍼 ────────────────────────────────────────────────────── */

function hitBarColor(count: number): string {
  if (count === 0) return palette.neutral500;
  if (count === 1) return '#d97706';
  if (count === 2) return '#ea580c';
  if (count === 3) return palette.red500;
  if (count === 4) return palette.purple500;
  return palette.green500;
}

function hitBadgeBg(hits: number): string {
  if (hits === 0) return 'rgba(0,0,0,0.45)';
  if (hits === 1) return '#d97706';
  if (hits === 2) return '#ea580c';
  if (hits >= 3) return palette.green500;
  return 'rgba(0,0,0,0.45)';
}

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${dt.getUTCFullYear()}년 ${dt.getUTCMonth() + 1}월 ${dt.getUTCDate()}일 (${days[dt.getUTCDay()]})`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  warnBox: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },

  navRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtn: {
    width: 36, height: 32, borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  miniBtn: {
    paddingHorizontal: 12, height: 32, borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
  },

  hero: {
    borderRadius: radius.xl + 2,
    padding: 20,
  },
  hitBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  pickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    maxWidth: 280,
  },
  pickItem: {
    alignItems: 'center',
  },

  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distTrack: {
    flex: 1,
    height: 14,
    borderRadius: 4,
    overflow: 'hidden',
  },

  methodChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 30,
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
    maxWidth: 360,
    borderRadius: radius.xl,
    padding: 20,
  },
  input: {
    marginTop: 12,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
