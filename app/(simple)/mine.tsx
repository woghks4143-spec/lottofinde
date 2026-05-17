/**
 * 내 번호 — 보관함. 회차별 그룹 + 당첨 등수.
 *
 * 회차가 추첨된 후 자동으로 등수 매겨주고, 950건 넘으면 한도 경고 배너.
 * (CSV 내보내기는 사용자가 캡처를 더 선호해 제거 — 데이터는 AsyncStorage에서 직접 export 가능.)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { AppBar, IconBtn } from '@/src/components/AppBar';
import { BallRow } from '@/src/components/BallRow';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import { useSavedNumbers, type SavedGame } from '@/src/store/savedNumbers';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function Mine() {
  const t = useTheme();
  const router = useRouter();
  const games = useSavedNumbers((s) => s.games);
  const remove = useSavedNumbers((s) => s.remove);
  const removeRound = useSavedNumbers((s) => s.removeRound);
  const clear = useSavedNumbers((s) => s.clear);
  const syncResults = useSavedNumbers((s) => s.syncResults);
  const totalPayout = useSavedNumbers((s) => s.totalPayout);
  const historyLatest = useHistory((s) => s.latestRound);
  const getRound = useHistory((s) => s.getRound);

  /** 삭제 확인 모달 상태 — 전체/회차 둘 다 처리. */
  const [confirm, setConfirm] = useState<
    | { kind: 'all'; count: number }
    | { kind: 'round'; round: number | null; count: number }
    | null
  >(null);

  const askClearAll = () => setConfirm({ kind: 'all', count: games.length });
  const askClearRound = (round: number | null, count: number) =>
    setConfirm({ kind: 'round', round, count });

  const doConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'all') {
      clear();
    } else {
      removeRound(confirm.round);
    }
    setConfirm(null);
  };
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [winsOnly, setWinsOnly] = useState(false);
  /** 출처 필터 — 전체 / 앱 생성(gen·simulator·manual) / QR 스캔. */
  const [sourceFilter, setSourceFilter] = useState<'all' | 'app' | 'qr'>('all');

  // Sync result for any newly available draw.
  useEffect(() => { syncResults(); }, [historyLatest, games.length, syncResults]);

  /** 출처 필터로 게임 좁히기. 'app'은 qr이 아닌 모든 것. */
  const sourceFiltered = useMemo(() => {
    if (sourceFilter === 'all') return games;
    if (sourceFilter === 'qr') return games.filter((g) => g.source === 'qr');
    return games.filter((g) => g.source !== 'qr');
  }, [games, sourceFilter]);

  // 출처별 카운트 (탭 라벨에 표시)
  const counts = useMemo(() => ({
    all: games.length,
    app: games.filter((g) => g.source !== 'qr').length,
    qr: games.filter((g) => g.source === 'qr').length,
  }), [games]);

  // Group games by round (null → "다음 회차").
  const groups = useMemo(() => {
    const filtered = winsOnly ? sourceFiltered.filter((g) => g.result?.rank != null) : sourceFiltered;
    const byRound = new Map<number | 'next', SavedGame[]>();
    for (const g of filtered) {
      const k = g.round ?? 'next';
      const arr = byRound.get(k) ?? [];
      arr.push(g);
      byRound.set(k, arr);
    }
    return [...byRound.entries()]
      .sort(([a], [b]) => {
        if (a === 'next') return -1;
        if (b === 'next') return 1;
        return (b as number) - (a as number);
      });
  }, [sourceFiltered, winsOnly]);


  const empty = games.length === 0;
  // 5,000 한도의 95% 이상이면 경고 (4,750+)
  const aboveLimit = games.length >= 4750;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title="내 번호"
        trailing={
          <>
            <IconBtn onPress={() => router.push('/scan' as any)}>
              <Icon.qr color={t.fgSecondary} />
            </IconBtn>
            <IconBtn onPress={() => setWinsOnly((v) => !v)}>
              <Icon.filter color={winsOnly ? t.fgAccent : t.fgSecondary} />
            </IconBtn>
          </>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
        {/* Summary card */}
        <Card padding={16}>
          <View style={styles.summaryRow}>
            <View>
              <T variant="caption1" color="tertiary">저장 게임</T>
              <T variant="title3" color="primary" style={{ fontWeight: '700' }}>
                {games.length} <T variant="caption1" color="tertiary">/ 5,000</T>
              </T>
            </View>
            <View style={styles.divider} />
            <View style={{ flex: 1 }}>
              <T variant="caption1" color="tertiary">누적 당첨금</T>
              <T variant="title3" color="primary" style={{ fontWeight: '700' }}>
                {formatWon(totalPayout())}
              </T>
            </View>
          </View>
          {aboveLimit && (
            <View style={[styles.warn, { backgroundColor: t.bgWarnSoft, borderColor: t.borderWarn }]}>
              <T variant="caption1" style={{ color: t.fgWarn }} allowFontScaling={false}>
                ⚠️ 보관함이 거의 가득 찼어요 ({games.length}/5,000). 오래된 항목을 정리해 주세요.
              </T>
            </View>
          )}
        </Card>

        {/* 한도 안내 카드 — 항상 표시 (작은 부가 정보) */}
        <View style={[styles.infoCard, { backgroundColor: t.bgSurface2, borderColor: t.borderDivider }]}>
          <T allowFontScaling={false} style={{ fontSize: 14 }}>💡</T>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <T variant="caption1" color="primary" style={{ fontWeight: '800', fontSize: 12 }} allowFontScaling={false}>
              저장 한도 5,000건
            </T>
            <T variant="caption2" color="tertiary" allowFontScaling={false} style={{ marginTop: 2, lineHeight: 15, fontSize: 11 }}>
              앱을 쾌적하게 쓸 수 있도록 5,000건으로 제한했어요. 스크롤이나 필터가 느려진다고 느끼면 오래된 조합을 삭제하면 다시 빨라집니다.
            </T>
          </View>
        </View>

        {/* 전체 삭제 — 보관함에 항목이 있을 때만 노출 */}
        {!empty && (
          <Pressable
            onPress={askClearAll}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                borderColor: 'rgba(255,66,66,0.35)',
                backgroundColor: 'rgba(255,66,66,0.06)',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <T variant="caption1" allowFontScaling={false} style={{ color: palette.red500, fontWeight: '800', fontSize: 12 }}>
              🗑 전체 삭제
            </T>
          </Pressable>
        )}

        {/* 출처별 segmented 탭 — 전체 / 앱 생성 / QR 스캔 */}
        {games.length > 0 && (
          <View style={[styles.segWrap, { backgroundColor: t.bgSurface2 }]}>
            {(['all', 'app', 'qr'] as const).map((k) => {
              const on = sourceFilter === k;
              const label = k === 'all' ? '전체' : k === 'app' ? '앱 생성' : 'QR 스캔';
              const count = counts[k];
              return (
                <Pressable
                  key={k}
                  onPress={() => setSourceFilter(k)}
                  style={({ pressed }) => [
                    styles.segBtn,
                    on && [styles.segBtnActive, { backgroundColor: t.bgSurface }],
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <T
                    variant="caption1"
                    style={{ color: on ? palette.blue700 : t.fgSecondary, fontWeight: on ? '800' : '600' }}
                    allowFontScaling={false}
                  >
                    {label}
                  </T>
                  <T
                    variant="caption2"
                    style={{ color: on ? palette.blue700 : t.fgTertiary, fontWeight: '700', fontSize: 10.5, marginLeft: 4 }}
                    allowFontScaling={false}
                  >
                    {count}
                  </T>
                </Pressable>
              );
            })}
          </View>
        )}

        {winsOnly && (
          <View style={styles.filterBar}>
            <Chip label="당첨만 보기" tone="accent" />
            <Pressable onPress={() => setWinsOnly(false)}>
              <T variant="caption1" color="accent" style={{ fontWeight: '600' }}>해제</T>
            </Pressable>
          </View>
        )}

        {empty ? (
          <Card padding={28}>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <View style={[styles.emptyIcon, { backgroundColor: palette.softFill }]}>
                <Icon.history color={t.fgTertiary} size={28} />
              </View>
              <T variant="heading2" color="primary">저장한 번호가 없어요</T>
              <T variant="body2r" color="tertiary" style={{ textAlign: 'center' }}>
                구매한 로또 영수증의 QR을 스캔하거나{'\n'}직접 입력으로 번호를 추가해 보세요.
              </T>
              <View style={{ marginTop: 8, gap: 8, alignSelf: 'stretch' }}>
                <Button title="QR 스캔으로 저장" variant="primary" full onPress={() => router.push('/scan' as any)} />
                <Button title="직접 입력으로 저장" variant="outline" full onPress={() => router.push('/manual-pick' as any)} />
              </View>
            </View>
          </Card>
        ) : groups.length === 0 ? (
          /* 필터로 좁혀서 0개일 때 — 전체는 있지만 현재 출처/당첨만 조건 미충족 */
          <Card padding={28}>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <T variant="heading2" color="primary">
                {sourceFilter === 'qr' ? 'QR 스캔으로 저장한 번호가 없어요'
                  : sourceFilter === 'app' ? '앱에서 생성한 번호가 없어요'
                  : '조건에 맞는 번호가 없어요'}
              </T>
              <T variant="caption1" color="tertiary" style={{ textAlign: 'center' }}>
                다른 출처 탭을 선택하거나 필터를 해제해 보세요
              </T>
            </View>
          </Card>
        ) : (
          groups.map(([roundKey, items]) => {
            const round = roundKey === 'next' ? null : (roundKey as number);
            const draw = round != null ? getRound(round) : null;
            const wins = items.filter((g) => g.result?.rank != null);
            const totalPayoutGroup = items.reduce((s, g) => s + (g.result?.payout ?? 0), 0);
            const headerKey = `g_${roundKey}`;
            const isOpen = expanded[headerKey] ?? roundKey === 'next';
            return (
              <Card key={headerKey} padding={0}>
                <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                  <Pressable
                    onPress={() => setExpanded((s) => ({ ...s, [headerKey]: !isOpen }))}
                    style={[styles.groupHeader, { flex: 1 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                          {round == null ? '다음 회차' : `${round}회`}
                        </T>
                        {draw && (
                          <T variant="caption1" color="tertiary">{short(draw.date)}</T>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        <Chip label={`${items.length}게임`} compact />
                        {wins.length > 0 && (
                          <Chip label={`${wins.length}건 당첨`} tone="success" compact />
                        )}
                        {totalPayoutGroup > 0 && (
                          <Chip label={`${formatWon(totalPayoutGroup)}`} tone="accent" compact />
                        )}
                      </View>
                    </View>
                    <View style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}>
                      <Icon.chev color={t.fgTertiary} weight={2} />
                    </View>
                  </Pressable>
                  {/* 회차 삭제 — 헤더에서 바로 (펼치지 않아도 가능) */}
                  <Pressable
                    onPress={() => askClearRound(round, items.length)}
                    style={({ pressed }) => [
                      styles.groupDelBtn,
                      { borderColor: t.borderDivider, opacity: pressed ? 0.6 : 1 },
                    ]}
                    hitSlop={6}
                  >
                    <Icon.close color={palette.red500} size={16} weight={2.2} />
                  </Pressable>
                </View>
                {isOpen && (
                  <View style={styles.groupBody}>
                    {draw && (
                      <View style={[styles.winningRow, { borderColor: t.borderDivider }]}>
                        <T variant="caption1" color="tertiary">당첨</T>
                        <BallRow nums={draw.nums} bonus={draw.bonus} size="xs" />
                      </View>
                    )}
                    {items.map((g) => (
                      <View key={g.id} style={[styles.gameRow, { borderColor: t.borderDivider }]}>
                        <View style={{ flex: 1, gap: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {g.label && (
                              <View style={[styles.label, { backgroundColor: palette.softFill }]}>
                                <T variant="caption2" color="secondary" style={{ fontWeight: '700' }}>{g.label}</T>
                              </View>
                            )}
                            <T variant="caption1" color="tertiary">{sourceLabel(g.source)}</T>
                            {g.result?.rank != null && (
                              <Chip label={`${g.result.rank}등`} tone={g.result.rank <= 3 ? 'accent' : 'success'} compact />
                            )}
                          </View>
                          <BallRow
                            nums={g.nums}
                            size="sm"
                            hits={g.result?.hits}
                          />
                        </View>
                        <Pressable onPress={() => remove(g.id)} hitSlop={8}>
                          <Icon.close color={t.fgTertiary} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            );
          })
        )}

        <Disclaimer short />
      </ScrollView>

      {/* 삭제 확인 모달 — 좌측 빨강 보더 + 깔끔한 타이포그래피 */}
      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setConfirm(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: t.bgSurface }]} onPress={(e) => e.stopPropagation()}>
            {/* 좌측 빨강 보더 + 경고 라벨 */}
            <View style={styles.modalLeftBorder} />
            <View style={{ flex: 1, padding: 24 }}>
              <View style={[styles.warnLabel, { backgroundColor: 'rgba(255,66,66,0.10)' }]}>
                <T variant="caption2" allowFontScaling={false} style={{ color: palette.red500, fontWeight: '800', fontSize: 10, letterSpacing: 0.4 }}>
                  ⚠ 영구 삭제
                </T>
              </View>
              <T variant="title3" color="primary" style={{ fontWeight: '900', marginTop: 12, fontSize: 19 }}>
                {confirm?.kind === 'all'
                  ? '보관함 전체 삭제'
                  : confirm?.kind === 'round'
                  ? (confirm.round == null ? '다음 회차' : `${confirm.round}회`) + ' 전체 삭제'
                  : ''}
              </T>
              <T variant="body2r" color="secondary" style={{ marginTop: 6, lineHeight: 21 }}>
                {confirm && (
                  <>
                    <T variant="body2r" color="primary" style={{ fontWeight: '800' }}>{confirm.count}개</T>
                    의 조합이 사라지고, 되돌릴 수 없습니다.
                  </>
                )}
              </T>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 22 }}>
                <Pressable
                  onPress={() => setConfirm(null)}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    { backgroundColor: t.bgSurface2, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <T variant="body2n" color="primary" style={{ fontWeight: '700' }}>취소</T>
                </Pressable>
                <Pressable
                  onPress={doConfirm}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.modalBtnDanger,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Icon.close color="#fff" size={14} weight={2.8} />
                  <T variant="body2n" style={{ color: '#fff', fontWeight: '800', marginLeft: 6 }}>삭제</T>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function sourceLabel(s: SavedGame['source']): string {
  return s === 'qr' ? 'QR' : s === 'manual' ? '수동' : s === 'gen' ? '조합 생성' : '조합 필터링';
}

function short(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatWon(n: number): string {
  if (n <= 0) return '0원';
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const won = n % 10_000;
  if (eok > 0) {
    return man > 0
      ? `${eok}억 ${man.toLocaleString('ko')}만원`
      : `${eok}억원`;
  }
  if (man > 0) return `${man.toLocaleString('ko')}만${won > 0 ? ` ${won.toLocaleString('ko')}` : ''}원`;
  return `${won.toLocaleString('ko')}원`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  divider: { width: 1, height: 32, backgroundColor: 'rgba(112,115,124,0.2)' },
  warn: { padding: 10, marginTop: 12, borderRadius: radius.sm, borderWidth: 1 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 회차 헤더 우측 삭제 버튼 (펼치지 않아도 삭제 가능)
  groupDelBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
  },

  // 삭제 확인 모달 — 깔끔 버전
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.xl + 2,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  modalLeftBorder: {
    width: 4,
    backgroundColor: palette.red500,
  },
  warnLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  modalBtnDanger: {
    backgroundColor: palette.red500,
  },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },

  // 출처 segmented
  segWrap: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    gap: 2,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  segBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  groupBody: { paddingHorizontal: 14, paddingBottom: 12 },
  winningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  label: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
});
