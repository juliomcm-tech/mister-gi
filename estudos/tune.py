import json, math, sys
import numpy as np
from model import run, evaluate, DEF, G

def loss(P):
    r = evaluate(run(P), '20172018', '20222023')
    return r['ml'] + r['1x2'] / 1.6 + r['o55'] * 0.5 + r['o65'] * 0.5 + r['pl'] * 0.5, r

# referências ingénuas
def naive(lo, hi):
    S = [g for g in G if lo <= g['season'] <= hi]
    hw = np.mean([g['hg'] > g['ag'] for g in S]); dr = np.mean([g['rh'] == g['ra'] for g in S])
    o55 = np.mean([g['rh'] + g['ra'] >= 6 for g in S])
    ll = lambda p, y: -math.log(p if y else 1 - p)
    return {'ml_casa_sempre': round(np.mean([ll(hw, g['hg'] > g['ag']) for g in S]), 5),
            'o55_taxa_fixa': round(np.mean([ll(o55, g['rh'] + g['ra'] >= 6) for g in S]), 5), 'taxa_casa': round(hw, 3), 'taxa_empate_60': round(dr, 3)}

if __name__ == '__main__':
    print('ingénuo treino', naive('20172018', '20222023')); print('ingénuo teste', naive('20232024', '20262027'))
    P = dict(DEF); best, r = loss(P); print('início', round(best, 5), r)
    P.update(json.load(open('/home/claude/gi-build/params.json'))); best, r = loss(P)
    grid = {'eta': [0.7, 0.85, 1.2, 1.4], 'carry': [0.7, 0.75, 0.85, 0.9, 0.95], 'hfa': [0.06, 0.07, 0.08, 0.09], 'w_sh': [0.5, 0.55, 0.65, 0.7],
            'gk_k': [0.5, 0.75, 1.5, 2.5], 'gk_w': [0.5, 0.75, 1.25, 1.5], 'b2b': [0.05, 0.065, 0.1, 0.12], 'delta': [0.15, 0.2, 0.25, 0.3, 0.35],
            'eps': [0.2, 0.22, 0.26, 0.28, 0.32], 'kappa': [0.4, 0.6, 0.8, 1.0, 1.2], 'half_gk': [0.5, 0.75, 1.5, 2]}
    for rnd in range(4):
        changed = False
        for k, mults in grid.items():
            for m in mults:
                Q = dict(P)
                Q[k] = (P[k] * m if k in ('eta', 'gk_k', 'half_gk') else m)
                if Q[k] == P[k]: continue
                l, rr = loss(Q)
                if l < best - 1e-5: best, P, r, changed = l, Q, rr, True; print(rnd, k, round(Q[k], 4), round(best, 5), flush=True)
        if not changed: break
    print('PARAMS', json.dumps({k: round(v, 5) for k, v in P.items()}))
    out = run(P)
    print('treino', evaluate(out, '20172018', '20222023'))
    for s in ('20232024', '20242025', '20252026', '20262027'): print('teste', s, evaluate(out, s, s))
    print('teste total', evaluate(out, '20232024', '20262027'))
    json.dump(P, open('/home/claude/gi-build/params.json', 'w'), indent=1)
