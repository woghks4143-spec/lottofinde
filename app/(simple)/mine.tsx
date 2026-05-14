/**
 * 내 번호 — 보관함. 회차별 그룹 + 당첨 등수 + CSV 내보내기.
 *
 * 회차가 추첨된 후 자동으로 등수 매겨주고, 950건 넘으면 한도 경고 배너.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { saveCsv, toCsv } from '@/src/lib/csv';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function Mine() {
  const t = useTheme();
  const router = useRouter();
  const games = useSavedNumbers((s) => s.games);
  const remove = useSavedNumbers((s) => s.remove);
  const syncResults = useSavedNumbers((s) => s.syncResults);
  const totalPayout = useSavedNumbers((s) => s.totalPayout);
  const historyLatest = useHistory((s) => s.latestRound);
  const getRound = useHistory((s) => s.getRound);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [winsOnly, setWinsOnly] = useState(false);

  // Sync result for any newly available draw.
  useEffect(() => { syncResults(); }, [historyLatest, games.length, syncResults]);

  // Group games by round (null → "다음 회차").
  const groups = useMemo(() => {
    const filtered = winsOnly ? games.filter((g) => g.result?.rank != null) : games;
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
  }, [games, winsOnly]);

  const onExport = async () => {
    if (games.length === 0) return;
    const rows = games.map((g) => ({
      round: g.round ?? '',
      saved_at: new Date(g.createdAt).toISOString().slice(0, 10),
      label: g.label ?? '',
      source: g.source,
      n1: g.nums[0], n2: g.nums[1], n3: g.nums[2],
      n4: g.nums[3], n5: g.nums[4], n6: g.nums[5],
      rank: g.result?.rank ?? '',
      hits: g.result?.hits.join(' ') ?? '',
      payout: g.result?.payout ?? 0,
      memo: g.memo ?? '',
    }));
    const csv = toCsv(rows, [
      'round', 'saved_at', 'label', 'source',
      'n1', 'n2', 'n3', 'n4', 'n5', 'n6',
      'rank', 'hits', 'payout', 'memo',
    ]);
    await saveCsv(`saved-numbers-${Date.now()}.csv`, csv);
  };

  const empty = games.length === 0;
  const aboveLimit = games.length >= 950;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title="내 번호"
        trailing={
          <>
            <IconBtn onPress={() => setWinsOnly((v) => !v)}>
              <Icon.filter color={winsOnly ? t.fgAccent : t.fgSecondary} />
            </IconBtn>
            <IconBtn onPress={onExport}>
              <Icon.download color={t.fgSecondary} />
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
                {games.length} <T variant="caption1" color="tertiary">/ 1,000</T>
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
                ⚠️ 보관함이 거의 가득 찼어요 ({games.length}/1,000). 오래된 항목을 정리해 주세요.
              </T>
            </View>
          )}
        </Card>

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
                QR 스캔이나 직접 입력으로 추가해 보세요.
              </T>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Button title="번호 받기" variant="primary" onPress={() => router.push('/(simple)/gen' as any)} />
                <Button title="당첨 확인" variant="outline" onPress={() => router.push('/(simple)/check' as any)} />
              </View>
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
                <Pressable
                  onPress={() => setExpanded((s) => ({ ...s, [headerKey]: !isOpen }))}
                  style={styles.groupHeader}
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

        {!empty && (
          <Button
            title="CSV로 내보내기"
            variant="outline"
            size="md"
            full
            onPress={onExport}
          />
        )}

        <Disclaimer short />
      </ScrollView>
    </SafeAreaView>
  );
}

function sourceLabel(s: SavedGame['source']): string {
  return s === 'qr' ? 'QR' : s === 'manual' ? '수동' : s === 'gen' ? '번호 받기' : '시뮬레이터';
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
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
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
