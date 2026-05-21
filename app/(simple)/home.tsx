/**
 * Simple home — dark "latest round" banner + 4 big tiles + weekly summary.
 * Source: prototype/flow-h1.jsx → H1_SimpleHome
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { AppBar, IconBtn } from '@/src/components/AppBar';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import {
  ac, firstThreeSum, highLowLabel, lastThreeSum, oddEvenLabel,
  tailSum, tensSum, total,
} from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function SimpleHome() {
  const t = useTheme();
  const router = useRouter();
  const draw = useHistory((s) => s.getLatest());
  const isMockData = useHistory((s) => s.isMock);
  const savedCount = useSavedNumbers((s) => s.games.length);
  const [expanded, setExpanded] = useState(false);

  // 새로고침 버튼 상태 — 페치 중에는 아이콘이 회전한다.
  const [refreshing, setRefreshing] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!refreshing) { spin.stopAnimation(); spin.setValue(0); return; }
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [refreshing, spin]);

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
      <AppBar
        title="안녕하세요 👋"
        trailing={
          <>
            <IconBtn onPress={onRefresh}>
              <Animated.View
                style={{
                  transform: [{
                    rotate: spin.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  }],
                }}
              >
                <Icon.refresh color={refreshing ? palette.purple500 : t.fgSecondary} />
              </Animated.View>
            </IconBtn>
            <IconBtn onPress={() => router.push('/(simple)/features' as any)}>
              <Icon.cog color={t.fgSecondary} />
            </IconBtn>
          </>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* Latest-round banner */}
        <View style={[styles.banner, { backgroundColor: bn.bg, borderWidth: isLight ? 1 : 0, borderColor: bn.border }]}>
          <View style={styles.bannerHead}>
            <T variant="label1n" style={{ color: bn.fgMuted, fontWeight: '700', fontSize: 14.5 }}>
              {draw.round}회 · {koreanDate(draw.date)}
            </T>
            <View style={[styles.bannerPill, { backgroundColor: bn.pillBg }]}>
              <T variant="caption1" allowFontScaling={false} style={{ color: bn.fg, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                최신 결과
              </T>
            </View>
          </View>
          {/* 공 영역 — 박스 없이 가운데 정렬, 살짝 작은 사이즈 + 좁은 간격으로 균형. */}
          <View style={{ alignItems: 'center', marginTop: 14, marginBottom: 4 }}>
            <BallRow nums={draw.nums} bonus={draw.bonus} size="sm" style={{ gap: 3 }} />
          </View>

          {/* 회차 한눈에: 합·끝수·홀짝·저고·AC (펼치면 십합·앞세수·뒷세수 추가) */}
          <View style={[styles.analysisRow, { borderTopColor: bn.divider }]}>
            <Metric label="합" value={String(total(draw.nums))} hint={sumHint(total(draw.nums))} bn={bn} />
            <Metric label="끝수" value={String(tailSum(draw.nums))} bn={bn} />
            <Metric label="홀짝" value={oddEvenLabel(draw.nums)} bn={bn} />
            <Metric label="저고" value={highLowLabel(draw.nums)} bn={bn} />
            <Metric label="AC" value={String(ac(draw.nums))} hint={acHint(ac(draw.nums))} bn={bn} />
          </View>

          {expanded && (
            <View style={[styles.analysisRowExtra, { borderTopColor: bn.divider }]}>
              <Metric label="십합" value={String(tensSum(draw.nums))} bn={bn} />
              <Metric label="앞세수합" value={String(firstThreeSum(draw.nums))} bn={bn} />
              <Metric label="뒷세수합" value={String(lastThreeSum(draw.nums))} bn={bn} />
            </View>
          )}

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

          <View style={[styles.row, { marginTop: 14, borderTopWidth: 1, borderTopColor: bn.divider, paddingTop: 12 }]}>
            <T variant="label1r" style={{ color: bn.fgMuted }}>1등 당첨금</T>
            <T variant="label1n" style={{ color: bn.fg, fontWeight: '700' }}>
              {formatWon(draw.firstWinAmount ?? 0)}
              {draw.firstWinners ? <T variant="caption1" style={{ color: bn.fgTertiary }}>{`  ${draw.firstWinners}명`}</T> : null}
            </T>
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

        {/* 내 번호 — wide hero 카드. 큰 숫자로 시각 강조 */}
        <Pressable
          onPress={() => router.push('/(simple)/mine' as any)}
          style={({ pressed }) => [styles.savedHero, { backgroundColor: palette.purple500, opacity: pressed ? 0.92 : 1 }]}
        >
          <View style={styles.savedIconWrap}>
            <Icon.history color="#fff" size={26} weight={1.8} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <T variant="caption1" style={{ color: 'rgba(255,255,255,0.7)', letterSpacing: 1.1, fontWeight: '600' }} allowFontScaling={false}>
              SAVED
            </T>
            {savedCount > 0 ? (
              <>
                <View style={styles.savedCountRow}>
                  <T variant="title1" style={{ color: '#fff', fontWeight: '900', letterSpacing: -0.5 }} allowFontScaling={false}>
                    {savedCount}
                  </T>
                  <T variant="headline2" style={{ color: '#fff', fontWeight: '700', marginLeft: 4 }} allowFontScaling={false}>
                    건 저장
                  </T>
                </View>
                <T variant="caption1" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                  회차별 당첨 결과 확인하기
                </T>
              </>
            ) : (
              <>
                <T variant="headline2" style={{ color: '#fff', fontWeight: '800', marginTop: 2 }}>
                  내 번호
                </T>
                <T variant="caption1" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                  QR 스캔 또는 직접 입력으로 추가
                </T>
              </>
            )}
          </View>
          <Icon.chev color="rgba(255,255,255,0.9)" />
        </Pressable>

        {isMockData && (
          <View style={[styles.warn, { backgroundColor: t.bgWarnSoft, borderColor: t.borderWarn }]}>
            <T variant="caption1" style={{ color: t.fgWarn }} allowFontScaling={false}>
              ⚠️ 회차 데이터는 합성 시드입니다. 실제 동행복권 데이터로 곧 교체됩니다.
            </T>
          </View>
        )}

        <Disclaimer short />
        <View style={{ height: 4 }} />
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
      <T variant="label1n" style={{ color: bn.fg, fontWeight: '700', marginTop: 1, fontSize: 14 }} allowFontScaling={false}>
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

/** 합계가 "낮음/평범/높음" 어느 구간인지 한 단어로. */
function sumHint(sum: number): string {
  if (sum < 100) return '낮음';
  if (sum > 175) return '높음';
  return '평범';
}

/** AC값의 "흩어진 정도"를 한 단어로 (0~3 낮음, 4~6 보통, 7~10 흩어짐). */
function acHint(ac: number): string {
  if (ac <= 3) return '뭉침';
  if (ac >= 7) return '흩어짐';
  return '보통';
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
  banner: { borderRadius: radius.xl + 2, padding: 18 },
  bannerHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  bannerPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  analysisRowExtra: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
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
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '48%',
    height: 132,
    padding: 18,
    borderRadius: 18,
    justifyContent: 'space-between',
  },

  // 내 번호 wide hero
  savedHero: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    minHeight: 96,
  },
  savedIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  checkIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  compatIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  warn: {
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});
