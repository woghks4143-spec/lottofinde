/**
 * fetch-rounds.mjs — pulls draws from dhlottery.co.kr's public JSON endpoint
 * and writes src/data/rounds.json.
 *
 * Usage:
 *   node scripts/fetch-rounds.mjs                # last 100 rounds
 *   node scripts/fetch-rounds.mjs --count=200    # last 200
 *   node scripts/fetch-rounds.mjs --full         # round 1 → latest (~1170)
 *
 * Endpoint:
 *   GET https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=<N>
 *   → { returnValue, drwNo, drwNoDate, drwtNo1..6, bnusNo, firstWinamnt, firstPrzwnerCo, ... }
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'src', 'data', 'rounds.json');

const FULL = process.argv.includes('--full');
const COUNT = (() => {
  if (FULL) return Infinity;
  const f = process.argv.find((a) => a.startsWith('--count='));
  return f ? parseInt(f.split('=')[1], 10) : 100;
})();
// Concurrency: when --full, fetch in parallel batches to keep runtime reasonable.
const CONCURRENCY = FULL ? 8 : 1;

// drwNo=1 was 2002-12-07 (Saturday). Each subsequent Saturday adds 1.
function expectedLatestRound(today = new Date()) {
  const start = new Date('2002-12-07T00:00:00Z');
  // Find the most recent Saturday at-or-before today (UTC).
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun, 6=Sat
  const daysBack = (dow + 1) % 7; // Sat→0, Sun→1, Mon→2, ...
  d.setUTCDate(d.getUTCDate() - daysBack);
  const weeks = Math.floor((d - start) / (7 * 86400 * 1000));
  return 1 + weeks;
}

async function fetchRound(drwNo) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'lottofinder/0.1' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on drwNo=${drwNo}`);
  const j = await res.json();
  if (j.returnValue !== 'success') return null;
  const nums = [j.drwtNo1, j.drwtNo2, j.drwtNo3, j.drwtNo4, j.drwtNo5, j.drwtNo6].sort((a, b) => a - b);
  return {
    round: j.drwNo,
    date: j.drwNoDate,
    nums,
    bonus: j.bnusNo,
    firstWinAmount: j.firstWinamnt,
    firstWinners: j.firstPrzwnerCo,
  };
}

async function findLatest() {
  // Start from expected, walk back if fail (e.g. running before Sat 21:00 KST).
  let drw = expectedLatestRound();
  for (let i = 0; i < 5; i++) {
    const r = await fetchRound(drw);
    if (r) return drw;
    drw--;
  }
  throw new Error(`could not find a successful round around expected=${expectedLatestRound()}`);
}

async function fetchBatch(nums) {
  // Run up to CONCURRENCY fetches in parallel; return results in input order.
  const out = new Array(nums.length);
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= nums.length) return;
      try { out[idx] = await fetchRound(nums[idx]); }
      catch { out[idx] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, nums.length) }, worker));
  return out;
}

async function main() {
  const latest = await findLatest();
  const from = FULL ? 1 : Math.max(1, latest - COUNT + 1);
  const span = latest - from + 1;
  console.log(`Latest round: ${latest}. Fetching rounds ${from}..${latest} (${span} total, concurrency=${CONCURRENCY})...`);

  const queue = [];
  for (let n = latest; n >= from; n--) queue.push(n);

  const rounds = [];
  const CHUNK = CONCURRENCY * 4; // ~32 per batch when --full
  for (let i = 0; i < queue.length; i += CHUNK) {
    const slice = queue.slice(i, i + CHUNK);
    const got = await fetchBatch(slice);
    for (let k = 0; k < got.length; k++) {
      if (got[k]) rounds.push(got[k]);
      else console.warn(`  miss drwNo=${slice[k]}`);
    }
    const done = Math.min(i + CHUNK, queue.length);
    if (done % 100 < CHUNK) process.stdout.write(`  ${done}/${span} fetched\n`);
  }
  rounds.sort((a, b) => a.round - b.round); // oldest→newest
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    latestRound: latest,
    count: rounds.length,
    rounds,
  }, null, 2));
  console.log(`Wrote ${rounds.length} rounds → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
