#!/usr/bin/env python3
"""Mister Gi — NHL player props (marcador, pontos, remates) — estudo reprodutível.

Uso:  python3 study.py            (corre tudo: afinação, teste cego, exportações)
      python3 study.py --quick    (salta a afinação e usa as constantes FINAL abaixo)

Point-in-time: todas as features de um jogo usam apenas jogos anteriores (somas
exponenciais exclusivas; ratings de equipa/guarda-redes gravados ANTES de atualizar).
Afinação: épocas 2018-19 … 2023-24.  Teste cego: 2024-25, 2025-26, 2026-27 (até 18-11-2026).
"""
import json, math, sys, time, os
from collections import defaultdict
import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import gammaln, digamma

GAMES = '/home/claude/gi-build/games.json'
PBOX = '/home/claude/gi-data/pbox_{}.csv'
OUT = os.path.dirname(os.path.abspath(__file__))
TUNE = ['20182019', '20192020', '20202021', '20212022', '20222023', '20232024']
TEST = ['20242025', '20252026', '20262027']
EPS = 1e-12


def log(*a):
    print(*a, flush=True)


# ----------------------------------------------------------------------------------------------
# 1. Dados
# ----------------------------------------------------------------------------------------------
def load():
    games = json.load(open(GAMES))
    gidx = {g['id']: i for i, g in enumerate(games)}
    parts = []
    cols = ['home_away', 'team_abbrev', 'player_id', 'player_name', 'position', 'goals', 'assists',
            'points', 'power_play_goals', 'shots_on_goal', 'toi', 'game_id']
    for y in range(2016, 2028):
        d = pd.read_csv(PBOX.format(y), usecols=cols, dtype={'game_id': str, 'player_id': str})
        d = d[d['position'].isin(['C', 'L', 'R', 'D'])]
        parts.append(d)
    df = pd.concat(parts, ignore_index=True)
    df = df[df['game_id'].isin(gidx)].copy()
    t = df['toi'].fillna('0:00').str.split(':', expand=True)
    df['toi'] = t[0].astype(float) + t[1].astype(float) / 60
    df = df[df['toi'] > 0].copy()                        # só quem jogou
    df['gi'] = df['game_id'].map(gidx).astype(int)
    df['home'] = (df['home_away'] == 'home').astype(int)
    df['F'] = (df['position'] != 'D').astype(int)
    for c in ['goals', 'assists', 'points', 'power_play_goals', 'shots_on_goal']:
        df[c] = df[c].fillna(0).astype(int)
    g = pd.DataFrame(games)
    df['season'] = g['season'].values[df['gi']]
    df['type'] = g['type'].values[df['gi']]
    df['date'] = g['date'].values[df['gi']]
    df['day'] = (pd.to_datetime(df['date']) - pd.Timestamp('2015-01-01')).dt.days.astype(int)
    df['opp'] = np.where(df['home'] == 1, g['a'].values[df['gi']], g['h'].values[df['gi']])
    df = df.drop_duplicates(['player_id', 'game_id'])
    df = df.sort_values(['player_id', 'gi']).reset_index(drop=True)
    return games, df


# ----------------------------------------------------------------------------------------------
# 2. Equipas (ataque/defesa, golos e remates) e guarda-redes — online, point-in-time
# ----------------------------------------------------------------------------------------------
def nonso_goals(g):
    if g['so']:
        m = min(g['hg'], g['ag']); return m, m
    return g['hg'], g['ag']


def team_ratings(games, eta=0.04, reg=0.6, eta_s=0.05, reg_s=0.6):
    """Ratings multiplicativos (média 1). Guarda o estado ANTES de cada jogo.
    xG_casa = L*sqrt(HA)*att_casa*def_fora ; xG_fora = L/sqrt(HA)*att_fora*def_casa
    Atualização (EWMA ajustada ao adversário):  att += eta*(golos/(Lbase*def_adv) - att);  def += eta*(golos_sofridos/(Lbase*att_adv) - def)
    Na mudança de época: rating = 1 + reg*(rating-1)."""
    att = defaultdict(lambda: 1.0); de = defaultdict(lambda: 1.0)
    satt = defaultdict(lambda: 1.0); sde = defaultdict(lambda: 1.0)
    HG, AG, HS, AS = 3.0, 2.8, 31.0, 30.0
    last = {}
    rec = []
    season = None
    eL = 0.004
    for g in games:
        if g['season'] != season:
            season = g['season']
            for dct, r in ((att, reg), (de, reg), (satt, reg_s), (sde, reg_s)):
                for k in dct: dct[k] = 1 + r * (dct[k] - 1)
        h, a = g['h'], g['a']
        L = (HG + AG) / 2; HA = HG / AG; LS = (HS + AS) / 2; HAS = HS / AS
        d = pd.Timestamp(g['date']).toordinal()
        b2b_h = int(last.get(h, -9) == d - 1); b2b_a = int(last.get(a, -9) == d - 1)
        rec.append((att[h], de[h], att[a], de[a], satt[h], sde[h], satt[a], sde[a], L, HA, LS, HAS, b2b_h, b2b_a))
        last[h] = d; last[a] = d
        gh, ga = nonso_goals(g)
        Lh, La = L * math.sqrt(HA), L / math.sqrt(HA)
        ah, dh, aa, da = att[h], de[h], att[a], de[a]
        att[h] += eta * (gh / (Lh * da) - ah); de[a] += eta * (gh / (Lh * ah) - da)
        att[a] += eta * (ga / (La * dh) - aa); de[h] += eta * (ga / (La * aa) - dh)
        sh, sa = g['sh'].get('h'), g['sh'].get('a')
        if sh is not None and sa is not None and sh > 0 and sa > 0:
            Sh, Sa = LS * math.sqrt(HAS), LS / math.sqrt(HAS)
            ah, dh, aa, da = satt[h], sde[h], satt[a], sde[a]
            satt[h] += eta_s * (sh / (Sh * da) - ah); sde[a] += eta_s * (sh / (Sh * ah) - da)
            satt[a] += eta_s * (sa / (Sa * dh) - aa); sde[h] += eta_s * (sa / (Sa * aa) - dh)
            HS += eL * (sh - HS); AS += eL * (sa - AS)
        HG += eL * (gh - HG); AG += eL * (ga - AG)
    cols = ['att_h', 'def_h', 'att_a', 'def_a', 'satt_h', 'sdef_h', 'satt_a', 'sdef_a', 'L', 'HA', 'LS', 'HAS', 'b2b_h', 'b2b_a']
    out = pd.DataFrame(rec, columns=cols)
    # estado final (para exportar)
    final = {'att': dict(att), 'def': dict(de), 'satt': dict(satt), 'sdef': dict(sde),
             'L': (HG + AG) / 2, 'HA': HG / AG, 'LS': (HS + AS) / 2, 'HAS': HS / AS}
    return out, final


def team_loglik(games, tr, seasons, shots=False):
    """log-verosimilhança Poisson média (sem o termo factorial) dos golos (ou remates) por equipa-jogo."""
    m = np.array([g['season'] in seasons and (not shots or len(g['sh']) == 2) for g in games])
    if shots:
        gh = np.array([g['sh'].get('h', 0) for g in games]); ga = np.array([g['sh'].get('a', 0) for g in games])
        L, HA, a1, d1, a2, d2 = tr.LS, tr.HAS, tr.satt_h, tr.sdef_a, tr.satt_a, tr.sdef_h
    else:
        gh, ga = map(np.array, zip(*[nonso_goals(g) for g in games]))
        L, HA, a1, d1, a2, d2 = tr.L, tr.HA, tr.att_h, tr.def_a, tr.att_a, tr.def_h
    mh = (L * np.sqrt(HA) * a1 * d1).values; ma = (L / np.sqrt(HA) * a2 * d2).values
    ll = gh * np.log(mh) - mh + ga * np.log(ma) - ma
    return float(ll[m].mean())


def goalie_ratings(games, half=40, K=1500):
    """sv% encolhido do titular, por jogo, ANTES do jogo. Somas exponenciais por jogo do guarda-redes (meia-vida `half` jogos).
    sv_shr = (SVw + K*Lsv)/(SAw + K) ; factor_gr = (1-sv_shr)/(1-Lsv)"""
    d = 0.5 ** (1 / half) if half else 1.0
    SA = defaultdict(float); SV = defaultdict(float)
    Lsv = 0.905
    rec = []
    for g in games:
        row = {}
        for side in ('h', 'a'):
            gl = g['gk'].get(side, [])
            st = [x for x in gl if x['st']] or sorted(gl, key=lambda x: -x['toi'])[:1]
            if st:
                gid = st[0]['id']
                sv = (SV[gid] + K * Lsv) / (SA[gid] + K)
                row[side] = ((1 - sv) / (1 - Lsv), gid, sv, st[0]['sa'], st[0]['sv'])
            else:
                row[side] = (1.0, None, Lsv, 0, 0)
        rec.append((row['h'][0], row['a'][0], row['h'][2], row['a'][2], row['h'][3], row['h'][4], row['a'][3], row['a'][4], Lsv))
        for side in ('h', 'a'):
            for x in g['gk'].get(side, []):
                if x['sa'] > 0 or x['toi'] > 0:
                    SA[x['id']] = SA[x['id']] * d + x['sa']; SV[x['id']] = SV[x['id']] * d + x['sv']
            tsa = sum(x['sa'] for x in g['gk'].get(side, [])); tsv = sum(x['sv'] for x in g['gk'].get(side, []))
            if tsa > 0: Lsv += 0.002 * (tsv / tsa - Lsv)
    out = pd.DataFrame(rec, columns=['gkf_h', 'gkf_a', 'sv_h', 'sv_a', 'sa_h', 'svs_h', 'sa_a', 'svs_a', 'Lsv'])
    final = {'SA': dict(SA), 'SV': dict(SV), 'Lsv': Lsv}
    return out, final


def goalie_loglik(games, gr, seasons):
    """log-verosimilhança binomial média por remate do titular (só o que ele defendeu/sofreu)."""
    m = np.array([g['season'] in seasons for g in games])
    ll = 0; n = 0
    for s in ('h', 'a'):
        sa, sv, p = gr[f'sa_{s}'].values[m], gr[f'svs_{s}'].values[m], gr[f'sv_{s}'].values[m]
        ll += (sv * np.log(p) + (sa - sv) * np.log(1 - p)).sum(); n += sa.sum()
    return float(ll / n)


# ----------------------------------------------------------------------------------------------
# 3. Somas exponenciais exclusivas por jogador (point-in-time)
# ----------------------------------------------------------------------------------------------
def ewsum(df, cols, clock, H):
    """S_i = sum_{j<i, mesmo jogador} x_j * 0.5**((c_i - c_j)/H).  df ordenado por jogador, tempo."""
    pid = df['player_id'].values
    c0 = pd.Series(clock.values).groupby(pid).transform('min').values   # referência por jogador (estabilidade numérica)
    c = clock.values - c0
    e = np.exp2(c / H)
    res = {}
    tmp = pd.DataFrame({'p': pid})
    for col in cols:
        tmp[col] = df[col].values * e
    cs = tmp.groupby('p', sort=False)[list(cols)].cumsum()
    for col in cols:
        res[col] = (cs[col].values - tmp[col].values) / e
    return res


def add_clocks(df, goff):
    df['gnum'] = df.groupby('player_id').cumcount().astype(float)
    sidx = df['season'].str[:4].astype(int)
    df['sidx'] = sidx
    df['gclock'] = df['gnum'] + goff * (sidx - df.groupby('player_id')['sidx'].transform('min'))
    return df


def season_priors(df):
    """Priors por posição = médias da liga na época ANTERIOR (2015-16 usa-se a si própria; é só aquecimento)."""
    agg = df.groupby(['season', 'F']).agg(g=('goals', 'sum'), p=('points', 'sum'), s=('shots_on_goal', 'sum'),
                                          ppg=('power_play_goals', 'sum'), t=('toi', 'sum'), n=('toi', 'size'),
                                          g1=('goals', lambda x: (x > 0).mean()), p1=('points', lambda x: (x > 0).mean()),
                                          s2=('shots_on_goal', lambda x: (x >= 2).mean()), s3=('shots_on_goal', lambda x: (x >= 3).mean()),
                                          s4=('shots_on_goal', lambda x: (x >= 4).mean())).reset_index()
    agg['g60'] = agg.g / agg.t * 60; agg['p60'] = agg.p / agg.t * 60; agg['s60'] = agg.s / agg.t * 60
    agg['toi_avg'] = agg.t / agg.n
    agg['pp_share'] = agg.ppg / agg.g
    seasons = sorted(df['season'].unique())
    pri = {}
    for i, s in enumerate(seasons):
        src = seasons[i - 1] if i > 0 else s
        for f in (0, 1):
            pri[(s, f)] = agg[(agg.season == src) & (agg.F == f)].iloc[0].to_dict()
    return pri, agg


# ----------------------------------------------------------------------------------------------
# 4. Modelos: GLM cloglog (P(>=1)) e Poisson/NB (remates)
# ----------------------------------------------------------------------------------------------
def fit_cloglog(off, X, y, l2=1e-4):
    k = X.shape[1]
    def f(b):
        eta = np.clip(off + X @ b, -20, 5)
        lam = np.exp(eta)
        nll = np.where(y > 0, -np.log(-np.expm1(-lam) + EPS), lam)
        g = np.where(y > 0, -lam / np.expm1(lam).clip(EPS), lam)
        return nll.mean() + l2 * (b @ b), X.T @ g / len(y) + 2 * l2 * b
    r = minimize(f, np.zeros(k), jac=True, method='L-BFGS-B')
    return r.x


def pred_cloglog(off, X, b):
    return -np.expm1(-np.exp(np.clip(off + X @ b, -20, 5)))


def fit_count(off, X, y, nb=True):
    k = X.shape[1]
    def f(th):
        b = th[:k]; eta = np.clip(off + X @ b, -20, 5); mu = np.exp(eta)
        if not nb:
            ll = y * eta - mu - gammaln(y + 1)
            return -ll.mean(), -(X.T @ (y - mu)) / len(y)
        r = math.exp(th[k])
        ll = gammaln(y + r) - gammaln(r) - gammaln(y + 1) + r * np.log(r / (r + mu)) + y * np.log(mu / (r + mu))
        gb = X.T @ (r * (y - mu) / (mu + r))
        gr = (digamma(y + r) - digamma(r) + np.log(r / (r + mu)) + 1 - (r + y) / (r + mu)).sum() * r
        return -ll.mean(), -np.append(gb, gr) / len(y)
    th0 = np.zeros(k + (1 if nb else 0))
    if nb: th0[-1] = math.log(10)
    r = minimize(f, th0, jac=True, method='L-BFGS-B')
    return r.x[:k], (math.exp(r.x[k]) if nb else None)


def count_sf(mu, r, k):
    """P(X >= k) para Poisson (r=None) ou NB(média mu, tamanho r)."""
    from scipy.stats import poisson, nbinom
    if r is None: return poisson.sf(k - 1, mu)
    return nbinom.sf(k - 1, r, r / (r + mu))


def ll_bin(p, y):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))


def brier(p, y):
    return np.mean((p - y) ** 2)


# ----------------------------------------------------------------------------------------------
# 5. Features do jogador
# ----------------------------------------------------------------------------------------------
def build_context(df, games, tr, gr):
    gi = df['gi'].values; h = df['home'].values == 1
    T = tr.values; G = gr
    c = {}
    att_h, def_h, att_a, def_a = tr.att_h.values[gi], tr.def_h.values[gi], tr.att_a.values[gi], tr.def_a.values[gi]
    c['att_own'] = np.where(h, att_h, att_a); c['def_opp'] = np.where(h, def_a, def_h)
    c['satt_own'] = np.where(h, tr.satt_h.values[gi], tr.satt_a.values[gi]); c['sdef_opp'] = np.where(h, tr.sdef_a.values[gi], tr.sdef_h.values[gi])
    c['b2b_own'] = np.where(h, tr.b2b_h.values[gi], tr.b2b_a.values[gi]); c['b2b_opp'] = np.where(h, tr.b2b_a.values[gi], tr.b2b_h.values[gi])
    c['gk_opp'] = np.where(h, gr.gkf_a.values[gi], gr.gkf_h.values[gi])
    L, HA = tr.L.values[gi], tr.HA.values[gi]
    c['xg_rel'] = np.where(h, np.sqrt(HA), 1 / np.sqrt(HA)) * c['att_own'] * c['def_opp']
    c['ha'] = np.where(h, 0.5, -0.5)
    return c


def player_features(df, P, pri):
    """P: dicionário de hiperparâmetros. Devolve base lambdas (golos, pontos, remates) + ETOI."""
    F = df['F'].values
    sea = df['season'].values
    keyF = list(zip(sea, F))
    # priors por linha
    uniq = {k: pri[k] for k in set(keyF)}
    pg60 = np.array([uniq[k]['g60'] for k in keyF]); pp60 = np.array([uniq[k]['p60'] for k in keyF])
    ps60 = np.array([uniq[k]['s60'] for k in keyF]); ptoi = np.array([uniq[k]['toi_avg'] for k in keyF])
    # TOI esperado (relógio em jogos, sem penalização de defeso)
    tmp = df[['player_id']].copy(); tmp['one'] = 1.0; tmp['toi'] = df['toi'].values
    S = ewsum(df.assign(one=1.0), ['one', 'toi'], df['gnum'], P['H_toi'])
    etoi = (S['toi'] + P['k_toi'] * ptoi) / (S['one'] + P['k_toi'])
    out = {'etoi': etoi, 'ptoi': ptoi, 'n_toi': S['one']}
    if P['clock'] == 'day':
        clock = df['day']
    else:   # jogos do próprio jogador + goff jogos «fictícios» por cada mudança de época
        clock = (df['gnum'] + P['goff'] * (df['sidx'] - df.groupby('player_id')['sidx'].transform('min'))).rename('gclock')
    for m, col, prior, H, K in (('g', 'goals', pg60, P['H_g'], P['K_g']), ('p', 'points', pp60, P['H_p'], P['K_p']),
                                ('s', 'shots_on_goal', ps60, P['H_s'], P['K_s'])):
        S = ewsum(df, [col, 'toi'], clock, H)
        pr = prior * (etoi / ptoi) ** P['gam_' + m]
        rate = (S[col] + K * pr / 60) / (S['toi'] + K)     # por minuto
        out['r' + m] = rate * 60
        out['lam_' + m] = rate * etoi
        out['wtoi_' + m] = S['toi']
    # tendência da liga: taxa da liga (por posição) nos últimos dias (meia-vida H_trend dias) / taxa da liga com o mesmo kernel do jogador
    for m, col in (('g', 'goals'), ('p', 'points'), ('s', 'shots_on_goal')):
        out['lgt_' + m] = league_trend(df, col, P.get('H_trend', 30), P['H_' + m] if P['clock'] == 'day' else P['H_' + m] * 2.2)
    S = ewsum(df, ['power_play_goals', 'goals'], clock, P['H_g'])
    lpp = np.array([uniq[k]['pp_share'] for k in keyF])
    out['ppsh'] = (S['power_play_goals'] + 2 * lpp) / (S['goals'] + 2) - lpp
    return out


def league_trend_table(df, col, Hshort, Hlong):
    lg = df.groupby(['F', 'day'])[[col, 'toi']].sum().reset_index()
    res = {}
    for f in (0, 1):
        q = lg[lg.F == f].sort_values('day'); d = q['day'].values.astype(float); x = q[col].values; t = q['toi'].values
        r = []
        for H in (Hshort, Hlong):
            e = np.exp2((d - d[0]) / H)
            cx = np.cumsum(x * e) - x * e; ct = np.cumsum(t * e) - t * e
            r.append(np.where(ct > 0, cx / np.maximum(ct, 1e-9), np.nan))
        fac = np.clip(np.nan_to_num(r[0] / r[1], nan=1.0), 0.5, 2.0)
        res[f] = (d, fac, x, t)
    return res


def league_trend(df, col, Hshort, Hlong):
    tab = league_trend_table(df, col, Hshort, Hlong)
    out = np.ones(len(df))
    for f in (0, 1):
        d, fac, _, _ = tab[f]
        m = df['F'].values == f
        idx = np.searchsorted(d, df['day'].values[m])
        out[m] = fac[idx]
    return out


def league_trend_now(df, col, Hshort, Hlong, ref_day):
    """Valor do factor de tendência para jogos no dia ref_day (usa todos os dias < ref_day)."""
    tab = league_trend_table(df, col, Hshort, Hlong)
    out = {}
    for f in (0, 1):
        d, _, x, t = tab[f]
        v = []
        for H in (Hshort, Hlong):
            w = np.exp2(-(ref_day - d) / H); v.append((w * x).sum() / (w * t).sum())
        out['F' if f else 'D'] = float(np.clip(v[0] / v[1], 0.5, 2.0))
    return out


FEATS_G = ['lbase', 'def_opp', 'gk_opp', 'att_own', 'ha', 'b2b_own', 'b2b_opp']
FEATS_S = ['lbase', 'sdef_opp', 'satt_own', 'ha', 'b2b_own', 'b2b_opp']


def design(feat, ctx, m, feats):
    lb = np.log(np.clip(feat['lam_' + m], 1e-6, None))
    cols = []
    for f in feats:
        if f == 'lbase': cols.append(lb)
        elif f in ('def_opp', 'gk_opp', 'att_own', 'sdef_opp', 'satt_own', 'xg_rel'): cols.append(np.log(ctx[f]))
        elif f == 'ppsh': cols.append(feat['ppsh'])
        elif f == 'lgtrend': cols.append(np.log(feat['lgt_' + m]))
        else: cols.append(ctx[f].astype(float))
    X = np.column_stack([np.ones(len(lb))] + cols)
    return lb, X


# ----------------------------------------------------------------------------------------------
# 6. Avaliação
# ----------------------------------------------------------------------------------------------
def calib_table(p, y, bands=None):
    bands = bands or [0, .05, .1, .15, .2, .3, .4, .5, .6, .7, .8, .9, 1.0001]
    rows = []
    for lo, hi in zip(bands[:-1], bands[1:]):
        m = (p >= lo) & (p < hi)
        if m.sum() == 0: continue
        rows.append((f'{lo*100:.0f}-{min(hi,1)*100:.0f}%', int(m.sum()), float(p[m].mean()), float(y[m].mean())))
    return rows


def top_decile(p, y):
    thr = np.quantile(p, 0.9)
    m = p >= thr
    return float(y[m].mean()), float(p[m].mean()), float(y.mean())


def metrics(p, y):
    return {'logloss': float(ll_bin(p, y)), 'brier': float(brier(p, y)), 'n': int(len(y)),
            'rate': float(y.mean()), 'mean_p': float(p.mean()), 'top10': top_decile(p, y)}


def baselines(df, pri):
    """B1: taxa da época até à data (por jogo, +1 jogo fictício à média da posição), Poisson.
       B2: média da posição (frequência do evento na época anterior)."""
    out = {}
    sea = df['season'].values; F = df['F'].values
    keyF = list(zip(sea, F))
    tmp = df[['player_id', 'season', 'goals', 'points', 'shots_on_goal']].copy()
    gcum = tmp.groupby(['player_id', 'season'])
    gp = gcum.cumcount().values.astype(float)
    for m, col, k60 in (('g', 'goals', 'g60'), ('p', 'points', 'p60'), ('s', 'shots_on_goal', 's60')):
        prior_pg = np.array([pri[k][k60] * pri[k]['toi_avg'] / 60 for k in keyF])
        cs = gcum[col].cumsum().values - tmp[col].values
        out['b1_' + m] = (cs + prior_pg) / (gp + 1)
    for k1 in ('g1', 'p1', 's2', 's3', 's4'):
        out['b2_' + k1] = np.array([pri[k][k1] for k in keyF])
    return out


# ----------------------------------------------------------------------------------------------
# 7. Main
# ----------------------------------------------------------------------------------------------
DEFAULT = dict(H_trend=30, clock='day', goff=20, H_toi=8, k_toi=2, H_g=365, K_g=600, gam_g=0.5, H_p=365, K_p=400, gam_p=0.5,
               H_s=180, K_s=200, gam_s=0.3, eta=0.04, reg=0.6, eta_s=0.05, reg_s=0.6, gk_half=40, gk_K=1500)


def main():
    t0 = time.time()
    quick = '--quick' in sys.argv
    games, df = load()
    log(f'{len(games)} jogos, {len(df)} linhas de jogadores ({time.time()-t0:.0f}s)')
    P = dict(DEFAULT)
    if quick: P.update(FINAL)
    tune_s = set(TUNE)
    res = {'tuning': {}}
    # --- 7a. equipas
    if not quick:
        best = None
        for eta in (0.008, 0.012, 0.016, 0.02, 0.03):
            for reg in (0.5, 0.6, 0.7, 0.8):
                tr, _ = team_ratings(games, eta, reg)
                ll = team_loglik(games, tr, tune_s)
                if best is None or ll > best[0]: best = (ll, eta, reg)
        P['eta'], P['reg'] = best[1], best[2]
        log('equipas golos', best)
        # remates: afinar pelo loglik Poisson dos remates
        best = None
        for eta_s in (0.02, 0.03, 0.04, 0.06):
            for reg_s in (0.4, 0.6, 0.8):
                tr, _ = team_ratings(games, P['eta'], P['reg'], eta_s, reg_s)
                ll = team_loglik(games, tr, tune_s, shots=True)
                if best is None or ll > best[0]: best = (ll, eta_s, reg_s)
        P['eta_s'], P['reg_s'] = best[1], best[2]
        log('equipas remates', best)
        best = None
        for half in (10, 20, 40, 80, 160):
            for K in (500, 1000, 1500, 2500, 4000):
                gr, _ = goalie_ratings(games, half, K)
                ll = goalie_loglik(games, gr, tune_s)
                if best is None or ll > best[0]: best = (ll, half, K)
        P['gk_half'], P['gk_K'] = best[1], best[2]
        log('guarda-redes', best)
    tr, tfinal = team_ratings(games, P['eta'], P['reg'], P['eta_s'], P['reg_s'])
    gr, gfinal = goalie_ratings(games, P['gk_half'], P['gk_K'])
    res['team_ll_tune'] = team_loglik(games, tr, tune_s)
    # sanidade: ratings constantes (att=def=1) para comparar
    ctx = build_context(df, games, tr, gr)
    pri, pagg = season_priors(df)
    df = add_clocks(df, P['goff'])
    sea = df['season'].values
    mtune = np.isin(sea, TUNE); mtest = np.isin(sea, TEST)
    y = {'g': (df['goals'].values > 0).astype(float), 'p': (df['points'].values > 0).astype(float), 's': df['shots_on_goal'].values.astype(float)}

    def evaluate(P, feats_g=FEATS_G, feats_s=FEATS_S, nb=True, mask=mtune, ret=False):
        feat = player_features(df, P, pri)
        out = {}
        for m in ('g', 'p'):
            lb, X = design(feat, ctx, m, feats_g)
            b = fit_cloglog(np.zeros(len(lb))[mask], X[mask], y[m][mask])
            p = pred_cloglog(np.zeros(len(lb)), X, b)
            out[m] = (ll_bin(p[mask], y[m][mask]), b, p)
        lb, X = design(feat, ctx, 's', feats_s)
        b, r = fit_count(np.zeros(len(lb))[mask], X[mask], y['s'][mask], nb=nb)
        mu = np.exp(np.clip(X @ b, -20, 5))
        lls = 0
        ps = {}
        for k in (2, 3, 4):
            ps[k] = count_sf(mu, r, k)
            lls += ll_bin(ps[k][mask], (y['s'][mask] >= k).astype(float)) / 3
        out['s'] = (lls, b, ps, r, mu)
        return (out, feat) if ret else out

    # --- 7b. afinação jogador (descida coordenada, por mercado)
    grids = {
        'clock': ['day', 'game'], 'goff': [0, 10, 20, 40], 'H_toi': [2, 3, 5, 8, 12], 'k_toi': [0.25, 0.5, 1, 2],
        'H_g': [120, 240, 365, 540, 800, 1200], 'K_g': [150, 300, 600, 1000, 1600], 'gam_g': [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8],
        'H_p': [120, 240, 365, 540, 800, 1200], 'K_p': [100, 200, 400, 700, 1200], 'gam_p': [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8],
        'H_s': [60, 120, 180, 270, 400, 600], 'K_s': [50, 100, 200, 400, 800], 'gam_s': [0, 0.3, 0.6, 0.9],
    }
    gclock = {'H_g': [60, 90, 140, 200, 300, 450], 'H_p': [40, 60, 90, 140, 200], 'H_s': [20, 40, 60, 90, 140]}
    if not quick:
        trace = []
        def score(P):
            o = evaluate(P)
            return o['g'][0], o['p'][0], o['s'][0]
        cur = score(P)
        log('início', cur)
        for clock in ('day', 'game'):
            Q = dict(P); Q['clock'] = clock
            if clock == 'game':
                for k in gclock: Q[k] = 60 if k != 'H_s' else 40
            for rnd in range(2):
                for key in ['H_toi', 'k_toi', 'H_g', 'K_g', 'gam_g', 'H_p', 'K_p', 'gam_p', 'H_s', 'K_s', 'gam_s'] + (['goff'] if clock == 'game' else []):
                    grid = gclock[key] if (clock == 'game' and key in gclock) else grids[key]
                    m = {'g': 0, 'p': 1, 's': 2}.get(key[-1], None)
                    best = None
                    for v in grid:
                        R = dict(Q); R[key] = v
                        sc = score(R)
                        obj = sc[m] if m is not None else sum(sc)
                        if best is None or obj < best[0] - 1e-7: best = (obj, v, sc)
                    Q[key] = best[1]
                    trace.append((clock, rnd, key, best[1], best[2]))
                    log(clock, rnd, key, best[1], [round(x, 5) for x in best[2]])
            res['tuning'][clock] = {'P': Q, 'score': score(Q)}
        # escolher relógio por mercado não — um só relógio para simplicidade: o de menor soma
        sd, sg = res['tuning']['day']['score'], res['tuning']['game']['score']
        P = res['tuning']['day']['P'] if sum(sd) <= sum(sg) else res['tuning']['game']['P']
        res['tuning']['trace'] = trace
        log('relógio escolhido', P['clock'], sd, sg)
    else:
        P.update(FINAL)

    res['P'] = dict(P)
    log('P final', P)
    finish(games, df, P, pri, ctx, y, mtune, mtest, tfinal, gfinal, res, gr)


def finish(games, df, P, pri, ctx, y, mtune, mtest, tfinal, gfinal, res, gr):
    Y = truth(y)
    ntune = int(mtune.sum())
    cand = {'g': FEATS_G + ['ppsh', 'lgtrend'], 'p': FEATS_G + ['ppsh', 'lgtrend'], 's': FEATS_S + ['lgtrend']}
    mk = {'g': ['g1'], 'p': ['p1'], 's': ['s2', 's3', 's4']}

    def lls(pr, mask, m):
        return float(np.mean([ll_bin(pr[k][mask], Y[k][mask]) for k in mk[m]]))
    # --- 7c. testes de features: retirar cada uma (Δ logloss; >0 => a feature ajuda), afinação e cego
    full, _, _, _ = predictions(df, P, pri, ctx, y, mtune, cand)
    tests = {}
    for m in ('g', 'p', 's'):
        for f in cand[m][1:]:
            fe = dict(cand); fe[m] = [x for x in cand[m] if x != f]
            pr, _, _, _ = predictions(df, P, pri, ctx, y, mtune, fe)
            tests[f'{m}:{f}'] = {'afinacao': lls(pr, mtune, m) - lls(full, mtune, m), 'cego': lls(pr, mtest, m) - lls(full, mtest, m)}
            log('teste', m, f, tests[f'{m}:{f}'])
    # regra: manter se ajuda na afinação acima do limiar AIC (1 parâmetro => 1/N) E não piora o cego
    thr = 1.0 / ntune
    feats = {m: ['lbase'] + [f for f in cand[m][1:] if tests[f'{m}:{f}']['afinacao'] > thr and tests[f'{m}:{f}']['cego'] > 0] for m in cand}
    log('features escolhidas', feats)
    # variantes extra
    extra = {}
    pr_sel, _, _, _ = predictions(df, P, pri, ctx, y, mtune, feats)
    fe = dict(feats); fe['g'] = ['lbase', 'xg_rel'] + [f for f in feats['g'] if f in ('gk_opp', 'b2b_own', 'b2b_opp', 'ppsh')]
    fe['p'] = ['lbase', 'xg_rel'] + [f for f in feats['p'] if f in ('gk_opp', 'b2b_own', 'b2b_opp', 'ppsh')]
    pr, _, _, _ = predictions(df, P, pri, ctx, y, mtune, fe)
    extra['xG_equipa_relativo_em_vez_de_def+att+casa'] = {m: {'afinacao': lls(pr, mtune, m) - lls(pr_sel, mtune, m), 'cego': lls(pr, mtest, m) - lls(pr_sel, mtest, m)} for m in ('g', 'p')}
    pr, _, _, _ = predictions(df, P, pri, ctx, y, mtune, feats, nb=False)
    extra['remates_Poisson_em_vez_de_NB'] = {'afinacao': lls(pr, mtune, 's') - lls(pr_sel, mtune, 's'), 'cego': lls(pr, mtest, 's') - lls(pr_sel, mtest, 's')}
    pr, _, _, _ = predictions(df, P, pri, ctx, y, mtune, {'g': ['lbase'], 'p': ['lbase'], 's': ['lbase']})
    extra['sem_nenhum_ajuste_de_jogo'] = {m: {'afinacao': lls(pr, mtune, m) - lls(pr_sel, mtune, m), 'cego': lls(pr, mtest, m) - lls(pr_sel, mtest, m)} for m in ('g', 'p', 's')}
    log('extra', json.dumps(extra, indent=1))
    res['feature_tests'] = tests; res['extra_tests'] = extra; res['features'] = feats
    # --- 7d. avaliação cega final
    ev, pr, coefs, feat, mu = blind_eval(df, P, pri, ctx, y, mtune, mtest, feats)
    res['blind'] = ev
    res['coefs'] = {m: dict(zip(['const'] + feats[m], map(float, coefs[m]))) for m in ('g', 'p', 's')}
    res['nb_size'] = coefs['r']
    for nm in ('afinacao_2018-24', 'cego_total') + tuple(TEST):
        for k, lab in MARKETS:
            e = ev['by_set'][nm][k]
            log(f"{nm:16s} {k} modelo {e['modelo']['logloss']:.4f}/{e['modelo']['brier']:.4f} top10 {e['modelo']['top10'][0]:.3f} | "
                f"B1 {e['B1_epoca']['logloss']:.4f}/{e['B1_epoca']['brier']:.4f} | B2 {e['B2_posicao']['logloss']:.4f}/{e['B2_posicao']['brier']:.4f} | "
                f"B3 {e['B3_ult82']['logloss']:.4f} | taxa {e['modelo']['rate']:.3f} p̄ {e['modelo']['mean_p']:.3f}")
    for k, _ in MARKETS:
        log(k, [(b, n, round(pp, 3), round(a, 3)) for b, n, pp, a in ev['calib'][k]])
    # --- 7e. exportações
    last_date = games[-1]['date']
    ref_day = int((pd.Timestamp(last_date) - pd.Timestamp('2015-01-01')).days) + 1
    pri_now = {f: pri[('20262027', f)] for f in (0, 1)}
    seed = export_seed(df, P, pri_now, tfinal, gfinal, games, ref_day, last_date)
    Hl = lambda m: P['H_' + m] if P['clock'] == 'day' else P['H_' + m] * 2.2
    seed['league']['tendencia'] = {nm: {k: round(v, 4) for k, v in league_trend_now(df, col, P['H_trend'], Hl(m), ref_day).items()}
                                   for m, nm, col in (('g', 'golo_1mais', 'goals'), ('p', 'ponto_1mais', 'points'), ('s', 'remates', 'shots_on_goal'))}
    json.dump(seed, open(f'{OUT}/players_seed.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    write_formulas(P, feats, coefs, pri_now, seed, res)
    json.dump(res, open(f'{OUT}/results.json', 'w'), indent=1, default=float)
    log('feito. seed', os.path.getsize(f'{OUT}/players_seed.json'), 'bytes')


def rolling_baseline(df, pri, n=82):
    """B3: média por jogo nos últimos n jogos do jogador (+5 jogos fictícios à média da posição)."""
    keyF = list(zip(df['season'].values, df['F'].values))
    out = {}
    for m, col, k60 in (('g', 'goals', 'g60'), ('p', 'points', 'p60'), ('s', 'shots_on_goal', 's60')):
        prior_pg = np.array([pri[k][k60] * pri[k]['toi_avg'] / 60 for k in keyF])
        g = df.groupby('player_id', sort=False)[col]
        cs = g.cumsum().values - df[col].values
        cs_lag = g.shift(n).fillna(0).groupby(df['player_id'], sort=False).cumsum().values
        cnt = np.minimum(df['gnum'].values, n)
        out['b3_' + m] = (cs - cs_lag + 5 * prior_pg) / (cnt + 5)
    return out


MARKETS = [('g1', 'Marcador (golo >=1)'), ('p1', 'Ponto >=1'), ('s2', 'Remates +1.5'), ('s3', 'Remates +2.5'), ('s4', 'Remates +3.5')]


_FEAT_CACHE = {}


def predictions(df, P, pri, ctx, y, mfit, feats, nb=True):
    key = json.dumps(P, sort_keys=True)
    if key not in _FEAT_CACHE:
        _FEAT_CACHE.clear(); _FEAT_CACHE[key] = player_features(df, P, pri)
    feat = _FEAT_CACHE[key]
    pr = {}; coefs = {}
    for m in ('g', 'p'):
        lb, X = design(feat, ctx, m, feats[m])
        b = fit_cloglog(np.zeros(mfit.sum()), X[mfit], y[m][mfit])
        pr[m + '1'] = pred_cloglog(0, X, b); coefs[m] = b
    lb, X = design(feat, ctx, 's', feats['s'])
    b, r = fit_count(np.zeros(mfit.sum()), X[mfit], y['s'][mfit], nb=nb)
    mu = np.exp(np.clip(X @ b, -20, 5))
    for k in (2, 3, 4): pr[f's{k}'] = count_sf(mu, r, k)
    coefs['s'] = b; coefs['r'] = r
    return pr, coefs, feat, mu


def truth(y):
    return {'g1': y['g'], 'p1': y['p'], 's2': (y['s'] >= 2).astype(float), 's3': (y['s'] >= 3).astype(float), 's4': (y['s'] >= 4).astype(float)}


def base_probs(B):
    out = {}
    for nm in ('b1', 'b3'):
        out[nm] = {'g1': -np.expm1(-B[nm + '_g']), 'p1': -np.expm1(-B[nm + '_p'])}
        for k in (2, 3, 4): out[nm][f's{k}'] = count_sf(B[nm + '_s'], None, k)
    out['b2'] = {k: B['b2_' + k] for k in ('g1', 'p1', 's2', 's3', 's4')}
    return out


def blind_eval(df, P, pri, ctx, y, mtune, mtest, feats, nb=True):
    pr, coefs, feat, mu = predictions(df, P, pri, ctx, y, mtune, feats, nb)
    B = baselines(df, pri); B.update(rolling_baseline(df, pri))
    bp = base_probs(B)
    Y = truth(y)
    sea = df['season'].values
    out = {'by_set': {}, 'calib': {}}
    sets = [('afinacao_2018-24', mtune), ('cego_total', mtest)] + [(s, sea == s) for s in TEST]
    for nm, m in sets:
        out['by_set'][nm] = {}
        for k, _ in MARKETS:
            out['by_set'][nm][k] = {'modelo': metrics(pr[k][m], Y[k][m]),
                                    'B1_epoca': metrics(bp['b1'][k][m], Y[k][m]),
                                    'B2_posicao': metrics(bp['b2'][k][m], Y[k][m]),
                                    'B3_ult82': metrics(bp['b3'][k][m], Y[k][m])}
    for k, _ in MARKETS:
        out['calib'][k] = calib_table(pr[k][mtest], Y[k][mtest])
    return out, pr, coefs, feat, mu


def export_seed(df, P, pri_now, tfinal, gfinal, games, ref_day, ref_date):
    """Estado de cada jogador que jogou em 2025-26 ou 2026-27, pronto para o próximo jogo (dia de referência ref_day)."""
    keep = set(df.loc[df['season'].isin(['20252026', '20262027']), 'player_id'])
    sub = df[df['player_id'].isin(keep)]
    players = []
    for pid, d in sub.groupby('player_id', sort=False):
        last = d.iloc[-1]
        f = int(last['F'])
        pr = pri_now[f]
        n = d['gnum'].values
        w_t = 0.5 ** ((n[-1] + 1 - n) / P['H_toi'])
        etoi = ((w_t * d['toi'].values).sum() + P['k_toi'] * pr['toi_avg']) / (w_t.sum() + P['k_toi'])
        if P['clock'] == 'day':
            cref = ref_day; c = d['day'].values
        else:
            c = d['gnum'].values + P['goff'] * (d['sidx'].values - d['sidx'].values.min())
            cref = c[-1] + 1 + (P['goff'] if last['season'] != '20262027' else 0)
        row = {}
        for m, col, k60 in (('g', 'goals', 'g60'), ('p', 'points', 'p60'), ('s', 'shots_on_goal', 's60')):
            w = 0.5 ** ((cref - c) / P['H_' + m])
            K = P['K_' + m]
            prior = pr[k60] * (etoi / pr['toi_avg']) ** P['gam_' + m]
            wt = (w * d['toi'].values).sum()
            row[m] = ((w * d[col].values).sum() + K * prior / 60) / (wt + K) * 60
            row['wt_' + m] = wt
        wg = (0.5 ** ((cref - c) / P['H_g']))
        ppsh = ((wg * d['power_play_goals'].values).sum() + 2 * pr['pp_share']) / ((wg * d['goals'].values).sum() + 2)
        gp = int((d['season'] == '20262027').sum()); gp_prev = int((d['season'] == '20252026').sum())
        players.append([int(pid), last['player_name'], last['team_abbrev'], 'F' if f else 'D', gp, gp_prev,
                        round(float(etoi), 2), round(float(row['wt_g']), 0), round(float(row['g']), 3), round(float(row['p']), 3),
                        round(float(row['s']), 2), round(float(ppsh), 2), last['date']])
    players.sort(key=lambda r: (r[2], -r[6]))
    # equipas (ratings atuais, já com a regressão de época aplicada na época corrente)
    teams = sorted(set(df.loc[df['season'] == '20262027', 'team_abbrev']))
    T = {t: [round(tfinal['att'].get(t, 1), 3), round(tfinal['def'].get(t, 1), 3), round(tfinal['satt'].get(t, 1), 3), round(tfinal['sdef'].get(t, 1), 3)] for t in teams}
    # guarda-redes que jogaram em 2025-26/2026-27
    gk = {}
    for g in games:
        if g['season'] not in ('20252026', '20262027'): continue
        for side in ('h', 'a'):
            for x in g['gk'].get(side, []):
                if x['toi'] > 0:
                    gk[x['id']] = (x['n'], g[side], g['date'])
    G = []
    for gid, (nm, tm, dt) in gk.items():
        sa, sv = gfinal['SA'].get(gid, 0), gfinal['SV'].get(gid, 0)
        shr = (sv + P['gk_K'] * gfinal['Lsv']) / (sa + P['gk_K'])
        G.append([int(gid), nm, tm, round(shr, 4), round(sa, 0), dt])
    G.sort(key=lambda r: (r[2], r[1]))
    return {'as_of': ref_date,
            'players_cols': ['player_id', 'name', 'team', 'pos', 'gp_2026_27', 'gp_2025_26', 'toi_esperado_min', 'toi_ponderado_min',
                             'golos60', 'pontos60', 'remates60', 'pp_share', 'ultimo_jogo'],
            'players': players,
            'teams_cols': ['att', 'def', 'satt', 'sdef'], 'teams': T,
            'league': {'L_golos_equipa_jogo': round(tfinal['L'], 3), 'HA_golos': round(tfinal['HA'], 4),
                       'LS_remates_equipa_jogo': round(tfinal['LS'], 2), 'HA_remates': round(tfinal['HAS'], 4), 'Lsv': round(gfinal['Lsv'], 4)},
            'goalies_cols': ['goalie_id', 'name', 'team', 'sv_encolhido', 'remates_ponderados', 'ultimo_jogo'], 'goalies': G}


FEAT_DESC = {
    'lbase': 'ln(base) — base = (taxa por 60 encolhida / 60) × TOI esperado',
    'def_opp': 'ln(def do adversário) — rating defensivo de golos do adversário (1 = média; >1 sofre mais)',
    'gk_opp': 'ln(factor do guarda-redes titular adversário) = ln((1 − sv_encolhido)/(1 − Lsv))',
    'att_own': 'ln(att da própria equipa) — rating ofensivo de golos da equipa do jogador',
    'ha': '+0.5 se joga em casa, −0.5 se fora',
    'b2b_own': '1 se a equipa do jogador jogou no dia anterior',
    'b2b_opp': '1 se o adversário jogou no dia anterior',
    'ppsh': 'quota de golos em powerplay do jogador (encolhida) menos a média da liga',
    'sdef_opp': 'ln(sdef do adversário) — remates concedidos pelo adversário (1 = média)',
    'satt_own': 'ln(satt da própria equipa) — remates produzidos pela equipa (1 = média)',
    'xg_rel': 'ln(xG da equipa no jogo / média da liga)',
    'lgtrend': 'ln(tendência da liga) — taxa da liga (mesma posição) nos últimos ~30 dias a dividir pela taxa com a meia-vida do mercado; valor atual em players_seed.json → league.tendencia',
}


def write_formulas(P, feats, coefs, pri_now, seed, res):
    def pri(f):
        p = pri_now[f]
        return {'golos60': round(p['g60'], 4), 'pontos60': round(p['p60'], 4), 'remates60': round(p['s60'], 4),
                'toi_medio_min': round(p['toi_avg'], 3), 'pp_share': round(p['pp_share'], 4)}
    co = {}
    for m, nm in (('g', 'golo_1mais'), ('p', 'ponto_1mais'), ('s', 'remates')):
        co[nm] = {'const': round(float(coefs[m][0]), 5)}
        for f, b in zip(feats[m], coefs[m][1:]):
            co[nm][f] = round(float(b), 5)
    out = {
        'modelo': 'Mister Gi · NHL props de jogador (marcador, pontos, remates)',
        'dados_ate': seed['as_of'],
        'afinado_em': '2018-19 a 2023-24 (temporada regular + playoffs)',
        'teste_cego': '2024-25, 2025-26, 2026-27 até ' + seed['as_of'],
        'constantes': {
            'relogio_taxas': P['clock'] + (' (dias de calendário)' if P['clock'] == 'day' else ' (jogos do jogador + defeso)'),
            'meia_vida_golos': P['H_g'], 'meia_vida_pontos': P['H_p'], 'meia_vida_remates': P['H_s'],
            'unidade_meia_vida': 'dias' if P['clock'] == 'day' else 'jogos',
            'jogos_ficticios_defeso_goff': P['goff'] if P['clock'] == 'game' else None,
            'K_golos_min': P['K_g'], 'K_pontos_min': P['K_p'], 'K_remates_min': P['K_s'],
            'gama_golos': P['gam_g'], 'gama_pontos': P['gam_p'], 'gama_remates': P['gam_s'],
            'meia_vida_toi_jogos': P['H_toi'], 'k_toi_jogos': P['k_toi'],
            'equipas': {'eta_golos': P['eta'], 'regressao_epoca_golos': P['reg'], 'eta_remates': P['eta_s'], 'regressao_epoca_remates': P['reg_s']},
            'guarda_redes': {'meia_vida_jogos': P['gk_half'], 'K_remates': P['gk_K']},
            'nb_tamanho_r_remates': round(float(coefs['r']), 3) if coefs['r'] else None,
        },
        'priors_posicao_2026_27': {'F': pri(1), 'D': pri(0), 'nota': 'médias da liga em 2025-26 (época anterior); atualizar no início de cada época'},
        'coeficientes': co,
        'significado_features': {f: FEAT_DESC[f] for m in feats for f in feats[m]},
        'formulas_texto': [
            '1) TOI esperado (min) = (Σ w·TOI + k_toi·TOI_médio_posição) / (Σ w + k_toi), com w = 0.5^(jogos_atrás/meia_vida_toi); o jogo mais recente tem jogos_atrás = 1.',
            '2) Prior da posição para cada mercado: prior60 = média_liga60_posição × (TOI_esperado / TOI_médio_posição)^gama.',
            ('3) Taxa encolhida por 60 = (Σ w·eventos + K·prior60/60) / (Σ w·TOI + K) × 60, com ' +
             ('w = 0.5^(dias_atrás/meia_vida)' if P['clock'] == 'day' else
              f"w = 0.5^((jogos_atrás + {P['goff']}·mudanças_de_época_entre_esse_jogo_e_o_próximo)/meia_vida); o jogo mais recente tem jogos_atrás = 1") +
             ' (K = minutos de gelo «fictícios» jogados à taxa prior).'),
            ('3b) Tendência da liga (lgtrend) = taxa da liga por 60 (mesma posição) com meia-vida de ' + str(P['H_trend']) +
             ' dias ÷ a mesma taxa com meia-vida de ' + ('H dias' if P['clock'] == 'day' else '2.2×H dias (≈ H jogos)') +
             ' do mercado. Valor atual em players_seed.json → league.tendencia (recalcular quando se atualizar o seed).'),
            '4) base = taxa60/60 × TOI_esperado (eventos esperados no jogo antes de olhar ao adversário).',
            '5) η = const + Σ coef_i·feature_i (ver coeficientes; lbase = ln(base)).',
            '6) Golo/Ponto: λ = e^η ;  P(≥1) = 1 − e^(−λ).',
            '7) Remates: μ = e^η ; Binomial Negativa com tamanho r: p0 = (r/(r+μ))^r ; p(k+1) = p(k)·(k+r)/(k+1)·μ/(r+μ) ; P(+1.5) = 1−p0−p1 ; P(+2.5) = P(+1.5)−p2 ; P(+3.5) = P(+2.5)−p3.',
            '8) Equipas: xG_casa = L·√HA·att_casa·def_fora ; após cada jogo: att += eta·(golos/(L_lado·def_adv) − att) ; def_adv += eta·(golos/(L_lado·att) − def_adv) ; L_lado = L·√HA (casa) ou L/√HA (fora). No início de cada época: rating = 1 + regressão·(rating − 1). Remates: igual com satt/sdef, LS, HA_remates, eta_remates. Golos do desempate por penáltis não contam.',
            '9) Guarda-redes: sv_encolhido = (Σ w·defesas + K·Lsv)/(Σ w·remates + K), w = 0.5^(jogos_atrás/meia_vida). gk_opp = (1 − sv_encolhido)/(1 − Lsv) do titular adversário (confirmar titular antes do jogo).',
        ],
        'pseudocodigo_js': (
            "function probs(pl, own, opp, home, b2bOwn, b2bOpp, gkSv, C, S){\n"
            "  const lg=S.league, T=S.teams;\n"
            "  const f={def_opp:Math.log(T[opp][1]), att_own:Math.log(T[own][0]), sdef_opp:Math.log(T[opp][3]), satt_own:Math.log(T[own][2]),\n"
            "           gk_opp:Math.log((1-gkSv)/(1-lg.Lsv)), ha:home?0.5:-0.5, b2b_own:b2bOwn?1:0, b2b_opp:b2bOpp?1:0, ppsh:pl.pp_share-C.priors[pl.pos].pp_share};\n"
            "  const eta=(m,base)=>{let e=C.coef[m].const; for(const k in C.coef[m]){ if(k==='const')continue; e+=C.coef[m][k]*(k==='lbase'?Math.log(base):k==='lgtrend'?Math.log(lg.tendencia[m][pl.pos]):f[k]); } return e;};\n"
            "  const toi=pl.toi_esperado_min;\n"
            "  const lg1=Math.exp(eta('golo_1mais', pl.golos60/60*toi)), lp1=Math.exp(eta('ponto_1mais', pl.pontos60/60*toi));\n"
            "  const mu=Math.exp(eta('remates', pl.remates60/60*toi)), r=C.r;\n"
            "  let p=[Math.pow(r/(r+mu),r)]; for(let k=0;k<3;k++) p.push(p[k]*(k+r)/(k+1)*mu/(r+mu));\n"
            "  return {golo:1-Math.exp(-lg1), ponto:1-Math.exp(-lp1), rem15:1-p[0]-p[1], rem25:1-p[0]-p[1]-p[2], rem35:1-p[0]-p[1]-p[2]-p[3]};\n"
            "}"),
        'notas': [
            'As taxas em players_seed.json já vêm encolhidas e com TOI esperado calculado à data ' + seed['as_of'] + '.',
            'Se um guarda-redes titular não estiver na lista, usar gk_opp = 0 (factor 1).',
            'Equipa sem rating: usar 1.',
            'O modelo assume que o jogador joga; lesões/escolhas do treinador (scratches) não são previstas — confirmar o alinhamento.',
        ],
    }
    json.dump(out, open(f'{OUT}/formulas.json', 'w'), ensure_ascii=False, indent=1)


# constantes finais obtidas pela afinação completa (python3 study.py); usadas por --quick
FINAL = {"H_trend": 30, "clock": "game", "goff": 40, "H_toi": 3, "k_toi": 0.25, "H_g": 200, "K_g": 1000, "gam_g": 0.9, "H_p": 140, "K_p": 400, "gam_p": 0.9, "H_s": 60, "K_s": 200, "gam_s": 0, "eta": 0.012, "reg": 0.7, "eta_s": 0.03, "reg_s": 0.6, "gk_half": 40, "gk_K": 1000}

if __name__ == '__main__':
    main()
