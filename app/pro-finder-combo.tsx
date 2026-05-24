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
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { CombinationCard } from '@/src/components/CombinationCard';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import type { Draw } from '@/src/data/lotto';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { useTheme } from '@/src/design/theme';
import { ballColor, palette, radius } from '@/src/design/tokens';
import { computeAllNumberStats } from '@/src/lib/appearanceStats';
import { computeAllJhFilters } from '@/src/lib/jhFilters';
import { computeExclusionPicks } from '@/src/lib/exclusionFilter';
import { predict10, METHOD_META, type MethodId } from '@/src/lib/predict10';

const GOLD = '#e8b04e';
const GOLD_DARK = '#a37116';
// 번호 선택 3-mode 색 (조합 필터링과 동일)
const POOL_COLOR = palette.blue500;
const FIXED_COLOR = '#7c3aed';
const EXCLUDE_COLOR = palette.red500;

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
  // 제외수는 기본 OFF — 사용자가 명시적으로 선택해야 풀에서 제거됨.
  const [excludeOn, setExcludeOn] = useState(false);

  // 사용자가 직접 고르는 번호 — 조합 필터링과 동일한 3-mode (예상수/고정수/제외수)
  // 예상수 비어있으면 1~45 전체가 풀.
  const [filterPool, setFilterPool] = useState<number[]>([]);
  const [filterFixed, setFilterFixed] = useState<number[]>([]);
  const [filterExclude, setFilterExclude] = useState<number[]>([]);
  const [numberMode, setNumberMode] = useState<'pool' | 'fixed' | 'exclude'>('pool');
  const [comboCount, setComboCount] = useState<ComboCount>(5);
  const [generated, setGenerated] = useState<number[][]>([]);
  // 한 번이라도 generateCombos를 호출했는지 — 0개여도 결과 카드 표시 여부 판단.
  const [hasAttempted, setHasAttempted] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
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

  /** 모든 분석 선택/해제 토글 — 한 번에 모든 source를 켜거나 끔. */
  const toggleAllSources = () => {
    if (selectedIds.size === allSourceItems.length) {
      setSelectedIds(new Set());
      showToast('모든 분석 선택 해제');
    } else {
      setSelectedIds(new Set(allSourceItems.map((it) => it.id)));
      showToast('모든 분석 선택 완료');
    }
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

  /**
   * 2) 풀 계산 — 사용자가 직접 선택한 예상수/고정수/제외수 기반.
   *
   *   - 예상수가 있으면: 그 안에서만 추출 (조합 필터링과 동일)
   *   - 예상수 비어있으면: 1~45 전체
   *   - 고정수는 풀에 항상 포함 (없어도 추가)
   *   - 제외수와 (excludeOn일 때) 분석 제외수는 풀에서 제거
   *
   * 분석은 더 이상 풀에 합쳐지지 않고, 아래 generateCombos에서 필터(min/max) 역할만.
   */
  const pool = useMemo(() => {
    // base = 예상수 또는 1~45
    const nums = new Set<number>(
      filterPool.length > 0 ? filterPool : Array.from({ length: 45 }, (_, i) => i + 1),
    );
    // 고정수는 항상 포함
    for (const n of filterFixed) nums.add(n);
    // 제외수 빼기
    for (const n of filterExclude) nums.delete(n);
    if (excludeOn) {
      for (const n of sources.excludePicks) nums.delete(n);
    }
    return nums;
  }, [filterPool, filterFixed, filterExclude, excludeOn, sources.excludePicks]);

  const poolNumbers = useMemo(
    () => [...pool].sort((a, b) => a - b),
    [pool],
  );

  /** 3) 조합 생성 — 가중 랜덤 추출 + 선택된 source의 min/max 제약 검증. */
  const generateCombos = () => {
    setHasAttempted(true);
    setSavedSet({});

    // 고정수 검증 — 풀에 들어있어야 함 (제외수와 충돌하면 풀에서 빠짐)
    const validFixed = filterFixed.filter((n) => pool.has(n));
    if (validFixed.length > 6) {
      setGenerated([]);
      setLastError(`고정수가 ${validFixed.length}개로 6개를 초과합니다. 일부 고정수를 해제해주세요.`);
      showToast('고정수가 6개를 초과해요');
      return;
    }
    if (validFixed.length !== filterFixed.length) {
      const conflict = filterFixed.filter((n) => !pool.has(n));
      setGenerated([]);
      setLastError(`고정수 ${conflict.join(', ')}이(가) 제외수와 충돌해요. 충돌을 해소해주세요.`);
      showToast('고정수와 제외수 충돌');
      return;
    }
    if (pool.size < 6) {
      setGenerated([]);
      setLastError(`풀이 ${pool.size}개에요. 예상수를 줄이거나 제외수를 해제해서 6개 이상으로 만들어주세요.`);
      showToast('풀이 6개 미만');
      return;
    }

    // 활성 필터 — 선택된 분석 중 min/max 제약이 있는 것들 (필터 역할)
    //   "이 분석의 번호가 결과 조합에 min~max개 포함되어야 한다"
    const activeFilters: { label: string; numbers: number[]; min: number; max: number }[] = [];
    for (const cat of sources.categories) {
      for (const item of cat.items) {
        if (!selectedIds.has(item.id)) continue;
        const f = filters[item.id];
        if (!f) continue;
        const maxBound = Math.min(6, item.numbers.length);
        if (f.min > 0 || f.max < maxBound) {
          activeFilters.push({ label: item.label, numbers: item.numbers, min: f.min, max: f.max });
        }
      }
    }

    // 사전 가능성 검사
    const minSum = activeFilters.reduce((s, f) => s + f.min, 0);
    if (minSum > 6) {
      setGenerated([]);
      setLastError(`활성 필터의 최소 개수 합이 ${minSum}개로 6개를 초과합니다. 일부 필터의 최소값을 낮추거나 분석을 줄여주세요.`);
      showToast('필터 조건이 너무 엄격해요');
      return;
    }
    // 고정수가 활성 필터의 min/max를 이미 위반하면 추출 불가
    for (const f of activeFilters) {
      const fixedHits = validFixed.filter((n) => f.numbers.includes(n)).length;
      if (fixedHits > f.max) {
        setGenerated([]);
        setLastError(`고정수가 "${f.label}" 필터의 최대값(${f.max}개)을 이미 초과했어요. 고정수를 줄이거나 필터의 최대값을 늘려주세요.`);
        showToast('고정수가 필터 최대 초과');
        return;
      }
    }

    // 추출 — 풀에서 (6 - 고정수.length)개를 uniform random pick
    const needsRandom = 6 - validFixed.length;
    const restPool = [...pool].filter((n) => !validFixed.includes(n));
    if (needsRandom > 0 && restPool.length < needsRandom) {
      setGenerated([]);
      setLastError(`고정수 ${validFixed.length}개 + 풀에 남은 ${restPool.length}개로는 6개 조합을 만들 수 없어요.`);
      showToast('풀 부족');
      return;
    }

    const combos: number[][] = [];
    const seen = new Set<string>();
    const MAX_ATTEMPTS = Math.min(50000, Math.max(2000, comboCount * 1000));
    for (let attempt = 0; attempt < MAX_ATTEMPTS && combos.length < comboCount; attempt++) {
      // uniform random 픽 — Fisher-Yates 부분 셔플
      const candidates = [...restPool];
      for (let i = 0; i < needsRandom; i++) {
        const j = i + Math.floor(Math.random() * (candidates.length - i));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const combo = [...validFixed, ...candidates.slice(0, needsRandom)].sort((a, b) => a - b);

      // 활성 필터 검증 (고정수까지 포함된 최종 조합 기준)
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
    if (combos.length === 0) {
      setLastError(
        `${MAX_ATTEMPTS.toLocaleString()}번 시도했지만 모든 활성 필터(${activeFilters.length}개)를 동시에 만족하는 6개 조합을 찾지 못했어요. 필터를 완화하거나 분석 선택을 줄여보세요.`,
      );
      showToast('조건을 만족하는 조합 없음');
    } else if (combos.length < comboCount) {
      setLastError(`목표 ${comboCount}개 중 ${combos.length}개만 찾았어요. 더 많이 만들려면 필터를 완화하세요.`);
      showToast(`${combos.length}개만 생성됨 (필터 제약)`);
    } else {
      setLastError(null);
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
  const targetDraw = drawsMap[round];
  const targetDate = targetDraw?.date;

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
        {/* 분석 대상 hero — 일반모드 "분석법 비교" 디자인과 통일 */}
        <View style={[styles.heroCard, { backgroundColor: t.bgHero }]}>
          <View style={styles.targetHead}>
            <Pressable
              onPress={() => round > earliestRound + 1 && setRound(round - 1)}
              disabled={round <= earliestRound + 1}
              style={({ pressed }) => [styles.navArrow, {
                backgroundColor: t.bgOnHeroPill,
                opacity: round <= earliestRound + 1 ? 0.3 : pressed ? 0.7 : 1,
              }]}
            >
              <Icon.chevLeft color={t.fgOnHero} size={20} weight={2.5} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              {isUpcoming ? (
                <View style={styles.upcomingPill}>
                  <T variant="caption2" style={{ color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 }} allowFontScaling={false}>
                    🔮 추첨 예정
                  </T>
                </View>
              ) : (
                <T variant="caption1" style={{ color: t.fgOnHeroMuted }}>분석 대상</T>
              )}
              <T variant="title3" style={{ color: t.fgOnHero, fontWeight: '800', marginTop: 4 }}>
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
                opacity: round >= upcomingRound ? 0.3 : pressed ? 0.7 : 1,
              }]}
            >
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <Icon.chevLeft color={t.fgOnHero} size={20} weight={2.5} />
              </View>
            </Pressable>
          </View>
          <View style={{ marginTop: 14, alignItems: 'center' }}>
            {isUpcoming || !targetDraw ? (
              <View style={[styles.upcomingNumsBox, { backgroundColor: t.bgOnHeroPill, borderColor: t.borderOnHero }]}>
                <T variant="label1n" style={{ color: t.fgOnHero, textAlign: 'center', fontWeight: '700' }}>
                  당첨번호 발표 전
                </T>
              </View>
            ) : (
              <BallRow nums={targetDraw.nums} bonus={targetDraw.bonus} size="sm" style={{ gap: 4 }} />
            )}
          </View>
        </View>

        {/* 빠른 점프 */}
        <View style={styles.jumpRow}>
          <JumpBtn label={`최신 ${latestRound}회`} active={round === latestRound} onPress={() => setRound(latestRound)} />
          <JumpBtn label={`분석 ${upcomingRound}회`} active={isUpcoming} onPress={() => setRound(upcomingRound)} tone="upcoming" />
          <JumpBtn label="회차 입력" active={false} onPress={() => { setPickerInput(String(round)); setPickerOpen(true); }} tone="input" />
        </View>

        {/* 안내 — 새 모델 설명 */}
        <View style={[styles.tipCard, { backgroundColor: t.bgSurface2, borderColor: t.borderWeak }]}>
          <T allowFontScaling={false} style={{ fontSize: 16, marginRight: 8 }}>💡</T>
          <T variant="caption1" color="secondary" style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
            ① 1~45 중 예상수를 고르고 (비우면 전체), ② 분석을 선택해 "이 분석 번호가 N~M개 포함" 필터로 활용하면 조합이 추출돼요.
          </T>
        </View>

        {/* ① 번호 선택 — 예상수/고정수/제외수 (조합 필터링과 동일한 7x7) */}
        <Card padding={14}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
              🎯 번호 선택
            </T>
            <T variant="caption1" color="tertiary" allowFontScaling={false} style={{ fontSize: 11 }}>
              비우면 1~45 전체
            </T>
          </View>
          <View style={[styles.modeBar, { backgroundColor: t.bgSurface2, borderColor: t.borderDivider }]}>
            <NumModeBtn label="예상수" count={filterPool.length} active={numberMode === 'pool'} color={POOL_COLOR} onPress={() => setNumberMode('pool')} t={t} />
            <NumModeBtn label="고정수" count={filterFixed.length} active={numberMode === 'fixed'} color={FIXED_COLOR} onPress={() => setNumberMode('fixed')} t={t} />
            <NumModeBtn label="제외수" count={filterExclude.length} active={numberMode === 'exclude'} color={EXCLUDE_COLOR} onPress={() => setNumberMode('exclude')} t={t} />
          </View>
          <View style={[styles.hintBox, { backgroundColor: hintBg(numberMode), borderColor: hintBorder(numberMode) }]}>
            <T variant="caption1" allowFontScaling={false} style={{ color: hintFg(numberMode), fontWeight: '700', lineHeight: 17, fontSize: 12 }}>
              {numberMode === 'pool'    && '🎯 예상수 · 선택한 번호들 중에서만 조합이 추출됩니다 (비우면 1~45 전체)'}
              {numberMode === 'fixed'   && '📌 고정수 · 모든 조합에 무조건 포함됩니다 (6개 미만 권장)'}
              {numberMode === 'exclude' && '🚫 제외수 · 모든 조합에서 제외됩니다'}
            </T>
          </View>
          <NumberTriGrid
            pool={filterPool} fixed={filterFixed} exclude={filterExclude}
            mode={numberMode}
            onTap={(n) => {
              const currentState =
                filterPool.includes(n) ? 'pool' :
                filterFixed.includes(n) ? 'fixed' :
                filterExclude.includes(n) ? 'exclude' : null;
              // 같은 모드에 있는 번호 다시 누르면 해제
              if (currentState === numberMode) {
                if (numberMode === 'pool')    setFilterPool((p) => p.filter((x) => x !== n));
                if (numberMode === 'fixed')   setFilterFixed((p) => p.filter((x) => x !== n));
                if (numberMode === 'exclude') setFilterExclude((p) => p.filter((x) => x !== n));
                return;
              }
              // 다른 모드에 있던 번호는 그 모드에서 제거 후 현재 모드에 추가
              if (currentState === 'pool')    setFilterPool((p) => p.filter((x) => x !== n));
              if (currentState === 'fixed')   setFilterFixed((p) => p.filter((x) => x !== n));
              if (currentState === 'exclude') setFilterExclude((p) => p.filter((x) => x !== n));
              if (numberMode === 'pool')    setFilterPool((p) => [...p, n].sort((a, b) => a - b));
              if (numberMode === 'fixed')   setFilterFixed((p) => [...p, n].sort((a, b) => a - b));
              if (numberMode === 'exclude') setFilterExclude((p) => [...p, n].sort((a, b) => a - b));
            }}
            t={t}
          />
          <View style={styles.summaryRow}>
            <NumSummaryPill label="예상수" count={filterPool.length} color={POOL_COLOR} />
            <NumSummaryPill label="고정수" count={filterFixed.length} color={FIXED_COLOR} />
            <NumSummaryPill label="제외수" count={filterExclude.length} color={EXCLUDE_COLOR} />
            {(filterPool.length + filterFixed.length + filterExclude.length) > 0 && (
              <Pressable
                onPress={() => { setFilterPool([]); setFilterFixed([]); setFilterExclude([]); }}
                hitSlop={6}
                style={{ paddingHorizontal: 8 }}
              >
                <T variant="caption1" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '800' }}>
                  전체 해제
                </T>
              </Pressable>
            )}
          </View>
        </Card>

        {/* ② 추출 풀 미리보기 — 최종 풀 (예상수 ± 제외수 ± 분석 제외수) */}
        <Card padding={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
              🎱 추출 풀
            </T>
            <T variant="caption1" color="tertiary" style={{ fontSize: 11.5 }}>
              {pool.size}개
            </T>
            <View style={{ flex: 1 }} />
            {excludeOn && sources.excludePicks.length > 0 && (
              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, color: palette.red500, fontWeight: '700' }}>
                분석 제외수 적용
              </T>
            )}
          </View>
          {pool.size === 0 ? (
            <T variant="caption1" color="tertiary" style={{ fontSize: 11.5, marginTop: 8, fontStyle: 'italic' }}>
              예상수를 줄이거나 제외수를 해제해서 풀을 6개 이상으로 만들어주세요
            </T>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              {poolNumbers.map((n) => {
                const isFixed = filterFixed.includes(n);
                return (
                  <View key={n} style={{ position: 'relative' }}>
                    <Ball n={n} size="sm" />
                    {isFixed && (
                      <View style={styles.weightBadge}>
                        <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>
                          📌
                        </T>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {/* 빠른 필터 적용 — 모든 분석 선택 + 통계 기반 자동 설정 */}
        <Card padding={12}>
          <T variant="caption1" color="primary" allowFontScaling={false} style={{ fontSize: 12, fontWeight: '700' }}>
            ⚡ 빠른 필터 적용
          </T>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, marginTop: 2 }}>
            최근 {RECENT_WINDOW}회 통계 기반으로 모든 분석에 자동 설정
          </T>
          {/* 1행: 모든 분석 선택 (전체 폭) */}
          <Pressable
            onPress={toggleAllSources}
            style={({ pressed }) => [
              styles.bulkBtn,
              {
                backgroundColor: selectedIds.size === allSourceItems.length
                  ? 'rgba(248,72,79,0.10)'
                  : 'rgba(101,65,242,0.10)',
                borderColor: selectedIds.size === allSourceItems.length
                  ? palette.red500
                  : palette.purple500,
                marginTop: 10,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <T
              variant="caption1"
              allowFontScaling={false}
              style={{
                color: selectedIds.size === allSourceItems.length ? palette.red500 : palette.purple500,
                fontWeight: '800',
                fontSize: 12,
              }}
            >
              {selectedIds.size === allSourceItems.length
                ? `✓ 모두 선택됨 (${selectedIds.size}개) — 탭하면 해제`
                : `🎯 모든 분석 선택 (${allSourceItems.length}개)`}
            </T>
          </Pressable>
          {/* 2행: 통계 자동 적용 (평균 / 범위) */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
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
                // SourceToggle과 동일하게 row 레이아웃 — 체크박스가 왼쪽, 라벨이 오른쪽
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
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

        {/* 결과 — 한 번이라도 시도했으면 항상 표시 (0개여도 빈 상태 안내) */}
        {hasAttempted && (() => {
          const savedCount = Object.values(savedSet).filter(Boolean).length;
          const allSaved = generated.length > 0 && savedCount === generated.length;
          const isEmpty = generated.length === 0;
          return (
            <Card padding={16}>
              {/* 제목 + 부제 */}
              <View>
                <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                  {isEmpty ? '⚠️ 추천 조합 0개' : `✨ 추천 조합 ${generated.length}개`}
                </T>
                <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                  {isEmpty
                    ? '조건을 만족하는 조합을 찾지 못했어요'
                    : savedCount > 0
                      ? `${savedCount} / ${generated.length} 저장됨 · 모든 조합 보관함 저장 가능`
                      : '선택한 분석 풀 기반 · 가중 랜덤 추출'}
                </T>
              </View>

              {/* 빈 상태 — 명확한 안내 메시지 박스 */}
              {isEmpty && lastError && (
                <View style={[styles.emptyHint, { backgroundColor: 'rgba(248,72,79,0.08)', borderColor: palette.red500 }]}>
                  <T allowFontScaling={false} style={{ fontSize: 16, marginRight: 8 }}>💡</T>
                  <T variant="caption1" color="primary" style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
                    {lastError}
                  </T>
                </View>
              )}

              {/* 액션 버튼 묶음 — 다시 추출 + 모두 저장 (1:1 분할) */}
              <View style={styles.recActions}>
                <Pressable
                  onPress={generateCombos}
                  style={({ pressed }) => [
                    styles.refreshBtn,
                    { borderColor: GOLD, backgroundColor: t.bgSurface, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <T allowFontScaling={false} style={{ fontSize: 13, marginRight: 4 }}>🔄</T>
                  <T variant="caption1" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 12 }}>
                    다시 추출
                  </T>
                </Pressable>
                <Pressable
                  onPress={saveAll}
                  disabled={allSaved || isEmpty}
                  style={({ pressed }) => [
                    styles.saveAllBtn,
                    {
                      backgroundColor: isEmpty ? '#aaa' : allSaved ? palette.green500 : GOLD,
                      opacity: (isEmpty || allSaved) ? 0.6 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Icon.check color="#fff" size={13} weight={2.8} />
                  <T variant="caption1" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 12, marginLeft: 5 }}>
                    {isEmpty ? '저장 불가' : allSaved ? '저장 완료' : '모두 저장'}
                  </T>
                </Pressable>
              </View>

              {!isEmpty && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  {generated.map((c, i) => (
                    <CombinationCard
                      key={i}
                      nums={c}
                      label={`#${i + 1}`}
                      saved={!!savedSet[i]}
                      onSave={() => saveOne(i)}
                    />
                  ))}
                </View>
              )}
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

/* ─── 번호 선택 helper들 (조합 필터링과 동일한 디자인) ──────── */
function NumModeBtn({ label, count, active, color, onPress, t }: {
  label: string; count: number; active: boolean; color: string;
  onPress: () => void; t: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeBtn,
        {
          backgroundColor: active ? color : 'transparent',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <T variant="caption1" allowFontScaling={false} style={{ color: active ? '#fff' : t.fgSecondary, fontWeight: '800', fontSize: 12 }}>
        {label}
      </T>
      <View style={[styles.modeCountBubble, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : t.bgSurface }]}>
        <T variant="caption2" allowFontScaling={false} style={{ color: active ? '#fff' : t.fgTertiary, fontSize: 10, fontWeight: '800' }}>
          {count}
        </T>
      </View>
    </Pressable>
  );
}

function NumSummaryPill({ label, count, color }: { label: string; count: number; color: string }) {
  const on = count > 0;
  return (
    <View style={[styles.summaryPill, { backgroundColor: on ? color : 'rgba(150,150,150,0.15)' }]}>
      <T variant="caption2" allowFontScaling={false} style={{ color: on ? '#fff' : '#888', fontWeight: '800', fontSize: 11 }}>
        {label} {count}
      </T>
    </View>
  );
}

function NumberTriGrid({ pool, fixed, exclude, mode, onTap, t }: {
  pool: number[]; fixed: number[]; exclude: number[];
  mode: 'pool' | 'fixed' | 'exclude';
  onTap: (n: number) => void;
  t: ReturnType<typeof useTheme>;
}) {
  const NUM_COLS = 7;
  const NUM_GAP = 6;
  const [gridW, setGridW] = useState(0);
  const cellSize = gridW > 0 ? Math.floor((gridW - (NUM_COLS - 1) * NUM_GAP) / NUM_COLS) : 38;
  return (
    <View
      style={styles.triGrid}
      onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
    >
      {Array.from({ length: NUM_COLS * NUM_COLS }, (_, i) => i + 1).map((n) => {
        if (n > 45) {
          return <View key={n} style={[styles.cellEmpty, { width: cellSize, height: cellSize }]} />;
        }
        const s = pool.includes(n) ? 'pool' : fixed.includes(n) ? 'fixed' : exclude.includes(n) ? 'exclude' : null;
        const bg = s === 'pool' ? POOL_COLOR : s === 'fixed' ? FIXED_COLOR : s === 'exclude' ? EXCLUDE_COLOR : t.bgSurface;
        const fg = s ? '#fff' : t.fgSecondary;
        const ring = !s ? ballColor(n) : undefined;
        return (
          <Pressable
            key={n}
            onPress={() => onTap(n)}
            style={({ pressed }) => [
              styles.triCell,
              {
                width: cellSize, height: cellSize,
                backgroundColor: bg,
                borderColor: s ? 'transparent' : t.borderWeak,
                borderWidth: s ? 0 : 1,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {ring && <View pointerEvents="none" style={[styles.triDot, { backgroundColor: ring }]} />}
            <T
              variant="label1n"
              allowFontScaling={false}
              style={{
                color: fg, fontWeight: '800',
                fontSize: Math.max(12, Math.min(15, cellSize * 0.36)),
                textDecorationLine: s === 'exclude' ? 'line-through' : 'none',
              }}
            >
              {n}
            </T>
            {s === 'fixed' && (
              <View pointerEvents="none" style={styles.triFixedPin}>
                <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>📌</T>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function hintBg(m: 'pool' | 'fixed' | 'exclude'): string {
  if (m === 'pool')  return 'rgba(0,102,255,0.08)';
  if (m === 'fixed') return 'rgba(124,58,237,0.08)';
  return 'rgba(248,72,79,0.08)';
}
function hintBorder(m: 'pool' | 'fixed' | 'exclude'): string {
  if (m === 'pool')  return 'rgba(0,102,255,0.30)';
  if (m === 'fixed') return 'rgba(124,58,237,0.30)';
  return 'rgba(248,72,79,0.30)';
}
function hintFg(m: 'pool' | 'fixed' | 'exclude'): string {
  if (m === 'pool')  return palette.blue700;
  if (m === 'fixed') return FIXED_COLOR;
  return palette.red500;
}

/* ─── Styles ─────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1 },

  heroCard: { borderRadius: radius.xl, padding: 18 },
  targetHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // 회차 이동 버튼 — 둥근 사각형 + Icon.chevLeft (일반모드 분석법 비교와 동일)
  navArrow: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  upcomingPill: {
    backgroundColor: palette.purple500,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99,
  },
  // "당첨번호 발표 전" 박스 — 예정 회차 또는 데이터 없을 때
  upcomingNumsBox: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    width: '100%',
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

  // 결과 카드 액션 행 — 다시 추출 + 모두 저장을 1:1 분할로 크게
  recActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  // 번호 선택 3-mode UI (조합 필터링과 동일)
  modeBar: {
    flexDirection: 'row',
    marginTop: 10,
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: radius.sm,
  },
  modeCountBubble: {
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 99,
    minWidth: 18, alignItems: 'center',
  },
  hintBox: { marginTop: 10, padding: 10, borderRadius: radius.md, borderWidth: 1 },
  triGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 6, marginTop: 12,
    justifyContent: 'center',
  },
  triCell: {
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  cellEmpty: { backgroundColor: 'transparent', opacity: 0 },
  triDot: {
    position: 'absolute', top: 4, right: 4,
    width: 6, height: 6, borderRadius: 3, opacity: 0.7,
  },
  triFixedPin: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8, backgroundColor: GOLD,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    marginTop: 14, alignItems: 'center',
  },
  summaryPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },

  // 빈 결과 안내 박스 — "왜 조합이 안 나오는지" 명확히 설명
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    marginTop: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  refreshBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  saveAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
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
