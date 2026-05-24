/**
 * fetch-dhlottery-pw-auth.mjs — Playwright + 로그인 결합 데이터 수집.
 *
 * 핵심:
 *   - 진짜 Chromium 브라우저 사용 → 진짜 Chrome TLS 핑거프린트
 *   - 실제 로그인 폼에 ID/PW 입력 → 진짜 사용자처럼 보임
 *   - 로그인된 세션으로 결과 페이지 이동 → WAF 통과 기대
 *   - HTML 파싱 → JSON 저장
 *
 * 환경변수:
 *   DHLOTTERY_USER_ID, DHLOTTERY_USER_PASSWORD
 *
 * Usage:
 *   node scripts/fetch-dhlottery-pw-auth.mjs --round=1225
 *   node scripts/fetch-dhlottery-pw-auth.mjs --show         # 창 띄워 디버깅
 *   node scripts/fetch-dhlottery-pw-auth.mjs --recent=5     # 최근 5회차
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

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

const USER_ID = process.env.DHLOTTERY_USER_ID;
const USER_PW = process.env.DHLOTTERY_USER_PASSWORD;
if (!USER_ID || !USER_PW) {
  console.error('❌ DHLOTTERY_USER_ID, DHLOTTERY_USER_PASSWORD 환경변수 필요');
  process.exit(1);
}

function expectedLatestRound(today = new Date()) {
  const start = new Date('2002-12-07T00:00:00Z');
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dow = d.getUTCDay();
  const daysBack = (dow + 1) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  const weeks = Math.floor((d - start) / (7 * 86400 * 1000));
  return 1 + weeks;
}

const BASE = 'https://www.dhlottery.co.kr';

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── HTML 파서 (axios 스크립트와 공유) ─────────────────────────────────────
function parseWon(s) {
  const n = parseInt(String(s || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseRoundHtml(html, drwNoExpected) {
  const $ = cheerio.load(html);

  let drwNo = drwNoExpected;
  const drwText = $('h4 strong, .win_result strong').first().text().trim();
  const dm = drwText.match(/(\d{3,4})/);
  if (dm) drwNo = parseInt(dm[1], 10);

  let date = '';
  const bodyText = $('body').text();
  const datem = bodyText.match(/(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\s*추첨/);
  if (datem) {
    date = `${datem[1]}-${String(datem[2]).padStart(2, '0')}-${String(datem[3]).padStart(2, '0')}`;
  }

  const nums = [];
  let bonus = 0;
  $('.ball_645, .ball645, p.ball_645').each((i, el) => {
    const text = $(el).text().trim();
    const n = parseInt(text, 10);
    if (!Number.isFinite(n) || n < 1 || n > 45) return;
    if (nums.length < 6) nums.push(n);
    else if (bonus === 0) bonus = n;
  });
  if (nums.length < 6 || bonus < 1) return null;

  const prizes = {};
  let totalSales;
  $('table.tbl_data tr, table[class*="tbl"] tr').each((i, tr) => {
    const cells = $(tr).find('th, td').map((j, c) => $(c).text().trim()).get();
    if (cells.length < 3) return;
    const rank = cells[0].replace(/\s/g, '');
    const map = { '1등': 'first', '2등': 'second', '3등': 'third', '4등': 'fourth', '5등': 'fifth' };
    if (!map[rank]) return;
    const total = parseWon(cells[1]);
    const winners = parseWon(cells[2]);
    const perGame = parseWon(cells[3] || '') || (winners > 0 ? Math.floor(total / winners) : 0);
    prizes[map[rank]] = { amount: perGame, winners };
  });

  const sm = bodyText.match(/총\s*판매\s*금액[^0-9]*([0-9,]+)/);
  if (sm) totalSales = parseWon(sm[1]);

  return {
    drwNo,
    date,
    numbers: nums.slice(0, 6).sort((a, b) => a - b),
    bonusNo: bonus,
    firstWinAmount: prizes.first?.amount,
    firstWinners: prizes.first?.winners,
    totalSales,
    prizes,
  };
}

function parseMethod(s) {
  const t = String(s || '').trim();
  if (!t || t === '-') return 'unknown';
  if (/자동/.test(t) && /수동/.test(t)) return 'mixed';
  if (/혼합|반자동/.test(t)) return 'mixed';
  if (/수동/.test(t)) return 'manual';
  if (/자동/.test(t)) return 'auto';
  return 'unknown';
}

function parseStoresHtml(html) {
  const $ = cheerio.load(html);
  const stores = [];

  $('table').each((i, tbl) => {
    let rank = null;
    let cur = $(tbl).prev();
    let probe = '';
    let safety = 0;
    while (cur.length && safety < 5) {
      probe = cur.text() + ' ' + probe;
      if (/1\s*등/.test(probe)) { rank = 1; break; }
      if (/2\s*등/.test(probe)) { rank = 2; break; }
      cur = cur.prev();
      safety++;
    }
    if (!rank) {
      const head = $(tbl).parent().find('h3, h4, strong, .tit').first().text();
      if (/1\s*등/.test(head)) rank = 1;
      else if (/2\s*등/.test(head)) rank = 2;
    }
    if (!rank) return;

    $(tbl).find('tr').each((j, tr) => {
      const cells = $(tr).find('th, td').map((k, c) => $(c).text().trim()).get();
      if (cells.length < 2) return;
      const num = parseInt(cells[0], 10);
      if (!Number.isFinite(num)) return;
      const name = cells[1] || '';
      if (!name) return;
      let method = 'unknown';
      let address = '';
      if (rank === 1 && cells.length >= 4) {
        method = parseMethod(cells[2]);
        address = cells[3] || '';
      } else {
        address = cells[2] || '';
      }
      stores.push({ rank, name, method, address });
    });
  });

  return stores;
}

// ─── Playwright 로그인 ───────────────────────────────────────────────────────
async function login(context) {
  const page = await context.newPage();

  console.log('[login] 로그인 페이지 방문...');
  await page.goto(`${BASE}/userSsl.do?method=login`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(2000); // 추가 안정화

  // 디버그: 페이지의 모든 input 출력
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map((el, idx) => ({
      idx,
      type: el.type,
      name: el.name,
      id: el.id,
      className: el.className,
      placeholder: el.placeholder,
    }));
  });
  console.log(`[login] 페이지의 input ${inputs.length}개:`);
  inputs.forEach((i) => console.log(`  [${i.idx}] type=${i.type}, name=${i.name}, id=${i.id}, class="${i.className}"`));

  // 페이지의 모든 form 출력
  const forms = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('form')).map((f, idx) => ({
      idx, id: f.id, name: f.name, action: f.action, method: f.method,
    }));
  });
  console.log(`[login] 페이지의 form ${forms.length}개:`);
  forms.forEach((f) => console.log(`  [${f.idx}] id=${f.id}, name=${f.name}, action=${f.action}`));

  // ID 입력 — 광범위한 selector 시도
  console.log('[login] ID 입력 시도...');
  const idSelectors = [
    'input#userId',
    'input[name="userId"]',
    'input#logId',
    'input[name="logId"]',
    'input[name="inpUserId"]',
    'input.tx_input[type="text"]:first-of-type',
    'form input[type="text"]:first-of-type',
    '#loginForm input[type="text"]',
    '#login input[type="text"]',
  ];
  let idFilled = false;
  for (const sel of idSelectors) {
    try {
      const exists = await page.locator(sel).count();
      if (exists > 0) {
        await page.fill(sel, USER_ID);
        idFilled = true;
        console.log(`[login] ✓ ID input filled with: ${sel}`);
        break;
      }
    } catch { /* try next */ }
  }
  if (!idFilled && inputs.length > 0) {
    // 마지막 수단: 첫 번째 text input 찾기
    const firstTextInput = inputs.find((i) => i.type === 'text');
    if (firstTextInput) {
      const sel = `input[type="text"]:nth-of-type(${firstTextInput.idx + 1})`;
      try {
        await page.fill(sel, USER_ID);
        idFilled = true;
        console.log(`[login] ✓ ID input filled with nth-of-type: ${sel}`);
      } catch { /* */ }
    }
  }
  if (!idFilled) {
    console.error('[login] ❌ ID 입력 필드 못 찾음');
    await page.close();
    return false;
  }

  // PW 입력
  console.log('[login] PW 입력 시도...');
  const pwSelectors = [
    'input#password',
    'input[name="password"]',
    'input[name="userPwd"]',
    'input[name="userPswd"]',
    'input[type="password"]:first-of-type',
    '#loginForm input[type="password"]',
  ];
  let pwFilled = false;
  for (const sel of pwSelectors) {
    try {
      const exists = await page.locator(sel).count();
      if (exists > 0) {
        await page.fill(sel, USER_PW);
        pwFilled = true;
        console.log(`[login] ✓ PW input filled with: ${sel}`);
        break;
      }
    } catch { /* try next */ }
  }
  if (!pwFilled) {
    console.error('[login] ❌ PW 입력 필드 못 찾음');
    await page.close();
    return false;
  }

  // 로그인 버튼 / Enter 키
  console.log('[login] 로그인 버튼 클릭 시도...');
  const btnSelectors = [
    'a.btn_common.lrg.smip',
    'a.btn_common[onclick*="login"]',
    'a[onclick*="goLogin"]',
    'a[onclick*="loginCheck"]',
    'a[href*="javascript"]:has-text("로그인")',
    'button:has-text("로그인")',
    'a:has-text("로그인")',
    'button[type="submit"]',
    'input[type="submit"]',
    '.btn_login',
    '.btn_submit',
  ];
  let clicked = false;
  for (const sel of btnSelectors) {
    try {
      const exists = await page.locator(sel).count();
      if (exists > 0) {
        await page.locator(sel).first().click();
        clicked = true;
        console.log(`[login] ✓ Clicked: ${sel}`);
        break;
      }
    } catch { /* try next */ }
  }
  if (!clicked) {
    // 폴백 1: PW 입력 필드에서 Enter 키
    console.log('[login] 버튼 못 찾음 → Enter 키 시도');
    try {
      await page.locator(pwSelectors[0]).first().press('Enter').catch(async () => {
        await page.locator('input[type="password"]').first().press('Enter');
      });
      clicked = true;
    } catch (e) {
      console.error('[login] Enter 키도 실패:', e.message);
    }
  }
  if (!clicked) {
    // 폴백 2: form submit
    console.log('[login] form.submit() 시도');
    try {
      await page.evaluate(() => {
        const form = document.querySelector('form#loginForm, form#login, form');
        if (form) form.submit();
      });
      clicked = true;
    } catch { /* */ }
  }

  // 결과 대기
  console.log('[login] 로그인 결과 대기...');
  try {
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  } catch { /* */ }
  await page.waitForTimeout(2000);

  const url = page.url();
  console.log(`[login] 로그인 후 URL: ${url}`);

  const cookies = await context.cookies();
  const hasUserId = cookies.some((c) => c.name === 'userId');
  console.log(`[login] 쿠키 ${cookies.length}개, userId 쿠키: ${hasUserId ? '있음' : '없음'}`);

  // 알림창 처리 (alert)
  page.on('dialog', async (dialog) => {
    console.log(`[login] dialog: ${dialog.message()}`);
    await dialog.accept();
  });

  await page.close();
  return hasUserId || url.includes('common.do') || url.includes('main');
}

// ─── 결과 페이지 수집 ────────────────────────────────────────────────────────
async function fetchRound(context, drwNo) {
  console.log(`\n[fetch] round ${drwNo} 결과 페이지...`);
  const page = await context.newPage();
  try {
    // 메인 페이지 거쳐서 자연스럽게 이동
    await page.goto(`${BASE}/common.do?method=main`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1000);

    await page.goto(`${BASE}/gameResult.do?method=byWin&drwNo=${drwNo}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(1500);

    const url = page.url();
    if (url.includes('errorPage')) {
      console.warn(`[fetch] round ${drwNo}: errorPage로 리다이렉트됨 (${url})`);
      await page.close();
      return null;
    }

    const html = await page.content();
    console.log(`[fetch] round ${drwNo}: ${html.length} bytes from ${url}`);
    if (html.length < 1000) {
      await page.close();
      return null;
    }

    const data = parseRoundHtml(html, drwNo);
    if (!data) {
      console.warn(`[fetch] round ${drwNo}: 파싱 실패 — HTML 앞부분:`, html.slice(0, 300));
      await page.close();
      return null;
    }
    console.log(`[fetch] round ${drwNo}: ✓ ${data.numbers.join(',')} + ${data.bonusNo}`);
    await page.close();
    return data;
  } catch (e) {
    console.error(`[fetch] round ${drwNo} 에러:`, e.message);
    await page.close();
    return null;
  }
}

async function fetchStores(context, drwNo) {
  console.log(`[fetch] round ${drwNo} 판매점 페이지...`);
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/store.do?method=topStore&pageGubun=L645&drwNo=${drwNo}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(1500);

    const url = page.url();
    if (url.includes('errorPage')) {
      console.warn(`[fetch] round ${drwNo} 판매점: errorPage`);
      await page.close();
      return [];
    }

    const html = await page.content();
    console.log(`[fetch] round ${drwNo} 판매점: ${html.length} bytes`);
    const stores = parseStoresHtml(html);
    console.log(`[fetch] round ${drwNo} 판매점: ${stores.length}곳 파싱됨`);
    await page.close();
    return stores;
  } catch (e) {
    console.error(`[fetch] round ${drwNo} 판매점 에러:`, e.message);
    await page.close();
    return [];
  }
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
  console.log(`[main] targets:`, targets, `headless=${!SHOW}`);

  console.log('[main] Chromium 실행...');
  // 시스템 Chrome 우선 시도 (한국어 경로 문제 우회 + 더 자연스러움)
  // 시스템 Chrome 없으면 Playwright 번들 Chromium으로 fallback
  let browser;
  try {
    browser = await chromium.launch({
      headless: !SHOW,
      channel: 'chrome',
      args: [
        '--disable-blink-features=AutomationControlled',
      ],
    });
    console.log('[main] 시스템 Chrome 사용');
  } catch (e) {
    console.warn('[main] 시스템 Chrome 실패, Chromium fallback:', e.message);
    browser = await chromium.launch({
      headless: !SHOW,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
  }

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
  });

  // 자동화 표시 제거
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });

  // 로그인
  const ok = await login(context);
  if (!ok) {
    console.error('[main] 로그인 실패 — 종료');
    await browser.close();
    process.exit(1);
  }

  let success = 0, fail = 0;
  for (const r of targets) {
    try {
      const data = await fetchRound(context, r);
      if (!data) { fail++; continue; }
      const stores = await fetchStores(context, r);
      const firstStores = stores.filter((s) => s.rank === 1);
      const methodCounts = { auto: 0, manual: 0, mixed: 0 };
      for (const s of firstStores) {
        if (s.method === 'auto') methodCounts.auto++;
        else if (s.method === 'manual') methodCounts.manual++;
        else if (s.method === 'mixed') methodCounts.mixed++;
      }

      const out = {
        round: data.drwNo,
        date: data.date,
        nums: data.numbers,
        bonus: data.bonusNo,
        firstWinAmount: data.firstWinAmount,
        firstWinners: data.firstWinners,
        totalSales: data.totalSales,
        prizes: data.prizes,
        methodCounts,
        topStores: stores,
      };
      const outFile = path.join(OUT_DIR, `${r}.json`);
      await fs.writeFile(outFile, JSON.stringify(out, null, 2));
      console.log(`[main] ✓ wrote ${outFile} (stores=${stores.length})`);
      success++;
    } catch (e) {
      console.error(`[main] round ${r} 실패:`, e.message);
      fail++;
    }
    await sleep(2000);
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

  console.log(`\n[main] DONE — success=${success}, fail=${fail}`);
  if (success === 0 && fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[main] FATAL:', e);
  process.exit(1);
});
