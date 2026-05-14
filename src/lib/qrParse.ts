/**
 * QR receipt parser — dhlottery 영수증 QR은
 *   https://m.dhlottery.co.kr/qr.do?method=winQr&v=<round><gametype><6×2자리>...
 * 형식이다. `v=` 값에서 게임 5개까지를 뽑아낸다.
 *
 * Format of the `v` param:
 *   [4-digit round][game-marker][12-digit nums]...
 *   game-marker: 'm' = manual, 'q' = quick/auto. The very first game has no
 *                marker prefix; subsequent games are delimited by 'm'/'q'.
 *
 * Examples seen in the wild:
 *   v=1186q010203040506q070809101112q...
 *   v=1186m020304050607q08...
 *
 * Returns `null` for any malformed input. Caps at 5 games (one paper receipt).
 */

export type GameType = 'auto' | 'manual';
export type GameLabel = 'A' | 'B' | 'C' | 'D' | 'E';

export type ParsedGame = {
  label: GameLabel;
  type: GameType;
  nums: number[];   // length 6, ascending, all 1..45 distinct
};

export type ParsedReceipt = {
  round: number;
  games: ParsedGame[];
};

const LABELS: GameLabel[] = ['A', 'B', 'C', 'D', 'E'];

/**
 * Extract `v=` from any URL-shaped string, robust against trailing params.
 * Falls back to substring search when the URL API isn't available (RN < 0.70).
 */
function extractV(input: string): string | null {
  if (!input) return null;
  // Quick: try URL API
  try {
    const u = new URL(input);
    const v = u.searchParams.get('v');
    if (v) return v;
  } catch {
    // not a full URL — try substring extraction
  }
  const idx = input.indexOf('v=');
  if (idx === -1) return null;
  const tail = input.slice(idx + 2);
  const end = tail.search(/[&#]/);
  return end === -1 ? tail : tail.slice(0, end);
}

function tryRead6Nums(s: string): number[] | null {
  if (s.length < 12) return null;
  const nums: number[] = [];
  for (let i = 0; i < 12; i += 2) {
    const v = parseInt(s.slice(i, i + 2), 10);
    if (!Number.isFinite(v) || v < 1 || v > 45) return null;
    nums.push(v);
  }
  // must be distinct
  if (new Set(nums).size !== 6) return null;
  return nums.sort((a, b) => a - b);
}

export function parseReceiptUrl(input: string): ParsedReceipt | null {
  const v = extractV(input);
  if (!v) return null;
  if (v.length < 4 + 12) return null;
  const round = parseInt(v.slice(0, 4), 10);
  if (!Number.isFinite(round) || round < 1 || round > 9999) return null;

  const body = v.slice(4);
  const games: ParsedGame[] = [];

  let i = 0;
  // The first game may not have a marker — accept either an immediate digit
  // (treat as 'auto') or a leading marker. Subsequent games REQUIRE a marker.
  let firstSeen = false;
  while (i < body.length && games.length < 5) {
    let type: GameType = 'auto';
    if (!firstSeen && /[0-9]/.test(body[i])) {
      // Implicit auto game.
      type = 'auto';
    } else {
      const marker = body[i];
      if (marker === 'm') type = 'manual';
      else if (marker === 'q') type = 'auto';
      else { i++; continue; } // skip unknown char defensively
      i++;
    }
    const nums = tryRead6Nums(body.slice(i, i + 12));
    if (!nums) {
      // Malformed game block — abort the whole parse so we don't return
      // partial garbage.
      return null;
    }
    games.push({ label: LABELS[games.length], type, nums });
    i += 12;
    firstSeen = true;
  }
  if (games.length === 0) return null;
  return { round, games };
}
