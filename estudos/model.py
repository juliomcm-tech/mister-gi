"""Mister Gi · modelo de golos NHL (walk-forward, sem ver o futuro).
λ_casa = exp(μ + casa + atq_casa − def_fora + gr_fora + cansaço), λ_fora = exp(μ + atq_fora − def_casa + gr_casa + cansaço)
- atq/def: atualizados jogo a jogo (estilo Elo para golos), mistura de golos reais e «golos esperados por remates»
- guarda-redes: golos evitados acima da média por remate (encolhido), do titular
- tempo regulamentar: Poisson independente + empates inflacionados (δ) + baliza deserta (ε: parte das vitórias por 1 viram por 2)
- prolongamento: 50% + κ·diferença de força
"""
import json, math, sys
from collections import defaultdict
import numpy as np

G = json.load(open('/home/claude/gi-build/games.json'))
DEF = dict(eta=0.035, carry=0.6, hfa=0.06, w_sh=0.5, gk_k=900, gk_w=1.0, b2b=0.05, delta=0.10, eps=0.12, kappa=0.25, half_gk=1500)

def pois(l, n): return math.exp(-l) * l ** n / math.factorial(n)

def score_grid(lh, la, P, N=11):
    M = np.zeros((N, N))
    ph = [pois(lh, i) for i in range(N)]; pa = [pois(la, j) for j in range(N)]
    for i in range(N):
        for j in range(N): M[i, j] = ph[i] * pa[j]
    for i in range(N): M[i, i] *= (1 + P['delta'])
    M /= M.sum()
    # baliza deserta: parte das vitórias por 1 golo passam a vitórias por 2 (quem perde tira o guarda-redes)
    e = P['eps']
    if e:
        M2 = M.copy()
        for i in range(N - 1):
            for j in range(N - 1):
                if i - j == 1: M2[i, j] -= e * M[i, j]; M2[i + 1, j] += e * M[i, j]
                if j - i == 1: M2[i, j] -= e * M[i, j]; M2[i, j + 1] += e * M[i, j]
        M = M2
    return M

def markets(M, pot):
    N = M.shape[0]; I, J = np.indices(M.shape)
    hw = M[I > J].sum(); dr = M[I == J].sum(); aw = M[I < J].sum()
    ml = hw + dr * pot
    tot = I + J
    o55 = M[tot >= 6].sum(); o65 = M[tot >= 7].sum()
    hcap = M[(I - J) >= 2].sum(); acap = M[(J - I) >= 2].sum()   # casa −1,5 / fora −1,5
    eg = (M * tot).sum()
    return dict(hw=hw, dr=dr, aw=aw, ml=ml, o55=o55, o65=o65, hm15=hcap, am15=acap, eg=eg)

def run(P, collect_from='20172018', verbose=False, state=None):
    A = defaultdict(float); Dd = defaultdict(float)
    GK = defaultdict(lambda: [0.0, 0.0])   # [golos evitados acima da média (ponderado), remates (ponderado)]
    LAST = {}; season = None
    lg = {'g': 3.0, 'sv': 0.905, 'sh': 30.0}
    out = []
    for g in G:
        if g['season'] != season:
            season = g['season']
            for t in list(A): A[t] *= P['carry']; Dd[t] *= P['carry']
        h, a = g['h'], g['a']
        mu = math.log(lg['g'])
        def gk_of(side):
            st = [x for x in g['gk'].get(side, []) if x['st']] or g['gk'].get(side, [])[:1]
            return st[0]['id'] if st else None
        gh, ga = gk_of('h'), gk_of('a')
        def gq(gid):   # golos evitados por remate, encolhido
            if not gid: return 0.0
            s = GK[gid]; return s[0] / (s[1] + P['gk_k'])
        # qualidade do guarda-redes → multiplica golos sofridos: (1−sv_gr)/(1−sv_liga)
        fgh = max(0.5, 1 - gq(gh) / (1 - lg['sv'])) ** P['gk_w']   # guarda-redes da casa trava a equipa de fora
        fga = max(0.5, 1 - gq(ga) / (1 - lg['sv'])) ** P['gk_w']
        dn = g['date']
        def b2b(t):
            l = LAST.get(t); return 1 if l and (np.datetime64(dn) - np.datetime64(l)).astype(int) == 1 else 0
        bh, ba = b2b(h), b2b(a)
        lh = math.exp(mu + P['hfa'] + A[h] - Dd[a] - P['b2b'] * bh + P['b2b'] * 0.5 * ba) * fga
        la = math.exp(mu + A[a] - Dd[h] - P['b2b'] * ba + P['b2b'] * 0.5 * bh) * fgh
        if g['season'] >= collect_from:
            M = score_grid(lh, la, P)
            pot = 0.5 + P['kappa'] * ((A[h] + Dd[h]) - (A[a] + Dd[a]) + P['hfa'] * 0.5)
            pot = min(0.75, max(0.25, pot))
            mk = markets(M, pot)
            out.append((g, lh, la, mk, pot, bh, ba, gh, ga))
        # ---- atualizar ----
        lh0 = math.exp(mu + P['hfa'] + A[h] - Dd[a]); la0 = math.exp(mu + A[a] - Dd[h])
        # «golos esperados» por remates: remates × finalização média da liga
        xh = g['sh'].get('h', 0) * (lg['g'] / lg['sh']); xa = g['sh'].get('a', 0) * (lg['g'] / lg['sh'])
        yh = (1 - P['w_sh']) * g['rh'] + P['w_sh'] * xh; ya = (1 - P['w_sh']) * g['ra'] + P['w_sh'] * xa
        rh_ = (yh - lh0) / lh0; ra_ = (ya - la0) / la0
        A[h] += P['eta'] * rh_; Dd[a] -= P['eta'] * rh_
        A[a] += P['eta'] * ra_; Dd[h] -= P['eta'] * ra_
        for side in ('h', 'a'):
            for x in g['gk'].get(side, []):
                if x['sa'] <= 0: continue
                s = GK[x['id']]; dec = math.exp(-x['sa'] / P['half_gk'] * math.log(2))
                s[0] = s[0] * dec + (x['sv'] - lg['sv'] * x['sa']); s[1] = s[1] * dec + x['sa']
        # médias da liga (lentas)
        tg = g['rh'] + g['ra']; lg['g'] = 0.998 * lg['g'] + 0.002 * tg / 2
        sa = sum(x['sa'] for s in g['gk'].values() for x in s); sv = sum(x['sv'] for s in g['gk'].values() for x in s)
        if sa: lg['sv'] = 0.998 * lg['sv'] + 0.002 * sv / sa
        lg['sh'] = 0.998 * lg['sh'] + 0.002 * (g['sh'].get('h', 30) + g['sh'].get('a', 30)) / 2
        LAST[h] = LAST[a] = dn
    if state is not None: state.update(A=dict(A), D=dict(Dd), GK={k: list(v) for k, v in GK.items()}, LAST=dict(LAST), lg=dict(lg), season=season)
    return out

def evaluate(out, lo, hi):
    L = {'1x2': [], 'ml': [], 'o55': [], 'o65': [], 'pl': []}; acc = []
    for g, lh, la, mk, pot, *_ in out:
        if not (lo <= g['season'] <= hi): continue
        rh, ra = g['rh'], g['ra']
        y = 0 if rh > ra else 1 if rh == ra else 2
        p3 = [mk['hw'], mk['dr'], mk['aw']]
        L['1x2'].append(-math.log(max(1e-9, p3[y])))
        hw = g['hg'] > g['ag']
        L['ml'].append(-math.log(max(1e-9, mk['ml'] if hw else 1 - mk['ml'])))
        acc.append((mk['ml'] > 0.5) == hw)
        t = rh + ra
        for k, ln in (('o55', 6), ('o65', 7)):
            p = mk[k]; L[k].append(-math.log(max(1e-9, p if t >= ln else 1 - p)))
        L['pl'].append(-math.log(max(1e-9, mk['hm15'] if rh - ra >= 2 else 1 - mk['hm15'])))
    r = {k: round(float(np.mean(v)), 5) for k, v in L.items()}; r['acerto_ml'] = round(float(np.mean(acc)), 4); r['n'] = len(acc)
    return r

if __name__ == '__main__':
    out = run(DEF)
    print('afinação 17/18-22/23', evaluate(out, '20172018', '20222023'))
    print('teste 23/24-26/27   ', evaluate(out, '20232024', '20262027'))
