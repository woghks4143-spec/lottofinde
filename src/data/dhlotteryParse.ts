/**
 * 동행복권 HTML 페이지 파서.
 *
 * 동행복권은 다음 두 페이지를 HTML로 제공한다 (JSON 엔드포인트는 1등만 노출):
 *   - `gameResult.do?method=byWin&drwNo=N`  — 1~5등 전체 당첨 정보 + 총판매액
 *   - `store.do?method=topStore&pageGubun=L645&drwNo=N` — 1·2등 당첨 판매점
 *
 * 두 페이지 모두 정규식 기반으로 표 셀(<td>)을 긁어와 파싱한다. 동행복권 HTML
 * 구조가 바뀌면 파서가 `null`/`[]`을 반환해 호출 측은 부가 정보 없이 진행한다.
 */
import type { Prize, WinningStore } from './lotto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** HTML 태그 제거 + 엔티티 디코드 + 공백 정규화. */
function cleanText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1,234,567,890원" → 1234567890. 숫자 아닌 문자는 모두 제거. */
function parseWon(s: string): number {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/** 표의 모든 <tr> → 각 행의 <td> 텍스트 배열. */
function extractRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html)) !== null) {
    const cells: string[] = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c: RegExpExecArray | null;
    while ((c = tdRe.exec(m[1])) !== null) cells.push(cleanText(c[1]));
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

// ─── gameResult.do (등위별 당첨 정보) ────────────────────────────────────────

const PRIZE_KEY_BY_ORDER: Array<keyof NonNullable<import('./lotto').Draw['prizes']>> =
  ['first', 'second', 'third', 'fourth', 'fifth'];

export function parseGameResultHtml(html: string): {
  prizes: NonNullable<import('./lotto').Draw['prizes']>;
  totalSales?: number;
} | null {
  // 등위별 당첨 정보 표는 `tbl_data` 또는 `tbl_data_col` 클래스를 가진 첫 표.
  // 콘텐츠 영역만 좁혀서 검색하면 다른 표(예: 시도별 통계)와의 충돌을 피할 수 있다.
  const tableMatch = html.match(
    /<table[^>]*class="[^"]*tbl_data[^"]*"[^>]*>([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch) return null;

  const rows = extractRows(tableMatch[1]);
  if (rows.length === 0) return null;

  const prizes: NonNullable<import('./lotto').Draw['prizes']> = {};

  // 첫 행은 보통 헤더("등위/총 당첨금액/당첨게임수/1게임당 당첨금액/당첨기준/비고"). 본문은 1~5등 5행.
  let prizeIndex = 0;
  for (const cells of rows) {
    if (cells.length < 3) continue;
    // 헤더 row 판별: 첫 셀에 숫자가 없고 "등위"/"등" 단독이면 헤더
    if (cells[0] === '등위' || cells[0].includes('총 당첨')) continue;

    // 1등~5등 식별: 첫 셀이 "1등", "2등" 등이거나 "당첨순위" 컬럼이 있는 경우 후자
    const rankToken = cells[0];
    let key: keyof NonNullable<import('./lotto').Draw['prizes']> | null = null;
    if (/^1\s*등/.test(rankToken)) key = 'first';
    else if (/^2\s*등/.test(rankToken)) key = 'second';
    else if (/^3\s*등/.test(rankToken)) key = 'third';
    else if (/^4\s*등/.test(rankToken)) key = 'fourth';
    else if (/^5\s*등/.test(rankToken)) key = 'fifth';
    else if (prizeIndex < 5) key = PRIZE_KEY_BY_ORDER[prizeIndex];
    if (!key) continue;

    // 셀 구조: [등위, 총 당첨금액, 당첨게임수, 1게임당 당첨금액, (당첨기준), (비고)]
    // 일부 회차는 4컬럼만 노출. 안전하게 인덱스 1·2·3로 시도.
    const totalAmount = parseWon(cells[1] ?? '');
    const winnersCount = parseWon(cells[2] ?? '');
    const perGameRaw = cells[3] ?? '';
    let perGame = parseWon(perGameRaw);
    // 폴백: per-game이 비어 있으면 total/winners로 계산
    if (perGame === 0 && winnersCount > 0) {
      perGame = Math.floor(totalAmount / winnersCount);
    }
    prizes[key] = { amount: perGame, winners: winnersCount } as Prize;
    prizeIndex++;
    if (prizeIndex >= 5) break;
  }

  if (Object.keys(prizes).length === 0) return null;

  // 총 판매금액: HTML 본문에 "총 판매금액: 1,234,567,890원" 형태로 노출
  let totalSales: number | undefined;
  const salesMatch =
    html.match(/총\s*판매\s*금액[^0-9]*([0-9,]+)\s*원/) ||
    html.match(/총\s*판매\s*액[^0-9]*([0-9,]+)\s*원/);
  if (salesMatch) totalSales = parseWon(salesMatch[1]);

  return { prizes, totalSales };
}

// ─── store.do (1·2등 당첨 판매점) ────────────────────────────────────────────

/** 구매 방식 문자열 → enum. */
function parseMethod(s: string): WinningStore['method'] {
  const t = s.trim();
  if (!t || t === '-') return 'unknown';
  // "자동", "수동", "혼합", "반자동" 등
  const auto = /자동/.test(t);
  const manual = /수동/.test(t);
  if (auto && manual) return 'mixed';
  if (/혼합|반자동/.test(t)) return 'mixed';
  if (manual) return 'manual';
  if (auto) return 'auto';
  return 'unknown';
}

/**
 * 1·2등 당첨 판매점 페이지 파싱.
 *
 * 페이지는 두 표로 구성:
 *   - 1등 표: [번호, 상호명, 구분(자동/수동/혼합), 소재지]
 *   - 2등 표: [번호, 상호명, 소재지]  (구분 컬럼 없음)
 *
 * 각 표 앞에 "1등 당첨판매점" / "2등 당첨판매점" 헤더가 있어 그것으로 등위 판별.
 */
export function parseTopStoreHtml(html: string): WinningStore[] {
  const stores: WinningStore[] = [];

  // 각 표 단위로 자르고, 표 직전의 텍스트(<h*>, <caption>, <p>)에서 등위 단서를 찾는다.
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tables: Array<{ before: string; body: string }> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(html)) !== null) {
    tables.push({
      before: html.slice(lastIndex, m.index),
      body: m[1],
    });
    lastIndex = tableRe.lastIndex;
  }

  for (const { before, body } of tables) {
    // 직전 텍스트 마지막 600자에서 등위 표시 찾기
    const head = before.slice(-800);
    let rank: 1 | 2 | null = null;
    // 1등이 먼저 등장하는지 2등이 먼저 등장하는지 거리로 판단
    const m1 = head.search(/1\s*등\s*당첨\s*판매/);
    const m2 = head.search(/2\s*등\s*당첨\s*판매/);
    if (m1 === -1 && m2 === -1) continue;
    if (m2 === -1 || (m1 !== -1 && m1 > m2)) rank = 1;
    else rank = 2;

    const rows = extractRows(body);
    for (const cells of rows) {
      if (cells.length < 3) continue;
      // 헤더 행 스킵 — 첫 셀이 숫자가 아니면 헤더로 간주
      if (!/^\d+$/.test(cells[0])) continue;

      const name = cells[1] ?? '';
      if (!name) continue;

      let method: WinningStore['method'] = 'unknown';
      let address = '';
      if (rank === 1 && cells.length >= 4) {
        method = parseMethod(cells[2] ?? '');
        address = cells[3] ?? '';
      } else {
        // 2등 또는 1등이지만 컬럼이 3개인 경우 (소재지만)
        address = cells[2] ?? '';
      }

      stores.push({ rank, name, address, method });
    }
  }

  return stores;
}
