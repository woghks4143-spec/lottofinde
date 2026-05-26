/**
 * 판매점 거리 계산 — 위경도 기반 Haversine + 한국 지역 한정 최적화.
 *
 * 5,000개 판매점 전수 거리 계산은 모바일에서 ~5ms 안에 끝나므로 별도 인덱싱 불필요.
 * (Haversine 1회 ≈ 1μs, 5000 × 1μs = 5ms)
 */

const EARTH_RADIUS_KM = 6371;

/**
 * 두 좌표 사이 거리(km). Haversine 공식.
 * @returns km 단위, 항상 양수
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return EARTH_RADIUS_KM * c;
}

/**
 * 사용자 친화적 거리 표시.
 *   - 1km 미만: "850m"
 *   - 10km 미만: "1.2km"
 *   - 그 외: "23km"
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    const m = Math.round(km * 1000);
    return `${m}m`;
  }
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

/**
 * 도/시/구 단위로 주소를 간추림.
 * 예: "서울 금천구 가산디지털1로 168 A동 103호" → "서울 금천구"
 *     "경기 화성시 3.1만세로 43" → "경기 화성시"
 */
export function shortAddress(address: string): string {
  if (!address) return '';
  const parts = address.split(/\s+/);
  if (parts.length < 2) return address;
  return `${parts[0]} ${parts[1]}`;
}

/**
 * 주소에서 "시/군/구" 단위 region key 추출.
 * 동일 region 비교용. shortAddress와 같지만 의미를 명확히 분리.
 *   - 광역시: "서울 금천구" (광역시 + 구)
 *   - 도   : "충북 충주시" (도 + 시/군)
 *   - 광역시 안의 일반구도 같은 단위 ("부산 동구")
 *
 * 청주시 흥덕구 같은 케이스도 "충북 청주시"로 잡혀서, 청주시 안의 다른 구들과
 * 같은 region으로 묶임 — 사용자가 청주시 거주면 청주시 전체가 같은 region.
 */
export function regionKey(address: string): string {
  if (!address) return '';
  const parts = address.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  return `${parts[0]} ${parts[1]}`;
}

/**
 * 사용자 좌표 기준으로 region key 추정.
 * 가장 가까운 판매점의 region을 채택. 5,000개 판매점이 전국에 흩어져 있으니
 * 일반적으로 사용자 시/군/구에 1개 이상 있을 것.
 *
 * @returns region key + 가장 가까운 거리(km). 거리 50km 이상이면 region 신뢰 X.
 */
export function detectUserRegion(
  stores: Array<{ lat: number; lng: number; address: string }>,
  lat: number,
  lng: number,
): { region: string; nearestKm: number } | null {
  let nearest: { address: string; dist: number } | null = null;
  for (const s of stores) {
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (!nearest || d < nearest.dist) {
      nearest = { address: s.address, dist: d };
    }
  }
  if (!nearest) return null;
  return { region: regionKey(nearest.address), nearestKm: nearest.dist };
}
