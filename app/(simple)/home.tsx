/**
 * Simple home — dark "latest round" banner + 4 big tiles + weekly summary.
 * Source: prototype/flow-h1.jsx → H1_SimpleHome
 */
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';

/**
 * 홈 상단 인사말 후보 — 로또·운세 테마, 부드럽고 친근한 톤.
 * 도박/당첨 보장 뉘앙스는 피하고 "오늘도 화이팅" 같은 일반 응원 위주.
 */
const GREETINGS: string[] = [
  '안녕하세요 👋',
  '어서오세요 ✨',
  '다시 만나서 반가워요 ✨',
  '오늘도 파이팅! 💪',
  '오늘이 그날일까요? 🍀',
  '행운이 가까이 있어요 🍀',
  '이번 주 번호는 정하셨나요? 🤔',
  '꿈에서 좋은 숫자 보셨어요? 💫',
  '행운을 빌어요 🍀',
  '토요일이 기다려져요 🎲',
  '대박나세요! 💥',
  '복덩이 출근! 🐷',
  '혹시 모르잖아요? 😉',
  '오늘은 어떤 번호일까요? 🎯',
  '행운 충전 완료! 🔋',
  '꿈은 이루어진다 💫',
  '1등 명당 어디일까요? 📍',
  '오늘도 좋은 하루! 🌟',
  '반가워요 ✋',
  '오늘 한 번 가보시죠? 🚀',
  '운명의 6숫자... 👀',
  '1등의 향기가 솔솔 ✨',
  '주말이 더 즐거워질지도? 🎲',
  '복권은 사야 당첨돼요 🎟',
  '오늘은 운수 좋은 날 🌟',
  '지갑이 행복해질지도? 💰',
  '어디 한번 가볼까요? 🎲',
  '오늘도 화이팅! 🚀',
  '돈복이 들어오는 중 💸',
  '주말 응원해요 ✨',
];

/** 직전 인덱스와 다른 새 인덱스 선택 (즉시 반복 방지). */
function pickGreetingIdx(prev: number): number {
  if (GREETINGS.length <= 1) return 0;
  let next = Math.floor(Math.random() * GREETINGS.length);
  while (next === prev) next = Math.floor(Math.random() * GREETINGS.length);
  return next;
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { useLotteryStores } from '@/src/store/lotteryStores';
import { useUserLocation } from '@/src/store/userLocation';
import {
  ac, firstThreeSum, highLowLabel, lastThreeSum, oddEvenLabel,
  rank as computeRank, tailSum, tensSum, total,
} from '@/src/data/lotto';
import { regionKey, detectUserRegion } from '@/src/lib/storeDistance';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function SimpleHome() {
  const t = useTheme();
  const router = useRouter();
  const draw = useHistory((s) => s.getLatest());
  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const isMockData = useHistory((s) => s.isMock);
  const games = useSavedNumbers((s) => s.games);

  // 명당 카드용 — 위치(캐시) + 판매점 데이터
  const stores = useLotteryStores((s) => s.stores);
  const userCoords = useUserLocation((s) => s.coords);
  const userPerm = useUserLocation((s) => s.permission);
  const ensureLocation = useUserLocation((s) => s.ensure);

  // 홈 진입 시 한 번만 위치 확보 (캐시 hit이면 즉시 noop)
  useEffect(() => { ensureLocation(); }, [ensureLocation]);

  // 추첨 예정 — 가장 가까운 다음 회차 = latestRound + 1
  // 보관함에서 그 회차에 저장된 조합 개수 표시 (round == null이면 "다음 회차"라
  // 간주해 같은 회차로 묶음). 여러 회차 분포면 추가 정보 표시.
  const upcoming = useMemo(() => {
    if (!games.length || latestRound == null) return null;
    const nextRound = latestRound + 1;
    // 다음 회차(가장 가까운) 게임 수
    const nextRoundGames = games.filter(
      (g) => g.round == null || g.round === nextRound,
    );
    // 그 이상 미래 회차들도 따로 카운트
    const futureRounds = new Set<number>();
    for (const g of games) {
      if (g.round != null && g.round > nextRound) futureRounds.add(g.round);
    }
    return {
      round: nextRound,
      combos: nextRoundGames.length,
      otherRounds: futureRounds.size,
    };
  }, [games, latestRound]);

  // 이전 회차 결과 — 가장 최근 추첨 완료된 회차 + 등수별 분포
  const prevRoundResult = useMemo(() => {
    if (!games.length || latestRound == null) return null;
    const drawnGames = games.filter((g) => g.round != null && g.round <= latestRound);
    if (drawnGames.length === 0) return null;
    // 가장 큰 round 찾기
    let maxRound = -1;
    for (const g of drawnGames) {
      if (g.round! > maxRound) maxRound = g.round!;
    }
    const targetDraw = drawsMap[maxRound];
    if (!targetDraw) return null;
    const inRound = drawnGames.filter((g) => g.round === maxRound);
    // 등수별 카운트 (1~5등)
    const byRank: Record<number, number> = {};
    let winCount = 0;
    for (const g of inRound) {
      const r = computeRank(g.nums, targetDraw.nums, targetDraw.bonus);
      if (r != null) {
        byRank[r] = (byRank[r] ?? 0) + 1;
        winCount++;
      }
    }
    return { round: maxRound, total: inRound.length, winCount, byRank };
  }, [games, latestRound, drawsMap]);

  // 우리 동네 1등 명당 — 우리 시/군/구 + 직전 회차에 1등 나온 판매점들
  // (있으면 가장 흥미로운 정보) + 일반 최다 배출점 (없으면 fallback)
  const localStores = useMemo(() => {
    if (!userCoords || !stores.length) return null;
    const detected = detectUserRegion(stores, userCoords.lat, userCoords.lng);
    if (!detected || detected.nearestKm > 30) return null;
    const region = detected.region;
    const inRegion = stores.filter(
      (s) => regionKey(s.address) === region && s.count1st > 0,
    );
    if (inRegion.length === 0) return null;
    // 직전 회차에 1등 나온 우리 동네 가게들
    const recentWinners = latestRound
      ? inRegion.filter((s) => s.lastWin1st?.round === latestRound)
      : [];
    // 우리 동네 최다 명당 (count1st 기준)
    const topStore = inRegion.reduce(
      (best, s) => (s.count1st > best.count1st ? s : best),
      inRegion[0],
    );
    return { region, recentWinners, topStore };
  }, [stores, userCoords, latestRound]);

  // 당겨서 새로고침 상태 — RefreshControl이 사용
  const [refreshing, setRefreshing] = useState(false);
  // 배너 분석 메트릭 펼치기 토글
  const [expanded, setExpanded] = useState(false);
  // 인사말 — 마운트 시 랜덤 선택, 새로고침할 때마다 다른 걸로 교체.
  const [greetingIdx, setGreetingIdx] = useState(() => pickGreetingIdx(-1));

  const showToast = (msg: string) => {
    if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    else if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // 웹에서는 alert가 거슬리니까 console만. (네이티브 토스트는 ios에 없음)
      console.log('[refresh]', msg);
    }
  };

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    // 새로고침 트리거 시점에 인사말도 새로 뽑음
    setGreetingIdx((prev) => pickGreetingIdx(prev));
    try {
      const res = await useHistory.getState().autoUpdate({ force: true });
      if (res.skipped === 'web') {
        showToast('웹에서는 자동 갱신을 지원하지 않아요');
      } else if (res.added > 0) {
        showToast(`새 회차 ${res.added}개 업데이트 완료`);
      } else if (res.enriched > 0) {
        showToast('당첨금·판매점 정보 업데이트 완료');
      } else {
        showToast('이미 최신 상태예요');
      }
    } catch {
      showToast('업데이트 실패 — 잠시 후 다시 시도해주세요');
    } finally {
      setRefreshing(false);
    }
  };

  if (!draw) return null; // hydrate not done yet (very rare; <16ms)

  // 라이트/다크에 따라 회차 배너 색 세트를 분기. 다크모드는 기존 logo-black 톤,
  // 라이트모드는 흰 카드 + 다크 텍스트로 주변 화면과 조화롭게.
  const isLight = t.scheme === 'light';
  const bn = {
    bg:         isLight ? t.bgSurface     : palette.neutral950,
    border:     isLight ? t.borderWeak    : 'transparent',
    fg:         isLight ? t.fgPrimary     : '#fff',
    fgMuted:    isLight ? t.fgSecondary   : 'rgba(255,255,255,0.7)',
    fgTertiary: isLight ? t.fgTertiary    : 'rgba(255,255,255,0.55)',
    fgFaint:    isLight ? t.fgDisabled    : 'rgba(255,255,255,0.45)',
    divider:    isLight ? t.borderDivider : 'rgba(255,255,255,0.08)',
    pillBg:     isLight ? t.bgSurface2    : 'rgba(255,255,255,0.12)',
    softBg:     isLight ? t.bgSurface2    : 'rgba(255,255,255,0.06)',
    link:       isLight ? t.fgAccent      : palette.blue300,
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      {/* 인사말 — heading1 대신 heading2 + 700 weight로 부드러운 personal 톤.
          AppBar의 표준 paddingBottom(12)에 맞춰 배너와 간격이 자연스럽게 이어짐. */}
      <AppBar
        title={
          <T variant="heading2" color="primary" style={{ fontWeight: '800', letterSpacing: -0.2 }}>
            {GREETINGS[greetingIdx]}
          </T>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 16, gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.purple500}
            colors={[palette.purple500]}
            // 약간 더 당겨야 트리거되도록 (iOS는 자동, Android는 progressViewOffset)
            progressViewOffset={8}
          />
        }
      >
        {/* Latest-round banner */}
        <View style={[styles.banner, { backgroundColor: bn.bg, borderWidth: isLight ? 1 : 0, borderColor: bn.border }]}>
          <View style={styles.bannerHead}>
            <T variant="label1n" style={{ color: bn.fgMuted, fontWeight: '700', fontSize: 14 }}>
              {draw.round}회 · {koreanDate(draw.date)}
            </T>
            <View style={[styles.bannerPill, { backgroundColor: bn.pillBg }]}>
              <T variant="caption1" allowFontScaling={false} style={{ color: bn.fg, fontSize: 10.5, fontWeight: '700', textAlign: 'center' }}>
                최신 결과
              </T>
            </View>
          </View>
          {/* 공 영역 — 박스 없이 가운데 정렬, 살짝 작은 사이즈 + 좁은 간격으로 균형. */}
          <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
            <BallRow nums={draw.nums} bonus={draw.bonus} size="sm" style={{ gap: 3 }} />
          </View>

          {/* 회차 한눈에: 합·끝수·홀짝·저고·AC (펼치면 십합·앞세수·뒷세수 추가)
              당첨번호 바로 밑이 가장 자연스러운 위치 — 번호의 패턴을 먼저 본 뒤
              당첨금/당첨자 수로 시선이 이어짐. */}
          <View style={[styles.analysisRow, { borderTopColor: bn.divider }]}>
            <Metric label="합" value={String(total(draw.nums))} bn={bn} />
            <Metric label="끝수" value={String(tailSum(draw.nums))} bn={bn} />
            <Metric label="홀짝" value={oddEvenLabel(draw.nums)} bn={bn} />
            <Metric label="저고" value={highLowLabel(draw.nums)} bn={bn} />
            <Metric label="AC" value={String(ac(draw.nums))} bn={bn} />
          </View>

          {expanded && (
            <View style={[styles.analysisRowExtra, { borderTopColor: bn.divider }]}>
              <Metric label="십합" value={String(tensSum(draw.nums))} bn={bn} />
              <Metric label="앞세수합" value={String(firstThreeSum(draw.nums))} bn={bn} />
              <Metric label="뒷세수합" value={String(lastThreeSum(draw.nums))} bn={bn} />
            </View>
          )}

          {/* 1~3등 당첨금 + 당첨자 수 — 분석 메트릭 아래 */}
          <View style={[styles.prizeTopRow, { borderTopColor: bn.divider }]}>
            <PrizeMini
              label="1등"
              labelColor={palette.blue700}
              amount={draw.firstWinAmount ?? draw.prizes?.first?.amount}
              winners={draw.firstWinners ?? draw.prizes?.first?.winners}
              bn={bn}
            />
            <View style={[styles.prizeMiniDivider, { backgroundColor: bn.divider }]} />
            <PrizeMini
              label="2등"
              labelColor={palette.green700}
              amount={draw.prizes?.second?.amount}
              winners={draw.prizes?.second?.winners}
              bn={bn}
            />
            <View style={[styles.prizeMiniDivider, { backgroundColor: bn.divider }]} />
            <PrizeMini
              label="3등"
              labelColor={palette.purple500}
              amount={draw.prizes?.third?.amount}
              winners={draw.prizes?.third?.winners}
              bn={bn}
            />
          </View>

          {/* "자세히 보기" 펼침 토글 + 회차 상세 페이지로 가는 링크 */}
          <View style={styles.detailRow}>
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              hitSlop={6}
              style={({ pressed }) => [styles.expandBtn, { backgroundColor: bn.softBg, opacity: pressed ? 0.7 : 1 }]}
            >
              <T variant="caption1" style={{ color: bn.fgMuted, fontWeight: '600' }} allowFontScaling={false}>
                {expanded ? '간단히 닫기' : '자세히 보기'}
              </T>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/round/${draw.round}` as any)}
              hitSlop={6}
              style={({ pressed }) => [styles.detailLink, { opacity: pressed ? 0.7 : 1 }]}
            >
              <T variant="caption1" style={{ color: bn.link, fontWeight: '700' }} allowFontScaling={false}>
                회차 상세
              </T>
              <Icon.chev color={bn.link} size={14} weight={2.2} />
            </Pressable>
          </View>
        </View>

        {/* 4 big tiles */}
        <View style={styles.grid}>
          <Tile
            tone="accent"
            cap="Recommend"
            title="조합 생성"
            icon={<Icon.sparkle color="#fff" size={22} />}
            onPress={() => router.push('/(simple)/gen' as any)}
          />
          <Tile
            tone="dark"
            cap="Scan"
            title="QR 스캔 저장"
            icon={<Icon.qr color={isLight ? t.fgPrimary : '#fff'} size={22} weight={1.8} />}
            onPress={() => router.push('/scan' as any)}
          />
        </View>

        {/* 내 번호 — wide hero (칸 안의 칸 구조).
            윗 칸: 추첨 예정 회차 + 조합 수 / 아랫 칸: 이전 회차 등수별 결과 */}
        <Pressable
          onPress={() => router.push('/(simple)/mine' as any)}
          style={({ pressed }) => [styles.savedHero, { backgroundColor: palette.purple500, opacity: pressed ? 0.92 : 1 }]}
        >
          {games.length === 0 ? (
            <View style={styles.savedRow}>
              <View style={styles.savedIconWrap}>
                <Icon.history color="#fff" size={22} weight={1.8} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T variant="caption1" allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.75)', letterSpacing: 1.1, fontWeight: '700' }}>
                  MY NUMBERS
                </T>
                <T variant="headline2" style={{ color: '#fff', fontWeight: '800', marginTop: 2 }}>
                  내 번호 추가하기
                </T>
                <T variant="caption1" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 1, fontSize: 11.5 }}>
                  QR 스캔 또는 직접 입력으로
                </T>
              </View>
              <Icon.chev color="rgba(255,255,255,0.9)" />
            </View>
          ) : (
            <>
              {/* 윗 칸 — 추첨 예정 */}
              <View style={styles.savedRow}>
                <View style={styles.savedIconWrap}>
                  <Icon.history color="#fff" size={22} weight={1.8} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <T variant="caption1" allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.75)', letterSpacing: 1.1, fontWeight: '700' }}>
                    MY NUMBERS
                  </T>
                  {upcoming && upcoming.combos > 0 ? (
                    <>
                      <T variant="headline2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', marginTop: 2, fontSize: 15 }}>
                        {upcoming.round}회차 추첨 예정
                      </T>
                      <T variant="caption1" allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.85)', marginTop: 1, fontSize: 11.5 }}>
                        보관함 {upcoming.combos}개 조합
                        {upcoming.otherRounds > 0 ? ` · 미래 ${upcoming.otherRounds}개 회차 더` : ''}
                      </T>
                    </>
                  ) : (
                    <>
                      <T variant="headline2" style={{ color: '#fff', fontWeight: '800', marginTop: 2, fontSize: 15 }}>
                        추첨 예정 조합 없음
                      </T>
                      <T variant="caption1" allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.85)', marginTop: 1, fontSize: 11.5 }}>
                        새 조합을 보관함에 추가해보세요
                      </T>
                    </>
                  )}
                </View>
                <Icon.chev color="rgba(255,255,255,0.9)" />
              </View>

              {/* 칸 안의 칸 — 이전 회차 결과 */}
              {prevRoundResult && (
                <View style={styles.innerBox}>
                  <T variant="caption1" allowFontScaling={false} style={{ color: 'rgba(255,255,255,0.95)', fontSize: 12, lineHeight: 17 }} numberOfLines={2}>
                    {formatPrevResult(prevRoundResult)}
                  </T>
                </View>
              )}
            </>
          )}
        </Pressable>

        {/* 우리 동네 1등 명당 — 칸 안의 칸 구조 */}
        <Pressable
          onPress={() => router.push('/store-finder' as any)}
          style={({ pressed }) => [
            styles.storeCard,
            {
              backgroundColor: t.bgSurface,
              borderColor: t.borderWeak,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          {/* 윗 칸 — 카드 제목/소제목 */}
          <View style={styles.storeRow}>
            <View style={styles.storeIconBox}>
              <T allowFontScaling={false} style={{ fontSize: 22 }}>📍</T>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T variant="caption1" allowFontScaling={false} style={{ color: '#d97706', letterSpacing: 1.1, fontWeight: '700' }}>
                NEAR ME
              </T>
              <T variant="headline2" style={{ color: t.fgPrimary, fontWeight: '800', marginTop: 2, fontSize: 15 }}>
                우리 동네 1등 명당
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 1, fontSize: 11.5 }}>
                {userPerm === 'denied' ? '위치 권한 허용 시 우리 동네 확인 가능' : '가까운 판매점 찾기'}
              </T>
            </View>
            <Icon.chev color={t.fgTertiary} />
          </View>

          {/* 칸 안의 칸 — 직전 회차 우리 동네 1등 배출점 정보 */}
          {localStores && (localStores.recentWinners.length > 0 || localStores.topStore) && (
            <View style={[styles.innerBoxLight, { borderTopColor: t.borderDivider }]}>
              {localStores.recentWinners.length > 0 ? (
                <T variant="caption1" allowFontScaling={false} style={{ color: t.fgPrimary, fontSize: 12, fontWeight: '700', lineHeight: 17 }} numberOfLines={2}>
                  🎉 {formatRecentWinners(localStores.recentWinners.map((s) => s.name), latestRound)}
                </T>
              ) : (
                <T variant="caption1" allowFontScaling={false} style={{ color: t.fgSecondary, fontSize: 11.5, lineHeight: 16 }} numberOfLines={2}>
                  🏆 {localStores.region} 최다 명당: {localStores.topStore.name} (1등 {localStores.topStore.count1st}회)
                </T>
              )}
            </View>
          )}
        </Pressable>

        {/* 통계 면책 — 하단 탭 위로 자연스럽게 노출 */}
        <Disclaimer short />

        {isMockData && (
          <View style={[styles.warn, { backgroundColor: t.bgWarnSoft, borderColor: t.borderWarn }]}>
            <T variant="caption1" style={{ color: t.fgWarn }} allowFontScaling={false}>
              ⚠️ 회차 데이터는 합성 시드입니다. 실제 동행복권 데이터로 곧 교체됩니다.
            </T>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({
  tone,
  cap,
  title,
  sub,
  icon,
  onPress,
  wide,
}: {
  tone?: 'accent' | 'dark';
  cap: string;
  title: string;
  sub?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  /** Span the full row instead of 48% width. */
  wide?: boolean;
}) {
  const t = useTheme();
  const isLight = t.scheme === 'light';
  // tone='accent': 항상 파란 브랜드 컬러 (둘 다 모드에서 동일)
  // tone='dark': 다크 모드는 검은 카드, 라이트 모드는 흰 표면 + 검은 텍스트
  // tone=undefined: 일반 카드 표면
  const isDarkTile = tone === 'dark';
  const isAccent = tone === 'accent';
  const bg = isAccent ? t.bgAccent
           : isDarkTile ? (isLight ? t.bgSurface : palette.neutral900)
           : t.bgSurface;
  const fg = isAccent ? '#fff'
           : isDarkTile ? (isLight ? t.fgPrimary : '#fff')
           : t.fgPrimary;
  const capFg = isAccent ? 'rgba(255,255,255,0.7)'
              : isDarkTile ? (isLight ? t.fgTertiary : 'rgba(255,255,255,0.7)')
              : t.fgTertiary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tile,
        wide && { width: '100%', height: 96, flexDirection: 'row', alignItems: 'center', gap: 16 },
        {
          backgroundColor: bg,
          borderColor: isAccent ? 'transparent' : (isDarkTile && !isLight ? 'transparent' : t.borderWeak),
          borderWidth: isAccent ? 0 : (isDarkTile && !isLight ? 0 : 1),
        },
      ]}
    >
      <View>{icon}</View>
      <View>
        <T variant="caption1" style={{ color: capFg, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {cap}
        </T>
        <T variant="headline2" style={{ color: fg, fontWeight: '700', marginTop: 4 }}>{title}</T>
        {sub && <T variant="caption1" style={{ color: capFg, marginTop: 2 }}>{sub}</T>}
      </View>
    </Pressable>
  );
}

/**
 * 회차 배너 안 개별 메트릭.
 * 다크모드: 흰 텍스트 / 라이트모드: 일반 텍스트 — `bn` 컬러 세트로 받아옴.
 */
type BannerColors = {
  fg: string; fgMuted: string; fgTertiary: string; fgFaint: string;
};
function Metric({ label, value, hint, bn }: { label: string; value: string; hint?: string; bn: BannerColors }) {
  return (
    <View style={styles.metric}>
      <T variant="caption2" style={{ color: bn.fgTertiary, fontSize: 9.5, letterSpacing: 0.3 }} allowFontScaling={false}>
        {label}
      </T>
      <T variant="label1n" style={{ color: bn.fg, fontWeight: '700', marginTop: 1, fontSize: 13 }} allowFontScaling={false}>
        {value}
      </T>
      {hint && (
        <T variant="caption2" style={{ color: bn.fgFaint, fontSize: 9, marginTop: 1 }} allowFontScaling={false}>
          {hint}
        </T>
      )}
    </View>
  );
}

/**
 * 1~3등 미니 카드 — 등수 라벨, 금액, 당첨자 수.
 */
function PrizeMini({
  label,
  labelColor,
  amount,
  winners,
  bn,
}: {
  label: string;
  labelColor: string;
  amount?: number;
  winners?: number;
  bn: BannerColors;
}) {
  return (
    <View style={styles.prizeMini}>
      <T variant="caption2" style={{ color: labelColor, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 }} allowFontScaling={false}>
        {label}
      </T>
      <T variant="label1n" style={{ color: bn.fg, fontWeight: '800', marginTop: 3, fontSize: 12.5 }} numberOfLines={1} allowFontScaling={false}>
        {amount && amount > 0 ? formatWonShort(amount) : '—'}
      </T>
      <T variant="caption2" style={{ color: bn.fgTertiary, fontSize: 9.5, marginTop: 1 }} allowFontScaling={false}>
        {winners != null && winners > 0 ? `${winners.toLocaleString('ko')}명` : '—'}
      </T>
    </View>
  );
}

/**
 * 이전 회차 결과 한 줄 표시.
 * 1·2등은 단독 강조, 4·5등은 묶어서. 미당첨이면 그렇게 표시.
 */
function formatPrevResult(r: { round: number; total: number; winCount: number; byRank: Record<number, number> }): string {
  if (r.winCount === 0) {
    return `${r.round}회 · ${r.total}게임 모두 미당첨`;
  }
  // 상위 등수부터 표시 (1, 2, 3등 단독), 4·5등은 묶어서
  const parts: string[] = [];
  const high = [1, 2, 3].filter((rk) => r.byRank[rk] > 0);
  for (const rk of high) parts.push(`${rk}등 ${r.byRank[rk]}개`);
  const lowSum = (r.byRank[4] ?? 0) + (r.byRank[5] ?? 0);
  if (lowSum > 0) {
    // 4·5등 둘 다 있으면 묶기, 한 쪽만 있으면 개별 표시
    if (r.byRank[4] > 0 && r.byRank[5] > 0) {
      parts.push(`4·5등 ${lowSum}개`);
    } else if (r.byRank[4] > 0) {
      parts.push(`4등 ${r.byRank[4]}개`);
    } else if (r.byRank[5] > 0) {
      parts.push(`5등 ${r.byRank[5]}개`);
    }
  }
  return `🎉 ${r.round}회 · ${parts.join(' · ')} 당첨!`;
}

/**
 * 우리 동네 직전 회차 1등 배출점 한 줄 표시.
 * 1곳: "행운복권방에서 1225회 1등이 나왔어요!"
 * 여러 곳: "행운복권방 외 N곳에서 1225회 1등이 나왔어요!"
 */
function formatRecentWinners(names: string[], round: number | null): string {
  if (names.length === 0) return '';
  const first = names[0];
  if (names.length === 1) return `${first}에서 ${round}회 1등이 나왔어요!`;
  return `${first} 외 ${names.length - 1}곳에서 ${round}회 1등이 나왔어요!`;
}

/** 짧은 당첨금 표기: 1등은 "22억", 2등은 "6,352만", 3등은 "144만" */
function formatWonShort(n: number): string {
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  if (eok > 0) {
    return man > 0 ? `${eok}억${man.toLocaleString('ko')}만` : `${eok}억`;
  }
  if (man > 0) return `${man.toLocaleString('ko')}만`;
  return `${n.toLocaleString('ko')}원`;
}

function koreanDate(iso: string): string {
  // '2025-05-09' → '5월 9일 (토)'
  const d = new Date(iso + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function formatWon(n: number): string {
  // 2_142_870_000 → '21억 4,287만원'
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  if (eok === 0) return `${man.toLocaleString('ko')}만원`;
  if (man === 0) return `${eok}억원`;
  return `${eok}억 ${man.toLocaleString('ko')}만원`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: { borderRadius: radius.xl + 2, padding: 14 },
  bannerHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 6,
  },
  bannerPill: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeTopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  prizeMini: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  prizeMiniDivider: {
    width: 1,
    marginVertical: 4,
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  analysisRowExtra: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  expandBtn: {
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: radius.sm,
  },
  detailLink: {
    paddingVertical: 4, paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailLinkOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    marginTop: 10,
    paddingVertical: 4,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: '48%',
    height: 96,
    padding: 14,
    borderRadius: 16,
    justifyContent: 'space-between',
  },

  // 내 번호 wide hero — 컴팩트, 칸 안의 칸 구조 지원 (column layout)
  savedHero: {
    padding: 14,
    borderRadius: 16,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  // 칸 안의 칸 — 보라 hero 내부, 우리 동네 카드의 innerBoxLight와 동일한 톤
  // (배경 없음, 흰색 hairline 구분선만)
  innerBox: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.22)',
  },
  // 칸 안의 칸 — 라이트 카드 내부의 구분선 (보더만)
  innerBoxLight: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  compatIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  // 우리 동네 판매점 카드 — SAVED hero보다 한 단계 부드러운 톤
  storeCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  storeIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center', justifyContent: 'center',
  },

  warn: {
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});
