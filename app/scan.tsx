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
import { useHistory } from '@/src/data/historyStore';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { rank } from '@/src/data/lotto';
import { parseReceiptUrl, type ParsedReceipt } from '@/src/lib/qrParse';
import { markRoundsAsNotified } from '@/src/lib/savedGameNotifier';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function Scan() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useSafeBack('/(simple)/home');
  const addMany = useSavedNumbers((s) => s.addMany);
  // 추첨 완료 회차면 즉시 당첨 결과 표시
  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const getRound = useHistory((s) => s.getRound);

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
      // 이미 추첨된 회차의 영수증이면 → 사용자가 스캔 화면에서 결과를 봤으므로
      // 백그라운드 알림 중복 방지 위해 그 회차를 "알림 보낸 것"으로 마킹.
      if (latestRound != null && parsed.round <= latestRound) {
        markRoundsAsNotified([parsed.round]).catch(() => {});
      }
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
                <Button title="직접 입력으로 추가하기" variant="outline" onPress={() => router.push('/manual-pick' as any)} />
              </View>
            </View>
          </Card>
        ) : parsed ? (
          /* 파싱 성공 — 미리보기 + 게임별 즉시 당첨 표시 + 저장 CTA */
          (() => {
            // 추첨 완료된 회차인지 — getRound 우선, fallback drawsMap
            const drawn = getRound(parsed.round) ?? drawsMap[parsed.round] ?? null;
            const isCompletedRound = latestRound != null && parsed.round <= latestRound;
            const ranks = drawn
              ? parsed.games.map((g) => rank(g.nums, drawn.nums, drawn.bonus))
              : null;
            const winCount = ranks ? ranks.filter((r) => r != null).length : 0;
            const bestRank = ranks
              ? ranks.reduce<number | null>((m, r) => (r != null && (m == null || r < m)) ? r : m, null)
              : null;
            const rankTone = (r: number): { color: string; bg: string; label: string } => {
              if (r === 1) return { color: palette.red500, bg: 'rgba(255,66,66,0.10)', label: '1등' };
              if (r === 2) return { color: '#ea580c',      bg: 'rgba(234,88,12,0.10)', label: '2등' };
              if (r === 3) return { color: '#a37116',      bg: 'rgba(232,176,78,0.12)', label: '3등' };
              if (r === 4) return { color: palette.blue700, bg: 'rgba(0,102,255,0.08)', label: '4등' };
              return         { color: palette.green700, bg: 'rgba(0,191,64,0.08)', label: '5등' };
            };
            return (
              <Card padding={16}>
                {/* 회차 + 영수증 인식 + 결과 요약 (한 줄 칩) */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <T variant="title3" color="primary" style={{ fontWeight: '800' }}>
                      제 {parsed.round}회
                    </T>
                    <T variant="caption1" color="tertiary" style={{ fontWeight: '600' }}>
                      영수증 인식
                    </T>
                  </View>
                  {drawn && bestRank != null ? (
                    <View style={[styles.summaryChip, { backgroundColor: rankTone(bestRank).color }]}>
                      <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.3 }}>
                        🎉 {winCount}게임 당첨
                      </T>
                    </View>
                  ) : drawn ? (
                    <View style={[styles.summaryChip, { backgroundColor: '#9aa0a6' }]}>
                      <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>
                        미당첨
                      </T>
                    </View>
                  ) : (
                    <Chip label={`${parsed.games.length}게임`} tone="accent" compact />
                  )}
                </View>

                {/* 추첨 전/데이터 없음 안내 (있을 때만 작게) */}
                {!drawn && (
                  <View style={[styles.statusNotice, { backgroundColor: palette.softFill }]}>
                    <T variant="caption2" allowFontScaling={false} style={{ color: t.fgSecondary, fontSize: 11, fontWeight: '700' }}>
                      {isCompletedRound
                        ? `⏳ ${parsed.round}회 데이터를 불러오는 중...`
                        : `⏳ 아직 추첨 전이에요 (${parsed.round}회 추첨 후 결과 확인)`}
                    </T>
                    {__DEV__ && isCompletedRound && (
                      <T variant="caption2" allowFontScaling={false} style={{ color: '#888', fontSize: 9.5, marginTop: 3 }}>
                        [DEV] round={parsed.round}, latest={latestRound}, mapSize={Object.keys(drawsMap).length}
                      </T>
                    )}
                  </View>
                )}

                <View style={{ gap: 8 }}>
                  {parsed.games.map((g, i) => {
                    const r = ranks ? ranks[i] : null;
                    const isWin = r != null;
                    const tone = isWin ? rankTone(r) : null;
                    return (
                      <View
                        key={g.label}
                        style={[
                          styles.gameLine,
                          {
                            backgroundColor: tone ? tone.bg : t.bgSurface2,
                            borderColor: tone ? tone.color : t.borderDivider,
                            borderWidth: isWin ? 2 : 1,
                          },
                        ]}
                      >
                        <View style={styles.gameLineHeader}>
                          <View style={[styles.label, { backgroundColor: palette.softFill }]}>
                            <T variant="caption2" color="secondary" style={{ fontWeight: '800' }} allowFontScaling={false}>
                              {g.label}
                            </T>
                          </View>
                          <Chip label={g.type === 'auto' ? '자동' : '수동'} compact tone={g.type === 'auto' ? 'accent' : 'neutral'} />
                          <View style={{ flex: 1 }} />
                          {/* 우측: 당첨 시 큰 등수 배지 (없으면 비움) */}
                          {isWin && tone && (
                            <View style={[styles.rankBadge, { backgroundColor: tone.color }]}>
                              <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.3 }}>
                                {tone.label}
                              </T>
                            </View>
                          )}
                        </View>
                        {/* 공 6개 — 당첨번호와 일치하는 공은 점선 ring */}
                        <BallRow
                          nums={g.nums}
                          size="sm"
                          hits={drawn ? g.nums.filter((n) => drawn.nums.includes(n) || drawn.bonus === n) : undefined}
                        />
                      </View>
                    );
                  })}
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
            );
          })()
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
            onPress={() => router.push('/manual-pick' as any)}
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
            <T variant="caption1" style={{ color: t.bgCanvas, fontWeight: '700', marginLeft: 6 }}>
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

  // 게임 한 줄 — 컨테이너 카드 (둥근 모서리 + 일관된 보더)
  gameLine: {
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    // borderColor / borderWidth는 인라인에서 등수에 따라 적용
  },
  gameLineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    width: 26, height: 26, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  // 상단 결과 요약 칩 (헤더 우측)
  summaryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  // 추첨 전/데이터 없음 안내 박스 (작게)
  statusNotice: {
    padding: 10,
    borderRadius: radius.md,
    marginBottom: 10,
  },
  // 게임별 등수 칩 (우측)
  rankBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    minWidth: 40,
    alignItems: 'center',
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
