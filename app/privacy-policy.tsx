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

const VERSION = 'v1.1';
const EFFECTIVE_DATE = '2026-05-29';
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
          <Bullet>기기 무작위 식별자(deviceSeed) — 자동 분석 풀 분배용, 개인 식별 불가</Bullet>
          <P>
            위 정보는 모두 이용자의 기기 내부에만 저장되며, 운영자 또는 제3자에게 자동
            전송되지 않습니다.
          </P>
          <P style={{ marginTop: 8, fontWeight: '700' }}>
            선택적으로 사용하는 OS 권한:
          </P>
          <Bullet>
            위치(선택): "가까운 판매점 찾기" 기능 사용 시에만 OS에 요청. 좌표는
            기기 내에서 거리 계산에만 사용되며 서버로 전송되지 않습니다.
          </Bullet>
          <Bullet>
            카메라(선택): "QR 영수증 스캔" 기능 사용 시에만 OS에 요청. 이미지·QR 데이터는
            기기 내에서만 처리되며 외부로 전송되지 않습니다.
          </Bullet>
        </Section>

        <Section title="2. 개인정보의 수집 및 이용 목적">
          <Bullet>앱의 핵심 기능(로또 번호 통계 분석, 보관, 알림) 제공</Bullet>
          <Bullet>이용자의 편의 설정 보존(테마, 글씨 크기 등)</Bullet>
          <Bullet>유료 멤버십(PRO) 결제 상태 확인 및 기능 제공</Bullet>
        </Section>

        <Section title="3. 개인정보의 보유 및 이용 기간">
          <P>
            앱 내부 저장 데이터는 이용자가 앱을 삭제할 때까지 보유됩니다.
            운영자는 이 데이터에 접근할 수 없습니다.
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
            <T variant="caption1" style={{ fontWeight: '700' }}>Google Firebase (Google LLC)</T>:
            회차별 글로벌 분석 풀 카운터 운영. 저장 항목은 기기 무작위 식별자(deviceSeed),
            할당된 슬롯 번호, 타임스탬프이며, 개인을 식별할 수 없습니다.
            보유 기간은 회차 종료 후 자동 삭제됩니다(최대 14일).
            데이터는 아시아 남동부(싱가포르) 리전 서버에 저장될 수 있습니다.
          </Bullet>
          <Bullet>
            <T variant="caption1" style={{ fontWeight: '700' }}>RevenueCat (RevenueCat Inc.)</T>:
            PRO 멤버십 구독 상태 검증 및 영수증 관리. Google Play의 익명 구매 토큰만
            전달되며, 개인 식별 정보는 포함되지 않습니다.
          </Bullet>
          <Bullet>
            <T variant="caption1" style={{ fontWeight: '700' }}>GitHub (raw.githubusercontent.com)</T>:
            주간 분석 조합 데이터를 다운로드받는 용도. IP 주소 등 일반적 인터넷 접속
            정보가 GitHub 서버 로그에 남을 수 있습니다.
          </Bullet>
        </Section>

        <Section title="6. 이용자의 권리와 행사 방법">
          <P>이용자는 언제든지 다음의 권리를 행사할 수 있습니다:</P>
          <Bullet>저장된 데이터 삭제: 앱을 삭제(제거)하면 기기 내 모든 데이터가 함께 삭제됩니다</Bullet>
          <Bullet>알림 수신 거부: [기능 → 알림 설정] 또는 기기의 시스템 설정</Bullet>
        </Section>

        <Section title="7. 개인정보의 안전성 확보 조치">
          <Bullet>모든 데이터는 이용자 기기 내부에만 저장되며 외부 전송하지 않습니다.</Bullet>
          <Bullet>외부 통신은 HTTPS로 암호화하여 통신 구간을 보호합니다.</Bullet>
        </Section>

        <Section title="8. 만 14세 미만 아동의 개인정보 처리">
          <P>
            본 앱은 복권 관련 통계 분석 도구로서 「국민체육진흥법」 및 동행복권 이용
            지침에 따라 만 19세 이상 이용을 권장합니다.
          </P>
          <P>
            운영자는 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않으며,
            회원가입이 없고 모든 데이터가 기기 내부에만 저장되므로 별도의
            법정대리인 동의 절차를 두지 않습니다. 만 14세 미만 아동이 본 앱을
            이용한 사실이 확인될 경우, 즉시 해당 기기 내 데이터 삭제를 요청할 수 있습니다.
          </P>
        </Section>

        <Section title="9. 개인정보 보호책임자">
          <P>이용자의 개인정보 관련 문의는 아래 이메일로 연락 주십시오.</P>
          <Bullet>책임자: 로또핀더 운영자</Bullet>
          <Bullet>이메일: {CONTACT_EMAIL}</Bullet>
        </Section>

        <Section title="10. 자동 수집 정보">
          <P>본 앱은 다음의 정보가 외부 서비스 이용 중 자동 발생할 수 있습니다:</P>
          <Bullet>
            인터넷 접속 정보(IP 주소, OS·앱 버전): GitHub raw URL에서 회차 데이터
            다운로드 시 GitHub 서버 로그에 기록될 수 있습니다.
          </Bullet>
          <Bullet>
            Firebase·RevenueCat 접속 시 동일하게 IP·기기 정보가 Google·RevenueCat
            서버 로그에 기록될 수 있습니다.
          </Bullet>
          <P>
            이 정보는 운영자가 별도 수집·이용하지 않으며, 각 서비스 제공자의
            개인정보처리방침을 따릅니다.
          </P>
        </Section>

        <Section title="11. 권익침해 구제방법">
          <P>이용자는 개인정보 침해에 대해 다음 기관에 분쟁 해결을 신청할 수 있습니다:</P>
          <Bullet>개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)</Bullet>
          <Bullet>개인정보침해신고센터: 118 (privacy.kisa.or.kr)</Bullet>
          <Bullet>대검찰청 사이버수사과: 1301</Bullet>
          <Bullet>경찰청 사이버수사국: 182</Bullet>
        </Section>

        <Section title="12. 정책 변경">
          <P>
            본 처리방침은 법령 또는 서비스 변경에 따라 수정될 수 있으며, 변경 시 앱
            업데이트를 통해 공지합니다. 이용자에게 불리한 변경의 경우 변경 효력일
            최소 30일 전에 안내합니다.
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
