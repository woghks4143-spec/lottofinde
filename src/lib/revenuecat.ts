/**
 * RevenueCat SDK 래퍼 — PRO 멤버십 결제·복원·검증.
 *
 * 아키텍처:
 *   - 부팅 시 1회 `init()` 호출 → SDK 초기화
 *   - 결제 흐름은 `purchasePackage()` / `restorePurchases()`
 *   - 권한 확인은 `getCustomerInfo()` → entitlement 'pro' 활성 여부
 *
 * 영수증 검증·환불 처리는 RevenueCat 서버가 자동 처리.
 * Webhook은 추후 별도 백엔드 만들 때 연결.
 *
 * 보안: API 키는 client용 public key. 노출돼도 안전.
 *       단, 진짜 키는 RevenueCat 대시보드 → Project settings → API Keys.
 */
import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';

// RevenueCat Public API Key — client용 public key (노출 안전).
// Android는 발급 완료. iOS는 추후 App Store 출시 시 발급.
const API_KEY_ANDROID = 'goog_pwxwASkAlgSkdFHeVYzPsCPtvPz';
const API_KEY_IOS = 'appl_PLACEHOLDER_REPLACE_WITH_REAL_KEY';

/** PRO 권한 식별자 — RevenueCat 대시보드의 Entitlement 이름과 일치해야 함. */
export const PRO_ENTITLEMENT_ID = 'pro';

/** 상품 식별자 — Google Play Console에 등록한 product ID와 일치해야 함. */
export const PRODUCT_ID_MONTHLY = 'pro_monthly';
export const PRODUCT_ID_YEARLY = 'pro_yearly';

let initialized = false;

/**
 * SDK 초기화. 앱 부팅 시 1회 호출.
 * 두 번 호출되어도 안전 (initialized 플래그로 보호).
 */
export async function init(): Promise<void> {
  if (initialized) return;
  if (Platform.OS === 'web') return; // 웹은 SDK 미지원

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
    }
    const apiKey = Platform.OS === 'ios' ? API_KEY_IOS : API_KEY_ANDROID;
    await Purchases.configure({ apiKey });
    initialized = true;
  } catch (e) {
    console.warn('[RevenueCat] init failed:', (e as Error).message);
  }
}

/**
 * 현재 사용자의 PRO 권한 상태 조회.
 * RevenueCat 서버에 영수증 검증 요청 → 캐시 반영.
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (Platform.OS === 'web' || !initialized) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.warn('[RevenueCat] getCustomerInfo failed:', (e as Error).message);
    return null;
  }
}

/**
 * 사용 가능한 상품(offerings) 조회.
 * Play Console에 등록한 상품들이 RevenueCat 대시보드에 매핑되어 있어야 보임.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (Platform.OS === 'web' || !initialized) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (e) {
    console.warn('[RevenueCat] getOfferings failed:', (e as Error).message);
    return null;
  }
}

/**
 * 상품 구매.
 * @returns 성공 시 갱신된 CustomerInfo, 실패 시 null (사용자 취소 포함).
 */
export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<CustomerInfo | null> {
  if (Platform.OS === 'web' || !initialized) return null;
  try {
    const result = await Purchases.purchasePackage(pkg);
    return result.customerInfo;
  } catch (e: any) {
    // 사용자가 취소한 경우는 정상 — 에러로 처리 X
    if (e?.userCancelled) return null;
    console.warn('[RevenueCat] purchasePackage failed:', e?.message);
    throw e; // 다른 에러는 상위로 전파
  }
}

/**
 * 복원 구매 — 새 기기에서 같은 Google 계정으로 로그인하면 복원 가능.
 */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (Platform.OS === 'web' || !initialized) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (e) {
    console.warn('[RevenueCat] restorePurchases failed:', (e as Error).message);
    return null;
  }
}

/**
 * CustomerInfo에서 PRO 활성 여부 확인.
 */
export function isProActiveFromCustomerInfo(info: CustomerInfo | null): boolean {
  if (!info) return false;
  const ent = info.entitlements.active[PRO_ENTITLEMENT_ID];
  return !!ent;
}

/**
 * PRO 만료일 (ms timestamp) 조회.
 */
export function getProExpiresAt(info: CustomerInfo | null): number | null {
  if (!info) return null;
  const ent = info.entitlements.active[PRO_ENTITLEMENT_ID];
  if (!ent?.expirationDate) return null;
  return new Date(ent.expirationDate).getTime();
}

/**
 * 무료 체험 중인지 여부.
 */
export function isInTrial(info: CustomerInfo | null): boolean {
  if (!info) return false;
  const ent = info.entitlements.active[PRO_ENTITLEMENT_ID];
  return ent?.periodType === 'TRIAL';
}
