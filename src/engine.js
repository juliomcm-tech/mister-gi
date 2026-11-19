'use strict';
/* =====================================================================
   MISTER GI · NHL  —  análise e duelo de apostas, só hóquei no gelo.
   Um ficheiro, cinco ecrãs: Início · Jogos · Duelo · Contas · Mais.
   Dados: arquivo do Gi (seed.json, até à véspera da publicação) + ESPN.
   Só vai à internet quando carregas em ↻. Tudo fica no telemóvel («gi_…»).
   ===================================================================== */
const APP_VER = '1.1.2';

/* ---------- utilitários ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r2 = x => Math.round(x * 100) / 100;
const r3 = x => Math.round(x * 1000) / 1000;
const LS = {
  get(k, d) { try { const v = localStorage.getItem('gi_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('gi_' + k, JSON.stringify(v)); return true; } catch (e) { toast('⚠️ A memória do telemóvel está cheia'); return false; } }
};
const eur = v => (Number(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const sEur = v => (v > 0 ? '+' : v < 0 ? '−' : '') + eur(Math.abs(v));
const odd2 = v => v ? Number(v).toFixed(2) : '—';
const pct = v => Math.round(v * 100) + '%';
const sPct = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v * 100)) + '%';
const lineTxt = v => v == null ? '' : (v > 0 ? '+' : v < 0 ? '−' : '') + String(Math.abs(v)).replace('.', ',');
const num = x => { const v = parseFloat(String(x == null ? '' : x).replace(',', '.').replace(/[^\d.+-]/g, '')); return isFinite(v) ? v : null; };
function toast(msg, ms) { const t = $('#toast'); if (!t) return; t.innerHTML = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms || 2600); }
/* odds americanas (−110, +150) → decimais (1.91, 2.50) */
function american(x) {
  if (x == null || x === '') return null;
  if (typeof x === 'object') return american(x.american != null ? x.american : x.value != null ? x.value : x.odds != null ? x.odds : x.decimal);
  const s = String(x).trim();
  if (/^even$/i.test(s) || /^evs?$/i.test(s)) return 2;
  const v = Number(s.replace('+', ''));
  if (!isFinite(v) || v === 0) return null;
  if (Math.abs(v) >= 100) return r2(v > 0 ? 1 + v / 100 : 1 + 100 / Math.abs(v));
  return v > 1 && v < 30 ? r2(v) : null;
}

/* ---------- datas (a NHL conta os dias pela hora de Nova Iorque) ---------- */
const fmtET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const etYmd = d => fmtET.format(d).replace(/-/g, '');
const ymdAdd = (s, n) => { const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8) + n)); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
const ymdDiff = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(4, 6) - 1, +b.slice(6, 8)) - Date.UTC(+a.slice(0, 4), +a.slice(4, 6) - 1, +a.slice(6, 8))) / 864e5);
const hhmm = iso => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
const dayLbl = iso => new Date(iso).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
const todayET = () => etYmd(new Date());
/* época NHL de um dia (out–jun): 2026-27 → '20262027' */
const seasonOf = ed => { const y = +ed.slice(0, 4), m = +ed.slice(4, 6); return m >= 8 ? y + '' + (y + 1) : (y - 1) + '' + y; };

/* ---------- as 32 equipas (abreviatura da NHL; a ESPN usa algumas diferentes) ---------- */
const TEAMS = {
  ANA: ['Anaheim', 'Ducks', 'f47a38', '000000'], BOS: ['Boston', 'Bruins', 'ffb81c', '000000'], BUF: ['Buffalo', 'Sabres', '003087', 'ffb81c'], CGY: ['Calgary', 'Flames', 'c8102e', 'f1be48'],
  CAR: ['Carolina', 'Hurricanes', 'ce1126', '000000'], CHI: ['Chicago', 'Blackhawks', 'cf0a2c', '000000'], COL: ['Colorado', 'Avalanche', '6f263d', '236192'], CBJ: ['Columbus', 'Blue Jackets', '002654', 'ce1126'],
  DAL: ['Dallas', 'Stars', '006847', '8f8f8c'], DET: ['Detroit', 'Red Wings', 'ce1126', 'ffffff'], EDM: ['Edmonton', 'Oilers', '041e42', 'ff4c00'], FLA: ['Florida', 'Panthers', 'c8102e', '041e42'],
  LAK: ['Los Angeles', 'Kings', '111111', 'a2aaad'], MIN: ['Minnesota', 'Wild', '154734', 'a6192e'], MTL: ['Montréal', 'Canadiens', 'af1e2d', '192168'], NSH: ['Nashville', 'Predators', 'ffb81c', '041e42'],
  NJD: ['New Jersey', 'Devils', 'ce1126', '000000'], NYI: ['NY Islanders', 'Islanders', '00539b', 'f47d30'], NYR: ['NY Rangers', 'Rangers', '0038a8', 'ce1126'], OTT: ['Ottawa', 'Senators', 'c52032', 'c2912c'],
  PHI: ['Philadelphia', 'Flyers', 'f74902', '000000'], PIT: ['Pittsburgh', 'Penguins', 'fcb514', '000000'], SJS: ['San Jose', 'Sharks', '006d75', 'ea7200'], SEA: ['Seattle', 'Kraken', '001628', '99d9d9'],
  STL: ['St. Louis', 'Blues', '002f87', 'fcb514'], TBL: ['Tampa Bay', 'Lightning', '002868', 'ffffff'], TOR: ['Toronto', 'Maple Leafs', '00205b', 'ffffff'], UTA: ['Utah', 'Mammoth', '6cace4', '010101'],
  VAN: ['Vancouver', 'Canucks', '00205b', '00843d'], VGK: ['Vegas', 'Golden Knights', 'b4975a', '333f42'], WSH: ['Washington', 'Capitals', 'c8102e', '041e42'], WPG: ['Winnipeg', 'Jets', '041e42', '004c97']
};
const ESPN2NHL = { LA: 'LAK', NJ: 'NJD', SJ: 'SJS', TB: 'TBL', UTAH: 'UTA', UTH: 'UTA', ARI: 'UTA', MON: 'MTL', WAS: 'WSH', NAS: 'NSH', CLB: 'CBJ', VEG: 'VGK', LV: 'VGK' };
const nhlAb = ab => { ab = String(ab || '').toUpperCase(); return TEAMS[ab] ? ab : ESPN2NHL[ab] || null; };
const EASTC = ['BOS', 'BUF', 'DET', 'FLA', 'MTL', 'OTT', 'TBL', 'TOR', 'CAR', 'CBJ', 'NJD', 'NYI', 'NYR', 'PHI', 'PIT', 'WSH'];

/* ---------- guardado ---------- */
const arrOr = v => Array.isArray(v) ? v : [], objOr = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
let DB = LS.get('db', null); if (!DB || !DB.g || !DB.days) DB = { g: {}, days: {} };
let BETS = arrOr(LS.get('bets', [])), PREDS = objOr(LS.get('preds', {})), DEPOS = arrOr(LS.get('depos', [])), SLIPS = objOr(LS.get('slips', {}));
let BO = objOr(LS.get('bo', {}));                // odds da Betano que tu metes (por jogo)
let GKSEL = objOr(LS.get('gksel', {}));          // guarda-redes que escolhes na ficha
const CFG_DEF = { bank: { tu: 100, gi: 100, pi: 250 }, min: 0.25, piOn: true, piStake: 2.5, evMin: 0.05, mktW: 0.85, oddMin: 1.30, oddMax: 4.50 };
let CFG = Object.assign({}, CFG_DEF, objOr(LS.get('cfg', {})));
CFG.bank = Object.assign({}, CFG_DEF.bank, CFG.bank || {});
if (CFG.botV !== 1) { CFG.piOn = true; CFG.botV = 1; }   // o piloto passou a ser o «Gi sozinho», ligado de origem
const saveDB = () => LS.set('db', DB);
const saveBets = () => LS.set('bets', BETS);
let SEED = null;                                  // carregado de seed.json no arranque

/* =====================================================================
   1) IR BUSCAR À ESPN
   ===================================================================== */
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl';
const BRIDGES = [
  { n: 'Direto', f: u => u },
  { n: 'corsproxy.io', f: u => 'https://corsproxy.io/?url=' + encodeURIComponent(u) },
  { n: 'allorigins', f: u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u) }
];
async function getJSON(url, tmo) {
  const pref = clamp(LS.get('bridge', 0), 0, BRIDGES.length - 1);
  const order = [pref].concat(BRIDGES.map((_, i) => i).filter(i => i !== pref));
  let last = null;
  for (const i of order) {
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), tmo || 15000);
    try {
      const r = await fetch(BRIDGES[i].f(url), { signal: ctrl.signal, cache: 'no-store' });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      const j = await r.json();
      if (i !== pref) LS.set('bridge', i);
      return j;
    } catch (e) { last = e; if (e.status === 400 || e.status === 404) throw e; }
    finally { clearTimeout(tm); }
  }
  throw last || new Error('sem ligação');
}
const scoreVal = x => x == null ? null : typeof x === 'object' ? Number(x.value != null ? x.value : x.displayValue) : Number(x);
function pickSide(s) { return s ? (s.close || s.current || s.open || s) : null; }
/* odds da ESPN (casas americanas): vencedor c/ prolongamento, puck line ±1,5 e total (contam prolongamento e penáltis) */
function parseOdds(o, hab, aab) {
  if (!o) return null;
  const r = { p: (o.provider && o.provider.name) || 'casa' };
  let hl = null, tl = null;
  try {
    const ps = o.pointSpread;
    if (ps && ps.home) { const x = pickSide(ps.home), y = pickSide(ps.away); if (x && x.line != null) hl = num(x.line); r.hso = american(x && x.odds); r.aso = american(y && y.odds); }
    const T = o.total;
    if (T && T.over) { const x = pickSide(T.over), y = pickSide(T.under); if (x && x.line != null) tl = num(String(x.line).replace(/^[ou]/i, '')); r.ovo = american(x && x.odds); r.uno = american(y && y.odds); }
    const ML = o.moneyline;
    if (ML && ML.home) { r.hml = american(pickSide(ML.home) && pickSide(ML.home).odds); r.aml = american(pickSide(ML.away) && pickSide(ML.away).odds); }
  } catch (e) {}
  if (hl == null && o.details) {
    const m = String(o.details).match(/^([A-Z]{2,4})\s+([+-]?\d+(?:\.\d+)?)/);
    if (m && Math.abs(+m[2]) <= 3.5) { const v = Math.abs(+m[2]), ab = nhlAb(m[1]); hl = ab === hab ? -v : ab === aab ? v : null; }
  }
  if (hl == null && o.spread != null && o.homeTeamOdds) { const v = Math.abs(+o.spread); if (o.homeTeamOdds.favorite) hl = -v; else if (o.awayTeamOdds && o.awayTeamOdds.favorite) hl = v; }
  if (tl == null && o.overUnder != null) tl = num(o.overUnder);
  const H = o.homeTeamOdds || {}, A = o.awayTeamOdds || {};
  if (!r.hml && H.moneyLine != null) r.hml = american(H.moneyLine);
  if (!r.aml && A.moneyLine != null) r.aml = american(A.moneyLine);
  if (!r.hso && H.spreadOdds != null) r.hso = american(H.spreadOdds);
  if (!r.aso && A.spreadOdds != null) r.aso = american(A.spreadOdds);
  if (!r.ovo && o.overOdds != null) r.ovo = american(o.overOdds);
  if (!r.uno && o.underOdds != null) r.uno = american(o.underOdds);
  r.hl = hl != null && Math.abs(hl) <= 3.5 ? hl : null;
  r.tl = tl != null && tl >= 3 && tl <= 10 ? tl : null;
  Object.keys(r).forEach(k => { if (r[k] == null) delete r[k]; });
  return (r.hl != null || r.tl != null || r.hml) ? r : null;
}
/* guarda-redes: chave «inicial. apelido» (o arquivo tem «S. Bobrovsky», a ESPN «Sergei Bobrovsky») */
const normTxt = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z .'-]/g, '').trim();
function gkKey(name) {
  const s = normTxt(name).replace(/\./g, '. ').replace(/\s+/g, ' ').trim(); if (!s) return '';
  const p = s.split(' '); if (p.length === 1) return p[0];
  const first = p[0].replace(/\./g, ''), last = p.slice(1).join(' ');
  return first[0] + '. ' + last;
}
function probablesOf(c) {   // nomes dos guarda-redes prováveis, se a ESPN os der
  const out = [];
  (c.probables || []).forEach(p => { const a = p.athlete || p; const n = a && (a.displayName || a.fullName || a.shortName); if (n) out.push(n); });
  return out[0] || null;
}
function ingest(ev) {
  const c = ev && ev.competitions && ev.competitions[0];
  if (!c || !c.competitors) return null;
  const H = c.competitors.find(x => x.homeAway === 'home'), A = c.competitors.find(x => x.homeAway === 'away');
  if (!H || !A || !H.team || !A.team) return null;
  const h = nhlAb(H.team.abbreviation), a = nhlAb(A.team.abbreviation);
  if (!h || !a) return null;
  DB.logos = DB.logos || {}; [[h, H.team], [a, A.team]].forEach(([k, t]) => { const u = t.logo || (t.logos && t.logos[0] && t.logos[0].href); if (u && /^https:\/\//.test(u)) DB.logos[k] = u; });                                                           // All-Star, jogos contra seleções…
  const ty = ev.season && ev.season.type;
  if (ty && [2, 3].indexOf(Number(ty)) < 0) return null;                               // só época regular e playoffs
  const S = (c.status || ev.status || {}), st = S.type || {};
  const off = /POSTPON|CANCEL|SUSPEND/i.test(String(st.name || '') + ' ' + String(st.description || ''));
  const s = off ? 'off' : (st.completed || st.state === 'post') ? 'post' : st.state === 'in' ? 'in' : 'pre';
  const id = String(ev.id), old = DB.g[id];
  const g = { id, d: ev.date || c.date, h, a, s, ty: Number(ty) || 2, src: 'espn' };
  g.ed = etYmd(new Date(g.d));
  if (s === 'post' || s === 'in') {
    g.hs = scoreVal(H.score); g.as = scoreVal(A.score); g.per = Number(S.period) || 0; g.cl = st.shortDetail || st.detail || '';
    if (s === 'post') {
      const det = String(st.shortDetail || st.detail || st.description || '');
      g.so = /SO|shoot/i.test(det); g.ot = g.so || /OT|overtime/i.test(det) || g.per > 3;
      // tempo regulamentar: se foi a prolongamento, estava empatado aos 60'
      if (g.ot && Math.abs(g.hs - g.as) === 1) { g.rh = g.ra = Math.min(g.hs, g.as); }
      else if (g.ot) {                                      // dados estranhos: tenta pelos períodos
        const per3 = x => (x.linescores || []).slice(0, 3).reduce((t, p) => t + (scoreVal(p) || 0), 0);
        const a3 = per3(H), b3 = per3(A); if (a3 === b3 && a3 > 0 || (a3 === b3 && Math.min(g.hs, g.as) === 0)) { g.rh = a3; g.ra = b3; }   // senão fica sem resultado aos 60'
      } else { g.rh = g.hs; g.ra = g.as; }
    }
  }
  const o = parseOdds(c.odds && c.odds[0], h, a);
  g.o = s === 'pre' ? (o || (old && old.o) || null) : ((old && old.o) || o || null);
  if (!g.o) delete g.o;
  const ph = probablesOf(H), pa = probablesOf(A);
  if (ph) g.prH = ph; else if (old && old.prH) g.prH = old.prH;
  if (pa) g.prA = pa; else if (old && old.prA) g.prA = old.prA;
  if (old) ['bx', 'bxn', 'shH', 'shA', 'gkH', 'gkA', 'sk'].forEach(k => { if (old[k] != null && g[k] == null) g[k] = old[k]; });
  DB.g[id] = g;
  return g;
}
/* box score de um jogo acabado: remates e guarda-redes (para atualizar a força e os guarda-redes) */
function parseBox(j, g) {
  const B = j && j.boxscore; if (!B) return false;
  const gks = { h: [], a: [] }, sk = { h: [], a: [] };
  (B.players || []).forEach(tp => {
    const ab = nhlAb(tp.team && tp.team.abbreviation); const side = ab === g.h ? 'h' : ab === g.a ? 'a' : null; if (!side) return;
    (tp.statistics || []).forEach(grp => {
      const keys = (grp.keys || grp.names || grp.labels || []).map(k => String(k).toLowerCase());
      const iSA = keys.findIndex(k => k === 'shotsagainst' || k === 'sa'), iSV = keys.findIndex(k => k === 'saves' || k === 'sv'), iT = keys.findIndex(k => k === 'timeonice' || k === 'toi');
      if (iSA < 0 || iSV < 0) {   // jogadores de campo: quem jogou e quantos golos (para os marcadores)
        const iG = keys.findIndex(k => k === 'goals' || k === 'g');
        if (iG >= 0) (grp.athletes || []).forEach(x => { const n = x.athlete && (x.athlete.displayName || x.athlete.shortName); if (n) sk[side].push([gkKey(n), num((x.stats || [])[iG]) || 0]); });
        return;
      }
      (grp.athletes || []).forEach(x => {
        const st = x.stats || [], n = x.athlete && (x.athlete.displayName || x.athlete.shortName);
        const sa = num(st[iSA]), sv = num(st[iSV]); if (!n || sa == null) return;
        const t = iT >= 0 ? String(st[iT] || '0:00').split(':') : ['0'];
        gks[side].push({ k: gkKey(n), n, sa, sv: sv || 0, toi: (+t[0] || 0) + (+(t[1] || 0)) / 60, st: !!x.starter });
      });
    });
  });
  if (!gks.h.length || !gks.a.length) return false;
  ['h', 'a'].forEach(s => gks[s].sort((x, y) => (y.st - x.st) || (y.toi - x.toi)));
  g.gkH = gks.h.map(x => [x.k, x.n, x.sa, x.sv]); g.gkA = gks.a.map(x => [x.k, x.n, x.sa, x.sv]);
  g.shH = gks.a.reduce((t, x) => t + x.sa, 0); g.shA = gks.h.reduce((t, x) => t + x.sa, 0);   // remates à baliza = defesas pedidas ao outro lado
  if (sk.h.length || sk.a.length) g.sk = sk;
  g.bx = 1;
  return true;
}
let BUSY = false;
async function refresh() {
  if (BUSY || !SEED) return; BUSY = true;
  const btn = $('#btnRefresh'); if (btn) btn.classList.add('spin');
  const T = todayET(), tom = ymdAdd(T, 1);
  const cut = SEED.cut.replace(/-/g, '');
  let fails = 0, got = 0, days = 0;
  try {
    // dia a dia desde o fim do arquivo até amanhã (só marca «feito» o que veio bem e já acabou)
    let d = ymdAdd(cut, 1);
    for (let i = 0; d <= tom && i < 400; i++, d = ymdAdd(d, 1)) {
      if (DB.days[d] && d < ymdAdd(T, -2)) continue;
      setUpd(`⏳ A buscar ${d.slice(6)}/${d.slice(4, 6)} à ESPN…`);
      try { const j = await getJSON(`${ESPN}/scoreboard?dates=${d}`); if (!j || !Array.isArray(j.events)) throw new Error('resposta sem jogos'); j.events.forEach(e => { if (ingest(e)) got++; }); if (d < ymdAdd(T, -2)) DB.days[d] = 1; days++; }
      catch (e) { fails++; if (i >= 2 && !got && fails >= i + 1) break; }
      await new Promise(r => setTimeout(r, 60));
    }
    saveDB();
    // box scores dos jogos acabados (remates e guarda-redes), até 40 de cada vez
    const todo = Object.values(DB.g).filter(g => g.src === 'espn' && g.s === 'post' && g.bx !== 1 && (g.bxn || 0) < 3 && g.ed > cut).sort((x, y) => x.d < y.d ? -1 : 1).slice(0, 40);
    let k = 0;
    for (const g of todo) {
      k++; setUpd(`⏳ Guarda-redes e remates ${k}/${todo.length}…`);
      g.bxn = (g.bxn || 0) + 1; try { const j = await getJSON(`${ESPN}/summary?event=${g.id}`); if (!parseBox(j, g)) g.bx = -1; } catch (e) { }
    }
    saveDB();
    MODEL = null; PC.clear();
    snapshotPreds();
    snapshotSlips();
    const sett = settleAll();
    if (typeof propGrade === 'function') propGrade();
    const pil = pilotRun(); bossFeed();
    LS.set('last', Date.now());
    toast(fails && !got ? 'Sem ligação à ESPN. Experimenta «Testar ligação» no Mais.' : `✓ ${got} jogos lidos${k ? ` · ${k} box scores` : ''}${sett ? ` · ${sett} apostas fechadas` : ''}${pil ? ` · piloto fez ${pil}` : ''}`, 4200);
  } catch (e) {
    toast('❌ Falhou: ' + esc(e.message || e));
  } finally {
    BUSY = false; if (btn) btn.classList.remove('spin'); render();
  }
}

/* =====================================================================
   2) O CÉREBRO DO GI
   Golos esperados (tempo regulamentar):
     casa = média da liga × ataque casa × defesa fora × fator casa × guarda-redes de fora × cansaço
     fora = média da liga × ataque fora × defesa casa × guarda-redes da casa × cansaço
   - ataque/defesa: atualizados jogo a jogo, metade golos reais, metade remates × finalização média
     (os remates dizem mais do que os golos, que têm muita sorte)
   - guarda-redes: defesas acima da média da liga, por remate (encolhido: precisa de ~3400 remates para «valer» metade)
   - placar: Poisson + empates aos 60' um pouco mais frequentes (δ) + baliza deserta (ε: parte das vitórias
     por 1 golo viram por 2, porque quem perde tira o guarda-redes no fim)
   - prolongamento/penáltis: 50% + κ × diferença de força
   Afinado em 2017-23, validado em 2023-24, testado às cegas em 2024-25, 2025-26 e 2026-27.
   ===================================================================== */
let MODEL = null;
const PC = new Map();                            // memória de previsões (cartão, ficha e boletim pedem a mesma)
const pois = (l, n) => { let p = Math.exp(-l); for (let i = 1; i <= n; i++) p *= l / i; return p; };
function grid(lh, la, P) {
  const N = 12, M = [];
  const ph = [], pa = []; for (let i = 0; i < N; i++) { ph.push(pois(lh, i)); pa.push(pois(la, i)); }
  let s = 0;
  for (let i = 0; i < N; i++) { M.push([]); for (let j = 0; j < N; j++) { let v = ph[i] * pa[j]; if (i === j) v *= 1 + P.delta; M[i].push(v); s += v; } }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) M[i][j] /= s;
  const e = P.eps;
  if (e) {
    const M2 = M.map(r => r.slice());
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) {
      if (i - j === 1) { M2[i][j] -= e * M[i][j]; M2[i + 1][j] += e * M[i][j]; }
      if (j - i === 1) { M2[i][j] -= e * M[i][j]; M2[i][j + 1] += e * M[i][j]; }
    }
    return M2;
  }
  return M;
}
function gridSum(M, f) { let s = 0; for (let i = 0; i < M.length; i++) for (let j = 0; j < M.length; j++) if (f(i, j)) s += M[i][j]; return s; }
const pWinReg = M => gridSum(M, (i, j) => i > j), pDraw = M => gridSum(M, (i, j) => i === j);

function buildModel() {
  const P = SEED.par, cut = SEED.cut.replace(/-/g, '');
  const A = {}, D = {}, LAST = {};
  Object.entries(SEED.teams).forEach(([t, v]) => { A[t] = v[0]; D[t] = v[1]; LAST[t] = String(v[2] || '').replace(/-/g, ''); });
  const lg = Object.assign({}, SEED.lg);
  // guarda-redes: chave «s. bobrovsky» → estado
  const GK = {};
  const idName = {};
  Object.entries(SEED.gk).sort((x, y) => y[1][3] - x[1][3]).forEach(([id, v]) => { let k = gkKey(v[0]); if (GK[k]) k += '|' + v[1]; GK[k] = { n: v[0], t: v[1], s0: v[2], s1: v[3], id }; idName[id] = k; });
  const starts = {}; Object.entries(SEED.starts || {}).forEach(([t, L]) => { starts[t] = L.map(id => idName[id]).filter(Boolean); });
  // jogos da época: arquivo + ESPN (depois do corte)
  const seedG = (SEED.games || []).map((r, i) => ({ id: 'n' + i, d: r[0] + 'T' + (r[1] || '23:00') + ':00Z', ed: r[0].replace(/-/g, ''), h: r[2], a: r[3], hs: r[4], as: r[5], rh: r[6], ra: r[7], ot: !!r[8], so: !!r[9], s: 'post', src: 'seed', gkHid: r[12], gkAid: r[13] }));
  const espn = Object.values(DB.g).filter(g => g.ed > cut && TEAMS[g.h] && TEAMS[g.a]);
  const fin = espn.filter(g => g.s === 'post' && g.rh != null).sort((x, y) => x.d < y.d ? -1 : 1);
  let season = SEED.season;
  const decay = sa => Math.exp(-sa / P.half_gk * Math.LN2);
  fin.forEach(g => {
    const sy = seasonOf(g.ed);
    if (sy !== season) { season = sy; Object.keys(A).forEach(t => { A[t] *= P.carry; D[t] *= P.carry; }); }
    const h = g.h, a = g.a, mu = Math.log(lg.g);
    const lh0 = Math.exp(mu + P.hfa + (A[h] || 0) - (D[a] || 0)), la0 = Math.exp(mu + (A[a] || 0) - (D[h] || 0));
    const hasSh = g.shH > 0 && g.shA > 0, fin_ = lg.g / lg.sh;
    const yh = hasSh ? (1 - P.w_sh) * g.rh + P.w_sh * g.shH * fin_ : g.rh;
    const ya = hasSh ? (1 - P.w_sh) * g.ra + P.w_sh * g.shA * fin_ : g.ra;
    const rh_ = (yh - lh0) / lh0, ra_ = (ya - la0) / la0;
    A[h] = (A[h] || 0) + P.eta * rh_; D[a] = (D[a] || 0) - P.eta * rh_;
    A[a] = (A[a] || 0) + P.eta * ra_; D[h] = (D[h] || 0) - P.eta * ra_;
    let saT = 0, svT = 0;
    [['gkH', h], ['gkA', a]].forEach(([k, t]) => (g[k] || []).forEach(([key0, n, sa, sv], i) => {
      let key = key0;
      if (!(sa > 0)) return;
      if (GK[key + '|' + t]) key = key + '|' + t;
      const s = GK[key] || (GK[key] = { n, t, s0: 0, s1: 0 }); s.t = t; const dc = decay(sa);
      s.s0 = s.s0 * dc + (sv - lg.sv * sa); s.s1 = s.s1 * dc + sa; saT += sa; svT += sv;
      if (i === 0) (starts[t] = starts[t] || []).push(key);
    }));
    lg.g = 0.998 * lg.g + 0.002 * (g.rh + g.ra) / 2;
    if (saT) lg.sv = 0.998 * lg.sv + 0.002 * svT / saT;
    lg.sh = 0.998 * lg.sh + 0.002 * (hasSh ? (g.shH + g.shA) / 2 : 30);
    LAST[h] = LAST[a] = g.ed;
  });
  // registos da época (V-D-DP, golos, últimos jogos)
  const all = seedG.concat(fin.filter(g => seasonOf(g.ed) === SEED.season || seasonOf(g.ed) === season));
  const rec = {}; const R = t => rec[t] = rec[t] || { w: 0, l: 0, otl: 0, hw: 0, hl: 0, aw: 0, al: 0, gf: 0, ga: 0, pts: 0, last: [] };
  all.filter(g => seasonOf(g.ed) === season && g.hs != null).sort((x, y) => x.d < y.d ? -1 : 1).forEach(g => {
    const hw = g.hs > g.as, H = R(g.h), Aa = R(g.a);
    if (hw) { H.w++; H.hw++; Aa.al++; if (g.ot) Aa.otl++; else Aa.l++; } else { Aa.w++; Aa.aw++; H.hl++; if (g.ot) H.otl++; else H.l++; }
    H.gf += g.hs; H.ga += g.as; Aa.gf += g.as; Aa.ga += g.hs;
    H.last.push({ w: hw, s: g.hs + '-' + g.as, vs: g.a, ot: g.ot }); Aa.last.push({ w: !hw, s: g.as + '-' + g.hs, vs: g.h, ot: g.ot });
  });
  Object.values(rec).forEach(r => { r.pts = 2 * r.w + r.otl; });
  return { A, D, lg, GK, starts, rec, LAST, season, nEspn: fin.length };
}
const getModel = () => MODEL || (MODEL = buildModel());
const strength = (M, t) => (M.A[t] || 0) + (M.D[t] || 0);
/* qualidade de um guarda-redes: defesas acima da média por remate (encolhido) */
function gkQ(M, key) { const s = key && M.GK[key]; return s ? s.s0 / (s.s1 + SEED.par.gk_k) : 0; }
function gkList(M, t) {   // guarda-redes de uma equipa (mais titularidades recentes primeiro)
  const st = (M.starts[t] || []).slice(-12), cnt = {};
  st.forEach(k => cnt[k] = (cnt[k] || 0) + 1);
  const ks = Object.keys(M.GK).filter(k => M.GK[k].t === t);
  return ks.map(k => ({ k, n: M.GK[k].n, q: gkQ(M, k), sa: M.GK[k].s1, c: cnt[k] || 0 })).sort((x, y) => y.c - x.c || y.sa - x.sa);
}
function gkFor(g, side) {   // quem vai à baliza: escolha tua → provável da ESPN → o mais utilizado
  const M = getModel(), t = side === 'h' ? g.h : g.a;
  const sel = GKSEL[g.id] && GKSEL[g.id][side]; if (sel && M.GK[sel]) return { k: sel, how: 'escolhido por ti' };
  const pr = side === 'h' ? g.prH : g.prA; if (pr) { let k = gkKey(pr); if (M.GK[k + '|' + t]) k = k + '|' + t; if (M.GK[k]) return { k, how: 'provável (ESPN)' }; return { k: null, how: 'provável (ESPN): ' + pr + ' — sem dados, conta como médio' }; }
  const L = gkList(M, t); return L.length ? { k: L[0].k, how: 'o mais utilizado' } : { k: null, how: '—' };
}
function restDays(M, t, g) {
  let l = M.LAST[t] && M.LAST[t] < g.ed ? M.LAST[t] : null;
  for (const x of Object.values(DB.g)) if ((x.h === t || x.a === t) && x.s !== 'off' && x.ed < g.ed && (!l || x.ed > l)) l = x.ed;   // jogos ainda por acabar também cansam
  return l ? ymdDiff(l, g.ed) : null;
}
/* acerta as forças para que o vencedor (c/ prolongamento) bata com o alvo, e o total com o alvo de «mais de» */
function lamFor(lh, la, P, pot) {
  const M = grid(lh, la, P); const hw = pWinReg(M), dr = pDraw(M);
  return { M, hw, dr, aw: 1 - hw - dr, ml: hw + dr * pot };
}
function fitML(lh, la, P, pot, target) {
  let lo = -1, hi = 1;
  for (let i = 0; i < 22; i++) { const s = (lo + hi) / 2, r = lamFor(lh * Math.exp(s), la * Math.exp(-s), P, pot); if (r.ml < target) lo = s; else hi = s; }
  const s = (lo + hi) / 2; return [lh * Math.exp(s), la * Math.exp(-s)];
}
/* o Gi aprende quanto confiar na casa: com as previsões que guardou ANTES de cada jogo,
   procura o peso que mais acerta (w·casa + (1−w)·Gi), travado para não saltar com poucos jogos */
let CALW = null;
function calibW() {
  if (CALW && CALW.k === Object.keys(PREDS).length + '|' + LS.get('last', 0)) return CALW;
  const rows = [];
  Object.entries(PREDS).forEach(([id, p]) => { const g = DB.g[id]; if (!g || g.s !== 'post' || g.hs == null || p.nv == null || p.mlM == null) return; rows.push([p.nv, p.mlM, g.hs > g.as ? 1 : 0]); });
  let best = CFG.mktW, bl = Infinity;
  for (let w = 0.5; w <= 1.0001; w += 0.05) { let l = 0; rows.forEach(([m, g, y]) => { const q = clamp(w * m + (1 - w) * g, 1e-4, 1 - 1e-4); l -= y ? Math.log(q) : Math.log(1 - q); }); if (l < bl) { bl = l; best = w; } }
  const n = rows.length;
  CALW = { k: Object.keys(PREDS).length + '|' + LS.get('last', 0), n, raw: best, w: clamp((n * best + 150 * CFG.mktW) / (n + 150), 0.5, 0.98) };
  return CALW;
}
function predict(g) {
  const M = getModel(), P = SEED.par, h = g.h, a = g.a;
  const gh = gkFor(g, 'h'), ga = gkFor(g, 'a'), o = g.o || {};
  const key = [g.id, g.s, Object.keys(DB.g).length, gh.k, ga.k, o.hml, o.aml, o.tl, o.ovo, M.nEspn, CFG.mktW, calibW().w, CFG.evMin, CFG.oddMin, CFG.oddMax, JSON.stringify(BO[g.id] || {})].join('|');
  const hit = PC.get(g.id); if (hit && hit.k === key) return hit.P;
  const mu = Math.log(M.lg.g);
  const qh = gkQ(M, gh.k), qa = gkQ(M, ga.k);
  const fgh = Math.pow(Math.max(0.5, 1 - qh / (1 - M.lg.sv)), P.gk_w), fga = Math.pow(Math.max(0.5, 1 - qa / (1 - M.lg.sv)), P.gk_w);
  const rh = restDays(M, h, g), ra = restDays(M, a, g), bh = rh === 1 ? 1 : 0, ba = ra === 1 ? 1 : 0;
  const base = (t, home) => mu + (home ? P.hfa : 0) + (M.A[t] || 0) - (M.D[home ? a : h] || 0);
  const lhM = Math.exp(base(h, true) - P.b2b * bh + P.b2b * 0.5 * ba) * fga;
  const laM = Math.exp(base(a, false) - P.b2b * ba + P.b2b * 0.5 * bh) * fgh;
  const pot = clamp(0.5 + P.kappa * (strength(M, h) - strength(M, a) + P.hfa * 0.5), 0.25, 0.75);
  const mod = lamFor(lhM, laM, P, pot);
  let lh = lhM, la = laM, W = 0, pNV = null, tNV = null;
  // mistura com o mercado (vencedor c/ prolongamento da ESPN): a casa sabe coisas que o Gi não sabe (lesões, titulares)
  if (o.hml > 1 && o.aml > 1) { pNV = (1 / o.hml) / (1 / o.hml + 1 / o.aml); W = calibW().w; [lh, la] = fitML(lhM, laM, P, pot, W * pNV + (1 - W) * mod.ml); }
  if (o.tl != null && o.ovo > 1 && o.uno > 1) {   // total da ESPN (conta prolongamento): acerta a soma dos golos
    tNV = (1 / o.ovo) / (1 / o.ovo + 1 / o.uno);
    const now = r => totOT(lamFor(lh * Math.exp(r), la * Math.exp(r), P, pot).M, o.tl);
    const target = W ? W * tNV + (1 - W) * now(0) : 0.5 * tNV + 0.5 * now(0);
    let lo = -0.6, hi = 0.6; for (let i = 0; i < 20; i++) { const r = (lo + hi) / 2; if (now(r) < target) lo = r; else hi = r; }
    const r = (lo + hi) / 2; lh *= Math.exp(r); la *= Math.exp(r);
  }
  const fn = lamFor(lh, la, P, pot);
  const out = { g, lh, la, lhM, laM, M: fn.M, pH: fn.hw, pD: fn.dr, pA: fn.aw, pML: fn.ml, pot, mod, W, pNV, tNV, gh, ga, qh, qa, rh, ra, bh, ba };
  out.eg = gridSum(fn.M, () => true) && expGoals(fn.M);
  out.reasons = [
    ['Ataque e defesa (época, com remates)', (M.A[h] || 0) - (M.D[a] || 0) - ((M.A[a] || 0) - (M.D[h] || 0))],
    ['Jogar em casa', P.hfa],
    ['Guarda-redes', Math.log(fga) - Math.log(fgh)],
    ['Cansaço (jogou na véspera)', -P.b2b * 1.5 * bh + P.b2b * 1.5 * ba]
  ];
  out.cands = candidates(g, out);
  const elig = out.cands.filter(c => c.odd >= CFG.oddMin && c.odd <= CFG.oddMax && !c.est).sort((x, y) => y.ev - x.ev);
  out.best = elig[0] || null;
  out.value = out.best && out.best.ev >= CFG.evMin ? out.best : null;
  PC.set(g.id, { k: key, P: out });
  return out;
}
function expGoals(M) { let s = 0; for (let i = 0; i < M.length; i++) for (let j = 0; j < M.length; j++) s += (i + j) * M[i][j]; return s; }
/* total com prolongamento: se empatar aos 60', soma 1 golo (prolongamento ou penálti decisivo) */
function totOT(M, L) { return gridSum(M, (i, j) => (i + j + (i === j ? 1 : 0)) > L); }

/* ---------- mercados ----------
   1x2 · dc (dupla hipótese) · hc (handicap) · tot (total)  → tempo regulamentar (60', como a Betano)
   ml (vencedor) · pl (puck line) · tto (total)            → contam prolongamento e penáltis (como a ESPN)  */
function probs(P, mk, sel, line) {
  const M = P.M;
  const res = (fw, fp) => ({ w: gridSum(M, fw), push: fp ? gridSum(M, fp) : 0 });
  if (mk === '1x2') return { w: sel === 'h' ? P.pH : sel === 'x' ? P.pD : P.pA, push: 0 };
  if (mk === 'dc') return { w: sel === '1x' ? P.pH + P.pD : sel === 'x2' ? P.pA + P.pD : P.pH + P.pA, push: 0 };
  if (mk === 'ml') return { w: sel === 'h' ? P.pML : 1 - P.pML, push: 0 };
  if (mk === 'hc') { const d = (i, j) => (sel === 'h' ? i - j : j - i) + line; return res((i, j) => d(i, j) > 1e-9, (i, j) => Math.abs(d(i, j)) < 1e-9); }
  if (mk === 'tot') return sel === 'o' ? res((i, j) => i + j > line + 1e-9, (i, j) => Math.abs(i + j - line) < 1e-9) : res((i, j) => i + j < line - 1e-9, (i, j) => Math.abs(i + j - line) < 1e-9);
  if (mk === 'tto') { const t = (i, j) => i + j + (i === j ? 1 : 0); return sel === 'o' ? res((i, j) => t(i, j) > line + 1e-9, (i, j) => Math.abs(t(i, j) - line) < 1e-9) : res((i, j) => t(i, j) < line - 1e-9, (i, j) => Math.abs(t(i, j) - line) < 1e-9); }
  if (mk === 'pl') {   // margem final: se empatar aos 60', quem ganha o prolongamento ganha por 1
    let w = 0, push = 0; const pot = sel === 'h' ? P.pot : 1 - P.pot;
    for (let i = 0; i < M.length; i++) for (let j = 0; j < M.length; j++) {
      const v = M[i][j]; if (!v) continue;
      if (i !== j) { const d = (sel === 'h' ? i - j : j - i) + line; if (d > 1e-9) w += v; else if (Math.abs(d) < 1e-9) push += v; }
      else { const dW = 1 + line, dL = -1 + line; if (dW > 1e-9) w += v * pot; else if (Math.abs(dW) < 1e-9) push += v * pot; if (dL > 1e-9) w += v * (1 - pot); else if (Math.abs(dL) < 1e-9) push += v * (1 - pot); }
    }
    return { w, push };
  }
  return { w: 0, push: 0 };
}
const evOf = (q, odd) => q.w * odd + q.push - 1;
const fairOf = q => q.w > 0 ? (1 - q.push) / q.w : 99;
function candidates(g, P) {
  const o = g.o || {}, b = BO[g.id] || {}, out = [];
  const add = (mk, sel, line, odd, src) => { if (!(odd > 1)) return; const q = probs(P, mk, sel, line); out.push({ mk, sel, line: line == null ? null : line, odd: r2(odd), src, p: q.w, push: q.push, ev: evOf(q, odd), fair: fairOf(q) }); };
  // Betano (o que tu metes): mercados de 60'
  add('1x2', 'h', null, b.x1, 'Betano'); add('1x2', 'x', null, b.xx, 'Betano'); add('1x2', 'a', null, b.x2, 'Betano');
  add('ml', 'h', null, b.mh, 'Betano'); add('ml', 'a', null, b.ma, 'Betano');
  if (b.tl != null) { add('tot', 'o', b.tl, b.to, 'Betano'); add('tot', 'u', b.tl, b.tu, 'Betano'); }
  if (b.hl != null) { add('hc', 'h', b.hl, b.hh, 'Betano'); add('hc', 'a', -b.hl, b.ha, 'Betano'); }
  // ESPN (casas americanas): contam prolongamento
  const ps = o.p || 'ESPN';
  if (o.hml && o.aml) { add('ml', 'h', null, o.hml, ps); add('ml', 'a', null, o.aml, ps); }
  if (o.hl != null) { add('pl', 'h', o.hl, o.hso, ps); add('pl', 'a', -o.hl, o.aso, ps); }
  if (o.tl != null) { add('tto', 'o', o.tl, o.ovo, ps); add('tto', 'u', o.tl, o.uno, ps); }
  return out;
}
const tName = t => (TEAMS[t] && TEAMS[t][0]) || t || '?';
const tNick = t => (TEAMS[t] && TEAMS[t][1]) || t || '?';
const tAb = t => t || '?';
const gl = (n) => String(n).replace('.', ',');
function selLabel(g, mk, sel, line) {
  const T = s => tName(s === 'h' ? g.h : g.a);
  if (mk === '1x2') return sel === 'x' ? 'Empate aos 60 min' : T(sel) + ' ganha nos 60 min';
  if (mk === 'dc') return sel === '1x' ? T('h') + ' ou empate (60 min)' : sel === 'x2' ? T('a') + ' ou empate (60 min)' : 'Sem empate aos 60 min';
  if (mk === 'ml') return T(sel) + ' ganha (c/ prolong.)';
  if (mk === 'hc') return T(sel) + ' ' + lineTxt(line) + ' (60 min)';
  if (mk === 'pl') return T(sel) + ' ' + lineTxt(line) + ' (c/ prolong.)';
  if (mk === 'tot') return (sel === 'o' ? 'Mais de ' : 'Menos de ') + gl(line) + ' golos (60 min)';
  if (mk === 'tto') return (sel === 'o' ? 'Mais de ' : 'Menos de ') + gl(line) + ' golos (c/ prolong.)';
  return mk;
}
const mkName = mk => ({ '1x2': 'Resultado (60 min)', dc: 'Dupla hipótese (60 min)', ml: 'Vencedor (c/ prolongamento)', hc: 'Handicap (60 min)', pl: 'Puck line (c/ prolong.)', tot: 'Total de golos (60 min)', tto: 'Total (c/ prolong.)' }[mk] || mk);
const gLabel = g => tName(g.h) + ' – ' + tName(g.a);
const mostLikely = P => { const L = [['h', P.pH], ['x', P.pD], ['a', P.pA]].sort((x, y) => y[1] - x[1]); return L[0]; };

/* previsões congeladas até ao início (para o veredito e as estatísticas) */
function snapshotPreds() {
  const now = Date.now();
  Object.values(DB.g).forEach(g => {
    if (!TEAMS[g.h] || !TEAMS[g.a] || g.s !== 'pre' || new Date(g.d).getTime() < now - 6e5) return;
    if (ymdDiff(todayET(), g.ed) > 2) return;
    const P = predict(g);
    PREDS[g.id] = { pH: r3(P.pH), pD: r3(P.pD), pA: r3(P.pA), ml: r3(P.pML), mlM: r3(P.mod.ml), nv: P.pNV != null ? r3(P.pNV) : null, eg: r2(P.eg), tl: g.o && g.o.tl, ed: g.ed,
      pk: P.value ? { mk: P.value.mk, sel: P.value.sel, line: P.value.line, odd: P.value.odd, ev: r2(P.value.ev), p: r2(P.value.p), lb: selLabel(g, P.value.mk, P.value.sel, P.value.line), src: P.value.src } : null, ts: now };
  });
  const ks = Object.keys(PREDS); if (ks.length > 800) ks.sort((a, b) => PREDS[a].ts - PREDS[b].ts).slice(0, ks.length - 800).forEach(k => delete PREDS[k]);
  LS.set('preds', PREDS);
}

/* =====================================================================
   3) CONTAS: Tu · Mister Gi · Gi sozinho (bot)
   ===================================================================== */
const ACC = { tu: { n: 'Tu', ic: 'star', c: 'var(--c-blue)' }, gi: { n: 'Mister Gi', ic: 'puck', c: 'var(--c-orange)' }, pi: { n: 'Gi sozinho', ic: 'robot', c: 'var(--c-purple)' } };
function accStats(acc) {
  const B = BETS.filter(b => b.acc === acc);
  const dep = DEPOS.filter(d => d.acc === acc).reduce((s, d) => s + d.v, 0);
  let staked = 0, ret = 0, open = 0, setSt = 0, setRet = 0, w = 0, l = 0;
  B.forEach(b => {
    staked += b.stake;
    if (b.st === 'open') open += b.stake;
    else { ret += b.ret || 0; if (b.st !== 'void') { setSt += b.stake; setRet += b.ret || 0; if (b.st === 'won') w++; if (b.st === 'lost') l++; } }
  });
  const start = (CFG.bank[acc] || 0) + dep;
  return { start, bal: r2(start - staked + ret), open: r2(open), profit: r2(setRet - setSt), roi: setSt ? (setRet - setSt) / setSt : 0, w, l, n: B.length, nOpen: B.filter(b => b.st === 'open').length };
}
const canBet = g => g && g.s === 'pre' && new Date(g.d).getTime() > Date.now();
function newBet(acc, g, c, stake, extra) {
  const b = Object.assign({ id: acc + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), acc, g: g.id, gl: gLabel(g), gd: g.d, mk: c.mk, sel: c.sel, line: c.line == null ? null : c.line, odd: r2(c.odd), stake: r2(stake), t: Date.now(), st: 'open', ret: 0, lb: selLabel(g, c.mk, c.sel, c.line) }, extra || {});
  BETS.push(b); return b;
}
function outcome(b, g) {
  if (g.s === 'off') return 'void';
  if (g.s !== 'post' || g.hs == null) return null;
  if (g.rh == null && ['1x2', 'dc', 'hc', 'tot'].includes(b.mk)) return null;
  const rh = g.rh, ra = g.ra, hs = g.hs, as = g.as;
  const wl = x => x > 1e-9 ? 'won' : x < -1e-9 ? 'lost' : 'push';
  switch (b.mk) {
    case '1x2': return (b.sel === 'h' ? rh > ra : b.sel === 'a' ? ra > rh : rh === ra) ? 'won' : 'lost';
    case 'dc': return (b.sel === '1x' ? rh >= ra : b.sel === 'x2' ? ra >= rh : rh !== ra) ? 'won' : 'lost';
    case 'ml': return (b.sel === 'h' ? hs > as : as > hs) ? 'won' : 'lost';
    case 'hc': return wl((b.sel === 'h' ? rh - ra : ra - rh) + b.line);
    case 'pl': return wl((b.sel === 'h' ? hs - as : as - hs) + b.line);
    case 'tot': return wl(b.sel === 'o' ? rh + ra - b.line : b.line - (rh + ra));
    case 'tto': return wl(b.sel === 'o' ? hs + as - b.line : b.line - (hs + as));
  }
  return null;
}
function newMulti(acc, legs, stake, extra) {
  const odd = r2(legs.reduce((a, l) => a * l.odd, 1));
  const b = Object.assign({ id: acc + 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), acc, mk: 'multi', legs: legs.map(l => Object.assign({}, l)), g: legs[0].g, gl: legs.length + ' jogos', gd: legs.reduce((m, l) => l.gd > m ? l.gd : m, legs[0].gd), odd, stake: r2(stake), t: Date.now(), st: 'open', ret: 0, lb: 'Múltipla · ' + legs.length + ' seleções' }, extra || {});
  BETS.push(b); return b;
}
const resTxt = g => g.hs + '-' + g.as + (g.so ? ' (pen.)' : g.ot ? ' (prol.)' : '');
function settleMulti(b) {
  let eff = 1, pending = false, lost = false;
  b.legs.forEach(l => { const g = DB.g[l.g]; const r = g ? outcome(l, g) : null; l.r = r; if (g && g.hs != null) l.res = resTxt(g); if (r === null) pending = true; else if (r === 'lost') lost = true; else if (r === 'won') eff *= l.odd; });
  if (lost) { b.st = 'lost'; b.ret = 0; }
  else if (pending) return false;
  else { b.st = eff > 1.0001 ? 'won' : 'push'; b.ret = r2(b.stake * eff); }
  b.tset = Date.now(); return true;
}
function settleAll() {
  let n = 0;
  BETS.forEach(b => {
    if (b.st !== 'open') return;
    if (b.mk === 'multi') { if (settleMulti(b)) n++; return; }
    const g = DB.g[b.g]; if (!g) return;
    const r = outcome(b, g); if (!r) return;
    b.st = r; b.ret = r === 'won' ? r2(b.stake * b.odd) : (r === 'push' || r === 'void') ? b.stake : 0; b.res = g.hs != null ? resTxt(g) : ''; b.tset = Date.now(); n++;
  });
  if (n) saveBets();
  safeGrade();
  return n;
}
/* 🤖 piloto: aposta sozinho em cada «valor» do Gi — só com odds reais (ESPN ou Betano que meteste) */
/* =====================================================================
   🤖 Gi SOZINHO: um bot que aposta sozinho, sem ninguém lhe mexer.
   Regra fixa: em cada jogo das próximas 36 horas, aposta no vencedor que a
   cabeça dele (o modelo puro, sem copiar as odds) prefere, à odd da ESPN do
   momento. Valor fixo. Serve para ver como ele se porta de verdade.
   Teste às cegas 2023-27: acerta 58% dos vencedores (não há odds históricas grátis da NHL para medir o lucro).
   ===================================================================== */
const BOT_TEST = { acerto: 0.58, roi: null, n: null, txt: '58% de acerto (2023-27) · lucro por medir' };
function pilotRun() {
  if (!CFG.piOn) return 0;
  const now = Date.now(); let n = 0;
  const done = new Set(BETS.filter(b => b.acc === 'pi' && b.mk !== 'multi').map(b => b.g));
  Object.values(DB.g).filter(g => TEAMS[g.h] && TEAMS[g.a] && g.s === 'pre' && !done.has(g.id) && g.o && g.o.hml > 1 && g.o.aml > 1).sort((x, y) => x.d < y.d ? -1 : 1).forEach(g => {
    const t0 = new Date(g.d).getTime(); if (t0 < now + 5 * 60e3 || t0 > now + 36 * 3600e3) return;
    const P = predict(g), ph = P.mod.ml, sel = ph >= 0.5 ? 'h' : 'a', odd = sel === 'h' ? g.o.hml : g.o.aml;
    const nva = (1 / g.o.hml) / (1 / g.o.hml + 1 / g.o.aml);
    const stake = Math.max(CFG.min, r2(CFG.piStake)); if (accStats('pi').bal < stake) return;
    newBet('pi', g, { mk: 'ml', sel, line: null, odd }, stake, { auto: 1, pk: r2(sel === 'h' ? ph : 1 - ph), nv: r2(sel === 'h' ? nva : 1 - nva), src: g.o.p || 'ESPN' });
    n++;
  });
  if (n) saveBets();
  return n;
}
function botStats() {
  const B = BETS.filter(b => b.acc === 'pi' && b.auto), S = B.filter(b => b.st === 'won' || b.st === 'lost' || b.st === 'push');
  const w = S.filter(b => b.st === 'won').length, l = S.filter(b => b.st === 'lost').length;
  const plOf = L => r2(L.reduce((s, b) => s + (b.ret || 0) - b.stake, 0));
  const dog = S.filter(b => b.nv != null && b.nv < 0.5), fav = S.filter(b => b.nv != null && b.nv >= 0.5), conf = S.filter(b => b.pk >= 0.7);
  const st = S.reduce((s, b) => s + b.stake, 0), ret = S.reduce((s, b) => s + (b.ret || 0), 0);
  const byD = {}; S.forEach(b => { const k = String(b.gd).slice(0, 10); (byD[k] = byD[k] || []).push(b); });
  const days = Object.entries(byD).map(([k, L]) => ({ k, w: L.filter(b => b.st === 'won').length, l: L.filter(b => b.st === 'lost').length, pl: plOf(L) })).sort((a, b) => a.k < b.k ? 1 : -1);
  const byG = {}; S.forEach(b => { const k = ''; if (!k) return; const o = byG[k] = byG[k] || { n: 0, w: 0, pl: 0 }; o.n++; if (b.st === 'won') o.w++; o.pl += (b.ret || 0) - b.stake; });
  let run = 0; const curve = S.slice().sort((a, b) => (a.tset || a.t) - (b.tset || b.t)).map(b => (run += (b.ret || 0) - b.stake));
  return { n: B.length, open: B.filter(b => b.st === 'open').length, openL: B.filter(b => b.st === 'open'), w, l, p: S.length - w - l, hit: w + l ? w / (w + l) : null, roi: st ? (ret - st) / st : null, pl: r2(ret - st),
    dogN: dog.length, dogW: dog.filter(b => b.st === 'won').length, dogPl: plOf(dog), favN: fav.length, favW: fav.filter(b => b.st === 'won').length, favPl: plOf(fav), confN: conf.length, confW: conf.filter(b => b.st === 'won').length, days, byG, curve };
}


/* =====================================================================
   🛡️ BOLETIM SEGURO: seleções com ≥85% (e ≤95%, senão não paga nada),
   juntas enquanto o boletim inteiro fica ≥70%. Mercados de 60 min:
   dupla hipótese, handicap +1,5/+2,5, mais de 3,5/4,5, menos de 7,5/8,5.
   As odds são estimadas: para registar, mete as da Betano.
   ===================================================================== */
const SAFE_LEG = 0.85, SAFE_SLIP = 0.70;
function safeCands(dayOff) {
  const d = ymdAdd(todayET(), dayOff), now = Date.now(), out = [];
  Object.values(DB.g).filter(g => TEAMS[g.h] && TEAMS[g.a] && g.s === 'pre' && g.ed === d && new Date(g.d).getTime() > now + 10 * 60e3).forEach(g => {
    const P = predict(g), opts = [];
    const favH = P.pML >= 0.5;
    opts.push({ mk: 'dc', sel: favH ? '1x' : 'x2', line: null });
    [1.5, 2.5].forEach(L => { opts.push({ mk: 'hc', sel: favH ? 'a' : 'h', line: L }); opts.push({ mk: 'hc', sel: favH ? 'h' : 'a', line: L }); });
    [3.5, 4.5].forEach(L => opts.push({ mk: 'tot', sel: 'o', line: L }));
    [7.5, 8.5].forEach(L => opts.push({ mk: 'tot', sel: 'u', line: L }));
    opts.forEach(x => { x.p = probs(P, x.mk, x.sel, x.line).w; });
    bossPool(g, opts);
    const best = opts.filter(x => x.p >= SAFE_LEG && x.p <= 0.95).sort((a, b) => a.p - b.p)[0];
    if (best) out.push(Object.assign(best, { g, odd: r2(Math.max(1.02, 1 / (best.p * 1.06))), est: true, lb: selLabel(g, best.mk, best.sel, best.line) }));
  });
  return out.sort((a, b) => b.p - a.p);
}
function safeAuto(C) {
  const pick = new Set(); let P = 1;
  C.forEach((c, i) => { if (pick.size < 5 && (i === 0 || P * c.p >= SAFE_SLIP)) { P *= c.p; pick.add(i); } });
  return pick;
}
const safeLeg = (c, odd) => ({ g: c.g.id, gl: gLabel(c.g), gd: c.g.d, mk: c.mk, sel: c.sel, line: c.line, odd: r2(odd || c.odd), lb: c.lb, p: r2(c.p) });
function safeLogSave(list) {
  const L = LS.get('safe', {}); let ch = false;
  list.forEach(c => { const k = c.g.id + '|' + c.mk + '|' + c.sel + '|' + c.line; if (L[k]) return; L[k] = { g: c.g.id, mk: c.mk, sel: c.sel, line: c.line, p: r2(c.p), t: Date.now() }; ch = true; });
  const ks = Object.keys(L); if (ks.length > 500) ks.sort((a, b) => L[a].t - L[b].t).slice(0, ks.length - 500).forEach(k => delete L[k]);
  if (ch) LS.set('safe', L);
}
function safeGrade() {
  const L = LS.get('safe', {}); let ch = false;
  Object.values(L).forEach(l => { if (l.w != null) return; const g = DB.g[l.g]; if (!g) return; const r = outcome(l, g); if (r === 'won') l.w = 1; else if (r === 'lost') l.w = 0; else if (r) l.w = -1; else return; ch = true; });
  if (ch) LS.set('safe', L);
}
function safeStats() {
  const g = Object.values(LS.get('safe', {})).filter(l => l.w === 0 || l.w === 1);
  return g.length ? { n: g.length, w: g.filter(l => l.w === 1).length, p: g.reduce((a, l) => a + l.p, 0) / g.length } : null;
}
/* boletim seguro de cada dia, congelado antes do 1.º jogo */
function snapshotSlips() {
  [0, 1].forEach(off => {
    const d = ymdAdd(todayET(), off), old = SLIPS[d];
    if (old && (old.lock || old.legs.some(l => { const g = DB.g[l.g]; return !g || g.s !== 'pre' || new Date(g.d).getTime() <= Date.now(); }))) { if (old) old.lock = 1; return; }
    const C = safeCands(off), pick = safeAuto(C), legs = C.filter((_, i) => pick.has(i));
    if (!legs.length) return;
    SLIPS[d] = { legs: legs.map(c => safeLeg(c)), p: r2(legs.reduce((a, c) => a * c.p, 1)), odd: r2(legs.reduce((a, c) => a * c.odd, 1)), t: Date.now() };
  });
  const ks = Object.keys(SLIPS).sort(); if (ks.length > 60) ks.slice(0, ks.length - 60).forEach(k => delete SLIPS[k]);
  LS.set('slips', SLIPS);
}
function slipResult(S) {
  if (!S) return null; let w = 0, n = 0, lost = false, pend = false;
  S.legs.forEach(l => { const g = DB.g[l.g]; const r = g ? outcome(l, g) : null; l.r = r; if (r == null) pend = true; else { n++; if (r === 'won' || r === 'push') w++; if (r === 'lost') lost = true; } });
  return { w, n: S.legs.length, st: lost ? 'lost' : pend ? 'open' : 'won' };
}

/* =====================================================================
   📊 CARTÃO DA EQUIPA (0–99)
   ===================================================================== */
function teamRt(t) {
  const M = getModel(), r = M.rec[t] || { w: 0, l: 0, otl: 0, hw: 0, hl: 0, aw: 0, al: 0, gf: 0, ga: 0, last: [] };
  const gp = r.w + r.l + r.otl, l10 = (r.last || []).slice(-10), wf = l10.length ? l10.filter(x => x.w).length / l10.length : 0.5;
  const hp = r.hw + r.hl ? r.hw / (r.hw + r.hl) : 0.5, ap = r.aw + r.al ? r.aw / (r.aw + r.al) : 0.5;
  const k = v => Math.round(clamp(v, 25, 99));
  return { ovr: k(78 + strength(M, t) * 55), atk: k(76 + (M.A[t] || 0) * 90), def: k(76 + (M.D[t] || 0) * 90), form: k(45 + wf * 54), home: k(42 + hp * 57), away: k(42 + ap * 57), gp, l10, r };
}

/* =====================================================================
   📤 FICHA PARA O MISTER BOSS
   Em cada atualização, o Gi deixa no telemóvel as seleções do dia que
   passam dos 80% (e as apostas de valor), e confere as antigas com o seu
   próprio código de liquidação. O Mister Boss só lê esta ficha.
   ===================================================================== */
let BPOOL = null;
function bossPool(g, opts) {
  if (!BPOOL) return;
  opts.forEach(x => { const p = x.c != null ? x.c : x.p; if (p >= 0.80 && p <= 0.985) BPOOL.push({ g, mk: x.mk, sel: x.sel, line: x.line == null ? null : x.line, p, odd: x.odd || null, est: x.est !== false }); });
}
function bossFeed() {
  try {
    const F = LS.get('boss', null) || { v: 1, legs: {} }, now = Date.now();
    const gameOf = id => DB.g[id], segOf = g => ({ lg: 'NHL' }), glOf = g => gLabel(g);
    BPOOL = []; [0, 1].forEach(d => { try { safeCands(d); } catch (e) {} }); const pool = BPOOL; BPOOL = null;
    Object.values(DB.g).filter(g => g && g.s === 'pre' && new Date(g.d).getTime() > now && new Date(g.d).getTime() < now + 36 * 3600e3).forEach(g => {
      try { const v = predict(g).value; if (v) pool.push({ g, mk: v.mk, sel: v.sel, line: v.line == null ? null : v.line, p: v.p, odd: v.odd, est: false, val: r2(v.ev) }); } catch (e) {}
    });
    pool.forEach(x => {
      const id = x.g.id + '|' + x.mk + '|' + x.sel + '|' + x.line + (x.val != null ? '|v' : ''), L = F.legs[id];
      const rec = { id, g: x.g.id, gl: glOf(x.g), d: x.g.d, mk: x.mk, mkn: mkName(x.mk), sel: x.sel, line: x.line, lb: selLabel(x.g, x.mk, x.sel, x.line), p: Math.round(x.p * 1000) / 1000, odd: x.odd ? r2(x.odd) : null, est: !!x.est, val: x.val != null ? x.val : null, seg: segOf(x.g), st: 'open', t: now };
      if (!L) F.legs[id] = rec; else if (L.st === 'open' && new Date(L.d).getTime() > now) Object.assign(L, { p: rec.p, odd: rec.odd, est: rec.est, val: rec.val, t: now });
    });
    Object.values(F.legs).forEach(l => { if (l.st !== 'open') return; const g = gameOf(l.g); if (!g) return; let r = null; try { r = outcome(l, g); } catch (e) {} if (r) { l.st = r; l.tset = now; } });
    const ks = Object.keys(F.legs); if (ks.length > 900) ks.sort((a, b) => F.legs[a].t - F.legs[b].t).slice(0, ks.length - 900).forEach(k => delete F.legs[k]);
    Object.assign(F, { app: 'gi', name: 'Mister Gi', sport: 'Hóquei no gelo · NHL', ver: APP_VER, t: now });
    LS.set('boss', F);
  } catch (e) { console.warn('bossFeed', e); }
}
