/**
 * H1 ① Welcome — branding + 19+ consent + primary CTA.
 *
 * 디자인 원칙:
 *   - "감 대신 데이터로" — 핵심 가치 한 줄에 응축
 *   - 큰 헤드라인 + 색상 강조 단어로 시선 끌기
 *   - 시각 요소: ball 미리보기로 앱 성격 즉시 전달
 *   - 외부 사이트 링크 등은 hub의 [기능] 탭으로 이동, welcome은 깔끔하게
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { Button } from '@/src/components/Button';
import { Chip } from '@/src/components/Chip';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function Welcome() {
  const t = useTheme();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const latestRound = useHistory((s) => s.latestRound);
  const roundLabel = latestRound > 0 ? `${latestRound.toLocaleString()}` : '전체';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgSurface }]} edges={['top', 'bottom']}>
      <View style={styles.body}>
        {/* Brand row */}
        <View style={styles.brand}>
          <View style={[styles.brandMark, { backgroundColor: t.bgAccent }]}>
            <Icon.shield size={16} color="#fff" weight={2} />
          </View>
          <T variant="label1n" color="secondary" style={{ fontWeight: '800' }}>로또핀더</T>
          <Chip label="비공식" compact />
        </View>

        {/* Hero — "로또의 모든 데이터" 톤 + 색상 강조 */}
        <View style={styles.hero}>
          <T variant="hero" color="primary" style={{ lineHeight: 44 }}>
            로또의{'\n'}
            모든 <T variant="hero" color="accent" style={{ lineHeight: 44 }}>데이터를</T>,{'\n'}
            한 곳에서.
          </T>
          <T variant="body2r" color="secondary" style={{ marginTop: 18, lineHeight: 22 }}>
            복잡한 통계도 한눈에.{'\n'}
            검증된 추출법과 깊이 있는 분석으로{'\n'}
            누구나 똑똑한 시작을 할 수 있어요.
          </T>

          {/* 데이터 통계 카드 — 앱 성격을 숫자로 즉시 전달 */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: 'rgba(0,102,255,0.10)' }]}>
              <T variant="title3" style={{ color: palette.blue700, fontWeight: '900' }} allowFontScaling={false}>
                {roundLabel}
              </T>
              <T variant="caption1" style={{ color: palette.blue700, fontWeight: '600', marginTop: 2 }} allowFontScaling={false}>
                회차 데이터
              </T>
              <T variant="caption2" color="tertiary" style={{ marginTop: 1, fontSize: 9.5 }} allowFontScaling={false}>
                1회 ~ 최신까지
              </T>
            </View>
            <View style={[styles.statCard, { backgroundColor: 'rgba(0,191,64,0.10)' }]}>
              <T variant="title3" style={{ color: palette.green700, fontWeight: '900' }} allowFontScaling={false}>
                9
              </T>
              <T variant="caption1" style={{ color: palette.green700, fontWeight: '600', marginTop: 2 }} allowFontScaling={false}>
                가지 추출법
              </T>
              <T variant="caption2" color="tertiary" style={{ marginTop: 1, fontSize: 9.5 }} allowFontScaling={false}>
                초급 ~ 전문가
              </T>
            </View>
            <View style={[styles.statCard, { backgroundColor: 'rgba(101,65,242,0.10)' }]}>
              <T variant="title3" style={{ color: palette.purple500, fontWeight: '900' }} allowFontScaling={false}>
                8
              </T>
              <T variant="caption1" style={{ color: palette.purple500, fontWeight: '600', marginTop: 2 }} allowFontScaling={false}>
                분석 지표
              </T>
              <T variant="caption2" color="tertiary" style={{ marginTop: 1, fontSize: 9.5 }} allowFontScaling={false}>
                통합 평가
              </T>
            </View>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        {/* Consent + CTA */}
        <Pressable onPress={() => setAgreed((v) => !v)} style={styles.consent} hitSlop={6}>
          <View style={[
            styles.check,
            { backgroundColor: agreed ? t.bgAccent : t.bgSurface2, borderColor: agreed ? t.bgAccent : t.borderNormal },
          ]}>
            {agreed && <Icon.check size={12} color="#fff" weight={3} />}
          </View>
          <T variant="label1r" color="secondary" style={{ flex: 1 }}>
            저는 만 19세 이상이며, 책임 있는 구매에 동의합니다.
          </T>
        </Pressable>

        <Button
          title="시작하기"
          size="lg"
          full
          disabled={!agreed}
          onPress={() => router.push('/onboarding/q1')}
          style={{ marginTop: 12 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandMark: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  hero: { marginTop: 48 },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  check: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
});
