/**
 * fetch-playwright.mjs — 동행복권의 봇 감지를 실제 Chromium 브라우저로 우회.
 *
 * 단순 fetch는 동행복권의 `iSwaitPage` 인터스티셜에 막힘. Playwright로 실제 브라우저를
 * 띄우면 JavaScript challenge가 자동 실행되어 실제 데이터 페이지에 도달.
 *
 * Usage:
 *   node scripts/fetch-playwright.mjs                # 최신 회차 자동 감지
 *   node scripts/fetch-playwright.mjs --round=1224   # 특정 회차
 *   node scripts/fetch-playwright.mjs --recent=10    # 최근 10회차
 *
 * Output:
 *   data/enriched/{round}.json   — 회차별 enriched 데이터
 *   data/enriched/index.json     — 사용 가능한 회차 목록
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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

// ─── URLs ───────────────────────────────────────────────────────────────────
const URL_BASIC = (n) => `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${n}`;
const URL_PRIZE = (n) => `https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo=${n}`;
const URL_STORE = (n) => `https://www.dhlottery.co.kr/store.do?method=topStore&pageGubun=L645&drwNo=${n}`;

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

// ─── HTML parsing helpers ───────────────────────────────────────────────────
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

// ─── Playwright core ────────────────────────────────────────────────────────
/** 봇 감지 우회용 브라우저 컨텍스트 생성. */
async function newStealthContext(browser) {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
  });
  // navigator.webdriver 등 자동화 표시 숨김
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // chrome 객체 흉내
    // @ts-ignore
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });
  return context;
}

/** 한 회차 정보 모두 수집.
 *
 *  핵심: page.goto가 동행복권의 redirect 정책으로 인해 JSON URL을 메인 페이지로
 *  돌려보내는 문제 회피. 대신 context.request로 HTTP만 직접 호출.
 *  하지만 먼저 메인 페이지를 한 번 방문해서 봇 감지 challenge를 통과 + 세션 쿠키
 *  얻은 후, 그 컨텍스트에서 JSON/HTML 직접 fetch.
 */
async function enrichRound(context, drwNo) {
  console.log(`\n[enrich] round ${drwNo} — start`);
  const out = {};

  try {
    // 1) 기본 정보 (JSON) — context.request로 직접 HTTP fetch (메인 페이지에서 얻은
    //    세션 쿠키 자동 적용됨)
    console.log(`[enrich] ${drwNo} basic...`);
    const basicRes = await context.request.get(URL_BASIC(drwNo), {
      timeout: 30_000,
      headers: { 'Accept': 'application/json,*/*' },
    });
    if (basicRes.ok()) {
      try {
        const j = await basicRes.json();
        if (j.returnValue === 'success') {
          const nums = [j.drwtNo1, j.drwtNo2, j.drwtNo3, j.drwtNo4, j.drwtNo5, j.drwtNo6].sort((a, b) => a - b);
          Object.assign(out, {
            round: j.drwNo,
            date: j.drwNoDate,
            nums,
            bonus: j.bnusNo,
            firstWinAmount: j.firstWinamnt,
            firstWinners: j.firstPrzwnerCo,
            totalSales: j.totSellamnt,
          });
          console.log(`[enrich] ${drwNo} basic ✓ (${j.drwNoDate})`);
        } else {
          console.warn(`[enrich] ${drwNo} basic returnValue:`, j.returnValue);
        }
      } catch (e) {
        const text = await basicRes.text();
        console.warn(`[enrich] ${drwNo} basic non-JSON. start:`, text.slice(0, 200));
      }
    } else {
      console.warn(`[enrich] ${drwNo} basic HTTP ${basicRes.status()}`);
    }
    if (!out.round) return null;

    // 2) 등위별 정보 (HTML) — context.request로 직접 fetch
    console.log(`[enrich] ${drwNo} prizes...`);
    const prizeRes = await context.request.get(URL_PRIZE(drwNo), { timeout: 30_000 });
    if (prizeRes.ok()) {
      const html = await prizeRes.text();
      const prizeData = parseGameResultHtml(html);
      if (prizeData) {
        out.prizes = prizeData.prizes;
        if (prizeData.totalSales && !out.totalSales) out.totalSales = prizeData.totalSales;
        console.log(`[enrich] ${drwNo} prizes ✓ (${Object.keys(prizeData.prizes).length} ranks)`);
      } else {
        const has_tbl = html.includes('tbl_data');
        const has_1deung = html.includes('1등');
        const has_iSwait = html.includes('iSwaitPage');
        console.warn(`[enrich] ${drwNo} prizes parse fail (tbl_data=${has_tbl}, 1등=${has_1deung}, iSwait=${has_iSwait}, len=${html.length})`);
      }
    } else {
      console.warn(`[enrich] ${drwNo} prizes HTTP ${prizeRes.status()}`);
    }

    // 3) 판매점 정보 (HTML) — context.request로 직접 fetch
    console.log(`[enrich] ${drwNo} stores...`);
    const storeRes = await context.request.get(URL_STORE(drwNo), { timeout: 30_000 });
    if (storeRes.ok()) {
      const html = await storeRes.text();
      const stores = parseTopStoreHtml(html);
      if (stores.length > 0) {
        out.topStores = stores;
        console.log(`[enrich] ${drwNo} stores ✓ (${stores.length})`);
      } else {
        const has_table = html.includes('<table');
        const has_상호 = html.includes('상호');
        const has_iSwait = html.includes('iSwaitPage');
        console.warn(`[enrich] ${drwNo} stores empty (table=${has_table}, 상호=${has_상호}, iSwait=${has_iSwait}, len=${html.length})`);
      }
    } else {
      console.warn(`[enrich] ${drwNo} stores HTTP ${storeRes.status()}`);
    }
  } catch (e) {
    console.error(`[enrich] ${drwNo} error:`, e.message);
  }

  return out.round ? out : null;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

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

  console.log('[enrich] launching Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
  const context = await newStealthContext(browser);

  // 메인 페이지 한 번 방문 — 세션 쿠키 + 봇 감지 challenge 통과. 그 후 모든 회차는
  // context.request로 직접 HTTP fetch (쿠키 자동 유지).
  console.log('[enrich] warming up — visiting main page for session cookie...');
  try {
    const warmupPage = await context.newPage();
    await warmupPage.goto('https://www.dhlottery.co.kr/common.do?method=main', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await warmupPage.waitForTimeout(2500);
    await warmupPage.close();
    console.log('[enrich] warmup done.');
  } catch (e) {
    console.warn('[enrich] warmup fail:', e.message);
  }

  let success = 0, fail = 0;
  for (const r of targets) {
    try {
      const data = await enrichRound(context, r);
      if (!data) { fail++; continue; }
      const outFile = path.join(OUT_DIR, `${r}.json`);
      await fs.writeFile(outFile, JSON.stringify(data, null, 2));
      console.log(`[enrich] wrote ${outFile}`);
      success++;
    } catch (e) {
      console.error(`[enrich] round ${r} failed:`, e);
      fail++;
    }
    // 정중하게 1초 sleep
    await new Promise((res) => setTimeout(res, 1000));
  }

  await context.close();
  await browser.close();

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
  if (success === 0 && fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[enrich] FATAL:', e);
  process.exit(1);
});
