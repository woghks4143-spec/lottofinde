/**
 * Custom bottom tab bar — used as the `tabBar` prop for expo-router's <Tabs>.
 * Two variants (Simple / Expert) differ only in icon set + labels.
 *
 * Ports prototype/shared.jsx TabBar + TabBarExpert.
 */
import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './Text';
import { Icon, type IconName } from './Icons';
import { useTheme } from '@/src/design/theme';

type TabSpec = { key: string; label: string; icon: IconName };

// 판매점은 Phase-2로 미뤘다. 메뉴에서 제외.
// PRO 탭은 결제 잠금 기능 진입점. 콘텐츠는 추후 정의.
// 6개 탭 구조 — 좁아져도 한 줄에 들어가도록 라벨을 짧게.
const SIMPLE: TabSpec[] = [
  { key: 'home',     label: '홈',      icon: 'tabHome' },
  { key: 'gen',      label: '조합생성', icon: 'sparkle' },
  { key: 'analysis', label: '번호분석', icon: 'chart' },
  { key: 'mine',     label: '내 번호',  icon: 'tabMine' },
  { key: 'pro',      label: 'PRO',     icon: 'crown' },
  { key: 'features', label: '기능',    icon: 'cog' },
];

const EXPERT: TabSpec[] = [
  { key: 'dashboard', label: '대시보드',   icon: 'tabDash' },
  { key: 'stats',     label: '통계',       icon: 'chart' },
  { key: 'simulator', label: '시뮬레이터', icon: 'tabSim' },
  { key: 'rules',     label: '내 룰',      icon: 'rules' },
  { key: 'more',      label: '더보기',     icon: 'tabMore' },
];

export function makeTabBar(specs: TabSpec[]) {
  return function CustomTabBar({ state, navigation }: BottomTabBarProps) {
    const t = useTheme();
    const insets = useSafeAreaInsets();
    return (
      <View
        style={[
          styles.bar,
          {
            backgroundColor: t.bgSurface,
            borderTopColor: t.borderDivider,
            paddingBottom: Math.max(insets.bottom, 6),
          },
        ]}
      >
        {state.routes.map((route, i) => {
          const spec = specs.find((s) => s.key === route.name);
          if (!spec) return null; // route not in tab spec → hide (e.g. removed 판매점)
          const focused = state.index === i;
          const color = focused ? t.fgAccent : t.fgTertiary;
          const IconComp = Icon[spec.icon];
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name as never);
                }
              }}
              style={styles.tab}
            >
              <IconComp size={22} color={color} weight={focused ? 2 : 1.7} />
              <T variant="caption1" style={{ color, fontSize: 9.5, marginTop: 2, letterSpacing: 0 }} allowFontScaling={false}>
                {spec.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    );
  };
}

export const SimpleTabBar = makeTabBar(SIMPLE);
export const ExpertTabBar = makeTabBar(EXPERT);

// Spec exports so route _layout files can reference labels/icons consistently.
export const SIMPLE_TABS = SIMPLE;
export const EXPERT_TABS = EXPERT;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 2,
  },
});
