/**
 * Heroicons-style stroked SVG icon set, 24x24, 1.7px stroke.
 * Ported from prototype/shared.jsx Icons.* — same path data verbatim.
 */
import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type IP = {
  size?: number;
  color?: string;
  /** Override stroke width (default 1.7). */
  weight?: number;
};

const Base = ({
  size = 20,
  color = '#46474c',
  weight = 1.7,
  children,
  viewBox = '0 0 24 24',
}: IP & { children: React.ReactNode; viewBox?: string }) => (
  <Svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke={color}
    strokeWidth={weight}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </Svg>
);

export const Icon = {
  bell: (p: IP) => (
    <Base {...p}>
      <Path d="M14.85 17H9.15a3 3 0 0 0 5.7 0Z" />
      <Path d="M5.2 17h13.6a1 1 0 0 0 .8-1.6c-.85-1.1-1.6-2.2-1.6-4.4V9.3a6 6 0 0 0-12 0v1.7c0 2.2-.75 3.3-1.6 4.4a1 1 0 0 0 .8 1.6Z" />
    </Base>
  ),
  cog: (p: IP) => (
    <Base {...p}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 2v2M12 20v2M22 12h-2M4 12H2M19 5l-1.4 1.4M6.4 17.6L5 19M19 19l-1.4-1.4M6.4 6.4 5 5" />
    </Base>
  ),
  qr: (p: IP) => (
    <Base {...p} weight={p.weight ?? 1.8}>
      <Rect x="3" y="3" width="7" height="7" rx="1" />
      <Rect x="14" y="3" width="7" height="7" rx="1" />
      <Rect x="3" y="14" width="7" height="7" rx="1" />
      <Path d="M14 14h3v3M21 14v0M14 17v4M17 21h4v-4" />
    </Base>
  ),
  pin: (p: IP) => (
    <Base {...p}>
      <Path d="M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z" />
      <Circle cx="12" cy="10" r="2.5" />
    </Base>
  ),
  history: (p: IP) => (
    <Base {...p}>
      <Path d="M3 12a9 9 0 1 0 3-6.7" />
      <Path d="M3 4v5h5" />
      <Path d="M12 8v4l3 2" />
    </Base>
  ),
  sparkle: (p: IP) => (
    <Base {...p}>
      <Path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6 7.7 7.7M16.3 16.3 18.4 18.4M5.6 18.4 7.7 16.3M16.3 7.7 18.4 5.6" />
    </Base>
  ),
  chart: (p: IP) => (
    <Base {...p}>
      <Path d="M3 21h18" />
      <Path d="M5 21V11M10 21V7M15 21v-6M20 21V4" />
    </Base>
  ),
  filter: (p: IP) => (
    <Base {...p}>
      <Path d="M3 5h18M6 12h12M10 19h4" />
    </Base>
  ),
  download: (p: IP) => (
    <Base {...p}>
      <Path d="M12 4v12" />
      <Path d="M7 11l5 5 5-5" />
      <Path d="M4 20h16" />
    </Base>
  ),
  check: (p: IP) => (
    <Base {...p} weight={p.weight ?? 3} size={p.size ?? 14}>
      <Path d="M5 12l5 5 9-11" />
    </Base>
  ),
  plus: (p: IP) => (
    <Base {...p} weight={p.weight ?? 2.5} size={p.size ?? 14}>
      <Path d="M12 5v14M5 12h14" />
    </Base>
  ),
  chev: (p: IP) => (
    <Base {...p} weight={p.weight ?? 2} size={p.size ?? 14}>
      <Path d="M9 5l7 7-7 7" />
    </Base>
  ),
  chevLeft: (p: IP) => (
    <Base {...p} weight={p.weight ?? 1.8} size={p.size ?? 22}>
      <Path d="M15 19l-7-7 7-7" />
    </Base>
  ),
  flash: (p: IP) => (
    <Base {...p}>
      <Path d="M13 2 3 14h7l-1 8 11-13h-7l1-7z" />
    </Base>
  ),
  share: (p: IP) => (
    <Base {...p}>
      <Path d="M12 16V4M8 8l4-4 4 4" />
      <Path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </Base>
  ),
  close: (p: IP) => (
    <Base {...p} weight={p.weight ?? 2} size={p.size ?? 18}>
      <Path d="M6 6l12 12M18 6 6 18" />
    </Base>
  ),
  // Bottom-tab nav icons (Simple)
  tabHome: (p: IP) => (
    <Base {...p}>
      <Path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-3v-7H8v7H5a2 2 0 0 1-2-2v-9z" />
    </Base>
  ),
  tabMine: (p: IP) => (
    <Base {...p}>
      <Path d="M4 6h16v12H4zM4 10h16M9 14h6" />
    </Base>
  ),
  // Bottom-tab nav icons (Expert)
  tabDash: (p: IP) => (
    <Base {...p}>
      <Path d="M3 13h8V3H3v10zM13 21h8V11h-8v10zM3 21h8v-6H3v6zM13 3v6h8V3h-8z" />
    </Base>
  ),
  tabSim: (p: IP) => (
    <Base {...p}>
      <Path d="M4 6h16M4 12h10M4 18h16M18 10l4 2-4 2" />
    </Base>
  ),
  tabMore: (p: IP) => (
    <Base {...p} weight={p.weight ?? 3}>
      <Path d="M5 12h.01M12 12h.01M19 12h.01" />
    </Base>
  ),
  rules: (p: IP) => (
    <Base {...p}>
      <Path d="M5 6h14M5 12h14M5 18h14" />
    </Base>
  ),
  shield: (p: IP) => (
    <Base {...p}>
      <Path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4z" />
    </Base>
  ),
  /** PRO 왕관 — 5포인트 단순 라인 크라운 + 보석 점. */
  crown: (p: IP) => (
    <Base {...p}>
      <Path d="M3 8l3 6h12l3-6-5 3-4-6-4 6-5-3z" />
      <Path d="M5 18h14" />
    </Base>
  ),
  /** PRO 잠금 자물쇠. */
  lock: (p: IP) => (
    <Base {...p}>
      <Path d="M6 11V8a6 6 0 1 1 12 0v3" />
      <Path d="M5 11h14v10H5z" />
    </Base>
  ),
  /** 새로고침 — 원형 화살표 두 개 (Heroicons arrow-path 스타일). */
  refresh: (p: IP) => (
    <Base {...p}>
      <Path d="M4 4v5h5" />
      <Path d="M20 20v-5h-5" />
      <Path d="M5.07 9A8 8 0 0 1 19 7.5M18.93 15A8 8 0 0 1 5 16.5" />
    </Base>
  ),
};

export type IconName = keyof typeof Icon;
