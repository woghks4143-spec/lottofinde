/**
 * H1 ④ Result — 사용자 수준에 맞는 시작 가이드 콘텐츠를 보여준다.
 *
 * 중요: 두 모드는 **앱 기능 차이가 아니라 가이드 콘텐츠 차이**다.
 * 시작 후엔 모두 동일한 화면·기능에 접근한다.
 *   - 초급자: 로또 기본 용어와 분석 개념 학습 가이드
 *   - 전문가: 우리 앱의 분석 도구와 조합 추출 기능 소개
 *
 * 사용자가 어느 가이드를 골라도 같은 홈 화면으로 시작하고
 * 모든 기능(조합 생성 9종 · 번호 분석 · 회차 상세 등)을 동등하게 사용 가능.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { OnbProgress } from '@/src/components/OnbProgress';
import {
  recommendMode,
  useSettings,
  type AppMode,
} from '@/src/store/settings';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

type GuideKey = 'beginner' | 'expert';

type GuideItem = {
  emoji: string;
  title: string;
  desc: string;
};

const GUIDES: Record<GuideKey, {
  title: string;
  hero: string;
  items: GuideItem[];
}> = {
  beginner: {
    title: '초급자 가이드',
    hero: '꼭 알아둘 로또 기본 용어와 분석 개념을\n시작 후 차근차근 익혀드릴게요.',
    items: [
      {
        emoji: '📖',
        title: '로또 기본 용어',
        desc: 'AC값·표준편차·동행수·끝수합 등 핵심 용어를 친근한 예시와 함께 설명. 분석 결과를 이해할 수 있어요.',
      },
      {
        emoji: '📅',
        title: '회차별 분석',
        desc: '최신 회차의 당첨 번호 6개가 어떤 패턴인지 — 홀/짝, 저/고, 잠수번호까지 한눈에 보여드려요.',
      },
      {
        emoji: '⚖️',
        title: '균형 잡힌 조합 만들기',
        desc: '직접 6개 골라보면 8가지 지표로 균형 점수가 즉시 나와요. ★1~5로 직관적 평가.',
      },
      {
        emoji: '🤝',
        title: '궁합수 분석',
        desc: '한 번호와 가장 자주 함께 나온 짝꿍 번호. 전체 회차 데이터 기반 통계로 알려드려요.',
      },
    ],
  },
  expert: {
    title: '전문가 가이드',
    hero: '이미 익숙하신 분이라면 우리 앱의\n분석 도구를 빠르게 둘러보세요.',
    items: [
      {
        emoji: '🎯',
        title: '조합 생성 9가지 방식',
        desc: '완전 랜덤·최근 트렌드·통계 기반·패턴 균형·평균 조합·의미 부여·조건 조합·수동 조합·가중치 뽑기.',
      },
      {
        emoji: '📊',
        title: '8개 지표 통합 분석',
        desc: '합·끝수합·십합·앞뒷세수합·홀짝·저고·AC값 + 표준편차/소수/합성수/배수까지.',
      },
      {
        emoji: '🧩',
        title: '조건 조합 + 시뮬레이터',
        desc: '고정수·예상수·제외수로 정밀 추출. 룰 저장 후 매주 재실행 가능.',
      },
      {
        emoji: '🔁',
        title: '직전 회차 비교',
        desc: '이월수·이웃수(보너스 분리), 동행수 분석. 회차별 매칭 결과를 시계열로 표시.',
      },
    ],
  },
};

export default function Result() {
  const t = useTheme();
  const router = useRouter();
  const { q1, q2, finishOnboarding } = useSettings();

  // 추천 (q1/q2 기반) → 'expert' or 'simple' (내부 mode 값) → 가이드 키 매핑
  const recommendedMode = useMemo<AppMode>(() => recommendMode(q1, q2), [q1, q2]);
  const recommendedGuide: GuideKey = recommendedMode === 'expert' ? 'expert' : 'beginner';
  const [guide, setGuide] = useState<GuideKey>(recommendedGuide);

  const data = GUIDES[guide];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top', 'bottom']}>
      <OnbProgress step={3} total={3} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, gap: 16 }}>
        <View>
          <T variant="caption2" color="accent" style={{ marginBottom: 10, letterSpacing: 1.1 }}>
            3 / 3 · 시작 가이드
          </T>
          <T variant="title3" color="primary">
            당신에겐{'\n'}
            <T variant="title3" color="accent">
              {guide === 'beginner' ? '초급자 가이드' : '전문가 가이드'}
            </T>가 맞아요.
          </T>
          <T variant="body2r" color="secondary" style={{ marginTop: 10, lineHeight: 22 }}>
            {data.hero}
          </T>
        </View>

        {/* 가이드 토글 — 두 옵션을 명확히 보여줌 */}
        <View style={[styles.toggleWrap, { backgroundColor: 'rgba(112,115,124,0.10)' }]}>
          {(['beginner', 'expert'] as const).map((g) => {
            const on = guide === g;
            return (
              <Pressable
                key={g}
                onPress={() => setGuide(g)}
                style={({ pressed }) => [
                  styles.toggleOpt,
                  on && [styles.toggleOptActive, { backgroundColor: t.bgSurface }],
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <T
                  variant="label1n"
                  style={{
                    color: on ? palette.blue700 : t.fgSecondary,
                    fontWeight: on ? '800' : '600',
                    fontSize: 13,
                  }}
                  allowFontScaling={false}
                >
                  {g === 'beginner' ? '초급자' : '전문가'}
                </T>
                {g === recommendedGuide && (
                  <View style={[styles.miniChip, { backgroundColor: 'rgba(0,102,255,0.15)' }]}>
                    <T variant="caption2" style={{ color: palette.blue700, fontSize: 9.5, fontWeight: '800' }} allowFontScaling={false}>
                      추천
                    </T>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* 가이드 콘텐츠 카드 — 4개 항목 (정보 전달용, 탭 X) */}
        {data.items.map((it, i) => (
          <Card key={i} padding={14}>
            <View style={styles.itemRow}>
              <View style={[styles.itemIcon, { backgroundColor: palette.softFill }]}>
                <T allowFontScaling={false} style={{ fontSize: 24 }}>{it.emoji}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T variant="headline2" color="primary" style={{ fontWeight: '700' }}>
                  {it.title}
                </T>
                <T variant="caption1" color="secondary" style={{ marginTop: 6, lineHeight: 18 }}>
                  {it.desc}
                </T>
              </View>
            </View>
          </Card>
        ))}

        {/* 안내 한 줄 — 모든 기능 동등 접근 */}
        <View style={[styles.noteBox, { backgroundColor: palette.softFill }]}>
          <T variant="caption1" color="tertiary" style={{ lineHeight: 18 }}>
            💡 어느 가이드를 골라도 모든 기능을 동등하게 사용할 수 있어요.
            가이드는 시작 시 참고 정보일 뿐이에요.
          </T>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        {/* 초급자 한정: 시작 전에 용어 사전을 둘러볼 수 있도록 보조 진입점 */}
        {guide === 'beginner' && (
          <Pressable
            onPress={() => {
              // 온보딩 완료 처리 후 용어 사전으로 이동 — 뒤로가기로 홈 진입
              finishOnboarding('simple');
              router.replace('/glossary' as any);
            }}
            style={({ pressed }) => [
              styles.learnBtn,
              { backgroundColor: palette.softFill, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <T variant="label1n" style={{ color: palette.blue700, fontWeight: '700' }} allowFontScaling={false}>
              📖 로또에 대해 더 알아보고 시작할게요
            </T>
          </Pressable>
        )}

        <Button
          title="시작하기"
          size="lg"
          full
          onPress={() => {
            // 모든 사용자가 동일한 홈으로 진입. mode 필드는 가이드 선택만 기록.
            finishOnboarding(guide === 'expert' ? 'expert' : 'simple');
            router.replace('/(simple)/home' as any);
          }}
        />
        <T variant="label2" color="tertiary" style={{ textAlign: 'center', marginTop: 10, fontWeight: '600' }}>
          설정에서 가이드를 다시 볼 수 있어요
        </T>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toggleWrap: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.lg,
    gap: 2,
  },
  toggleOpt: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  toggleOptActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  miniChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIcon: {
    width: 52, height: 52, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  noteBox: {
    padding: 12,
    borderRadius: radius.md,
  },
  learnBtn: {
    paddingVertical: 14,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
});
