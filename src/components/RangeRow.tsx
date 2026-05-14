/**
 * RangeRow — 라벨 + dual-thumb 슬라이더.
 *
 * RN-Web 호환을 위해 RN의 `@react-native-community/slider`를 쓰지 않고
 * `PanResponder`로 직접 구현. 트랙 너비를 `onLayout`으로 받고 thumb 위치를
 * 비율로 계산한다.
 *
 * 부모는 `min/max/value=[lo,hi]/onChange`를 넘기고, RangeRow는 onChange를
 * 매 드래그 프레임마다 호출한다 (debounce는 부모 몫).
 */
import React, { useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { T } from './Text';
import { useTheme } from '@/src/design/theme';
import { palette, radius } from '@/src/design/tokens';

const THUMB = 22;
const TRACK_H = 4;

export function RangeRow({
  label,
  unit,
  min,
  max,
  value,
  step = 1,
  onChange,
  style,
  hideHeader,
  hideMinMax,
  singleThumb,
}: {
  label: string;
  unit?: string;
  min: number;
  max: number;
  value: [number, number];
  step?: number;
  onChange: (next: [number, number]) => void;
  style?: StyleProp<ViewStyle>;
  /** Hide the label + value text row above the track. */
  hideHeader?: boolean;
  /** Hide the min/max labels under the track. */
  hideMinMax?: boolean;
  /** Treat as single-value slider: only the `hi` thumb drags. */
  singleThumb?: boolean;
}) {
  const t = useTheme();
  const [w, setW] = useState(0);
  // ⚠️ PanResponder는 useRef로 한 번만 생성되기 때문에 핸들러 내부에서
  // state(w/min/max/step/onChange/singleThumb)를 직접 참조하면 첫 렌더 값으로
  // 고정된다. 그래서 모두 ref에 미러링해서 사용.
  const valRef = useRef(value);
  valRef.current = value;
  const wRef = useRef(0);
  const minRef = useRef(min);    minRef.current = min;
  const maxRef = useRef(max);    maxRef.current = max;
  const stepRef = useRef(step);  stepRef.current = step;
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const singleRef = useRef(!!singleThumb); singleRef.current = !!singleThumb;
  const draggingRef = useRef<'lo' | 'hi' | null>(null);

  const handleAt = (e: GestureResponderEvent) => {
    const W = wRef.current;
    if (W <= 0) return;
    const lx = e.nativeEvent.locationX;
    const x = Math.max(0, Math.min(W, Number.isFinite(lx) ? lx : 0));
    const r = x / W;
    const [lo, hi] = valRef.current;
    const lower = minRef.current, upper = maxRef.current;
    const range = upper - lower || 1;
    const ratio = (v: number) => (v - lower) / range;
    const toValue = (rr: number) => {
      const raw = lower + rr * range;
      const stepped = Math.round(raw / stepRef.current) * stepRef.current;
      return Math.max(lower, Math.min(upper, stepped));
    };
    if (draggingRef.current === null) {
      if (singleRef.current) draggingRef.current = 'hi';
      else {
        const dLo = Math.abs(ratio(lo) - r);
        const dHi = Math.abs(ratio(hi) - r);
        draggingRef.current = dLo <= dHi ? 'lo' : 'hi';
      }
    }
    const v = toValue(r);
    if (draggingRef.current === 'lo') onChangeRef.current([Math.min(v, hi), hi]);
    else onChangeRef.current([lo, Math.max(v, lo)]);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: handleAt,
      onPanResponderMove: handleAt,
      onPanResponderRelease: () => { draggingRef.current = null; },
      onPanResponderTerminate: () => { draggingRef.current = null; },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    wRef.current = next;
    setW(next);
  };

  const toRatio = (v: number) => (v - min) / (max - min || 1);

  const [lo, hi] = value;
  const loX = w * toRatio(lo);
  const hiX = w * toRatio(hi);

  return (
    <View style={[styles.row, style]}>
      {!hideHeader && (
        <View style={styles.header}>
          <T variant="label1n" color="primary">{label}</T>
          <T variant="label1n" style={{ color: palette.blue700, fontWeight: '700' }} allowFontScaling={false}>
            {singleThumb ? hi : `${lo} ~ ${hi}`}{unit ? ` ${unit}` : ''}
          </T>
        </View>
      )}
      <View style={styles.trackArea} onLayout={onLayout} {...responder.panHandlers}>
        <View style={[styles.track, { backgroundColor: t.borderDivider, height: TRACK_H }]} />
        {w > 0 && (
          <>
            <View
              style={[
                styles.fill,
                {
                  left: loX, width: Math.max(0, hiX - loX),
                  backgroundColor: t.bgAccent, height: TRACK_H,
                },
              ]}
            />
            {!singleThumb && (
              <View
                pointerEvents="none"
                style={[
                  styles.thumb,
                  { left: loX - THUMB / 2, backgroundColor: '#fff', borderColor: t.bgAccent },
                ]}
              />
            )}
            <View
              pointerEvents="none"
              style={[
                styles.thumb,
                { left: hiX - THUMB / 2, backgroundColor: '#fff', borderColor: t.bgAccent },
              ]}
            />
          </>
        )}
      </View>
      {!hideMinMax && (
        <View style={styles.minMax}>
          <T variant="caption1" color="tertiary">{min}</T>
          <T variant="caption1" color="tertiary">{max}</T>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trackArea: {
    height: THUMB + 8,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    position: 'absolute',
    left: 0, right: 0,
    borderRadius: TRACK_H / 2,
  },
  fill: {
    position: 'absolute',
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB, height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    top: (THUMB + 8 - THUMB) / 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  minMax: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
});
