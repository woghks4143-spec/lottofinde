/**
 * 당첨 판매점 찾기 — /store-finder
 *
 * 정렬 모드:
 *   - near        : 내 시/군/구 + 거리순
 *   - firstLocal  : 내 시/군/구 + 1등 횟수순
 *   - firstNational: 전국 + 1등 횟수순
 *
 * 사용자 시/군/구는 가장 가까운 판매점의 주소에서 추출. 권한 거부 / 위치 실패 시
 * firstNational만 활성화하고 다른 두 모드는 잠금.
 *
 * 탭하면 카카오맵 → 네이버맵 → 구글맵 deep link로 길찾기.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { useLotteryStores, type LotteryStore } from '@/src/store/lotteryStores';
import { useUserLocation } from '@/src/store/userLocation';
import {
  haversineKm,
  formatDistance,
  shortAddress,
  regionKey,
  detectUserRegion,
} from '@/src/lib/storeDistance';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

type SortMode = 'near' | 'firstLocal' | 'firstNational';

const INITIAL_LIMIT = 50;
const PAGE_SIZE = 50;
// 시/군/구 region 신뢰 한계 — 가장 가까운 판매점이 이 거리보다 멀면
// region 매칭 신뢰 X (대부분 도심에선 5km 이내 1개 이상 있음).
const REGION_MAX_KM = 30;

// 성능: 5,031개 항목에 spread `{...s, distanceKm}` 안 함.
// 원본 LotteryStore 참조를 그대로 쓰고, 거리는 별도 Map으로 조회.

export default function StoreFinder() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/features');
  const allStores = useLotteryStores((s) => s.stores);
  const latestRound = useLotteryStores((s) => s.latestRound);

  // 위치 — Zustand 스토어 (5분 캐시). 화면 들어갔다 나가도 GPS 재호출 X.
  const coords = useUserLocation((s) => s.coords);
  const permStatus = useUserLocation((s) => s.permission);
  const loading = useUserLocation((s) => s.loading);
  const error = useUserLocation((s) => s.error);
  const ensureLocation = useUserLocation((s) => s.ensure);
  const refreshLocation = useUserLocation((s) => s.refresh);

  const [sortMode, setSortMode] = useState<SortMode>('near');
  const [limit, setLimit] = useState(INITIAL_LIMIT);

  const isWeb = Platform.OS === 'web';

  // 마운트 시 위치 보장 — 캐시 hit이면 즉시 종료, 아니면 권한+GPS 요청
  useEffect(() => {
    ensureLocation();
  }, [ensureLocation]);

  // 권한 없음/웹/에러일 때 정렬 모드 자동 보정
  useEffect(() => {
    if (isWeb || permStatus === 'denied' || (error && !coords)) {
      setSortMode('firstNational');
    }
  }, [isWeb, permStatus, error, coords]);

  // 사용자 region 추정 (가장 가까운 판매점 주소 기준)
  const userRegion = useMemo(() => {
    if (!coords) return null;
    const detected = detectUserRegion(allStores, coords.lat, coords.lng);
    if (!detected) return null;
    if (detected.nearestKm > REGION_MAX_KM) return null; // 너무 먼 경우 신뢰 X
    return detected.region;
  }, [allStores, coords]);

  const canLocal = !!userRegion; // 내 지역 정렬 가능 여부

  // 거리 Map — 영역 안 판매점만 계산. 전국 모드는 거리 표시 안 하므로 불필요.
  // (전체 5,031개 haversine은 ~5ms지만 spread+sort 제거가 핵심.)
  const distMap = useMemo(() => {
    if (!coords) return null;
    const m = new Map<string, number>();
    // firstNational 모드일 땐 거리가 어차피 표시 안 되니 계산도 스킵
    if (sortMode === 'firstNational') return m;
    const target = userRegion
      ? allStores.filter((s) => regionKey(s.address) === userRegion)
      : allStores;
    for (const s of target) {
      m.set(s.id, haversineKm(coords.lat, coords.lng, s.lat, s.lng));
    }
    return m;
  }, [allStores, coords, sortMode, userRegion]);

  // 정렬/필터 결과 — LotteryStore[] 그대로 반환 (객체 spread X)
  const ranked: LotteryStore[] = useMemo(() => {
    // 전국 모드: stores.json이 이미 count1st DESC로 정렬돼 있어서 그대로 반환.
    // 정렬도, 매핑도 X — O(1) 반환. 가장 큰 성능 이득.
    if (sortMode === 'firstNational') {
      return allStores;
    }

    // 내 지역 모드: 영역 필터 (보통 ~5~100개로 줄어듦)
    if (!canLocal) return [];
    const inRegion = allStores.filter((s) => regionKey(s.address) === userRegion);

    if (sortMode === 'near') {
      if (!coords || !distMap) return inRegion;
      // toSorted 대신 새 배열 후 정렬
      const arr = inRegion.slice();
      arr.sort((a, b) => {
        const da = distMap.get(a.id) ?? 1e9;
        const db = distMap.get(b.id) ?? 1e9;
        return da - db;
      });
      return arr;
    }

    // firstLocal
    const arr = inRegion.slice();
    arr.sort((a, b) => {
      if (b.count1st !== a.count1st) return b.count1st - a.count1st;
      if (b.count2nd !== a.count2nd) return b.count2nd - a.count2nd;
      const da = distMap?.get(a.id) ?? 1e9;
      const db = distMap?.get(b.id) ?? 1e9;
      return da - db;
    });
    return arr;
  }, [allStores, userRegion, coords, sortMode, canLocal, distMap]);

  // 정렬 모드 변경 시 페이지 리셋
  useEffect(() => {
    setLimit(INITIAL_LIMIT);
  }, [sortMode]);

  // limit 변경 시에만 slice (ranked가 같은 참조면 limit 동일할 때 재계산 X)
  const visible = useMemo(() => ranked.slice(0, limit), [ranked, limit]);
  const canLoadMore = limit < ranked.length;

  const openMaps = useCallback((store: LotteryStore) => {
    const q = encodeURIComponent(`${store.name} ${store.address}`);
    // 폴백 순서: 카카오맵앱 → 네이버맵앱 → 카카오맵 웹 → 구글맵 웹
    // canOpenURL은 iOS/Android의 scheme allowlist 등록이 필요해서 신뢰성 낮음.
    // openURL을 직접 try하고 실패 시 catch로 폴백.
    const tryUrls = [
      `kakaomap://search?q=${q}`,
      `nmap://search?query=${q}`,
      `https://map.kakao.com/link/search/${q}`,
      `https://www.google.com/maps/search/?api=1&query=${q}`,
    ];
    (async () => {
      for (const url of tryUrls) {
        try {
          await Linking.openURL(url);
          return;
        } catch {
          // 다음 폴백 시도
        }
      }
    })();
  }, []);

  // FlatList renderItem — useCallback으로 함수 안정화 → StoreCard memo가 효과적
  const showDistance = sortMode === 'near' || (sortMode === 'firstLocal' && !!coords);
  const showRank = sortMode !== 'near';
  const renderItem = useCallback(
    ({ item, index }: { item: LotteryStore; index: number }) => (
      <StoreCard
        store={item}
        rank={showRank ? index + 1 : null}
        distanceKm={showDistance ? distMap?.get(item.id) ?? null : null}
        onPress={openMaps}
      />
    ),
    [showRank, showDistance, distMap, openMaps],
  );

  const keyExtractor = useCallback((item: LotteryStore) => item.id, []);

  const openSystemSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:').catch(() => {});
    } else {
      Linking.openSettings().catch(() => {});
    }
  };

  const retryLocation = async () => {
    await refreshLocation();
    // 새로 위치 받았으면 가까운 순으로 정렬 모드 변경
    if (useUserLocation.getState().coords) {
      setSortMode('near');
    }
  };

  // 헤더 텍스트
  const heroTitle = (() => {
    if (loading) return '위치를 확인하는 중...';
    if (isWeb) return '모바일 앱에서 위치 기반 검색이 가능해요';
    if (permStatus === 'denied') return '위치 권한이 꺼져 있어요';
    if (sortMode === 'firstNational') return '전국 명당 순';
    if (userRegion) {
      if (sortMode === 'near') return `${userRegion} · 가까운 순`;
      return `${userRegion} · 1등 명당 순`;
    }
    return '판매점 목록';
  })();

  const heroSub = (() => {
    if (loading) return null;
    if (isWeb) return '현재는 전국 명당 TOP을 표시합니다';
    if (permStatus === 'denied') return '전국 명당 TOP을 우선 표시합니다';
    if (sortMode === 'firstNational') return `${ranked.length.toLocaleString()}개 · ~${latestRound}회 기준`;
    if (userRegion) return `${ranked.length.toLocaleString()}개 · ~${latestRound}회 기준`;
    return null;
  })();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="당첨 판매점 찾기" onBack={goBack} />

      <FlatList
        data={visible}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 10 }}
        showsVerticalScrollIndicator={false}
        // 성능: 초기 렌더 줄이고 스크롤 시 점진적 마운트
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={50}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 6 }}>
            {/* 상태 카드 */}
            <Card padding={14}>
              <View style={styles.heroRow}>
                <T allowFontScaling={false} style={{ fontSize: 22 }}>📍</T>
                <View style={{ flex: 1 }}>
                  {loading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color={palette.purple500} />
                      <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                        {heroTitle}
                      </T>
                    </View>
                  ) : (
                    <>
                      <T
                        variant="label1n"
                        color={permStatus === 'denied' ? undefined : 'primary'}
                        style={{
                          fontWeight: '800',
                          color: permStatus === 'denied' ? palette.red500 : undefined,
                        }}
                      >
                        {heroTitle}
                      </T>
                      {heroSub && (
                        <T variant="caption1" color="tertiary" style={{ fontSize: 11.5, marginTop: 2 }}>
                          {heroSub}
                        </T>
                      )}
                    </>
                  )}
                </View>
                {!loading && permStatus !== 'granted' && !isWeb && (
                  <Pressable
                    onPress={permStatus === 'denied' ? openSystemSettings : retryLocation}
                    style={({ pressed }) => [styles.miniBtn, { borderColor: palette.purple500, opacity: pressed ? 0.85 : 1 }]}
                  >
                    <T variant="caption1" style={{ color: palette.purple500, fontWeight: '800', fontSize: 11.5 }}>
                      {permStatus === 'denied' ? '⚙ 설정' : '🔄 재시도'}
                    </T>
                  </Pressable>
                )}
              </View>
              {error && (
                <T variant="caption2" style={{ color: palette.red500, fontSize: 11, marginTop: 8 }}>
                  {error}
                </T>
              )}
            </Card>

            {/* 정렬 모드 칩 (3개) */}
            <View style={styles.sortRow}>
              <SortChip
                label="가까운 순"
                desc="내 지역"
                active={sortMode === 'near'}
                disabled={!canLocal}
                onPress={() => setSortMode('near')}
              />
              <SortChip
                label="1등 명당 순"
                desc="내 지역"
                active={sortMode === 'firstLocal'}
                disabled={!canLocal}
                onPress={() => setSortMode('firstLocal')}
              />
              <SortChip
                label="전국 명당 순"
                desc="전국"
                active={sortMode === 'firstNational'}
                onPress={() => setSortMode('firstNational')}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <Card padding={20}>
              <T variant="label1n" color="primary" style={{ textAlign: 'center', fontWeight: '800' }}>
                {!canLocal && sortMode !== 'firstNational'
                  ? '내 지역을 확인할 수 없어요'
                  : '내 지역에 1등 배출점이 없어요'}
              </T>
              <T variant="caption1" color="tertiary" style={{ textAlign: 'center', marginTop: 6, fontSize: 12, lineHeight: 18 }}>
                전국 명당 순으로 보면{'\n'}유명 명당들을 확인할 수 있어요
              </T>
              <Pressable
                onPress={() => setSortMode('firstNational')}
                style={({ pressed }) => [styles.emptyBtn, { backgroundColor: palette.purple500, opacity: pressed ? 0.85 : 1 }]}
              >
                <T variant="caption1" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                  전국 명당 순 보기 →
                </T>
              </Pressable>
            </Card>
          ) : null
        }
        ListFooterComponent={
          canLoadMore ? (
            <Pressable
              onPress={() => setLimit((n) => n + PAGE_SIZE)}
              style={({ pressed }) => [
                styles.moreBtn,
                { backgroundColor: t.bgSurface2, borderColor: t.borderDivider, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                {PAGE_SIZE}개 더 보기 ({ranked.length - limit}개 남음)
              </T>
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

/* ─── StoreCard ─────────────────────────────────────────────────────────── */
// memo: props 변경 안 됐을 때 재렌더 스킵 → 스크롤 성능 +
const StoreCard = memo(function StoreCard({ store, rank, distanceKm, onPress }: {
  store: LotteryStore;
  rank: number | null;
  /** null이면 거리 박스 숨김. 숫자면 km 단위. */
  distanceKm: number | null;
  /** memo 효과 보존하려면 부모에서 useCallback으로 안정화. */
  onPress: (store: LotteryStore) => void;
}) {
  const t = useTheme();
  const last1st = store.lastWin1st;
  const handlePress = useCallback(() => onPress(store), [onPress, store]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <Card padding={14}>
        {/* 상단: 이름 + (순위 or 거리) */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {rank != null && (
                <View style={[styles.rankBadge, { backgroundColor: rank <= 3 ? palette.purple500 : t.bgSurface2 }]}>
                  <T allowFontScaling={false} style={{
                    color: rank <= 3 ? '#fff' : t.fgSecondary,
                    fontWeight: '800',
                    fontSize: 11,
                  }}>
                    {rank}
                  </T>
                </View>
              )}
              <T variant="headline2" color="primary" style={{ fontWeight: '800', flex: 1 }} numberOfLines={2}>
                {store.name}
              </T>
            </View>
            <T variant="caption1" color="tertiary" style={{ fontSize: 11.5, marginTop: 3 }} numberOfLines={2}>
              {store.address}
            </T>
          </View>
          {distanceKm != null && (
            <View style={[styles.distBox, { backgroundColor: palette.purple50 }]}>
              <T variant="caption1" style={{ color: palette.purple500, fontWeight: '800', fontSize: 12.5 }}>
                {formatDistance(distanceKm)}
              </T>
              <T variant="caption2" style={{ color: palette.purple500, fontSize: 9.5, marginTop: 1 }}>
                {shortAddress(store.address)}
              </T>
            </View>
          )}
        </View>

        {/* 배지 + 안내 */}
        <View style={[styles.badgeRow, { marginTop: 10 }]}>
          {store.count1st > 0 && (
            <View style={[styles.badge, { backgroundColor: palette.red500 }]}>
              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>
                🏆 1등 {store.count1st}회 배출
              </T>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <T variant="caption2" color="tertiary" style={{ fontSize: 10.5 }}>
            지도 앱에서 보기 ↗
          </T>
        </View>

        {/* 마지막 1등 당첨 */}
        {last1st && (
          <View style={[styles.lastWinRow, { borderTopColor: t.borderDivider }]}>
            <T variant="caption2" color="tertiary" style={{ fontSize: 10.5 }}>
              최근 1등 · {last1st.round}회 ({last1st.date})
            </T>
          </View>
        )}
      </Card>
    </Pressable>
  );
});

/* ─── SortChip ──────────────────────────────────────────────────────────── */
function SortChip({ label, desc, active, disabled, onPress }: {
  label: string;
  desc: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.sortChip,
        {
          backgroundColor: active && !disabled ? palette.purple500 : t.bgSurface,
          borderColor: active && !disabled ? palette.purple500 : t.borderDivider,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <T
        variant="caption1"
        allowFontScaling={false}
        style={{
          color: active && !disabled ? '#fff' : t.fgPrimary,
          fontWeight: '800',
          fontSize: 12,
          textAlign: 'center',
        }}
      >
        {label}
      </T>
      <T
        variant="caption2"
        allowFontScaling={false}
        style={{
          color: active && !disabled ? 'rgba(255,255,255,0.85)' : t.fgTertiary,
          fontSize: 9.5,
          marginTop: 2,
          textAlign: 'center',
        }}
      >
        {desc}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },

  sortRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sortChip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rankBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    alignItems: 'center',
    minWidth: 72,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  lastWinRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  emptyBtn: {
    marginTop: 14,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
  moreBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
});
