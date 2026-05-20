/**
 * 개인정보처리방침 — /privacy-policy
 *
 * 한국 개인정보보호법(PIPA) + 정보통신망법 준수형 표준 양식.
 * 본 앱은 사용자 계정·외부 전송이 없어 매우 간소한 처리방침 가능.
 *
 * ※ 실제 출시 전 변호사 또는 개인정보보호 전문가 검토 권장.
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

export default function PrivacyPolicy() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/features');

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="개인정보처리방침" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <Card padding={16}>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5 }}>
            버전: {VERSION} · 시행일: {EFFECTIVE_DATE}
          </T>
          <T variant="caption1" color="secondary" style={{ marginTop: 8, lineHeight: 19 }}>
            로또핀더(이하 "앱")는 이용자의 개인정보를 중요하게 생각하며,
            「개인정보 보호법」 및 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」을
            준수하기 위해 노력합니다.
          </T>
        </Card>

        <Section title="1. 수집하는 개인정보 항목 및 수집 방법">
          <P>
            본 앱은 회원가입을 요구하지 않으며, 다음의 정보만을 이용자의 기기 내부(AsyncStorage)에 저장합니다:
          </P>
          <Bullet>온보딩 답변(사용 빈도, 관심 기능)</Bullet>
          <Bullet>화면 설정(테마, 큰 글씨 여부)</Bullet>
          <Bullet>저장한 로또 번호(직접 입력 또는 QR 스캔)</Bullet>
          <Bullet>저장한 룰·필터·프리셋</Bullet>
          <Bullet>귀찮이즘 받기 기록(PRO 사용자)</Bullet>
          <Bullet>알림 설정(켜기/끄기)</Bullet>
          <P>
            위 정보는 모두 이용자의 기기 내부에만 저장되며, 운영자 또는 제3자에게 자동
            전송되지 않습니다.
          </P>
        </Section>

        <Section title="2. 개인정보의 수집 및 이용 목적">
          <Bullet>앱의 핵심 기능(로또 번호 통계 분석, 보관, 알림) 제공</Bullet>
          <Bullet>이용자의 편의 설정 보존(테마, 글씨 크기 등)</Bullet>
          <Bullet>유료 멤버십(PRO) 결제 상태 확인 및 기능 제공</Bullet>
        </Section>

        <Section title="3. 개인정보의 보유 및 이용 기간">
          <P>
            앱 내부 저장 데이터는 이용자가 앱을 삭제하거나 [기능 → 데이터 백업 → 모든 데이터
            초기화]를 실행할 때까지 보유됩니다. 운영자는 이 데이터에 접근할 수 없습니다.
          </P>
        </Section>

        <Section title="4. 개인정보의 제3자 제공">
          <P>
            본 앱은 이용자의 개인정보를 제3자에게 제공하지 않습니다.
          </P>
        </Section>

        <Section title="5. 개인정보 처리 위탁">
          <P>다음 서비스를 통해 일부 데이터를 처리할 수 있습니다:</P>
          <Bullet>
            <T variant="caption1" style={{ fontWeight: '700' }}>Google Play 결제 시스템</T>:
            유료 결제 처리(개인정보는 구글이 직접 처리하며, 본 앱은 결제 상태만 수신).
          </Bullet>
          <Bullet>
            <T variant="caption1" style={{ fontWeight: '700' }}>GitHub (raw.githubusercontent.com)</T>:
            주간 분석 조합 데이터를 다운로드받는 용도. IP 주소 등 일반적 인터넷 접속
            정보가 GitHub 서버 로그에 남을 수 있습니다.
          </Bullet>
        </Section>

        <Section title="6. 이용자의 권리와 행사 방법">
          <P>이용자는 언제든지 다음의 권리를 행사할 수 있습니다:</P>
          <Bullet>저장된 데이터 열람: [기능 → 데이터 백업]에서 백업 파일로 확인</Bullet>
          <Bullet>저장된 데이터 삭제: [기능 → 데이터 백업 → 모든 데이터 초기화]</Bullet>
          <Bullet>알림 수신 거부: [기능 → 알림 설정] 또는 기기의 시스템 설정</Bullet>
        </Section>

        <Section title="7. 개인정보의 안전성 확보 조치">
          <Bullet>모든 데이터는 이용자 기기 내부에만 저장되며 외부 전송하지 않습니다.</Bullet>
          <Bullet>외부 통신은 HTTPS로 암호화하여 통신 구간을 보호합니다.</Bullet>
        </Section>

        <Section title="8. 14세 미만 아동의 개인정보 처리">
          <P>
            본 앱은 만 19세 이상만 이용 가능한 복권 관련 통계 분석 도구로, 만 14세 미만
            아동의 개인정보를 의도적으로 수집하지 않습니다.
          </P>
        </Section>

        <Section title="9. 개인정보 보호책임자">
          <P>이용자의 개인정보 관련 문의는 아래 이메일로 연락 주십시오.</P>
          <Bullet>책임자: 로또핀더 운영자</Bullet>
          <Bullet>이메일: {CONTACT_EMAIL}</Bullet>
        </Section>

        <Section title="10. 정책 변경">
          <P>
            본 처리방침은 법령 또는 서비스 변경에 따라 수정될 수 있으며, 변경 시 앱
            업데이트를 통해 공지합니다.
          </P>
        </Section>

        <View style={{ paddingHorizontal: 8, paddingTop: 12 }}>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, textAlign: 'center', lineHeight: 16 }}>
            ※ 본 처리방침에 관한 의견·문의는{'\n'}
            {CONTACT_EMAIL} 으로 보내주십시오.
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

function P({ children }: { children: React.ReactNode }) {
  return (
    <T variant="caption1" color="secondary" style={{ lineHeight: 19, fontSize: 12.5 }}>
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
