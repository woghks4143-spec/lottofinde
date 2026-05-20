/**
 * 이용약관 — /terms-of-service
 *
 * 한국 약관규제법 + 전자상거래법 + 정보통신망법 준수형 표준 양식.
 * 결제 부분은 Google Play 결제 시스템에 위임.
 *
 * ※ 실제 출시 전 변호사 검토 권장.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/design/theme';
import { radius } from '@/src/design/tokens';

const VERSION = 'v1.0';
const EFFECTIVE_DATE = '2026-05-20';
const CONTACT_EMAIL = 'finde4143@gmail.com';

export default function TermsOfService() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/features');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="이용약관" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <Card padding={16}>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5 }}>
            버전: {VERSION} · 시행일: {EFFECTIVE_DATE}
          </T>
          <T variant="caption1" color="secondary" style={{ marginTop: 8, lineHeight: 19 }}>
            본 약관은 로또핀더(이하 "앱")의 이용 조건과 절차, 운영자와 이용자의 권리·의무
            및 책임사항을 규정합니다.
          </T>
        </Card>

        <Section title="제1조 (목적)">
          <P>
            본 약관은 운영자가 모바일 앱을 통해 제공하는 로또 통계 분석 도구 서비스(이하
            "서비스")를 이용함에 있어 운영자와 이용자 간의 권리·의무 및 책임사항을
            규정함을 목적으로 합니다.
          </P>
        </Section>

        <Section title="제2조 (정의)">
          <Bullet>"이용자"란 본 앱을 다운로드하여 이용하는 자를 말합니다.</Bullet>
          <Bullet>"PRO 멤버십"이란 유료 결제를 통해 추가 분석 기능을 이용할 수 있는 권한을 말합니다.</Bullet>
          <Bullet>"서비스"란 본 앱이 제공하는 모든 통계 분석 도구 및 부가 기능을 말합니다.</Bullet>
        </Section>

        <Section title="제3조 (약관의 효력 및 변경)">
          <P>
            본 약관은 이용자가 앱을 설치하고 이용함으로써 효력이 발생합니다.
          </P>
          <P>
            운영자는 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경
            시 앱 업데이트 또는 공지를 통해 통지합니다.
          </P>
        </Section>

        <Section title="제4조 (서비스의 내용)">
          <P>본 앱은 다음의 통계 분석 도구를 제공합니다:</P>
          <Bullet>역대 회차 당첨번호 기반 통계 분석</Bullet>
          <Bullet>번호별 출현 빈도·주기·구간 분석</Bullet>
          <Bullet>조합 생성 및 필터링 도구</Bullet>
          <Bullet>저장한 번호의 회차별 매칭 확인</Bullet>
          <Bullet>알림(추첨 임박, 결과 등)</Bullet>
          <P style={{ marginTop: 6, fontWeight: '700' }}>
            ⚠️ 본 서비스는 통계 분석 도구이며, 실제 복권 구매·판매·환전 기능을
            제공하지 않습니다.
          </P>
        </Section>

        <Section title="제5조 (이용자의 의무)">
          <Bullet>본인은 만 19세 이상이며, 본 앱의 정보를 책임 있는 범위에서 이용해야 합니다.</Bullet>
          <Bullet>본 앱은 통계 분석 도구이며 당첨을 보장하지 않음을 인지해야 합니다.</Bullet>
          <Bullet>다른 이용자의 권리를 침해하거나 법령에 위반되는 행위를 해서는 안 됩니다.</Bullet>
          <Bullet>앱을 역공학·복제·재배포하지 않아야 합니다.</Bullet>
        </Section>

        <Section title="제6조 (PRO 멤버십 결제)">
          <Bullet>
            PRO 멤버십 결제는 Google Play 결제 시스템을 통해 처리되며, 결제·환불 정책은
            Google Play 정책을 따릅니다.
          </Bullet>
          <Bullet>
            신규 가입자에게는 PRO 멤버십을 2주간 무료로 체험할 수 있는 기간이 제공될
            수 있습니다. 무료 체험 기간이 끝나면 자동으로 정기 결제로 전환되며, 무료
            기간 중에는 언제든지 취소할 수 있습니다.
          </Bullet>
          <Bullet>
            정기 결제는 결제 주기(월/연)에 따라 자동으로 갱신되며, 이용자가 Google Play
            구독 관리 화면에서 직접 취소할 수 있습니다.
          </Bullet>
        </Section>

        <Section title="제7조 (환불 정책)">
          <P>
            본 앱의 유료 결제는 Google Play 환불 정책을 따릅니다. 환불은 Google Play
            결제 내역에서 직접 신청하시거나, Google Play 고객센터를 통해 요청할 수
            있습니다.
          </P>
          <Bullet>구매 후 48시간 이내: Google Play에서 자동 환불 가능</Bullet>
          <Bullet>그 이후: Google Play 정책에 따라 사안별로 처리</Bullet>
        </Section>

        <Section title="제8조 (서비스 이용 제한)">
          <P>
            운영자는 다음의 경우 이용자의 서비스 이용을 제한할 수 있습니다:
          </P>
          <Bullet>본 약관을 위반한 경우</Bullet>
          <Bullet>본 앱을 부정한 방법으로 이용한 경우</Bullet>
          <Bullet>다른 이용자 또는 제3자의 권리를 침해한 경우</Bullet>
          <Bullet>법령에 위반되는 행위를 한 경우</Bullet>
        </Section>

        <Section title="제9조 (면책 조항)">
          <Bullet>
            본 앱은 통계 분석 도구이며, 분석 결과로 인한 복권 구매 결정 및 그 결과에
            대해 운영자는 어떠한 책임도 지지 않습니다.
          </Bullet>
          <Bullet>
            로또는 무작위 추첨이며, 본 앱의 분석은 과거 통계를 참고용으로 제공할
            뿐 미래 당첨을 보장하지 않습니다.
          </Bullet>
          <Bullet>
            천재지변, 통신장애, 기기 오류 등 운영자의 통제 범위를 벗어난 사유로 인한
            서비스 중단에 대해서는 책임을 지지 않습니다.
          </Bullet>
          <Bullet>
            이용자가 본 앱 정보를 이용하여 발생한 손실 또는 손해에 대해 운영자는
            법령에서 허용하는 최대 한도 내에서 책임을 부담하지 않습니다.
          </Bullet>
        </Section>

        <Section title="제10조 (지식재산권)">
          <P>
            본 앱과 관련된 모든 디자인, 코드, 분석 알고리즘, 저작물의 지식재산권은
            운영자에게 귀속됩니다. 이용자는 운영자의 명시적 동의 없이 이를 복제·배포·
            전송·출판할 수 없습니다.
          </P>
        </Section>

        <Section title="제11조 (분쟁 해결)">
          <P>
            본 약관과 관련하여 발생한 분쟁은 양 당사자 간의 협의에 의해 해결하며,
            협의가 이루어지지 않을 경우 운영자의 주소지 관할 법원을 1심 관할 법원으로
            합니다.
          </P>
        </Section>

        <Section title="제12조 (연락처)">
          <Bullet>서비스 운영자: 로또핀더 운영자</Bullet>
          <Bullet>이메일: {CONTACT_EMAIL}</Bullet>
          <Bullet>문의 채널: [기능 → 문의하기]</Bullet>
        </Section>

        <Section title="📞 도박 중독 상담">
          <P>
            본 앱은 복권 관련 통계 분석을 제공합니다. 도박이나 충동적 복권 구매로 어려움을
            겪고 계신다면 다음에 도움을 요청하세요:
          </P>
          <Bullet>한국도박문제예방치유원: 1336 (24시간 무료)</Bullet>
          <Bullet>웹사이트: www.kcgp.or.kr</Bullet>
        </Section>

        <View style={{ paddingHorizontal: 8, paddingTop: 12 }}>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, textAlign: 'center', lineHeight: 16 }}>
            본 약관 시행일: {EFFECTIVE_DATE}{'\n'}
            이전 약관에 동의했던 이용자도 본 약관에 동의한 것으로 간주됩니다.
          </T>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card padding={16}>
      <T variant="label1n" color="primary" style={{ fontWeight: '800', marginBottom: 8 }}>
        {title}
      </T>
      <View style={{ gap: 6 }}>{children}</View>
    </Card>
  );
}

function P({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <T variant="caption1" color="secondary" style={[{ lineHeight: 19, fontSize: 12.5 }, style]}>
      {children}
    </T>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <T variant="caption1" color="secondary" style={{ fontSize: 12.5 }}>•</T>
      <T variant="caption1" color="secondary" style={{ flex: 1, lineHeight: 19, fontSize: 12.5 }}>
        {children}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
