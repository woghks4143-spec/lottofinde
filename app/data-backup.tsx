/**
 * 데이터 백업 — /data-backup
 *
 * 내 데이터(저장한 번호, 룰, 설정, 귀찮이즘 기록)를 JSON으로 내보내고 복원.
 *   - 백업: JSON 파일 생성 → 공유(네이티브) 또는 다운로드(웹)
 *   - 복원: JSON 텍스트 붙여넣기 → 미리보기 → 덮어쓰기
 */
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Card } from '@/src/components/Card';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { useRules } from '@/src/store/rules';
import { useJachanism } from '@/src/store/jachanism';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const BACKUP_VERSION = 1;
const BACKUP_KEYS = [
  'lottofinder.saved.v1',
  'lottofinder.rules.v1',
  'lottofinder.settings.v1',
  'lottofinder.jachanism.v2',
] as const;

type BackupPayload = {
  version: number;
  app: 'lottofinder';
  exportedAt: string;
  storage: Record<string, unknown>;
};

export default function DataBackup() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/features');

  const games = useSavedNumbers((s) => s.games);
  const rules = useRules((s) => s.rules);
  const jachanism = useJachanism((s) => s.weekly);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<BackupPayload | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // 백업 통계
  const stats = useMemo(() => ({
    games: games.length,
    rules: rules.length,
    jachanismRounds: Object.keys(jachanism).length,
  }), [games.length, rules.length, jachanism]);

  /** 백업 — 모든 persisted 데이터를 JSON으로 모아서 공유. */
  const handleBackup = async () => {
    try {
      const storage: Record<string, unknown> = {};
      for (const key of BACKUP_KEYS) {
        const v = await AsyncStorage.getItem(key);
        if (v != null) storage[key] = JSON.parse(v);
      }
      const payload: BackupPayload = {
        version: BACKUP_VERSION,
        app: 'lottofinder',
        exportedAt: new Date().toISOString(),
        storage,
      };
      const json = JSON.stringify(payload, null, 2);
      const filename = `lottofinder-backup-${new Date().toISOString().slice(0, 10)}.json`;

      if (Platform.OS === 'web') {
        // 웹: Blob 다운로드
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showToast('백업 파일 다운로드 완료');
      } else {
        // 네이티브: FileSystem write + Sharing
        const uri = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(uri, json, { encoding: 'utf8' });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: '백업 파일 저장' });
          showToast('백업 파일 공유 완료');
        } else {
          showToast(`저장됨: ${uri}`);
        }
      }
    } catch (e) {
      showToast(`백업 실패: ${(e as Error).message}`);
    }
  };

  /** 붙여넣은 텍스트를 파싱해서 미리보기. */
  const handleImportPreview = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importText);
      if (parsed.app !== 'lottofinder') {
        setImportError('이 백업 파일은 로또핀더 형식이 아닙니다.');
        return;
      }
      if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) {
        setImportError(`지원하지 않는 백업 버전 (v${parsed.version}).`);
        return;
      }
      if (!parsed.storage || typeof parsed.storage !== 'object') {
        setImportError('백업 데이터 형식이 잘못됐습니다.');
        return;
      }
      setImportPreview(parsed as BackupPayload);
    } catch (e) {
      setImportError('JSON 파싱 실패. 올바른 백업 파일인지 확인하세요.');
    }
  };

  /** 미리보기 확인 후 실제 복원. */
  const handleImportConfirm = async () => {
    if (!importPreview) return;
    try {
      for (const [key, value] of Object.entries(importPreview.storage)) {
        if (!BACKUP_KEYS.includes(key as any)) continue; // 안전 화이트리스트
        await AsyncStorage.setItem(key, JSON.stringify(value));
      }
      showToast('복원 완료. 앱을 다시 시작하면 적용됩니다.');
      setImportOpen(false);
      setImportText('');
      setImportPreview(null);
    } catch (e) {
      showToast(`복원 실패: ${(e as Error).message}`);
    }
  };

  /** 전체 데이터 초기화 (확인 다이얼로그). */
  const handleClearAll = () => {
    const doIt = async () => {
      for (const key of BACKUP_KEYS) {
        try { await AsyncStorage.removeItem(key); } catch {}
      }
      showToast('모든 데이터가 초기화됐어요. 앱을 다시 시작해주세요.');
    };
    if (Platform.OS === 'web') {
      if (confirm('정말 모든 데이터를 초기화하시겠습니까?\n저장한 번호·룰·설정이 모두 삭제됩니다.')) doIt();
    } else {
      Alert.alert(
        '전체 데이터 초기화',
        '저장한 번호·룰·설정이 모두 삭제됩니다.\n계속하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '초기화', style: 'destructive', onPress: doIt },
        ],
      );
    }
  };

  // 미리보기에서 추출할 항목 수 카운트
  const importStats = importPreview ? extractImportStats(importPreview) : null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="데이터 백업" onBack={goBack} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* 안내 */}
        <View style={[styles.tipCard, { backgroundColor: t.bgSurface2, borderColor: t.borderWeak }]}>
          <T allowFontScaling={false} style={{ fontSize: 16, marginRight: 8 }}>💾</T>
          <T variant="caption1" color="secondary" style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
            앱 데이터를 JSON 파일로 백업하거나 복원할 수 있어요. 폰을 바꿀 때 데이터를 옮기거나 안전하게 보관할 때 사용하세요.
          </T>
        </View>

        {/* 현재 데이터 통계 */}
        <Card padding={14}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            📊 현재 저장된 데이터
          </T>
          <View style={{ gap: 8, marginTop: 12 }}>
            <StatRow icon="🎫" label="저장한 번호" value={`${stats.games}개`} />
            <StatRow icon="📋" label="저장한 룰" value={`${stats.rules}개`} />
            <StatRow icon="✨" label="귀찮이즘 받은 회차" value={`${stats.jachanismRounds}회`} />
          </View>
        </Card>

        {/* 백업 (내보내기) */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            📤 백업 (내보내기)
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 4, fontSize: 11.5, lineHeight: 17 }}>
            모든 데이터를 JSON 파일로 내보내요. 클라우드(드라이브, 메일, 카톡 등)에 안전하게 보관하세요.
          </T>
          <Pressable
            onPress={handleBackup}
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: palette.blue500, opacity: pressed ? 0.85 : 1 }]}
          >
            <T allowFontScaling={false} style={{ fontSize: 16 }}>📤</T>
            <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', marginLeft: 8, fontSize: 14 }}>
              백업 파일 만들기
            </T>
          </Pressable>
        </Card>

        {/* 복원 (가져오기) */}
        <Card padding={16}>
          <T variant="label1n" color="primary" style={{ fontWeight: '800' }}>
            📥 복원 (가져오기)
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 4, fontSize: 11.5, lineHeight: 17 }}>
            백업 JSON 파일의 내용을 붙여넣어서 복원하세요. ⚠️ 기존 데이터는 덮어쓰여집니다.
          </T>
          <Pressable
            onPress={() => { setImportOpen(true); setImportText(''); setImportPreview(null); setImportError(null); }}
            style={({ pressed }) => [styles.primaryBtn, { backgroundColor: palette.green500, opacity: pressed ? 0.85 : 1 }]}
          >
            <T allowFontScaling={false} style={{ fontSize: 16 }}>📥</T>
            <T variant="label1n" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', marginLeft: 8, fontSize: 14 }}>
              복원하기
            </T>
          </Pressable>
        </Card>

        {/* 위험 구역 */}
        <Card padding={16}>
          <T variant="label1n" style={{ color: palette.red500, fontWeight: '800' }}>
            ⚠️ 위험 구역
          </T>
          <T variant="caption1" color="tertiary" style={{ marginTop: 4, fontSize: 11.5, lineHeight: 17 }}>
            저장한 모든 데이터를 영구 삭제합니다. 복구할 수 없어요.
          </T>
          <Pressable
            onPress={handleClearAll}
            style={({ pressed }) => [styles.dangerBtn, { borderColor: palette.red500, opacity: pressed ? 0.7 : 1 }]}
          >
            <T variant="label1n" style={{ color: palette.red500, fontWeight: '800', fontSize: 13 }} allowFontScaling={false}>
              🗑 모든 데이터 초기화
            </T>
          </Pressable>
        </Card>
      </ScrollView>

      {/* 복원 모달 */}
      <Modal
        visible={importOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setImportOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setImportOpen(false)} />
        <View style={styles.modalWrap} pointerEvents="box-none">
          <View style={[styles.modalSheet, { backgroundColor: t.bgSurface }]}>
            <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>데이터 복원</T>
            <T variant="caption1" color="tertiary" style={{ marginTop: 2, fontSize: 11.5 }}>
              백업 파일(JSON)의 내용을 모두 복사해서 아래에 붙여넣으세요.
            </T>

            <TextInput
              value={importText}
              onChangeText={(v) => { setImportText(v); setImportPreview(null); setImportError(null); }}
              placeholder='{"version":1,"app":"lottofinder",...}'
              placeholderTextColor={t.fgTertiary}
              multiline
              numberOfLines={8}
              style={[
                styles.textarea,
                { color: t.fgPrimary, backgroundColor: t.bgSurface2, borderColor: t.borderWeak },
              ]}
            />

            {importError && (
              <View style={[styles.errorBox, { borderColor: palette.red500, backgroundColor: 'rgba(248,72,79,0.08)' }]}>
                <T variant="caption1" style={{ color: palette.red500, fontSize: 11.5 }}>{importError}</T>
              </View>
            )}

            {importPreview && importStats && (
              <View style={[styles.previewBox, { borderColor: palette.green500, backgroundColor: 'rgba(0,191,64,0.08)' }]}>
                <T variant="caption1" style={{ color: palette.green700, fontWeight: '800', fontSize: 12 }}>
                  ✓ 백업 파일 확인됨
                </T>
                <T variant="caption2" color="secondary" allowFontScaling={false} style={{ fontSize: 10.5, marginTop: 4 }}>
                  생성일: {new Date(importPreview.exportedAt).toLocaleString('ko-KR')}
                </T>
                <T variant="caption1" color="primary" style={{ fontSize: 11.5, marginTop: 6 }}>
                  • 저장한 번호 {importStats.games}개{'\n'}
                  • 저장한 룰 {importStats.rules}개{'\n'}
                  • 귀찮이즘 {importStats.jachanismRounds}회
                </T>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Pressable
                onPress={() => setImportOpen(false)}
                style={({ pressed }) => [styles.btnGhost, { borderColor: t.borderWeak, opacity: pressed ? 0.85 : 1 }]}
              >
                <T variant="caption1" color="secondary" style={{ fontWeight: '700' }}>취소</T>
              </Pressable>
              {!importPreview ? (
                <Pressable
                  onPress={handleImportPreview}
                  disabled={!importText.trim()}
                  style={({ pressed }) => [
                    styles.btnPrimary,
                    {
                      backgroundColor: palette.blue500,
                      opacity: !importText.trim() ? 0.4 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <T variant="caption1" style={{ color: '#fff', fontWeight: '800' }}>미리보기</T>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleImportConfirm}
                  style={({ pressed }) => [styles.btnPrimary, { backgroundColor: palette.green500, opacity: pressed ? 0.85 : 1 }]}
                >
                  <T variant="caption1" style={{ color: '#fff', fontWeight: '800' }}>덮어쓰기</T>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

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

function StatRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <T allowFontScaling={false} style={{ fontSize: 16, width: 22 }}>{icon}</T>
      <T variant="caption1" color="secondary" style={{ flex: 1, fontSize: 12 }}>
        {label}
      </T>
      <T variant="label1n" color="primary" style={{ fontWeight: '800', fontSize: 14 }}>
        {value}
      </T>
    </View>
  );
}

function extractImportStats(p: BackupPayload) {
  const s = p.storage;
  const games = ((s['lottofinder.saved.v1'] as any)?.state?.games?.length) ?? 0;
  const rules = ((s['lottofinder.rules.v1'] as any)?.state?.rules?.length) ?? 0;
  const weekly = (s['lottofinder.jachanism.v2'] as any)?.state?.weekly ?? {};
  const jachanismRounds = Object.keys(weekly).length;
  return { games, rules, jachanismRounds };
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
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.pill,
    marginTop: 12,
  },
  dangerBtn: {
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: 12,
  },

  // Modal
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalSheet: { width: '100%', maxWidth: 420, borderRadius: radius.xl, padding: 20 },
  textarea: {
    marginTop: 14,
    minHeight: 160,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    textAlignVertical: 'top' as any,
    outlineStyle: 'none' as any,
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  previewBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  btnGhost: {
    flex: 1, paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  btnPrimary: {
    flex: 1, paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },

  toast: {
    position: 'absolute',
    bottom: 80, alignSelf: 'center',
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: radius.pill,
  },
});
