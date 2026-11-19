# Mister Gi · estudos (NHL)

## Dados
- Calendários, box scores de equipas e jogadores da NHL (2015-16 → 2026-27, até 18/11/2026), dos ficheiros públicos do projeto SportsDataverse (`sportsdataverse-data`, a partir da API da NHL).
- 14.842 jogos. 21% acabam empatados aos 60 minutos (7% vão a penáltis).
- `build_games.py` junta tudo em `games.json` (não incluído: gera-se de novo com o script).

## Modelo (`model.py`)
Golos esperados aos 60 minutos, para cada lado:
`λ = média da liga × ataque × defesa do adversário × casa × guarda-redes do adversário × cansaço`
- **Ataque/defesa**: atualizados jogo a jogo, metade com os golos e metade com os remates × finalização média.
- **Guarda-redes**: defesas acima da média por remate, com mais peso nos recentes e encolhido.
- **Resultado**: Poisson + empates aos 60' um pouco mais frequentes (δ) + baliza deserta (ε).
- **Prolongamento**: 50% + κ × diferença de força.

Parâmetros finais (`params.json`): eta 0,026 · carry 0,8 · casa +7,8% · remates 60% · gk_k 3375 · back-to-back 8% · δ 0,25 · ε 0,24 · κ 0,6.

## Teste às cegas
Afinado em 2017-18 → 2022-23 (7.666 jogos), escolhido com 2023-24 e testado sem ver o futuro em 2024-25, 2025-26 e 2026-27.

| | log-loss vencedor | acerto | referência |
|---|---|---|---|
| Sempre a equipa da casa | 0,690 | 54% | |
| **Mister Gi** (2023-27) | **0,668** | **58%** | |
| Casa de apostas (214 jogos de 2026-27) | 0,661 | 59% | Gi nos mesmos jogos: 0,666 |

Mercados de 60 minutos bem calibrados (handicap −1,5: 73% previsto → 73% real; total 5,5: 62% → 60%).

### Cada peça, uma a uma (`ablation.json`, ganho no teste)
Todas ajudaram: remates (a maior), cansaço, casa, guarda-redes, empates extra (para o 1X2), baliza deserta (para handicap e totais), prolongamento pela força.

### Conclusão honesta
O Gi é bom (58%, calibrado), mas a casa de apostas acerta um pouco melhor sozinha: por isso a app junta as odds da ESPN com 85% de peso, e o valor a sério está em comparar a **odd justa** com a da Betano.

## Marcadores (`marcadores/`)
Golo, ponto e remates de cada jogador (taxas por 60 min encolhidas para a média da posição × minutos esperados, ajustadas à defesa do adversário, casa/fora, cansaço, power play e tendência da liga). Teste às cegas em 112.957 jogos de jogadores (2024-25 → 2026-27): melhor do que todas as referências simples em todos os mercados; golos e pontos calibrados a ±1 ponto; remates altos 2-4 pontos otimistas. O guarda-redes do adversário foi testado e não ajudou. Detalhes em `marcadores/README.md`.
