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
// Mauerring mit Radius 3 um den Bergfried (Türme an den Ecken), optional mit Tor im Süden
const ring = (g, gate = true) => g.run(`(()=>{S.res.stein=999;S.res.holz=999;for(let r=KR-3;r<=KR+3;r++)for(let c=KC-3;c<=KC+3;c++)if(Math.max(Math.abs(r-KR),Math.abs(c-KC))===3){
  const k=(${gate}&&r===KR+3&&c===KC)?'tor':(Math.abs(r-KR)===3&&Math.abs(c-KC)===3)?'turm':'mauer';act(k,r,c,true)}})()`);
const troops = (g, list) => g.run(`(()=>{S.res.holz+=50;S.res.stein+=50;act('kaserne',KR+1,KC+1,true);S.pop=40;S.res.gold=999;S.res.bogen=20;S.res.speer=20;S.res.schwert=20;S.res.leder=20;assignWorkers();
  return ${JSON.stringify(list)}.map(t=>recruit(t))})()`);
const settle = (g, s = 20) => g.run(`for(let i=0;i<${s * 10};i++)updateUnits(.1)`);
t('Truppen: Wege über Mauern, aber nicht über die Mauer nach draußen', () => {
  const g = fresh(); ring(g, false); eq(troops(g, ['archer', 'spear']), ['', '']);
  // Bogenschütze steigt vom Bergfried auf die Nordmauer und von dort auf den Eckturm
  eq(g.run('order([S.units[0]],(KR-3)*COLS+KC)'), 1); settle(g);
  eq(g.run('S.units[0].i===(KR-3)*COLS+KC&&isUp(S.units[0].i)'), true);
  eq(g.run('order([S.units[0]],(KR-3)*COLS+KC-3)'), 1); settle(g); eq(g.run('S.grid[S.units[0].i].b.type'), 'turm');
  // ohne Tor kein Weg nach draußen
  eq(g.run('unitPath(S.units[1].i,(KR-5)*COLS+KC)'), null);
  eq(g.run('order([S.units[1]],(KR-5)*COLS+KC)'), 0);
});
t('Truppen: mit Tor kommen Nahkämpfer hinaus, Reichweite auf dem Turm größer', () => {
  const g = fresh(); ring(g, true); troops(g, ['spear', 'archer']); settle(g, 5);
  eq(g.run('order([S.units[0]],(KR+5)*COLS+KC)'), 1); settle(g); eq(g.run('S.units[0].i'), g.run('(KR+5)*COLS+KC'));
  const base = g.run('UNIT.archer.range'); g.run('order([S.units[1]],(KR-3)*COLS+KC-3)'); settle(g);
  eq(g.run('unitRange(S.units[1])'), base + 1.4);
});
t('Leitermänner klettern über die Mauer statt sie einzuschlagen', () => {
  const g = fresh(); ring(g, false); g.run('ensure()');
  g.run(`S.enemies.push({w:1,type:'ladder',r:KR-6,c:KC,x:KC+.5,y:KR-5.5,tr:null,tc:null,hp:999,max:999,cd:0,ign:1,wait:0,atk:null,ang:0,climb:0});S.raids=1`);
  const hp0 = g.run('S.grid.filter(t=>t.b&&isWall(t.b)).reduce((a,t)=>a+t.b.hp,0)');
  let climbed = false;
  for (let i = 0; i < 400 && g.run('S.enemies[0].atk!=="keep"'); i++) { g.run('update(.05)'); if (g.run('S.enemies[0].climb>0')) climbed = true; }
  eq(climbed, true, 'kletterte'); eq(g.run('S.enemies[0].atk'), 'keep', 'erreicht den Bergfried');
  eq(g.run('S.grid.filter(t=>t.b&&isWall(t.b)).reduce((a,t)=>a+t.b.hp,0)'), hp0, 'Mauern unbeschädigt');
});
t('Speerträger: dreifacher Schaden gegen Rammböcke', () => {
  const dmg = type => {
    const g = fresh(); troops(g, [type]); settle(g, 5);
    g.run(`(()=>{const u=S.units[0];S.enemies.push({w:1,type:'ram',r:u.i/COLS|0,c:u.i%COLS,x:u.x+.5,y:u.y,tr:null,tc:null,hp:100,max:100,cd:9,ign:1,wait:0,atk:'keep',ang:0,climb:0});u.cd=0})()`);
    g.run('updateUnits(.01)'); return g.run('100-S.enemies[0].hp');
  };
  const sp = dmg('spear'), sw = dmg('sword');
  eq(Math.round(sp * 100) / 100, Math.round(3 * 3 * 0.34 * 100) / 100, 'Speer');
  eq(sp > sw, true, 'Speer schlägt Schwert gegen Ramme');
});
t('Feindliche Bogenschützen beschießen Truppen auf der Mauer (mit Deckung)', () => {
  const g = fresh(); ring(g, false); troops(g, ['archer']); g.run('order([S.units[0]],(KR-3)*COLS+KC)'); settle(g);
  g.run(`S.enemies.push({w:1,type:'archer',r:KR-6,c:KC,x:KC+.5,y:KR-5.5,tr:null,tc:null,hp:999,max:999,cd:0,ign:1,wait:0,atk:null,ang:0,climb:0});S.raids=1`);
  g.run('S.units[0].cd=99;update(.1)'); eq(g.run('UNIT.archer.hp-S.units[0].hp'), 2 * 0.5, 'Deckung auf der Mauer halbiert den Pfeilschaden');
});
t('Migration: Version 3 mit Bogenschützen wird zu Einheiten', () => {
  const g = fresh(); const o = g.run('(()=>{const o=JSON.parse(JSON.stringify(S));o.ver=3;o.archers=4;delete o.units;return o})()');
  g.ctx.__o = o; const m = g.run('migrate(__o)'); eq([m.ver, m.units.length, m.units[0].type, m.archers], [4, 4, 'archer', undefined]);
});
if (failed) { console.error(`✗ ${failed} Logik-Test(s) fehlgeschlagen`); process.exitCode = 1; } else console.log('Logik-Tests bestanden');
