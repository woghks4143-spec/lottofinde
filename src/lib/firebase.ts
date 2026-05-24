/**
 * Firebase 설정 + 글로벌 풀 카운터.
 *
 * 동행복권 자동 분석 풀(85,000조합)을 전 세계 사용자 간에 unique하게 분배.
 * 한 사용자가 N개 받으면, 다음 사용자는 그 다음 N개부터 받음.
 *
 * 핵심: Firebase Realtime Database의 transaction을 사용해 race condition 없이
 * atomic하게 슬롯 카운터를 증가시킴.
 *
 * 보안:
 *   - apiKey는 공개돼도 안전 (Firebase 보안 규칙으로 접근 제어)
 *   - 사용자는 자기 deviceSeed로만 write 가능 (룰에서 검증)
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getDatabase, ref, runTransaction, get, child, serverTimestamp,
  type Database,
} from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyDtmwFah_6l-ClrDSdTLFHuTECTIC1R5sk',
  authDomain: 'lottofinder-1662b.firebaseapp.com',
  databaseURL: 'https://lottofinder-1662b-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'lottofinder-1662b',
  storageBucket: 'lottofinder-1662b.firebasestorage.app',
  messagingSenderId: '907875777705',
  appId: '1:907875777705:android:5a6aed116734db26403db8',
};

// 중복 init 방지 (HMR/Fast Refresh 안전)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db: Database = getDatabase(app);

// ─── 글로벌 풀 카운터 API ─────────────────────────────────────────────────────

/** 회차별 풀 상태 (실시간 DB). */
export type PoolState = {
  total: number;           // 이번주 총 풀 사이즈 (예: 85000)
  consumed: number;        // 발급된 슬롯 수 (전 세계 누적)
  updatedAt: number;       // 마지막 업데이트 (server timestamp)
};

/**
 * 풀 슬롯 할당 결과.
 * - from~to (inclusive) 범위의 슬롯 번호가 이 사용자에게 할당됨.
 * - already=true면 이미 받은 적 있어서 기존 슬롯 재사용.
 */
export type AllocationResult = {
  from: number;       // 시작 슬롯 (0-based)
  to: number;         // 끝 슬롯 (inclusive)
  total: number;      // 풀 총 사이즈
  consumed: number;   // 할당 후 consumed (다음 사용자가 받을 시작점)
};

/**
 * 회차의 현재 풀 상태 조회. 한 번만 읽음.
 * 풀 사이즈가 0이면 (아직 사전 계산 안 됨) null 반환.
 */
export async function fetchPoolState(round: number): Promise<PoolState | null> {
  try {
    const snap = await get(child(ref(db), `pools/${round}`));
    if (!snap.exists()) return null;
    const v = snap.val();
    if (!v || typeof v.total !== 'number' || typeof v.consumed !== 'number') return null;
    return {
      total: v.total,
      consumed: v.consumed,
      updatedAt: v.updatedAt ?? 0,
    };
  } catch (e) {
    console.warn('[firebase] fetchPoolState error:', (e as Error)?.message);
    return null;
  }
}

/**
 * 풀에서 N개 슬롯을 atomic하게 할당.
 *
 * - deviceSeed로 사용자 식별 → 같은 사용자가 두 번 호출하면 동일 슬롯 반환 (idempotent).
 * - 풀이 부족하면 가능한 만큼만 할당.
 *
 * @param round 회차
 * @param deviceSeed 사용자 기기 고유 시드
 * @param count 요청 슬롯 수
 * @returns 할당된 슬롯 범위 + 풀 상태. 풀 없으면 null.
 */
export async function allocateSlots(
  round: number,
  deviceSeed: string,
  count: number,
): Promise<AllocationResult | null> {
  if (count <= 0) return null;
  const poolRef = ref(db, `pools/${round}`);
  try {
    const result = await runTransaction(poolRef, (current) => {
      // 풀이 아직 생성 안 됨 → transaction 중단 (월요일 분석 전)
      if (!current || typeof current.total !== 'number') {
        return; // abort
      }
      const total = current.total;
      const consumed = current.consumed ?? 0;
      const remaining = Math.max(0, total - consumed);
      if (remaining <= 0) {
        // 풀 소진 → 더 이상 할당 불가
        return; // abort
      }

      // 이 사용자가 이미 받았는지 체크
      const allocations = current.allocations || {};
      const existing = allocations[deviceSeed];
      if (existing && typeof existing.from === 'number' && typeof existing.to === 'number') {
        // 이미 받음 → 추가 할당 (이어서 받기)
        const newFrom = consumed;
        const newTo = Math.min(newFrom + count - 1, total - 1);
        const allocCount = newTo - newFrom + 1;
        allocations[deviceSeed] = {
          from: existing.from,
          to: newTo, // 끝점만 갱신
          totalReceived: (existing.totalReceived || (existing.to - existing.from + 1)) + allocCount,
          lastAllocAt: Date.now(),
        };
        return {
          total,
          consumed: consumed + allocCount,
          allocations,
          updatedAt: Date.now(),
        };
      }

      // 새 사용자 → 새 슬롯 할당
      const newFrom = consumed;
      const newTo = Math.min(newFrom + count - 1, total - 1);
      const allocCount = newTo - newFrom + 1;
      allocations[deviceSeed] = {
        from: newFrom,
        to: newTo,
        totalReceived: allocCount,
        firstAllocAt: Date.now(),
        lastAllocAt: Date.now(),
      };
      return {
        total,
        consumed: consumed + allocCount,
        allocations,
        updatedAt: Date.now(),
      };
    });

    if (!result.committed || !result.snapshot.exists()) {
      console.warn('[firebase] allocateSlots: transaction not committed (pool not ready or exhausted)');
      return null;
    }
    const v = result.snapshot.val();
    const alloc = v.allocations?.[deviceSeed];
    if (!alloc) return null;
    return {
      from: alloc.from,
      to: alloc.to,
      total: v.total,
      consumed: v.consumed,
    };
  } catch (e) {
    console.warn('[firebase] allocateSlots error:', (e as Error)?.message);
    return null;
  }
}

/**
 * 이 사용자가 이미 받은 슬롯 범위 조회 (deviceSeed 기준).
 * 받은 적 없으면 null.
 */
export async function getMyAllocation(round: number, deviceSeed: string): Promise<{ from: number; to: number } | null> {
  try {
    const snap = await get(child(ref(db), `pools/${round}/allocations/${deviceSeed}`));
    if (!snap.exists()) return null;
    const v = snap.val();
    if (typeof v.from !== 'number' || typeof v.to !== 'number') return null;
    return { from: v.from, to: v.to };
  } catch {
    return null;
  }
}

export { db, app };
