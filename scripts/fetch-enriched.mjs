/**
 * fetch-enriched.mjs — 동행복권에서 회차의 등위별 정보 + 1·2등 판매점 정보를
 * 수집해 GitHub raw URL로 제공할 JSON 파일로 저장.
 *
 * 매주 토요일 21:30 KST에 GitHub Action으로 자동 실행되며, 앱은 동행복권 직접
 * fetch가 봇 차단으로 실패할 때 raw.githubusercontent.com에서 이 파일을 받음.
 *
 * Usage:
 *   node scripts/fetch-enriched.mjs                # 최신 회차 자동 감지 후 enrich
 *   node scripts/fetch-enriched.mjs --round=1224   # 특정 회차만
 *   node scripts/fetch-enriched.mjs --recent=10    # 최근 10회차 일괄
 *
 * Output:
 *   data/enriched/{round}.json   — 회차별 enriched 데이터
 *   data/enriched/index.json     — 사용 가능한 회차 목록
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'data', 'enriched');

// ─── CLI ─────────────────────────────────────────────────────────────────────
function arg(name, fallback = null) {
  const f = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!f) return fallback;
  return f.split('=')[1];
}
const ARG_ROUND = arg('round') ? parseInt(arg('round'), 10) : null;
const ARG_RECENT = arg('recent') ? parseInt(arg('recent'), 10) : 0;

// ─── Endpoints ──────────────────────────────────────────────────────────────
const ENDPOINT_JSON  = 'https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=';
const ENDPOINT_PRIZE = 'https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo=';
const ENDPOINT_STORE = 'https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645&drwNo=';

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
};

// ─── Date helpers ───────────────────────────────────────────────────────────
function expectedLatestRound(today = new Date()) {
  const start = new Date('2002-12-07T00:00:00Z');
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dow = d.getUTCDay();
  const daysBack = (dow + 1) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  const weeks = Math.floor((d - start) / (7 * 86400 * 1000));
  return 1 + weeks;
}

// ─── Fetch helpers ──────────────────────────────────────────────────────────
async function fetchText(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: COMMON_HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url) {
  const text = await fetchText(url);
  if (!text.trim().startsWith('{')) throw new Error('Non-JSON response (likely bot interstitial)');
  return JSON.parse(text);
}

// ─── HTML parsing (포팅 from src/data/dhlotteryParse.ts) ────────────────────
function cleanText(s) {
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

function parseWon(s) {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function extractRows(html) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html)) !== null) {
    const cells = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c;
    while ((c = tdRe.exec(m[1])) !== null) cells.push(cleanText(c[1]));
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

const PRIZE_KEY_BY_ORDER = ['first', 'second', 'third', 'fourth', 'fifth'];

function parseGameResultHtml(html) {
  const tableMatch = html.match(/<table[^>]*class="[^"]*tbl_data[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return null;

  const rows = extractRows(tableMatch[1]);
  if (rows.length === 0) return null;

  const prizes = {};
  let prizeIndex = 0;
  for (const cells of rows) {
    if (cells.length < 3) continue;
    if (cells[0] === '등위' || cells[0].includes('총 당첨')) continue;

    const rankToken = cells[0];
    let key = null;
    if (/^1\s*등/.test(rankToken)) key = 'first';
    else if (/^2\s*등/.test(rankToken)) key = 'second';
    else if (/^3\s*등/.test(rankToken)) key = 'third';
    else if (/^4\s*등/.test(rankToken)) key = 'fourth';
    else if (/^5\s*등/.test(rankToken)) key = 'fifth';
    else if (prizeIndex < 5) key = PRIZE_KEY_BY_ORDER[prizeIndex];
    if (!key) continue;

    const totalAmount = parseWon(cells[1] ?? '');
    const winnersCount = parseWon(cells[2] ?? '');
    const perGameRaw = cells[3] ?? '';
    let perGame = parseWon(perGameRaw);
    if (perGame === 0 && winnersCount > 0) {
      perGame = Math.floor(totalAmount / winnersCount);
    }
    prizes[key] = { amount: perGame, winners: winnersCount };
    prizeIndex++;
    if (prizeIndex >= 5) break;
  }

  if (Object.keys(prizes).length === 0) return null;

  let totalSales;
  const salesMatch =
    html.match(/총\s*판매\s*금액[^0-9]*([0-9,]+)\s*원/) ||
    html.match(/총\s*판매\s*액[^0-9]*([0-9,]+)\s*원/);
  if (salesMatch) totalSales = parseWon(salesMatch[1]);

  return { prizes, totalSales };
}

function parseMethod(s) {
  const t = s.trim();
  if (!t || t === '-') return 'unknown';
  const auto = /자동/.test(t);
  const manual = /수동/.test(t);
  if (auto && manual) return 'mixed';
  if (/혼합|반자동/.test(t)) return 'mixed';
  if (manual) return 'manual';
  if (auto) return 'auto';
  return 'unknown';
}

function parseTopStoreHtml(html) {
  const stores = [];
  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const tables = [];
  let lastIndex = 0;
  let m;
  while ((m = tableRe.exec(html)) !== null) {
    tables.push({ before: html.slice(lastIndex, m.index), body: m[1] });
    lastIndex = tableRe.lastIndex;
  }

  let curRank = null;
  for (const tbl of tables) {
    const beforeText = cleanText(tbl.before);
    if (/1\s*등.*당첨/.test(beforeText) || /1등\s*판매점/.test(beforeText)) curRank = 1;
    else if (/2\s*등.*당첨/.test(beforeText) || /2등\s*판매점/.test(beforeText)) curRank = 2;
    if (curRank === null) continue;

    const rows = extractRows(tbl.body);
    for (const cells of rows) {
      if (cells.length < 2) continue;
      const num = parseInt(cells[0], 10);
      if (!Number.isFinite(num)) continue;
      const name = cells[1] ?? '';
      let method, location;
      if (cells.length >= 4) { method = parseMethod(cells[2] ?? ''); location = cells[3] ?? ''; }
      else { method = 'unknown'; location = cells[2] ?? ''; }
      if (!name) continue;
      stores.push({ rank: curRank, name, method, location });
    }
  }
  return stores;
}

// ─── Core: enrich one round ─────────────────────────────────────────────────
async function enrichRound(drwNo) {
  console.log(`[enrich] round ${drwNo} — fetching...`);

  // 1) JSON (기본 정보 + 1등)
  let basic = null;
  try {
    const j = await fetchJson(`${ENDPOINT_JSON}${drwNo}`);
    if (j.returnValue === 'success') {
      const nums = [j.drwtNo1, j.drwtNo2, j.drwtNo3, j.drwtNo4, j.drwtNo5, j.drwtNo6].sort((a, b) => a - b);
      basic = {
        round: j.drwNo,
        date: j.drwNoDate,
        nums,
        bonus: j.bnusNo,
        firstWinAmount: j.firstWinamnt,
        firstWinners: j.firstPrzwnerCo,
        totalSales: j.totSellamnt,
      };
    }
  } catch (e) {
    console.warn(`[enrich] round ${drwNo} — JSON fail:`, e.message);
    return null;
  }
  if (!basic) {
    console.warn(`[enrich] round ${drwNo} — no basic data`);
    return null;
  }

  // 2) HTML 등위 (gameResult.do)
  try {
    const html = await fetchText(`${ENDPOINT_PRIZE}${drwNo}`);
    const parsed = parseGameResultHtml(html);
    if (parsed) {
      basic.prizes = parsed.prizes;
      if (parsed.totalSales && !basic.totalSales) basic.totalSales = parsed.totalSales;
      console.log(`[enrich] round ${drwNo} — prizes ✓ (${Object.keys(parsed.prizes).length} ranks)`);
    } else {
      console.warn(`[enrich] round ${drwNo} — prize parse fail`);
    }
  } catch (e) {
    console.warn(`[enrich] round ${drwNo} — prize fetch fail:`, e.message);
  }

  // 3) HTML 판매점 (store.do)
  try {
    const html = await fetchText(`${ENDPOINT_STORE}${drwNo}`);
    const stores = parseTopStoreHtml(html);
    if (stores.length > 0) {
      basic.topStores = stores;
      console.log(`[enrich] round ${drwNo} — stores ✓ (${stores.length})`);
    } else {
      console.warn(`[enrich] round ${drwNo} — no stores`);
    }
  } catch (e) {
    console.warn(`[enrich] round ${drwNo} — store fetch fail:`, e.message);
  }

  return basic;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // 대상 회차 결정
  let targets;
  if (ARG_ROUND) {
    targets = [ARG_ROUND];
  } else if (ARG_RECENT > 0) {
    const latest = expectedLatestRound();
    targets = [];
    for (let i = 0; i < ARG_RECENT; i++) targets.push(latest - i);
  } else {
    targets = [expectedLatestRound()];
  }

  console.log(`[enrich] targets:`, targets);

  let success = 0;
  let fail = 0;
  for (const r of targets) {
    try {
      const data = await enrichRound(r);
      if (!data) { fail++; continue; }
      const outFile = path.join(OUT_DIR, `${r}.json`);
      await fs.writeFile(outFile, JSON.stringify(data, null, 2));
      console.log(`[enrich] wrote ${outFile}`);
      success++;
    } catch (e) {
      console.error(`[enrich] round ${r} failed:`, e);
      fail++;
    }
    // Rate-limit politeness: 동행복권 부담 안 주게 1초 간격
    await new Promise((res) => setTimeout(res, 1000));
  }

  // 인덱스 파일 갱신
  const files = await fs.readdir(OUT_DIR);
  const rounds = files
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => parseInt(f.replace('.json', ''), 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  await fs.writeFile(
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify({ updatedAt: new Date().toISOString(), rounds }, null, 2),
  );

  console.log(`\n[enrich] DONE — success=${success}, fail=${fail}, total rounds=${rounds.length}`);
}

main().catch((e) => {
  console.error('[enrich] FATAL:', e);
  process.exit(1);
});
