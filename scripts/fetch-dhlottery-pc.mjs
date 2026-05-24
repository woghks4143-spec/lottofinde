/**
 * fetch-dhlottery-pc.mjs — 집 PC용 동행복권 데이터 수집 스크립트.
 *
 * 핵심:
 *   - JSON API (`common.do`)는 거의 항상 차단됨 → HTML 페이지 직접 방문
 *   - page.goto()로 실제 페이지 로드 → page.content() / page.evaluate()로 DOM 추출
 *   - 모바일 LTE 페이지 사용 (사용자 브라우저가 본 그 URL)
 *   - non-headless 옵션 가능 (`--show`)
 *
 * Usage:
 *   node scripts/fetch-dhlottery-pc.mjs                # 최신 회차
 *   node scripts/fetch-dhlottery-pc.mjs --round=1224   # 특정 회차
 *   node scripts/fetch-dhlottery-pc.mjs --show         # 창 띄워서 디버깅
 *   node scripts/fetch-dhlottery-pc.mjs --recent=5     # 최근 5회차
 *
 * Output:
 *   data/enriched/{round}.json
 *   data/enriched/index.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'data', 'enriched');

function arg(name, fallback = null) {
  const f = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!f) return fallback;
  if (!f.includes('=')) return true;
  return f.split('=')[1];
}
const ARG_ROUND = arg('round') ? parseInt(arg('round'), 10) : null;
const ARG_RECENT = arg('recent') ? parseInt(arg('recent'), 10) : 0;
const SHOW = arg('show') === true;

function expectedLatestRound(today = new Date()) {
  const start = new Date('2002-12-07T00:00:00Z');
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dow = d.getUTCDay();
  const daysBack = (dow + 1) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  const weeks = Math.floor((d - start) / (7 * 86400 * 1000));
  return 1 + weeks;
}

/** 사용자 브라우저가 실제로 본 URL — 모바일 LTE 페이지 */
const URL_RESULT = (n) => `https://dhlottery.co.kr/gameResult.do?method=byWin&drwNo=${n}`;
const URL_STORE = (n) => `https://dhlottery.co.kr/store.do?method=topStore&pageGubun=L645&drwNo=${n}`;

async function newContext(browser) {
  return browser.newContext({
    // 모바일 Chrome UA — 사용자 폰 브라우저가 통과했던 것과 동일
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 412, height: 915 }, // 모바일 사이즈
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      // 구글에서 검색해서 들어온 척
      'Referer': 'https://www.google.com/',
    },
  });
}

/**
 * 결과 페이지에서 데이터 추출.
 * 페이지 안에서 DOM 쿼리해서 구조화된 데이터 반환.
 */
async function extractRoundFromPage(page) {
  return page.evaluate(() => {
    function txt(el) { return el ? el.textContent.trim() : ''; }
    function num(s) {
      const n = parseInt((s || '').replace(/[^0-9]/g, ''), 10);
      return Number.isFinite(n) ? n : 0;
    }

    // 1) 회차 — "제 1223회"
    const roundEl = document.querySelector('.win_result h4 strong, .win_result strong');
    let round = 0;
    const titleText = document.title + ' ' + (document.body ? document.body.innerText : '').slice(0, 500);
    const rm = titleText.match(/제?\s*(\d{3,4})\s*회/);
    if (rm) round = parseInt(rm[1], 10);

    // 2) 추첨일 — "(2026년 05월 09일 추첨)" 또는 "2026.05.09"
    let date = '';
    const dm = (document.body ? document.body.innerText : '').match(
      /(20\d{2})[.년\s\-/]+(\d{1,2})[.월\s\-/]+(\d{1,2})/,
    );
    if (dm) date = `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`;

    // 3) 당첨번호 6개 + 보너스 — class "ball_645"
    const ballEls = Array.from(document.querySelectorAll('span.ball_645, p.ball_645'));
    const nums = [];
    let bonus = 0;
    for (const el of ballEls) {
      const n = num(el.textContent);
      if (n < 1 || n > 45) continue;
      // bonus는 따로 표시 — class에 'bonus' 또는 직전 + 표시
      const cls = el.className || '';
      // bonus 분류 시도: parent text에 '보너스' 포함 또는 7번째
      if (nums.length < 6) {
        nums.push(n);
      } else if (bonus === 0) {
        bonus = n;
      }
    }

    // 4) 1등 정보 — 표에서 추출
    let firstAmount = 0, firstWinners = 0, totalSales = 0;
    // "1등" row 찾기
    const trs = Array.from(document.querySelectorAll('tr'));
    for (const tr of trs) {
      const cells = Array.from(tr.querySelectorAll('th,td')).map((c) => c.textContent.trim());
      if (cells.length < 3) continue;
      if (/^1\s*등/.test(cells[0])) {
        // 셀 구조: [등위, 총당첨금, 당첨게임수, 1게임당]
        const winners = num(cells[2]);
        const perGame = num(cells[3] || '');
        if (winners > 0) firstWinners = winners;
        if (perGame > 0) firstAmount = perGame;
        if (firstAmount === 0 && winners > 0) {
          const totalAmt = num(cells[1]);
          if (totalAmt > 0) firstAmount = Math.floor(totalAmt / winners);
        }
        break;
      }
    }
    // 총 판매금액
    const sm = (document.body ? document.body.innerText : '').match(/총\s*판매\s*금액[^0-9]*([0-9,]+)/);
    if (sm) totalSales = num(sm[1]);

    return {
      round, date,
      nums: nums.slice(0, 6).sort((a, b) => a - b),
      bonus,
      firstWinAmount: firstAmount || undefined,
      firstWinners: firstWinners || undefined,
      totalSales: totalSales || undefined,
    };
  });
}

/**
 * 판매점 페이지에서 1·2등 store list + method count 추출.
 */
async function extractStoresFromPage(page) {
  return page.evaluate(() => {
    function txt(el) { return el ? el.textContent.trim() : ''; }
    const stores = [];

    // 표 단위로 처리 — "1등 당첨판매점" / "2등 당첨판매점" 헤더 감지
    const tables = Array.from(document.querySelectorAll('table'));
    let curRank = null;
    // 페이지 전체에서 헤더-표 매핑
    const bodyText = document.body ? document.body.innerText : '';

    // 단순 방법: 각 row를 순회하면서 등위 트래킹
    // 더 견고: 표 직전의 텍스트로 등위 판별
    for (const tbl of tables) {
      // 표 직전 텍스트 찾기 (앞 형제, 부모의 앞)
      let prevText = '';
      let prev = tbl.previousElementSibling;
      while (prev && prevText.length < 200) {
        prevText = (prev.textContent || '') + ' ' + prevText;
        prev = prev.previousElementSibling;
      }
      // 또는 부모 영역 내 헤더
      const parent = tbl.parentElement;
      if (parent) {
        const h = parent.querySelector('h3, h4, .tit, strong');
        if (h) prevText = (h.textContent || '') + ' ' + prevText;
      }

      let rank = curRank;
      if (/1\s*등/.test(prevText) && !/2\s*등/.test(prevText.slice(-30))) rank = 1;
      else if (/2\s*등/.test(prevText)) rank = 2;
      if (rank === null) continue;
      curRank = rank;

      const rows = Array.from(tbl.querySelectorAll('tr'));
      for (const tr of rows) {
        const cells = Array.from(tr.querySelectorAll('th,td')).map((c) => c.textContent.trim());
        if (cells.length < 2) continue;
        // 첫 셀이 번호여야 함
        const num = parseInt(cells[0], 10);
        if (!Number.isFinite(num)) continue;
        const name = cells[1] || '';
        if (!name) continue;
        let method = 'unknown';
        let address = '';
        if (rank === 1 && cells.length >= 4) {
          const m = cells[2] || '';
          if (/자동/.test(m) && /수동/.test(m)) method = 'mixed';
          else if (/반자동|혼합/.test(m)) method = 'mixed';
          else if (/수동/.test(m)) method = 'manual';
          else if (/자동/.test(m)) method = 'auto';
          address = cells[3] || '';
        } else {
          address = cells[2] || '';
        }
        stores.push({ rank, name, method, address });
      }
    }
    return stores;
  });
}

async function fetchOneRound(context, drwNo) {
  console.log(`\n[fetch] round ${drwNo} — start`);
  const out = {};

  // 1) 결과 페이지 방문
  const page = await context.newPage();
  try {
    console.log(`[fetch] ${drwNo} visiting result page...`);
    await page.goto(URL_RESULT(drwNo), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2000); // WAF JS 챌린지 + 페이지 안정화

    // 에러 페이지 감지
    const url = page.url();
    if (url.includes('errorPage')) {
      console.warn(`[fetch] ${drwNo} redirected to error page: ${url}`);
      await page.close();
      return null;
    }

    const data = await extractRoundFromPage(page);
    console.log(`[fetch] ${drwNo} extracted: round=${data.round}, nums=${data.nums.join(',')}, bonus=${data.bonus}`);
    if (data.round && data.nums.length === 6 && data.bonus > 0) {
      Object.assign(out, data);
    } else {
      console.warn(`[fetch] ${drwNo} extraction failed — incomplete data`);
      await page.close();
      return null;
    }
  } catch (e) {
    console.error(`[fetch] ${drwNo} result page error:`, e.message);
    await page.close();
    return null;
  }
  await page.close();

  // 2) 판매점 페이지 방문
  const page2 = await context.newPage();
  try {
    console.log(`[fetch] ${drwNo} visiting store page...`);
    await page2.goto(URL_STORE(drwNo), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page2.waitForTimeout(2000);

    if (page2.url().includes('errorPage')) {
      console.warn(`[fetch] ${drwNo} store: redirected to error page`);
    } else {
      const stores = await extractStoresFromPage(page2);
      if (stores.length > 0) {
        out.topStores = stores;
        // methodCounts 계산
        const firsts = stores.filter((s) => s.rank === 1);
        const counts = { auto: 0, manual: 0, mixed: 0 };
        for (const s of firsts) {
          if (s.method === 'auto') counts.auto++;
          else if (s.method === 'manual') counts.manual++;
          else if (s.method === 'mixed') counts.mixed++;
        }
        out.methodCounts = counts;
        console.log(`[fetch] ${drwNo} stores: ${stores.length} (1등: ${firsts.length}, auto/manual/mixed: ${counts.auto}/${counts.manual}/${counts.mixed})`);
      } else {
        console.warn(`[fetch] ${drwNo} no stores parsed`);
      }
    }
  } catch (e) {
    console.error(`[fetch] ${drwNo} store page error:`, e.message);
  }
  await page2.close();

  return out;
}

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
  console.log(`[fetch] targets:`, targets, `headless=${!SHOW}`);

  console.log('[fetch] launching Chrome (system)...');
  // 시스템 설치된 Chrome 사용 — Playwright 번들 Chromium보다 봇 감지에 잘 안 걸림
  const browser = await chromium.launch({
    headless: !SHOW,
    channel: 'chrome', // 시스템 Chrome
    args: ['--disable-blink-features=AutomationControlled'],
  }).catch(async () => {
    // 시스템 Chrome 없으면 fallback to bundled Chromium
    console.warn('[fetch] system Chrome not found, falling back to Chromium');
    return chromium.launch({
      headless: !SHOW,
      args: ['--disable-blink-features=AutomationControlled'],
    });
  });
  const context = await newContext(browser);

  // 메인 페이지 워밍업
  console.log('[fetch] warmup — visiting main page...');
  const warm = await context.newPage();
  try {
    await warm.goto('https://dhlottery.co.kr/common.do?method=main', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await warm.waitForTimeout(3000); // 충분히 대기 — 쿠키 세팅 + JS 챌린지
    console.log(`[fetch] warmup done, url=${warm.url()}`);
  } catch (e) {
    console.warn('[fetch] warmup fail:', e.message);
  }
  await warm.close();

  let success = 0, fail = 0;
  for (const r of targets) {
    try {
      const data = await fetchOneRound(context, r);
      if (!data || !data.round) { fail++; continue; }
      const outFile = path.join(OUT_DIR, `${r}.json`);
      await fs.writeFile(outFile, JSON.stringify(data, null, 2));
      console.log(`[fetch] wrote ${outFile}`);
      success++;
    } catch (e) {
      console.error(`[fetch] round ${r} failed:`, e);
      fail++;
    }
    await new Promise((res) => setTimeout(res, 2000)); // 정중하게 2초
  }

  await context.close();
  await browser.close();

  // 인덱스 갱신
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

  console.log(`\n[fetch] DONE — success=${success}, fail=${fail}, total rounds saved=${rounds.length}`);
  if (success === 0 && fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[fetch] FATAL:', e);
  process.exit(1);
});
