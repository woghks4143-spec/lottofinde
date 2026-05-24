/**
 * fetch-dhlottery-auth.mjs — 동행복권 로그인 후 결과 페이지 수집.
 *
 * 작동 원리:
 *   1) 메인/로그인 페이지 방문 → 세션 쿠키 받음
 *   2) RSA 공개키 받음 (selectRsaModulus.do)
 *   3) 사용자 ID/PW를 RSA 암호화
 *   4) securityLoginCheck.do로 POST 로그인 → 로그인 세션 확립
 *   5) game645 방문해서 JSESSIONID 받음
 *   6) gameResult.do / store.do 페이지 fetch → 통과! (로그인된 회원)
 *   7) HTML 파싱 → JSON 저장
 *
 * 환경변수:
 *   DHLOTTERY_USER_ID       — 동행복권 ID
 *   DHLOTTERY_USER_PASSWORD — 동행복권 비밀번호
 *
 * Usage:
 *   node scripts/fetch-dhlottery-auth.mjs --round=1225
 *   node scripts/fetch-dhlottery-auth.mjs              # 최신 회차 자동
 *   node scripts/fetch-dhlottery-auth.mjs --recent=5   # 최근 5회차
 *
 * Output:
 *   data/enriched/{round}.json
 *   data/enriched/index.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';

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

// ─── 환경변수 검증 ──────────────────────────────────────────────────────────
const USER_ID = process.env.DHLOTTERY_USER_ID;
const USER_PW = process.env.DHLOTTERY_USER_PASSWORD;
if (!USER_ID || !USER_PW) {
  console.error('❌ DHLOTTERY_USER_ID 와 DHLOTTERY_USER_PASSWORD 환경변수를 설정해주세요');
  console.error('   PowerShell: $env:DHLOTTERY_USER_ID="your_id"; $env:DHLOTTERY_USER_PASSWORD="your_pw"');
  console.error('   bash:       export DHLOTTERY_USER_ID=your_id DHLOTTERY_USER_PASSWORD=your_pw');
  process.exit(1);
}

// ─── 회차 계산 ──────────────────────────────────────────────────────────────
function expectedLatestRound(today = new Date()) {
  const start = new Date('2002-12-07T00:00:00Z');
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dow = d.getUTCDay();
  const daysBack = (dow + 1) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  const weeks = Math.floor((d - start) / (7 * 86400 * 1000));
  return 1 + weeks;
}

// ─── HTTP 클라이언트 ────────────────────────────────────────────────────────
const BASE = 'https://www.dhlottery.co.kr';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const jar = new CookieJar();
const client = wrapper(axios.create({
  jar,
  withCredentials: true,
  timeout: 15000,
  maxRedirects: 5,
  validateStatus: (s) => s < 500, // 4xx도 직접 처리
  headers: {
    'User-Agent': UA,
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  },
}));

// ─── RSA 암호화 ─────────────────────────────────────────────────────────────
function rsaEncrypt(plainText, modulusHex, exponentHex) {
  // JWK 형식으로 RSA 공개키 생성 (modulus, exponent를 base64url로)
  const n = Buffer.from(modulusHex.padStart(modulusHex.length + (modulusHex.length % 2), '0'), 'hex')
    .toString('base64url');
  const e = Buffer.from(exponentHex.padStart(exponentHex.length + (exponentHex.length % 2), '0'), 'hex')
    .toString('base64url');
  const key = crypto.createPublicKey({
    key: { kty: 'RSA', n, e },
    format: 'jwk',
  });
  const encrypted = crypto.publicEncrypt(
    { key, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(plainText, 'utf8'),
  );
  return encrypted.toString('hex');
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function dumpCookies(label) {
  const domains = ['https://dhlottery.co.kr', 'https://www.dhlottery.co.kr', 'https://ol.dhlottery.co.kr'];
  const summary = [];
  for (const d of domains) {
    const cs = await jar.getCookies(d);
    if (cs.length > 0) {
      summary.push(`${d}: ${cs.map((c) => c.key).join(',')}`);
    }
  }
  console.log(`[cookies@${label}] ${summary.join(' | ')}`);
}

// ─── 로그인 ──────────────────────────────────────────────────────────────────
async function login() {
  console.log('[login] 메인 페이지 방문...');
  await client.get(`${BASE}/`);
  await sleep(500);
  await client.get(`${BASE}/common.do?method=main`);
  await sleep(500);
  await dumpCookies('after-main');

  console.log('[login] 로그인 페이지 방문...');
  await client.get(`${BASE}/userSsl.do?method=login`);
  await sleep(500);

  console.log('[login] RSA 공개키 요청...');
  const rsaRes = await client.get(`${BASE}/login/selectRsaModulus.do`, {
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${BASE}/userSsl.do?method=login`,
    },
  });
  const rsa = rsaRes.data;
  if (!rsa?.data?.rsaModulus || !rsa?.data?.publicExponent) {
    throw new Error('RSA 공개키를 받지 못함: ' + JSON.stringify(rsa).slice(0, 200));
  }
  console.log(`[login] RSA 받음 (modulus length=${rsa.data.rsaModulus.length})`);

  console.log('[login] 자격증명 RSA 암호화...');
  const encryptedId = rsaEncrypt(USER_ID, rsa.data.rsaModulus, rsa.data.publicExponent);
  const encryptedPw = rsaEncrypt(USER_PW, rsa.data.rsaModulus, rsa.data.publicExponent);

  console.log('[login] 로그인 POST...');
  const loginData = new URLSearchParams({
    userId: encryptedId,
    userPswdEncn: encryptedPw,
    inpUserId: USER_ID,
  }).toString();

  const loginRes = await client.post(
    `${BASE}/login/securityLoginCheck.do`,
    loginData,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': BASE,
        'Referer': `${BASE}/userSsl.do?method=login`,
      },
    },
  );

  const finalUrl = loginRes.request?.res?.responseUrl || loginRes.config?.url;
  const html = typeof loginRes.data === 'string' ? loginRes.data : '';

  const success = (
    finalUrl?.includes('loginSuccess') ||
    finalUrl?.includes('common.do') ||
    html.includes('logout') ||
    html.includes('myPage')
  );
  if (!success && html.includes('비밀번호') && html.includes('일치하지')) {
    throw new Error('로그인 실패: 아이디 또는 비밀번호가 일치하지 않습니다');
  }
  console.log(`[login] 응답 URL: ${finalUrl}`);
  await dumpCookies('after-login');

  // 로그인 후 메인 페이지 다시 방문 (세션 안정화)
  await sleep(1000);
  console.log('[login] 메인 페이지 재방문 (세션 안정화)...');
  await client.get(`${BASE}/common.do?method=main`, {
    headers: { Referer: `${BASE}/login/loginSuccess.do` },
  });
  await sleep(500);
  await dumpCookies('after-main-revisit');

  return true;
}

// ─── 결과 페이지 fetch + parse ──────────────────────────────────────────────
async function fetchRound(drwNo) {
  console.log(`\n[fetch] round ${drwNo}: 메인 방문 후 결과 페이지로 이동 시뮬레이션...`);

  // 1) 메인 페이지 다시 방문 (사용자 흐름 흉내)
  await client.get(`${BASE}/common.do?method=main`);
  await sleep(800);

  // 2) 당첨번호 메뉴 페이지 먼저 방문 (실제 사용자처럼)
  await client.get(`${BASE}/gameResult.do?method=byWin`, {
    headers: { 'Referer': `${BASE}/common.do?method=main` },
  });
  await sleep(800);

  // 3) 특정 회차 페이지 방문
  const url = `${BASE}/gameResult.do?method=byWin&drwNo=${drwNo}`;
  const res = await client.get(url, {
    headers: { 'Referer': `${BASE}/gameResult.do?method=byWin` },
  });

  const finalUrl = res.request?.res?.responseUrl || url;
  if (finalUrl.includes('errorPage')) {
    console.warn(`[fetch] round ${drwNo}: errorPage로 리다이렉트됨 (${finalUrl})`);
    return null;
  }

  const html = typeof res.data === 'string' ? res.data : '';
  console.log(`[fetch] round ${drwNo}: ${html.length} bytes received from ${finalUrl}`);
  if (html.length < 1000) {
    console.warn(`[fetch] round ${drwNo}: HTML 너무 작음`);
    return null;
  }

  const data = parseRoundHtml(html, drwNo);
  if (!data) {
    // 디버그: HTML 일부 출력
    console.warn(`[fetch] round ${drwNo}: 파싱 실패. HTML 앞부분:`, html.slice(0, 500).replace(/\s+/g, ' '));
    return null;
  }
  console.log(`[fetch] round ${drwNo}: ✓ ${data.numbers.join(',')} + ${data.bonusNo}`);
  return data;
}

async function fetchStores(drwNo) {
  console.log(`[fetch] round ${drwNo} 판매점 페이지...`);
  await sleep(800);
  const url = `${BASE}/store.do?method=topStore&pageGubun=L645&drwNo=${drwNo}`;
  const res = await client.get(url, {
    headers: { 'Referer': `${BASE}/gameResult.do?method=byWin&drwNo=${drwNo}` },
  });

  const finalUrl = res.request?.res?.responseUrl || url;
  if (finalUrl.includes('errorPage')) {
    console.warn(`[fetch] round ${drwNo} 판매점: errorPage`);
    return [];
  }

  const html = typeof res.data === 'string' ? res.data : '';
  console.log(`[fetch] round ${drwNo} 판매점: ${html.length} bytes`);
  return parseStoresHtml(html);
}

// ─── HTML 파서 ──────────────────────────────────────────────────────────────
function parseWon(s) {
  const n = parseInt(String(s || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseRoundHtml(html, drwNoExpected) {
  const $ = cheerio.load(html);

  // 회차
  let drwNo = drwNoExpected;
  const drwText = $('h4 strong, .win_result strong').first().text().trim();
  const dm = drwText.match(/(\d{3,4})/);
  if (dm) drwNo = parseInt(dm[1], 10);

  // 추첨일 — "(YYYY년 MM월 DD일 추첨)" 또는 .desc
  let date = '';
  const bodyText = $('body').text();
  const datem = bodyText.match(/(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\s*추첨/);
  if (datem) {
    date = `${datem[1]}-${String(datem[2]).padStart(2, '0')}-${String(datem[3]).padStart(2, '0')}`;
  }

  // 당첨번호 + 보너스 — class에 ball_645 + colorN
  const nums = [];
  let bonus = 0;
  $('.ball_645, .ball645, p.ball_645').each((i, el) => {
    const text = $(el).text().trim();
    const n = parseInt(text, 10);
    if (!Number.isFinite(n) || n < 1 || n > 45) return;
    const parent = $(el).parent().text() + $(el).attr('class');
    if (nums.length < 6) nums.push(n);
    else if (bonus === 0) bonus = n;
  });
  if (nums.length < 6 || bonus < 1) return null;

  // 1~5등 정보 — tbl_data
  const prizes = {};
  let totalSales;
  $('table.tbl_data tr, table[class*="tbl"] tr').each((i, tr) => {
    const cells = $(tr).find('th, td').map((j, c) => $(c).text().trim()).get();
    if (cells.length < 3) return;
    const rank = cells[0];
    const map = { '1등': 'first', '2등': 'second', '3등': 'third', '4등': 'fourth', '5등': 'fifth' };
    const key = Object.keys(map).find((k) => rank.replace(/\s/g, '') === k);
    if (!key) return;
    const total = parseWon(cells[1]);
    const winners = parseWon(cells[2]);
    const perGame = parseWon(cells[3] || '') || (winners > 0 ? Math.floor(total / winners) : 0);
    prizes[map[key]] = { amount: perGame, winners };
  });

  // 총 판매금액
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

  // 표 단위로 처리 — 각 표가 1등 또는 2등 판매점 표
  $('table').each((i, tbl) => {
    // 표 직전 텍스트에서 1등/2등 판별
    let rank = null;
    let cur = $(tbl).prev();
    let probeText = '';
    let safety = 0;
    while (cur.length && safety < 5) {
      probeText = cur.text() + ' ' + probeText;
      if (/1\s*등/.test(probeText)) { rank = 1; break; }
      if (/2\s*등/.test(probeText)) { rank = 2; break; }
      cur = cur.prev();
      safety++;
    }
    if (!rank) {
      // 부모 안에서 헤더 찾기
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
  console.log(`[main] targets:`, targets);

  try {
    await login();
  } catch (e) {
    console.error('[main] 로그인 실패:', e.message);
    process.exit(1);
  }

  let success = 0, fail = 0;
  for (const r of targets) {
    try {
      const data = await fetchRound(r);
      if (!data) { fail++; continue; }
      const stores = await fetchStores(r);
      // method counts 계산
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
      console.log(`[main] wrote ${outFile} (stores=${stores.length}, method auto=${methodCounts.auto}, manual=${methodCounts.manual})`);
      success++;
    } catch (e) {
      console.error(`[main] round ${r} 실패:`, e.message);
      fail++;
    }
    await new Promise((res) => setTimeout(res, 1500));
  }

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
