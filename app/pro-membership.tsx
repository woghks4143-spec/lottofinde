/**
 * PRO 멤버십 결제 화면 — /pro-membership
 *
 * 사용자가 PRO 기능 진입 시 권한 없으면 이 화면으로 redirect.
 * RevenueCat을 통해 결제·복원 처리.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  PRODUCT_ID_MONTHLY,
  PRODUCT_ID_YEARLY,
} from '@/src/lib/revenuecat';
import { useMembership } from '@/src/store/membership';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';
import backtest from '@/data/jachanism/backtest.json';

const GOLD = '#e8b04e';

// 백테스트 데이터 — 매주 GitHub Actions가 갱신 → 자동 반영
const STATS = {
  rounds: backtest.roundsTested,
  rank1: backtest.rank1,
  rank2: backtest.rank2,
  rank3: backtest.rank3,
  rank4: backtest.rank4,
  rank5: backtest.rank5,
  avgRank3: (backtest.rank3 / backtest.roundsTested).toFixed(1),
  avgRank4: Math.round(backtest.rank4 / backtest.roundsTested),
  avgRank5: Math.round(backtest.rank5 / backtest.roundsTested),
};

export default function ProMembership() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/pro');
  const isPro = useMembership((s) => s.isProActive());
  const refresh = useMembership((s) => s.refresh);

  const [offerings, setOfferings] = useState<{
    monthly: PurchasesPackage | null;
    yearly: PurchasesPackage | null;
  }>({ monthly: null, yearly: null });
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // 부팅 시 RevenueCat에서 상품 목록 불러오기
  useEffect(() => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const offering = await getOfferings();
        if (!offering) {
          setLoading(false);
          return;
        }
        let monthly: PurchasesPackage | null = null;
        let yearly: PurchasesPackage | null = null;
        for (const pkg of offering.availablePackages) {
          if (pkg.product.identifier === PRODUCT_ID_MONTHLY) monthly = pkg;
          if (pkg.product.identifier === PRODUCT_ID_YEARLY) yearly = pkg;
        }
        setOfferings({ monthly, yearly });
      } catch (e) {
        showToast('상품 정보를 불러오지 못했어요');
      } finally {
        setLoading(false);
      }
    })();
  }, [showToast]);

  const handlePurchase = async () => {
    if (Platform.OS === 'web') {
      showToast('웹에서는 결제를 지원하지 않아요');
      return;
    }
    if (purchasing) return;
    const pkg = selectedPlan === 'yearly' ? offerings.yearly : offerings.monthly;
    if (!pkg) {
      showToast('상품 정보를 다시 불러오는 중이에요');
      return;
    }
    setPurchasing(true);
    try {
      const info = await purchasePackage(pkg);
      if (info) {
        await refresh();
        showToast('🎉 PRO가 시작됐어요!');
        setTimeout(() => router.replace('/(simple)/pro' as any), 1000);
      }
    } catch (e) {
      showToast('결제 처리 중 오류가 발생했어요');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (Platform.OS === 'web') return;
    if (purchasing) return;
    setPurchasing(true);
    try {
      await restorePurchases();
      await refresh();
      if (useMembership.getState().isPro) {
        showToast('이전 구매가 복원됐어요');
        setTimeout(() => router.replace('/(simple)/pro' as any), 1000);
      } else {
        showToast('복원할 구매 내역이 없어요');
      }
    } catch (e) {
      showToast('복원 중 오류가 발생했어요');
    } finally {
      setPurchasing(false);
    }
  };

  // 이미 PRO면 자동 리다이렉트
  useEffect(() => {
    if (isPro) {
      router.replace('/(simple)/pro' as any);
    }
  }, [isPro, router]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="PRO 멤버십" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* 헤더 — 가치 제안 */}
        <Card padding={20} style={{ borderColor: palette.purple500, borderWidth: 1.5 }}>
          <View style={{ alignItems: 'center' }}>
            <T allowFontScaling={false} style={{ fontSize: 32 }}>✨</T>
            <T variant="title2" color="primary" style={{ fontWeight: '900', marginTop: 4, fontSize: 22 }}>
              LottoFinder PRO
            </T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 4, textAlign: 'center', fontSize: 13 }}>
              통계 분석의 끝판왕
            </T>
            <View style={[styles.giftPill, { backgroundColor: palette.purple50 }]}>
              <T variant="label1n" allowFontScaling={false} style={{ color: palette.purple500, fontWeight: '800', fontSize: 13 }}>
                🎁 모든 PRO 기능을 2주간 무료로
              </T>
            </View>
          </View>
        </Card>

        {/* 첫 번째 혜택 — 귀찮이즘 */}
        <Card padding={16}>
          <View style={styles.benefitRow}>
            <View style={[styles.benefitIcon, { backgroundColor: palette.purple50 }]}>
              <T allowFontScaling={false} style={{ fontSize: 22 }}>📦</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="headline2" color="primary" style={{ fontWeight: '800', fontSize: 15 }}>
                귀찮이즘 자동 분석 조합
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 12 }}>
                매주 50개 자동 추출 · 받기만 하면 끝
              </T>
            </View>
          </View>

          {/* 백테스트 결과 카드 — 1년 검증 */}
          <View style={[styles.statsCard, { borderColor: GOLD }]}>
            <View style={styles.statsHeader}>
              <T variant="label1n" color="primary" allowFontScaling={false} style={{ fontWeight: '800', fontSize: 13 }}>
                📊 최근 1년 ({STATS.rounds}회) 적중 결과
              </T>
              <View style={[styles.verifiedChip, { backgroundColor: GOLD }]}>
                <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10 }}>
                  ✨ 검증됨
                </T>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <RankCell rank="🥇 1등" count={`${STATS.rank1}회`} color={GOLD} highlight />
              <RankCell rank="🥈 2등" count={`${STATS.rank2}회`} color="#c0c0c0" highlight />
              <RankCell rank="🥉 3등" count={`${STATS.rank3}개`} color="#cd7f32" />
              <RankCell rank="4등" count={STATS.rank4.toLocaleString('ko')} color={t.fgSecondary} />
            </View>

            <View style={[styles.bottomRow, { borderTopColor: t.borderDivider }]}>
              <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5 }}>
                5등
              </T>
              <T variant="caption1" allowFontScaling={false} style={{ color: t.fgPrimary, fontWeight: '700', fontSize: 12.5 }}>
                {STATS.rank5.toLocaleString('ko')}개
              </T>
            </View>

            <View style={[styles.tipBox, { backgroundColor: 'rgba(232,176,78,0.08)' }]}>
              <T variant="caption2" allowFontScaling={false} style={{ color: '#7a5800', fontSize: 11, lineHeight: 16 }}>
                💡 회차당 평균 3등 {STATS.avgRank3}개 + 4등 {STATS.avgRank4}개 + 5등 {STATS.avgRank5.toLocaleString('ko')}개 적중
              </T>
            </View>
          </View>
        </Card>

        {/* 나머지 혜택 */}
        <Card padding={16}>
          <T variant="caption1" color="tertiary" allowFontScaling={false} style={{ fontWeight: '700', letterSpacing: 0.5, fontSize: 11 }}>
            PRO 전용 분석 도구
          </T>
          <View style={{ marginTop: 10, gap: 9 }}>
            <BenefitItem emoji="📈" text="회귀분석 · 분석법 비교" />
            <BenefitItem emoji="💞" text="궁합수 · 당첨 궁합" />
            <BenefitItem emoji="🎯" text="패턴 분석 · 출현 분석" />
            <BenefitItem emoji="🔍" text="핀더 분석 조합" />
            <BenefitItem emoji="🎛" text="조합 필터링 PRO" />
          </View>
        </Card>

        {/* 가격 카드 — 연 (베스트) */}
        <Pressable
          onPress={() => setSelectedPlan('yearly')}
          style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
        >
          <Card
            padding={16}
            style={{
              borderColor: selectedPlan === 'yearly' ? palette.purple500 : t.borderWeak,
              borderWidth: selectedPlan === 'yearly' ? 2 : 1,
            }}
          >
            <View style={styles.planHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <T variant="headline2" color="primary" style={{ fontWeight: '800', fontSize: 15 }}>
                    🌟 연 구독
                  </T>
                  <View style={[styles.discountChip, { backgroundColor: palette.purple500 }]}>
                    <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 10 }}>
                      베스트 17% 할인
                    </T>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                  <T variant="title2" color="primary" allowFontScaling={false} style={{ fontWeight: '900', fontSize: 22 }}>
                    ₩79,000
                  </T>
                  <T variant="caption1" color="tertiary" style={{ marginLeft: 4, fontSize: 12 }}>
                    /년
                  </T>
                  <T variant="caption2" color="tertiary" style={{ marginLeft: 8, fontSize: 11 }}>
                    (월 ₩6,583)
                  </T>
                </View>
                <T variant="caption1" color="tertiary" style={{ marginTop: 4, fontSize: 11.5 }}>
                  14일 무료 체험 후 자동 결제
                </T>
              </View>
              <View style={[
                styles.radio,
                { borderColor: selectedPlan === 'yearly' ? palette.purple500 : t.borderWeak }
              ]}>
                {selectedPlan === 'yearly' && (
                  <View style={[styles.radioDot, { backgroundColor: palette.purple500 }]} />
                )}
              </View>
            </View>
          </Card>
        </Pressable>

        {/* 가격 카드 — 월 */}
        <Pressable
          onPress={() => setSelectedPlan('monthly')}
          style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
        >
          <Card
            padding={16}
            style={{
              borderColor: selectedPlan === 'monthly' ? palette.purple500 : t.borderWeak,
              borderWidth: selectedPlan === 'monthly' ? 2 : 1,
            }}
          >
            <View style={styles.planHeader}>
              <View style={{ flex: 1 }}>
                <T variant="headline2" color="primary" style={{ fontWeight: '800', fontSize: 15 }}>
                  월 구독
                </T>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
                  <T variant="title2" color="primary" allowFontScaling={false} style={{ fontWeight: '900', fontSize: 22 }}>
                    ₩7,900
                  </T>
                  <T variant="caption1" color="tertiary" style={{ marginLeft: 4, fontSize: 12 }}>
                    /월
                  </T>
                </View>
                <T variant="caption1" color="tertiary" style={{ marginTop: 4, fontSize: 11.5 }}>
                  14일 무료 체험 후 자동 결제
                </T>
              </View>
              <View style={[
                styles.radio,
                { borderColor: selectedPlan === 'monthly' ? palette.purple500 : t.borderWeak }
              ]}>
                {selectedPlan === 'monthly' && (
                  <View style={[styles.radioDot, { backgroundColor: palette.purple500 }]} />
                )}
              </View>
            </View>
          </Card>
        </Pressable>

        {/* 무료 체험 시작 버튼 */}
        <Pressable
          onPress={handlePurchase}
          disabled={purchasing || loading}
          style={({ pressed }) => [
            styles.ctaBtn,
            {
              backgroundColor: palette.purple500,
              opacity: purchasing || loading ? 0.7 : pressed ? 0.92 : 1,
            },
          ]}
        >
          {purchasing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              {loading ? '상품 정보 불러오는 중...' : '무료 체험 시작'}
            </T>
          )}
        </Pressable>

        {/* 복원 구매 */}
        <Pressable
          onPress={handleRestore}
          disabled={purchasing || loading}
          style={({ pressed }) => [
            styles.restoreBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <T variant="caption1" color="secondary" style={{ fontWeight: '600', fontSize: 12.5 }}>
            이미 구매하셨나요? 복원하기
          </T>
        </Pressable>

        {/* 안내 */}
        <View style={[styles.infoBox, { backgroundColor: t.bgSurface2 }]}>
          <T variant="caption2" color="tertiary" style={{ fontSize: 11, lineHeight: 17 }}>
            • 체험 기간 종료 1일 전 알림 발송{'\n'}
            • 언제든 Google Play에서 취소 가능{'\n'}
            • 환불은 Google Play 정책에 따라 처리{'\n'}
            • 결제는 Google Play 계정에 청구됩니다
          </T>
        </View>

        <Disclaimer short />
      </ScrollView>

      {/* 토스트 */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: t.bgInverse }]} pointerEvents="none">
          <T variant="label1n" allowFontScaling={false} style={{ color: t.bgCanvas, fontWeight: '700', textAlign: 'center' }}>
            {toast}
          </T>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ─── 보조 컴포넌트 ────────────────────────────────────────────────── */

function RankCell({ rank, count, color, highlight }: {
  rank: string;
  count: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <View style={[
      styles.rankCell,
      highlight && { backgroundColor: 'rgba(232,176,78,0.06)' },
    ]}>
      <T variant="caption1" allowFontScaling={false} style={{ fontSize: 11.5, fontWeight: '700', color }}>
        {rank}
      </T>
      <T variant="label1n" allowFontScaling={false} style={{ fontSize: highlight ? 16 : 13.5, fontWeight: '900', marginTop: 2, color: highlight ? color : 'inherit' as any }}>
        {count}
      </T>
    </View>
  );
}

function BenefitItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <T allowFontScaling={false} style={{ fontSize: 16, width: 20 }}>{emoji}</T>
      <T variant="caption1" color="secondary" style={{ fontSize: 13, flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  giftPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: 12,
  },

  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  // 백테스트 카드
  statsCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifiedChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  rankCell: {
    flexGrow: 1,
    flexBasis: '47%',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tipBox: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },

  // 가격 카드
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: {
    width: 12, height: 12, borderRadius: 6,
  },

  // CTA
  ctaBtn: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  restoreBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },

  infoBox: {
    padding: 14,
    borderRadius: radius.md,
  },

  toast: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.pill,
    maxWidth: '85%',
  },
});
