# Mister Gi · Modelo de jogadores NHL (marcador, pontos, remates)

Dados até **18-11-2026**. Mercados: **Marcador a qualquer momento** (≥1 golo, tempo regulamentar + prolongamento; golos do desempate por penáltis **não contam**), **Ponto ≥1** (golo ou assistência) e **Remates à baliza +1.5 / +2.5 / +3.5**.

## 1. Em poucas palavras

Para cada jogador, o modelo responde: *«Se ele jogar hoje, qual a probabilidade de marcar / fazer um ponto / passar de X remates?»*

Faz isto em 5 passos simples:

1. **Quanto tempo vai jogar?** Média dos minutos (TOI) dos últimos jogos, com muito mais peso nos 3 ou 4 mais recentes (apanha logo uma subida ou descida de linha).
2. **Quão bom é a marcar / pontuar / rematar?** Golos, pontos e remates **por 60 minutos**, dando mais peso ao recente (golos: o peso cai para metade a cada 200 jogos; pontos: 140; remates: 60 — os remates são muito mais estáveis e "mudam" mais depressa). Na passagem de época, os jogos antigos perdem um pouco mais de peso.
3. **Não exagerar com amostras pequenas.** Cada taxa é "puxada" para a média da posição (avançado ou defesa) como se o jogador tivesse jogado mais alguns minutos à média (1000 min nos golos, 400 nos pontos, 200 nos remates). Quem joga mais minutos parte de uma média mais alta (os de 1.ª linha marcam mais por minuto).
4. **O jogo de hoje.** Ajusta pela defesa do adversário (golos/remates que costuma sofrer), jogar em casa (+7% golos/pontos, +4% remates), cansaço (equipa jogou ontem: −4 a −6%; adversário jogou ontem: +4 a +7%), papel no powerplay e uma pequena correção pela tendência recente da liga.
5. **Transforma em probabilidade.** Golos/pontos: P(≥1) = 1 − e^(−λ). Remates: distribuição Binomial Negativa (melhor do que Poisson — os remates variam mais do que o Poisson assume).

## 2. Funciona? (teste cego)

As constantes foram afinadas **só** em 2018-19 → 2023-24. Depois o modelo foi testado "às cegas" em **2024-25, 2025-26 e 2026-27 (até 18-11)**, jogo a jogo, usando **apenas informação anterior a cada jogo**. 112 957 participações de jogadores.

Comparámos com três atalhos "ingénuos":
- **B1 época** – a média do jogador nesta época até à data (por jogo);
- **B2 posição** – a percentagem média de todos os avançados/defesas (época anterior);
- **B3 últimos 82** – a média do jogador nos últimos 82 jogos (o atalho mais forte).

Como ler: **log-loss** e **Brier** medem o erro das probabilidades — **quanto mais baixo, melhor**. Diferenças de 1% já são relevantes neste tipo de mercado.

### 2.1 Resumo (cego total 2024-25 → 2026-27)

| Mercado | n | Taxa real | Log-loss modelo | B1 época | B2 posição | B3 últ. 82 | Brier modelo | Brier B1 | Brier B2 | Top 10% modelo (acerto) |
|---|---|---|---|---|---|---|---|---|---|---|
| Marcador (≥1 golo) | 112957 | 15.1% | **0.3895** | 0.4139 | 0.4102 | 0.3943 | **0.1190** | 0.1236 | 0.1248 | 34.3% (prev. 34.4%) |
| Ponto (≥1) | 112957 | 34.5% | **0.5895** | 0.6099 | 0.6387 | 0.5955 | **0.2016** | 0.2089 | 0.2235 | 64.9% (prev. 64.5%) |
| Remates +1.5 | 112957 | 42.8% | **0.6075** | 0.6256 | 0.6774 | 0.6148 | **0.2096** | 0.2170 | 0.2422 | 77.4% (prev. 77.5%) |
| Remates +2.5 | 112957 | 21.9% | **0.4545** | 0.4701 | 0.5205 | 0.4601 | **0.1463** | 0.1510 | 0.1694 | 55.2% (prev. 56.0%) |
| Remates +3.5 | 112957 | 10.2% | **0.2784** | 0.2891 | 0.3253 | 0.2822 | **0.0809** | 0.0830 | 0.0908 | 33.6% (prev. 35.6%) |

**Redução do log-loss do modelo face a cada atalho:**

| Mercado | vs B1 época | vs B2 posição | vs B3 últimos 82 |
|---|---|---|---|
| Marcador (≥1 golo) | −5.9% | −5.0% | −1.2% |
| Ponto (≥1) | −3.3% | −7.7% | −1.0% |
| Remates +1.5 | −2.9% | −10.3% | −1.2% |
| Remates +2.5 | −3.3% | −12.7% | −1.2% |
| Remates +3.5 | −3.7% | −14.4% | −1.3% |

**Média e top 10%:**

| Mercado | Taxa real | Média prevista | Top 10% previsto | Top 10% real | Lift |
|---|---|---|---|---|---|
| Marcador (≥1 golo) | 15.1% | 15.3% | 34.4% | 34.3% | ×2.27 |
| Ponto (≥1) | 34.5% | 34.8% | 64.5% | 64.9% | ×1.88 |
| Remates +1.5 | 42.8% | 43.0% | 77.5% | 77.4% | ×1.81 |
| Remates +2.5 | 21.9% | 21.8% | 56.0% | 55.2% | ×2.52 |
| Remates +3.5 | 10.2% | 10.2% | 35.6% | 33.6% | ×3.30 |

**Resultado:** o modelo ganha a **todos** os atalhos, em **todos** os mercados e em **todas** as épocas do teste cego. A vantagem sobre o atalho mais forte (últimos 82 jogos) é pequena mas consistente (~1–1.3% no log-loss); sobre "média da época" e "média da posição" é grande (3–14%).

**Top 10%:** entre os 10% de jogadores a que o modelo dá mais probabilidade, a taxa real de acerto foi ~2 a 3 vezes a média (ex.: marcador 34% vs 15% de base) — e muito perto do que o modelo previa (bem calibrado também no topo, exceto remates +3.5, onde o topo previsto 35.6% saiu 33.6%).

### 2.2 Por época (cego)

`*` 2026-27 só até 18-11-2026 (12 455 participações). A "média da época" (B1) é particularmente má no início de época, com poucos jogos.

| Mercado | Época | Log-loss modelo | B1 época | B2 posição | B3 últ. 82 | Brier modelo | Brier B1 | Brier B2 | Brier B3 |
|---|---|---|---|---|---|---|---|---|---|
| Marcador (≥1 golo) | 2024-25 | **0.3866** | 0.4089 | 0.4077 | 0.3914 | **0.1180** | 0.1221 | 0.1240 | 0.1192 |
| Marcador (≥1 golo) | 2025-26 | **0.3915** | 0.4129 | 0.4121 | 0.3959 | **0.1198** | 0.1236 | 0.1255 | 0.1207 |
| Marcador (≥1 golo) | 2026-27* | **0.3937** | 0.4375 | 0.4125 | 0.3992 | **0.1203** | 0.1294 | 0.1257 | 0.1217 |
| Ponto (≥1) | 2024-25 | **0.5880** | 0.6062 | 0.6365 | 0.5941 | **0.2009** | 0.2075 | 0.2225 | 0.2035 |
| Ponto (≥1) | 2025-26 | **0.5915** | 0.6086 | 0.6403 | 0.5970 | **0.2024** | 0.2084 | 0.2243 | 0.2046 |
| Ponto (≥1) | 2026-27* | **0.5879** | 0.6299 | 0.6405 | 0.5951 | **0.2009** | 0.2165 | 0.2244 | 0.2040 |
| Remates +1.5 | 2024-25 | **0.6101** | 0.6266 | 0.6802 | 0.6181 | **0.2108** | 0.2176 | 0.2436 | 0.2144 |
| Remates +1.5 | 2025-26 | **0.6051** | 0.6207 | 0.6756 | 0.6118 | **0.2086** | 0.2149 | 0.2414 | 0.2115 |
| Remates +1.5 | 2026-27* | **0.6065** | 0.6413 | 0.6729 | 0.6133 | **0.2093** | 0.2233 | 0.2400 | 0.2125 |
| Remates +2.5 | 2024-25 | **0.4594** | 0.4728 | 0.5261 | 0.4647 | **0.1483** | 0.1524 | 0.1718 | 0.1501 |
| Remates +2.5 | 2025-26 | **0.4514** | 0.4653 | 0.5173 | 0.4571 | **0.1451** | 0.1493 | 0.1681 | 0.1469 |
| Remates +2.5 | 2026-27* | **0.4467** | 0.4793 | 0.5108 | 0.4536 | **0.1429** | 0.1523 | 0.1655 | 0.1451 |
| Remates +3.5 | 2024-25 | **0.2827** | 0.2917 | 0.3304 | 0.2860 | **0.0824** | 0.0842 | 0.0925 | 0.0830 |
| Remates +3.5 | 2025-26 | **0.2769** | 0.2861 | 0.3237 | 0.2810 | **0.0806** | 0.0823 | 0.0904 | 0.0812 |
| Remates +3.5 | 2026-27* | **0.2670** | 0.2902 | 0.3108 | 0.2713 | **0.0765** | 0.0808 | 0.0859 | 0.0774 |

### 2.3 Calibração (cego total) — "quando diz 30%, acontece 30%?"

Sim, de forma geral. Golos e pontos estão calibrados em quase todas as bandas (diferenças ≤1 p.p. onde há volume). Nos remates, as faixas mais altas (≥60% em +2.5 e ≥30% em +3.5) estão **um pouco otimistas** (ex.: previsto 64% → real 62–63%; previsto 44% → real 41% em +3.5). Na app, convém tratar essas probabilidades altas de remates com 2–4 p.p. de desconto.

**Marcador (≥1 golo)**

| Banda | n | Prevista | Real |
|---|---|---|---|
| 0-5% | 14847 | 3.7% | 3.9% |
| 5-10% | 26062 | 7.4% | 7.1% |
| 10-15% | 22826 | 12.3% | 12.0% |
| 15-20% | 16713 | 17.4% | 16.9% |
| 20-30% | 22287 | 24.5% | 24.5% |
| 30-40% | 8934 | 33.7% | 33.7% |
| 40-50% | 1260 | 43.1% | 42.1% |
| 50-60% | 28 | 51.1% | 60.7% |

**Ponto (≥1)**

| Banda | n | Prevista | Real |
|---|---|---|---|
| 0-5% | 28 | 3.9% | 7.1% |
| 5-10% | 1102 | 8.5% | 10.8% |
| 10-15% | 6608 | 13.0% | 13.5% |
| 15-20% | 13377 | 17.7% | 17.4% |
| 20-30% | 29366 | 24.8% | 24.2% |
| 30-40% | 23484 | 34.8% | 33.9% |
| 40-50% | 17727 | 44.7% | 44.2% |
| 50-60% | 12880 | 54.8% | 55.1% |
| 60-70% | 6515 | 64.1% | 64.6% |
| 70-80% | 1580 | 73.9% | 74.2% |
| 80-90% | 290 | 82.7% | 82.8% |

**Remates +1.5**

| Banda | n | Prevista | Real |
|---|---|---|---|
| 0-5% | 42 | 4.0% | 7.1% |
| 5-10% | 668 | 8.3% | 7.6% |
| 10-15% | 3225 | 13.0% | 14.0% |
| 15-20% | 7124 | 17.7% | 18.2% |
| 20-30% | 22446 | 25.3% | 24.9% |
| 30-40% | 22194 | 34.8% | 34.4% |
| 40-50% | 17960 | 44.8% | 44.0% |
| 50-60% | 15480 | 54.9% | 54.9% |
| 60-70% | 12490 | 64.7% | 65.2% |
| 70-80% | 7878 | 74.5% | 74.8% |
| 80-90% | 3199 | 83.7% | 82.5% |
| 90-100% | 251 | 91.7% | 92.0% |

**Remates +2.5**

| Banda | n | Prevista | Real |
|---|---|---|---|
| 0-5% | 9467 | 3.5% | 3.7% |
| 5-10% | 22041 | 7.5% | 7.5% |
| 10-15% | 18606 | 12.4% | 12.5% |
| 15-20% | 13452 | 17.4% | 17.4% |
| 20-30% | 19166 | 24.7% | 24.9% |
| 30-40% | 13537 | 34.7% | 35.4% |
| 40-50% | 8588 | 44.6% | 44.2% |
| 50-60% | 4968 | 54.5% | 54.3% |
| 60-70% | 2358 | 64.1% | 62.5% |
| 70-80% | 687 | 73.8% | 69.4% |
| 80-90% | 87 | 82.5% | 78.2% |

**Remates +3.5**

| Banda | n | Prevista | Real |
|---|---|---|---|
| 0-5% | 50401 | 2.4% | 2.5% |
| 5-10% | 22544 | 7.2% | 7.3% |
| 10-15% | 13026 | 12.3% | 12.7% |
| 15-20% | 9049 | 17.3% | 17.3% |
| 20-30% | 10280 | 24.4% | 24.3% |
| 30-40% | 4783 | 34.4% | 33.0% |
| 40-50% | 2043 | 44.1% | 40.8% |
| 50-60% | 654 | 54.1% | 50.6% |
| 60-70% | 163 | 63.7% | 53.4% |
| 70-80% | 14 | 73.0% | 64.3% |

## 3. O que testámos e o que ficou (ou não)

Cada fator foi testado retirando-o do modelo; manteve-se só o que ajudou na afinação (2018-24) **e** não piorou o teste cego.

| Fator | Golos | Pontos | Remates | Decisão |
|---|---|---|---|---|
| Defesa do adversário (rating de golos / remates sofridos) | ajuda muito | ajuda muito | ajuda muito (o fator mais forte) | **fica** |
| Jogar em casa | ajuda (+7%) | ajuda (+7%) | ajuda (+4%) | **fica** — o fator casa conta mesmo a nível individual |
| Equipa do jogador jogou ontem (back-to-back) | ajuda (−4%) | ajuda (−6%) | ajuda (−2%) | **fica** |
| Adversário jogou ontem | não ajuda no cego | ajuda (+7%) | ajuda (+4%) | fica em pontos e remates |
| Quota de golos em powerplay do jogador | ajuda | ajuda | — | **fica** (quem marca muito em PP tem um extra) |
| Tendência recente da liga (últimos ~30 dias) | ajuda pouco | ajuda pouco | ajuda (corrige a descida de remates da liga em 2024-25) | **fica** |
| Ataque da própria equipa | ajuda na afinação, **piora no cego** | idem | ajuda muito pouco | só fica em remates |
| **Guarda-redes titular adversário (% defesas, encolhida)** | **não ajuda** | **não ajuda** | — | **fora** — a % de defesas é demasiado aleatória e a qualidade do guarda-redes já está dentro da "defesa do adversário" |
| "xG da equipa no jogo / média" como fator único (em vez de defesa adv. + casa) | pior | pior | — | fora |
| Remates com Poisson em vez de Binomial Negativa | — | — | pior | **Binomial Negativa** (r ≈ 19.5) |
| Relógio de pesos em dias vs em jogos | igual (diferença <0.0001) | igual | igual | jogos (mais fácil de explicar) |

Sem nenhum ajuste de jogo (só taxa do jogador × minutos), o log-loss cego piora 0.0007 (golos), 0.0015 (pontos) e 0.0014 (remates) — os ajustes valem a pena, mas **o grosso do valor está na taxa do jogador e nos minutos**.

Afinar as constantes (meias-vidas, encolhimento) fez pouca diferença (<0.001): o modelo é robusto a estas escolhas.

## 4. Limitações (ler!)

- **Alinhamentos:** o modelo assume que o jogador **joga**. Não sabe de lesões, castigos ou "healthy scratches". No teste só entraram jogadores que efetivamente jogaram — na app, **confirme o alinhamento** antes de olhar para a probabilidade. (As casas costumam anular a aposta se o jogador não jogar, mas confirme as regras da Betano.)
- **Minutos inesperados:** lesão a meio do jogo, expulsão, mudança de linha ou de unidade de powerplay — o modelo só vê o histórico.
- **Guarda-redes:** não entra na fórmula (não ajudou). Se o adversário pôr um 3.º guarda-redes muito fraco, o modelo não sabe.
- **Transferências:** a taxa do jogador viaja com ele; o novo contexto (linha, PP) só aparece com os jogos.
- **Estreantes / poucos jogos:** dependem sobretudo da média da posição e dos minutos.
- **Não testámos contra as odds.** Ganhar aos atalhos ingénuos **não** garante lucro contra a margem da casa (nos props de jogador a margem costuma ser alta). Use as probabilidades para comparar com a probabilidade implícita da odd (1/odd) e só considere quando a diferença for clara.
- **Dados estáticos:** `players_seed.json` é uma fotografia a 18-11-2026. Para atualizar, volte a correr `study.py` com dados novos (as taxas mudam devagar; os minutos mudam depressa).
- Inclui temporada regular e playoffs; os playoffs foram tratados como jogos normais.

## 5. Ficheiros

| Ficheiro | Conteúdo |
|---|---|
| `formulas.json` | Todas as constantes, coeficientes, priors por posição, fórmulas em texto e pseudo-código JavaScript (testado em Node: dá os mesmos números do Python). |
| `players_seed.json` | 995 jogadores (jogaram em 2025-26 ou 2026-27): `[id, nome, equipa, F/D, jogos 26-27, jogos 25-26, TOI esperado, TOI ponderado (tamanho da amostra), golos/60, pontos/60, remates/60 (já encolhidos), quota PP, último jogo]` + ratings das 32 equipas `[att, def, satt, sdef]` + constantes da liga (tendência atual) + guarda-redes (só informativo). ~92 KB. |
| `results.json` | Todos os números do estudo (afinação, testes de fatores, tabelas cegas, calibração, coeficientes). |
| `study.py` | Script reprodutível. `python3 study.py` (afinação completa, ~30 min) ou `python3 study.py --quick` (usa as constantes finais, ~1 min). |

## 6. Secção técnica

**Dados.** 534 207 participações de patinadores (TOI>0), 2015-16 → 2026-27, épocas regulares e playoffs. 2015-16 a 2017-18 servem só de aquecimento.

**Estado do jogador (point-in-time).** Somas exponenciais exclusivas (só jogos anteriores) com relógio em jogos do próprio jogador: peso w = 0.5^((jogos_atrás + 40·nº_mudanças_de_época)/H).
- TOI esperado: H_toi = 3 jogos, prior k_toi = 0.25 jogos ao TOI médio da posição.
- Taxa por minuto do mercado m: r = (Σw·x + K·prior60/60)/(Σw·TOI + K); H_golos = 200, H_pontos = 140, H_remates = 60 jogos; K_golos = 1000, K_pontos = 400, K_remates = 200 minutos.
- prior60 = média60 da posição na época anterior × (TOI_esp/TOI_médio_posição)^γ, γ_golos = 0.9, γ_pontos = 0.9, γ_remates = 0.
- Priors 2026-27 (médias 2025-26): F golos60 0.863, pontos60 2.043, remates60 6.669, TOI 15.18; D 0.239 / 1.073 / 3.939 / 19.36.
- base = r × TOI_esp.

**Equipas.** Ratings multiplicativos online (média 1), EWMA ajustado ao adversário: xG_casa = L·√HA·att_casa·def_fora; att += η(golos/(L_lado·def_adv) − att), def_adv += η(golos/(L_lado·att) − def_adv); η_golos = 0.012, regressão de época 0.7; remates η = 0.03, regressão 0.6. L e HA são médias móveis da liga. Golos de shootout excluídos. (Log-verosimilhança Poisson dos golos de equipa no cego: 0.737 vs 0.717 com ratings constantes.)

**Guarda-redes.** sv% encolhido = (Σw·defesas + 1000·Lsv)/(Σw·remates + 1000), meia-vida 40 jogos (afinado por verosimilhança binomial). Ganho quase nulo mesmo a prever o próprio sv% (−0.30765 vs −0.30781 por remate) e nulo no modelo de jogador → retirado.

**Ligação.** Golos e pontos: GLM binário com ligação cloglog (equivale exatamente a Poisson P(≥1) = 1 − e^(−λ), com log λ linear), ajustado por máxima verosimilhança em 2018-24:

- golo: η = 0.0293 + 1.0282·ln(base) + 0.9065·ln(def_adv) + 0.0704·casa(±0.5) − 0.0398·b2b_própria + 0.3782·(quota_PP − média) + 0.1395·ln(tendência)
- ponto: η = 0.0265 + 1.0643·ln(base) + 1.0545·ln(def_adv) + 0.0685·casa − 0.0583·b2b_própria + 0.0724·b2b_adv + 0.1812·(quota_PP − média) + 0.2272·ln(tendência)
- remates (NB2, r = 19.50): ln μ = −0.0887 + 1.1128·ln(base) + 0.9872·ln(sdef_adv) + 0.0973·ln(satt_própria) + 0.0382·casa − 0.0167·b2b_própria + 0.0374·b2b_adv + 0.6947·ln(tendência)

Os coeficientes de ln(base) > 1 indicam que o encolhimento é ligeiramente conservador; o GLM corrige isso.

**Afinação.** Descida coordenada (2 voltas) sobre meias-vidas, K, γ, TOI e goff, para os dois relógios (dias vs jogos), minimizando log-loss médio em 2018-24 (para remates, média dos três limiares). A seleção de fatores usou o critério "Δ log-loss na afinação > 1/N (AIC) **e** Δ no cego > 0" — ou seja, o teste cego foi usado apenas para decidir incluir/excluir 8 fatores binários, conforme pedido; tudo o resto (constantes e coeficientes) foi congelado antes do cego.

**Baselines.** B1: (soma na época + média por jogo da posição)/(jogos na época + 1), Poisson. B2: frequência do evento por posição na época anterior. B3: média por jogo nos últimos 82 jogos (+5 jogos fictícios à média da posição), Poisson.

### Tabelas completas (inclui afinação 2018-24, dentro da amostra)

##### cego_total

| Mercado | n | Taxa real | Log-loss modelo | B1 época | B2 posição | B3 últ. 82 | Brier modelo | Brier B1 | Brier B2 | Top 10% modelo (acerto) |
|---|---|---|---|---|---|---|---|---|---|---|
| Marcador (≥1 golo) | 112957 | 15.1% | **0.3895** | 0.4139 | 0.4102 | 0.3943 | **0.1190** | 0.1236 | 0.1248 | 34.3% (prev. 34.4%) |
| Ponto (≥1) | 112957 | 34.5% | **0.5895** | 0.6099 | 0.6387 | 0.5955 | **0.2016** | 0.2089 | 0.2235 | 64.9% (prev. 64.5%) |
| Remates +1.5 | 112957 | 42.8% | **0.6075** | 0.6256 | 0.6774 | 0.6148 | **0.2096** | 0.2170 | 0.2422 | 77.4% (prev. 77.5%) |
| Remates +2.5 | 112957 | 21.9% | **0.4545** | 0.4701 | 0.5205 | 0.4601 | **0.1463** | 0.1510 | 0.1694 | 55.2% (prev. 56.0%) |
| Remates +3.5 | 112957 | 10.2% | **0.2784** | 0.2891 | 0.3253 | 0.2822 | **0.0809** | 0.0830 | 0.0908 | 33.6% (prev. 35.6%) |

##### 20242025

| Mercado | n | Taxa real | Log-loss modelo | B1 época | B2 posição | B3 últ. 82 | Brier modelo | Brier B1 | Brier B2 | Top 10% modelo (acerto) |
|---|---|---|---|---|---|---|---|---|---|---|
| Marcador (≥1 golo) | 50320 | 15.0% | **0.3866** | 0.4089 | 0.4077 | 0.3914 | **0.1180** | 0.1221 | 0.1240 | 34.2% (prev. 34.3%) |
| Ponto (≥1) | 50320 | 34.2% | **0.5880** | 0.6062 | 0.6365 | 0.5941 | **0.2009** | 0.2075 | 0.2225 | 64.4% (prev. 64.2%) |
| Remates +1.5 | 50320 | 43.3% | **0.6101** | 0.6266 | 0.6802 | 0.6181 | **0.2108** | 0.2176 | 0.2436 | 76.9% (prev. 78.1%) |
| Remates +2.5 | 50320 | 22.2% | **0.4594** | 0.4728 | 0.5261 | 0.4647 | **0.1483** | 0.1524 | 0.1718 | 54.9% (prev. 56.9%) |
| Remates +3.5 | 50320 | 10.3% | **0.2827** | 0.2917 | 0.3304 | 0.2860 | **0.0824** | 0.0842 | 0.0925 | 33.3% (prev. 36.5%) |

##### 20252026

| Mercado | n | Taxa real | Log-loss modelo | B1 época | B2 posição | B3 últ. 82 | Brier modelo | Brier B1 | Brier B2 | Top 10% modelo (acerto) |
|---|---|---|---|---|---|---|---|---|---|---|
| Marcador (≥1 golo) | 50182 | 15.2% | **0.3915** | 0.4129 | 0.4121 | 0.3959 | **0.1198** | 0.1236 | 0.1255 | 34.3% (prev. 34.4%) |
| Ponto (≥1) | 50182 | 34.7% | **0.5915** | 0.6086 | 0.6403 | 0.5970 | **0.2024** | 0.2084 | 0.2243 | 64.5% (prev. 64.6%) |
| Remates +1.5 | 50182 | 42.5% | **0.6051** | 0.6207 | 0.6756 | 0.6118 | **0.2086** | 0.2149 | 0.2414 | 77.3% (prev. 77.1%) |
| Remates +2.5 | 50182 | 21.7% | **0.4514** | 0.4653 | 0.5173 | 0.4571 | **0.1451** | 0.1493 | 0.1681 | 55.2% (prev. 55.4%) |
| Remates +3.5 | 50182 | 10.1% | **0.2769** | 0.2861 | 0.3237 | 0.2810 | **0.0806** | 0.0823 | 0.0904 | 33.8% (prev. 35.0%) |

##### 20262027

| Mercado | n | Taxa real | Log-loss modelo | B1 época | B2 posição | B3 últ. 82 | Brier modelo | Brier B1 | Brier B2 | Top 10% modelo (acerto) |
|---|---|---|---|---|---|---|---|---|---|---|
| Marcador (≥1 golo) | 12455 | 15.2% | **0.3937** | 0.4375 | 0.4125 | 0.3992 | **0.1203** | 0.1294 | 0.1257 | 34.3% (prev. 34.8%) |
| Ponto (≥1) | 12455 | 34.9% | **0.5879** | 0.6299 | 0.6405 | 0.5951 | **0.2009** | 0.2165 | 0.2244 | 68.1% (prev. 65.7%) |
| Remates +1.5 | 12455 | 41.9% | **0.6065** | 0.6413 | 0.6729 | 0.6133 | **0.2093** | 0.2233 | 0.2400 | 79.0% (prev. 76.4%) |
| Remates +2.5 | 12455 | 21.4% | **0.4467** | 0.4793 | 0.5108 | 0.4536 | **0.1429** | 0.1523 | 0.1655 | 55.6% (prev. 54.4%) |
| Remates +3.5 | 12455 | 9.6% | **0.2670** | 0.2902 | 0.3108 | 0.2713 | **0.0765** | 0.0808 | 0.0859 | 33.1% (prev. 34.0%) |

##### afinacao_2018-24

| Mercado | n | Taxa real | Log-loss modelo | B1 época | B2 posição | B3 últ. 82 | Brier modelo | Brier B1 | Brier B2 | Top 10% modelo (acerto) |
|---|---|---|---|---|---|---|---|---|---|---|
| Marcador (≥1 golo) | 277511 | 14.9% | **0.3882** | 0.4109 | 0.4075 | 0.3930 | **0.1183** | 0.1223 | 0.1238 | 34.5% (prev. 33.7%) |
| Ponto (≥1) | 277511 | 34.3% | **0.5911** | 0.6097 | 0.6377 | 0.5968 | **0.2022** | 0.2087 | 0.2230 | 64.1% (prev. 63.6%) |
| Remates +1.5 | 277511 | 47.6% | **0.6176** | 0.6330 | 0.6871 | 0.6245 | **0.2144** | 0.2208 | 0.2470 | 81.2% (prev. 80.3%) |
| Remates +2.5 | 277511 | 25.8% | **0.4977** | 0.5119 | 0.5662 | 0.5038 | **0.1634** | 0.1679 | 0.1897 | 60.7% (prev. 60.1%) |
| Remates +3.5 | 277511 | 12.6% | **0.3225** | 0.3330 | 0.3750 | 0.3270 | **0.0963** | 0.0986 | 0.1094 | 39.6% (prev. 39.8%) |
