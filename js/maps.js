// Burgwacht – Eigene Karten (Kartenschmiede): Kartenformat, Prüfung, Umwandlung in eine spielbare Mission. Kein DOM.
//
// Kartenformat (Version 1), auch Grundlage für den späteren Mehrspielermodus (docs/MULTIPLAYER.md):
// {v:1, n:Name, s:Beschreibung, cols, rows, kr, kc,           Größe und Bergfried
//  t:Gelände als Lauflängen „Wert*Anzahl“ mit Punkt getrennt,  z. B. "0*40.1*3.0*12"
//  res:{Rohstoff:Menge}, pop, goals:[[Typ,Ziel]], raid:{start,every,scale,fire,ram,ladder,archer}|null, events:true|false}
const MAP_VER=1,MAP_KEY='zinnenwerk-maps';
const GOAL_TYPES=['pop','brot','raids','pp','day','schwert'];
function rleEncode(arr){const out=[];for(let i=0;i<arr.length;){let j=i;while(j<arr.length&&arr[j]===arr[i])j++;out.push(arr[i]+'*'+(j-i));i=j}return out.join('.')}
function rleDecode(s,n){const out=[];for(const part of String(s).split('.')){const[v,k]=part.split('*').map(Number);if(!(v>=0&&v<=6)||!(k>0))return null;for(let q=0;q<k;q++)out.push(v)}return out.length===n?out:null}
// Karte aus dem aktuellen Spielzustand (Kartenschmiede) erzeugen
function mapFromState(meta){
  return{v:MAP_VER,n:meta.n||'Eigene Karte',s:meta.s||'',cols:COLS,rows:ROWS,kr:KR,kc:KC,t:rleEncode(S.grid.map(t=>t.t)),
    res:{...meta.res},pop:meta.pop,goals:meta.goals.map(g=>[...g]),raid:meta.raid?{...meta.raid}:null,events:meta.events!==false};
}
const clampN=(v,a,b,d)=>{v=Math.round(+v);return Number.isFinite(v)?Math.max(a,Math.min(b,v)):d};
// Prüft und bereinigt eine Karte (z. B. aus einer Datei oder einem Link). Rückgabe: saubere Karte oder null.
function validateMap(o){
  try{
    if(!o||typeof o!=='object'||o.v!==MAP_VER)return null;
    const cols=clampN(o.cols,8,40,0),rows=clampN(o.rows,8,48,0);if(!cols||!rows)return null;
    const t=rleDecode(o.t,cols*rows);if(!t)return null;
    const kr=clampN(o.kr,2,rows-3,-1),kc=clampN(o.kc,2,cols-3,-1);if(kr<0||kc<0)return null;
    const res={};for(const k of Object.keys(BASE))res[k]=clampN(o.res&&o.res[k],0,999,0);
    const goals=(Array.isArray(o.goals)?o.goals:[]).filter(g=>Array.isArray(g)&&GOAL_TYPES.includes(g[0])).slice(0,4).map(g=>[g[0],clampN(g[1],1,999,1)]);
    let raid=null;if(o.raid&&typeof o.raid==='object'){const R=o.raid;raid={start:clampN(R.start,2,200,8),every:clampN(R.every,2,60,7),scale:Math.max(.2,Math.min(4,+R.scale||1))};
      for(const k of['fire','ram','ladder','archer'])raid[k]=clampN(R[k],1,99,99)}
    return{v:MAP_VER,n:String(o.n||'Eigene Karte').slice(0,40),s:String(o.s||'').slice(0,300),cols,rows,kr,kc,t:rleEncode(t),res,pop:clampN(o.pop,1,200,10),goals,raid,events:o.events!==false};
  }catch(e){return null}
}
// Mission aus einer Karte (für mission(), wenn S.mi === CUSTOM)
const CUSTOM=-2;
function customDef(map){return{n:map.n,s:map.s,res:map.res,pop:map.pop,goals:map.goals,raid:map.raid,events:map.events,map:{cols:map.cols,rows:map.rows},keep:[map.kr,map.kc],custom:map}}
function customGrid(map){const t=rleDecode(map.t,map.cols*map.rows);const g=t.map(v=>({t:v,b:null}));
  for(let r=map.kr-1;r<=map.kr+1;r++)for(let c=map.kc-1;c<=map.kc+1;c++)g[r*map.cols+c].t=GRASS;
  g[map.kr*map.cols+map.kc].b={type:'keep',id:0};return g}
// Gespeicherte eigene Karten
function loadMaps(){try{const l=JSON.parse(store.get(MAP_KEY)||'[]');return Array.isArray(l)?l.map(validateMap).filter(Boolean):[]}catch(e){return[]}}
function saveMaps(list){store.set(MAP_KEY,JSON.stringify(list))}
// ---------- Burgformat (Vorbereitung Mehrspieler, siehe docs/MULTIPLAYER.md) ----------
// Erweitert das Kartenformat um Gebäude, Burgstufe und Verteidiger. Wird im Spiel noch nicht genutzt.
// {cv:1, map:<Karte v1>, keepLv, b:[[Typ, r, c, Modus?]], d:[[Einheit, r, c]], power}
const CASTLE_VER=1,CASTLE_TYPES=Object.keys(B).filter(k=>!B[k].tool&&!B[k].foe);
function castleFromState(meta){
  const b=[];S.grid.forEach((t,i)=>{if(t.b&&t.b.type!=='keep'&&CASTLE_TYPES.includes(t.b.type))b.push(t.b.mode?[t.b.type,i/COLS|0,i%COLS,t.b.mode]:[t.b.type,i/COLS|0,i%COLS])});
  const d=S.units.filter(u=>UNIT[u.type]).map(u=>[u.type,u.post/COLS|0,u.post%COLS]);
  const c={cv:CASTLE_VER,map:mapFromState(meta),keepLv:S.keepLv,b,d};c.power=castlePower(c);return c;
}
// Grober Stärkewert für die Gegnersuche: Baukosten der Verteidigung, Burgstufe, Truppen
function castlePower(c){
  const cost=k=>Object.entries(B[k].cost||{}).reduce((a,[r,v])=>a+v*(r==='gold'?1:r==='stein'?1.5:1),0);
  return Math.round(c.b.reduce((a,[k])=>a+(B[k].wall?cost(k)+(B[k].hp||0)/10:0),0)+c.keepLv*120+c.d.reduce((a,[u])=>a+UNIT[u].gold+UNIT[u].hp,0));
}
// Prüft eine hochgeladene Burg: gültige Karte, nur bekannte Gebäude auf passendem Gelände, keine Doppelbelegung,
// Verteidiger auf begehbaren oder erhöhten Feldern, Obergrenzen. Rückgabe: saubere Burg oder null.
function validateCastle(o,lim={maxB:400,maxD:60}){
  try{
    if(!o||o.cv!==CASTLE_VER)return null;const map=validateMap(o.map);if(!map)return null;
    const t=rleDecode(map.t,map.cols*map.rows),used=new Set([map.kr*map.cols+map.kc]),b=[],d=[];
    const ok=(r,c)=>r>=0&&c>=0&&r<map.rows&&c<map.cols;
    for(const x of(Array.isArray(o.b)?o.b:[]).slice(0,lim.maxB)){const[k,r,c,mode]=x;if(!CASTLE_TYPES.includes(k)||!ok(r,c))return null;const i=r*map.cols+c;if(used.has(i))return null;
      const tt=t[i];if(B[k].bridge?tt!==WATER:(tt!==GRASS&&tt!==HILL))return null;used.add(i);b.push(B[k].modes&&B[k].modes[mode]?[k,r,c,mode]:[k,r,c])}
    const walls=new Set(b.filter(([k])=>B[k].wall&&!B[k].gate).map(([,r,c])=>r*map.cols+c));walls.add(map.kr*map.cols+map.kc);
    for(const x of(Array.isArray(o.d)?o.d:[]).slice(0,lim.maxD)){const[u,r,c]=x;if(!UNIT[u]||!ok(r,c))return null;const i=r*map.cols+c,tt=t[i];
      if(!walls.has(i)&&tt!==GRASS&&tt!==HILL&&tt!==SWAMP)return null;d.push([u,r,c])}
    const c={cv:CASTLE_VER,map,keepLv:clampN(o.keepLv,0,KEEP_LV.length-1,0),b,d};c.power=castlePower(c);return c;
  }catch(e){return null}
}
