// Burgwacht – Headless-Simulation zum Abstimmen der Missionen.
// Lädt die reinen Logikdateien (ohne DOM) in einen vm-Kontext und lässt einen einfachen Bot spielen.
//
//   node tools/sim.mjs                 alle Missionen, je 20 Durchläufe
//   node tools/sim.mjs 4 50            nur Mission 5 (Index 4), 50 Durchläufe
//   node tools/sim.mjs all 20 --log    mit Tagesprotokoll des ersten Durchlaufs
//
// Der Bot ist bewusst mittelmäßig (feste Prioritätenliste, keine Vorausplanung) und steht für einen
// durchschnittlichen Spieler. Zielwerte: Mission 1–3 ≥ 90 % Siege, Mission 5 etwa 50–80 %.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOGIC = ['data.js', 'core.js', 'economy.js', 'combat.js', 'units.js', 'events.js', 'maps.js'];

// Neuen, isolierten Spielkontext erzeugen. Math.random wird durch einen Seed-Zufall ersetzt (reproduzierbar).
export function makeGame(seed = 1) {
  let a = seed >>> 0;
  const rand = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const M = Object.create(Math); M.random = rand;
  const ctx = vm.createContext({ Math: M, console, JSON, Date, Object, Array, Uint8Array, Int32Array, Int16Array, Float64Array, Set, Map, Infinity, isFinite });
  for (const f of LOGIC) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
  // Zugriff auf die globalen let/const-Bindungen des Kontexts
  const G = new Proxy({}, { get: (_, k) => vm.runInContext(k, ctx), set: (_, k, v) => { ctx.__v = v; vm.runInContext(`${k}=__v`, ctx); return true; } });
  const log = [];
  vm.runInContext('H.say=m=>__log.push(S?("Tag "+S.day+": "+m):m)', Object.assign(ctx, { __log: log }));
  return { ctx, G, log, run: code => vm.runInContext(code, ctx) };
}

// ---------- Bot ----------
function bot(g) {
  const { G } = g, S = G.S, B = G.B, m = G.mission();
  const T = (r, c) => S.grid[r * G.COLS + c];
  const cnt = k => G.count(k);
  const can = k => G.has(B[k].cost);
  const KR = G.KR, KC = G.KC, ROWS = G.ROWS, COLS = G.COLS;
  const raids = !!m.raid, fire = m.raid && m.raid.fire < 50, ram = m.raid && m.raid.ram < 50;
  const R = 3; // Radius des Mauerrings (Chebyshev), innerhalb der Reichweite des Bergfrieds
  const inRing = (r, c) => Math.max(Math.abs(r - KR), Math.abs(c - KC)) < R;
  // bestes Feld für k: erlaubt, möglichst nah am Bergfried, bei Angriffen innerhalb des Rings bevorzugt (außer Rohstoffe)
  const spot = (k, inside) => {
    let best = null, bd = 1e9;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (G.reason(k, r, c)) continue;
      if (Math.max(Math.abs(r - KR), Math.abs(c - KC)) === R && raids) continue; // Ringlinie freihalten
      let d = Math.hypot(r - KR, c - KC);
      if (inside && raids && !inRing(r, c)) d += 20;
      if (d < bd) { bd = d; best = [r, c]; }
    }
    return best;
  };
  const build = (k, inside = true) => { if (!can(k)) return false; const s = spot(k, inside); if (!s) return false; return !!G.act(k, s[0], s[1], true); };
  const pop = S.pop, need = Math.ceil(pop * .3), sea = G.seasonOf(S.day);
  const foodDay = cnt('obst') * 3 + cnt('baecker') * 10 * (cnt('muehle') > 0 ? 1 : 0);
  // Steuern und Rationen
  if (S.pp < 52) S.tax = Math.max(1, S.tax - 1); else if (S.pp > 68 && S.tax < 3) S.tax++;
  S.ration = S.res.brot + S.res.aepfel > pop * 4 && S.pp < 60 ? 3 : 2;
  // Prioritäten
  const wantFood = Math.max(need * 1.6, 4);
  if (cnt('holzf') < 1) return build('holzf', false);
  if (cnt('obst') * 3 < Math.min(wantFood, 9) && build('obst')) return;
  if (cnt('holzf') < 2 && build('holzf', false)) return;
  if (pop >= G.cap() - 3 && build('haus')) return;
  if (raids && cnt('stein') < 1 && build('stein', false)) return;
  // Lager erweitern, wenn eine Lagerart fast voll ist
  const full = kind => Object.keys(G.STORE).some(k => G.STORE[k] === kind && S.res[k] >= G.storeCap(kind) * .85);
  if (full('lager') && build('lager')) return;
  if (full('korn') && build('korn')) return;
  if (raids && cnt('kaserne') && cnt('bogner') < 1 && build('bogner')) return;
  if (cnt('bogner') && full('waffen') && cnt('ruest') < 1 && build('ruest')) return;
  if ((m.goals.some(x => x[0] === 'brot') || pop > 24) && cnt('farm') < 1 && build('farm')) return;
  if (cnt('farm') && cnt('muehle') < 1 && build('muehle')) return;
  if (cnt('muehle') && cnt('baecker') < 1 && build('baecker')) return;
  if (foodDay < wantFood && build('obst')) return;
  if (raids && cnt('stein') < (ram ? 3 : 2) && S.day > 5 && build('stein', false)) return;
  if (cnt('holzf') < 3 && S.day > 8 && build('holzf', false)) return;
  // Ab Mission 6 (große Karten): Kaserne und Werkstätten vor dem Mauerring, Ziel Schwerter, Goldüberschuss in Truppen,
  // Belagerung. Missionen 1–5 bleiben davon unberührt, damit ihr Balancing gleich bleibt.
  if (S.mi >= 5 && late(g)) return;
  if (raids) {
    // Mauerring mit Tor im Süden und Türmen an den Ecken
    for (let r = KR - R; r <= KR + R; r++) for (let c = KC - R; c <= KC + R; c++) {
      if (Math.max(Math.abs(r - KR), Math.abs(c - KC)) !== R || !G.inb(r, c)) continue;
      const t = T(r, c); if (t.b || t.t !== 0) continue;
      const corner = Math.abs(r - KR) === R && Math.abs(c - KC) === R;
      const mid = (Math.abs(r - KR) === R && c === KC) || (Math.abs(c - KC) === R && r === KR);
      const k = r === KR + R && c === KC ? 'tor' : corner || mid ? 'turm' : 'mauer';
      if (can(k)) { G.act(k, r, c, true); }
    }
    if (cnt('kaserne') < 1 && build('kaserne')) return;
    // Türme in der Mitte der Seiten nachrüsten, sobald die Ecken stehen
    if (fire && cnt('brunnen') < 2 && build('brunnen')) return;
    // Burg ausbauen, sobald der Ring steht und es bezahlbar ist
    if (cnt('turm') >= 3 && !g.run('upgradeWhy()') && S.res.gold > 60) g.run('upgradeKeep()');
    // Bogenschützen ausbilden, Reserve 20 Gold
    while (S.idle > 1 && S.res.gold >= 12 + 15 && S.units.length < 3 + cnt('turm') * 3 && !g.run('recruit()'));
    // Speerträger gegen Rammböcke: hinter das Tor stellen
    if (ram && S.res.speer > 0 && S.idle > 1 && S.res.gold >= 8 + 15 && S.units.filter(u => u.type === 'spear').length < 4 && !g.run("recruit('spear')")) {
      const gi = (KR + R - 1) * COLS + KC; g.ctx.__gi = gi; g.run("order(S.units.filter(u=>u.type==='spear'),__gi)");
    }
  }
  // Ereignisse: bei Seuche eine Apotheke, Feste nur mit Goldpolster und sinkender Beliebtheit
  if (S.ev.pending) g.run(S.ev.pending.id !== 'trader' && S.pp < 62 && S.res.gold > 110 ? 'resolveEvent(0)' : 'resolveEvent(-1)');
  if (S.ev.pest > 0 && cnt('apotheke') < 1 && build('apotheke')) return;
  if (cnt('kapelle') < 2 && S.pp < 60 && build('kapelle')) return;
  // Brände löschen
  for (const t of S.grid) if (t.b && t.b.burn && S.res.gold >= 2) { S.res.gold -= 2; t.b.burn = 0; }
}

function late(g) {
  const { G } = g, S = G.S, B = G.B, m = G.mission(), cnt = k => G.count(k), COLS = G.COLS;
  const build = (k, inside = true) => { if (!G.has(B[k].cost)) return false; let best = null, bd = 1e9;
    g.run('ensure()'); const reach = G.reach;// nur Felder, die deine Leute erreichen (nicht hinter dem Fluss)
    for (let r = 0; r < G.ROWS; r++) for (let c = 0; c < COLS; c++) { if (G.reason(k, r, c) || !reach[r * COLS + c]) continue; if (Math.max(Math.abs(r - G.KR), Math.abs(c - G.KC)) === 3) continue; const d = Math.hypot(r - G.KR, c - G.KC); if (d < bd) { bd = d; best = [r, c]; } }
    return !!best && !!G.act(k, best[0], best[1], true); };
  const units = t => S.units.filter(u => u.type === t);
  if (cnt('stein') < 2 && S.day > 3 && build('stein', false)) return true;
  if (S.res.holz < 50 && cnt('holzf') < 7 && S.day > 4 && build('holzf', false)) return true;
  if (m.raid && cnt('kaserne') < 1 && S.day > 4 && build('kaserne')) return true;
  if (m.fort && cnt('kaserne') && cnt('werkstatt') < 1) { build('werkstatt'); return true; }
  if (m.goals.some(x => x[0] === 'schwert')) {
    if (cnt('mine') < 1) { if (build('mine', false)) return true; }
    else if (cnt('schmied') < 1) { build('schmied'); return true; }
    for (const t of S.grid) if (t.b && t.b.type === 'schmied') t.b.mode = 'schwert';
    if (cnt('mine') && cnt('mine') < 2 && S.res.holz > 60 && build('mine', false)) return true;
  }
  if (m.raid) {
    if (S.res.gold > 150 && cnt('markt') < 1 && build('markt')) return true;
    if (cnt('markt') && S.res.gold > 110 && S.res.bogen < 2) g.run("trade('bogen',1)");
    while (S.idle > 2 && S.res.gold >= 12 + 40 && S.units.length < 9 + cnt('turm') * 3 && !g.run('recruit()'));
    // großes Goldpolster: Bögen am Markt kaufen und weitere Schützen ausbilden
    for (let k = 0; k < 4 && S.res.gold > 160 && S.idle > 3; k++) { if (S.res.bogen < 1 && cnt('markt')) g.run("trade('bogen',1)"); if (g.run('recruit()')) break; }
  }
  if (m.fort && !S.foeDown) siegeBot(g);
  return false;
}
// Belagerung: Katapulte schleifen die Türme am Tor, dann Rammböcke und Nahkämpfer ans Tor, danach auf Wachen und Bergfried
function siegeBot(g) {
  const { G } = g, S = G.S, B = G.B, cnt = k => G.count(k), COLS = G.COLS, N = G.N;
  if (cnt('kaserne') && cnt('werkstatt') < 1) { let best = null, bd = 1e9; for (let r = 0; r < G.ROWS; r++) for (let c = 0; c < COLS; c++) if (!G.reason('werkstatt', r, c)) { const d = Math.hypot(r - G.KR, c - G.KC); if (d < bd && Math.max(Math.abs(r - G.KR), Math.abs(c - G.KC)) !== 3) { bd = d; best = [r, c]; } } if (best) G.act('werkstatt', best[0], best[1], true); }
  const n = t => S.units.filter(u => u.type === t).length;
  if (cnt('werkstatt')) { if (n('kat') < 3) g.run("recruit('kat')"); if (n('sram') < 2) g.run("recruit('sram')"); }
  for (const t of ['knight', 'sword', 'spear']) if (S.idle > 2 && S.res.gold > 60) g.run(`recruit('${t}')`);
  if (n('kat') < 2) return;
  const foe = k => { const l = []; for (let i = 0; i < N; i++) { const b = S.grid[i].b; if (b && b.type === k) l.push(i); } return l; };
  const gate = foe('ftor')[0], keep = foe('fkeep')[0], f = S.fort, gr = gate != null ? (gate / COLS | 0) : f.r + 3;
  const near = foe('fturm').filter(i => Math.abs((i / COLS | 0) - gr) <= 1).sort((a, b) => Math.abs(a % COLS - f.c) - Math.abs(b % COLS - f.c));
  const idle = u => u.tgtB == null && !u.tgt && !u.path.length;
  g.ctx.__l = S.units.filter(u => u.type === 'kat' && idle(u)); g.ctx.__t = near.length ? near[0] : gate != null ? gate : keep; g.run('orderAttackB(__l,__t)');
  if (near.length) return;
  const melee = S.units.filter(u => (u.type === 'sram' || G.UNIT[u.type].reach) && idle(u));
  const guards = S.enemies.filter(e => e.def && e.hp > 0 && !e.fixed);
  if (gate != null) { g.ctx.__l = melee; g.ctx.__t = gate; g.run('orderAttackB(__l,__t)'); return; }
  g.ctx.__l = melee.filter(u => u.type === 'sram'); g.ctx.__t = keep; g.run('orderAttackB(__l,__t)');
  const fighters = melee.filter(u => u.type !== 'sram');
  if (guards.length) { g.ctx.__l = fighters; g.ctx.__e = guards[0]; g.run('orderAttack(__l,__e)'); }
  else { g.ctx.__l = fighters; g.ctx.__t = keep; g.run('orderAttackB(__l,__t)'); }
}

export function playMission(mi, seed, { maxDays = 160, dt = 0.05, verbose = false, until = 0, setup = '' } = {}) {
  const g = makeGame(seed);
  g.run(`startGame(${mi})`);
  if (setup) g.run(setup); // z. B. Ereignisse für Vergleiche abschalten
  let minKeep = 150, maxGold = 0, t = 0, lastBot = -1;
  const days = [];
  while (true) {
    const S = g.G.S;
    if (S.won || S.over || S.day > maxDays || (until && S.day >= until)) break;
    const tick = Math.floor(S.clock / 1) + S.day * 4;
    if (tick !== lastBot) { lastBot = tick; bot(g); }
    g.run(`step(${dt})`);
    t += dt;
    minKeep = Math.min(minKeep, S.keepHp); maxGold = Math.max(maxGold, S.res.gold);
    if (verbose && S.clock < dt) days.push(`Tag ${S.day}: Einw ${S.pop}/${g.G.cap()} pp ${Math.round(S.pp)} Gold ${S.res.gold} Holz ${S.res.holz} Stein ${S.res.stein} Essen ${S.res.aepfel + S.res.brot} Truppen ${S.units.length} Feinde ${S.enemies.length}`);
  }
  const S = g.G.S;
  return { g, won: S.won, lost: S.over, day: S.day, repelled: S.repelled, pop: S.pop, gold: S.res.gold, maxGold, minKeep: Math.round(minKeep), log: g.log, days };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2] || 'all', runs = +process.argv[3] || 20, verbose = process.argv.includes('--log');
  const g0 = makeGame(1);
  const n = g0.run('MISSIONS.length');
  const list = arg === 'all' ? [...Array(n).keys()] : arg.split(',').map(Number);
  const check = process.argv.includes('--check');
  // Zielbereiche der Siegquote je Mission (für --check, z. B. in CI)
  const TARGET = { 0: [.9, 1], 1: [.9, 1], 2: [.9, 1], 3: [.8, 1], 4: [.5, .9], 5: [.8, 1], 6: [.8, 1], 7: [.7, 1], 8: [.5, .9], 9: [.5, .9] };
  let bad = 0;
  console.log('Mission                      Siege   Ø Tage   Ø Einw.  Ø Gold  max Gold  min Bergfried');
  for (const mi of list) {
    const res = [];
    for (let i = 0; i < runs; i++) res.push(playMission(mi, 1000 + i * 7919, { verbose: verbose && i === 0 }));
    const won = res.filter(r => r.won), avg = (a, k) => a.length ? (a.reduce((s, r) => s + r[k], 0) / a.length) : 0;
    const name = g0.run(`MISSIONS[${mi}].n`);
    console.log(`${String(mi + 1).padStart(2)} ${name.padEnd(25)} ${String(Math.round(won.length / runs * 100)).padStart(4)} %  ${avg(won, 'day').toFixed(1).padStart(6)}  ${avg(res, 'pop').toFixed(1).padStart(7)}  ${avg(res, 'gold').toFixed(0).padStart(6)}  ${avg(res, 'maxGold').toFixed(0).padStart(8)}  ${avg(res, 'minKeep').toFixed(0).padStart(8)}`);
    if (verbose) { console.log(res[0].days.join('\n')); console.log(res[0].log.slice(-15).join('\n')); }
    const tg = TARGET[mi], q = won.length / runs;
    if (check && tg && (q < tg[0] || q > tg[1])) { bad++; console.error(`  ✗ Siegquote ${Math.round(q * 100)} % außerhalb von ${tg[0] * 100}–${tg[1] * 100} %`); }
  }
  if (check) { console.log(bad ? '✗ Balancing außerhalb der Zielwerte' : '✓ Balancing in den Zielwerten'); process.exitCode = bad ? 1 : 0; }
}
