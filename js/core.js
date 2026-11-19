// Zinnenwerk – Kern der Spiellogik: Zustand, Karte, Wege, Bauen, Arbeiter. Kein DOM-Zugriff.
// Die Darstellung hängt sich über die Rückrufe in H ein (Meldungen, Effekte, Geräusche, Sieg/Niederlage).
const H={
  say(){},            // kurze Meldung für den Spieler
  fx(){},             // visueller Effekt an Kartenposition (tx, ty, Art, Anzahl)
  sfx(){},            // Geräusch (Name)
  shot(){},           // Pfeil von (x1,y1) nach (x2,y2), Kartenkoordinaten
  side:s=>s,          // Himmelsrichtung für die Anzeige (Querformat dreht die Karte)
  vibrate(){},
  won(){},lost(){}
};
let S=null,cds={},cacheGv=-1,dist=null,reach=null,prev=null;

function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function genMap(seed){
  const R=rng(seed),g=[];for(let i=0;i<N;i++)g.push({t:GRASS,b:null});
  const blob=(cr,cc,rad,t,den)=>{for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const d=Math.hypot(r-cr,c-cc);if(d<rad&&R()<den*(1-d/rad*.55))g[r*COLS+c].t=t}};
  const j=v=>v+(R()-.5)*1.6;
  blob(j(2.5),j(1.5),3.4,TREE,.9);blob(j(7.5),j(10.5),2.8,TREE,.85);blob(j(17),j(1.5),2.6,TREE,.75);
  blob(j(13),j(.6),1.6,TREE,.7);blob(j(18.6),j(10.6),1.9,TREE,.7);
  blob(j(1.2),j(9.5),2.3,ROCK,.8);blob(j(8.2),.5,1.7,ROCK,.85);blob(j(18.7),j(6.5),1.8,ROCK,.8);
  blob(15.2,10.6,1.6+R()*.6,WATER,1);
  for(let r=KR-2;r<=KR+2;r++)for(let c=KC-2;c<=KC+2;c++)g[r*COLS+c].t=GRASS;
  g[KI].b={type:'keep',id:0};
  return g;
}
const store={
  get(k){try{return typeof localStorage!=='undefined'?localStorage.getItem(k):null}catch(e){return null}},
  set(k,v){try{if(typeof localStorage!=='undefined')localStorage.setItem(k,v)}catch(e){}},
  del(k){try{if(typeof localStorage!=='undefined')localStorage.removeItem(k)}catch(e){}}
};
function getProg(){try{return JSON.parse(store.get(PROG))||{done:[]}}catch(e){return{done:[]}}}
function setProg(p){store.set(PROG,JSON.stringify(p))}
function newState(mi){
  const m=mi<0?FREE:MISSIONS[mi],seed=mi<0?Math.floor(Math.random()*1e9):m.seed;
  setMapSize(12,20,11,5);
  return{ver:SAVE_VER,cols:COLS,rows:ROWS,kr:KR,kc:KC,mi,seed,day:1,clock:0,res:{...m.res},pop:m.pop,pp:60,lastDelta:0,tax:2,ration:2,eff:2,prevEff:2,variety:1,archers:0,idle:m.pop,
     nextRaid:m.raid?m.raid.start:null,raids:0,repelled:0,raidSide:null,raidActive:false,fireDays:0,cold:false,
     keepHp:150,keepMax:150,nid:1,gv:0,grid:genMap(seed),enemies:[],over:false,won:false};
}
function startGame(mi){
  S=newState(mi);cds={};cacheGv=-1;undoClear();
  ensure();assignWorkers();save();
}
const mission=()=>S.mi<0?FREE:MISSIONS[S.mi];
// ---------- Speichern ----------
// Automatischer Spielstand unter AUTO, drei feste Plätze unter SLOT+n. Jeder Stand trägt S.ver;
// migrate() hebt ältere Stände auf das aktuelle Format. Der alte Schlüssel SAVE (v3) wird beim
// ersten Start einmalig in den automatischen Spielstand übernommen und nicht gelöscht.
const SAVE_VER=2;
function migrate(o){
  if(!o||!o.grid||o.gv==null)return null;
  const v=o.ver||1;
  if(v<2){o.enemies=o.enemies||[];o.saved=o.saved||Date.now();o.cols=12;o.rows=20;o.kr=11;o.kc=5}
  if(o.grid.length!==o.cols*o.rows)return null;
  for(const e of o.enemies)if(e.w==null)e.w=o.raids;
  o.ver=SAVE_VER;
  return o;
}
function readSave(key){try{const s=store.get(key);if(!s)return null;return migrate(JSON.parse(s))}catch(e){return null}}
function save(){if(!S)return;if(!S.over&&!S.won){S.ver=SAVE_VER;S.saved=Date.now();store.set(AUTO,JSON.stringify(S))}else store.del(AUTO)}
function saveSlot(n){if(!S||S.over||S.won)return false;S.ver=SAVE_VER;S.saved=Date.now();store.set(SLOT+n,JSON.stringify(S));return true}
function loadSave(){
  let o=readSave(AUTO);
  if(!o){const old=readSave(SAVE);if(old){o=old;store.set(AUTO,JSON.stringify(o))}}
  return o;
}
// Kurzbeschreibung eines Spielstands für das Menü
function savePreview(o){
  if(!o)return null;const m=o.mi<0?FREE:MISSIONS[o.mi];if(!m)return null;
  const sea=seasonOf(o.day);
  return{name:(o.mi<0?'':'Mission '+(o.mi+1)+': ')+m.n,day:o.day,season:SEAS[sea][0]+' '+SEAS[sea][1],saved:o.saved||0};
}
function resume(o){setMapSize(o.cols,o.rows,o.kr,o.kc);S=o;undoClear();S.enemies=S.enemies||[];cds={};cacheGv=-1;ensure();assignWorkers()}

const T=(r,c)=>S.grid[r*COLS+c];
const inb=(r,c)=>r>=0&&r<ROWS&&c>=0&&c<COLS;
const cap=()=>12+count('haus')*8;
const count=k=>S.grid.filter(t=>t.b&&t.b.type===k).length;
const has=cost=>Object.entries(cost).every(([k,v])=>S.res[k]>=v);
const costTxt=cost=>Object.entries(cost).map(([k,v])=>v+' '+RICON[k]).join(' ')||'–';
const isWall=b=>b&&B[b.type]&&B[b.type].wall;
const flammable=b=>b&&b.type!=='keep'&&B[b.type]&&!B[b.type].wall&&!B[b.type].nofire;
const bump=()=>{S.gv++};
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

// ---------- Wege & Verbindungen ----------
// dist: Kosten für Feinde bis zum Bergfried (Dijkstra). Gras kostet 1, Mauern 1 + LP/5, alles andere ist unpassierbar.
// reach/prev: Erreichbarkeit für eigene Leute (Breitensuche ab Bergfried, Tore passierbar, Mauern nicht).
function ensure(){
  if(cacheGv===S.gv)return;cacheGv=S.gv;
  dist=new Array(N).fill(Infinity);const done=new Uint8Array(N);dist[KI]=0;
  const step=i=>{const t=S.grid[i];if(t.t!==GRASS)return Infinity;if(isWall(t.b))return 1+t.b.hp/5;return 1};
  for(;;){let u=-1,m=Infinity;for(let i=0;i<N;i++)if(!done[i]&&dist[i]<m){m=dist[i];u=i}
    if(u<0)break;done[u]=1;const ur=u/COLS|0,uc=u%COLS;
    for(const[dr,dc]of DIRS){const r=ur+dr,c=uc+dc;if(!inb(r,c))continue;const v=r*COLS+c,s=step(v);if(dist[u]+s<dist[v])dist[v]=dist[u]+s}}
  reach=new Uint8Array(N);prev=new Int32Array(N).fill(-1);reach[KI]=1;const q=[KI];
  const pass=i=>{const t=S.grid[i];return t.t===GRASS&&(!isWall(t.b)||B[t.b.type].gate)};
  for(let h=0;h<q.length;h++){const u=q[h],ur=u/COLS|0,uc=u%COLS;
    for(const[dr,dc]of DIRS){const r=ur+dr,c=uc+dc;if(!inb(r,c))continue;const v=r*COLS+c;if(reach[v]||!pass(v))continue;reach[v]=1;prev[v]=u;q.push(v)}}
  S.grid.forEach((t,i)=>{if(t.b&&B[t.b.type]&&B[t.b.type].prod)t.b.cut=!reach[i]});
}
function pathFrom(i){if(!reach[i])return null;const p=[i];let k=i,guard=0;while(k!==KI&&guard++<N){k=prev[k];if(k<0)return null;p.push(k)}return p}

// ---------- Bauen ----------
function nearOk(d,r,c){if(d.near==null)return true;for(let a=-d.r;a<=d.r;a++)for(let b=-d.r;b<=d.r;b++){if(inb(r+a,c+b)&&T(r+a,c+b).t===d.near)return true}return false}
function occupied(r,c){return S.enemies.some(e=>(e.r===r&&e.c===c)||(e.tr===r&&e.tc===c))}
function reason(k,r,c){
  const t=T(r,c),d=B[k];
  if(d.tool)return t.b&&t.b.type!=='keep'?'':'Hier steht nichts zum Abreißen.';
  if(t.b)return 'Hier steht schon etwas.';
  if(t.t!==GRASS)return 'Hier kann nicht gebaut werden.';
  if(occupied(r,c))return 'Feinde stehen im Weg.';
  if(!nearOk(d,r,c))return d.near===TREE?'Holzfäller brauchen Bäume in der Nähe.':'Steinbrüche müssen direkt an Felsen stehen.';
  return '';
}
// Führt eine Bauaktion aus. Rückgabe: Beschreibung der Änderung (für „Rückgängig“) oder null.
function act(k,r,c,quiet){
  const why=reason(k,r,c);if(why){if(!quiet)H.say(why);return null}
  const d=B[k],t=T(r,c);
  if(d.tool){
    const old=t.b,bd=B[old.type],back={};
    for(const[x,v]of Object.entries(bd.cost)){back[x]=Math.floor(v/2);S.res[x]+=back[x]}
    t.b=null;H.fx(c+.5,r+.7,'dust',10);H.sfx('abriss');bump();assignWorkers();return{kind:'del',r,c,b:old,back};
  }
  if(!has(d.cost)){const miss=Object.keys(d.cost).find(x=>S.res[x]<d.cost[x]);if(!quiet||k==='mauer')H.say('Nicht genug '+RNAME[miss]+'.');return null}
  for(const[x,v]of Object.entries(d.cost))S.res[x]-=v;
  t.b={type:k,id:S.nid++,hp:d.hp||40,max:d.hp||40,on:false,burn:0};
  H.fx(c+.5,r+.85,'dust',8);H.sfx(d.wall?'stein':'bau');bump();assignWorkers();
  if(k==='tor'||k==='mauer')checkCut();
  return{kind:'add',r,c,id:t.b.id,cost:{...d.cost}};
}
let cutWarned=-1;
function checkCut(){ensure();const n=S.grid.filter(t=>t.b&&t.b.cut).length;if(n&&cutWarned!==S.gv){cutWarned=S.gv;H.say(n+' Gebäude sind von der Burg abgeschnitten. Baue ein Tor.')}}
function assignWorkers(){
  ensure();
  const bl=S.grid.map(t=>t.b).filter(b=>b&&B[b.type]&&B[b.type].w).sort((a,b)=>a.id-b.id);
  let free=S.pop-S.archers;
  for(const b of bl){const w=B[b.type].w;b.on=!b.cut&&free>=w;if(b.on)free-=w}
  S.idle=free;
}

// ---------- Rückgängig ----------
// Bauaktionen werden gesammelt; eine Wisch-Geste (z. B. eine Mauerlinie) ist ein Schritt.
// Bis zu UNDO_MAX Schritte, nur für Aktionen von heute oder gestern (sonst ließe sich Produktion „zurückkaufen“).
const UNDO_MAX=20;
let undoStack=[],undoGroup=null;
function undoBegin(){undoGroup=[]}
function undoEnd(){if(undoGroup&&undoGroup.length)pushUndo(undoGroup);undoGroup=null}
function pushUndo(acts){undoStack.push({day:S.day,acts});if(undoStack.length>UNDO_MAX)undoStack.shift()}
function record(rec){if(!rec)return;if(undoGroup)undoGroup.push(rec);else pushUndo([rec])}
function undoClear(){undoStack=[];undoGroup=null}
function canUndo(){while(undoStack.length&&S.day-undoStack[undoStack.length-1].day>1)undoStack.shift();return undoStack.length>0}
function undo(){
  if(!canUndo())return 0;
  const step=undoStack.pop();let n=0;
  for(let i=step.acts.length-1;i>=0;i--){
    const a=step.acts[i],t=T(a.r,a.c);
    if(a.kind==='add'){
      if(!t.b||t.b.id!==a.id||t.b.burn)continue;
      for(const[x,v]of Object.entries(a.cost))S.res[x]+=v;
      t.b=null;n++;
    }else{
      if(t.b||occupied(a.r,a.c)||!has(a.back))continue;
      for(const[x,v]of Object.entries(a.back))S.res[x]-=v;
      t.b=a.b;n++;
    }
  }
  if(n){bump();assignWorkers();H.sfx('klick')}
  return n;
}
