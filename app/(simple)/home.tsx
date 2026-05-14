/**
 * Simple home — dark "latest round" banner + 4 big tiles + weekly summary.
 * Source: prototype/flow-h1.jsx → H1_SimpleHome
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { T } from '@/src/components/Text';
import { AppBar, IconBtn } from '@/src/components/AppBar';
import { BallRow } from '@/src/components/BallRow';
import { Card } from '@/src/components/Card';
import { Disclaimer } from '@/src/components/Disclaimer';
import { Icon } from '@/src/components/Icons';
import { useHistory } from '@/src/data/historyStore';
import { useSavedNumbers } from '@/src/store/savedNumbers';
import {
  ac, firstThreeSum, highLowLabel, lastThreeSum, oddEvenLabel,
  tailSum, tensSum, total,
} from '@/src/data/lotto';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

export default function SimpleHome() {
  const t = useTheme();
  const router = useRouter();
  const draw = useHistory((s) => s.getLatest());
  const isMockData = useHistory((s) => s.isMock);
  const savedCount = useSavedNumbers((s) => s.games.length);
  const [expanded, setExpanded] = useState(false);
  if (!draw) return null; // hydrate not done yet (very rare; <16ms)

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bgCanvas }]} edges={['top']}>
      <AppBar
        title="안녕하세요 👋"
        trailing={
          <>
            <IconBtn onPress={() => {}}><Icon.bell color={t.fgSecondary} /></IconBtn>
            <IconBtn onPress={() => router.push('/(simple)/more' as any)}><Icon.cog color={t.fgSecondary} /></IconBtn>
          </>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* Latest-round banner */}
        <View style={[styles.banner, { backgroundColor: palette.neutral950 }]}>
          <View style={styles.bannerHead}>
            <T variant="caption1" style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>
              제 {draw.round}회 · {koreanDate(draw.date)}
            </T>
            <View style={styles.bannerPill}>
              <T variant="caption1" style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>최신 결과</T>
            </View>
          </View>
          <BallRow nums={draw.nums} bonus={draw.bonus} size="md" />

          {/* 회차 한눈에: 합·끝수·홀짝·저고·AC (펼치면 십합·앞세수·뒷세수 추가) */}
          <View style={styles.analysisRow}>
            <Metric label="합" value={String(total(draw.nums))} hint={sumHint(total(draw.nums))} />
            <Metric label="끝수" value={String(tailSum(draw.nums))} />
            <Metric label="홀짝" value={oddEvenLabel(draw.nums)} />
            <Metric label="저고" value={highLowLabel(draw.nums)} />
            <Metric label="AC" value={String(ac(draw.nums))} hint={acHint(ac(draw.nums))} />
          </View>

          {expanded && (
            <View style={styles.analysisRowExtra}>
              <Metric label="십합" value={String(tensSum(draw.nums))} />
              <Metric label="앞세수합" value={String(firstThreeSum(draw.nums))} />
              <Metric label="뒷세수합" value={String(lastThreeSum(draw.nums))} />
            </View>
          )}

          {/* "자세히 보기" 펼침 토글 + 회차 상세 페이지로 가는 링크 */}
          <View style={styles.detailRow}>
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              hitSlop={6}
              style={({ pressed }) => [styles.expandBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <T variant="caption1" style={{ color: 'rgba(255,255,255,0.78)', fontWeight: '600' }} allowFontScaling={false}>
                {expanded ? '간단히 ▴' : '자세히 보기 ▾'}
              </T>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/round/${draw.round}` as any)}
              hitSlop={6}
              style={({ pressed }) => [styles.detailLink, { opacity: pressed ? 0.7 : 1 }]}
            >
              <T variant="caption1" style={{ color: palette.blue300, fontWeight: '700' }} allowFontScaling={false}>
                회차 상세 →
              </T>
            </Pressable>
          </View>

          <View style={[styles.row, { marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 12 }]}>
            <T variant="label1r" style={{ color: 'rgba(255,255,255,0.7)' }}>1등 당첨금</T>
            <T variant="label1n" style={{ color: '#fff', fontWeight: '700' }}>
              {formatWon(draw.firstWinAmount ?? 0)}
              {draw.firstWinners ? <T variant="caption1" style={{ color: 'rgba(255,255,255,0.55)' }}>{`  ${draw.firstWinners}명`}</T> : null}
            </T>
          </View>
        </View>

        {/* 4 big tiles */}
        <View style={styles.grid}>
          <Tile
            tone="accent"
            cap="Recommend"
            title="번호 받기"
            icon={<Icon.sparkle color="#fff" size={22} />}
            onPress={() => router.push('/(simple)/gen' as any)}
          />
          <Tile
            tone="dark"
            cap="Scan"
            title="QR 당첨 확인"
            icon={<Icon.qr color="#fff" size={22} weight={1.8} />}
            onPress={() => router.push('/(simple)/check' as any)}
          />
          <Tile
            wide
            cap="Saved"
            title="내 번호"
            sub={`저장 ${savedCount}건`}
            icon={<Icon.history color={t.fgSecondary} size={22} />}
            onPress={() => router.push('/(simple)/mine' as any)}
          />
        </View>

        {/* Saved-count summary */}
        <Pressable onPress={() => router.push('/(simple)/mine' as any)}>
          <Card padding={14}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.checkIcon, { backgroundColor: t.bgSuccessSoft }]}>
                <Icon.check color={palette.green700} size={16} weight={3} />
              </View>
              <View style={{ flex: 1 }}>
                <T variant="label1n" color="primary" style={{ fontWeight: '700' }}>
                  {savedCount > 0 ? `저장한 번호 ${savedCount}건` : '저장한 번호 없음'}
                </T>
                <T variant="caption1" color="tertiary" style={{ marginTop: 2 }}>
                  {savedCount > 0 ? '내 번호 탭에서 회차별로 확인하세요' : 'QR 스캔이나 직접 입력으로 추가해 보세요'}
                </T>
              </View>
              <Icon.chev color={t.fgTertiary} />
            </View>
          </Card>
        </Pressable>

        {isMockData && (
          <View style={[styles.warn, { backgroundColor: t.bgWarnSoft, borderColor: t.borderWarn }]}>
            <T variant="caption1" style={{ color: t.fgWarn }} allowFontScaling={false}>
              ⚠️ 회차 데이터는 합성 시드입니다. 실제 동행복권 데이터로 곧 교체됩니다.
            </T>
          </View>
        )}

        <Disclaimer short />
        <View style={{ height: 4 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({
  tone,
  cap,
  title,
  sub,
  icon,
  onPress,
  wide,
}: {
  tone?: 'accent' | 'dark';
  cap: string;
  title: string;
  sub?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  /** Span the full row instead of 48% width. */
  wide?: boolean;
}) {
  const t = useTheme();
  const bg = tone === 'accent' ? t.bgAccent : tone === 'dark' ? palette.neutral900 : t.bgSurface;
  const fg = tone ? '#fff' : t.fgPrimary;
  const capFg = tone ? 'rgba(255,255,255,0.7)' : t.fgTertiary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tile,
        wide && { width: '100%', height: 96, flexDirection: 'row', alignItems: 'center', gap: 16 },
        {
          backgroundColor: bg,
          borderColor: tone ? 'transparent' : t.borderWeak,
          borderWidth: tone ? 0 : 1,
        },
      ]}
    >
      <View>{icon}</View>
      <View>
        <T variant="caption1" style={{ color: capFg, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          {cap}
        </T>
        <T variant="headline2" style={{ color: fg, fontWeight: '700', marginTop: 4 }}>{title}</T>
        {sub && <T variant="caption1" style={{ color: capFg, marginTop: 2 }}>{sub}</T>}
      </View>
    </Pressable>
  );
}

/**
 * Single metric pill rendered inside the dark banner.
 * Big white value on top, small label/hint beneath.
 */
function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.metric}>
      <T variant="caption1" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10.5, letterSpacing: 0.4 }} allowFontScaling={false}>
        {label}
      </T>
      <T variant="headline2" style={{ color: '#fff', fontWeight: '700', marginTop: 2 }} allowFontScaling={false}>
        {value}
      </T>
      {hint && (
        <T variant="caption2" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9.5, marginTop: 2 }} allowFontScaling={false}>
          {hint}
        </T>
      )}
    </View>
  );
}

/** 합계가 "낮음/평범/높음" 어느 구간인지 한 단어로. */
function sumHint(sum: number): string {
  if (sum < 100) return '낮음';
  if (sum > 175) return '높음';
  return '평범';
}

/** AC값의 "흩어진 정도"를 한 단어로 (0~3 낮음, 4~6 보통, 7~10 흩어짐). */
function acHint(ac: number): string {
  if (ac <= 3) return '뭉침';
  if (ac >= 7) return '흩어짐';
  return '보통';
}

function koreanDate(iso: string): string {
  // '2025-05-09' → '5월 9일 (토)'
  const d = new Date(iso + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function formatWon(n: number): string {
  // 2_142_870_000 → '21억 4,287만원'
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  if (eok === 0) return `${man.toLocaleString('ko')}만원`;
  if (man === 0) return `${eok}억원`;
  return `${eok}억 ${man.toLocaleString('ko')}만원`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: { borderRadius: radius.xl + 2, padding: 18 },
  bannerHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  bannerPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  analysisRowExtra: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  expandBtn: {
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  detailLink: {
    paddingVertical: 4, paddingHorizontal: 8,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '48%',
    height: 132,
    padding: 18,
    borderRadius: 18,
    justifyContent: 'space-between',
  },
  checkIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  compatIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  warn: {
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});
