"""Junta calendário + box scores num ficheiro de jogos (2015-16 → 2026-27).
Tempo regulamentar: se algum guarda-redes tem decisão «O» (derrota no prolongamento/penáltis), o jogo empatou aos 60'.
"""
import csv, json, sys
from collections import defaultdict
D = '/home/claude/gi-data'
games = {}
for y in range(2016, 2028):
    for r in csv.DictReader(open(f'{D}/sched_{y}.csv')):
        if r['game_type'] not in ('R', 'P') or r['game_state'] not in ('OFF', 'FINAL'): continue
        games[r['game_id']] = {'id': r['game_id'], 'season': r['season_full'], 'type': r['game_type'], 'date': r['game_date'], 'time': r['game_time'],
                               'h': r['home_team_abbr'], 'a': r['away_team_abbr'], 'hg': int(r['home_score']), 'ag': int(r['away_score']),
                               'so': r['shootout'] == 'true', 'ot': False, 'gk': {}, 'sh': {}}
goalies = defaultdict(dict)
for y in range(2016, 2028):
    for r in csv.DictReader(open(f'{D}/pbox_{y}.csv')):
        g = games.get(r['game_id'])
        if not g: continue
        side = 'h' if r['home_away'] == 'home' else 'a'
        if r['position'] in ('G', '') and r['shots_against'] != '':
            if r['decision'] == 'O': g['ot'] = True
            try: sa, sv = int(float(r['shots_against'] or 0)), int(float(r['saves'] or 0))
            except: sa = sv = 0
            toi = r['toi'] or '0:00'; mm, ss = toi.split(':'); t = int(mm) + int(ss) / 60
            g['gk'].setdefault(side, []).append({'id': r['player_id'], 'n': r['player_name'], 'st': r['starter'] in ('True', 'true', '1', 'TRUE'), 'sa': sa, 'sv': sv, 'toi': round(t, 1), 'dec': r['decision']})
for y in range(2016, 2028):
    for r in csv.DictReader(open(f'{D}/tbox_{y}.csv')):
        g = games.get(r['game_id'])
        if g: g['sh']['h' if r['home_away'] == 'home' else 'a'] = int(float(r['shots_on_goal'] or 0))
out = sorted(games.values(), key=lambda g: (g['time'], g['id']))
bad = 0
for g in out:
    if g['so'] and not g['ot']: g['ot'] = True
    if g['ot']:
        m = min(g['hg'], g['ag']); g['rh'] = g['ra'] = m
        if abs(g['hg'] - g['ag']) != 1: bad += 1
    else:
        g['rh'], g['ra'] = g['hg'], g['ag']
json.dump(out, open('/home/claude/gi-build/games.json', 'w'))
from collections import Counter
print(len(out), 'jogos', Counter(g['season'] for g in out))
print('prolongamento', sum(g['ot'] for g in out) / len(out), 'penáltis', sum(g['so'] for g in out) / len(out), 'diferença≠1 em OT:', bad)
print('sem guarda-redes', sum(1 for g in out if len(g['gk']) < 2), 'sem remates', sum(1 for g in out if len(g['sh']) < 2))
