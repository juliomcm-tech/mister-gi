/* =====================================================================
   4) MARCADORES (estudo dos jogadores, testado às cegas)
   Para cada jogador: golos, pontos e remates por 60 min (encolhidos para a média
   da posição), minutos em gelo esperados, e o jogo: defesa do adversário,
   guarda-redes do adversário, casa/fora, cansaço, papel no power play.
   λ = e^(soma) → P(marca) = 1 − e^(−λ).  Remates: binomial negativa.
   Os números vêm de players.json (gerado pelo estudo, até à véspera da publicação).
   ===================================================================== */
let PLAYERS = null, PROPS = objOr(LS.get('props', {}));
function loadPlayers() {
  fetch('players.json').then(r => r.json()).then(j => {
    if (!j || !j.players) { PLAYERS = { list: [] }; return render(); }
    const ix = n => j.players_cols.indexOf(n);
    const L = j.players.map(r => ({ id: r[ix('player_id')], n: r[ix('name')], t: nhlAb(r[ix('team')]) || r[ix('team')], pos: r[ix('pos')], gp: r[ix('gp_2026_27')] || 0, toi: r[ix('toi_esperado_min')], g60: r[ix('golos60')], p60: r[ix('pontos60')], s60: r[ix('remates60')], pp: r[ix('pp_share')], last: r[ix('ultimo_jogo')] }));
    const gi = n => j.goalies_cols.indexOf(n), GK = {};
    (j.goalies || []).forEach(r => { GK[gkKey(r[gi('name')])] = r[gi('sv_encolhido')]; });
    PLAYERS = { list: L, T: j.teams, lg: j.league, C: j.C, GK };
    render();
  }).catch(() => { PLAYERS = { list: [] }; render(); });
}
function propCalc(pl, g) {
  const S = PLAYERS, C = S.C; if (!C) return null;
  const own = pl.t, opp = own === g.h ? g.a : g.h, home = own === g.h;
  const T = t => S.T[t] || [1, 1, 1, 1];
  const P = predict(g), oppGk = home ? P.ga.k : P.gh.k, sv = S.GK[oppGk];
  const M = getModel(), rest = t => restDays(M, t, g);
  const f = {
    def_opp: Math.log(T(opp)[1]), att_own: Math.log(T(own)[0]), sdef_opp: Math.log(T(opp)[3]), satt_own: Math.log(T(own)[2]),
    gk_opp: sv ? Math.log((1 - sv) / (1 - S.lg.Lsv)) : 0, ha: home ? 0.5 : -0.5,
    b2b_own: rest(own) === 1 ? 1 : 0, b2b_opp: rest(opp) === 1 ? 1 : 0, ppsh: pl.pp - ((C.priors[pl.pos] || {}).pp_share || 0.2)
  };
  const eta = (m, base) => {
    const co = C.coef[m]; if (!co) return null; let e = co.const || 0;
    for (const k in co) { if (k === 'const') continue; const v = k === 'lbase' ? Math.log(Math.max(1e-6, base)) : k === 'lgtrend' ? Math.log(((S.lg.tendencia || {})[m] || {})[pl.pos] || 1) : f[k]; e += co[k] * (v || 0); }
    return e;
  };
  const lg1 = Math.exp(eta('golo_1mais', pl.g60 / 60 * pl.toi)), lp1 = Math.exp(eta('ponto_1mais', pl.p60 / 60 * pl.toi));
  const mu = Math.exp(eta('remates', pl.s60 / 60 * pl.toi)), r = C.r || 20;
  const p = [Math.pow(r / (r + mu), r)]; for (let k = 0; k < 3; k++) p.push(p[k] * (k + r) / (k + 1) * mu / (r + mu));
  return { p: 1 - Math.exp(-lg1), pp: 1 - Math.exp(-lp1), ps2: 1 - p[0] - p[1], ps3: 1 - p[0] - p[1] - p[2], ps4: 1 - p[0] - p[1] - p[2] - p[3], mu };
}
const PROPC = new Map();
function gamePlayers(g) {
  if (!PLAYERS || !PLAYERS.list.length) return [];
  const cut = SEED ? ymdAdd(SEED.cut.replace(/-/g, ''), -21) : '0';
  const key = g.id + '|' + (predict(g).gh.k) + '|' + (predict(g).ga.k);
  const hit = PROPC.get(g.id); if (hit && hit.k === key) return hit.L;
  const L = PLAYERS.list.filter(pl => (pl.t === g.h || pl.t === g.a) && String(pl.last || '').replace(/-/g, '') >= cut && pl.toi >= 8)
    .map(pl => Object.assign({ g }, pl, propCalc(pl, g))).filter(x => x.p != null && isFinite(x.p)).sort((a, b) => b.p - a.p);
  PROPC.set(g.id, { k: key, L });
  return L;
}
/* destaques: os mais prováveis de marcar em cada jogo (só quem tem jogado) */
function propPicks(g) { return gamePlayers(g).filter(x => x.p >= 0.36 && x.gp >= 5).slice(0, 3); }
function propLogSave(list) {
  let ch = false;
  list.forEach(x => { const k = x.g.id + '|' + x.id; if (PROPS[k]) return; PROPS[k] = { g: x.g.id, id: x.id, n: x.n, t: x.t, k: gkKey(x.n), p: r3(x.p), ts: Date.now() }; ch = true; });
  const ks = Object.keys(PROPS); if (ks.length > 800) { ks.sort((a, b) => PROPS[a].ts - PROPS[b].ts).slice(0, ks.length - 800).forEach(k => delete PROPS[k]); ch = true; }
  if (ch) LS.set('props', PROPS);
}
/* depois do jogo: marcou? (se não aparece no box score, não jogou → não conta) */
function propGrade() {
  let ch = false;
  Object.values(PROPS).forEach(x => {
    if (x.w != null) return; const g = DB.g[x.g]; if (!g || g.s !== 'post' || !g.sk) return;
    const side = x.t === g.h ? 'h' : 'a', list = g.sk[side] || [];
    const me = list.find(s => s[0] === x.k);
    x.w = me ? (me[1] > 0 ? 1 : 0) : -1; ch = true;
  });
  if (ch) LS.set('props', PROPS);
}
function propStats() { const g = Object.values(PROPS).filter(x => x.w === 0 || x.w === 1); return g.length ? { n: g.length, w: g.filter(x => x.w === 1).length, p: g.reduce((a, x) => a + x.p, 0) / g.length } : null; }
function propDay(ed) { return Object.values(PROPS).filter(x => DB.g[x.g] && DB.g[x.g].ed === ed && (x.w === 0 || x.w === 1)); }
