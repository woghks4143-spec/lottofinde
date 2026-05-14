/**
 * 개별 조합 생성 페이지 — /pick?mode=<GenMode>
 *
 * 사용자가 조합생성 hub에서 모드를 고른 뒤 들어오는 페이지. 가중치 뽑기와
 * 일관된 디자인이며, 모드별 hero·hint·알고리즘만 다르다.
 *
 * 의미 부여 모드일 때만 생일/기념일 시드 입력 필드가 추가로 노출된다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '@/src/lib/navigation';
import { T } from '@/src/components/Text';
import { AppBar } from '@/src/components/AppBar';
import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { CombinationCard } from '@/src/components/CombinationCard';
import { Disclaimer } from '@/src/components/Disclaimer';
import { useHistory } from '@/src/data/historyStore';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import { GEN_MODES, generateMany, parseSeedInput, type GenMode } from '@/src/lib/generator';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const COUNT = 5;

const MODE_META: Record<GenMode, { emoji: string; tone: string }> = {
  random:     { emoji: '🎲', tone: 'rgba(0,102,255,0.10)' },
  weighted:   { emoji: '📊', tone: 'rgba(0,191,64,0.10)' },
  statBased:  { emoji: '🧠', tone: 'rgba(101,65,242,0.10)' },
  patternFit: { emoji: '✨', tone: 'rgba(255,193,7,0.10)' },
  average:    { emoji: '🎯', tone: 'rgba(0,152,178,0.12)' },
  meaning:    { emoji: '🎁', tone: 'rgba(255,114,114,0.10)' },
};

export default function Pick() {
  const t = useTheme();
  const goBack = useSafeBack('/(simple)/gen');
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = (() => {
    const m = params.mode as GenMode | undefined;
    return GEN_MODES.find((g) => g.id === m)?.id ?? 'random';
  })();
  const meta = MODE_META[mode];
  const info = GEN_MODES.find((g) => g.id === mode)!;

  const drawsMap = useHistory((s) => s.draws);
  const latestRound = useHistory((s) => s.latestRound);
  const addSaved = useSavedNumbers((s) => s.add);

  const history = useMemo(() => {
    return Object.keys(drawsMap)
      .map((k) => Number(k))
      .sort((a, b) => b - a)
      .map((r) => drawsMap[r]);
  }, [drawsMap, latestRound]);

  const [seedInput, setSeedInput] = useState('');
  const [picks, setPicks] = useState<number[][]>([]);
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  const ctx = useMemo(() => ({
    history,
    seedNumbers: mode === 'meaning' ? parseSeedInput(seedInput) : undefined,
  }), [history, mode, seedInput]);

  const regenerate = () => {
    setPicks(generateMany(mode, ctx, COUNT));
    setSaved({});
  };

  // 의미 부여 모드는 시드 입력이 있어야만 자동 생성. 나머지 모드는 진입 즉시 1회 생성.
  useEffect(() => {
    if (mode === 'meaning' && parseSeedInput(seedInput).length === 0) return;
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, seedInput]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  const onSave = (i: number) => {
    const nums = picks[i];
    if (!nums) return;
    const res = addSaved({ nums, round: null, source: 'gen' });
    if (res.ok) {
      setSaved((s) => ({ ...s, [i]: true }));
      setToast('보관함에 저장했어요');
    } else if (res.reason === 'duplicate') {
      setToast('이미 저장한 번호예요');
    } else {
      setToast('보관함이 가득 찼어요');
    }
  };

  const meaningReady = mode !== 'meaning' || parseSeedInput(seedInput).length > 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar title={info.label} onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>

        {/* Hero — 모드 설명 */}
        <Card padding={16}>
          <View style={styles.heroRow}>
            <View style={[styles.heroIcon, { backgroundColor: meta.tone }]}>
              <T allowFontScaling={false} style={{ fontSize: 28 }}>{meta.emoji}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T variant="heading2" color="primary" style={{ fontWeight: '800' }}>
                {info.label}
              </T>
              <T variant="body2r" color="secondary" style={{ marginTop: 4, lineHeight: 20 }}>
                {info.hint}
              </T>
            </View>
          </View>
        </Card>

        {/* 의미 부여: 생일/기념일 입력 */}
        {mode === 'meaning' && (
          <Card padding={14}>
            <T variant="label1n" color="primary" style={{ fontWeight: '700', marginBottom: 8 }}>
              의미를 부여할 숫자 (생일·기념일)
            </T>
            <TextInput
              value={seedInput}
              onChangeText={setSeedInput}
              placeholder="예: 19960628"
              placeholderTextColor={t.fgTertiary}
              keyboardType="number-pad"
              maxLength={20}
              style={[styles.input, { color: t.fgPrimary, borderColor: t.borderNormal }]}
            />
            {parseSeedInput(seedInput).length > 0 && (
              <View style={styles.seedPoolRow}>
                <T variant="caption1" color="tertiary" style={{ marginRight: 6 }}>
                  추출 후보 →
                </T>
                <View style={styles.seedPoolBalls}>
                  {parseSeedInput(seedInput).sort((a, b) => a - b).map((n) => (
                    <View key={n} style={[styles.seedTag, { backgroundColor: palette.softFill }]}>
                      <T variant="caption1" color="primary" style={{ fontWeight: '700' }} allowFontScaling={false}>
                        {n}
                      </T>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <T variant="caption1" color="tertiary" style={{ marginTop: 8, lineHeight: 18 }}>
              날짜(YYYYMMDD) 형식이면 월·일을 자동 인식해 시드로 써요. 매번 다른 시드 조합으로 5게임을 만들어요.
            </T>
          </Card>
        )}

        {/* 결과 카드 — CombinationCard로 일관된 UX */}
        {meaningReady && picks.length > 0 && (
          <View style={{ gap: 10 }}>
            <T variant="caption1" color="tertiary" style={{ marginTop: 4 }}>
              각 조합을 탭하면 직전 회차 동행수·역대 매칭까지 자세히 볼 수 있어요.
            </T>
            {picks.map((nums, i) => (
              <CombinationCard
                key={i}
                nums={nums}
                label={String.fromCharCode(65 + i)}
                onSave={() => onSave(i)}
                saved={saved[i]}
              />
            ))}
          </View>
        )}

        {/* 빈 상태 (의미 부여, 시드 없을 때) */}
        {mode === 'meaning' && !meaningReady && (
          <Card padding={28}>
            <T variant="body2r" color="tertiary" style={{ textAlign: 'center', lineHeight: 22 }}>
              위에 의미 있는 숫자를 입력하면{'\n'}자동으로 조합을 만들어 드려요.
            </T>
          </Card>
        )}

        <Button
          title={picks.length > 0 ? '5개 새로 만들기' : '5개 만들기'}
          variant="primary"
          size="lg"
          full
          disabled={!meaningReady}
          onPress={regenerate}
        />

        <Disclaimer />
      </ScrollView>

      {toast && (
        <View style={[styles.toast, { backgroundColor: t.bgInverse }]} pointerEvents="none">
          <T variant="label1n" style={{ color: t.scheme === 'dark' ? t.fgPrimary : '#fff' }}>{toast}</T>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 56, height: 56, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  seedPoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  seedPoolBalls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  seedTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    minWidth: 28,
    alignItems: 'center',
  },
  toast: {
    position: 'absolute',
    left: 24, right: 24, bottom: 90,
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: radius.lg,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
  },
});
