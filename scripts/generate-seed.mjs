/**
 * generate-seed.mjs — deterministic synthetic seed for src/data/rounds.json.
 *
 * Real dhlottery JSON endpoint requires a session and now 302-redirects, so
 * this generator produces plausible mock rounds (50회) anchored on the latest
 * known draw used in the prototype (1185회: 3,12,19,27,33,41 + bonus 8).
 *
 * Replace with real data via `node scripts/fetch-rounds.mjs` once the API
 * route is sorted out — same JSON shape.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'src', 'data', 'rounds.json');

// Anchor: prototype's "latest" round.
const ANCHOR_ROUND = 1185;
const ANCHOR_DATE = '2025-05-09';
const ANCHOR_NUMS = [3, 12, 19, 27, 33, 41];
const ANCHOR_BONUS = 8;

// LCG for reproducible "randomness".
function makeLcg(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
}

function drawNumbers(rng) {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const six = pool.slice(0, 6).sort((a, b) => a - b);
  const bonus = pool[6];
  return { nums: six, bonus };
}

function daysToISO(anchorIso, offsetDays) {
  const d = new Date(anchorIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const COUNT = 60;
const rounds = [];
const rng = makeLcg(42);
for (let i = COUNT - 1; i >= 0; i--) {
  const round = ANCHOR_ROUND - i;
  const date = daysToISO(ANCHOR_DATE, -7 * i);
  if (i === 0) {
    rounds.push({
      round, date,
      nums: ANCHOR_NUMS, bonus: ANCHOR_BONUS,
      firstWinAmount: 2_142_870_000, firstWinners: 11,
    });
  } else {
    const { nums, bonus } = drawNumbers(rng);
    rounds.push({
      round, date, nums, bonus,
      firstWinAmount: Math.round((1.5 + rng() * 2.5) * 1_000_000_000),
      firstWinners: Math.max(1, Math.round(2 + rng() * 18)),
    });
  }
}

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify({
  __mock: true,
  __note: 'Synthetic seed for MVP-α. Replace by running scripts/fetch-rounds.mjs once dhlottery API access is restored.',
  fetchedAt: new Date().toISOString(),
  latestRound: ANCHOR_ROUND,
  count: rounds.length,
  rounds,
}, null, 2));
console.log(`Wrote ${rounds.length} mock rounds → ${path.relative(process.cwd(), OUT)}`);
