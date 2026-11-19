"""Exporta o «seed» do Mister Gi: estado do modelo no fim dos dados (forças, guarda-redes, liga) + jogos da época atual."""
import json, math
from collections import defaultdict, Counter
from model import run, G
P = json.load(open('params.json')); P['delta'] = 0.25
json.dump(P, open('params.json', 'w'), indent=1)
st = {}; run(P, collect_from='2099', state=st)
NHL2ESPN = {'LAK': 'LA', 'NJD': 'NJ', 'SJS': 'SJ', 'TBL': 'TB', 'UTA': 'UTAH'}
cur = st['season']; CG = [g for g in G if g['season'] == cur]
teams = sorted({g['h'] for g in CG} | {g['a'] for g in CG})
# guarda-redes: nome, equipa atual, estado; titulares recentes por equipa
gk_info = {}; starts = defaultdict(list)
for g in G:
    if g['season'] < '20252026': continue
    for side in ('h', 'a'):
        t = g[side]
        for x in g['gk'].get(side, []):
            gk_info[x['id']] = (x['n'], t)
            if x['st']: starts[t].append((g['date'], x['id']))
lg = st['lg']
gks = {}
for gid, (n, t) in gk_info.items():
    s = st['GK'].get(gid, [0, 0])
    gks[gid] = [n, t, round(s[0], 2), round(s[1], 1)]
seed = {'v': 1, 'cut': max(g['date'] for g in G), 'season': cur, 'par': P, 'lg': {k: round(v, 5) for k, v in lg.items()},
        'map': NHL2ESPN,
        'teams': {t: [round(st['A'].get(t, 0), 4), round(st['D'].get(t, 0), 4), st['LAST'].get(t, '')] for t in teams},
        'gk': gks,
        'starts': {t: [gid for d, gid in sorted(v)[-20:]] for t, v in starts.items() if t in teams},
        'games': [[g['date'], g['time'][11:16], g['h'], g['a'], g['hg'], g['ag'], g['rh'], g['ra'], 1 if g['ot'] else 0, 1 if g['so'] else 0, g['sh'].get('h', 0), g['sh'].get('a', 0),
                   ([x['id'] for x in g['gk'].get('h', []) if x['st']] or [''])[0], ([x['id'] for x in g['gk'].get('a', []) if x['st']] or [''])[0]] for g in CG]}
json.dump(seed, open('seed.json', 'w'), separators=(',', ':'))
import os; print('seed.json', os.path.getsize('seed.json') // 1024, 'KB', 'equipas', len(teams), 'gr', len(gks), 'jogos', len(CG), 'corte', seed['cut'])
for t in sorted(teams, key=lambda t: -(st['A'].get(t, 0) + st['D'].get(t, 0)))[:5]: print(t, seed['teams'][t])
