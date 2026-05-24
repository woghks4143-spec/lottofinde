"""
compute-jachanism.py — GitHub Actions에서 매주 월요일 실행되는 통합 wrapper.

처리 흐름:
  1) data/enriched/*.json → 당첨번호 텍스트 파일 변환 (Python 알고리즘이 기대하는 형식)
  2) lotto_pinder.py의 lotto_pinder_method1() 호출 (실제 알고리즘)
  3) 다음 추첨 회차에 대한 풀 생성 → data/jachanism/pool_{N}.json
  4) 최근 52회 백테스트 → data/jachanism/backtest.json
  5) data/jachanism/index.json 갱신

사용법:
    python scripts/compute-jachanism.py                # 자동 (다음 추첨 회차 + 52회 백테스트)
    python scripts/compute-jachanism.py --round 1226   # 특정 회차 풀 강제 재생성
    python scripts/compute-jachanism.py --backtest-n 100  # 백테스트 회차 수 변경
    python scripts/compute-jachanism.py --skip-pool    # 백테스트만
    python scripts/compute-jachanism.py --skip-backtest # 풀만
"""
import argparse
import json
import os
import sys
import time
import urllib.request
from pathlib import Path
from collections import Counter

# Windows 콘솔(cp949) 인코딩 호환 — 이모지/한글 출력 안전화
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

# Firebase Realtime Database URL (글로벌 풀 카운터)
FIREBASE_DB = 'https://lottofinder-1662b-default-rtdb.asia-southeast1.firebasedatabase.app'

# 같은 폴더의 lotto_pinder import
sys.path.insert(0, str(Path(__file__).parent))
from lotto_pinder import (
    load_draws, lotto_pinder_method1, grade,
)

# 경로 설정
APP_ROOT = Path(__file__).parent.parent
ENRICHED_DIR = APP_ROOT / 'data' / 'enriched'
OUT_DIR = APP_ROOT / 'data' / 'jachanism'

ALGORITHM = 'JACKPOT_UNION_v1'


def convert_enriched_to_txt(output_path: Path):
    """data/enriched/*.json을 Python 알고리즘이 기대하는 텍스트 파일로 변환.

    출력 형식:
        회차  1구  2구  3구  4구  5구  6구  보너스
        1     10   23   29   33   37   40   16
        ...
    """
    rounds_data = []
    for f in ENRICHED_DIR.glob('*.json'):
        if f.name == 'index.json':
            continue
        try:
            with open(f, encoding='utf-8') as fp:
                data = json.load(fp)
            round_num = data.get('round')
            nums = data.get('nums')
            bonus = data.get('bonus')
            if not isinstance(round_num, int) or not isinstance(nums, list) or len(nums) != 6:
                continue
            if not isinstance(bonus, int):
                continue
            rounds_data.append((round_num, nums, bonus))
        except Exception as e:
            print(f"[convert] skip {f.name}: {e}")

    rounds_data.sort(key=lambda x: x[0])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("회차\t1\t2\t3\t4\t5\t6\t보너스\n")
        for round_num, nums, bonus in rounds_data:
            sorted_nums = sorted(nums)
            line = f"{round_num}\t" + "\t".join(map(str, sorted_nums)) + f"\t{bonus}\n"
            f.write(line)

    print(f"[convert] {len(rounds_data)} rounds saved to {output_path}")
    return len(rounds_data), (rounds_data[-1][0] if rounds_data else 0)


def compute_pool(draws, target_round: int):
    """다음 추첨 회차에 대한 풀 생성 (lotto_pinder_method1 호출)."""
    print(f"\n[pool] {target_round}회차 풀 생성 시작...")
    t0 = time.time()
    history = [d for d in draws if d['round'] < target_round]
    if len(history) < 50:
        print(f"[pool] ⚠️ 학습 데이터 {len(history)}회 미만 — 결과 신뢰성 낮음")
    combos = lotto_pinder_method1(history, target_round)
    elapsed = time.time() - t0
    print(f"[pool] {target_round}회: {len(combos):,}개 생성 ({elapsed:.1f}s)")

    out = {
        'round': target_round,
        'algorithm': ALGORITHM,
        'poolSize': len(combos),
        'computedAt': int(time.time() * 1000),
        'combos': [list(c) for c in combos],
    }
    out_file = OUT_DIR / f'pool_{target_round}.json'
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    size_mb = out_file.stat().st_size / 1024 / 1024
    print(f"[pool] saved {out_file.name} ({size_mb:.1f} MB)")

    # Firebase 글로벌 카운터 풀 사이즈 동기화 (consumed는 유지)
    sync_firebase_pool(target_round, len(combos))


def sync_firebase_pool(round_num: int, pool_size: int):
    """Firebase Realtime DB의 pools/{round}/total 을 실제 풀 사이즈로 갱신.
    consumed는 기존 값 유지 (사용자가 이미 받은 슬롯 보호).
    """
    try:
        # 현재 상태 조회
        get_url = f"{FIREBASE_DB}/pools/{round_num}.json"
        req = urllib.request.Request(get_url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            current = json.loads(resp.read().decode('utf-8'))
        existing_consumed = current.get('consumed', 0) if isinstance(current, dict) else 0

        # PATCH로 total + updatedAt만 갱신
        patch_url = f"{FIREBASE_DB}/pools/{round_num}.json"
        body = json.dumps({
            'total': pool_size,
            'consumed': existing_consumed,
            'updatedAt': int(time.time() * 1000),
        }).encode('utf-8')
        req = urllib.request.Request(
            patch_url, data=body, method='PATCH',
            headers={'Content-Type': 'application/json'},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode('utf-8'))
        print(f"[firebase] sync pool_{round_num}: total={pool_size}, consumed={existing_consumed}")
    except Exception as e:
        print(f"[firebase] sync failed (앱은 GitHub raw에서 fetch 가능, 무시 OK): {e}")


def compute_backtest(draws, latest_round: int, n_backtest: int):
    """최근 N회 백테스트 (각 회차에 대해 알고리즘 실행 + 등수 매칭)."""
    print(f"\n[backtest] 최근 {n_backtest}회 백테스트 시작 (~{latest_round}회)...")
    counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    rounds_tested = 0
    total_combos = 0
    start_r = max(1, latest_round - n_backtest + 1)
    wins_1st = []
    wins_2nd = []
    t0 = time.time()

    for r in range(start_r, latest_round + 1):
        actual = next((d for d in draws if d['round'] == r), None)
        if actual is None:
            print(f"[backtest] round {r}: 데이터 없음 — skip")
            continue
        rounds_tested += 1
        history = [d for d in draws if d['round'] < r]
        combos = lotto_pinder_method1(history, r)
        total_combos += len(combos)

        winners = set(actual['numbers_sorted'])
        bonus = actual['bonus']
        round_counts = Counter()
        for c in combos:
            g = grade(c, winners, bonus)
            if g > 0:
                round_counts[g] += 1
                counts[g] += 1

        if round_counts[1] > 0:
            wins_1st.append(r)
        if round_counts[2] > 0:
            wins_2nd.append(r)

        elapsed = time.time() - t0
        marker = ''
        if round_counts[1] > 0:
            marker = f' 🎉 1등 {round_counts[1]}개!'
        elif round_counts[2] > 0:
            marker = f' ⭐ 2등 {round_counts[2]}개'
        print(f"[backtest] {rounds_tested}/{n_backtest} (r={r}, {elapsed:.0f}s): "
              f"1등{round_counts[1]:>2} 2등{round_counts[2]:>2} 3등{round_counts[3]:>3} "
              f"4등{round_counts[4]:>4} 5등{round_counts[5]:>5}{marker}")

    elapsed = time.time() - t0
    print(f"\n[backtest] 완료 ({elapsed:.0f}s):")
    print(f"  🥇 1등: {counts[1]}개 (회차: {wins_1st})")
    print(f"  🥈 2등: {counts[2]}개 (회차: {wins_2nd})")
    print(f"  🥉 3등: {counts[3]}개")
    print(f"  4등: {counts[4]}개")
    print(f"  5등: {counts[5]}개")

    out = {
        'latestRound': latest_round,
        'algorithm': ALGORITHM,
        'roundsTested': rounds_tested,
        'totalCombosTested': total_combos,
        'rank1': counts[1],
        'rank2': counts[2],
        'rank3': counts[3],
        'rank4': counts[4],
        'rank5': counts[5],
        'wins1st': wins_1st,
        'wins2nd': wins_2nd,
        'computedAt': int(time.time() * 1000),
    }
    out_file = OUT_DIR / 'backtest.json'
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"[backtest] saved {out_file}")


def update_index():
    """data/jachanism/index.json 갱신."""
    pools = []
    for f in OUT_DIR.glob('pool_*.json'):
        try:
            round_num = int(f.stem.split('_')[1])
            pools.append(round_num)
        except (ValueError, IndexError):
            continue
    pools.sort(reverse=True)

    index = {
        'updatedAt': int(time.time() * 1000),
        'algorithm': ALGORITHM,
        'pools': pools,
    }
    with open(OUT_DIR / 'index.json', 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    print(f"\n[index] pools available: {pools}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--round', type=int, help='특정 회차 풀 강제 재생성')
    parser.add_argument('--backtest-n', type=int, default=52, help='백테스트 회차 수 (기본 52)')
    parser.add_argument('--skip-pool', action='store_true', help='풀 생성 건너뜀')
    parser.add_argument('--skip-backtest', action='store_true', help='백테스트 건너뜀')
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1) enriched → txt 변환
    txt_path = OUT_DIR / '_temp_winning_numbers.txt'
    n_rounds, latest_drawn = convert_enriched_to_txt(txt_path)
    if latest_drawn == 0:
        print("[main] ❌ 회차 데이터 없음. data/enriched/에 .json 파일이 있는지 확인.")
        sys.exit(1)

    # 2) Python 알고리즘으로 draws 로드
    draws = load_draws(str(txt_path))
    print(f"[main] {len(draws)}회차 로드 완료 (최신: {latest_drawn})")

    # 3) 다음 추첨 회차 풀 생성
    if not args.skip_pool:
        target_round = args.round if args.round else (latest_drawn + 1)
        pool_file = OUT_DIR / f'pool_{target_round}.json'
        if pool_file.exists() and not args.round:
            print(f"[pool] {target_round}회 풀 파일 이미 존재 — 건너뜀 (강제 재생성: --round {target_round})")
        else:
            compute_pool(draws, target_round)

    # 4) 백테스트 (이미 추첨된 회차들)
    if not args.skip_backtest and latest_drawn > 0:
        compute_backtest(draws, latest_drawn, args.backtest_n)

    # 5) 인덱스 갱신 + 임시 파일 정리
    update_index()
    if txt_path.exists():
        txt_path.unlink()

    print("\n[main] ✅ DONE")


if __name__ == '__main__':
    main()
