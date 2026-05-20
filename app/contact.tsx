/**
 * 문의 — /contact
 *
 * 사용자가 작성한 문의를 mailto: 링크로 본인 이메일 앱을 통해 발송.
 * - 서버/API 불필요 (앱스토어 정책 친화적)
 * - 사용자의 메일 앱이 보내기 확인 → 본인 finde4143@gmail.com 으로 도착
 * - 메일 앱이 없으면 이메일 주소 복사 옵션 제공
 */
import React, { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const CONTACT_EMAIL = 'finde4143@gmail.com';

const CATEGORIES = [
  { key: 'bug',      label: '🐛 오류 신고',    color: palette.red500 },
  { key: 'feature',  label: '💡 기능 제안',    color: palette.blue500 },
  { key: 'payment',  label: '💳 결제 문의',    color: '#a37116' },
  { key: 'other',    label: '💬 기타',         color: '#888' },
] as const;
type CategoryKey = typeof CATEGORIES[number]['key'];

export default function Contact() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/features');

  const [category, setCategory] = useState<CategoryKey>('bug');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [replyEmail, setReplyEmail] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const canSend = title.trim().length > 0 && content.trim().length >= 5;
  const catMeta = CATEGORIES.find((c) => c.key === category)!;

  /** mailto: 링크로 사용자의 기본 이메일 앱 열기. */
  const handleSend = async () => {
    if (!canSend) {
      showToast('제목과 내용(5자 이상)을 입력해주세요');
      return;
    }

    const subject = `[로또핀더 ${catMeta.label.replace(/^\S+\s/, '')}] ${title.trim()}`;
    const body = [
      `▼ 문의 내용`,
      content.trim(),
      ``,
      `─────────────────`,
      `유형: ${catMeta.label}`,
      replyEmail ? `회신 이메일: ${replyEmail.trim()}` : '회신 이메일: (없음)',
      `앱 정보: 로또핀더 (${Platform.OS})`,
      `작성 시각: ${new Date().toLocaleString('ko-KR')}`,
    ].join('\n');

    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('no mail app');
      await Linking.openURL(url);
      showToast('메일 앱을 열었습니다. 보내기를 눌러주세요.');
    } catch {
      // 메일 앱이 없거나 열 수 없을 때 → 안내
      if (Platform.OS === 'web') {
        // 웹은 새 창에서 mailto 시도 → 안 되면 안내
        window.location.href = url;
        showToast('메일 앱이 없으면 아래 이메일을 복사해 직접 보내주세요');
      } else {
        Alert.alert(
          '메일 앱을 열 수 없어요',
          `이메일을 복사해서 직접 문의해 주세요:\n\n${CONTACT_EMAIL}`,
          [
            { text: '확인', style: 'default' },
            { text: '이메일 복사', onPress: () => copyEmail() },
          ],
        );
      }
    }
  };

  const copyEmail = async () => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(CONTACT_EMAIL);
        showToast(`이메일 복사됨: ${CONTACT_EMAIL}`);
        return;
      }
      // 네이티브: 별도 clipboard 라이브러리 없으니 메일 앱 직접 열기로 대체
      await Linking.openURL(`mailto:${CONTACT_EMAIL}`);
    } catch {
      showToast(`이메일: ${CONTACT_EMAIL}`);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="문의하기" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
        {/* 안내 */}
        <View style={[styles.tipCard, { backgroundColor: t.bgSurface2, borderColor: t.borderWeak }]}>
          <T allowFontScaling={false} style={{ fontSize: 16, marginRight: 8 }}>📮</T>
          <T variant="caption1" color="secondary" style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
            작성하시면 기본 메일 앱이 열려요. 보내기 누르시면 운영자에게 도착해요.
            보통 1~2일 안에 답변 드릴게요.
          </T>
        </View>

        {/* 유형 선택 */}
        <Card padding={14}>
          <T variant="caption1" color="primary" style={{ fontWeight: '800', fontSize: 12 }}>
            문의 유형
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {CATEGORIES.map((c) => {
              const on = category === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={({ pressed }) => [
                    styles.catBtn,
                    {
                      backgroundColor: on ? c.color + '20' : t.bgSurface2,
                      borderColor: on ? c.color : t.borderDivider,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <T variant="caption1" allowFontScaling={false} style={{
                    color: on ? c.color : t.fgSecondary,
                    fontWeight: '800',
                    fontSize: 12,
                  }}>
                    {c.label}
                  </T>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 제목 */}
        <Card padding={14}>
          <T variant="caption1" color="primary" style={{ fontWeight: '800', fontSize: 12 }}>
            제목 *
          </T>
          <TextInput
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, 60))}
            placeholder="예) 조합 필터링에서 오류가 나요"
            placeholderTextColor={t.fgTertiary}
            style={[styles.input, { color: t.fgPrimary, backgroundColor: t.bgSurface2, borderColor: t.borderWeak }]}
            maxLength={60}
          />
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, marginTop: 4, textAlign: 'right' }}>
            {title.length}/60
          </T>
        </Card>

        {/* 내용 */}
        <Card padding={14}>
          <T variant="caption1" color="primary" style={{ fontWeight: '800', fontSize: 12 }}>
            내용 * (5자 이상)
          </T>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 2 }}>
            상세하게 적어주시면 더 빠르게 도와드릴 수 있어요
          </T>
          <TextInput
            value={content}
            onChangeText={(v) => setContent(v.slice(0, 1000))}
            placeholder="언제, 어떤 화면에서, 어떤 동작에서 문제가 생겼는지 적어주세요..."
            placeholderTextColor={t.fgTertiary}
            multiline
            style={[
              styles.textarea,
              { color: t.fgPrimary, backgroundColor: t.bgSurface2, borderColor: t.borderWeak },
            ]}
            maxLength={1000}
          />
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, marginTop: 4, textAlign: 'right' }}>
            {content.length}/1000
          </T>
        </Card>

        {/* 회신 이메일 (선택) */}
        <Card padding={14}>
          <T variant="caption1" color="primary" style={{ fontWeight: '800', fontSize: 12 }}>
            회신받을 이메일 (선택)
          </T>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 2 }}>
            답변을 받고 싶으시면 이메일을 적어주세요
          </T>
          <TextInput
            value={replyEmail}
            onChangeText={(v) => setReplyEmail(v.trim().slice(0, 80))}
            placeholder="example@gmail.com"
            placeholderTextColor={t.fgTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { color: t.fgPrimary, backgroundColor: t.bgSurface2, borderColor: t.borderWeak }]}
            maxLength={80}
          />
        </Card>

        {/* 이메일 직접 복사 */}
        <Card padding={14}>
          <T variant="caption1" color="primary" style={{ fontWeight: '800', fontSize: 12 }}>
            ✉️ 또는 직접 메일로 보내기
          </T>
          <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 2 }}>
            메일 앱이 안 열리면 아래 주소로 직접 보내주세요
          </T>
          <Pressable
            onPress={copyEmail}
            style={({ pressed }) => [
              styles.emailBtn,
              { backgroundColor: t.bgSurface2, borderColor: t.borderWeak, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <T variant="label1n" color="primary" style={{ fontWeight: '800', fontSize: 13 }}>
              {CONTACT_EMAIL}
            </T>
            <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10, marginTop: 2 }}>
              탭하여 복사
            </T>
          </Pressable>
        </Card>
      </ScrollView>

      {/* 보내기 버튼 (하단 고정) */}
      <View style={[styles.submitBar, { backgroundColor: t.bgCanvas, borderTopColor: t.borderDivider }]}>
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: canSend ? palette.blue500 : '#888',
              opacity: !canSend ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <T allowFontScaling={false} style={{ fontSize: 16 }}>📨</T>
          <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', marginLeft: 6, fontSize: 14 }}>
            메일 앱으로 보내기
          </T>
        </Pressable>
      </View>

      {toast && (
        <View style={[styles.toast, { backgroundColor: t.bgInverse }]} pointerEvents="none">
          <T variant="label1n" style={{ color: t.bgCanvas, fontWeight: '700' }} allowFontScaling={false}>
            {toast}
          </T>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  catBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1.5,
  },
  input: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: '600',
    outlineStyle: 'none' as any,
  },
  textarea: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 140,
    textAlignVertical: 'top' as any,
    outlineStyle: 'none' as any,
  },
  emailBtn: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  submitBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 14,
    borderTopWidth: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.pill,
  },
  toast: {
    position: 'absolute',
    bottom: 100, alignSelf: 'center',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: radius.pill,
  },
});
