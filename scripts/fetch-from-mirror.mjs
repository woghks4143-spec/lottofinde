/**
 * fetch-from-mirror.mjs — 커뮤니티 미러에서 동행복권 데이터 가져오기.
 *
 * 배경:
 *   dhlottery 본사이트는 강력한 WAF로 모든 자동화(axios/Playwright/curl/WebView)를 차단.
 *   smok95/lotto repo가 6년 이상 매주 데이터를 게시 중이라 이를 미러하여 사용.
 *
 * 동작:
 *   1) smok95/lotto에서 최신 + 최근 N회차 fetch
 *   2) 우리 Draw 타입으로 변환
 *   3) data/enriched/{round}.json으로 저장
 *   4) index.json 갱신
 *
 * Usage:
 *   node scripts/fetch-from-mirror.mjs                # 최근 5회차
 *   node scripts/fetch-from-mirror.mjs --recent=20    # 최근 20회차
 *   node scripts/fetch-from-mirror.mjs --round=1225   # 특정 회차
 *
 * 외부 의존성: smok95/lotto (GitHub Pages 호스팅)
 *   - URL: https://smok95.github.io/lotto/results/{round}.json
 *   - 또는: https://smok95.github.io/lotto/results/latest.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'data', 'enriched');

const MIRROR_BASE = 'https://smok95.github.io/lotto/results';
const MIRROR_STORES = 'https://smok95.github.io/lotto/winning-stores';

function arg(name, fallback = null) {
  const f = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!f) return fallback;
  if (!f.includes('=')) return true;
  return f.split('=')[1];
}
const ARG_ROUND = arg('round') ? parseInt(arg('round'), 10) : null;
const ARG_RECENT = arg('recent') ? parseInt(arg('recent'), 10) : 5; // 기본 최근 5회차

/** smok95의 JSON 형식을 우리 Draw 형식으로 변환. */
function convertMirrorJson(src) {
  if (!src || typeof src.draw_no !== 'number' || !Array.isArray(src.numbers)) return null;
  if (src.numbers.length !== 6 || !Number.isInteger(src.bonus_no)) return null;

  const divisions = Array.isArray(src.divisions) ? src.divisions : [];
  const prizeKeys = ['first', 'second', 'third', 'fourth', 'fifth'];
  const prizes = {};
  divisions.forEach((d, idx) => {
    if (idx < 5 && d && typeof d.prize === 'number' && typeof d.winners === 'number') {
      prizes[prizeKeys[idx]] = { amount: d.prize, winners: d.winners };
    }
  });

  // smok95의 winners_combination → 우리 methodCounts
  // smok95는 {auto, manual} 또는 {auto, manual, mixed}만 제공
  let methodCounts;
  if (src.winners_combination && typeof src.winners_combination === 'object') {
    const wc = src.winners_combination;
    methodCounts = {
      auto: typeof wc.auto === 'number' ? wc.auto : 0,
      manual: typeof wc.manual === 'number' ? wc.manual : 0,
      mixed: typeof wc.mixed === 'number' ? wc.mixed : 0,
    };
  }

  // 날짜 변환: "2026-05-23T00:00:00Z" → "2026-05-23"
  let date = '';
  if (typeof src.date === 'string') {
    date = src.date.split('T')[0];
  }

  return {
    round: src.draw_no,
    date,
    nums: [...src.numbers].sort((a, b) => a - b),
    bonus: src.bonus_no,
    firstWinAmount: prizes.first?.amount,
    firstWinners: prizes.first?.winners,
    totalSales: typeof src.total_sales_amount === 'number' ? src.total_sales_amount : undefined,
    prizes,
    methodCounts,
    // 판매점은 smok95이 별도 endpoint(/winning-stores/)로 제공하나, 기본 results에는 없음
    // 필요시 추가 fetch
  };
}

async function fetchMirror(round) {
  const url = `${MIRROR_BASE}/${round}.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[mirror] round ${round}: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    return convertMirrorJson(json);
  } catch (e) {
    console.warn(`[mirror] round ${round}: ${e.message}`);
    return null;
  }
}

/**
 * 1등 당첨 판매점 정보 가져오기.
 * smok95 형식: [{ name, address, combination, lat, lng }]
 * 우리 형식: WinningStore { rank, name, address, method }
 *
 * 참고: smok95은 1등만 제공. 2등은 따로 endpoint 없음 → 1등만 미러.
 */
async function fetchStores(round) {
  const url = `${MIRROR_STORES}/${round}.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[stores] round ${round}: HTTP ${res.status}`);
      return [];
    }
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    return arr.map((s) => {
      const c = String(s.combination || '').trim();
      let method = 'unknown';
      if (c === '자동' || /^자동/.test(c)) method = 'auto';
      else if (c === '수동' || /^수동/.test(c)) method = 'manual';
      else if (c === '반자동' || /반자동|혼합/.test(c)) method = 'mixed';
      return {
        rank: 1, // smok95은 1등만 제공
        name: String(s.name || '').trim(),
        address: String(s.address || '').trim(),
        method,
        lat: typeof s.lat === 'number' ? s.lat : undefined,
        lng: typeof s.lng === 'number' ? s.lng : undefined,
      };
    }).filter((s) => s.name);
  } catch (e) {
    console.warn(`[stores] round ${round}: ${e.message}`);
    return [];
  }
}

async function fetchLatest() {
  const url = `${MIRROR_BASE}/latest.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  let targets;
  if (ARG_ROUND) {
    targets = [ARG_ROUND];
  } else {
    // 최신 회차 알아내기
    const latest = await fetchLatest();
    if (!latest || typeof latest.draw_no !== 'number') {
      console.error('[main] 최신 회차 정보 가져오기 실패. smok95 서버 문제일 수 있음.');
      process.exit(1);
    }
    const latestRound = latest.draw_no;
    console.log(`[main] 미러 최신 회차: ${latestRound}`);
    targets = [];
    for (let i = 0; i < ARG_RECENT; i++) {
      targets.push(latestRound - i);
    }
  }
  console.log(`[main] targets:`, targets);

  let success = 0, fail = 0;
  for (const r of targets) {
    const data = await fetchMirror(r);
    if (!data) {
      fail++;
      continue;
    }
    // 1등 판매점 정보도 가져옴
    const stores = await fetchStores(r);
    if (stores.length > 0) {
      data.topStores = stores;
    }

    const outFile = path.join(OUT_DIR, `${r}.json`);
    await fs.writeFile(outFile, JSON.stringify(data, null, 2));
    const methodStr = data.methodCounts
      ? `auto=${data.methodCounts.auto}, manual=${data.methodCounts.manual}, mixed=${data.methodCounts.mixed}`
      : 'no methodCounts';
    console.log(`[main] ✓ wrote ${outFile} (nums=${data.nums.join(',')}, bonus=${data.bonus}, ${methodStr}, 1등판매점=${stores.length}곳)`);
    success++;
    // smok95 서버에 부담 안 주려고 잠시 대기
    await new Promise((res) => setTimeout(res, 300));
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
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      source: 'smok95/lotto mirror',
      rounds,
    }, null, 2),
  );

  console.log(`\n[main] DONE — success=${success}, fail=${fail}, total cached=${rounds.length}`);
  if (success === 0 && fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('[main] FATAL:', e);
  process.exit(1);
});
