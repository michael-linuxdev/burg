// Headless-Tests der Spielregeln (ohne Browser). Lädt die Logik wie tools/sim.mjs in einen vm-Kontext.
import { makeGame } from '../tools/sim.mjs';
let failed = 0;
const t = (name, fn) => { try { fn(); console.log('✓ ' + name); } catch (e) { failed++; console.error('✗ ' + name + ': ' + e.message); } };
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`); };
const fresh = (mi = 2) => { const g = makeGame(7); g.run(`startGame(${mi})`); return g; };
// freies Feld für k suchen und bauen
const place = (g, k) => g.run(`(()=>{for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(!reason('${k}',r,c)){S.res.holz+=100;S.res.stein+=100;act('${k}',r,c,true);return [r,c]}return null})()`);

t('Lager: Überschuss verfällt und wird gemeldet', () => {
  const g = fresh(); g.run('S.res.holz=500;clampRes()');
  eq(g.run('S.res.holz'), g.run('storeCap("lager")')); eq(g.run('S.spill.holz>0'), true);
});
t('Lager erhöht die Kapazität um 100, Abriss senkt sie wieder', () => {
  const g = fresh(); const c0 = g.run('storeCap("lager")'); const p = place(g, 'lager');
  eq(g.run('storeCap("lager")'), c0 + 100); g.run(`act('abriss',${p[0]},${p[1]},true)`); eq(g.run('storeCap("lager")'), c0);
});
t('Kornkammer begrenzt Brot und Äpfel', () => {
  const g = fresh(); g.run('S.res.brot=999;S.res.aepfel=999;clampRes()');
  eq(g.run('S.res.brot'), g.run('storeCap("korn")')); eq(g.run('S.res.aepfel'), g.run('storeCap("korn")'));
});
t('Bogenschütze kostet Gold und einen Bogen', () => {
  const g = fresh(); place(g, 'kaserne'); g.run('S.res.gold=100;S.res.bogen=1;S.pop=20;assignWorkers()');
  eq(g.run('recruit()'), ''); eq(g.run('[S.res.gold,S.res.bogen,S.units.length]'), [88, 0, 1]);
  eq(g.run('recruit()'), 'Keine Bögen in der Rüstkammer');
});
t('Schmied: Speere oder Schwerter je nach Modus', () => {
  const g = fresh(); const p = place(g, 'schmied'); g.run('S.pop=30;S.res.eisen=10;S.res.holz=10;S.res.speer=0;S.res.schwert=0;assignWorkers()');
  g.run('dayTick()'); eq(g.run('[S.res.speer,S.res.schwert]'), [1, 0]);
  g.run(`T(${p[0]},${p[1]}).b.mode='schwert'`); g.run('dayTick()'); eq(g.run('[S.res.speer,S.res.schwert]'), [1, 1]);
});
t('Waffenkette: Viehweide → Gerberei, Bogenmacher', () => {
  const g = fresh(); place(g, 'weide'); place(g, 'gerber'); place(g, 'bogner'); g.run('S.pop=30;S.day=1;S.res.haeute=0;S.res.leder=0;S.res.bogen=0;assignWorkers()');
  g.run('dayTick()'); eq(g.run('[S.res.haeute,S.res.leder]'), [0, 1], 'Häute werden am selben Tag gegerbt'); eq(g.run('S.res.bogen'), 1);
});
t('Burgausbau: Holzburg → Steinburg → Festung', () => {
  const g = fresh(); eq(g.run('KEEP_LV[S.keepLv].n'), 'Holzburg');
  g.run('S.res.holz=200;S.res.stein=200;S.res.gold=400;S.res.eisen=50');
  eq(g.run('upgradeKeep()'), ''); eq(g.run('[S.keepLv,S.keepMax,cap()-count("haus")*8]'), [1, 300, 20]);
  eq(g.run('upgradeKeep()'), ''); eq(g.run('[S.keepLv,S.keepMax]'), [2, 500]);
  eq(g.run('upgradeKeep()'), 'Die Burg ist voll ausgebaut.');
});
t('Migration: Spielstand Version 2 bekommt neue Rohstoffe und Burgstufe', () => {
  const g = fresh(); const o = g.run('(()=>{const o=JSON.parse(JSON.stringify(S));o.ver=2;delete o.keepLv;delete o.res.eisen;delete o.res.bogen;delete o.spill;return o})()');
  g.ctx.__o = o; const m = g.run('migrate(__o)');
  eq([m.ver, m.keepLv, m.res.eisen, m.res.bogen, typeof m.spill], [4, 0, 0, 0, 'object']);
});
t('Überlappende Wellen zählen einzeln', () => {
  const g = fresh(); g.run('S.raidSide="Norden";spawnWave();S.raidSide="Norden";spawnWave()');
  g.run('for(const e of S.enemies)if(e.w===1)e.hp=0;update(0.01)'); eq(g.run('S.repelled'), 1);
});
if (failed) { console.error(`✗ ${failed} Logik-Test(s) fehlgeschlagen`); process.exitCode = 1; } else console.log('Logik-Tests bestanden');
