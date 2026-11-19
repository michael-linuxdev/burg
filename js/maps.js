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
