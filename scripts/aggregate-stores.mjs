/**
 * aggregate-stores.mjs — 회차별 enriched 데이터를 판매점별로 집계.
 *
 * 입력: app/data/enriched/{round}.json (1~최신)
 *   각 파일의 topStores: [{ rank: 1|2, name, address, method, lat, lng }, ...]
 *
 * 출력: app/src/data/stores.json
 *   {
 *     updatedAt: ISO8601,
 *     latestRound: number,
 *     count: number,
 *     stores: [{
 *       id: string,           // hash(name+address)
 *       name: string,
 *       address: string,
 *       lat: number,
 *       lng: number,
 *       count1st: number,
 *       count2nd: number,
 *       lastWin1st?: { round, date },
 *       lastWin2nd?: { round, date },
 *     }]
 *   }
 *
 * 제외 대상:
 *   - 인터넷 복권판매사이트 (물리적 위치 없음)
 *   - lat/lng 누락된 항목
 *
 * Usage: node scripts/aggregate-stores.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENRICHED_DIR = path.resolve(__dirname, '..', 'data', 'enriched');
const OUT_FILE = path.resolve(__dirname, '..', 'src', 'data', 'stores.json');

// ─── 유틸 ────────────────────────────────────────────────────────────────────
function storeKey(name, address) {
  // 매장명 + 주소 결합으로 식별. 공백/특수문자 normalize.
  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return `${norm(name)}|${norm(address)}`;
}

function storeId(key) {
  return crypto.createHash('md5').update(key).digest('hex').slice(0, 12);
}

function isOnlineStore(name, address) {
  return /인터넷.*복권.*판매/.test(name) || /dhlottery\.co\.kr/i.test(address);
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[aggregate] enriched 디렉토리 스캔...');
  const files = await fs.readdir(ENRICHED_DIR);
  const roundFiles = files.filter((f) => /^\d+\.json$/.test(f));
  console.log(`[aggregate] 회차 파일 ${roundFiles.length}개 발견`);

  // key -> 누적 상태
  const stores = new Map();
  let latestRound = 0;
  let processed = 0;
  let skippedOnline = 0;
  let skippedNoCoord = 0;
  let totalTopStoreEntries = 0;

  // 회차 순서: 작은 회차부터 큰 회차로 (lastWin* 누적용)
  const sortedFiles = roundFiles.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  for (const file of sortedFiles) {
    const raw = await fs.readFile(path.join(ENRICHED_DIR, file), 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      console.warn(`[aggregate] ${file} JSON parse 실패 — skip`);
      continue;
    }
    const { round, date, topStores } = data;
    if (!Array.isArray(topStores)) continue;
    if (round > latestRound) latestRound = round;
    processed++;

    for (const ts of topStores) {
      totalTopStoreEntries++;
      const { rank, name, address, lat, lng } = ts;
      if (!name || !address) { skippedNoCoord++; continue; }
      if (isOnlineStore(name, address)) { skippedOnline++; continue; }
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        skippedNoCoord++;
        continue;
      }

      const key = storeKey(name, address);
      let store = stores.get(key);
      if (!store) {
        store = {
          id: storeId(key),
          name: String(name).trim(),
          address: String(address).trim(),
          lat, lng,
          count1st: 0,
          count2nd: 0,
          lastWin1st: undefined,
          lastWin2nd: undefined,
        };
        stores.set(key, store);
      }

      if (rank === 1) {
        store.count1st++;
        // sortedFiles이 오름차순이라 마지막 update가 가장 최신
        store.lastWin1st = { round, date };
      } else if (rank === 2) {
        store.count2nd++;
        store.lastWin2nd = { round, date };
      }
    }
  }

  // 정렬: 1등 횟수 → 2등 횟수 → 이름
  const storeList = [...stores.values()].sort((a, b) => {
    if (b.count1st !== a.count1st) return b.count1st - a.count1st;
    if (b.count2nd !== a.count2nd) return b.count2nd - a.count2nd;
    return a.name.localeCompare(b.name, 'ko');
  });

  const out = {
    updatedAt: new Date().toISOString(),
    latestRound,
    count: storeList.length,
    stores: storeList,
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(out));

  console.log(`\n[aggregate] 완료:`);
  console.log(`  - 처리한 회차: ${processed} (~${latestRound}회)`);
  console.log(`  - 총 topStore 엔트리: ${totalTopStoreEntries}`);
  console.log(`  - 온라인 채널 제외: ${skippedOnline}`);
  console.log(`  - 좌표 누락 제외: ${skippedNoCoord}`);
  console.log(`  - 유니크 판매점: ${storeList.length}`);

  // 상위 통계
  const top1st = storeList.slice(0, 5).map((s) => `${s.name} (${s.count1st}회)`);
  console.log(`\n  상위 1등 배출점:`);
  for (const s of top1st) console.log(`    - ${s}`);

  console.log(`\n  출력: ${OUT_FILE}`);
  const stat = await fs.stat(OUT_FILE);
  console.log(`  크기: ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error('[aggregate] 실패:', e);
  process.exit(1);
});
