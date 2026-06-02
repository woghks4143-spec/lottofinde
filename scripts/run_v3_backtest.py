"""
1년(52회) v3 백테스트 러너 — 결과를 직접 JSON으로 출력.
콘솔 출력 최소화 (cp949 환경 호환).
"""
import sys, json, time
from pathlib import Path
from collections import Counter

# UTF-8 강제
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
from lotto_pinder import load_draws, lotto_pinder_method1, grade

DRAWS_PATH = ROOT / 'draws.txt'
OUT_PATH = ROOT.parent / 'data' / 'jachanism' / 'backtest.json'

# 백테스트 범위: 최신 52회 (1년)
N_BACKTEST = 52

def main():
    draws = load_draws(str(DRAWS_PATH))
    if not draws:
        sys.exit('failed to load draws')
    latest = draws[-1]['round']
    start = latest - N_BACKTEST + 1
    print(f'backtest {start}~{latest} (52 rounds)', flush=True)

    total = Counter()
    round_details = []
    wins_1st = []
    wins_2nd = []
    rounds_with_rank3 = []
    total_combos = 0
    n_rounds = 0
    t0_total = time.time()

    for target in range(start, latest + 1):
        history = [d for d in draws if d['round'] < target]
        target_draw = next((d for d in draws if d['round'] == target), None)
        if target_draw is None:
            continue

        winners = set(target_draw['numbers_sorted'])
        bonus = target_draw['bonus']

        t0 = time.time()
        combos = lotto_pinder_method1(history, target)
        elapsed = time.time() - t0

        counts = Counter()
        for c in combos:
            g = grade(c, winners, bonus)
            if g > 0:
                counts[g] += 1

        n_rounds += 1
        total_combos += len(combos)
        for g in [1, 2, 3, 4, 5]:
            total[g] += counts[g]

        if counts[1] > 0:
            wins_1st.append(target)
        if counts[2] > 0:
            wins_2nd.append(target)
        if counts[3] > 0:
            rounds_with_rank3.append({'round': target, 'count': counts[3]})

        round_details.append({
            'round': target,
            'rank1': counts[1], 'rank2': counts[2],
            'rank3': counts[3], 'rank4': counts[4], 'rank5': counts[5],
        })

        # 짧은 진행 출력 — 이모지 사용 X
        mark = ''
        if counts[1] > 0: mark = f' *1st x{counts[1]}*'
        elif counts[2] > 0: mark = f' *2nd x{counts[2]}*'
        print(f'  {target} ({elapsed:>4.1f}s): {len(combos):>7,} combos | '
              f'r1={counts[1]} r2={counts[2]} r3={counts[3]:>3} '
              f'r4={counts[4]:>4} r5={counts[5]:>5}{mark}', flush=True)

    elapsed_total = time.time() - t0_total
    print(f'\nDONE {n_rounds} rounds in {elapsed_total:.1f}s', flush=True)
    print(f'r1={total[1]} r2={total[2]} r3={total[3]} r4={total[4]} r5={total[5]}', flush=True)
    print(f'wins1st={wins_1st}', flush=True)
    print(f'wins2nd={wins_2nd}', flush=True)

    out = {
        'latestRound': latest,
        'algorithm': 'JACKPOT_UNION_v3',
        'roundsTested': n_rounds,
        'totalCombosTested': total_combos,
        'rank1': total[1], 'rank2': total[2], 'rank3': total[3],
        'rank4': total[4], 'rank5': total[5],
        'wins1st': wins_1st,
        'wins2nd': wins_2nd,
        'roundsWithRank3': rounds_with_rank3,
        'roundDetails': round_details,
        'computedAt': int(time.time() * 1000),
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'saved {OUT_PATH}', flush=True)


if __name__ == '__main__':
    main()
