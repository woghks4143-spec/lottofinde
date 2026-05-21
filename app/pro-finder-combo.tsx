/**
 * PRO 핀더분석 조합 — /pro-finder-combo
 *
 * PRO 모드의 번호 분석 결과를 사용자가 원하는 것만 골라서 조합 추출.
 *
 * 사용자가 토글한 분석들의 번호를 합쳐 풀을 만들고, 가중 랜덤 추출로 6개 조합.
 * (여러 분석에 동시에 나오는 번호는 자연스럽게 가중치 ↑)
 *
 * 사용 가능한 분석:
 *   - 출현 분석:  추천 TOP 10 / 임박 TOP 3 / 장기 미출현 TOP 3 / 최근 핫 TOP 3
 *   - 패턴 분석:  JH필터 1 ~ 10
 *   - 예상수 분석법: Hot / Cold / 이월수 / 이웃수 / -45 / 동일날짜 / 궁합수 / 회귀
 *   - 제외수:    예상 제외수 3개 (선택 시 풀에서 제거)
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import type { Draw } from '@/src/data/lotto';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';
import { computeAllNumberStats } from '@/src/lib/appearanceStats';
import { computeAllJhFilters } from '@/src/lib/jhFilters';
import { computeExclusionPicks } from '@/src/lib/exclusionFilter';
import { predict10, METHOD_META, type MethodId } from '@/src/lib/predict10';

const GOLD = '#e8b04e';
const GOLD_DARK = '#a37116';

const COMBO_COUNT_OPTIONS = [5, 10, 20] as const;
type ComboCount = typeof COMBO_COUNT_OPTIONS[number];

type SourceId = string;

type RecentStats = {
  min: number;
  max: number;
  avg: number;
  windowSize: number;
};

type SourceItem = {
  id: SourceId;
  label: string;
  numbers: number[];
  recent: RecentStats;
};

type SourceCategory = {
  category: string;
  emoji: string;
  items: SourceItem[];
};

type CountFilter = { min: number; max: number };

const RECENT_WINDOW = 10;

/** 현재 source의 번호들이 직전 N회차에 몇 개씩 출현했는지 통계. */
function computeRecentStats(
  sourceNums: number[],
  drawsMap: Record<number, Draw>,
  fromRound: number,
  windowSize: number = RECENT_WINDOW,
): RecentStats {
  const hits: number[] = [];
  for (let r = fromRound - 1; r >= fromRound - windowSize && r >= 1; r--) {
    const d = drawsMap[r];
    if (!d) continue;
    hits.push(sourceNums.filter((n) => d.nums.includes(n)).length);
  }
  if (hits.length === 0) return { min: 0, max: 0, avg: 0, windowSize: 0 };
  return {
    min: Math.min(...hits),
    max: Math.max(...hits),
    avg: hits.reduce((a, b) => a + b, 0) / hits.length,
    windowSize: hits.length,
  };
}

export default function ProFinderCombo() {
  const t = useTheme();
  const goBack = useSafeBack('/pro-gen');

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const earliestRound = useHistory((s) => s.earliestRound);
  const addOne = useSavedNumbers((s) => s.add);
  const addMany = useSavedNumbers((s) => s.addMany);

  const upcomingRound = latestRound + 1;
  const [round, setRound] = useState<number>(upcomingRound);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInput, setPickerInput] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<SourceId>>(new Set());
  const [excludeOn, setExcludeOn] = useState(true);
  const [comboCount, setComboCount] = useState<ComboCount>(5);
  const [generated, setGenerated] = useState<number[][]>([]);
  const [savedSet, setSavedSet] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  /** source 별 min/max 필터. 미설정 시 무제한 (min=0, max=6). */
  const [filters, setFilters] = useState<Record<SourceId, CountFilter>>({});

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  /** 1) 분석 대상 회차의 모든 사용 가능한 source 계산. */
  const sources = useMemo<{ categories: SourceCategory[]; excludePicks: number[] }>(() => {
    // 분석 기준 회차 = round, 데이터는 round 이전까지만 사용
    const dataRoundCap = round - 1; // R-1까지만 사용 (R 자체는 예측 대상)
    const safeCap = Math.min(dataRoundCap, latestRound);

    // 출현 분석 — appearanceStats 사용
    const allStats = computeAllNumberStats(drawsMap, safeCap, earliestRound, 30);
    const top10 = [...allStats]
      .sort((a, b) => b.recommendScore - a.recommendScore || a.n - b.n)
      .slice(0, 10).map((s) => s.n).sort((a, b) => a - b);
    const overdueTop3 = [...allStats].filter((s) => s.totalAppearances > 0)
      .sort((a, b) => b.overdueScore - a.overdueScore).slice(0, 3).map((s) => s.n).sort((a, b) => a - b);
    const longGapTop3 = [...allStats]
      .sort((a, b) => b.currentGap - a.currentGap).slice(0, 3).map((s) => s.n).sort((a, b) => a - b);
    const hotTop3 = [...allStats]
      .sort((a, b) => b.recentNAppearances - a.recentNAppearances || a.n - b.n)
      .slice(0, 3).map((s) => s.n).sort((a, b) => a - b);

    // 패턴 분석 — JH필터 10종
    const prev = drawsMap[safeCap] ?? null;
    const jhResults = computeAllJhFilters(prev);

    // 예상수 분석법 — predict10의 methodOutput 8종
    const pred = predict10(drawsMap, round);
    const methodIds: MethodId[] = ['hot', 'cold', 'carry', 'neighbor', 'comp45', 'sameDate', 'companion', 'regression'];

    // 예상 제외수 3개
    const history: Draw[] = [];
    for (let r = earliestRound; r <= safeCap; r++) {
      if (drawsMap[r]) history.push(drawsMap[r]);
    }
    const excludePicks = computeExclusionPicks(prev, history, 3);

    // 각 source의 통계는 직전 RECENT_WINDOW(=10)회차 기준으로 계산.
    const withStats = (id: string, label: string, nums: number[]): SourceItem => ({
      id, label, numbers: nums,
      recent: computeRecentStats(nums, drawsMap, round),
    });

    const categories: SourceCategory[] = [
      {
        category: '출현 분석',
        emoji: '🎨',
        items: [
          withStats('app-top10',   '추천 TOP 10',         top10),
          withStats('app-overdue', '출현 임박 TOP 3',     overdueTop3),
          withStats('app-longgap', '장기 미출현 TOP 3',   longGapTop3),
          withStats('app-hot',     '최근 30회 핫 TOP 3',  hotTop3),
        ],
      },
      {
        category: '패턴 분석 (JH필터)',
        emoji: '🎯',
        items: jhResults.map((r, i) =>
          withStats(`jh-${i + 1}`, r.label, r.nums),
        ),
      },
      {
        category: '예상수 분석법',
        emoji: '🌟',
        items: methodIds.map((m) =>
          withStats(`pred-${m}`, `${METHOD_META[m].emoji} ${METHOD_META[m].label}`, pred.methodOutput[m] ?? []),
        ),
      },
    ];

    return { categories, excludePicks };
  }, [round, drawsMap, latestRound, earliestRound]);

  /** 모든 source items flat 리스트 (전체 적용 핸들러용). */
  const allSourceItems = useMemo(
    () => sources.categories.flatMap((c) => c.items),
    [sources],
  );

  /** 전체 평균 적용 — 모든 source에 floor(avg)~ceil(avg) 범위 설정. */
  const applyAllAvg = () => {
    const next: Record<SourceId, CountFilter> = { ...filters };
    for (const item of allSourceItems) {
      const a = item.recent.avg;
      next[item.id] = { min: Math.floor(a), max: Math.ceil(a) };
    }
    setFilters(next);
    showToast('전체 평균값 적용 완료');
  };

  /** 전체 범위 적용 — 모든 source에 min/max 범위 설정. */
  const applyAllRange = () => {
    const next: Record<SourceId, CountFilter> = { ...filters };
    for (const item of allSourceItems) {
      next[item.id] = { min: item.recent.min, max: item.recent.max };
    }
    setFilters(next);
    showToast('전체 범위 적용 완료');
  };

  /** 개별 source 평균 적용. */
  const applyOneAvg = (item: SourceItem) => {
    const a = item.recent.avg;
    setFilters((p) => ({ ...p, [item.id]: { min: Math.floor(a), max: Math.ceil(a) } }));
  };

  /** 개별 source 범위 적용. */
  const applyOneRange = (item: SourceItem) => {
    setFilters((p) => ({ ...p, [item.id]: { min: item.recent.min, max: item.recent.max } }));
  };

  /** min/max 직접 조정 (− / + 버튼). */
  const adjustFilter = (id: SourceId, key: 'min' | 'max', delta: number, maxBound: number) => {
    setFilters((p) => {
      const cur = p[id] ?? { min: 0, max: 6 };
      let next = { ...cur };
      const val = Math.max(0, Math.min(maxBound, cur[key] + delta));
      next[key] = val;
      // min/max 일관성 유지
      if (next.min > next.max) {
        if (key === 'min') next.max = next.min;
        else next.min = next.max;
      }
      return { ...p, [id]: next };
    });
  };

  /** 2) 선택된 source들의 합집합 + 가중치. */
  const pool = useMemo(() => {
    const weights = new Map<number, number>();
    for (const cat of sources.categories) {
      for (const item of cat.items) {
        if (!selectedIds.has(item.id)) continue;
        for (const n of item.numbers) {
          weights.set(n, (weights.get(n) ?? 0) + 1);
        }
      }
    }
    // 제외수 적용
    if (excludeOn) {
      for (const n of sources.excludePicks) weights.delete(n);
    }
    return weights;
  }, [selectedIds, sources, excludeOn]);

  const poolNumbers = useMemo(
    () => [...pool.keys()].sort((a, b) => a - b),
    [pool],
  );

  /** 3) 조합 생성 — 가중 랜덤 추출 + 선택된 source의 min/max 제약 검증. */
  const generateCombos = () => {
    if (pool.size < 6) {
      showToast('풀이 6개 미만이에요. 더 많이 선택해주세요');
      return;
    }
    const entries = [...pool.entries()]; // [n, weight]
    const combos: number[][] = [];
    const seen = new Set<string>();

    // 활성 필터 — 선택된 source 중 min/max 제약이 있는 것들
    const activeFilters: { numbers: number[]; min: number; max: number }[] = [];
    for (const cat of sources.categories) {
      for (const item of cat.items) {
        if (!selectedIds.has(item.id)) continue;
        const f = filters[item.id];
        if (!f) continue;
        const maxBound = Math.min(6, item.numbers.length);
        // 무제한이 아닐 때만 검증 대상
        if (f.min > 0 || f.max < maxBound) {
          activeFilters.push({ numbers: item.numbers, min: f.min, max: f.max });
        }
      }
    }

    const MAX_ATTEMPTS = comboCount * 200;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && combos.length < comboCount; attempt++) {
      const pickPool = [...entries];
      const combo: number[] = [];
      for (let i = 0; i < 6 && pickPool.length > 0; i++) {
        const total = pickPool.reduce((sum, [, w]) => sum + w, 0);
        if (total <= 0) break;
        let r = Math.random() * total;
        let picked = 0;
        for (let j = 0; j < pickPool.length; j++) {
          r -= pickPool[j][1];
          if (r <= 0) { picked = j; break; }
        }
        combo.push(pickPool[picked][0]);
        pickPool.splice(picked, 1);
      }
      if (combo.length !== 6) continue;
      combo.sort((a, b) => a - b);

      // 필터 검증
      let satisfied = true;
      for (const f of activeFilters) {
        const hits = combo.filter((n) => f.numbers.includes(n)).length;
        if (hits < f.min || hits > f.max) {
          satisfied = false;
          break;
        }
      }
      if (!satisfied) continue;

      const key = combo.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        combos.push(combo);
      }
    }
    setGenerated(combos);
    setSavedSet({});
    if (combos.length === 0) {
      showToast('조건을 만족하는 조합 없음. 필터를 완화해 보세요');
    } else if (combos.length < comboCount) {
      showToast(`${combos.length}개만 생성됨 (필터 제약)`);
    } else {
      showToast(`${combos.length}개 조합 생성 완료`);
    }
  };

  /** 4) 토글. */
  const toggleSource = (id: SourceId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (cat: SourceCategory) => {
    const ids = cat.items.map((i) => i.id);
    const allOn = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  /** 5) 회차 점프. */
  const jumpTo = (n: number) => {
    const clamped = Math.max(earliestRound + 1, Math.min(upcomingRound, Math.round(n)));
    setRound(clamped);
    setPickerOpen(false);
    setPickerInput('');
    setGenerated([]);
    setSavedSet({});
  };
  const submitPicker = () => {
    const n = parseInt(pickerInput.replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(n)) jumpTo(n);
  };

  /** 6) 저장 핸들러. */
  const saveOne = (i: number) => {
    if (savedSet[i]) return;
    const c = generated[i];
    if (!c) return;
    const res = addOne({ nums: c, source: 'gen', round: null });
    if (res.ok) {
      setSavedSet((p) => ({ ...p, [i]: true }));
      showToast('보관함에 저장됨');
    } else if (res.reason === 'duplicate') {
      setSavedSet((p) => ({ ...p, [i]: true }));
      showToast('이미 저장된 조합');
    } else {
      showToast('보관함이 가득 찼어요');
    }
  };

  const saveAll = () => {
    const pending = generated
      .map((c, i) => ({ c, i }))
      .filter((x) => !savedSet[x.i]);
    if (pending.length === 0) return;
    const games = pending.map(({ c }) => ({ nums: c, source: 'gen' as const, round: null }));
    const res = addMany(games);
    setSavedSet((prev) => {
      const next = { ...prev };
      pending.forEach(({ i }) => { next[i] = true; });
      return next;
    });
    showToast(`${res.added}개 저장됨${res.skipped > 0 ? ` (${res.skipped}개 중복)` : ''}`);
  };

  const isUpcoming = round === upcomingRound;
  const targetDate = drawsMap[round]?.date;

  const titleNode = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon.crown color={GOLD} size={18} weight={2} />
      <T variant="heading1" color="primary">핀더분석 조합</T>
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title={titleNode} onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        {/* 회차 네비 (라이트/다크 자동 분기) */}
        <View style={[styles.heroCard, { backgroundColor: t.bgHero }]}>
          <View style={styles.targetHead}>
            <Pressable
              onPress={() => round > earliestRound + 1 && setRound(round - 1)}
              disabled={round <= earliestRound + 1}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: t.bgOnHeroPill,
                opacity: round <= earliestRound + 1 ? 0.3 : pressed ? 0.6 : 1,
              }]}
            >
              <T variant="label1n" style={{ color: t.fgOnHero, fontWeight: '800' }} allowFontScaling={false}>‹</T>
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              {isUpcoming ? (
                <View style={styles.upcomingPill}>
                  <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 10.5, fontWeight: '800' }}>
                    🔮 추첨 예정
                  </T>
                </View>
              ) : (
                <T variant="caption1" style={{ color: t.fgOnHeroMuted }}>분석 대상</T>
              )}
              <T variant="title2" style={{ color: t.fgOnHero, fontWeight: '900', marginTop: 4 }}>
                제 {round}회
              </T>
              <T variant="caption1" style={{ color: t.fgOnHeroFaint, marginTop: 2 }}>
                {targetDate ? targetDate : '예정'}{isUpcoming ? ' (예정)' : ''}
              </T>
            </View>
            <Pressable
              onPress={() => round < upcomingRound && setRound(round + 1)}
              disabled={round >= upcomingRound}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: t.bgOnHeroPill,
                opacity: round >= upcomingRound ? 0.3 : pressed ? 0.6 : 1,
              }]}
            >
              <T variant="label1n" style={{ color: t.fgOnHero, fontWeight: '800' }} allowFontScaling={false}>›</T>
            </Pressable>
          </View>
        </View>

        {/* 빠른 점프 */}
        <View style={styles.jumpRow}>
          <JumpBtn label={`최신 ${latestRound}회`} active={round === latestRound} onPress={() => setRound(latestRound)} />
          <JumpBtn label={`분석 ${upcomingRound}회`} active={isUpcoming} onPress={() => setRound(upcomingRound)} tone="upcoming" />
          <JumpBtn label="회차 입력" active={false} onPress={() => { setPickerInput(String(round)); setPickerOpen(true); }} tone="input" />
        </View>

        {/* 안내 */}
        <View style={[styles.tipCard, { backgroundColor: t.bgSurface2, borderColor: t.borderWeak }]}>
          <T allowFontScaling={false} style={{ fontSize: 16, marginRight: 8 }}>💡</T>
          <T variant="caption1" color="secondary" style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
            원하는 분석 결과를 골라 선택하면, 그 번호들로 조합을 만들어요. 여러 분석에 함께 나오는 번호는 자동으로 가중치가 올라가요.
          </T>
        </View>

        {/* 선택된 풀 미리보기 */}
        <Card padding={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
              🎱 선택된 풀
            </T>
            <T variant="caption1" color="tertiary" style={{ fontSize: 11.5 }}>
              {pool.size}개
            </T>
            <View style={{ flex: 1 }} />
            {excludeOn && sources.excludePicks.length > 0 && (
              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, color: palette.red500, fontWeight: '700' }}>
                제외수 {sources.excludePicks.length}개 적용
              </T>
            )}
          </View>
          {pool.size === 0 ? (
            <T variant="caption1" color="tertiary" style={{ fontSize: 11.5, marginTop: 8, fontStyle: 'italic' }}>
              아래에서 분석을 선택해 주세요
            </T>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              {poolNumbers.map((n) => {
                const w = pool.get(n) ?? 1;
                return (
                  <View key={n} style={{ position: 'relative' }}>
                    <Ball n={n} size="sm" />
                    {w > 1 && (
                      <View style={styles.weightBadge}>
                        <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>
                          ×{w}
                        </T>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {/* 빠른 필터 적용 — 모든 분석에 통계 기반 자동 설정 */}
        <Card padding={12}>
          <T variant="caption1" color="primary" allowFontScaling={false} style={{ fontSize: 12, fontWeight: '700' }}>
            ⚡ 빠른 필터 적용
          </T>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, marginTop: 2 }}>
            최근 {RECENT_WINDOW}회 통계 기반으로 모든 분석에 자동 설정
          </T>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            <Pressable
              onPress={applyAllAvg}
              style={({ pressed }) => [
                styles.bulkBtn,
                { backgroundColor: 'rgba(232,176,78,0.15)', borderColor: GOLD, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <T variant="caption1" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 12 }}>
                전체 평균값 적용
              </T>
            </Pressable>
            <Pressable
              onPress={applyAllRange}
              style={({ pressed }) => [
                styles.bulkBtn,
                { backgroundColor: 'rgba(0,102,255,0.10)', borderColor: palette.blue500, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <T variant="caption1" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '800', fontSize: 12 }}>
                전체 범위 적용
              </T>
            </Pressable>
          </View>
        </Card>

        {/* 카테고리별 분석 선택 */}
        {sources.categories.map((cat) => {
          const ids = cat.items.map((i) => i.id);
          const onCount = ids.filter((id) => selectedIds.has(id)).length;
          const allOn = onCount === ids.length;
          return (
            <Card key={cat.category} padding={14}>
              <Pressable onPress={() => toggleCategory(cat)} style={styles.catHeader}>
                <T allowFontScaling={false} style={{ fontSize: 16 }}>{cat.emoji}</T>
                <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                  {cat.category}
                </T>
                <T variant="caption1" color="tertiary" allowFontScaling={false} style={{ fontSize: 11 }}>
                  {onCount}/{ids.length}
                </T>
                <View style={{ flex: 1 }} />
                <View style={[styles.miniBtn, { backgroundColor: allOn ? palette.red500 : palette.blue500 }]}>
                  <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                    {allOn ? '전체 해제' : '전체 선택'}
                  </T>
                </View>
              </Pressable>
              <View style={{ gap: 6, marginTop: 10 }}>
                {cat.items.map((item) => (
                  <SourceToggle
                    key={item.id}
                    item={item}
                    selected={selectedIds.has(item.id)}
                    filter={filters[item.id]}
                    onToggle={() => toggleSource(item.id)}
                    onAdjust={(key, delta, max) => adjustFilter(item.id, key, delta, max)}
                    onApplyAvg={() => applyOneAvg(item)}
                    onApplyRange={() => applyOneRange(item)}
                  />
                ))}
              </View>
            </Card>
          );
        })}

        {/* 예상 제외수 토글 */}
        <Card padding={14}>
          <View style={styles.catHeader}>
            <T allowFontScaling={false} style={{ fontSize: 16 }}>🚫</T>
            <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
              예상 제외수
            </T>
            <View style={{ flex: 1 }} />
          </View>
          <Pressable
            onPress={() => setExcludeOn(!excludeOn)}
            style={({ pressed }) => [
              styles.sourceRow,
              {
                backgroundColor: excludeOn ? 'rgba(248,72,79,0.10)' : t.bgSurface2,
                borderColor: excludeOn ? palette.red500 : t.borderDivider,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={[styles.checkbox, excludeOn && { backgroundColor: palette.red500, borderColor: palette.red500 }]}>
              {excludeOn && <Icon.check color="#fff" size={10} weight={3} />}
            </View>
            <View style={{ flex: 1 }}>
              <T variant="caption1" color="primary" style={{ fontWeight: '700', fontSize: 12 }}>
                예상 제외수 3개 적용 (풀에서 제거)
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                {sources.excludePicks.length === 0 ? (
                  <T variant="caption2" color="tertiary" style={{ fontSize: 10, fontStyle: 'italic' }}>
                    데이터 부족
                  </T>
                ) : (
                  sources.excludePicks.map((n) => <Ball key={n} n={n} size="xs" />)
                )}
              </View>
            </View>
          </Pressable>
        </Card>

        {/* 조합 수 선택 */}
        <View style={styles.countRow}>
          <T variant="caption1" color="secondary" allowFontScaling={false} style={{ fontSize: 12, fontWeight: '700', marginRight: 8 }}>
            조합 수
          </T>
          {COMBO_COUNT_OPTIONS.map((n) => {
            const on = comboCount === n;
            return (
              <Pressable
                key={n}
                onPress={() => setComboCount(n)}
                style={({ pressed }) => [
                  styles.countBtn,
                  {
                    backgroundColor: on ? palette.blue500 : t.bgSurface,
                    borderColor: on ? 'transparent' : t.borderWeak,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <T variant="caption1" allowFontScaling={false} style={{ color: on ? '#fff' : t.fgSecondary, fontWeight: '800' }}>
                  {n}개
                </T>
              </Pressable>
            );
          })}
        </View>

        {/* 조합 만들기 버튼 */}
        <Pressable
          onPress={generateCombos}
          disabled={pool.size < 6}
          style={({ pressed }) => [
            styles.generateBtn,
            {
              backgroundColor: pool.size < 6 ? '#aaa' : GOLD,
              opacity: pool.size < 6 ? 0.6 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Icon.sparkle color="#fff" size={16} weight={2.5} />
          <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', marginLeft: 6, fontSize: 14 }}>
            {pool.size < 6 ? `풀 ${pool.size}개 (6개 이상 필요)` : `${comboCount}개 조합 만들기`}
          </T>
        </Pressable>

        {/* 결과 */}
        {generated.length > 0 && (() => {
          const savedCount = Object.values(savedSet).filter(Boolean).length;
          const allSaved = savedCount === generated.length;
          return (
            <Card padding={14}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                  ✨ 추천 조합 {generated.length}개
                </T>
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={generateCombos}
                  style={({ pressed }) => [
                    styles.refreshBtn,
                    { borderColor: GOLD, backgroundColor: t.bgSurface, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <T allowFontScaling={false} style={{ fontSize: 12, marginRight: 4 }}>🔄</T>
                  <T variant="caption1" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 11 }}>
                    다시
                  </T>
                </Pressable>
                <Pressable
                  onPress={saveAll}
                  disabled={allSaved}
                  style={({ pressed }) => [
                    styles.saveAllBtn,
                    {
                      backgroundColor: allSaved ? palette.green500 : GOLD,
                      opacity: pressed && !allSaved ? 0.85 : 1,
                    },
                  ]}
                >
                  <Icon.check color="#fff" size={12} weight={2.8} />
                  <T variant="caption1" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 11, marginLeft: 4 }}>
                    {allSaved ? '저장 완료' : '모두 저장'}
                  </T>
                </Pressable>
              </View>

              <View style={{ marginTop: 12, gap: 8 }}>
                {generated.map((c, i) => (
                  <View key={i} style={[styles.comboRow, { backgroundColor: t.bgSurface2, borderColor: t.borderDivider }]}>
                    <View style={styles.labelBox}>
                      <T variant="caption2" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 11 }}>
                        #{i + 1}
                      </T>
                    </View>
                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {c.map((n) => <Ball key={n} n={n} size="sm" />)}
                    </View>
                    <Pressable
                      onPress={() => saveOne(i)}
                      disabled={savedSet[i]}
                      style={({ pressed }) => [
                        styles.saveDot,
                        {
                          backgroundColor: savedSet[i] ? palette.green500 : 'rgba(232,176,78,0.18)',
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      {savedSet[i]
                        ? <Icon.check color="#fff" size={12} weight={3} />
                        : <Icon.plus color={GOLD_DARK} size={12} weight={2.5} />}
                    </Pressable>
                  </View>
                ))}
              </View>
            </Card>
          );
        })()}

        <Disclaimer short />
      </ScrollView>

      {/* 회차 점프 모달 */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)} />
        <View style={styles.modalWrap} pointerEvents="box-none">
          <View style={[styles.modalSheet, { backgroundColor: t.bgSurface }]}>
            <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>회차로 이동</T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
              {earliestRound + 1}회 ~ {upcomingRound}회
            </T>
            <View style={[styles.pickerRow, { borderColor: t.borderNormal, backgroundColor: t.bgSurface2 }]}>
              <TextInput
                value={pickerInput}
                onChangeText={(v) => setPickerInput(v.replace(/[^0-9]/g, '').slice(0, 5))}
                onSubmitEditing={submitPicker}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder={`회차 수 입력 (예: ${latestRound})`}
                placeholderTextColor={t.fgTertiary}
                style={[styles.pickerInput, { color: t.fgPrimary }]}
                returnKeyType="go"
              />
              <Pressable
                onPress={submitPicker}
                style={({ pressed }) => [styles.goBtn, { backgroundColor: palette.blue500, opacity: pressed ? 0.85 : 1 }]}
              >
                <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800' }}>이동</T>
              </Pressable>
            </View>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={6} style={{ marginTop: 12, alignSelf: 'center' }}>
              <T variant="caption1" color="tertiary" style={{ fontWeight: '600' }}>취소</T>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 토스트 */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: t.bgInverse }]} pointerEvents="none">
          <T variant="label1n" style={{ color: t.bgCanvas, fontWeight: '700' }} allowFontScaling={false}>
            {toast}
          </T>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ─── SourceToggle 행 ────────────────────────────────── */
function SourceToggle({
  item, selected, filter, onToggle, onAdjust, onApplyAvg, onApplyRange,
}: {
  item: SourceItem;
  selected: boolean;
  filter: CountFilter | undefined;
  onToggle: () => void;
  onAdjust: (key: 'min' | 'max', delta: number, maxBound: number) => void;
  onApplyAvg: () => void;
  onApplyRange: () => void;
}) {
  const t = useTheme();
  const maxBound = Math.min(6, item.numbers.length);
  const cur = filter ?? { min: 0, max: maxBound };

  return (
    <View
      style={[
        styles.sourceRow,
        {
          backgroundColor: selected ? 'rgba(0,102,255,0.08)' : t.bgSurface2,
          borderColor: selected ? palette.blue500 : t.borderDivider,
        },
      ]}
    >
      {/* 헤더: 체크박스 + 라벨 + 미리보기 */}
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={[styles.checkbox, selected && { backgroundColor: palette.blue500, borderColor: palette.blue500 }]}>
          {selected && <Icon.check color="#fff" size={10} weight={3} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T variant="caption1" color="primary" style={{ fontWeight: '700', fontSize: 12 }}>
              {item.label}
            </T>
            <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10 }}>
              {item.numbers.length}개
            </T>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
            {item.numbers.length === 0 ? (
              <T variant="caption2" color="tertiary" style={{ fontSize: 10, fontStyle: 'italic' }}>
                데이터 부족
              </T>
            ) : (
              item.numbers.slice(0, 12).map((n) => <Ball key={n} n={n} size="xs" />)
            )}
            {item.numbers.length > 12 && (
              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 9, alignSelf: 'center' }}>
                +{item.numbers.length - 12}
              </T>
            )}
          </View>
        </View>
      </Pressable>

      {/* 통계 + 필터 (항상 표시) */}
      {item.numbers.length > 0 && item.recent.windowSize > 0 && (
        <View style={[styles.statsBlock, { borderTopColor: t.borderDivider }]}>
          {/* 통계 line */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <T allowFontScaling={false} style={{ fontSize: 10 }}>📊</T>
            <T variant="caption2" color="secondary" allowFontScaling={false} style={{ fontSize: 10, fontWeight: '700' }}>
              최근 {item.recent.windowSize}회: {item.recent.min}~{item.recent.max}개 · 평균 {item.recent.avg.toFixed(1)}개
            </T>
          </View>

          {/* 필터 (선택됐을 때만) */}
          {selected && (
            <View style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <T variant="caption2" color="primary" allowFontScaling={false} style={{ fontSize: 10.5, fontWeight: '700' }}>
                  포함:
                </T>
                <View style={styles.stepperRow}>
                  <Pressable onPress={() => onAdjust('min', -1, maxBound)} style={styles.stepperBtn}>
                    <T variant="caption1" allowFontScaling={false} style={{ color: t.fgPrimary, fontWeight: '900', fontSize: 14 }}>−</T>
                  </Pressable>
                  <T variant="caption1" allowFontScaling={false} style={{ minWidth: 16, textAlign: 'center', color: t.fgPrimary, fontWeight: '800', fontSize: 12 }}>
                    {cur.min}
                  </T>
                  <Pressable onPress={() => onAdjust('min', +1, maxBound)} style={styles.stepperBtn}>
                    <T variant="caption1" allowFontScaling={false} style={{ color: t.fgPrimary, fontWeight: '900', fontSize: 14 }}>+</T>
                  </Pressable>
                </View>
                <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10 }}>~</T>
                <View style={styles.stepperRow}>
                  <Pressable onPress={() => onAdjust('max', -1, maxBound)} style={styles.stepperBtn}>
                    <T variant="caption1" allowFontScaling={false} style={{ color: t.fgPrimary, fontWeight: '900', fontSize: 14 }}>−</T>
                  </Pressable>
                  <T variant="caption1" allowFontScaling={false} style={{ minWidth: 16, textAlign: 'center', color: t.fgPrimary, fontWeight: '800', fontSize: 12 }}>
                    {cur.max}
                  </T>
                  <Pressable onPress={() => onAdjust('max', +1, maxBound)} style={styles.stepperBtn}>
                    <T variant="caption1" allowFontScaling={false} style={{ color: t.fgPrimary, fontWeight: '900', fontSize: 14 }}>+</T>
                  </Pressable>
                </View>
                <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10 }}>개</T>
              </View>

              {/* 빠른 적용 버튼 */}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                <Pressable
                  onPress={onApplyAvg}
                  style={({ pressed }) => [styles.applyMiniBtn, { backgroundColor: 'rgba(232,176,78,0.18)', borderColor: GOLD, opacity: pressed ? 0.8 : 1 }]}
                >
                  <T variant="caption2" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 10 }}>
                    평균 적용
                  </T>
                </Pressable>
                <Pressable
                  onPress={onApplyRange}
                  style={({ pressed }) => [styles.applyMiniBtn, { backgroundColor: 'rgba(0,102,255,0.10)', borderColor: palette.blue500, opacity: pressed ? 0.8 : 1 }]}
                >
                  <T variant="caption2" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '800', fontSize: 10 }}>
                    범위 적용
                  </T>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/* ─── JumpBtn ────────────────────────────────────────── */
function JumpBtn({ label, active, onPress, tone }: {
  label: string; active: boolean; onPress: () => void;
  tone?: 'upcoming' | 'input';
}) {
  const t = useTheme();
  const activeBg = tone === 'upcoming' ? palette.purple500 : palette.blue500;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.jumpBtn, {
        backgroundColor: active ? activeBg : t.bgSurface,
        borderColor: active ? 'transparent' : t.borderWeak,
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <T variant="caption1" style={{ color: active ? '#fff' : t.fgSecondary, fontWeight: '700' }} allowFontScaling={false}>
        {label}
      </T>
    </Pressable>
  );
}

/* ─── Styles ─────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },

  heroCard: { borderRadius: radius.xl, padding: 14 },
  targetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navArrow: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  upcomingPill: {
    backgroundColor: palette.purple500,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99,
  },

  jumpRow: { flexDirection: 'row', gap: 6 },
  jumpBtn: {
    flex: 1, height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },

  weightBadge: {
    position: 'absolute',
    top: -4, right: -4,
    backgroundColor: palette.red500,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },

  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  sourceRow: {
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  checkbox: {
    width: 20, height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(127,127,127,0.4)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },

  statsBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.25)',
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.06)',
  },
  applyMiniBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  bulkBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },

  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countBtn: {
    flex: 1, height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.pill,
    shadowColor: GOLD,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  saveAllBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  comboRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  labelBox: {
    width: 32, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  saveDot: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // 모달
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    width: '100%', maxWidth: 380,
    borderRadius: radius.xl,
    padding: 20,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
    marginTop: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  pickerInput: {
    flex: 1, fontSize: 16, fontWeight: '700',
    paddingVertical: 8,
    outlineStyle: 'none' as any,
  },
  goBtn: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },

  toast: {
    position: 'absolute',
    bottom: 80, alignSelf: 'center',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: radius.pill,
  },
});
