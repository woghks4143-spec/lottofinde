/**
 * PRO 조합 필터링 — /pro-filter
 *
 * 23가지 필터를 5그룹으로 묶어 정밀하게 조합을 추출하는 PRO 전용 도구.
 *
 *   ① 번호 (3종)        — 예상수 / 고정수 / 제외수
 *   ② 합계·비율 (5종)    — 합 / 끝수합 / 홀짝 / 저고 / AC
 *   ③ 연속·끝수 (4종)    — 연번 패턴 / 같은 끝수 / 한 구간 최대 / 모서리
 *   ④ 수학 속성 (7종)    — 소수 / 합성수 / 동형수 / 제곱수 / 3·4·5의 배수
 *   ⑤ 회차 관계 (4종)   — 이월수 / 이웃수 / -45 / 회귀 1
 *
 * 모든 multi-select 필터는 "체크된 옵션만 허용". 비우면 = 자유.
 * 풀-기반 직접 샘플링 + 다른 필터 rejection 방식으로 효율적 추출.
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { RangeRow } from '@/src/components/RangeRow';
import { useHistory } from '@/src/data/historyStore';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { ac, longestConsecutive, oddEvenLabel, tailSum, total } from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { ballColor, palette, radius } from '@/src/design/tokens';

// ─── 색 토큰 ─────────────────────────────────────────────────
const GOLD = '#e8b04e';
const GOLD_SOFT = '#fff4dc';
const GOLD_DARK = '#a37116';
const POOL_COLOR = palette.blue500;
const FIXED_COLOR = '#7c3aed';
const EXCLUDE_COLOR = palette.red500;

// ─── 수학 속성 상수 셋 ──────────────────────────────────────
const PRIME = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]);
const TWIN = new Set([11, 22, 33, 44]);            // 두 자리 같은 수
const SQUARE = new Set([1, 4, 9, 16, 25, 36]);     // 제곱수
const MULT3 = new Set([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45]);
const MULT4 = new Set([4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44]);
const MULT5 = new Set([5, 10, 15, 20, 25, 30, 35, 40, 45]);
const CORNER = new Set([1,2,8,9,6,7,13,14,29,30,36,37,43,44,45,34,35,41,42]);

function isComposite(n: number): boolean {
  // 1은 소수도 합성수도 아님. 2 이상의 소수가 아닌 수.
  if (n < 4) return false;
  return !PRIME.has(n);
}

// ─── 필터 타입 ───────────────────────────────────────────────
type NumberMode = 'pool' | 'fixed' | 'exclude';

type Filter = {
  // 번호
  pool: number[];
  fixed: number[];
  exclude: number[];

  // 합계 (range)
  sumMin: number; sumMax: number;
  tailMin: number; tailMax: number;

  // 비율
  oddAllow: string[];      // '0:6' ~ '6:0'
  lowAllow: string[];
  acAllow: number[];       // 0~10 multi-select

  // 패턴 (string code multi-select)
  sameTailAllow: string[]; // 'none','2','3','2+2','3+2',...
  consecAllow: string[];

  // 끝수 — 0~9 (n % 10)
  poolTails: number[];     // 풀 끝수 — 체크한 끝수에서만 추출 (비우면 자유)
  requiredTails: number[]; // 고정 끝수 — 체크한 각 끝수가 1개 이상 반드시 포함

  // 위치 패턴
  // 5개 구간(단번대~40번대)의 개수 multi-select. 비우면 자유, "0개" 체크 = 그 구간 제외
  decade0Allow: number[];   // 단번대 (1~9) 개수
  decade1Allow: number[];   // 10번대 (10~19)
  decade2Allow: number[];   // 20번대 (20~29)
  decade3Allow: number[];   // 30번대 (30~39)
  decade4Allow: number[];   // 40번대 (40~45)
  excludeGoongs: number[];  // 제외할 궁 [1~9]
  includeGoongs: number[];  // 필수 포함 궁 [1~9] (체크한 궁마다 1개 이상)
  segMax: number;           // 한 구간 최대 (1~6) — 빠른 글로벌 캡
  cornerMatch: number;      // -1 = 미사용

  // 수학 속성 (0~6 multi-select counts)
  primeAllow: number[];
  compositeAllow: number[];
  twinAllow: number[];
  squareAllow: number[];
  mult3Allow: number[];
  mult4Allow: number[];
  mult5Allow: number[];

  // 회차 관계 (multi-select counts)
  carryAllow: number[];
  neighborAllow: number[];
  comp45Allow: number[];
};

const ALL_ODD = ['0:6', '1:5', '2:4', '3:3', '4:2', '5:1', '6:0'];

// 0~6 카운트 옵션
const COUNT_OPTS: Option[] = Array.from({ length: 7 }, (_, i) => ({ code: i, label: `${i}개` }));
// 0~10 AC 옵션
const AC_OPTS: Option[] = Array.from({ length: 11 }, (_, i) => ({ code: i, label: `${i}` }));

// 같은 끝수 패턴 옵션
const SAME_TAIL_OPTS: Option[] = [
  { code: 'none', label: '없음' },
  { code: '2',     label: '2개' },
  { code: '3',     label: '3개' },
  { code: '4',     label: '4개' },
  { code: '5',     label: '5개' },
  { code: '2+2',   label: '2쌍2' },
  { code: '2+2+2', label: '2쌍3' },
  { code: '3+3',   label: '3쌍2' },
  { code: '3+2',   label: '2+3' },
  { code: '4+2',   label: '2+4' },
];

// 구간 제외 옵션 — 1-9 / 10-19 / 20-29 / 30-39 / 40-45
const DECADE_OPTS: Option[] = [
  { code: 0, label: '단번대' },
  { code: 1, label: '10번대' },
  { code: 2, label: '20번대' },
  { code: 3, label: '30번대' },
  { code: 4, label: '40번대' },
];

function decadeOf(n: number): number {
  if (n <= 9) return 0;
  if (n <= 19) return 1;
  if (n <= 29) return 2;
  if (n <= 39) return 3;
  return 4;
}

// 1~9궁 — n%9 (0이면 9). 각 궁마다 정확히 5개씩 분포.
//   1궁: 1·10·19·28·37
//   2궁: 2·11·20·29·38
//   ...
//   9궁: 9·18·27·36·45
const GOONG_OPTS: Option[] = Array.from({ length: 9 }, (_, i) => ({
  code: i + 1,
  label: `${i + 1}궁`,
}));

function goongOf(n: number): number {
  return ((n - 1) % 9) + 1;
}

// 끝수 0~9 (n % 10) — 각 끝수마다 4~5개 번호 분포
//   0: 10·20·30·40 / 1: 1·11·21·31·41 / 5: 5·15·25·35·45 / 6: 6·16·26·36 / ...
const TAIL_OPTS: Option[] = Array.from({ length: 10 }, (_, i) => ({
  code: i,
  label: `${i}`,
}));

// 연번 패턴 옵션
const CONSEC_OPTS: Option[] = [
  { code: 'none',  label: '연번 없음' },
  { code: '2',     label: '2연번' },
  { code: '2+2',   label: '2연번×2' },
  { code: '2+2+2', label: '2연번×3' },
  { code: '3',     label: '3연번' },
  { code: '3+3',   label: '3연번×2' },
  { code: '4',     label: '4연번' },
  { code: '5',     label: '5연번' },
  { code: '6',     label: '6연번' },
  { code: '3+2',   label: '2+3연번' },
  { code: '4+2',   label: '2+4연번' },
];

const DEFAULT_FILTER: Filter = {
  pool: [], fixed: [], exclude: [],
  sumMin: 100, sumMax: 175,
  tailMin: 14, tailMax: 35,
  oddAllow: ['2:4', '3:3', '4:2'],
  lowAllow: ['2:4', '3:3', '4:2'],
  acAllow: [7, 8, 9, 10],
  sameTailAllow: [],
  consecAllow: [],
  poolTails: [], requiredTails: [],
  decade0Allow: [], decade1Allow: [], decade2Allow: [],
  decade3Allow: [], decade4Allow: [],
  excludeGoongs: [],
  includeGoongs: [],
  segMax: 3,
  cornerMatch: -1,
  primeAllow: [], compositeAllow: [], twinAllow: [],
  squareAllow: [], mult3Allow: [], mult4Allow: [], mult5Allow: [],
  carryAllow: [], neighborAllow: [], comp45Allow: [],
};

/**
 * AVERAGE_FILTER — 역대 당첨번호 통계 기반으로 "평균적인 조합"이 통과하는 필터 세트.
 * 잘 모르는 사용자가 한 번에 적용해서 바로 합리적인 조합을 추출할 수 있도록.
 *
 * 각 필터는 역대 99% 케이스 커버를 목표로 약간 보수적으로 설정.
 * 번호(풀/고정/제외)와 궁수만 비워둠 — 사용자 개인 선택 영역.
 */
const AVERAGE_FILTER: Filter = {
  pool: [], fixed: [], exclude: [],
  // 합계 — 역대 평균 분포 (~80%)
  sumMin: 100, sumMax: 175,
  tailMin: 14, tailMax: 35,
  // 비율
  oddAllow: ['2:4', '3:3', '4:2'],
  lowAllow: ['2:4', '3:3', '4:2'],
  acAllow: [7, 8, 9, 10],
  // 패턴
  sameTailAllow: ['none', '2', '3'],
  consecAllow: ['none', '2', '3'],
  // 끝수 — 평균치는 비워둠 (개인 선택)
  poolTails: [], requiredTails: [],
  // 구간별 개수 — 각 구간 0~3개 (역대 99% 커버)
  decade0Allow: [0, 1, 2, 3],
  decade1Allow: [0, 1, 2, 3],
  decade2Allow: [0, 1, 2, 3],
  decade3Allow: [0, 1, 2, 3],
  decade4Allow: [0, 1, 2, 3],
  excludeGoongs: [],
  includeGoongs: [],
  segMax: 3,
  cornerMatch: -1,
  // 수학 속성 — 역대 평균
  primeAllow: [1, 2, 3],
  compositeAllow: [2, 3, 4, 5],
  twinAllow: [0, 1],
  squareAllow: [0, 1, 2],
  mult3Allow: [1, 2, 3],
  mult4Allow: [0, 1, 2, 3],
  mult5Allow: [0, 1, 2],
  // 회차 관계 — 평균
  carryAllow: [0, 1, 2],
  neighborAllow: [0, 1, 2],
  comp45Allow: [0, 1, 2],
};

// ─── 그룹 정의 ───────────────────────────────────────────────
const GROUPS: { id: GroupId; label: string; emoji: string; color: string }[] = [
  { id: 'num',    label: '번호',         emoji: '🔢', color: POOL_COLOR },
  { id: 'sum',    label: '합계·비율',    emoji: '📊', color: GOLD },
  { id: 'consec', label: '연속·끝수',    emoji: '🔁', color: palette.purple500 },
  { id: 'math',   label: '수학 속성',    emoji: '🧮', color: '#0098b2' },
  { id: 'round',  label: '회차 관계',     emoji: '🎯', color: EXCLUDE_COLOR },
];
type GroupId = 'num' | 'sum' | 'consec' | 'math' | 'round';

type Option = { code: string | number; label: string };

type Preset = { id: string; name: string; filter: Filter; savedAt: number };

/** 결과 누적 한도 — 렌더링 성능 (BallRow 카드 500개까지 안정) + 보관함 1000건 한도 고려. */
const MAX_RESULTS = 500;

export default function ProFilter() {
  const t = useTheme();
  const goBack = useSafeBack('/pro-gen');
  const latestDraw = useHistory((s) => s.getLatest());
  const addSaved = useSavedNumbers((s) => s.add);

  const [filter, setFilter] = useState<Filter>(DEFAULT_FILTER);
  const [openGroup, setOpenGroup] = useState<GroupId | null>('num');
  const [results, setResults] = useState<number[][]>([]);
  const [savedSet, setSavedSet] = useState<Record<number, boolean>>({});
  const [genCount, setGenCount] = useState<number>(5);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  const prevNums = useMemo(() => latestDraw?.nums ?? [], [latestDraw]);

  // 그룹별 활성 필터 개수
  const activeCounts = useMemo(() => ({
    num: countNumActive(filter),
    sum: countSumActive(filter),
    consec: countConsecActive(filter),
    math: countMathActive(filter),
    round: countRoundActive(filter),
  }), [filter]);
  const totalActive = activeCounts.num + activeCounts.sum + activeCounts.consec + activeCounts.math + activeCounts.round;

  // 깔때기 계산 (번호 정확, 나머지는 rejection sampling)
  const funnel = useMemo(() => {
    const TOTAL = 8145060;
    const numTotal = exactNumFilterCount(filter);
    if (numTotal === 0) return { total: TOTAL, num: 0, sum: 0, consec: 0, math: 0, final: 0, finalPct: 0 };

    const trials = 4000;
    let pSum = 0, pConsec = 0, pMath = 0, pAll = 0;
    for (let i = 0; i < trials; i++) {
      const c = sampleFromPool(filter);
      if (!c) continue;
      if (!passSumFilter(c, filter)) continue;
      pSum++;
      if (!passConsecFilter(c, filter)) continue;
      pConsec++;
      if (!passMathFilter(c, filter)) continue;
      pMath++;
      if (!passRoundFilter(c, filter, prevNums)) continue;
      pAll++;
    }
    return {
      total: TOTAL,
      num: numTotal,
      sum: Math.round((pSum / trials) * numTotal),
      consec: Math.round((pConsec / trials) * numTotal),
      math: Math.round((pMath / trials) * numTotal),
      final: Math.round((pAll / trials) * numTotal),
      finalPct: (pAll / trials) * (numTotal / TOTAL),
    };
  }, [filter, prevNums]);

  // 누적 모드 + 자동 중복 제거. 기존 results와 충돌하지 않는 새 조합만 추가.
  const generate = () => {
    // 기존 결과들의 키를 seen에 미리 등록 → 다음 배치는 그것들을 자동 회피
    const seen = new Set<string>(results.map((r) => r.join(',')));
    const additions: number[][] = [];
    const remaining = MAX_RESULTS - results.length;
    const wanted = Math.min(genCount, remaining);
    if (wanted <= 0) return; // 한도 도달

    const maxTrials = Math.max(300_000, wanted * 20_000);
    for (let i = 0; i < maxTrials && additions.length < wanted; i++) {
      const c = sampleFromPool(filter);
      if (!c) break;
      const key = c.join(',');
      if (seen.has(key)) continue; // 이전 배치 or 이번 배치 중복 자동 회피
      if (!passSumFilter(c, filter)) continue;
      if (!passConsecFilter(c, filter)) continue;
      if (!passMathFilter(c, filter)) continue;
      if (!passRoundFilter(c, filter, prevNums)) continue;
      seen.add(key);
      additions.push(c);
    }
    // 기존 결과 뒤에 새 조합 추가 (savedSet은 인덱스 기준이라 유지됨)
    setResults((prev) => [...prev, ...additions]);
  };

  /** 결과 전체 초기화. */
  const resetResults = () => {
    setResults([]);
    setSavedSet({});
  };

  const resetAll = () => setFilter(DEFAULT_FILTER);
  /** 모든 필터를 역대 평균 통계 값으로 한 번에 적용. */
  const applyAverages = () => setFilter(AVERAGE_FILTER);

  const savePreset = () => {
    const name = presetName.trim() || `프리셋 ${presets.length + 1}`;
    setPresets((p) => [{ id: `p_${Date.now()}`, name, filter, savedAt: Date.now() }, ...p]);
    setPresetName('');
    setPresetModalOpen(false);
  };
  const loadPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (p) { setFilter(p.filter); setResults([]); }
  };
  const saveResult = (i: number) => {
    const nums = results[i];
    if (!nums) return;
    const res = addSaved({ nums, round: null, source: 'gen' });
    if (res.ok) setSavedSet((s) => ({ ...s, [i]: true }));
  };
  /** 아직 저장 안 한 모든 조합 일괄 저장. */
  const saveAllResults = () => {
    const next: Record<number, boolean> = { ...savedSet };
    for (let i = 0; i < results.length; i++) {
      if (next[i]) continue;
      const res = addSaved({ nums: results[i], round: null, source: 'gen' });
      if (res.ok) next[i] = true;
    }
    setSavedSet(next);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon.crown color={GOLD} size={16} weight={2} />
            <T variant="heading1" color="primary">조합 필터링</T>
          </View>
        }
        onBack={goBack}
        trailing={
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable onPress={resetAll} hitSlop={6} style={{ paddingHorizontal: 8 }}>
              <T variant="caption1" allowFontScaling={false} style={{ color: palette.red500, fontWeight: '800' }}>
                초기화
              </T>
            </Pressable>
            <Pressable onPress={() => setPresetModalOpen(true)} hitSlop={6} style={{ paddingHorizontal: 8 }}>
              <T variant="caption1" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800' }}>
                💾 프리셋
              </T>
            </Pressable>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>

        {/* 헤더 — 깔때기 */}
        <View style={[styles.hero, { backgroundColor: palette.neutral950 }]}>
          <View style={[styles.proPill, { backgroundColor: GOLD }]}>
            <Icon.crown color="#fff" size={12} weight={2.5} />
            <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10, marginLeft: 3 }}>PRO</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 12, gap: 8 }}>
            <T variant="display2" style={{ color: '#fff', fontWeight: '900' }}>
              {funnel.final.toLocaleString()}
            </T>
            <T variant="body2r" style={{ color: 'rgba(255,255,255,0.7)' }}>개 매칭</T>
          </View>
          <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            필터 {totalActive}개 활성 · 전체 {funnel.total.toLocaleString()}개 중
          </T>

          <View style={{ marginTop: 16, gap: 5 }}>
            <Funnel label="전체"        value={funnel.total}  pct={1} />
            <Funnel label="① 번호"      value={funnel.num}    pct={funnel.num / funnel.total} />
            <Funnel label="② 합계·비율" value={funnel.sum}    pct={funnel.sum / funnel.total} />
            <Funnel label="③ 연속·끝수" value={funnel.consec} pct={funnel.consec / funnel.total} />
            <Funnel label="④ 수학 속성" value={funnel.math}   pct={funnel.math / funnel.total} />
            <Funnel label="⑤ 회차 관계" value={funnel.final}  pct={funnel.finalPct} final />
          </View>
        </View>

        {/* ✨ 평균치 자동 적용 — 초보자용 원클릭 세팅 */}
        <Pressable
          onPress={applyAverages}
          style={({ pressed }) => [
            styles.autoCard,
            { backgroundColor: palette.green700, opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <View style={styles.autoIconBox}>
            <T allowFontScaling={false} style={{ fontSize: 24 }}>✨</T>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="label1n" style={{ color: '#fff', fontWeight: '800' }}>
              평균치 자동 적용
            </T>
            <T variant="caption1" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2, lineHeight: 16 }}>
              역대 통계 평균으로 모든 필터를 한 번에 설정 · 바로 추출 가능
            </T>
          </View>
          <Icon.chev color="rgba(255,255,255,0.9)" size={16} weight={2.2} />
        </Pressable>

        {/* 5개 그룹 아코디언 */}
        {GROUPS.map((g) => (
          <Card key={g.id} padding={0}>
            <Pressable onPress={() => setOpenGroup(openGroup === g.id ? null : g.id)} style={styles.groupHead}>
              <View style={[styles.groupDot, { backgroundColor: g.color }]} />
              <T allowFontScaling={false} style={{ fontSize: 18, marginLeft: 4 }}>{g.emoji}</T>
              <T variant="label1n" color="primary" style={{ flex: 1, fontWeight: '800', marginLeft: 8 }}>
                {g.label}
              </T>
              <View style={[styles.activeCount, { backgroundColor: activeCounts[g.id] > 0 ? g.color : 'rgba(150,150,150,0.2)' }]}>
                <T variant="caption2" allowFontScaling={false} style={{ color: activeCounts[g.id] > 0 ? '#fff' : '#888', fontSize: 10, fontWeight: '800' }}>
                  {activeCounts[g.id]}
                </T>
              </View>
              <View style={{ transform: [{ rotate: openGroup === g.id ? '90deg' : '0deg' }], marginLeft: 8 }}>
                <Icon.chev color={t.fgTertiary} size={14} />
              </View>
            </Pressable>
            {openGroup === g.id && (
              <View style={styles.groupBody}>
                {g.id === 'num'    && <NumGroup filter={filter} setFilter={setFilter} t={t} />}
                {g.id === 'sum'    && <SumGroup filter={filter} setFilter={setFilter} t={t} />}
                {g.id === 'consec' && <ConsecGroup filter={filter} setFilter={setFilter} t={t} />}
                {g.id === 'math'   && <MathGroup filter={filter} setFilter={setFilter} t={t} />}
                {g.id === 'round'  && <RoundGroup filter={filter} setFilter={setFilter} prevNums={prevNums} t={t} />}
              </View>
            )}
          </Card>
        ))}

        {/* 결과 */}
        {results.length > 0 && (() => {
          const savedCount = Object.values(savedSet).filter(Boolean).length;
          const allSaved = savedCount === results.length;
          return (
            <Card padding={16}>
              {/* 제목 + 부제 */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
                    ✨ 생성된 조합 {results.length}개
                  </T>
                  {results.length >= MAX_RESULTS && (
                    <T variant="caption2" allowFontScaling={false} style={{ color: palette.red500, fontWeight: '800', fontSize: 10 }}>
                      한도 도달 ({MAX_RESULTS})
                    </T>
                  )}
                </View>
                <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
                  {savedCount > 0
                    ? `${savedCount} / ${results.length} 저장됨 · 중복 없이 누적`
                    : '중복 없이 누적 · 모든 필터 통과'}
                </T>
              </View>

              {/* 액션 버튼 묶음 — 결과 초기화 + 모두 저장 (1:1 분할) */}
              <View style={styles.recActions}>
                <Pressable
                  onPress={resetResults}
                  style={({ pressed }) => [
                    styles.refreshBtn,
                    { borderColor: GOLD, backgroundColor: t.bgSurface, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <T allowFontScaling={false} style={{ fontSize: 13, marginRight: 4 }}>🗑</T>
                  <T variant="caption1" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 12 }}>
                    결과 초기화
                  </T>
                </Pressable>
                <Pressable
                  onPress={saveAllResults}
                  disabled={allSaved}
                  style={({ pressed }) => [
                    styles.saveAllBtn,
                    {
                      backgroundColor: allSaved ? palette.green500 : GOLD,
                      opacity: pressed && !allSaved ? 0.85 : 1,
                    },
                  ]}
                >
                  <Icon.check color="#fff" size={13} weight={2.8} />
                  <T variant="caption1" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 12, marginLeft: 5 }}>
                    {allSaved ? '저장 완료' : '모두 저장'}
                  </T>
                </Pressable>
              </View>

              {/* 조합 행 — 단일 Card 내부에서 recRow Views로 구분 */}
              <View style={{ marginTop: 12, gap: 8 }}>
                {results.map((nums, i) => (
                  <View
                    key={i}
                    style={[
                      styles.recRow,
                      { backgroundColor: t.bgSurface2, borderColor: t.borderDivider },
                    ]}
                  >
                    <View style={styles.labelBox}>
                      <T variant="caption2" allowFontScaling={false} style={{ color: GOLD_DARK, fontWeight: '800', fontSize: 11 }}>
                        #{i + 1}
                      </T>
                    </View>
                    <View style={{ flex: 1 }}>
                      <BallRow nums={nums} size="sm" hits={filter.fixed} />
                      <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginTop: 4, fontSize: 10 }}>
                        합 {total(nums)} · 끝수 {tailSum(nums)} · AC {ac(nums)} · {oddEvenLabel(nums)} · 연속 {longestConsecutive(nums)}
                      </T>
                    </View>
                    <Pressable
                      onPress={() => saveResult(i)}
                      disabled={savedSet[i]}
                      style={({ pressed }) => [
                        styles.saveDot,
                        { backgroundColor: savedSet[i] ? palette.green500 : 'rgba(232,176,78,0.18)', opacity: pressed ? 0.85 : 1 },
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

        {/* 프리셋 목록 */}
        {presets.length > 0 && (
          <Card padding={14}>
            <T variant="label1n" color="primary" style={{ fontWeight: '800', marginBottom: 8 }}>
              💾 저장된 프리셋 {presets.length}개
            </T>
            <View style={{ gap: 6 }}>
              {presets.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => loadPreset(p.id)}
                  style={({ pressed }) => [
                    styles.presetRow,
                    { backgroundColor: t.bgSurface2, borderColor: t.borderDivider, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <T allowFontScaling={false} style={{ fontSize: 14 }}>💾</T>
                  <T variant="label1n" color="primary" style={{ flex: 1, fontWeight: '700', marginLeft: 8 }} numberOfLines={1}>
                    {p.name}
                  </T>
                  <Icon.chev color={GOLD} size={14} />
                </Pressable>
              ))}
            </View>
          </Card>
        )}

        <Disclaimer />
      </ScrollView>

      {/* 하단 고정 생성 영역 */}
      <View style={[styles.bottomBar, { backgroundColor: t.bgSurface, borderTopColor: t.borderDivider }]}>
        {/* 중복 방지 안내 — 결과가 1개 이상일 때만 표시 */}
        {results.length > 0 && (
          <View style={[styles.dedupeHint, { backgroundColor: 'rgba(0,191,64,0.10)', borderColor: 'rgba(0,191,64,0.30)' }]}>
            <Icon.check color={palette.green700} size={11} weight={2.8} />
            <T variant="caption2" allowFontScaling={false} style={{ color: palette.green700, fontWeight: '700', fontSize: 10.5, marginLeft: 5 }}>
              다시 생성해도 이전 {results.length}개와 중복되지 않게 새 조합만 추가돼요
            </T>
          </View>
        )}
        {/* 생성 개수 선택 */}
        <View style={styles.countRow}>
          <T variant="caption1" color="tertiary" allowFontScaling={false} style={{ fontWeight: '700', fontSize: 11, marginRight: 4 }}>
            생성 개수
          </T>
          {[5, 10, 20, 50, 100].map((n) => {
            const on = genCount === n;
            return (
              <Pressable
                key={n}
                onPress={() => setGenCount(n)}
                style={({ pressed }) => [
                  styles.countChip,
                  {
                    backgroundColor: on ? GOLD : t.bgSurface2,
                    borderColor: on ? GOLD : t.borderDivider,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <T
                  variant="caption2"
                  allowFontScaling={false}
                  style={{ color: on ? '#fff' : t.fgSecondary, fontWeight: '800', fontSize: 11 }}
                >
                  {n}개
                </T>
              </Pressable>
            );
          })}
        </View>
        {/* 생성 버튼 */}
        {(() => {
          const remaining = MAX_RESULTS - results.length;
          const wantedNow = Math.min(genCount, remaining, funnel.final);
          const atLimit = remaining <= 0;
          const noMatch = funnel.final === 0;
          const disabled = atLimit || noMatch;
          const label = atLimit
            ? `한도 ${MAX_RESULTS}개 도달 · 초기화 후 진행`
            : noMatch
            ? '조건에 맞는 조합 없음'
            : results.length > 0
            ? `${wantedNow.toLocaleString()}개 더 추출 (현재 ${results.length})`
            : `${funnel.final.toLocaleString()}개 중 ${wantedNow.toLocaleString()}개 생성`;
          return (
            <Pressable
              onPress={generate}
              disabled={disabled}
              style={({ pressed }) => [
                styles.genBtn,
                {
                  backgroundColor: disabled ? 'rgba(150,150,150,0.3)' : GOLD,
                  opacity: pressed && !disabled ? 0.9 : 1,
                },
              ]}
            >
              <Icon.flash color="#fff" size={16} weight={2.5} />
              <T variant="body1n" style={{ color: '#fff', fontWeight: '800', marginLeft: 8 }}>
                {label}
              </T>
            </Pressable>
          );
        })()}
      </View>

      {/* 프리셋 저장 모달 */}
      <Modal visible={presetModalOpen} transparent animationType="fade" onRequestClose={() => setPresetModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPresetModalOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: t.bgSurface }]} onPress={(e) => e.stopPropagation()}>
            <T variant="headline2" color="primary" style={{ fontWeight: '800' }}>현재 필터를 프리셋으로 저장</T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 4 }}>필터 {totalActive}개를 묶어 저장합니다</T>
            <TextInput
              value={presetName}
              onChangeText={setPresetName}
              placeholder="예: 균형 안정형"
              placeholderTextColor={t.fgTertiary}
              style={[styles.input, { borderColor: t.borderNormal, color: t.fgPrimary, backgroundColor: t.bgCanvas }]}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable onPress={() => setPresetModalOpen(false)} style={[styles.modalBtn, { backgroundColor: t.bgSurface2, borderColor: t.borderNormal }]}>
                <T variant="body2n" color="secondary" style={{ fontWeight: '700' }}>취소</T>
              </Pressable>
              <Pressable onPress={savePreset} style={[styles.modalBtn, { backgroundColor: GOLD, borderColor: GOLD }]}>
                <T variant="body2n" style={{ color: '#fff', fontWeight: '800' }}>저장</T>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ① 번호 그룹 — 예상수/고정수/제외수 3모드
   ═══════════════════════════════════════════════════════════════════════════ */

function NumGroup({ filter, setFilter, t }: {
  filter: Filter; setFilter: React.Dispatch<React.SetStateAction<Filter>>; t: ReturnType<typeof useTheme>;
}) {
  const [mode, setMode] = useState<NumberMode>('pool');

  const onTap = (n: number) => {
    setFilter((f) => {
      const currentState: NumberMode | null =
        f.pool.includes(n) ? 'pool' :
        f.fixed.includes(n) ? 'fixed' :
        f.exclude.includes(n) ? 'exclude' : null;
      const cleared = {
        ...f,
        pool: f.pool.filter((x) => x !== n),
        fixed: f.fixed.filter((x) => x !== n),
        exclude: f.exclude.filter((x) => x !== n),
      };
      if (currentState === mode) return cleared;
      cleared[mode] = [...cleared[mode], n].sort((a, b) => a - b);
      return cleared;
    });
  };
  const clearNums = () => setFilter((f) => ({ ...f, pool: [], fixed: [], exclude: [] }));

  const cells = Array.from({ length: 45 }, (_, i) => i + 1);

  return (
    <View>
      <View style={[styles.modeBar, { backgroundColor: t.bgSurface2, borderColor: t.borderDivider }]}>
        <ModeBtn label="예상수" count={filter.pool.length}    active={mode === 'pool'}    color={POOL_COLOR}    onPress={() => setMode('pool')}    t={t} />
        <ModeBtn label="고정수" count={filter.fixed.length}   active={mode === 'fixed'}   color={FIXED_COLOR}   onPress={() => setMode('fixed')}   t={t} />
        <ModeBtn label="제외수" count={filter.exclude.length} active={mode === 'exclude'} color={EXCLUDE_COLOR} onPress={() => setMode('exclude')} t={t} />
      </View>

      <View style={[styles.hintBox, { backgroundColor: hintBg(mode), borderColor: hintBorder(mode) }]}>
        <T variant="caption1" allowFontScaling={false} style={{ color: hintFg(mode), fontWeight: '700', lineHeight: 17 }}>
          {mode === 'pool'    && '🎯 예상수 · 선택한 번호들 중에서만 조합이 추출됩니다 (비우면 1~45 전체)'}
          {mode === 'fixed'   && '📌 고정수 · 모든 조합에 무조건 포함됩니다 (6개 미만 권장)'}
          {mode === 'exclude' && '🚫 제외수 · 모든 조합에서 제외됩니다'}
        </T>
      </View>

      <View style={styles.grid}>
        {cells.map((n) => {
          const s =
            filter.pool.includes(n) ? 'pool' :
            filter.fixed.includes(n) ? 'fixed' :
            filter.exclude.includes(n) ? 'exclude' : null;
          const bg = s === 'pool' ? POOL_COLOR : s === 'fixed' ? FIXED_COLOR : s === 'exclude' ? EXCLUDE_COLOR : t.bgSurface;
          const fg = s ? '#fff' : t.fgSecondary;
          const ring = !s ? ballColor(n) : undefined;
          return (
            <Pressable
              key={n}
              onPress={() => onTap(n)}
              style={({ pressed }) => [
                styles.cell,
                {
                  backgroundColor: bg,
                  borderColor: s ? 'transparent' : t.borderWeak,
                  borderWidth: s ? 0 : 1,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              {ring && <View pointerEvents="none" style={[styles.dot, { backgroundColor: ring }]} />}
              <T
                variant="label1n"
                allowFontScaling={false}
                style={{
                  color: fg, fontWeight: '800', fontSize: 14,
                  textDecorationLine: s === 'exclude' ? 'line-through' : 'none',
                }}
              >
                {n}
              </T>
              {s === 'fixed' && (
                <View pointerEvents="none" style={styles.fixedPin}>
                  <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>📌</T>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summaryRow}>
        <SummaryPill label="예상수" count={filter.pool.length} color={POOL_COLOR} />
        <SummaryPill label="고정수" count={filter.fixed.length} color={FIXED_COLOR} />
        <SummaryPill label="제외수" count={filter.exclude.length} color={EXCLUDE_COLOR} />
        {(filter.pool.length + filter.fixed.length + filter.exclude.length) > 0 && (
          <Pressable onPress={clearNums} hitSlop={6} style={{ paddingHorizontal: 8 }}>
            <T variant="caption1" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '800' }}>
              전체 해제
            </T>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ② 합계·비율 그룹 — 합/끝수합 range + 홀짝/저고/AC multi
   ═══════════════════════════════════════════════════════════════════════════ */

function SumGroup({ filter, setFilter, t }: {
  filter: Filter; setFilter: React.Dispatch<React.SetStateAction<Filter>>; t: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ gap: 12 }}>
      <RangeRow label="합계" min={21} max={255} value={[filter.sumMin, filter.sumMax]}
        onChange={([lo, hi]) => setFilter((f) => ({ ...f, sumMin: lo, sumMax: hi }))} />
      <RangeRow label="끝수합" min={6} max={45} value={[filter.tailMin, filter.tailMax]}
        onChange={([lo, hi]) => setFilter((f) => ({ ...f, tailMin: lo, tailMax: hi }))} />
      <MultiCheck
        title="홀짝 비율"
        hint="홀:짝 (체크된 비율만 허용)"
        options={ALL_ODD.map((r) => ({ code: r, label: r }))}
        value={filter.oddAllow}
        onChange={(v) => setFilter((f) => ({ ...f, oddAllow: v as string[] }))}
        t={t}
      />
      <MultiCheck
        title="저고 비율"
        hint="저(1~22):고(23~45)"
        options={ALL_ODD.map((r) => ({ code: r, label: r }))}
        value={filter.lowAllow}
        onChange={(v) => setFilter((f) => ({ ...f, lowAllow: v as string[] }))}
        t={t}
      />
      <MultiCheck
        title="AC값"
        hint="흩어진 정도 — 보통 7~10 권장"
        options={AC_OPTS}
        value={filter.acAllow}
        onChange={(v) => setFilter((f) => ({ ...f, acAllow: v as number[] }))}
        t={t}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ③ 연속·끝수 그룹 — 연번 / 같은 끝수 / 구간 / 모서리
   ═══════════════════════════════════════════════════════════════════════════ */

function ConsecGroup({ filter, setFilter, t }: {
  filter: Filter; setFilter: React.Dispatch<React.SetStateAction<Filter>>; t: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ gap: 14 }}>
      {/* 구간별 개수 — 5개 구간 각각 multi-select */}
      <View>
        <T variant="caption1" color="primary" style={{ fontWeight: '800', fontSize: 13, marginBottom: 4 }}>
          📍 구간별 개수
        </T>
        <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginBottom: 10, lineHeight: 14 }}>
          각 구간에서 나올 번호 개수 · "0개"만 체크 = 그 구간 완전 제외
        </T>
        <View style={{ gap: 10 }}>
          <DecadeRow label="단번대" sub="1~9"   value={filter.decade0Allow} onChange={(v) => setFilter((f) => ({ ...f, decade0Allow: v }))} t={t} />
          <DecadeRow label="10번대" sub="10~19" value={filter.decade1Allow} onChange={(v) => setFilter((f) => ({ ...f, decade1Allow: v }))} t={t} />
          <DecadeRow label="20번대" sub="20~29" value={filter.decade2Allow} onChange={(v) => setFilter((f) => ({ ...f, decade2Allow: v }))} t={t} />
          <DecadeRow label="30번대" sub="30~39" value={filter.decade3Allow} onChange={(v) => setFilter((f) => ({ ...f, decade3Allow: v }))} t={t} />
          <DecadeRow label="40번대" sub="40~45" value={filter.decade4Allow} onChange={(v) => setFilter((f) => ({ ...f, decade4Allow: v }))} t={t} />
        </View>
      </View>
      <MultiCheck
        title="🏯 궁수 제거"
        hint="체크한 궁의 번호 5개를 모두 제외 (예: 1궁 = 1·10·19·28·37)"
        options={GOONG_OPTS}
        value={filter.excludeGoongs}
        onChange={(v) => setFilter((f) => ({ ...f, excludeGoongs: v as number[] }))}
        t={t}
      />
      <MultiCheck
        title="🏯 궁수 포함"
        hint="체크한 각 궁에서 1개 이상 반드시 포함 (다양성 강제)"
        options={GOONG_OPTS}
        value={filter.includeGoongs}
        onChange={(v) => setFilter((f) => ({ ...f, includeGoongs: v as number[] }))}
        t={t}
      />
      <MultiCheck
        title="연번 패턴"
        hint="연속수의 묶음 패턴 (예: 2+3 = 2연속과 3연속이 함께)"
        options={CONSEC_OPTS}
        value={filter.consecAllow}
        onChange={(v) => setFilter((f) => ({ ...f, consecAllow: v as string[] }))}
        t={t}
      />
      <MultiCheck
        title="같은 끝수 패턴"
        hint="끝자리가 같은 수의 묶음 (예: 11·21·31 = 3개)"
        options={SAME_TAIL_OPTS}
        value={filter.sameTailAllow}
        onChange={(v) => setFilter((f) => ({ ...f, sameTailAllow: v as string[] }))}
        t={t}
      />
      <MultiCheck
        title="🎯 넣고싶은 끝수 (풀)"
        hint="체크한 끝수의 번호에서만 추출 (예: 0 → 10·20·30·40만 사용) · 비우면 자유"
        options={TAIL_OPTS}
        value={filter.poolTails}
        onChange={(v) => setFilter((f) => ({ ...f, poolTails: v as number[] }))}
        t={t}
      />
      <MultiCheck
        title="📌 고정 끝수"
        hint="체크한 각 끝수의 번호가 1개 이상 반드시 포함 (예: 7 → 7·17·27·37 중 1개 이상)"
        options={TAIL_OPTS}
        value={filter.requiredTails}
        onChange={(v) => setFilter((f) => ({ ...f, requiredTails: v as number[] }))}
        t={t}
      />
      <View>
        <T variant="caption1" color="secondary" style={{ marginBottom: 6, fontWeight: '700' }}>한 구간 최대 개수</T>
        <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginBottom: 6, fontSize: 10.5 }}>
          단번대 / 10번대 / 20번대 / 30번대 / 40번대 각 구간의 최대 개수
        </T>
        <SingleChipRow
          options={[2, 3, 4, 5, 6].map((n) => ({ code: n, label: `${n}` }))}
          value={filter.segMax}
          onChange={(v) => setFilter((f) => ({ ...f, segMax: v as number }))}
          t={t}
        />
      </View>
      <View>
        <T variant="caption1" color="secondary" style={{ marginBottom: 6, fontWeight: '700' }}>모서리 패턴 매칭</T>
        <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginBottom: 6, fontSize: 10.5 }}>
          7×7 격자의 19셀과 매칭되는 번호 개수 (해제 = 미사용)
        </T>
        <SingleChipRow
          options={[
            { code: -1, label: '해제' },
            ...Array.from({ length: 7 }, (_, i) => ({ code: i, label: `${i}` })),
          ]}
          value={filter.cornerMatch}
          onChange={(v) => setFilter((f) => ({ ...f, cornerMatch: v as number }))}
          t={t}
        />
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ④ 수학 속성 그룹 — 7가지 카운트 필터
   ═══════════════════════════════════════════════════════════════════════════ */

function MathGroup({ filter, setFilter, t }: {
  filter: Filter; setFilter: React.Dispatch<React.SetStateAction<Filter>>; t: ReturnType<typeof useTheme>;
}) {
  const setField = (k: keyof Filter, v: any) => setFilter((f) => ({ ...f, [k]: v }));
  return (
    <View style={{ gap: 14 }}>
      <MultiCheck
        title="소수 포함 개수"
        hint="2·3·5·7·11·13·17·19·23·29·31·37·41·43 (14개)"
        options={COUNT_OPTS}
        value={filter.primeAllow}
        onChange={(v) => setField('primeAllow', v as number[])}
        t={t}
      />
      <MultiCheck
        title="합성수 포함 개수"
        hint="1·소수 제외 (4·6·8·9·... 28개)"
        options={COUNT_OPTS}
        value={filter.compositeAllow}
        onChange={(v) => setField('compositeAllow', v as number[])}
        t={t}
      />
      <MultiCheck
        title="동형수(쌍둥이) 포함 개수"
        hint="두 자리가 같은 수 — 11·22·33·44"
        options={COUNT_OPTS}
        value={filter.twinAllow}
        onChange={(v) => setField('twinAllow', v as number[])}
        t={t}
      />
      <MultiCheck
        title="제곱수 포함 개수"
        hint="1·4·9·16·25·36 (6개)"
        options={COUNT_OPTS}
        value={filter.squareAllow}
        onChange={(v) => setField('squareAllow', v as number[])}
        t={t}
      />
      <MultiCheck
        title="3의 배수 포함 개수"
        hint="3·6·9·... (15개)"
        options={COUNT_OPTS}
        value={filter.mult3Allow}
        onChange={(v) => setField('mult3Allow', v as number[])}
        t={t}
      />
      <MultiCheck
        title="4의 배수 포함 개수"
        hint="4·8·12·... (11개)"
        options={COUNT_OPTS}
        value={filter.mult4Allow}
        onChange={(v) => setField('mult4Allow', v as number[])}
        t={t}
      />
      <MultiCheck
        title="5의 배수 포함 개수"
        hint="5·10·15·... (9개)"
        options={COUNT_OPTS}
        value={filter.mult5Allow}
        onChange={(v) => setField('mult5Allow', v as number[])}
        t={t}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ⑤ 회차 관계 그룹
   ═══════════════════════════════════════════════════════════════════════════ */

function RoundGroup({ filter, setFilter, prevNums, t }: {
  filter: Filter; setFilter: React.Dispatch<React.SetStateAction<Filter>>; prevNums: number[]; t: ReturnType<typeof useTheme>;
}) {
  if (prevNums.length === 0) {
    return <T variant="caption1" color="tertiary">직전 회차 데이터가 없습니다.</T>;
  }
  return (
    <View style={{ gap: 14 }}>
      <T variant="caption1" color="tertiary" style={{ lineHeight: 17 }}>
        직전 본번호 [{prevNums.join(', ')}] 기준 · 체크한 개수 중 하나라도 매칭되면 통과
      </T>
      <MultiCheck
        title="⚡ 이월수 포함 개수"
        hint="직전 회차 본번호와 동일한 번호 개수"
        options={COUNT_OPTS}
        value={filter.carryAllow}
        onChange={(v) => setFilter((f) => ({ ...f, carryAllow: v as number[] }))}
        t={t}
      />
      <MultiCheck
        title="🔗 이웃수 포함 개수"
        hint="직전 본번호의 ±1 번호 개수"
        options={COUNT_OPTS}
        value={filter.neighborAllow}
        onChange={(v) => setFilter((f) => ({ ...f, neighborAllow: v as number[] }))}
        t={t}
      />
      <MultiCheck
        title="🔄 -45 포함 개수"
        hint="45 − 직전 본번호의 결과 번호 개수"
        options={COUNT_OPTS}
        value={filter.comp45Allow}
        onChange={(v) => setFilter((f) => ({ ...f, comp45Allow: v as number[] }))}
        t={t}
      />
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   재사용 컴포넌트
   ═══════════════════════════════════════════════════════════════════════════ */

/** 구간 행 — "단번대 [0][1][2][3][4][5][6]" 같은 한 줄 컴팩트 칩 row. */
function DecadeRow({ label, sub, value, onChange, t }: {
  label: string;
  sub: string;
  value: number[];
  onChange: (v: number[]) => void;
  t: ReturnType<typeof useTheme>;
}) {
  const toggle = (n: number) => {
    onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n].sort((a, b) => a - b));
  };
  const on = value.length > 0;
  return (
    <View style={[styles.decadeRow, { borderColor: on ? GOLD : t.borderDivider, backgroundColor: t.bgSurface2 }]}>
      <View style={{ width: 70 }}>
        <T variant="caption1" color="primary" style={{ fontWeight: '800', fontSize: 12 }}>{label}</T>
        <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 9.5, marginTop: 1 }}>{sub}</T>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((n) => {
          const isOn = value.includes(n);
          return (
            <Pressable
              key={n}
              onPress={() => toggle(n)}
              style={({ pressed }) => [
                styles.decadeChip,
                { backgroundColor: isOn ? GOLD : 'transparent', borderColor: isOn ? GOLD : t.borderDivider, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <T variant="caption2" allowFontScaling={false} style={{ color: isOn ? '#fff' : t.fgSecondary, fontWeight: '800', fontSize: 11 }}>
                {n}
              </T>
            </Pressable>
          );
        })}
      </View>
      {on && (
        <Pressable onPress={() => onChange([])} hitSlop={4} style={{ paddingHorizontal: 4 }}>
          <T variant="caption2" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '800', fontSize: 10 }}>×</T>
        </Pressable>
      )}
    </View>
  );
}

/** 다중 체크 필터 — 칩 기반 multi-select. 비우면 "자유". */
function MultiCheck({ title, hint, options, value, onChange, t }: {
  title: string;
  hint?: string;
  options: Option[];
  value: (string | number)[];
  onChange: (v: (string | number)[]) => void;
  t: ReturnType<typeof useTheme>;
}) {
  const toggle = (code: string | number) => {
    onChange(value.includes(code) ? value.filter((x) => x !== code) : [...value, code]);
  };
  const isActive = value.length > 0;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <T variant="caption1" color="primary" style={{ flex: 1, fontWeight: '800', fontSize: 13 }}>
          {title}
        </T>
        {isActive ? (
          <Pressable onPress={() => onChange([])} hitSlop={6}>
            <T variant="caption2" allowFontScaling={false} style={{ color: palette.blue700, fontWeight: '800', fontSize: 10 }}>
              해제
            </T>
          </Pressable>
        ) : (
          <T variant="caption2" allowFontScaling={false} style={{ color: t.fgTertiary, fontSize: 10, fontWeight: '600' }}>
            자유
          </T>
        )}
      </View>
      {hint && (
        <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginBottom: 6, lineHeight: 14 }}>
          {hint}
        </T>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {options.map((opt) => {
          const on = value.includes(opt.code);
          return (
            <Pressable
              key={String(opt.code)}
              onPress={() => toggle(opt.code)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: on ? GOLD : t.bgSurface2,
                  borderColor: on ? GOLD : t.borderDivider,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <T variant="caption2" allowFontScaling={false} style={{ color: on ? '#fff' : t.fgSecondary, fontWeight: '800', fontSize: 11 }}>
                {opt.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** 단일 선택 chip row. */
function SingleChipRow({ options, value, onChange, t }: {
  options: Option[];
  value: string | number;
  onChange: (v: string | number) => void;
  t: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {options.map((opt) => {
        const on = opt.code === value;
        return (
          <Pressable
            key={String(opt.code)}
            onPress={() => onChange(opt.code)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: on ? GOLD : t.bgSurface2,
                borderColor: on ? GOLD : t.borderDivider,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <T variant="caption2" allowFontScaling={false} style={{ color: on ? '#fff' : t.fgSecondary, fontWeight: '800', fontSize: 11 }}>
              {opt.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

function ModeBtn({ label, count, active, color, onPress, t }: {
  label: string; count: number; active: boolean; color: string; onPress: () => void; t: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeBtn,
        active && { backgroundColor: color },
        !active && { backgroundColor: 'transparent' },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <T variant="caption1" allowFontScaling={false} style={{ color: active ? '#fff' : t.fgSecondary, fontWeight: '800', fontSize: 12 }}>
        {label}
      </T>
      <View style={[styles.modeCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : t.bgSurface }]}>
        <T variant="caption2" allowFontScaling={false} style={{ color: active ? '#fff' : t.fgSecondary, fontSize: 10, fontWeight: '800' }}>
          {count}
        </T>
      </View>
    </Pressable>
  );
}

function Funnel({ label, value, pct, final }: { label: string; value: number; pct: number; final?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <T variant="caption2" allowFontScaling={false} style={{ width: 80, fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.65)' }}>
        {label}
      </T>
      <View style={[styles.funnelTrack, { backgroundColor: 'rgba(255,255,255,0.10)' }]}>
        <View
          style={{
            width: `${Math.max(2, pct * 100)}%`,
            height: '100%',
            borderRadius: 4,
            backgroundColor: final ? palette.green500 : GOLD,
          }}
        />
      </View>
      <T
        variant="caption2"
        allowFontScaling={false}
        style={{ minWidth: 80, textAlign: 'right', fontSize: 10, fontWeight: '800', color: final ? '#fff' : 'rgba(255,255,255,0.78)' }}
      >
        {value.toLocaleString()}
      </T>
    </View>
  );
}

function SummaryPill({ label, count, color }: { label: string; count: number; color: string }) {
  const on = count > 0;
  return (
    <View style={[styles.summaryPill, { backgroundColor: on ? color : 'rgba(150,150,150,0.15)' }]}>
      <T variant="caption2" allowFontScaling={false} style={{ color: on ? '#fff' : '#888', fontWeight: '800', fontSize: 11 }}>
        {label} {count}
      </T>
    </View>
  );
}

function hintBg(m: NumberMode): string {
  if (m === 'pool')  return 'rgba(0,102,255,0.08)';
  if (m === 'fixed') return 'rgba(124,58,237,0.10)';
  return 'rgba(255,66,66,0.08)';
}
function hintBorder(m: NumberMode): string {
  if (m === 'pool')  return 'rgba(0,102,255,0.25)';
  if (m === 'fixed') return 'rgba(124,58,237,0.25)';
  return 'rgba(255,66,66,0.25)';
}
function hintFg(m: NumberMode): string {
  if (m === 'pool')  return palette.blue700;
  if (m === 'fixed') return '#5b21b6';
  return palette.red500;
}

/* ═══════════════════════════════════════════════════════════════════════════
   샘플링 & 필터 평가
   ═══════════════════════════════════════════════════════════════════════════ */

function sampleFromPool(f: Filter): number[] | null {
  // 제외수 + 제외 궁 + 풀 끝수에 안 들어가는 번호를 합쳐서 효과 제외 셋 구성
  // (구간별 개수 필터는 sampling 후 passConsecFilter에서 검증)
  const excludeSet = new Set(f.exclude);
  if (f.excludeGoongs.length > 0) {
    for (let n = 1; n <= 45; n++) {
      if (f.excludeGoongs.includes(goongOf(n))) excludeSet.add(n);
    }
  }
  // 풀 끝수가 정의되면 그 끝수에 안 들어가는 번호 모두 제외
  if (f.poolTails.length > 0) {
    for (let n = 1; n <= 45; n++) {
      if (!f.poolTails.includes(n % 10)) excludeSet.add(n);
    }
  }
  let effective: number[];
  if (f.pool.length > 0) {
    const merged = new Set<number>([...f.pool, ...f.fixed]);
    effective = Array.from(merged).filter((n) => !excludeSet.has(n));
  } else {
    effective = Array.from({ length: 45 }, (_, i) => i + 1).filter((n) => !excludeSet.has(n));
  }
  const fixed = f.fixed.filter((n) => effective.includes(n));
  if (fixed.length !== f.fixed.length) return null;
  const remaining = effective.filter((n) => !fixed.includes(n));
  const needed = 6 - fixed.length;
  if (needed < 0 || remaining.length < needed) return null;
  const arr = [...remaining];
  for (let i = 0; i < needed; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return [...fixed, ...arr.slice(0, needed)].sort((a, b) => a - b);
}

function exactNumFilterCount(f: Filter): number {
  // 제외수 + 제외 궁 + 풀 끝수 외 번호를 합친 효과 제외 셋
  // (구간별 개수 필터는 nuance가 있어 정확 카운트 계산에 포함하지 않음 — 깔때기 ③단계서 반영)
  const excludeSet = new Set(f.exclude);
  if (f.excludeGoongs.length > 0) {
    for (let n = 1; n <= 45; n++) {
      if (f.excludeGoongs.includes(goongOf(n))) excludeSet.add(n);
    }
  }
  if (f.poolTails.length > 0) {
    for (let n = 1; n <= 45; n++) {
      if (!f.poolTails.includes(n % 10)) excludeSet.add(n);
    }
  }
  // 고정수가 제외 영역에 있으면 불가능
  for (const n of f.fixed) if (excludeSet.has(n)) return 0;

  let poolSize: number;
  if (f.pool.length > 0) {
    const merged = new Set<number>([...f.pool, ...f.fixed]);
    poolSize = Array.from(merged).filter((n) => !excludeSet.has(n)).length;
  } else {
    poolSize = 45 - excludeSet.size;
  }
  const fixedCount = f.fixed.filter((n) => !excludeSet.has(n)).length;
  if (fixedCount !== f.fixed.length) return 0;
  const remaining = poolSize - fixedCount;
  const needed = 6 - fixedCount;
  if (needed < 0 || remaining < needed) return 0;
  return choose(remaining, needed);
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
}

// 합계·비율 (그룹 ②)
function passSumFilter(c: number[], f: Filter): boolean {
  const s = c.reduce((a, b) => a + b, 0);
  if (s < f.sumMin || s > f.sumMax) return false;
  const ts = c.reduce((a, b) => a + (b % 10), 0);
  if (ts < f.tailMin || ts > f.tailMax) return false;
  let odd = 0;
  for (const n of c) if (n % 2 === 1) odd++;
  if (f.oddAllow.length > 0 && !f.oddAllow.includes(`${odd}:${6 - odd}`)) return false;
  let low = 0;
  for (const n of c) if (n <= 22) low++;
  if (f.lowAllow.length > 0 && !f.lowAllow.includes(`${low}:${6 - low}`)) return false;
  const a = ac(c);
  if (f.acAllow.length > 0 && !f.acAllow.includes(a)) return false;
  return true;
}

// 연속·끝수 (그룹 ③)
function passConsecFilter(c: number[], f: Filter): boolean {
  if (f.consecAllow.length > 0) {
    if (!f.consecAllow.includes(consecPattern(c))) return false;
  }
  if (f.sameTailAllow.length > 0) {
    if (!f.sameTailAllow.includes(sameTailPattern(c))) return false;
  }
  // 고정 끝수 — 체크한 각 끝수에 해당하는 번호가 1개 이상 포함
  if (f.requiredTails.length > 0) {
    const tails = new Set(c.map((n) => n % 10));
    for (const t of f.requiredTails) {
      if (!tails.has(t)) return false;
    }
  }
  // 구간별 개수 + 한 구간 최대를 함께 검증
  const seg = [0, 0, 0, 0, 0];
  for (const n of c) seg[decadeOf(n)]++;
  // 5개 구간 각각 — 체크된 개수 중 하나여야 함 (자유면 무시)
  const decadeAllows = [f.decade0Allow, f.decade1Allow, f.decade2Allow, f.decade3Allow, f.decade4Allow];
  for (let i = 0; i < 5; i++) {
    if (decadeAllows[i].length > 0 && !decadeAllows[i].includes(seg[i])) return false;
  }
  if (Math.max(...seg) > f.segMax) return false;
  // 제외 궁
  if (f.excludeGoongs.length > 0) {
    for (const n of c) {
      if (f.excludeGoongs.includes(goongOf(n))) return false;
    }
  }
  // 필수 포함 궁 — 체크한 궁마다 1개 이상
  if (f.includeGoongs.length > 0) {
    const goongs = new Set(c.map(goongOf));
    for (const g of f.includeGoongs) {
      if (!goongs.has(g)) return false;
    }
  }
  if (f.cornerMatch >= 0) {
    let m = 0;
    for (const n of c) if (CORNER.has(n)) m++;
    if (m !== f.cornerMatch) return false;
  }
  return true;
}

// 수학 속성 (그룹 ④)
function passMathFilter(c: number[], f: Filter): boolean {
  const checks: Array<[number[], (n: number) => boolean]> = [
    [f.primeAllow,     (n) => PRIME.has(n)],
    [f.compositeAllow, (n) => isComposite(n)],
    [f.twinAllow,      (n) => TWIN.has(n)],
    [f.squareAllow,    (n) => SQUARE.has(n)],
    [f.mult3Allow,     (n) => MULT3.has(n)],
    [f.mult4Allow,     (n) => MULT4.has(n)],
    [f.mult5Allow,     (n) => MULT5.has(n)],
  ];
  for (const [allow, pred] of checks) {
    if (allow.length === 0) continue;
    let cnt = 0;
    for (const n of c) if (pred(n)) cnt++;
    if (!allow.includes(cnt)) return false;
  }
  return true;
}

// 회차 관계 (그룹 ⑤)
function passRoundFilter(c: number[], f: Filter, prev: number[]): boolean {
  // 직전 데이터 없으면 어떤 회차 관계 필터도 켤 수 없음
  if (prev.length === 0) {
    return f.carryAllow.length === 0 && f.neighborAllow.length === 0 && f.comp45Allow.length === 0;
  }
  if (f.carryAllow.length > 0) {
    const m = c.filter((n) => prev.includes(n)).length;
    if (!f.carryAllow.includes(m)) return false;
  }
  if (f.neighborAllow.length > 0) {
    const neighbors = new Set<number>();
    for (const n of prev) {
      if (n > 1) neighbors.add(n - 1);
      if (n < 45) neighbors.add(n + 1);
    }
    const m = c.filter((n) => neighbors.has(n)).length;
    if (!f.neighborAllow.includes(m)) return false;
  }
  if (f.comp45Allow.length > 0) {
    const comp = new Set(prev.map((n) => 45 - n).filter((n) => n >= 1 && n <= 45));
    const m = c.filter((n) => comp.has(n)).length;
    if (!f.comp45Allow.includes(m)) return false;
  }
  return true;
}

// ─── 패턴 코드 생성 ────────────────────────────────────────
function consecPattern(c: number[]): string {
  const sorted = [...c].sort((a, b) => a - b);
  const groups: number[] = [];
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) run++;
    else { if (run >= 2) groups.push(run); run = 1; }
  }
  if (run >= 2) groups.push(run);
  if (groups.length === 0) return 'none';
  groups.sort((a, b) => b - a);
  return groups.join('+');
}

function sameTailPattern(c: number[]): string {
  const groups: Record<number, number> = {};
  for (const n of c) {
    const d = n % 10;
    groups[d] = (groups[d] || 0) + 1;
  }
  const sizes = Object.values(groups).filter((s) => s >= 2).sort((a, b) => b - a);
  if (sizes.length === 0) return 'none';
  return sizes.join('+');
}

// ─── 활성 카운트 ──────────────────────────────────────────
function countNumActive(f: Filter): number {
  let n = 0;
  if (f.pool.length) n++;
  if (f.fixed.length) n++;
  if (f.exclude.length) n++;
  return n;
}
function countSumActive(f: Filter): number {
  let n = 0;
  if (f.sumMin > 21 || f.sumMax < 255) n++;
  if (f.tailMin > 6 || f.tailMax < 45) n++;
  if (f.oddAllow.length > 0 && f.oddAllow.length < ALL_ODD.length) n++;
  if (f.lowAllow.length > 0 && f.lowAllow.length < ALL_ODD.length) n++;
  if (f.acAllow.length > 0 && f.acAllow.length < 11) n++;
  return n;
}
function countConsecActive(f: Filter): number {
  let n = 0;
  if (f.consecAllow.length > 0) n++;
  if (f.sameTailAllow.length > 0) n++;
  if (f.poolTails.length > 0) n++;
  if (f.requiredTails.length > 0) n++;
  // 5개 구간 중 활성된 것 각각 카운트
  if (f.decade0Allow.length > 0) n++;
  if (f.decade1Allow.length > 0) n++;
  if (f.decade2Allow.length > 0) n++;
  if (f.decade3Allow.length > 0) n++;
  if (f.decade4Allow.length > 0) n++;
  if (f.excludeGoongs.length > 0) n++;
  if (f.includeGoongs.length > 0) n++;
  if (f.segMax < 6) n++;
  if (f.cornerMatch >= 0) n++;
  return n;
}
function countMathActive(f: Filter): number {
  let n = 0;
  if (f.primeAllow.length > 0) n++;
  if (f.compositeAllow.length > 0) n++;
  if (f.twinAllow.length > 0) n++;
  if (f.squareAllow.length > 0) n++;
  if (f.mult3Allow.length > 0) n++;
  if (f.mult4Allow.length > 0) n++;
  if (f.mult5Allow.length > 0) n++;
  return n;
}
function countRoundActive(f: Filter): number {
  let n = 0;
  if (f.carryAllow.length > 0) n++;
  if (f.neighborAllow.length > 0) n++;
  if (f.comp45Allow.length > 0) n++;
  return n;
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: { borderRadius: radius.xl + 2, padding: 20 },
  proPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  funnelTrack: { flex: 1, height: 10, borderRadius: 4, overflow: 'hidden' },

  autoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.xl,
  },
  autoIconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  groupHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  groupDot: { width: 4, height: 22, borderRadius: 2 },
  activeCount: {
    minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center',
  },
  groupBody: { paddingHorizontal: 14, paddingBottom: 16, paddingTop: 4 },

  modeBar: {
    flexDirection: 'row', padding: 4, borderRadius: radius.md, borderWidth: 1, gap: 4,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: radius.sm,
  },
  modeCount: {
    minWidth: 22, height: 18, borderRadius: 9, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },

  hintBox: { marginTop: 10, padding: 10, borderRadius: radius.md, borderWidth: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  cell: {
    width: 38, height: 38, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  dot: {
    position: 'absolute', top: 4, right: 4,
    width: 6, height: 6, borderRadius: 3, opacity: 0.7,
  },
  fixedPin: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8, backgroundColor: GOLD,
    alignItems: 'center', justifyContent: 'center',
  },

  summaryRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    marginTop: 14, alignItems: 'center',
  },
  summaryPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },

  chip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, borderWidth: 1,
  },

  decadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  decadeChip: {
    width: 26, height: 26, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },

  labelBox: { width: 32, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveDot: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
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
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
  },

  presetRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: radius.md, borderWidth: 1,
  },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, borderTopWidth: 1,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  dedupeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: 8,
  },
  countChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    minWidth: 40,
    alignItems: 'center',
  },
  genBtn: {
    height: 52, borderRadius: radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: radius.xl, padding: 20 },
  input: {
    marginTop: 12, height: 44, borderRadius: radius.md, borderWidth: 1,
    paddingHorizontal: 12, fontSize: 16,
  },
  modalBtn: {
    flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
