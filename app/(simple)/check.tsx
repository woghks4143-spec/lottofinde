/**
 * 당첨 확인 — QR 스캔 or 직접 입력.
 *
 * QR (native only): expo-camera의 CameraView로 영수증 QR을 인식, qrParse로
 * 회차 + 5게임을 추출해 보관함에 일괄 저장.
 * 직접 입력: 회차 + 6개 번호 그리드 입력 후 즉시 등수 판정.
 *
 * Web에서는 expo-camera가 getUserMedia를 쓰지만 dev 환경에선 부정확하므로
 * QR 탭을 비활성화하고 "모바일에서 사용하세요" 힌트를 보여준다.
 */
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { BallRow } from '@/src/components/BallRow';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { NumPicker } from '@/src/components/NumPicker';
import { useHistory } from '@/src/data/historyStore';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { rank, hits as hitsFn } from '@/src/data/lotto';
import { parseReceiptUrl, type ParsedReceipt } from '@/src/lib/qrParse';
import { markRoundsAsNotified } from '@/src/lib/savedGameNotifier';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

type Tab = 'qr' | 'manual';

export default function Check() {
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(Platform.OS === 'web' ? 'manual' : 'qr');
  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title="당첨 확인" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        {/* Tab selector — 웹에서는 QR 스캔이 불가하므로 직접 입력만 노출 */}
        {!isWeb && (
          <View style={[styles.tabBar, { backgroundColor: t.bgSurface2, borderColor: t.borderDivider }]}>
            <TabBtn
              label="QR 스캔"
              active={tab === 'qr'}
              onPress={() => setTab('qr')}
            />
            <TabBtn
              label="직접 입력"
              active={tab === 'manual'}
              onPress={() => setTab('manual')}
            />
          </View>
        )}

        {tab === 'qr' ? (
          isWeb ? <WebHint /> : <QrTab />
        ) : (
          <ManualTab />
        )}

        <Disclaimer />
        <View style={{ height: 4 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Tab buttons ─────────────────────────────────────────────────────────────

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active && { backgroundColor: t.bgSurface, borderColor: palette.purple500 },
        { opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <T
        variant="label1n"
        style={{
          color: active ? palette.purple500 : t.fgSecondary,
          fontWeight: active ? '800' : '600',
        }}
        allowFontScaling={false}
      >
        {label}
      </T>
    </Pressable>
  );
}

function WebHint() {
  return (
    <Card padding={24}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Icon.qr color={palette.blue700} size={36} />
        <T variant="heading2" color="primary">QR 스캔은 모바일에서</T>
        <T variant="body2r" color="tertiary" style={{ textAlign: 'center' }}>
          웹 브라우저에서는 영수증 QR을 인식하기 어려워요. 모바일 앱에서
          QR로 빠르게 5게임을 한 번에 저장할 수 있습니다.
        </T>
      </View>
    </Card>
  );
}

// ─── QR tab ──────────────────────────────────────────────────────────────────

function QrTab() {
  const t = useTheme();
  const addMany = useSavedNumbers((s) => s.addMany);
  // 추첨 완료 회차면 즉시 당첨 결과 표시
  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const getRound = useHistory((s) => s.getRound);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [hasScanned, setHasScanned] = useState(false);

  // Lazy import expo-camera so it doesn't break Web tree-shake.
  const CameraView = React.useMemo(() => {
    try {
      // Dynamic import — keep out of static graph.
      // @ts-ignore
      const mod = require('expo-camera');
      return { CameraView: mod.CameraView, useCameraPermissions: mod.useCameraPermissions };
    } catch {
      return null;
    }
  }, []);

  // Camera permission flow.
  const [perm, requestPerm] = (CameraView?.useCameraPermissions?.() ?? [null, async () => null]) as [
    { granted: boolean } | null,
    () => Promise<{ granted: boolean }>,
  ];

  React.useEffect(() => {
    if (perm) setPermission(perm.granted ? 'granted' : 'denied');
  }, [perm]);

  const onScanned = ({ data }: { data: string }) => {
    if (hasScanned) return;
    const r = parseReceiptUrl(data);
    if (!r) {
      setError('QR을 인식했지만 형식이 맞지 않아요. 다시 시도해 주세요.');
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
    // 이미 추첨된 회차면 알림 중복 방지 (사용자가 이 화면에서 결과 확인함)
    if (res.added > 0 && latestRound != null && parsed.round <= latestRound) {
      markRoundsAsNotified([parsed.round]).catch(() => {});
    }
    setParsed(null);
    setHasScanned(false);
    setError(res.added > 0 ? null : '이미 저장한 영수증이에요.');
  };

  if (!CameraView) {
    return <WebHint />;
  }

  if (parsed) {
    // 추첨 완료된 회차인지 — getRound로 안전 조회 (drawsMap 직접 접근보다 robust)
    const drawn = getRound(parsed.round) ?? drawsMap[parsed.round] ?? null;
    // 회차 상태 판단 — 추첨 완료/예정 명확히 구분
    const isCompletedRound = latestRound != null && parsed.round <= latestRound;
    const ranks = drawn
      ? parsed.games.map((g) => rank(g.nums, drawn.nums, drawn.bonus))
      : null;
    // 통계 — 1~5등 카운트
    const winCount = ranks ? ranks.filter((r) => r != null).length : 0;
    const bestRank = ranks ? ranks.reduce<number | null>((m, r) => (r != null && (m == null || r < m)) ? r : m, null) : null;

    return (
      <Card padding={14}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <T variant="heading2" color="primary">영수증 인식 완료</T>
          <Chip label={`${parsed.round}회`} tone="accent" />
        </View>

        {/* 추첨 완료 회차면 당첨번호 + 결과 요약 표시 */}
        {drawn ? (
          <View style={[styles.resultHero, {
            backgroundColor: bestRank != null && bestRank <= 3
              ? 'rgba(255,66,66,0.10)'
              : bestRank != null
                ? 'rgba(0,191,64,0.10)'
                : palette.softFill,
            borderColor: bestRank != null && bestRank <= 3
              ? palette.red500
              : bestRank != null
                ? palette.green500
                : 'transparent',
          }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <T variant="caption1" allowFontScaling={false} style={{
                color: bestRank != null && bestRank <= 3 ? palette.red500 : bestRank != null ? palette.green700 : t.fgTertiary,
                fontWeight: '800', fontSize: 12, letterSpacing: 0.3,
              }}>
                {bestRank != null
                  ? `🎉 ${bestRank}등 ${winCount > 1 ? `포함 ${winCount}게임 당첨!` : '당첨!'}`
                  : winCount === 0
                    ? '아쉽지만 모두 미당첨'
                    : ''}
              </T>
            </View>
            <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ fontSize: 10.5, marginBottom: 6, fontWeight: '700' }}>
              {parsed.round}회 당첨번호
            </T>
            <BallRow nums={drawn.nums} bonus={drawn.bonus} size="sm" style={{ gap: 4 }} />
          </View>
        ) : isCompletedRound ? (
          // 추첨 완료 회차인데 데이터가 store에 없음 — drop된 옛 회차거나 hydrate 지연
          <View style={[styles.resultHero, { backgroundColor: palette.softFill, borderColor: 'transparent' }]}>
            <T variant="caption2" allowFontScaling={false} style={{ color: t.fgSecondary, fontSize: 11.5, fontWeight: '700' }}>
              ⏳ {parsed.round}회 데이터를 불러오는 중... (잠시 후 다시 시도하거나 보관함에 저장 후 확인)
            </T>
            {__DEV__ && (
              <T variant="caption2" allowFontScaling={false} style={{ color: '#888', fontSize: 9.5, marginTop: 4 }}>
                [DEV] round={parsed.round}, latest={latestRound}, mapSize={Object.keys(drawsMap).length}
              </T>
            )}
          </View>
        ) : (
          <View style={[styles.resultHero, { backgroundColor: palette.softFill, borderColor: 'transparent' }]}>
            <T variant="caption2" allowFontScaling={false} style={{ color: t.fgSecondary, fontSize: 11.5, fontWeight: '700' }}>
              ⏳ 아직 추첨 전이에요 ({parsed.round}회 추첨 후 보관함에서 결과 확인)
            </T>
          </View>
        )}

        <View style={{ gap: 10, marginTop: 12 }}>
          {parsed.games.map((g, i) => {
            const r = ranks ? ranks[i] : null;
            const isWin = r != null;
            return (
              <View key={g.label} style={[
                styles.gameLine,
                {
                  borderColor: isWin && r <= 3 ? palette.red500 : isWin ? palette.green500 : t.borderDivider,
                  borderWidth: isWin ? 2 : 1,
                },
              ]}>
                <View style={[styles.label, { backgroundColor: palette.softFill }]}>
                  <T variant="caption2" color="secondary" style={{ fontWeight: '700' }}>{g.label}</T>
                </View>
                <Chip label={g.type === 'auto' ? '자동' : '수동'} compact tone={g.type === 'auto' ? 'accent' : 'neutral'} />
                <View style={{ flex: 1 }}>
                  <BallRow
                    nums={g.nums}
                    size="sm"
                    hits={drawn ? g.nums.filter((n) => drawn.nums.includes(n) || drawn.bonus === n) : undefined}
                  />
                </View>
                {r != null && (
                  <View style={[styles.rankBadge, {
                    backgroundColor:
                      r === 1 ? palette.red500
                      : r === 2 ? '#ea580c'
                      : r === 3 ? '#a37116'
                      : r === 4 ? palette.blue700
                      : palette.green700,
                  }]}>
                    <T variant="caption2" allowFontScaling={false} style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>
                      {r}등
                    </T>
                  </View>
                )}
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button title="다시 스캔" variant="outline" size="md" onPress={() => { setParsed(null); setHasScanned(false); }} />
          <View style={{ flex: 1 }}>
            <Button title={`${parsed.games.length}게임 보관함에 저장`} variant="primary" size="md" full onPress={saveAll} />
          </View>
        </View>
      </Card>
    );
  }

  if (permission === 'undetermined') {
    return (
      <Card padding={20}>
        <T variant="heading2" color="primary" style={{ marginBottom: 6 }}>카메라 권한이 필요해요</T>
        <T variant="body2r" color="tertiary" style={{ marginBottom: 14 }}>
          영수증 QR을 인식하려면 카메라 사용 권한을 허용해 주세요.
        </T>
        <Button title="권한 요청" variant="primary" full onPress={() => requestPerm()} />
      </Card>
    );
  }

  if (permission === 'denied') {
    return (
      <Card padding={20}>
        <T variant="heading2" color="primary" style={{ marginBottom: 6 }}>권한이 거부됐어요</T>
        <T variant="body2r" color="tertiary" style={{ marginBottom: 14 }}>
          기기 설정에서 카메라 권한을 허용해 주세요. 직접 입력으로도 확인할 수 있습니다.
        </T>
      </Card>
    );
  }

  const Camera = CameraView.CameraView;
  return (
    <View style={styles.cameraFrame}>
      <Camera
        style={{ width: '100%', height: 320 }}
        facing="back"
        onBarcodeScanned={onScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      {/* Reticle overlay */}
      <View pointerEvents="none" style={styles.reticle}>
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>
      {error && (
        <View style={styles.errorBar}>
          <T variant="caption1" style={{ color: '#fff' }}>{error}</T>
        </View>
      )}
    </View>
  );
}

// ─── Manual tab ──────────────────────────────────────────────────────────────

function ManualTab() {
  const t = useTheme();
  const latest = useHistory((s) => s.getLatest());
  const earliest = useHistory((s) => s.earliestRound);
  const latestRound = useHistory((s) => s.latestRound);
  const add = useSavedNumbers((s) => s.add);
  const [round, setRound] = useState<number>(latestRound || 1);
  const [selected, setSelected] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  React.useEffect(() => {
    if (latestRound && !round) setRound(latestRound);
  }, [latestRound, round]);

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const draw = useHistory((s) => round ? s.getRound(round) : null);

  const result = useMemo(() => {
    if (selected.length !== 6 || !draw) return null;
    const r = rank(selected, draw.nums, draw.bonus);
    const hs = hitsFn(selected, draw.nums);
    return { rank: r, hits: hs };
  }, [selected, draw]);

  const toggle = (n: number) => {
    setSelected((s) => {
      if (s.includes(n)) return s.filter((x) => x !== n);
      if (s.length >= 6) return s;
      return [...s, n].sort((a, b) => a - b);
    });
  };

  const stepRound = (delta: number) => {
    setRound((r) => Math.max(earliest || 1, Math.min(latestRound, r + delta)));
  };

  const save = () => {
    if (selected.length !== 6) return;
    const res = add({ nums: selected, round, source: 'manual' });
    if (res.ok) {
      // 수동 입력은 항상 추첨 완료된 회차 (round picker가 latestRound로 제한됨) →
      // 사용자가 이미 결과를 확인했으므로 백그라운드 알림 중복 방지.
      markRoundsAsNotified([round]).catch(() => {});
      setToast(result?.rank != null ? `${result.rank}등 당첨! 보관함에 저장됨` : '보관함에 저장했어요');
      setSelected([]);
    } else if (res.reason === 'duplicate') {
      setToast('이미 저장한 번호예요');
    } else {
      setToast('보관함이 가득 찼어요');
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Round picker */}
      <Card padding={14}>
        <T variant="caption1" color="tertiary" style={{ marginBottom: 6 }}>확인할 회차</T>
        <View style={styles.roundRow}>
          <Pressable onPress={() => stepRound(-1)} hitSlop={8} style={styles.stepBtn}>
            <T variant="title3" color="secondary">−</T>
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <T variant="title2" color="primary" style={{ fontWeight: '700' }}>{round}회</T>
            {draw && <T variant="caption1" color="tertiary">{draw.date}</T>}
          </View>
          <Pressable onPress={() => stepRound(+1)} hitSlop={8} style={styles.stepBtn}>
            <T variant="title3" color="secondary">+</T>
          </Pressable>
        </View>
        {draw && (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <T variant="caption1" color="tertiary" style={{ marginBottom: 6 }}>당첨번호</T>
            <BallRow nums={draw.nums} bonus={draw.bonus} size="sm" />
          </View>
        )}
      </Card>

      {/* Number picker */}
      <Card padding={14}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <T variant="label1n" color="primary" style={{ fontWeight: '600' }}>내 번호 6개 선택</T>
          <T variant="caption1" color="tertiary">{selected.length}/6</T>
        </View>
        <NumPicker mode="multi" selected={selected} onToggle={toggle} />
        {selected.length > 0 && (
          <View style={{ marginTop: 14, alignItems: 'center' }}>
            <BallRow nums={[...selected, ...Array(6 - selected.length).fill(0)].slice(0, 6).map((n) => n || 0)} size="sm" hits={result?.hits} />
          </View>
        )}
      </Card>

      {/* Result card */}
      {result && (
        <Card padding={16} style={{ backgroundColor: result.rank != null ? '#e6f9ee' : palette.softFill }}>
          {result.rank != null ? (
            <>
              <T variant="title3" style={{ color: palette.green700, fontWeight: '800' }}>
                🎉 {result.rank}등 당첨!
              </T>
              <T variant="body2r" color="secondary" style={{ marginTop: 4 }}>
                {result.hits.length}개 번호가 당첨번호와 일치했어요.
              </T>
            </>
          ) : (
            <>
              <T variant="heading2" color="primary">아쉽지만 미당첨</T>
              <T variant="body2r" color="tertiary" style={{ marginTop: 4 }}>
                일치 {result.hits.length}개. 다음 회차에 다시 도전!
              </T>
            </>
          )}
        </Card>
      )}

      <Button
        title={selected.length === 6 ? '보관함에 저장' : `번호 ${6 - selected.length}개 더 선택`}
        variant="primary"
        size="lg"
        full
        disabled={selected.length !== 6}
        onPress={save}
      />

      {toast && (
        <Card padding={12} style={{ backgroundColor: palette.softFill }}>
          <T variant="label1n" color="primary">{toast}</T>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cameraFrame: {
    height: 320,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  reticle: {
    position: 'absolute',
    left: 50, right: 50, top: 50, bottom: 50,
  },
  corner: {
    position: 'absolute',
    width: 28, height: 28,
    borderColor: '#fff',
  },
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
  gameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderTopWidth: 1,
  },
  label: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  // QR 결과 — 추첨 완료 회차의 당첨번호 + 결과 요약
  resultHero: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  // 게임별 등수 칩
  rankBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 99,
    minWidth: 32, alignItems: 'center',
  },
  roundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(112,115,124,0.08)',
  },
});
