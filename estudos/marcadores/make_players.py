import json
S = json.load(open('scorers/players_seed.json')); F = json.load(open('scorers/formulas.json'))
C = {'coef': F['coeficientes'], 'r': F['constantes'].get('nb_tamanho_r_remates', 20), 'priors': F['priors_posicao_2026_27']}
S['C'] = C
json.dump(S, open('/home/claude/mister-gi/players.json', 'w'), separators=(',', ':'), ensure_ascii=False)
import os; print(os.path.getsize('/home/claude/mister-gi/players.json') // 1024, 'KB', len(S['players']), 'jogadores')
