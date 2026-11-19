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
  eq([m.ver, m.keepLv, m.res.eisen, m.res.bogen, typeof m.spill], [g.run("SAVE_VER"), 0, 0, 0, 'object']);
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
  g.ctx.__o = o; const m = g.run('migrate(__o)'); eq([m.ver, m.units.length, m.units[0].type, m.archers], [g.run("SAVE_VER"), 4, 'archer', undefined]);
});
// ---------- Etappe 4: Welt, Ereignisse, Markt ----------
const big = (size = 'gross', seed = 4242) => { const g = makeGame(11); g.run(`startGame(-1,{size:'${size}',seed:${seed}})`); return g; };
t('Große Karte: 32 × 40, Bergfried frei, alle Ränder mit Weg zum Bergfried', () => {
  const g = big(); eq(g.run('[COLS,ROWS,S.grid.length]'), [32, 40, 1280]); eq(g.run('S.grid[KI].b.type'), 'keep');
  eq(g.run('S.grid.some(t=>t.t===WATER)&&S.grid.some(t=>t.t===HILL)&&S.grid.some(t=>t.t===SWAMP)&&S.grid.some(t=>t.t===IRON)'), true, 'Fluss, Hügel, Sumpf, Eisen');
  g.run('ensure()');
  for (const side of ['r===0', 'r===ROWS-1', 'c===0', 'c===COLS-1']) eq(g.run(`(()=>{for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(${side}&&isFinite(dist[r*COLS+c]))return true;return false})()`), true, side);
});
t('Kartengenerator ist reproduzierbar, Kampagnenkarte unverändert bis auf Eisen', () => {
  const a = big('mittel', 7), b = big('mittel', 7); eq(a.run('S.grid.map(t=>t.t).join("")'), b.run('S.grid.map(t=>t.t).join("")'));
  const g = fresh(2); eq(g.run('[COLS,ROWS,KR,KC]'), [12, 20, 11, 5]); eq(g.run('S.grid.filter(t=>t.t===IRON).length>0'), true);
});
t('Brücke: nur auf Wasser, danach begehbar für Leute und Feinde', () => {
  const g = big(); const w = g.run('(()=>{for(let i=0;i<N;i++)if(S.grid[i].t===WATER&&!reason("bruecke",i/COLS|0,i%COLS))return i;return -1})()');
  eq(w >= 0, true); eq(g.run(`reason('bruecke',KR,KC+1)`), 'Brücken gehören aufs Wasser.');
  g.run('ensure()'); eq(g.run(`isFinite(dist[${w}])`), false);
  g.run(`S.res.holz=99;act('bruecke',${w}/COLS|0,${w}%COLS,true);ensure()`); eq(g.run(`isFinite(dist[${w}])&&walkT(S.grid[${w}])`), true);
});
t('Sumpf: nicht bebaubar, Feinde halb so schnell', () => {
  const g = big(); const sw = g.run('S.grid.findIndex(t=>t.t===SWAMP)');
  eq(g.run(`reason('haus',${sw}/COLS|0,${sw}%COLS)`), 'Im Sumpf kann nicht gebaut werden.');
  const move = onSwamp => { const k = makeGame(3); k.run(`startGame(2);const i=(KR-6)*COLS+KC;S.grid[i].t=${onSwamp ? 'SWAMP' : 'GRASS'};bump();ensure();
    S.enemies.push({w:1,type:'raider',r:KR-6,c:KC,x:KC+.5,y:KR-5.5,tr:KR-5,tc:KC,hp:99,max:99,cd:0,ign:1,wait:0,atk:null,ang:0,climb:0});S.raids=1;update(.2)`); return k.run('KR-5.5-S.enemies[0].y'); };
  eq(Math.round(move(true) / move(false) * 100) / 100, 0.5);
});
t('Hügel: Bogenschützen schießen 1 Feld weiter', () => {
  const g = fresh(); troops(g, ['archer']); g.run('order([S.units[0]],(KR+2)*COLS+KC+2)'); settle(g);
  const r0 = g.run('unitRange(S.units[0])'); g.run('S.grid[S.units[0].i].t=HILL'); eq(g.run('unitRange(S.units[0])'), r0 + 1);
});
t('Eisenmine nur am Eisenvorkommen', () => {
  const g = fresh(); eq(g.run('(()=>{for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=T(r,c);if(t.t===GRASS&&!t.b&&DIRS.some(([a,b])=>inb(r+a,c+b)&&T(r+a,c+b).t===ROCK)&&!DIRS.some(([a,b])=>inb(r+a,c+b)&&T(r+a,c+b).t===IRON))return reason("mine",r,c)}})()'),
    'Eisenminen müssen direkt an einem Eisenvorkommen stehen.');
  eq(g.run('(()=>{for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(!reason("mine",r,c))return true;return false})()'), true);
});
t('Markt: kaufen und verkaufen in Paketen, Lagergrenze gilt', () => {
  const g = fresh(); eq(g.run("trade('holz',-1)"), 'Erst einen Markt bauen'); place(g, 'markt');
  g.run('S.res.gold=100;S.res.stein=0'); eq(g.run("trade('stein',1)"), ''); eq(g.run('[S.res.stein,S.res.gold]'), [5, 100 - 15]);
  eq(g.run("trade('stein',-1)"), ''); eq(g.run('[S.res.stein,S.res.gold]'), [0, 85 + 7]);
  g.run('S.res.holz=storeCap("lager")'); eq(g.run("trade('holz',1)").startsWith('Kein Platz'), true);
});
t('Ereignisse: Seuche kostet Leute, Apotheke heilt', () => {
  const g = fresh(); g.run('S.pop=30;assignWorkers();triggerEvent("pest")'); eq(g.run('S.ev.pest'), g.run('PEST_DAYS'));
  g.run('eventTick()'); eq(g.run('S.pop'), 29); place(g, 'apotheke'); g.run('assignWorkers();eventTick()'); eq(g.run('[S.ev.pest,S.pop]'), [0, 29]);
});
t('Ereignisse: Missernte halbiert Höfe, Entscheidung Turnier', () => {
  const g = fresh(); g.run('S.ev.harvest=3'); eq(g.run("prodMult('farm',1)"), 0.5); eq(g.run("prodMult('obst',2)"), 1);
  g.run('S.res.gold=100;S.pop=20;S.pp=50;triggerEvent("tourney")'); eq(g.run('S.ev.pending.id'), 'tourney');
  eq(g.run('resolveEvent(0)'), ''); eq(g.run('[S.res.gold,S.pp,S.ev.pending]'), [50, 60, null]);
  g.run('S.res.gold=10;triggerEvent("tourney")'); eq(g.run('resolveEvent(0)'), 'Nicht genug Gold'); g.run('dayTick()'); eq(g.run('S.ev.pending'), null, 'offene Entscheidung verfällt');
});
t('Wölfe zählen nicht als Angriffswelle', () => {
  const g = fresh(); g.run('spawnWolves(2)'); eq(g.run('S.enemies.length'), 2); g.run('for(const e of S.enemies)e.hp=0;update(.01)'); eq(g.run('S.repelled'), 0);
});
t('Migration: Version 4 bekommt Eisen und Ereignisse', () => {
  const g = fresh(); const o = g.run('(()=>{const o=JSON.parse(JSON.stringify(S));o.ver=4;delete o.ev;o.grid.forEach(t=>{if(t.t===IRON)t.t=GRASS});return o})()');
  g.ctx.__o = o; const m = g.run('migrate(__o)'); eq([m.ver, typeof m.ev, m.grid.some(t => t.t === 6)], [g.run('SAVE_VER'), 'object', true]);
});
if (failed) { console.error(`✗ ${failed} Logik-Test(s) fehlgeschlagen`); process.exitCode = 1; } else console.log('Logik-Tests bestanden');
