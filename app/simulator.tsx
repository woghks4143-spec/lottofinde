/**
 * 시뮬레이터 — Expert 룰 빌더.
 *
 * Phase 'edit'에서 NumPicker(포함/제외) + 합/끝수합/AC RangeRow + 홀짝/연속수/
 * 동행수 ToggleRow를 받아 룰 객체를 만든다. 사용자가 조건을 바꿀 때마다
 * `countOrSample('count')`를 300ms 디바운스로 재실행해 미리보기 카운트를
 * 갱신. "100개 생성" 누르면 reservoir로 100개 샘플 추출 후 Phase 'results'.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar, IconBtn } from '@/src/components/AppBar';
import { BallRow } from '@/src/components/BallRow';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { NumPicker } from '@/src/components/NumPicker';
import { RangeRow } from '@/src/components/RangeRow';
import { ToggleRow } from '@/src/components/ToggleRow';
import { useHistory } from '@/src/data/historyStore';
import { useRules, defaultRule, migrateRule, ALL_RATIOS, type Rule, type Ratio } from '@/src/store/rules';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { countOrSample, ruleToFilter } from '@/src/lib/simulator';
import { ac, highLowLabel, longestConsecutive, oddEvenLabel, tailSum, total } from '@/src/data/lotto';
import { saveCsv, toCsv } from '@/src/lib/csv';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

type Phase = 'edit' | 'results';

const HARD_CAP = 1_000_000;

/** 연속수: "가장 긴 연속 묶음 길이" multi-select 옵션. */
const LONGEST_RUN_OPTIONS: { id: number; label: string }[] = [
  { id: 1, label: '연속 없음' },
  { id: 2, label: '2연속' },
  { id: 3, label: '3연속' },
  { id: 4, label: '4연속' },
  { id: 5, label: '5연속' },
  { id: 6, label: '6연속' },
];

/** 이월수 정확한 개수 multi-select 옵션. */
const CARRY_OPTIONS: { id: number; label: string }[] = [
  { id: 0, label: '0개' },
  { id: 1, label: '1개' },
  { id: 2, label: '2개' },
  { id: 3, label: '3개' },
  { id: 4, label: '4개' },
  { id: 5, label: '5개' },
  { id: 6, label: '6개' },
];

/** 숫자 옵션 배열을 multi-select 칩으로 표시. 빈 배열 = 자유. */
function MultiPickCard({
  title, subtitle, options, selected, onToggle, onClear, emptyHint,
}: {
  title: string;
  subtitle: string;
  options: { id: number; label: string }[];
  selected: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  emptyHint: string;
}) {
  const t = useTheme();
  const isFree = selected.length === 0;
  return (
    <Card padding={14}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{title}</T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>{subtitle}</T>
        </View>
        {!isFree && (
          <Pressable onPress={onClear} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <T variant="caption1" style={{ color: palette.blue700, fontWeight: '700' }}>전체 해제</T>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {options.map((opt) => {
          const on = selected.includes(opt.id);
          return (
            <Pressable
              key={opt.id}
              onPress={() => onToggle(opt.id)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 12,
                  height: 34,
                  borderRadius: 999,
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? t.bgAccent : t.bgSurface,
                  borderColor: on ? 'transparent' : t.borderWeak,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <T
                variant="caption1"
                style={{ color: on ? '#fff' : t.fgSecondary, fontWeight: '600' }}
                allowFontScaling={false}
              >
                {opt.label}
              </T>
            </Pressable>
          );
        })}
      </View>
      {isFree && (
        <T variant="caption2" color="tertiary" style={{ marginTop: 8, fontStyle: 'italic' }}>
          {emptyHint}
        </T>
      )}
    </Card>
  );
}

/** 7개 비율 칩(0:6~6:0)을 multi-select로 표시. 빈 배열 = 자유. */
function RatioCard({
  title, subtitle, allowed, onToggle, onClear,
}: {
  title: string;
  subtitle: string;
  allowed: Ratio[];
  onToggle: (r: Ratio) => void;
  onClear: () => void;
}) {
  const t = useTheme();
  const isFree = allowed.length === 0;
  return (
    <Card padding={14}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>{title}</T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>{subtitle}</T>
        </View>
        {!isFree && (
          <Pressable onPress={onClear} hitSlop={8} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <T variant="caption1" style={{ color: palette.blue700, fontWeight: '700' }}>전체 해제</T>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {ALL_RATIOS.map((r) => {
          const on = allowed.includes(r);
          return (
            <Pressable
              key={r}
              onPress={() => onToggle(r)}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 12,
                  height: 34,
                  borderRadius: 999,
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? t.bgAccent : t.bgSurface,
                  borderColor: on ? 'transparent' : t.borderWeak,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <T
                variant="caption1"
                style={{ color: on ? '#fff' : t.fgSecondary, fontWeight: '600' }}
                allowFontScaling={false}
              >
                {r}
              </T>
            </Pressable>
          );
        })}
      </View>
      {isFree && (
        <T variant="caption2" color="tertiary" style={{ marginTop: 8, fontStyle: 'italic' }}>
          선택된 비율이 없어요 — 모든 비율을 허용합니다.
        </T>
      )}
    </Card>
  );
}

export default function Simulator() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/analysis');
  const params = useLocalSearchParams<{ ruleId?: string }>();
  const allRules = useRules((s) => s.rules);
  const getRule = useRules((s) => s.get);
  const addRule = useRules((s) => s.add);
  const updateRule = useRules((s) => s.update);
  const removeRule = useRules((s) => s.remove);
  const touchRule = useRules((s) => s.touchUsed);
  const addSaved = useSavedNumbers((s) => s.add);
  const latestDraw = useHistory((s) => s.getLatest());

  const initial = useMemo<Rule>(() => {
    if (params.ruleId) {
      const r = getRule(params.ruleId);
      if (r) return migrateRule(r); // 옛 enum → 새 배열 형식
    }
    return { id: 'draft', createdAt: 0, updatedAt: 0, lastUsedAt: null, ...defaultRule() };
  }, [params.ruleId, getRule]);

  const [rule, setRule] = useState<Rule>(initial);
  const [phase, setPhase] = useState<Phase>('edit');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [truncated, setTruncated] = useState(false);
  const [savedSet, setSavedSet] = useState<Record<number, boolean>>({});
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState(rule.name);
  const [showRuleList, setShowRuleList] = useState(false);

  /** 저장된 룰을 시뮬레이터에 로드. 자동 마이그레이션 적용. */
  const loadRule = useCallback((id: string) => {
    const r = getRule(id);
    if (!r) return;
    setRule(migrateRule(r));
    touchRule(id);
    setShowRuleList(false);
    setPhase('edit');
  }, [getRule, touchRule]);

  const deleteRule = useCallback((id: string) => {
    removeRule(id);
  }, [removeRule]);

  const set = useCallback((patch: Partial<Rule>) => setRule((r) => ({ ...r, ...patch })), []);

  /** 비율 칩 토글 — 이미 있으면 제거, 없으면 추가. 빈 배열 = 자유(전체 허용). */
  const toggleRatio = useCallback((field: 'oddEvenAllow' | 'highLowAllow', ratio: Ratio) => {
    setRule((r) => {
      const cur = r[field] ?? [];
      const next = cur.includes(ratio) ? cur.filter((x) => x !== ratio) : [...cur, ratio];
      // 정해진 순서로 정렬해 보기 좋게
      next.sort((a, b) => ALL_RATIOS.indexOf(a) - ALL_RATIOS.indexOf(b));
      return { ...r, [field]: next };
    });
  }, []);

  const clearRatio = useCallback((field: 'oddEvenAllow' | 'highLowAllow') => {
    setRule((r) => ({ ...r, [field]: [] }));
  }, []);

  /** 숫자 옵션 multi-select 토글. 정렬 유지. */
  const toggleNumOpt = useCallback((field: 'longestRunAllow' | 'carryOverAllow', n: number) => {
    setRule((r) => {
      const cur = r[field] ?? [];
      const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n];
      next.sort((a, b) => a - b);
      return { ...r, [field]: next };
    });
  }, []);
  const clearNumOpt = useCallback((field: 'longestRunAllow' | 'carryOverAllow') => {
    setRule((r) => ({ ...r, [field]: [] }));
  }, []);

  /**
   * "평균치 자동 적용" — 역대 당첨번호의 가장 흔한 분포를 한 번에 적용.
   * 포함/제외(사용자 선택)는 건드리지 않고, 통계 조건만 채운다.
   *
   * 기준 (6/45 역대 분포):
   *   합 100~175, 끝수합 14~33, AC 7~10
   *   홀짝·저고: 3:3, 4:2, 2:4 (역대 가장 흔한 3가지)
   *   연속수: 1(없음), 2(2연속)만 허용
   *   이월수: 0, 1개 (평균 ~1개)
   */
  const applyAverages = useCallback(() => {
    setRule((r) => ({
      ...r,
      sumMin: 100, sumMax: 175,
      tailSumMin: 14, tailSumMax: 33,
      acMin: 7, acMax: 10,
      oddEvenAllow: ['3:3', '4:2', '2:4'],
      highLowAllow: ['3:3', '4:2', '2:4'],
      longestRunAllow: [1, 2],
      carryOverAllow: [0, 1],
    }));
  }, []);

  // Debounced count preview
  // ⚠️ Race condition 방지: 사용자가 빠르게 옵션을 누르면 여러 countOrSample이
  // 병렬로 실행될 수 있다. 각 실행에 token을 부여하고 끝났을 때 자신이 마지막
  // 실행인지 확인해서, 늦게 끝난 옛 결과가 새 결과를 덮어쓰지 않도록 한다.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);
  useEffect(() => {
    if (phase !== 'edit') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const myId = ++runIdRef.current;
      setCalculating(true);
      try {
        const filter = ruleToFilter(rule, latestDraw);
        const res = await countOrSample(filter, 'count', 0);
        if (myId !== runIdRef.current) return; // 더 새로운 실행이 진행 중이면 무시
        setPreviewCount(res.count);
        setTruncated(res.truncated);
      } finally {
        if (myId === runIdRef.current) setCalculating(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rule, latestDraw, phase]);

  const onNumTap = (n: number) => {
    const isIn = rule.include.includes(n);
    const isOut = rule.exclude.includes(n);
    // tri-state: neutral → include → exclude → neutral
    if (!isIn && !isOut) set({ include: [...rule.include, n].sort((a, b) => a - b) });
    else if (isIn) set({
      include: rule.include.filter((x) => x !== n),
      exclude: [...rule.exclude, n].sort((a, b) => a - b),
    });
    else set({ exclude: rule.exclude.filter((x) => x !== n) });
  };

  const generate = async () => {
    setCalculating(true);
    try {
      const filter = ruleToFilter(rule, latestDraw);
      const res = await countOrSample(filter, 'sample', 100);
      setSamples(res.samples);
      setTruncated(res.truncated);
      setPhase('results');
      setSavedSet({});
    } finally {
      setCalculating(false);
    }
  };

  const saveSample = (i: number) => {
    const nums = samples[i];
    if (!nums) return;
    const res = addSaved({ nums, round: null, source: 'simulator' });
    if (res.ok) setSavedSet((s) => ({ ...s, [i]: true }));
  };

  const saveAllAsRule = () => {
    setSaveName(rule.name || '새 룰');
    setShowSave(true);
  };

  /** 항상 새 룰로 추가. 기존 ID가 있어도 별도 항목으로. */
  const saveAsNew = () => {
    const r = addRule({ ...rule, name: saveName || '새 룰' });
    setRule(r); // 다음 "업데이트" 액션을 위해 현재 작업 룰을 새로 만든 룰로 변경
    setShowSave(false);
  };
  /** 현재 작업 중인 (로드된) 룰을 그 자리에 덮어쓰기. */
  const updateExisting = () => {
    if (rule.id === 'draft' || !getRule(rule.id)) {
      saveAsNew();
      return;
    }
    updateRule(rule.id, { ...rule, name: saveName });
    touchRule(rule.id);
    setShowSave(false);
  };
  const isExistingRule = rule.id !== 'draft' && !!getRule(rule.id);

  const exportSamples = async () => {
    if (samples.length === 0) return;
    const rows = samples.map((nums, i) => ({
      idx: i + 1,
      n1: nums[0], n2: nums[1], n3: nums[2], n4: nums[3], n5: nums[4], n6: nums[5],
      sum: total(nums), tail_sum: tailSum(nums),
      odd_even: oddEvenLabel(nums), ac: ac(nums),
      max_consec: longestConsecutive(nums),
    }));
    await saveCsv(`simulator-${Date.now()}.csv`, toCsv(rows));
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={phase === 'edit' ? '시뮬레이터' : '시뮬레이터 결과'}
        onBack={phase === 'results' ? () => setPhase('edit') : goBack}
        trailing={
          phase === 'edit' ? (
            <View style={{ flexDirection: 'row' }}>
              <IconBtn onPress={() => setShowRuleList(true)}>
                <Icon.rules color={t.fgSecondary} />
              </IconBtn>
              <IconBtn onPress={saveAllAsRule}>
                <Icon.download color={t.fgSecondary} />
              </IconBtn>
            </View>
          ) : (
            <IconBtn onPress={exportSamples}><Icon.download color={t.fgSecondary} /></IconBtn>
          )
        }
      />
      {phase === 'edit' ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
          {/* Rule name card */}
          <Card padding={14}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T variant="caption1" color="tertiary">룰 이름</T>
              <Pressable onPress={() => setShowRuleList(true)} hitSlop={6}>
                <T variant="caption1" style={{ color: palette.blue700, fontWeight: '700' }}>
                  📋 저장된 룰{allRules.length > 0 ? ` (${allRules.length})` : ''}
                </T>
              </Pressable>
            </View>
            <TextInput
              value={rule.name}
              onChangeText={(name) => set({ name })}
              placeholder="끝수합 110~140"
              placeholderTextColor={t.fgTertiary}
              style={[styles.input, { color: t.fgPrimary }]}
            />
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              <Chip label={`포함 ${rule.include.length}`} tone={rule.include.length > 0 ? 'accent' : 'neutral'} />
              <Chip label={`제외 ${rule.exclude.length}`} tone={rule.exclude.length > 0 ? 'danger' : 'neutral'} />
            </View>
          </Card>

          {/* 평균치 자동 적용 — 한 번에 통계 평균 조건 채워 넣기 */}
          <Pressable
            onPress={applyAverages}
            style={({ pressed }) => [
              styles.autoCard,
              { backgroundColor: palette.green700, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <View style={styles.autoIcon}>
              <T allowFontScaling={false} style={{ fontSize: 22 }}>✨</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="label1n" style={{ color: '#fff', fontWeight: '800' }}>
                평균치 자동 적용
              </T>
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.8)', marginTop: 2, lineHeight: 16 }}>
                역대 당첨 통계의 평균 패턴(합·AC·홀짝·저고·연속수·이월) 한 번에 적용
              </T>
            </View>
            <Icon.chev color="rgba(255,255,255,0.9)" />
          </Pressable>

          {/* Number picker tri-state */}
          <Card padding={14}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>포함 / 제외</T>
              <T variant="caption1" color="tertiary">1탭 포함 · 2탭 제외 · 3탭 해제</T>
            </View>
            <NumPicker
              mode="triState"
              include={rule.include}
              exclude={rule.exclude}
              onToggle={onNumTap}
            />
          </Card>

          {/* Range sliders */}
          <Card padding={14}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 8 }}>수치 범위</T>
            <RangeRow
              label="총합"
              min={21} max={255}
              value={[rule.sumMin, rule.sumMax]}
              onChange={([lo, hi]) => set({ sumMin: lo, sumMax: hi })}
            />
            <RangeRow
              label="끝수합"
              min={6} max={45}
              value={[rule.tailSumMin, rule.tailSumMax]}
              onChange={([lo, hi]) => set({ tailSumMin: lo, tailSumMax: hi })}
            />
            <RangeRow
              label="AC값"
              min={0} max={10}
              value={[rule.acMin, rule.acMax]}
              onChange={([lo, hi]) => set({ acMin: lo, acMax: hi })}
            />
          </Card>

          {/* Odd/even ratio — multi-select */}
          <RatioCard
            title="홀짝 비율"
            subtitle="원하는 홀:짝 비율 모두 선택 (선택 없음 = 자유)"
            allowed={rule.oddEvenAllow ?? []}
            onToggle={(r) => toggleRatio('oddEvenAllow', r)}
            onClear={() => clearRatio('oddEvenAllow')}
          />

          {/* High/low ratio — multi-select */}
          <RatioCard
            title="저고 비율"
            subtitle="저 1~22 · 고 23~45 · 원하는 비율 모두 선택"
            allowed={rule.highLowAllow ?? []}
            onToggle={(r) => toggleRatio('highLowAllow', r)}
            onClear={() => clearRatio('highLowAllow')}
          />

          {/* Consecutive — multi-select: 가장 긴 연속 묶음 길이 */}
          <MultiPickCard
            title="연속수"
            subtitle="가장 긴 연속 묶음의 길이가 선택한 것 중 하나"
            options={LONGEST_RUN_OPTIONS}
            selected={rule.longestRunAllow ?? []}
            onToggle={(n) => toggleNumOpt('longestRunAllow', n)}
            onClear={() => clearNumOpt('longestRunAllow')}
            emptyHint="선택된 길이가 없어요 — 모든 연속수 패턴을 허용합니다."
          />

          {/* Carry over — multi-select */}
          <MultiPickCard
            title="직전 회차 이월수"
            subtitle="직전 회차 본번호+보너스와 겹치는 개수 (정확히)"
            options={CARRY_OPTIONS}
            selected={rule.carryOverAllow ?? []}
            onToggle={(n) => toggleNumOpt('carryOverAllow', n)}
            onClear={() => clearNumOpt('carryOverAllow')}
            emptyHint="선택된 개수가 없어요 — 어떤 이월수든 허용합니다."
          />

          <Disclaimer />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}>
          <Card padding={16} style={{ backgroundColor: palette.purple500 }}>
            <T variant="caption1" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {truncated
                ? '후보가 100만+개라 일부만 카운트됨'
                : `총 ${(previewCount ?? 0).toLocaleString()}개 후보 중`}
            </T>
            <T variant="title2" style={{ color: '#fff', fontWeight: '800', marginTop: 4 }}>
              {samples.length}개 샘플
            </T>
            {truncated && (
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                조건을 좁히면 더 정밀한 분포에서 추출돼요.
              </T>
            )}
          </Card>
          {samples.map((nums, i) => (
            <Card key={i} padding={12}>
              <View style={styles.sampleRow}>
                <T variant="caption2" color="tertiary" style={{ minWidth: 24 }}>{i + 1}</T>
                <View style={{ flex: 1 }}>
                  <BallRow nums={nums} size="sm" />
                  <T variant="caption2" color="tertiary" style={{ marginTop: 4 }}>
                    합 {total(nums)} · 끝수 {tailSum(nums)} · AC {ac(nums)} · 홀짝 {oddEvenLabel(nums)} · 저고 {highLowLabel(nums)}
                  </T>
                </View>
                <Pressable
                  onPress={() => saveSample(i)}
                  disabled={savedSet[i]}
                  style={({ pressed }) => [
                    styles.saveDot,
                    {
                      backgroundColor: savedSet[i] ? palette.green500 : t.bgAccentSoft,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {savedSet[i]
                    ? <Icon.check color="#fff" size={14} weight={3} />
                    : <Icon.plus color={palette.blue700} size={14} weight={2.5} />}
                </Pressable>
              </View>
            </Card>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button title="다시 100개" variant="outline" onPress={generate} />
            <View style={{ flex: 1 }}>
              <Button title="전체 CSV 내보내기" variant="dark" full onPress={exportSamples} />
            </View>
          </View>
          <Disclaimer />
        </ScrollView>
      )}

      {/* Bottom action bar (edit phase) */}
      {phase === 'edit' && (
        <View style={[styles.bottomBar, { backgroundColor: t.bgSurface, borderTopColor: t.borderDivider }]}>
          {truncated && !calculating && (
            <T variant="caption1" style={{ color: palette.red500, marginBottom: 6, textAlign: 'center', fontWeight: '600' }}>
              ⚠️ 후보가 너무 많아요 (100만+개). 조건을 추가해 좁혀 보세요.
            </T>
          )}
          {previewCount === 0 && !calculating && !truncated && (
            <T variant="caption1" style={{ color: palette.red500, marginBottom: 6, textAlign: 'center', fontWeight: '600', lineHeight: 17 }}>
              💡 두 조건이 서로 어긋나는 것 같아요. 한두 개를 풀어 보세요.
            </T>
          )}
          <Button
            title={
              calculating
                ? '계산 중…'
                : previewCount == null
                ? '조건 검토 중'
                : previewCount === 0
                ? '조건에 맞는 조합이 없어요'
                : truncated
                ? '그대로 100개 추출하기'
                : `${previewCount.toLocaleString()}개 중 100개 생성`
            }
            variant="primary"
            size="lg"
            full
            disabled={calculating || (previewCount ?? 0) === 0}
            onPress={generate}
          />
        </View>
      )}

      {/* Load-rule modal — 저장된 룰 목록에서 선택 */}
      {showRuleList && (
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowRuleList(false)} />
          <Card padding={0} style={{ width: '100%', maxWidth: 420, maxHeight: '80%' }}>
            <View style={{ padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.borderDivider }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>저장된 룰</T>
                <Pressable onPress={() => setShowRuleList(false)} hitSlop={8}>
                  <Icon.close color={t.fgSecondary} />
                </Pressable>
              </View>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
                선택하면 시뮬레이터에 불러와요
              </T>
            </View>
            {allRules.length === 0 ? (
              <View style={{ padding: 28, alignItems: 'center', gap: 8 }}>
                <T allowFontScaling={false} style={{ fontSize: 36 }}>📋</T>
                <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>저장된 룰이 없어요</T>
                <T variant="caption1" color="tertiary" style={{ textAlign: 'center' }}>
                  현재 조건을 우측 상단 ⬇ 아이콘으로 저장해 두면{'\n'}여기서 다시 꺼내 쓸 수 있어요.
                </T>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
                {allRules.map((r) => (
                  <View key={r.id} style={[styles.ruleListItem, { borderColor: t.borderWeak, backgroundColor: t.bgSurface2 }]}>
                    <Pressable onPress={() => loadRule(r.id)} style={{ flex: 1 }}>
                      <T variant="label1n" color="primary" style={{ fontWeight: '700' }} numberOfLines={1}>
                        {r.name || '이름 없음'}
                      </T>
                      <T variant="caption2" color="tertiary" style={{ marginTop: 2, fontSize: 11 }}>
                        {r.lastUsedAt
                          ? `${formatRelativeDate(r.lastUsedAt)} 사용`
                          : `${formatRelativeDate(r.createdAt)} 생성`}
                      </T>
                    </Pressable>
                    <Pressable
                      onPress={() => deleteRule(r.id)}
                      hitSlop={8}
                      style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                    >
                      <Icon.close color={t.fgTertiary} size={18} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </Card>
        </View>
      )}

      {/* Save-rule modal (basic, no native modal — overlay) */}
      {showSave && (
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSave(false)} />
          <Card padding={20} style={{ width: '100%', maxWidth: 360 }}>
            <T variant="heading2" color="primary" style={{ marginBottom: 8 }}>룰 저장</T>
            <TextInput
              value={saveName}
              onChangeText={setSaveName}
              placeholder="끝수합 110~140"
              placeholderTextColor={t.fgTertiary}
              style={[styles.input, { color: t.fgPrimary, marginTop: 8 }]}
            />
            {isExistingRule ? (
              <>
                <T variant="caption1" color="tertiary" style={{ marginTop: 14, marginBottom: 4 }}>
                  현재 작업 중인 룰을 어떻게 할까요?
                </T>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button title="새 룰로 추가" variant="outline" full onPress={saveAsNew} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="이 룰 덮어쓰기" variant="primary" full onPress={updateExisting} />
                  </View>
                </View>
                <Pressable onPress={() => setShowSave(false)} hitSlop={6} style={{ marginTop: 10, alignSelf: 'center' }}>
                  <T variant="caption1" color="tertiary" style={{ fontWeight: '600' }}>취소</T>
                </Pressable>
              </>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <Button title="취소" variant="outline" onPress={() => setShowSave(false)} />
                <View style={{ flex: 1 }}>
                  <Button title="저장" variant="primary" full onPress={saveAsNew} />
                </View>
              </View>
            )}
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  input: {
    height: 44,
    paddingHorizontal: 0,
    fontSize: 17,
    marginTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(112,115,124,0.22)',
  },
  oeBtn: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.xl,
  },
  autoIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  sampleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveDot: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    inset: 0 as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  ruleListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});

function formatRelativeDate(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 86400000);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 30) return `${diff}일 전`;
  if (diff < 365) return `${Math.floor(diff / 30)}개월 전`;
  return `${Math.floor(diff / 365)}년 전`;
}
