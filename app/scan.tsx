/**
 * QR 스캔 — /scan
 *
 * 로또 영수증 QR을 스캔해 5게임을 한 번에 보관함에 저장.
 * 당첨 확인과 분리된 전용 화면이라 "구매 직후 번호 저장" 목적이 분명.
 *
 * 흐름:
 *   1) 카메라 권한 요청
 *   2) 뷰파인더 + 리티클 → onBarcodeScanned
 *   3) parseReceiptUrl로 회차 + 5게임 추출
 *   4) 미리보기 카드(라벨/자동수동/공) → "X게임 저장" 버튼
 *   5) 저장 후 토스트 + 자동으로 /내 번호로 이동
 *
 * Web에서는 expo-camera 정확도가 낮아 카메라 진입 대신 안내 카드만.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { BallRow } from '@/src/components/BallRow';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { parseReceiptUrl, type ParsedReceipt } from '@/src/lib/qrParse';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function Scan() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/home');
  const addMany = useSavedNumbers((s) => s.addMany);

  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  // expo-camera 동적 로드 (web tree-shake 회피)
  const cam = useMemo(() => {
    if (Platform.OS === 'web') return null;
    try {
      // @ts-ignore
      const mod = require('expo-camera');
      return { CameraView: mod.CameraView, useCameraPermissions: mod.useCameraPermissions };
    } catch {
      return null;
    }
  }, []);

  // 카메라 권한 (cam이 null이면 fallback 더미)
  const [perm, requestPerm] = (cam?.useCameraPermissions?.() ?? [null, async () => null]) as [
    { granted: boolean } | null,
    () => Promise<{ granted: boolean }>,
  ];

  // 토스트 자동 해제
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const onScanned = ({ data }: { data: string }) => {
    if (hasScanned) return;
    const r = parseReceiptUrl(data);
    if (!r) {
      setError('영수증 QR이 아니거나 형식이 맞지 않아요. 다시 시도해 주세요.');
      return;
    }
    setHasScanned(true);
    setError(null);
    setParsed(r);
  };

  const saveAll = () => {
    if (!parsed) return;
    const receiptId = `r_${Date.now()}`;
    const res = addMany(
      parsed.games.map((g) => ({
        nums: g.nums,
        round: parsed.round,
        source: 'qr' as const,
        label: g.label,
        receiptId,
      })),
    );
    if (res.added > 0) {
      setToast(`${res.added}게임 저장됨${res.skipped > 0 ? ` · ${res.skipped}개 중복 건너뜀` : ''}`);
      // 짧은 딜레이 뒤 /내 번호로 이동 (사용자가 토스트 확인 후)
      setTimeout(() => router.replace('/(simple)/mine' as any), 800);
    } else {
      setToast('이미 저장한 영수증이에요');
      setParsed(null);
      setHasScanned(false);
    }
  };

  const resetScan = () => {
    setParsed(null);
    setHasScanned(false);
    setError(null);
  };

  // ─── 렌더링 분기 ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="QR 스캔" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* 인트로 카드 */}
        <View style={[styles.hero, { backgroundColor: palette.purple500 }]}>
          <View style={styles.heroIcon}>
            <Icon.qr color="#fff" size={28} weight={2} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <T variant="title3" style={{ color: '#fff', fontWeight: '800' }}>
              영수증 QR 스캔
            </T>
            <T variant="caption1" style={{ color: 'rgba(255,255,255,0.86)', marginTop: 4, lineHeight: 17 }}>
              구매한 로또 용지의 QR을 비추면{'\n'}5게임이 한 번에 보관함에 저장돼요
            </T>
          </View>
        </View>

        {/* Web fallback */}
        {Platform.OS === 'web' || !cam ? (
          <Card padding={24}>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Icon.qr color={palette.blue700} size={36} />
              <T variant="heading2" color="primary">QR 스캔은 모바일에서</T>
              <T variant="body2r" color="tertiary" style={{ textAlign: 'center' }}>
                웹 브라우저에서는 영수증 QR 인식이 불안정해요.{'\n'}
                모바일 앱에서 카메라로 빠르게 저장해 보세요.
              </T>
              <View style={{ marginTop: 8 }}>
                <Button title="직접 입력으로 추가하기" variant="outline" onPress={() => router.push('/(simple)/check' as any)} />
              </View>
            </View>
          </Card>
        ) : parsed ? (
          /* 파싱 성공 — 미리보기 + 저장 CTA */
          <Card padding={16}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>인식 완료</T>
              <Chip label={`${parsed.round}회`} tone="accent" />
            </View>
            <View style={{ gap: 8 }}>
              {parsed.games.map((g) => (
                <View key={g.label} style={[styles.gameLine, { borderColor: t.borderDivider }]}>
                  <View style={[styles.label, { backgroundColor: palette.softFill }]}>
                    <T variant="caption2" color="secondary" style={{ fontWeight: '800' }}>{g.label}</T>
                  </View>
                  <Chip label={g.type === 'auto' ? '자동' : '수동'} compact tone={g.type === 'auto' ? 'accent' : 'neutral'} />
                  <View style={{ flex: 1 }}>
                    <BallRow nums={g.nums} size="sm" />
                  </View>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Button title="다시 스캔" variant="outline" size="md" onPress={resetScan} />
              <View style={{ flex: 1 }}>
                <Button
                  title={`${parsed.games.length}게임 보관함에 저장`}
                  variant="primary"
                  size="md"
                  full
                  onPress={saveAll}
                />
              </View>
            </View>
          </Card>
        ) : !perm ? (
          /* 권한 모듈 로딩 중 */
          <Card padding={20}>
            <T variant="body2r" color="secondary">카메라 준비 중…</T>
          </Card>
        ) : !perm.granted ? (
          /* 권한 미허용 */
          <Card padding={20}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <View style={[styles.permIcon, { backgroundColor: palette.softFill }]}>
                <Icon.qr color={t.fgSecondary} size={28} />
              </View>
              <T variant="heading2" color="primary">카메라 권한이 필요해요</T>
              <T variant="body2r" color="tertiary" style={{ textAlign: 'center' }}>
                영수증 QR을 스캔하려면 카메라 사용 권한이 필요합니다.
              </T>
              <View style={{ marginTop: 6, alignSelf: 'stretch' }}>
                <Button title="카메라 권한 허용" variant="primary" full onPress={() => requestPerm()} />
              </View>
            </View>
          </Card>
        ) : (
          /* 권한 OK — 카메라 뷰파인더 */
          <>
            <View style={styles.cameraFrame}>
              <cam.CameraView
                style={{ width: '100%', height: 360 }}
                facing="back"
                onBarcodeScanned={onScanned}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              />
              {/* Reticle */}
              <View pointerEvents="none" style={styles.reticle}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              {error && (
                <View style={styles.errorBar}>
                  <T variant="caption1" style={{ color: '#fff', fontWeight: '700' }}>{error}</T>
                </View>
              )}
            </View>

            {/* 사용 팁 */}
            <Card padding={14}>
              <T variant="label1n" color="primary" style={{ fontWeight: '800', marginBottom: 6 }}>
                💡 사용 팁
              </T>
              <View style={{ gap: 4 }}>
                <T variant="caption1" color="tertiary" style={{ lineHeight: 18 }}>
                  · 영수증 하단의 QR을 사각형 안에 맞춰주세요
                </T>
                <T variant="caption1" color="tertiary" style={{ lineHeight: 18 }}>
                  · 조명이 충분한 곳에서 스캔하면 인식이 빨라요
                </T>
                <T variant="caption1" color="tertiary" style={{ lineHeight: 18 }}>
                  · 한 영수증의 5게임이 한 번에 저장됩니다
                </T>
              </View>
            </Card>
          </>
        )}

        {/* 직접 입력 진입 */}
        {!parsed && (
          <Pressable
            onPress={() => router.push('/(simple)/check' as any)}
            style={({ pressed }) => [
              styles.manualLink,
              { borderColor: t.borderDivider, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Icon.plus color={t.fgSecondary} size={16} weight={2.2} />
            <T variant="caption1" color="secondary" style={{ marginLeft: 6, fontWeight: '600' }}>
              QR 없이 직접 번호 입력
            </T>
          </Pressable>
        )}

        <Disclaimer short />

        {/* 토스트 */}
        {toast && (
          <View style={[styles.toast, { backgroundColor: t.bgInverse }]}>
            <Icon.check color={palette.green500} size={16} weight={2.5} />
            <T variant="caption1" style={{ color: t.scheme === 'dark' ? t.fgPrimary : '#fff', fontWeight: '700', marginLeft: 6 }}>
              {toast}
            </T>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: radius.xl + 2,
  },
  heroIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  cameraFrame: {
    height: 360,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  reticle: { position: 'absolute', left: 50, right: 50, top: 60, bottom: 60 },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#fff' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  errorBar: {
    position: 'absolute',
    left: 16, right: 16, bottom: 16,
    backgroundColor: 'rgba(255,66,66,0.92)',
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: radius.md,
  },

  permIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  gameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  label: {
    width: 24, height: 24, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },

  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },

  toast: {
    position: 'absolute',
    bottom: 24, left: 16, right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
  },
});
