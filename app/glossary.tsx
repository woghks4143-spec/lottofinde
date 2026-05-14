/**
 * 용어 사전 — /glossary?focus=<termId>
 *
 * 분석결과에 나오는 모든 지표를 카테고리별로 친근하게 설명하는 페이지.
 * `focus=ac` 같은 쿼리로 들어오면 해당 항목으로 자동 스크롤.
 *
 * 디자인 원칙:
 *   - 어려운 용어 → 한 줄 쉬운 정의 → 예시 → 통계적 의미
 *   - 우리 앱의 색상 규칙도 같이 설명 (왜 이 색깔인지)
 *   - 초보자가 "아 그래서 이게 뭐였구나" 깨닫게
 */
import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Ball } from '@/src/components/Ball';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

// ─── 용어 데이터 ─────────────────────────────────────────────────────────────

type Tone = 'primary' | 'accent' | 'purple' | 'danger' | 'mute';

type Term = {
  id: string;
  title: string;
  oneLiner: string;          // 한 줄 정의
  example: { combo: number[]; result: string }; // 예시
  meaning: string;           // 통계적 의미 / 어떻게 읽어야 하는지
  highlightWhen?: string;    // 색깔 강조되는 조건
  tone?: Tone;               // 이 용어가 주로 어떤 톤으로 강조되는지
};

type Section = {
  id: string;
  title: string;
  emoji: string;
  hint: string;
  terms: Term[];
};

const SECTIONS: Section[] = [
  {
    id: 'basics',
    title: '기본 통계',
    emoji: '📊',
    hint: '조합의 전체적인 모양을 숫자로 표현',
    terms: [
      {
        id: 'sum',
        title: '합 (총합)',
        oneLiner: '6개 번호를 그냥 다 더한 값.',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '합 = 137' },
        meaning: '실제 당첨 회차는 보통 100~175 범위. 너무 낮으면 작은수만, 너무 높으면 큰수만 몰린 조합.',
      },
      {
        id: 'ac',
        title: 'AC값 (Arithmetic Complexity)',
        oneLiner: '번호들이 얼마나 "흩어졌는지" 알려주는 점수. 0~10.',
        example: { combo: [4, 16, 19, 30, 32, 36], result: 'AC = 10 (최대로 흩어짐)' },
        meaning: '6개 번호 사이의 서로 다른 차이 개수에서 5를 뺀 값. 높을수록 다양한 간격으로 분포 → 무작위에 가까움. 1·2·3·4·5·6처럼 연속이면 AC=0.',
        highlightWhen: 'AC ≥ 7이면 파란색 강조 (잘 흩어진 좋은 조합)',
        tone: 'accent',
      },
      {
        id: 'stddev',
        title: '표준편차',
        oneLiner: '평균에서 얼마나 떨어져 있는지의 평균.',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '표준편차 = 10.99' },
        meaning: '값이 클수록 번호가 넓게 흩어져 있다는 뜻. 평균 ~13 정도가 균형 잡힌 회차.',
      },
    ],
  },
  {
    id: 'balance',
    title: '균형',
    emoji: '⚖️',
    hint: '6개 번호가 골고루 퍼져 있는지',
    terms: [
      {
        id: 'oddeven',
        title: '홀:짝',
        oneLiner: '홀수 개수 : 짝수 개수.',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '홀:짝 = 1:5' },
        meaning: '실제 당첨 회차는 3:3, 4:2, 2:4가 대부분 (~85%). 6:0이나 0:6은 드묾.',
        highlightWhen: '3:3 균형이면 파란색 강조',
        tone: 'accent',
      },
      {
        id: 'lowhigh',
        title: '저:고',
        oneLiner: '저구간(1~22) : 고구간(23~45) 개수.',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '저:고 = 3:3' },
        meaning: '45개 번호를 반으로 자른 분포. 3:3이 이상적, 한쪽으로 치우치면 위험.',
        highlightWhen: '3:3 균형이면 파란색 강조',
        tone: 'accent',
      },
      {
        id: 'tailsum',
        title: '끝수합 (일의자리합)',
        oneLiner: '각 번호의 끝자리(일의 자리)만 더한 값.',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '4+6+9+0+2+6 = 27' },
        meaning: '실제 당첨 회차는 보통 18~35 범위. 끝수합이 비슷한 회차들은 "끝자리 분포가 비슷"하다고 본다.',
      },
      {
        id: 'tenssum',
        title: '십의자리합',
        oneLiner: '각 번호의 십의 자리만 더한 값. (4=0, 16=1, 30=3 …)',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '0+1+1+3+3+3 = 11' },
        meaning: '큰수가 많을수록 커진다. 합·끝수합과 함께 보면 분포가 더 잘 보임.',
      },
      {
        id: 'first3',
        title: '앞세수합',
        oneLiner: '정렬 후 가장 작은 3개의 합.',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '4+16+19 = 39' },
        meaning: '저구간(1~22) 번호들의 합과 비슷. 너무 작으면 작은수만 몰린 신호.',
      },
      {
        id: 'last3',
        title: '뒷세수합',
        oneLiner: '정렬 후 가장 큰 3개의 합.',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '30+32+36 = 98' },
        meaning: '고구간(23~45) 번호들의 합. 작은 수만 있으면 낮게 나옴.',
      },
    ],
  },
  {
    id: 'math',
    title: '수학적 특성',
    emoji: '🔢',
    hint: '특정 성질을 가진 번호가 몇 개인지',
    terms: [
      {
        id: 'squares',
        title: '완전제곱수',
        oneLiner: '어떤 정수의 제곱인 수. 1~45 중: 1, 4, 9, 16, 25, 36 (총 6개).',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '4·16·36 → 3개' },
        meaning: '실제 당첨에는 보통 0~2개 들어있음. 3개 이상은 드문 편.',
        highlightWhen: '1개 이상이면 보라색 강조',
        tone: 'purple',
      },
      {
        id: 'primes',
        title: '소수',
        oneLiner: '1과 자기 자신으로만 나누어지는 수. 1~45 중 총 14개.',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '19만 소수 → 1개' },
        meaning: '소수 = 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43. 평균 1~2개 정도.',
        highlightWhen: '1개 이상이면 보라색 강조',
        tone: 'purple',
      },
      {
        id: 'composites',
        title: '합성수',
        oneLiner: '1도 아니고 소수도 아닌 수 (= 약수가 3개 이상).',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '4·16·30·32·36 → 5개' },
        meaning: '1과 소수를 뺀 나머지. 1~45 중 30개. 보통 3~5개가 자연스러움.',
      },
    ],
  },
  {
    id: 'multiples',
    title: '배수',
    emoji: '✖️',
    hint: '특정 수의 배수가 몇 개인지',
    terms: [
      {
        id: 'm3',
        title: '3의 배수',
        oneLiner: '3으로 나누어 떨어지는 수. (3, 6, 9, 12 …)',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '30·36 → 2개' },
        meaning: '1~45 중 15개. 보통 1~3개 들어있음.',
      },
      {
        id: 'm4',
        title: '4의 배수',
        oneLiner: '4으로 나누어 떨어지는 수. (4, 8, 12, 16 …)',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '4·16·32·36 → 4개' },
        meaning: '1~45 중 11개. 4개 이상이면 한쪽으로 몰린 편.',
      },
      {
        id: 'm5',
        title: '5의 배수',
        oneLiner: '5으로 나누어 떨어지는 수. (5, 10, 15, 20 …)',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '30만 → 1개' },
        meaning: '1~45 중 9개. 평균 1~2개.',
      },
    ],
  },
  {
    id: 'patterns',
    title: '연속·중복 패턴',
    emoji: '🔗',
    hint: '번호 사이의 관계로 나타나는 모양',
    terms: [
      {
        id: 'consec3',
        title: '3자리 연속',
        oneLiner: '인접한 3개가 줄지어 있는지 (O/X).',
        example: { combo: [12, 13, 14, 20, 30, 41], result: '12-13-14 → O' },
        meaning: '실제 당첨 회차에서는 매우 드묾 (~5% 미만). O가 나오면 이례적.',
        highlightWhen: 'O일 때 빨간색 (이례적)',
        tone: 'danger',
      },
      {
        id: 'longestRun',
        title: '최장 연속수',
        oneLiner: '가장 긴 연속 묶음의 길이.',
        example: { combo: [5, 6, 12, 19, 20, 33], result: '5-6, 19-20 → 최대 2' },
        meaning: '대부분 회차에 1~2가 흔함. 3 이상은 드물고(빨강), 1은 너무 흩어진 편(회색).',
        highlightWhen: '2 = 파랑(전형적), 3+ = 빨강(드뭄)',
        tone: 'accent',
      },
      {
        id: 'pair',
        title: '연번 (한쌍)',
        oneLiner: 'N과 N+1 짝의 총 개수.',
        example: { combo: [3, 4, 5, 12, 20, 30], result: '3-4, 4-5 → 2쌍' },
        meaning: '연속 묶음의 길이가 K면 K-1쌍이 잡힘. 1·2·3·4 → 3쌍.',
      },
      {
        id: 'tailDup',
        title: '동일 끝수',
        oneLiner: '끝자리가 같은 번호 그룹.',
        example: { combo: [4, 16, 19, 30, 32, 36], result: '끝자리 6: 16·36 → 1그룹' },
        meaning: '예: 5·15·25는 끝자리가 모두 5인 동일끝수 그룹. 실제 당첨에 1~2 그룹은 자주 나옴.',
        highlightWhen: '1그룹 이상이면 파란색',
        tone: 'accent',
      },
    ],
  },
  {
    id: 'compare',
    title: '직전 회차 비교',
    emoji: '🔁',
    hint: '바로 전 회차와의 관계',
    terms: [
      {
        id: 'carryOver',
        title: '이월수 (동행)',
        oneLiner: '직전 회차 본번호 6개와 일치하는 개수.',
        example: { combo: [16, 18, 32, 40, 42, 45], result: '직전 16·18·20·32·33·39라면 → 16, 32, 18 = 3개' },
        meaning: '평균 1.2개. 2개 이상이면 "직전 영향을 받는" 조합.',
      },
      {
        id: 'carryOverBonus',
        title: '이월수 (보볼 포함)',
        oneLiner: '직전 본번호 + 보너스 7개와의 일치.',
        example: { combo: [16, 26, 30, 41, 42, 45], result: '직전 보너스 26이면 → 16, 26 = 2개' },
        meaning: '동행수보다 약간 많거나 같음. 보너스도 다음 회차에 자주 등장한다고 알려져 있음.',
      },
      {
        id: 'neighbor',
        title: '이웃수',
        oneLiner: '직전 본번호의 ±1 범위에 속한 번호.',
        example: { combo: [15, 17, 19, 31, 38, 40], result: '직전 16·18·20·32·33·39라면 → 15(=16-1), 17(=16+1), 19(=20-1), 31(=32-1), 38(=39-1), 40(=39+1)' },
        meaning: '직전과 가까이 붙은 수. 본번호 자체도 ±1 범위 안에 있으니 이월수와 겹치는 게 자연스러움.',
      },
      {
        id: 'neighborBonus',
        title: '이웃수 (보볼 포함)',
        oneLiner: '본번호 + 보너스의 ±1 범위.',
        example: { combo: [25, 27], result: '직전 보너스 26이면 → 25, 27 = 2개' },
        meaning: '보너스 주변도 다음 회차 후보로 자주 거론됨.',
      },
    ],
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Glossary() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/home');
  const params = useLocalSearchParams<{ focus?: string }>();
  const refs = useRef<Record<string, View | null>>({});
  const scrollRef = useRef<ScrollView>(null);
  const containerY = useRef<Record<string, number>>({});

  // 포커스 항목이 있으면 진입 시 자동 스크롤
  useEffect(() => {
    if (!params.focus) return;
    const id = setTimeout(() => {
      const y = containerY.current[params.focus!];
      if (y != null && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 24), animated: true });
      }
    }, 350);
    return () => clearTimeout(id);
  }, [params.focus]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="용어 설명" onBack={goBack} />
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}>

        {/* 인트로 — 사용 안내 */}
        <Card padding={16}>
          <T variant="heading2" color="primary">로또 용어 사전</T>
          <T variant="body2r" color="secondary" style={{ marginTop: 6, lineHeight: 22 }}>
            로또 6/45 분석에 자주 쓰이는 용어를 모았어요.
            각 용어마다 짧은 정의·예시·통계적 의미를 함께 정리했습니다.
          </T>
        </Card>

        {/* 섹션별 용어 */}
        {SECTIONS.map((section) => (
          <View key={section.id} style={{ gap: 10 }}>
            <View style={styles.sectionHead}>
              <T variant="heading2" color="primary">
                {section.emoji}  {section.title}
              </T>
              <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
                {section.hint}
              </T>
            </View>
            {section.terms.map((term) => (
              <View
                key={term.id}
                ref={(r) => { refs.current[term.id] = r; }}
                onLayout={(e) => { containerY.current[term.id] = e.nativeEvent.layout.y; }}
              >
                <TermCard term={term} focused={params.focus === term.id} />
              </View>
            ))}
          </View>
        ))}

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── TermCard ────────────────────────────────────────────────────────────────

function TermCard({ term, focused }: { term: Term; focused: boolean }) {
  return (
    <Card
      padding={16}
      style={focused ? { borderColor: palette.blue500, borderWidth: 2 } : undefined}
    >
      <T variant="headline1" color="primary">{term.title}</T>
      <T variant="body2r" color="secondary" style={{ marginTop: 8, lineHeight: 22 }}>
        {term.oneLiner}
      </T>

      {/* 예시 */}
      <View style={[styles.exampleCard, { backgroundColor: palette.softFill }]}>
        <T variant="caption1" color="tertiary" style={{ fontWeight: '700', marginBottom: 6 }}>
          예시
        </T>
        <View style={styles.exampleBalls}>
          {term.example.combo.map((n) => <Ball key={n} n={n} size="xs" />)}
        </View>
        <T variant="caption1" color="primary" style={{ marginTop: 8, fontWeight: '600' }}>
          → {term.example.result}
        </T>
      </View>

      <T variant="caption1" color="secondary" style={{ marginTop: 10, lineHeight: 18 }}>
        {term.meaning}
      </T>
    </Card>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  sectionHead: {
    marginTop: 6,
    marginBottom: 2,
  },
  exampleCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: radius.md,
  },
  exampleBalls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
});
