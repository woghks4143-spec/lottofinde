/**
 * 책임 있는 구매 — /responsible-purchase
 *
 * 도박 중독 예방 안내 + 자기 진단 + 상담 연락처.
 * Google Play 정책상 복권/도박 앱은 책임 있는 게이밍 안내가 권장됨.
 */
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { Icon } from '@/src/components/Icons'; // check.svg 등 사용
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const QUESTIONS = [
  '예상보다 자주 복권/도박을 하고 있다',
  '잃은 돈을 되찾기 위해 더 사게 된다',
  '복권 구매에 대해 가족·지인에게 거짓말한 적이 있다',
  '복권을 사기 위해 돈을 빌리거나 빚을 진 적이 있다',
  '구매를 줄이려 했지만 실패한 경험이 있다',
  '복권 때문에 일·관계에 지장이 있었다',
  '잃은 후 우울하거나 죄책감을 느낀다',
  '예산보다 더 많은 돈을 쓴 적이 있다',
  '복권 생각이 머릿속에서 떠나지 않는다',
  '복권을 통해 큰 돈을 벌 수 있다고 확신한다',
];

export default function ResponsiblePurchase() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/features');
  const [answers, setAnswers] = useState<Record<number, boolean>>({});

  const yesCount = Object.values(answers).filter(Boolean).length;

  // 결과는 항상 실시간 표시 (체크할 때마다 자동 갱신)
  const result = (() => {
    if (yesCount >= 7) return { level: 'high',   color: palette.red500, text: '심각한 위험 신호', advice: '즉시 상담 받으시길 권장드립니다 (1336)' };
    if (yesCount >= 4) return { level: 'medium', color: '#ea580c',     text: '주의 단계',         advice: '구매를 줄이고 상담을 고려해보세요' };
    if (yesCount >= 2) return { level: 'mild',   color: '#d4a017',     text: '약한 신호',         advice: '계속 자제하면서 즐겨주세요' };
    return                  { level: 'safe',   color: palette.green700, text: '건전한 수준',       advice: '지금처럼 즐겨주세요' };
  })();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="책임 있는 구매" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* 핵심 경고 */}
        <View style={[styles.warningHero, { backgroundColor: 'rgba(248,72,79,0.10)', borderColor: palette.red500 }]}>
          <T allowFontScaling={false} style={{ fontSize: 32 }}>⚠️</T>
          <T variant="title3" style={{ color: palette.red500, fontWeight: '900', marginTop: 8 }}>
            복권은 오락이지 투자가 아닙니다
          </T>
          <T variant="body2r" color="secondary" style={{ marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            로또 1등 확률은{'\n'}
            <T variant="title3" style={{ color: palette.red500, fontWeight: '900' }}>8,145,060분의 1</T>
            {'\n'}— 벼락 맞을 확률(약 100만분의 1)보다 8배 낮습니다.
          </T>
        </View>

        {/* 즉시 도움 받기 */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            📞 즉시 도움이 필요하신가요?
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 4, fontSize: 11.5 }}>
            한국도박문제예방치유원 — 24시간 무료 상담
          </T>
          <Pressable
            onPress={() => Linking.openURL('tel:1336').catch(() => {})}
            style={({ pressed }) => [styles.hotlineBtn, { backgroundColor: palette.red500, opacity: pressed ? 0.85 : 1 }]}
          >
            <T allowFontScaling={false} style={{ fontSize: 18 }}>📞</T>
            <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', marginLeft: 8, fontSize: 16 }}>
              1336 전화 걸기
            </T>
          </Pressable>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 8, textAlign: 'center' }}>
            전국 어디서나 무료 · 익명 보장
          </T>
        </Card>

        {/* 자기 진단 */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            🩺 자기 진단 (10문항)
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 4, fontSize: 11.5 }}>
            솔직하게 답해주세요. 자신을 점검하는 시간입니다.
          </T>

          <View style={{ marginTop: 16, gap: 8 }}>
            {QUESTIONS.map((q, i) => (
              <Pressable
                key={i}
                onPress={() => setAnswers((a) => ({ ...a, [i]: !a[i] }))}
                style={({ pressed }) => [
                  styles.questionRow,
                  {
                    backgroundColor: answers[i] ? 'rgba(248,72,79,0.10)' : t.bgSurface2,
                    borderColor: answers[i] ? palette.red500 : t.borderDivider,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={[styles.checkbox, answers[i] && { backgroundColor: palette.red500, borderColor: palette.red500 }]}>
                  {answers[i] && <Icon.check color="#fff" size={11} weight={3} />}
                </View>
                <T variant="caption1" color="primary" style={{ flex: 1, fontSize: 12, lineHeight: 18 }}>
                  {i + 1}. {q}
                </T>
              </Pressable>
            ))}
          </View>

          {/* 결과 — 항상 표시, 체크할 때마다 실시간 갱신 */}
          <View style={[styles.resultBox, { backgroundColor: result.color + '15', borderColor: result.color }]}>
            <T variant="caption2" allowFontScaling={false} style={{ color: result.color, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 }}>
              진단 결과 (실시간)
            </T>
            <T variant="title3" style={{ color: result.color, fontWeight: '900', marginTop: 6 }}>
              {yesCount}/10개 — {result.text}
            </T>
            <T variant="body2r" color="primary" style={{ marginTop: 8, lineHeight: 21 }}>
              {result.advice}
            </T>
            {(result.level === 'high' || result.level === 'medium') && (
              <Pressable
                onPress={() => Linking.openURL('tel:1336').catch(() => {})}
                style={({ pressed }) => [styles.resultCta, { backgroundColor: result.color, opacity: pressed ? 0.85 : 1 }]}
              >
                <T allowFontScaling={false} style={{ fontSize: 14 }}>📞</T>
                <T variant="caption1" allowFontScaling={false} style={{ color: '#fff', fontWeight: '800', marginLeft: 6, fontSize: 13 }}>
                  1336 도움 받기
                </T>
              </Pressable>
            )}
          </View>
        </Card>

        {/* 책임 있는 구매 원칙 */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            ✅ 책임 있는 구매 원칙
          </T>
          <View style={{ marginTop: 12, gap: 10 }}>
            <Principle emoji="💰" title="잃어도 괜찮은 돈만" desc="생활비·학자금·대출금 절대 X. 여가비 한도 안에서만." />
            <Principle emoji="📅" title="구매 한도 설정" desc="주/월 단위 한도를 미리 정하고 절대 넘지 마세요." />
            <Principle emoji="🚫" title="잃은 돈 되찾으려 X" desc="잃은 만큼 더 사면 위험. 그날은 멈추세요." />
            <Principle emoji="⏱️" title="시간 제한" desc="복권에 쓰는 시간도 정해두세요. 일상보다 우선시되면 위험." />
            <Principle emoji="🍺" title="음주 시 구매 X" desc="판단력이 흐려진 상태로 구매하면 후회합니다." />
            <Principle emoji="👨‍👩‍👧" title="가족·지인과 공유" desc="혼자 숨기지 말고 함께 이야기하세요." />
          </View>
        </Card>

        {/* 외부 자료 */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            🔗 도움 자료
          </T>
          <View style={{ marginTop: 10, gap: 8 }}>
            <LinkRow
              label="한국도박문제예방치유원"
              desc="공식 사이트 · 자가진단·온라인 상담"
              onPress={() => Linking.openURL('https://www.kcgp.or.kr').catch(() => {})}
            />
            <LinkRow
              label="동행복권 책임감 있는 게임"
              desc="공식 책임 있는 게임 안내"
              onPress={() => Linking.openURL('https://www.dhlottery.co.kr/contents.do?method=responsibilityGame1').catch(() => {})}
            />
          </View>
        </Card>

        {/* 푸터 안내 */}
        <View style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, textAlign: 'center', lineHeight: 16 }}>
            본 앱은 통계 분석 도구이며 당첨을 보장하지 않습니다.{'\n'}
            만 19세 이상만 복권 구매 가능합니다.
          </T>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Principle({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <T allowFontScaling={false} style={{ fontSize: 18, width: 22 }}>{emoji}</T>
      <View style={{ flex: 1 }}>
        <T variant="caption1" color="primary" style={{ fontWeight: '800', fontSize: 12.5 }}>
          {title}
        </T>
        <T variant="caption2" color="secondary" style={{ fontSize: 11, marginTop: 2, lineHeight: 16 }}>
          {desc}
        </T>
      </View>
    </View>
  );
}

function LinkRow({ label, desc, onPress }: { label: string; desc: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, { backgroundColor: t.bgSurface2, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={{ flex: 1 }}>
        <T variant="caption1" color="primary" style={{ fontWeight: '700', fontSize: 12.5 }}>
          {label}
        </T>
        <T variant="caption2" color="tertiary" style={{ fontSize: 10.5, marginTop: 2 }}>
          {desc}
        </T>
      </View>
      <T variant="label1n" color="tertiary" allowFontScaling={false} style={{ fontSize: 16 }}>↗</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  warningHero: {
    padding: 20,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  hotlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: radius.pill,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  checkbox: {
    width: 20, height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(127,127,127,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  resultBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  resultCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
  },
});
