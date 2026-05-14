/**
 * 웹 미리보기 전용 샘플 데이터.
 *
 * 동행복권 사이트가 CORS로 차단되어 있어 웹에서는 등위별/판매점 정보를 직접
 * 가져올 수 없다. 이 파일은 **개발/미리보기용**으로만 사용되며, 다음 조건에서만
 * 실 데이터에 머지된다:
 *   - Platform.OS === 'web'
 *   - 해당 회차에 prizes·topStores가 아직 없는 경우
 *
 * 모바일(iOS/Android)에서는 절대 머지되지 않는다. 실제 동행복권 페치 결과가
 * 그 자리를 채운다.
 */
import type { Draw } from './lotto';

/** 최신 회차 1223회의 샘플 부가 정보. 실제 동행복권 페이지의 전형적 값 기준. */
export const DEMO_ROUND_EXTRAS: Record<number, Partial<Draw>> = {
  1223: {
    totalSales: 110_238_456_000,
    prizes: {
      first:  { amount: 1_857_550_000, winners: 16 },     // 18억 5,755만원 × 16명
      second: { amount: 52_345_000,    winners: 82 },     // 5,234만원 × 82명
      third:  { amount: 1_476_540,     winners: 2_920 },  // 147만원 × 2,920명
      fourth: { amount: 50_000,        winners: 144_895 },// 5만원 × 144,895명
      fifth:  { amount: 5_000,         winners: 2_431_587 },// 5,000원 × 2,431,587명
    },
    topStores: [
      // ── 1등 당첨 판매점 (5개 샘플; 실제 16개 중 일부) ───────────────────────
      { rank: 1, name: '로또명당',   address: '서울 강남구 테헤란로 123 ABC빌딩 1층',     method: 'auto' },
      { rank: 1, name: '행운복권',   address: '부산 해운대구 해운대로 456',               method: 'manual' },
      { rank: 1, name: '백만장자',   address: '인천 남동구 구월로 78 GS25 1층',           method: 'mixed' },
      { rank: 1, name: '대박복권',   address: '경기 성남시 분당구 정자로 200',             method: 'auto' },
      { rank: 1, name: '황금복권',   address: '대구 수성구 동대구로 345 신세계 1F',        method: 'manual' },
      // ── 2등 당첨 판매점 (5개 샘플; 실제 82개 중 일부) ──────────────────────
      { rank: 2, name: '복권나라',   address: '서울 마포구 홍대입구역 2번출구 앞',          method: 'unknown' },
      { rank: 2, name: '럭키복권',   address: '경기 수원시 영통구 광교중앙로 100',          method: 'unknown' },
      { rank: 2, name: '천만행복',   address: '부산 부산진구 서면로 250 롯데백화점',        method: 'unknown' },
      { rank: 2, name: '복권타임',   address: '광주 서구 상무대로 600',                    method: 'unknown' },
      { rank: 2, name: '대박나라',   address: '대전 유성구 대학로 99 카이스트 정문 앞',     method: 'unknown' },
    ],
  },
};
