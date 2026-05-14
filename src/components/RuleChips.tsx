/**
 * RuleChips — Rule을 받아 조건들을 Chip 리스트로 표시.
 *
 * 룰 목록·시뮬레이터 저장 시트·결과 화면에서 일관된 모양으로 룰을 요약한다.
 * 기본값(예: sum 21..255)은 chip을 생략해 시각적 노이즈를 줄인다.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Chip } from './Chip';
import type { Rule } from '@/src/store/rules';
import { defaultRule, migrateRule } from '@/src/store/rules';

export function RuleChips({ rule: ruleProp, style }: { rule: Rule; style?: StyleProp<ViewStyle> }) {
  const rule = migrateRule(ruleProp);
  const d = defaultRule();
  const chips: { label: string; tone?: 'accent' | 'danger' | 'neutral' | 'purple' }[] = [];

  if (rule.include.length > 0) chips.push({ label: `포함 ${rule.include.length}개`, tone: 'accent' });
  if (rule.exclude.length > 0) chips.push({ label: `제외 ${rule.exclude.length}개`, tone: 'danger' });
  if (rule.sumMin !== d.sumMin || rule.sumMax !== d.sumMax) {
    chips.push({ label: `합 ${rule.sumMin}~${rule.sumMax}`, tone: 'purple' });
  }
  if (rule.tailSumMin !== d.tailSumMin || rule.tailSumMax !== d.tailSumMax) {
    chips.push({ label: `끝수합 ${rule.tailSumMin}~${rule.tailSumMax}`, tone: 'purple' });
  }
  if (rule.acMin !== d.acMin || rule.acMax !== d.acMax) {
    chips.push({ label: `AC ${rule.acMin}~${rule.acMax}`, tone: 'purple' });
  }
  if ((rule.oddEvenAllow ?? []).length > 0) {
    chips.push({ label: `홀짝 ${(rule.oddEvenAllow ?? []).join(' · ')}`, tone: 'neutral' });
  }
  if ((rule.highLowAllow ?? []).length > 0) {
    chips.push({ label: `저고 ${(rule.highLowAllow ?? []).join(' · ')}`, tone: 'neutral' });
  }
  if ((rule.longestRunAllow ?? []).length > 0) {
    const labels = (rule.longestRunAllow ?? []).map((n) => (n === 1 ? '연속없음' : `${n}연속`));
    chips.push({ label: `연속수 ${labels.join('·')}`, tone: 'neutral' });
  }
  if ((rule.carryOverAllow ?? []).length > 0) {
    chips.push({ label: `이월수 ${(rule.carryOverAllow ?? []).map((n) => `${n}개`).join('·')}`, tone: 'neutral' });
  }
  if (chips.length === 0) chips.push({ label: '조건 없음 (자유)', tone: 'neutral' });

  return (
    <View style={[styles.row, style]}>
      {chips.map((c, i) => <Chip key={i} label={c.label} tone={c.tone ?? 'neutral'} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
