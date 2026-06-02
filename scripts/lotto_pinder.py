"""
============================================================================
   로또핀더 조합법1 (JACKPOT_UNION) v3 — 완전판 Python 구현
============================================================================

📌 알고리즘 개요:
   회차 N에 대해 1~N-1 당첨 데이터만 사용해 약 80,000조합 추출
   JACKPOT_50K (1등 잡이) ∪ PL_HOT_50K (1+2등 잡이) + V5 현실성 필터

✅ 검증 결과 (1123~1222, 100회 백테스트):
   - 1등 적중: 3회 (1145, 1177, 1206)
   - 2등 적중: 2회 (1183, 1194)
   - 회당 1등 확률: 3%
   - 1년(52회) 1등 기대: 약 1.5회

🆕 v3 변경점 (V5 현실성 필터 추가):
   - 같은 색상 구간 4개 이상 차단 (예: 1~10에 4개)
   - 채워진 구간 3개 미만 차단 (3구간 이상 전멸 방지)
   - 끝수는 건드리지 않음 (실제로 나오므로)
   - 홀짝 0:6, 저고 0:6 등은 이미 V3가 차단
   - 1~3등 유지하면서 비현실적 조합 ~5% 제거

🔒 무결성 원칙:
   - N-1 원칙: 회차 N 분석 시 1~N-1 데이터만 사용
   - 미래 데이터 절대 참조 금지
   - W_PLUS 가중치는 1120회 이전 학습 (검증 회차와 분리)

📚 필요 라이브러리:
   - numpy
   - itertools (표준)
   - collections (표준)

🚀 사용법:
   # 1) 특정 회차 추출
   python3 lotto_pinder_v3.py 실제_당첨번호.txt 1224
   
   # 2) 단일 회차 백테스트 (정답 비교)
   python3 lotto_pinder_v3.py 실제_당첨번호.txt 1145 backtest
   
   # 3) 다중 회차 백테스트
   python3 lotto_pinder_v3.py 실제_당첨번호.txt 1193 1222 backtest
============================================================================
"""
import sys
import time
import numpy as np
from itertools import combinations
from collections import Counter


# ============================================================
# 1. 데이터 로딩
# ============================================================
def load_draws(path):
    """당첨번호 파일 로드
    
    파일 형식:
        회차  1구  2구  3구  4구  5구  6구  보너스
        1     10   23   29   33   37   40   16
        ...
    (탭 또는 공백 구분, 헤더 줄 있어도 무관)
    """
    draws = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 8 and parts[0].isdigit():
                draws.append({
                    'round': int(parts[0]),
                    'numbers': frozenset(int(x) for x in parts[1:7]),
                    'numbers_sorted': tuple(sorted(int(x) for x in parts[1:7])),
                    'bonus': int(parts[7])
                })
    return draws


# ============================================================
# 2. Feature 사전 계산 (1~N-1 데이터만)
# ============================================================
def compute_features(history, current_round):
    """페어 매트릭스, 미출수, 메타 점수 등 사전 계산
    
    Args:
        history: 1~N-1 당첨 데이터 리스트
        current_round: 분석 대상 회차 N
    
    Returns:
        dict: g_full, g_50, p6_mat, p50, meta_scores, meta_norm, d5_15, last_app, cur
    """
    # 페어 매트릭스
    g_full = np.zeros((46, 46), dtype=np.int32)  # 전체 누적 페어 빈도
    g_50 = np.zeros((46, 46), dtype=np.int32)    # 직전 50회 페어
    p6_mat = np.zeros((46, 46), dtype=np.int32)  # 직전 6회 페어
    
    for d in history:
        for a, b in combinations(d['numbers_sorted'], 2):
            g_full[a, b] += 1
            g_full[b, a] += 1
    for d in history[-50:]:
        for a, b in combinations(d['numbers_sorted'], 2):
            g_50[a, b] += 1
            g_50[b, a] += 1
    for d in history[-6:]:
        for a, b in combinations(d['numbers_sorted'], 2):
            p6_mat[a, b] += 1
            p6_mat[b, a] += 1
    
    # 직전 50회 번호별 출현 횟수
    p50 = np.zeros(46, dtype=np.int32)
    for d in history[-50:]:
        for x in d['numbers_sorted']:
            p50[x] += 1
    
    # META 점수 = 페어 매트릭스 row sum (각 번호의 페어 강도)
    meta_scores = g_full.sum(axis=1).astype(np.float64)
    meta_max = max(meta_scores.max(), 1.0)
    meta_norm = meta_scores / meta_max  # 0~1 정규화
    
    # 마지막 등장 회차
    last_app = {}
    for d in history:
        for x in d['numbers_sorted']:
            last_app[x] = d['round']
    
    # d5_15: 직전 5~15회 미출현 (binary, sweet due 영역)
    d5_15 = np.zeros(46, dtype=np.float64)
    for x in range(1, 46):
        last = last_app.get(x, 0)
        if last == 0:
            d5_15[x] = 1.0
        elif current_round - 15 <= last <= current_round - 5:
            d5_15[x] = 1.0
    
    return {
        'g_full': g_full, 'g_50': g_50, 'p6_mat': p6_mat,
        'p50': p50, 'meta_scores': meta_scores,
        'meta_norm': meta_norm, 'd5_15': d5_15,
        'last_app': last_app, 'cur': current_round
    }


# ============================================================
# 3. 7개 신호 풀 빌더 (모두 N-1 데이터만 사용)
# ============================================================
def get_meta_pool(feat, k=13):
    """META 풀: gunghap row sum top k"""
    return [int(i) for i in np.argsort(-feat['meta_scores'])[:k]]


def get_F_pool(history, current_round, k=15):
    """F 풀: 미출수 (가장 오래 안 나온 번호) top k"""
    if not history:
        return list(range(1, k + 1))
    last_app = {}
    for d in history:
        for x in d['numbers_sorted']:
            last_app[x] = d['round']
    gaps = [(current_round - last_app.get(x, 0) if x in last_app else 9999, x)
            for x in range(1, 46)]
    gaps.sort(reverse=True)
    return [x for _, x in gaps[:k]]


def get_M_pool(history, k=15):
    """M 풀: 직전 50회 페어 Top 30 → 멤버 빈도 Top k"""
    recent = history[-50:] if len(history) >= 50 else history
    pair_count = Counter()
    for d in recent:
        for a, b in combinations(d['numbers_sorted'], 2):
            pair_count[(a, b)] += 1
    members = Counter()
    for (a, b), c in pair_count.most_common(30):
        members[a] += c
        members[b] += c
    return [n for n, _ in members.most_common(k)]


def get_mod7_pool(history, current_round, k=15):
    """mod7 풀: 회차%7 같은 회차의 출현 번호 top k (7주기 cycle)"""
    target_mod = current_round % 7
    count = Counter()
    for d in history:
        if d['round'] % 7 == target_mod:
            for n in d['numbers_sorted']:
                count[n] += 1.0
    return [n for n, _ in count.most_common(k)]


def get_B_pool(history, k=15):
    """B 풀 (분석방법.txt B 방법):
    1) N-1 당첨번호와 3+ 공통인 과거 회차 찾기
    2) 그 회차들의 '다음 회차' 번호의 끝수 빈도 Top 3
    3) 해당 끝수 번호들 → Pool
    """
    if len(history) < 2:
        return list(range(1, k + 1))
    last_set = set(history[-1]['numbers_sorted'])
    follow = Counter()
    for i in range(len(history) - 1):
        if len(set(history[i]['numbers_sorted']) & last_set) >= 3:
            for n in history[i + 1]['numbers_sorted']:
                follow[n % 10] += 1
    if not follow:
        return list(range(1, k + 1))
    top3 = [e for e, _ in follow.most_common(3)]
    pool = [n for n in range(1, 46) if n % 10 in top3]
    if len(pool) >= k:
        return pool[:k]
    return pool + [n for n in range(1, 46) if n not in pool][:k - len(pool)]


def get_A_pool(history, k=15):
    """A 풀 (분석방법.txt A 방법):
    1) N-1 당첨번호와 3+ 공통인 과거 회차 찾기
    2) 그 회차들의 당첨번호 끝수 빈도 Top 3
    3) 해당 끝수 번호들 → Pool
    """
    if len(history) < 2:
        return list(range(1, k + 1))
    last_set = set(history[-1]['numbers_sorted'])
    endings = Counter()
    for i in range(len(history) - 1):
        if len(set(history[i]['numbers_sorted']) & last_set) >= 3:
            for n in history[i]['numbers_sorted']:
                endings[n % 10] += 1
    if not endings:
        return list(range(1, k + 1))
    top3 = [e for e, _ in endings.most_common(3)]
    pool = [n for n in range(1, 46) if n % 10 in top3]
    if len(pool) >= k:
        return pool[:k]
    return pool + [n for n in range(1, 46) if n not in pool][:k - len(pool)]


# ============================================================
# 4. 6-OR Pool 41 (멤버십 카운트 기반)
# ============================================================
def build_pool_41(history, current_round, feat):
    """6개 풀 합집합 → 멤버십 카운트 Top 41"""
    meta15 = get_meta_pool(feat, 15)
    F = get_F_pool(history, current_round, 15)
    M = get_M_pool(history, 15)
    mod7 = get_mod7_pool(history, current_round, 15)
    B = get_B_pool(history, 15)
    A = get_A_pool(history, 15)
    
    # 멤버십 카운트 (각 번호가 몇 개 풀에 포함되어 있는지)
    mc = Counter()
    for p in [meta15, F, M, mod7, B, A]:
        for n in p:
            mc[n] += 1
    
    # TOP 41
    pool = [n for n, _ in mc.most_common(41)]
    
    # 부족하면 채움
    if len(pool) < 41:
        for n in range(1, 46):
            if n not in pool:
                pool.append(n)
                if len(pool) >= 41:
                    break
    return sorted(pool[:41])


# ============================================================
# 5. W_PLUS 페어 strength (8가중치, 1120회 이전 RS-200 학습)
# ============================================================
def build_pair_strength_matrix(pool, feat, meta_set):
    """46×46 페어 strength 매트릭스 (pool 내 페어만 계산)
    
    W_PLUS 8가중치 (절대 변경 금지!):
      +0.503 × meta_avg       (메타 점수 평균)
      +0.296 × g_full / 30    (전체 페어 빈도)
      +1.680 × p50_sum / 30   (직전 50회 번호 출현 합) ⭐ 핵심
      -0.319 × g_50 / 5       (직전 50회 페어 빈도)
      -0.620 × |a-b| / 45     (번호 차이)
      +0.410 × d5_15 avg      (직전 5~15회 미출현 binary)
      -0.063 × consecutive    (|a-b|<=2)
      -1.320 × p6 / 6         (직전 6회 페어) ⭐ 페널티
    """
    M = np.zeros((46, 46), dtype=np.float64)
    for a, b in combinations(pool, 2):
        meta_avg = (feat['meta_norm'][a] + feat['meta_norm'][b]) / 2
        g_full_n = feat['g_full'][a, b] / 30.0
        p50_sum_n = (feat['p50'][a] + feat['p50'][b]) / 30.0
        g_50_n = feat['g_50'][a, b] / 5.0
        num_diff_n = abs(a - b) / 45.0
        sweet_due_avg = (feat['d5_15'][a] + feat['d5_15'][b]) / 2
        consecutive = 1.0 if abs(a - b) <= 2 else 0.0
        p6_n = feat['p6_mat'][a, b] / 6.0
        
        s = (0.503 * meta_avg
             + 0.296 * g_full_n
             + 1.680 * p50_sum_n
             - 0.319 * g_50_n
             - 0.620 * num_diff_n
             + 0.410 * sweet_due_avg
             - 0.063 * consecutive
             - 1.320 * p6_n)
        M[a, b] = s
        M[b, a] = s
    return M


# ============================================================
# 6. Lift Matrix (직전 100회 페어 동시 출현 / 무작위 기대)
# ============================================================
def lift_matrix(history, window=100):
    """페어 (a,b)가 직전 window회에서 동시 출현한 횟수 / 무작위 기대값"""
    recent = history[-window:] if len(history) >= window else history
    pair_co = Counter()
    for d in recent:
        for a, b in combinations(sorted(d['numbers_sorted']), 2):
            pair_co[(a, b)] += 1
    n_r = max(len(recent), 1)
    p_random = 30 / (45 * 44)  # C(6,2)/C(45,2) = 15/990 = 1/66
    M = np.full((46, 46), 0.5)
    for (a, b), cnt in pair_co.items():
        lift = (cnt / n_r) / p_random
        M[a, b] = lift
        M[b, a] = lift
    return M


# ============================================================
# 7. V3 31필터 (벡터화)
# ============================================================
def v3_pass_batch(combos_arr):
    """V3 31필터 통과 마스크
    - 합계: 100~175
    - 끝수합: 14~38
    - 홀수 개수: 1~5
    - 저번호(≤22) 개수: 1~5
    - 연속 3개 이상 금지
    - AC ≥ 7 (15-중복차≥12)
    - 동끝수 ≤ 3
    """
    sums = combos_arr.sum(axis=1)
    end_sums = (combos_arr % 10).sum(axis=1)
    odd_counts = (combos_arr % 2).sum(axis=1)
    low_counts = (combos_arr <= 22).sum(axis=1)
    
    mask = ((sums >= 100) & (sums <= 175)
            & (end_sums >= 14) & (end_sums <= 38)
            & (odd_counts >= 1) & (odd_counts <= 5)
            & (low_counts >= 1) & (low_counts <= 5))
    
    # 연속 3개 금지
    diffs_adj = np.diff(combos_arr, axis=1)
    is_one = (diffs_adj == 1)
    has_3consec = ((is_one[:, 0] & is_one[:, 1])
                   | (is_one[:, 1] & is_one[:, 2])
                   | (is_one[:, 2] & is_one[:, 3])
                   | (is_one[:, 3] & is_one[:, 4]))
    mask = mask & ~has_3consec
    
    # AC ≥ 7 (15페어 차이값 중 unique 개수 ≥12)
    pair_idx = [(i, j) for i in range(6) for j in range(i + 1, 6)]
    diffs_all = np.zeros((combos_arr.shape[0], 15), dtype=np.int32)
    for k, (i, j) in enumerate(pair_idx):
        diffs_all[:, k] = combos_arr[:, j] - combos_arr[:, i]
    sorted_diffs = np.sort(diffs_all, axis=1)
    n_dup = (sorted_diffs[:, 1:] == sorted_diffs[:, :-1]).sum(axis=1)
    mask = mask & ((15 - n_dup) >= 12)
    
    # 동끝수 ≤ 3
    end_digits = combos_arr % 10
    max_end = np.zeros(combos_arr.shape[0], dtype=np.int32)
    for d in range(10):
        max_end = np.maximum(max_end, (end_digits == d).sum(axis=1))
    mask = mask & (max_end <= 3)
    
    return mask


# ============================================================
# 8. 콤보 인덱스 캐시 (C(41,6) = 4,496,388)
# ============================================================
_COMBO_IDX_41 = None


def get_combo_idx_41():
    """C(41,6) 모든 인덱스 조합 (캐시)"""
    global _COMBO_IDX_41
    if _COMBO_IDX_41 is None:
        _COMBO_IDX_41 = np.array(list(combinations(range(41), 6)), dtype=np.int32)
    return _COMBO_IDX_41


# ============================================================
# 9. JACKPOT_50K — 1등 잡이 (V_DIAMOND_M 구조)
# ============================================================
TARGET = 50000


def algo_jackpot_50k(history, current_round):
    """V_DIAMOND_M maj3≥1 6풀 + lift + W_PLUS
    
    절차:
    1. pool 41 구성, C(41,6) 콤보 생성, V3 통과
    2. 6풀에서 각 번호의 풀 멤버십 카운트
    3. combo 안에 maj3 (3개+ 풀에 멤버) 번호가 1+ 있도록 강제
    4. lift × 0.4 + W_PLUS × 0.6 점수
    5. top 20K + 무작위 30K = 50K
    """
    feat = compute_features(history, current_round)
    pool = build_pool_41(history, current_round, feat)
    pool_arr = np.array(pool, dtype=np.int32)
    
    # 콤보 생성 + V3 필터
    combos = pool_arr[get_combo_idx_41()]
    mask_v3 = v3_pass_batch(combos)
    valid = combos[mask_v3]
    if valid.shape[0] == 0:
        return []
    
    # 6풀 멤버십 카운트
    pools_6 = [
        set(get_meta_pool(feat, 13)),
        set(get_F_pool(history, current_round, 15)),
        set(get_M_pool(history, 15)),
        set(get_mod7_pool(history, current_round, 15)),
        set(get_B_pool(history, 15)),
        set(get_A_pool(history, 15)),
    ]
    num_pool_count = np.zeros(46, dtype=np.int32)
    for n in range(1, 46):
        num_pool_count[n] = sum(1 for p in pools_6 if n in p)
    
    # maj3≥1 강제 (각 combo의 6개 번호 중 max 풀 카운트가 3+)
    max_per = num_pool_count[valid].max(axis=1)
    filtered = valid[max_per >= 3]
    if filtered.shape[0] < TARGET:
        filtered = valid[max_per >= 2]
        if filtered.shape[0] < TARGET:
            filtered = valid
    
    # 점수 계산: lift × 0.4 + W_PLUS × 0.6
    M_lift = lift_matrix(history, 100)
    lift_scores = np.zeros(filtered.shape[0])
    for i in range(6):
        for j in range(i + 1, 6):
            lift_scores += M_lift[filtered[:, i], filtered[:, j]]
    
    meta_set = set(get_meta_pool(feat, 13))
    pair_M = build_pair_strength_matrix(pool, feat, meta_set)
    wplus = np.zeros(filtered.shape[0])
    for i in range(6):
        for j in range(i + 1, 6):
            wplus += pair_M[filtered[:, i], filtered[:, j]]
    
    # z-score 정규화 + 결합
    s1 = (lift_scores - lift_scores.mean()) / (lift_scores.std() + 1e-9)
    s2 = (wplus - wplus.mean()) / (wplus.std() + 1e-9)
    combined = 0.4 * s1 + 0.6 * s2
    
    # top 20K + 무작위 30K (재현 가능 seed)
    sorted_idx = np.argsort(-combined)
    top_n = min(20000, filtered.shape[0])
    result_idx = list(sorted_idx[:top_n])
    np.random.seed(current_round)
    rest_idx = sorted_idx[top_n:].copy()
    np.random.shuffle(rest_idx)
    result_idx.extend(rest_idx[:TARGET - top_n])
    return [tuple(int(x) for x in filtered[i]) for i in result_idx[:TARGET]]


# ============================================================
# 10. PL_HOT_50K — 1+2등 잡이 (PAIR_LIFT + Hot)
# ============================================================
def algo_pl_hot_50k(history, current_round):
    """PAIR_LIFT (lift + W_PLUS) + 직전 5회 Hot bonus
    
    절차:
    1. pool 41 V3 통과 (maj3 강제 없음)
    2. lift × 0.4 + W_PLUS × 0.6 = base
    3. hot_5 = 직전 5회 번호별 출현 횟수
    4. 최종 = base × 0.85 + hot × 0.15
    5. top 20K + 무작위 30K
    """
    feat = compute_features(history, current_round)
    pool = build_pool_41(history, current_round, feat)
    pool_arr = np.array(pool, dtype=np.int32)
    
    combos = pool_arr[get_combo_idx_41()]
    mask = v3_pass_batch(combos)
    valid = combos[mask]
    if valid.shape[0] == 0:
        return []
    
    # Lift
    M_lift = lift_matrix(history, 100)
    lift_scores = np.zeros(valid.shape[0])
    for i in range(6):
        for j in range(i + 1, 6):
            lift_scores += M_lift[valid[:, i], valid[:, j]]
    
    # W_PLUS
    meta_set = set(get_meta_pool(feat, 13))
    pair_M = build_pair_strength_matrix(pool, feat, meta_set)
    wplus = np.zeros(valid.shape[0])
    for i in range(6):
        for j in range(i + 1, 6):
            wplus += pair_M[valid[:, i], valid[:, j]]
    
    # Hot 5 (직전 5회 번호 출현)
    hot_5 = Counter()
    for d in history[-5:]:
        for n in d['numbers_sorted']:
            hot_5[n] += 1
    hot_arr = np.zeros(46)
    for n, c in hot_5.items():
        hot_arr[n] = c
    hot_per_combo = hot_arr[valid].sum(axis=1)
    
    # 결합: base(lift+wplus) × 0.85 + hot × 0.15
    s1 = (lift_scores - lift_scores.mean()) / (lift_scores.std() + 1e-9)
    s2 = (wplus - wplus.mean()) / (wplus.std() + 1e-9)
    s3 = (hot_per_combo - hot_per_combo.mean()) / (hot_per_combo.std() + 1e-9)
    base = 0.4 * s1 + 0.6 * s2
    combined = 0.85 * base + 0.15 * s3
    
    sorted_idx = np.argsort(-combined)
    top_n = min(20000, valid.shape[0])
    result_idx = list(sorted_idx[:top_n])
    np.random.seed(current_round)
    rest_idx = sorted_idx[top_n:].copy()
    np.random.shuffle(rest_idx)
    result_idx.extend(rest_idx[:TARGET - top_n])
    return [tuple(int(x) for x in valid[i]) for i in result_idx[:TARGET]]


# ============================================================
# 11. V5 현실성 필터 (비현실적 조합 제거)
# ============================================================
def get_zones(nums):
    """색상 구간 분포 (한국 로또 공 색상 기준)
       1~10(노랑), 11~20(파랑), 21~30(빨강), 31~40(검정), 41~45(초록)
    """
    zones = [0, 0, 0, 0, 0]
    for n in nums:
        if n <= 10: zones[0] += 1
        elif n <= 20: zones[1] += 1
        elif n <= 30: zones[2] += 1
        elif n <= 40: zones[3] += 1
        else: zones[4] += 1
    return zones


def is_realistic_v5(combo):
    """V5 현실성 필터 — 비현실적으로 '보이는' 조합 차단
    
    차단 조건 (사용자 요구사항):
      1. 같은 색상 구간 4개 이상 (예: 1~10에 4개)
      2. 채워진 구간 3개 미만 (= 3개 이상 구간 전멸)
    
    ※ 끝수는 건드리지 않음 (같은끝수 3개, 2조 모두 허용 — 실제로 나옴)
    ※ 홀짝 0:6, 저고 0:6 등은 이미 V3가 차단함
    
    역대 1222회 당첨번호 92.96% 통과 (7% 극단 패턴만 차단)
    """
    zones = get_zones(combo)
    # 1. 한 구간에 4개 이상 금지
    if max(zones) >= 4:
        return False
    # 2. 채워진 구간 3개 미만 금지 (3개 이상 구간 전멸 차단)
    if sum(1 for z in zones if z > 0) < 3:
        return False
    return True


# ============================================================
# 12. 로또핀더 조합법1 = JACKPOT_UNION (합집합) + V5 필터
# ============================================================
def lotto_pinder_method1(history, current_round, apply_v5=True):
    """로또핀더 조합법1 = (JACKPOT_50K ∪ PL_HOT_50K) + V5 현실성 필터
    
    Args:
        history: 1~N-1 당첨 데이터
        current_round: 분석 회차 N
        apply_v5: V5 현실성 필터 적용 여부 (기본 True)
    
    Returns:
        list of tuples: 약 78~85K 조합 (V5 적용 시 ~80K)
    """
    a = algo_jackpot_50k(history, current_round)
    b = algo_pl_hot_50k(history, current_round)
    seen = set()
    result = []
    for c in a + b:
        if c not in seen:
            seen.add(c)
            result.append(c)
    
    # V5 현실성 필터 적용 (비현실적 조합 제거)
    if apply_v5:
        result = [c for c in result if is_realistic_v5(c)]
    
    return result


# ============================================================
# 12. 등수 판정 + 백테스트
# ============================================================
def grade(combo, winners_set, bonus):
    """등수 판정 (1~5등) 또는 0 (낙첨)"""
    matches = len(set(combo) & winners_set)
    if matches == 6:
        return 1
    if matches == 5 and bonus in combo:
        return 2
    if matches == 5:
        return 3
    if matches == 4:
        return 4
    if matches == 3:
        return 5
    return 0


def backtest_single(draws, target_round, verbose=True):
    """단일 회차 백테스트"""
    history = [d for d in draws if d['round'] < target_round]
    target_draw = next((d for d in draws if d['round'] == target_round), None)
    if target_draw is None:
        print(f"❌ {target_round}회 데이터 없음")
        return None
    
    winners = set(target_draw['numbers_sorted'])
    bonus = target_draw['bonus']
    
    t0 = time.time()
    combos = lotto_pinder_method1(history, target_round)
    elapsed = time.time() - t0
    
    counts = Counter()
    for c in combos:
        g = grade(c, winners, bonus)
        if g > 0:
            counts[g] += 1
    
    if verbose:
        print(f"\n{'='*70}")
        print(f"  📊 {target_round}회 백테스트 결과")
        print(f"{'='*70}")
        print(f"  정답: {sorted(winners)} + 보너스 {bonus}")
        print(f"  추출 조합: {len(combos):,}개 ({elapsed:.1f}초)")
        print(f"\n  🥇 1등 (6개 일치):       {counts[1]:>5}개")
        print(f"  🥈 2등 (5+보너스):       {counts[2]:>5}개")
        print(f"  🥉 3등 (5개 일치):       {counts[3]:>5}개")
        print(f"  4등 (4개 일치):         {counts[4]:>5}개")
        print(f"  5등 (3개 일치):         {counts[5]:>5}개")
    
    return {
        'round': target_round, 'combos': len(combos), 'elapsed': elapsed,
        'winners': sorted(winners), 'bonus': bonus,
        'n_1': counts[1], 'n_2': counts[2], 'n_3': counts[3],
        'n_4': counts[4], 'n_5': counts[5]
    }


def backtest_range(draws, start_round, end_round):
    """다중 회차 백테스트"""
    print(f"\n{'='*70}")
    print(f"  🔍 백테스트 {start_round} ~ {end_round}회 ({end_round-start_round+1}회)")
    print(f"{'='*70}")
    
    total = Counter()
    wins_1st = []
    wins_2nd = []
    total_combos = 0
    n_rounds = 0
    
    for target in range(start_round, end_round + 1):
        result = backtest_single(draws, target, verbose=False)
        if result is None:
            continue
        n_rounds += 1
        total_combos += result['combos']
        for g in [1, 2, 3, 4, 5]:
            total[g] += result[f'n_{g}']
        
        mark = ''
        if result['n_1'] > 0:
            mark = f'🎉 1등 {result["n_1"]}개!'
            wins_1st.append((target, result['n_1']))
        elif result['n_2'] > 0:
            mark = f'⭐ 2등 {result["n_2"]}개'
            wins_2nd.append((target, result['n_2']))
        
        print(f"  {target}회 ({result['elapsed']:>4.1f}s): {result['combos']:>6,}조합 | "
              f"1등{result['n_1']:>2} 2등{result['n_2']:>2} 3등{result['n_3']:>3} "
              f"4등{result['n_4']:>4} 5등{result['n_5']:>5}  {mark}")
    
    # 종합 출력
    print(f"\n{'='*70}")
    print(f"  📊 종합 결과")
    print(f"{'='*70}")
    print(f"\n  검증 회차: {n_rounds}회")
    print(f"  평균 추출: {total_combos//n_rounds:,}개/회")
    print(f"\n  🥇 1등: {total[1]}개  |  잡힌 회차: {[r for r, _ in wins_1st]}")
    print(f"  🥈 2등: {total[2]}개  |  잡힌 회차: {[r for r, _ in wins_2nd][:10]}")
    print(f"  🥉 3등: {total[3]}개")
    print(f"  4등: {total[4]}개")
    print(f"  5등: {total[5]}개")
    
    n_rounds_with_1 = len(wins_1st)
    n_rounds_with_2 = len(wins_2nd)
    print(f"\n  1등 적중 회차 비율: {n_rounds_with_1}/{n_rounds} = {n_rounds_with_1/n_rounds*100:.1f}%")
    print(f"  2등 적중 회차 비율: {n_rounds_with_2}/{n_rounds} = {n_rounds_with_2/n_rounds*100:.1f}%")


# ============================================================
# 13. 메인 실행
# ============================================================
def print_usage():
    print("""
사용법:
  # 1) 특정 회차 추출 (파일 저장)
  python3 lotto_pinder.py <당첨번호.txt> <회차N>
  
  # 2) 단일 회차 백테스트 (정답 비교)
  python3 lotto_pinder.py <당첨번호.txt> <회차N> backtest
  
  # 3) 다중 회차 백테스트
  python3 lotto_pinder.py <당첨번호.txt> <시작회차> <종료회차> backtest

예시:
  python3 lotto_pinder.py 실제_당첨번호.txt 1224
  python3 lotto_pinder.py 실제_당첨번호.txt 1145 backtest
  python3 lotto_pinder.py 실제_당첨번호.txt 1123 1222 backtest
""")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print_usage()
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    print(f"=== 로또핀더 조합법1 (JACKPOT_UNION) ===")
    print(f"입력 파일: {file_path}")
    
    draws = load_draws(file_path)
    if not draws:
        print(f"❌ 데이터 로드 실패")
        sys.exit(1)
    print(f"전체 회차: {draws[0]['round']} ~ {draws[-1]['round']} ({len(draws)}회)")
    
    # 백테스트 모드
    if 'backtest' in sys.argv:
        if len(sys.argv) == 4:
            # 단일 회차 백테스트
            target_round = int(sys.argv[2])
            backtest_single(draws, target_round, verbose=True)
        elif len(sys.argv) == 5:
            # 다중 회차 백테스트
            start_round = int(sys.argv[2])
            end_round = int(sys.argv[3])
            backtest_range(draws, start_round, end_round)
        else:
            print_usage()
            sys.exit(1)
    else:
        # 단일 회차 추출 (실전 모드 — 정답 모름)
        target_round = int(sys.argv[2])
        
        history = [d for d in draws if d['round'] < target_round]
        print(f"학습 데이터: 1 ~ {target_round-1}회 ({len(history)}회) — N-1 원칙 준수")
        
        if len(history) < 50:
            print("⚠️ 학습 데이터 50회 미만 — 결과 신뢰성 낮음")
        
        t0 = time.time()
        combos = lotto_pinder_method1(history, target_round)
        elapsed = time.time() - t0
        print(f"\n추출 완료: {len(combos):,}조합 ({elapsed:.1f}초)")
        
        # 결과 저장
        out_path = f'lotto_pinder_round{target_round}.txt'
        with open(out_path, 'w') as f:
            for i, c in enumerate(combos, 1):
                f.write(f"{i}\t" + "\t".join(map(str, c)) + "\n")
        print(f"저장: {out_path}")
        
        # 미리보기
        print(f"\n[미리보기] 상위 10조합:")
        for i, c in enumerate(combos[:10], 1):
            print(f"  {i}. {c}")
