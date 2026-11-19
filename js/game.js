// Zinnenwerk – Spieldaten, Karte, Wirtschaft, Kampf
const COLS=12,ROWS=20,N=COLS*ROWS,KR=11,KC=5,KI=KR*COLS+KC;
const SEAS=[['🌸','Frühling'],['☀️','Sommer'],['🍂','Herbst'],['❄️','Winter']],SLEN=6,CYC=6;
const seasonOf=d=>Math.floor((d-1)/SLEN)%4;
const GRASS=0,TREE=1,ROCK=2,WATER=3;
const DAY=4,SAVE='zinnenwerk-v3',PROG='zinnenwerk-progress';
const EMO='system-ui,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const RES=[['holz','🪵'],['stein','🪨'],['weizen','🌾'],['mehl','🫙'],['brot','🍞'],['aepfel','🍎'],['gold','💰']];
const RICON=Object.fromEntries(RES);
const RNAME={holz:'Holz',stein:'Stein',weizen:'Weizen',mehl:'Mehl',brot:'Brot',aepfel:'Äpfel',gold:'Gold'};
const B={
  haus:{n:'Hütte',i:'🏠',cost:{holz:6},cap:8,d:'Platz für 8 Leute.'},
  holzf:{n:'Holzfäller',i:'🪓',cost:{holz:3},w:1,prod:{holz:3},near:TREE,r:2,col:'#7A4E2D',d:'3 Holz pro Tag. Muss nah am Wald stehen.'},
  obst:{n:'Obstgarten',i:'🍎',cost:{holz:5},w:1,prod:{aepfel:3},col:'#3F7A3A',d:'3 Äpfel pro Tag.'},
  farm:{n:'Weizenhof',i:'🌾',cost:{holz:10},w:1,prod:{weizen:4},col:'#B8901C',d:'4 Weizen pro Tag, für die Mühle.'},
  muehle:{n:'Mühle',i:'⚙️',cost:{holz:15},w:1,use:{weizen:4},prod:{mehl:4},col:'#D9D2BE',d:'Mahlt 4 Weizen zu 4 Mehl.'},
  baecker:{n:'Bäckerei',i:'🥖',cost:{holz:10},w:1,use:{mehl:4},prod:{brot:10},col:'#D9D2BE',d:'Backt aus 4 Mehl 10 Brot.'},
  stein:{n:'Steinbruch',i:'⛏️',cost:{holz:8},w:2,prod:{stein:3},near:ROCK,r:1,col:'#6F6F78',d:'3 Stein pro Tag. Muss direkt an Felsen stehen.'},
  brunnen:{n:'Brunnen',i:'🪣',cost:{holz:4,stein:4},nofire:1,d:'Löscht Brände im Umkreis von 3 Feldern.'},
  kapelle:{n:'Kapelle',i:'⛪',cost:{stein:8,gold:30},d:'+2 Beliebtheit pro Tag (bis zu 3 Kapellen).'},
  mauer:{n:'Mauer',cost:{stein:1},wall:1,hp:30,drag:1,d:'Mit dem Finger ziehen. Deine Leute kommen nicht hindurch.'},
  tor:{n:'Tor',cost:{holz:4,stein:8},wall:1,gate:1,hp:150,d:'Lässt deine Leute durch, Feinde nicht. Sehr stabil.'},
  turm:{n:'Turm',cost:{stein:10},wall:1,hp:90,d:'Hält 3 Bogenschützen mit großer Reichweite.'},
  kaserne:{n:'Kaserne',i:'🛡️',cost:{holz:10,stein:6},d:'Erlaubt Bogenschützen im Hof.'},
  abriss:{n:'Abreißen',i:'✖️',cost:{},drag:1,tool:1,d:'Tippe oder ziehe über Gebäude. Du bekommst die Hälfte zurück.'}
};
const ORDER=['haus','holzf','obst','farm','muehle','baecker','stein','brunnen','kapelle','mauer','tor','turm','kaserne','abriss'];
const TAX=[{n:'Geschenk',g:-0.4,p:3},{n:'Keine',g:0,p:1},{n:'Niedrig',g:0.6,p:-2},{n:'Mittel',g:1,p:-4},{n:'Hoch',g:1.5,p:-7}];
const RAT=[{n:'Keine',r:0,p:-8},{n:'Halb',r:0.15,p:-4},{n:'Normal',r:0.3,p:0},{n:'Doppelt',r:0.6,p:4}];
const ETYPE={
  raider:{n:'Räuber',hpM:1,spd:1.1,dmg:3,armor:1},
  fire:{n:'Brandstifter',hpM:.7,spd:1.3,dmg:2,armor:1},
  ram:{n:'Rammbock',hpM:3.5,spd:.45,dmg:14,armor:.34}
};
const BASE={holz:40,stein:0,weizen:0,mehl:0,brot:0,aepfel:15,gold:60};
const MISSIONS=[
  {n:'Ein neuer Anfang',s:'Der König hat dir ein Stück Land überlassen. Noch droht keine Gefahr. Baue ein Dorf auf, in dem die Leute gerne leben.',
   seed:1201,res:{...BASE},pop:10,goals:[['pop',24]],raid:null},
  {n:'Brot für alle',s:'Äpfel allein machen niemanden satt. Baue die Brotkette aus Weizenhof, Mühle und Bäckerei auf. Eine kleine Bande treibt sich herum.',
   seed:3307,res:{...BASE,holz:60,aepfel:20},pop:14,goals:[['brot',40]],raid:{start:10,every:9,fire:99,ram:99,scale:.6}},
  {n:'Steinerne Wacht',s:'Räuber ziehen durch das Tal. Baue Mauern und Türme und wehre drei Angriffe ab. Denk an ein Tor, sonst kommen deine Leute nicht mehr hinaus.',
   seed:4411,res:{...BASE,holz:50,stein:20,aepfel:20,gold:80},pop:14,goals:[['raids',3]],raid:{start:7,every:6,fire:99,ram:99,scale:1}},
  {n:'Flammen im Tal',s:'Die Räuber haben Fackelträger dabei. Brunnen löschen Brände in der Nähe, und du kannst brennende Häuser antippen, um sie für 2 Gold zu löschen.',
   seed:5519,res:{...BASE,holz:60,stein:20,aepfel:20,gold:100},pop:16,goals:[['raids',4],['pp',50]],raid:{start:7,every:6,fire:1,ram:99,scale:1}},
  {n:'Die Belagerung',s:'Ein Heer mit Rammböcken rückt an. Pfeile richten gegen sie wenig aus, aber ein starkes Tor und dicke Mauern bremsen sie lange genug.',
   seed:6623,res:{...BASE,holz:80,stein:40,brot:10,aepfel:20,gold:150},pop:18,goals:[['raids',5]],raid:{start:8,every:5,fire:2,ram:2,scale:1.2}}
];
const FREE={n:'Freies Spiel',s:'Endlose Angriffe auf einer zufälligen Karte. Wie lange hält deine Burg?',res:{...BASE,brot:5},pop:10,goals:[],raid:{start:8,every:7,fire:3,ram:5,scale:1}};
const GOALTXT={pop:['👥','Einwohner'],brot:['🍞','Brot auf Vorrat'],raids:['⚔️','Angriffe abgewehrt'],pp:['❤️','Beliebtheit am Ende']};

const $=id=>document.getElementById(id);
const cv=$('cv'),ctx=cv.getContext('2d');
let S=null,sel=null,speed=1,lastT=0,arrows=[],cds={},cell=30,ox=0,oy=0,dpr=1,tab='build',uiPause=true,now=0;
let cacheGv=-1,dist=null,reach=null,prev=null,walkers=new Map(),wanderers=[];

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
function getProg(){try{return JSON.parse(localStorage.getItem(PROG))||{done:[]}}catch(e){return{done:[]}}}
function setProg(p){try{localStorage.setItem(PROG,JSON.stringify(p))}catch(e){}}
function startGame(mi){
  const m=mi<0?FREE:MISSIONS[mi],seed=mi<0?Math.floor(Math.random()*1e9):m.seed;
  S={mi,seed,day:1,clock:0,res:{...m.res},pop:m.pop,pp:60,lastDelta:0,tax:2,ration:2,eff:2,prevEff:2,variety:1,archers:0,idle:m.pop,
     nextRaid:m.raid?m.raid.start:null,raids:0,repelled:0,raidSide:null,raidActive:false,fireDays:0,cold:false,
     keepHp:150,keepMax:150,nid:1,gv:0,grid:genMap(seed),enemies:[],over:false,won:false};
  arrows=[];cds={};sel=null;walkers=new Map();wanderers=[];cacheGv=-1;
  ensure();assignWorkers();save();if(typeof refreshSel==='function')try{refreshSel()}catch(e){}
}
const mission=()=>S.mi<0?FREE:MISSIONS[S.mi];
function save(){try{if(S&&!S.over&&!S.won)localStorage.setItem(SAVE,JSON.stringify(S));else localStorage.removeItem(SAVE)}catch(e){}}
function loadSave(){try{const s=localStorage.getItem(SAVE);if(s){const o=JSON.parse(s);if(o&&o.grid&&o.grid.length===N&&o.gv!=null)return o}}catch(e){}return null}

const T=(r,c)=>S.grid[r*COLS+c];
const inb=(r,c)=>r>=0&&r<ROWS&&c>=0&&c<COLS;
const cap=()=>12+count('haus')*8;
const count=k=>S.grid.filter(t=>t.b&&t.b.type===k).length;
const has=cost=>Object.entries(cost).every(([k,v])=>S.res[k]>=v);
const costTxt=cost=>Object.entries(cost).map(([k,v])=>v+' '+RICON[k]).join(' ')||'–';
const isWall=b=>b&&B[b.type]&&B[b.type].wall;
const flammable=b=>b&&b.type!=='keep'&&B[b.type]&&!B[b.type].wall&&!B[b.type].nofire;
const bump=()=>{S.gv++};

// ---------- Wege & Verbindungen ----------
function ensure(){
  if(cacheGv===S.gv)return;cacheGv=S.gv;
  // Feindliche Kosten zum Bergfried
  dist=new Array(N).fill(Infinity);const done=new Uint8Array(N);dist[KI]=0;
  const step=i=>{const t=S.grid[i];if(t.t!==GRASS)return Infinity;if(isWall(t.b))return 1+t.b.hp/5;return 1};
  for(;;){let u=-1,m=Infinity;for(let i=0;i<N;i++)if(!done[i]&&dist[i]<m){m=dist[i];u=i}
    if(u<0)break;done[u]=1;const ur=u/COLS|0,uc=u%COLS;
    for(const[dr,dc]of[[1,0],[-1,0],[0,1],[0,-1]]){const r=ur+dr,c=uc+dc;if(!inb(r,c))continue;const v=r*COLS+c,s=step(v);if(dist[u]+s<dist[v])dist[v]=dist[u]+s}}
  // Eigene Leute: Mauern blockieren, Tore nicht
  reach=new Uint8Array(N);prev=new Int16Array(N).fill(-1);reach[KI]=1;const q=[KI];
  const pass=i=>{const t=S.grid[i];return t.t===GRASS&&(!isWall(t.b)||B[t.b.type].gate)};
  while(q.length){const u=q.shift(),ur=u/COLS|0,uc=u%COLS;
    for(const[dr,dc]of[[1,0],[-1,0],[0,1],[0,-1]]){const r=ur+dr,c=uc+dc;if(!inb(r,c))continue;const v=r*COLS+c;if(reach[v]||!pass(v))continue;reach[v]=1;prev[v]=u;q.push(v)}}
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
function act(k,r,c,quiet){
  const why=reason(k,r,c);if(why){if(!quiet)toast(why);return}
  const d=B[k],t=T(r,c);
  if(d.tool){
    const bd=B[t.b.type];for(const[x,v]of Object.entries(bd.cost))S.res[x]+=Math.floor(v/2);
    t.b=null;fx(c+.5,r+.7,'dust',10);bump();assignWorkers();return;
  }
  if(!has(d.cost)){const miss=Object.keys(d.cost).find(x=>S.res[x]<d.cost[x]);if(!quiet||k==='mauer')toast('Nicht genug '+RNAME[miss]+'.');return}
  for(const[x,v]of Object.entries(d.cost))S.res[x]-=v;
  t.b={type:k,id:S.nid++,hp:d.hp||40,max:d.hp||40,on:false,burn:0};
  fx(c+.5,r+.85,'dust',8);bump();assignWorkers();
  if(k==='tor'||k==='mauer')setTimeout(checkCut,50);
}
let cutWarned=-1;
function checkCut(){ensure();const n=S.grid.filter(t=>t.b&&t.b.cut).length;if(n&&cutWarned!==S.gv){cutWarned=S.gv;toast(n+' Gebäude sind von der Burg abgeschnitten. Baue ein Tor.')}}
function assignWorkers(){
  ensure();
  const bl=S.grid.map(t=>t.b).filter(b=>b&&B[b.type]&&B[b.type].w).sort((a,b)=>a.id-b.id);
  let free=S.pop-S.archers;
  for(const b of bl){const w=B[b.type].w;b.on=!b.cut&&free>=w;if(b.on)free-=w}
  S.idle=free;
}

// ---------- Tageslauf ----------
function factors(){
  const f=[['Rationen ('+RAT[S.eff].n+')',RAT[S.eff].p]];
  if(S.variety>1)f.push(['Abwechslung beim Essen',2]);
  f.push(['Steuern ('+TAX[S.tax].n+')',TAX[S.tax].p]);
  const k=Math.min(count('kapelle'),3);if(k)f.push(['Kapellen',k*2]);
  if(S.fireDays>0)f.push(['Angst nach Bränden',-3]);
  if(S.cold)f.push(['Kälte ohne Brennholz',-4]);
  return f;
}
function dayTick(){
  const sBefore=seasonOf(S.day);S.day++;const sea=seasonOf(S.day);
  assignWorkers();
  const bl=S.grid.map(t=>t.b).filter(b=>b&&b.on&&!b.cut);
  const pass=fn=>bl.filter(fn).forEach(b=>{const d=B[b.type];
    if(sea===3&&(b.type==='obst'||b.type==='farm')){b.winter=1;return}b.winter=0;
    if(d.use&&!has(d.use)){b.starved=1;return}b.starved=0;if(d.use)for(const[k,v]of Object.entries(d.use))S.res[k]-=v;
    const mult=sea===2&&b.type==='obst'?2:1;for(const[k,v]of Object.entries(d.prod))S.res[k]+=v*mult});
  S.grid.forEach(t=>{if(t.b&&(t.b.type==='obst'||t.b.type==='farm'))t.b.winter=sea===3?1:0});
  pass(b=>!B[b.type].use);pass(b=>b.type==='muehle');pass(b=>b.type==='baecker');
  // Essen
  const food=S.res.brot+S.res.aepfel;let eff=S.ration;
  while(eff>0&&food<Math.ceil(S.pop*RAT[eff].r))eff--;
  if(eff<S.ration&&eff!==S.prevEff)toast(eff===0?'Die Vorräte sind leer. Dein Volk hungert.':'Zu wenig Essen, die Rationen wurden gekürzt.');
  S.prevEff=S.eff=eff;
  let need=Math.min(food,Math.ceil(S.pop*RAT[eff].r));
  const kinds=['brot','aepfel'].filter(k=>S.res[k]>0).sort((a,b)=>S.res[a]-S.res[b]);
  S.variety=eff>0?kinds.length:0;
  kinds.forEach((k,i)=>{const take=Math.min(S.res[k],Math.ceil(need/(kinds.length-i)));S.res[k]-=take;need-=take});
  // Brennholz im Winter
  if(sea===3){const need=Math.ceil(S.pop/10);if(S.res.holz>=need){S.res.holz-=need;S.cold=false}else{if(!S.cold)toast('Kein Brennholz! Deine Leute frieren.');S.cold=true}}else S.cold=false;
  if(sea!==sBefore)toast(['🌸 Frühling! Die Felder tragen wieder.','☀️ Der Sommer beginnt.','🍂 Herbst: Obstgärten tragen doppelt.','❄️ Winter: Felder und Obstgärten ruhen, und deine Leute verbrennen Holz.'][sea]);
  if(sea===2&&(S.day-1)%SLEN===SLEN-2)toast('Der Winter naht. Lege Essen und Holz auf Vorrat.');
  // Steuern
  if(S.tax===0&&S.res.gold<Math.ceil(S.pop*0.4)){S.tax=1;toast('Kein Gold mehr für Geschenke.')}
  S.res.gold=Math.max(0,S.res.gold+Math.round(S.pop*TAX[S.tax].g));
  // Beliebtheit
  const sum=factors().reduce((a,x)=>a+x[1],0);
  const before=S.pp;S.pp=Math.max(0,Math.min(100,S.pp+sum*0.5));S.lastDelta=S.pp-before;
  if(S.fireDays>0)S.fireDays--;
  // Bevölkerung
  const cp=cap();
  if(S.pp>=50&&S.pop<cp)S.pop+=Math.min(cp-S.pop,S.pp>=75?2:1);
  else if(S.pp<50){const old=S.pop;S.pop=Math.max(S.archers,S.pop-(S.pp<25?2:1));if(S.pop<old&&S.day%3===0)toast('Unzufriedene Leute verlassen die Burg.')}
  if(S.pop>cp)S.pop=Math.max(S.archers,cp);
  assignWorkers();
  // Angriffe
  if(S.nextRaid!=null){
    S.nextRaid--;
    if(S.nextRaid===3){const sides=S.raids<2?['Norden','Osten','Westen']:['Norden','Osten','Westen','Süden'];S.raidSide=sides[Math.floor(Math.random()*sides.length)];toast('Späher melden Feinde aus dem '+dispSide(S.raidSide)+'.')}
    if(S.nextRaid<=0){spawnWave();S.nextRaid=mission().raid.every}
  }
  checkWin();save();
}
function spawnWave(){
  ensure();
  const R=mission().raid,k=++S.raids;
  const n=Math.max(1,Math.round((1+k*2)*R.scale)),hp=8+k*3;
  const nf=k>=R.fire?1+Math.floor((k-R.fire)/2):0,nr=k>=R.ram?1+Math.floor((k-R.ram)/2):0;
  const list=[];for(let i=0;i<Math.max(1,n-nf);i++)list.push('raider');for(let i=0;i<nf;i++)list.push('fire');
  list.sort(()=>Math.random()-.5);for(let i=0;i<nr;i++)list.push('ram');
  const side=S.raidSide||'Norden',edge=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const on=side==='Norden'?r===0:side==='Süden'?r===ROWS-1:side==='Westen'?c===0:c===COLS-1;
    const t=T(r,c);if(on&&t.t===GRASS&&!t.b&&isFinite(dist[r*COLS+c]))edge.push([r,c]);
  }
  if(!edge.length){S.raidSide=null;return}
  list.forEach((type,i)=>{const[r,c]=edge[Math.floor(Math.random()*edge.length)],et=ETYPE[type],h=Math.round(hp*et.hpM);
    S.enemies.push({type,r,c,x:c+.5,y:r+.5,tr:null,tc:null,hp:h,max:h,cd:0,ign:1,wait:i*0.7,atk:null,ang:0})});
  S.raidActive=true;S.raidSide=null;
  const parts=[];const cnt=t=>list.filter(x=>x===t).length;
  if(cnt('raider'))parts.push(cnt('raider')+' Räuber');if(cnt('fire'))parts.push(cnt('fire')+' Brandstifter');if(cnt('ram'))parts.push(cnt('ram')+(cnt('ram')>1?' Rammböcke':' Rammbock'));
  toast('⚔️ Angriff: '+parts.join(', ')+'!');
  try{navigator.vibrate&&navigator.vibrate([80,60,80])}catch(e){}
}
function goalState(){return mission().goals.map(([t,n])=>{const v=t==='pop'?S.pop:t==='brot'?S.res.brot:t==='raids'?S.repelled:Math.round(S.pp);return{t,n,v,ok:v>=n}})}
function checkWin(){
  if(S.won||S.over||!mission().goals.length)return;
  const g=goalState();
  // Beliebtheit zählt erst, wenn die anderen Ziele erreicht sind
  if(g.every(x=>x.ok)){
    S.won=true;save();
    const p=getProg();if(!p.done.includes(S.mi))p.done.push(S.mi);setProg(p);
    const next=S.mi+1<MISSIONS.length?S.mi+1:null;
    modal('Mission geschafft','<p>„'+mission().n+'“ ist abgeschlossen. Deine Burg steht nach '+S.day+' Tagen stolzer da als je zuvor.</p>'+(next==null?'<p>Das war die letzte Mission. Im freien Spiel kannst du weiterbauen.</p>':''),
      next!=null?[{t:'Nächste Mission',p:1,f:()=>brief(next)},{t:'Menü',f:openMenu}]:[{t:'Freies Spiel',p:1,f:()=>brief(-1)},{t:'Menü',f:openMenu}]);
  }
}
function gameOver(){
  S.over=true;save();
  const m=mission();
  modal('Die Burg ist gefallen','<p>Deine Burg hielt '+S.day+' Tage stand und wehrte '+S.repelled+(S.repelled===1?' Angriff':' Angriffe')+' ab.</p>',
    [{t:'Nochmal versuchen',p:1,f:()=>{startGame(S.mi);closeModal()}},{t:'Menü',f:openMenu}]);
}

// ---------- Echtzeit ----------
function decide(e){
  ensure();let best=null,bd=Infinity;
  for(const[dr,dc]of[[1,0],[-1,0],[0,1],[0,-1]]){const r=e.r+dr,c=e.c+dc;if(!inb(r,c))continue;const d=dist[r*COLS+c];if(d<bd){bd=d;best=[r,c]}}
  if(!best){e.atk=null;return}
  const[r,c]=best,t=T(r,c);
  if(r===KR&&c===KC)e.atk='keep';
  else if(isWall(t.b))e.atk=[r,c];
  else{e.atk=null;e.tr=r;e.tc=c}
  e.ang=Math.atan2(r-e.r,c-e.c);
}
function ignite(b){if(flammable(b)&&!b.burn){b.burn=0.01}}
function wellNear(r,c){for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++){if(inb(r+a,c+b)){const x=T(r+a,c+b).b;if(x&&x.type==='brunnen')return true}}return false}
function update(dt){
  ensure();
  for(const e of S.enemies){
    if(e.wait>0){e.wait-=dt;continue}
    const et=ETYPE[e.type];
    if(e.type==='fire'){e.ign-=dt;if(e.ign<=0){
      outer:for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){if(!inb(e.r+a,e.c+b))continue;const x=T(e.r+a,e.c+b).b;if(flammable(x)&&!x.burn){ignite(x);e.ign=4;break outer}}
      if(e.ign<=0)e.ign=.5;}}
    if(e.atk){
      if(e.atk!=='keep'){const t=T(e.atk[0],e.atk[1]);if(!isWall(t.b)){e.atk=null;continue}}
      e.cd-=dt;
      if(e.cd<=0){e.cd=1;
        if(e.atk==='keep'){fx(KC+.5,KR+1,'dust',3);S.keepHp-=e.type==='ram'?10:et.dmg;if(S.keepHp<=0){S.keepHp=0;gameOver();return}}
        else{const ar=e.atk[0],ac=e.atk[1],t=T(ar,ac);t.b.hp-=et.dmg;fx(ac+.5,ar+.8,'dust',e.type==='ram'?6:2);if(t.b.hp<=0){t.b=null;bump();e.atk=null;fx(ac+.5,ar+.6,'dust',16);assignWorkers()}}
      }
      continue;
    }
    if(e.tr==null){decide(e);continue}
    const tx=e.tc+.5,ty=e.tr+.5,dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy),sp=et.spd*dt;
    if(d<=sp){e.x=tx;e.y=ty;e.r=e.tr;e.c=e.tc;e.tr=null;e.tc=null}else{e.x+=dx/d*sp;e.y+=dy/d*sp}
  }
  // Feuer
  S.grid.forEach((t,i)=>{const b=t.b;if(!b||!b.burn)return;
    const r=i/COLS|0,c=i%COLS;b.burn+=dt;b.hp-=3*dt;
    if(Math.random()<dt*.12)for(const[dr,dc]of[[1,0],[-1,0],[0,1],[0,-1]]){if(inb(r+dr,c+dc)&&Math.random()<.5)ignite(T(r+dr,c+dc).b)}
    if(b.burn>2.5&&wellNear(r,c)){b.burn=0;return}
    if(b.hp<=0){toast(B[b.type].n+' ist abgebrannt.');fx(c+.5,r+.5,'smoke',14);t.b=null;S.fireDays=3;bump();assignWorkers()}
  });
  // Schützen
  let a=S.archers;const sh=[{k:'keep',x:KC+.5,y:KR+.5,range:3.5,n:2+Math.min(a,3)}];a-=Math.min(a,3);
  S.grid.forEach((t,i)=>{if(t.b&&t.b.type==='turm'){const k=Math.min(a,3);a-=k;t.b.arch=k;if(k)sh.push({k:'t'+i,x:i%COLS+.5,y:(i/COLS|0)+.5,range:4.6,n:k})}});
  if(a>0)sh[0].n+=a;
  for(const s of sh){
    cds[s.k]=(cds[s.k]||0)+dt*s.n;
    while(cds[s.k]>=1){
      let tg=null,bd=s.range;
      for(const e of S.enemies){if(e.wait>0||e.hp<=0)continue;const d=Math.hypot(e.x-s.x,e.y-s.y);if(d<=bd){bd=d;tg=e}}
      if(!tg){cds[s.k]=Math.min(cds[s.k],1);break}
      cds[s.k]-=1;tg.hp-=3*ETYPE[tg.type].armor;arrows.push({x1:s.x,y1:s.y,x2:tg.x,y2:tg.y,t:0});
      if(tg.hp<=0){S.res.gold+=tg.type==='ram'?8:3;fx(tg.x,tg.y,'dust',8)}
    }
  }
  const before=S.enemies.length;S.enemies=S.enemies.filter(e=>e.hp>0);
  if(S.raidActive&&before&&!S.enemies.length){S.raidActive=false;S.repelled++;S.res.gold+=10;toast('Angriff abgewehrt! +10 💰');checkWin();save()}
  updateLife(dt);
}
function updateLife(dt){
  const active=new Set();
  S.grid.forEach((t,i)=>{const b=t.b;if(!b||!b.on||b.cut||!B[b.type].prod)return;active.add(b.id);
    let w=walkers.get(b.id);
    if(!w||w.gv!==S.gv){w={gv:S.gv,path:pathFrom(i),s:0,st:'work',tm:Math.random()*2.5,type:b.type};walkers.set(b.id,w)}
    if(!w.path||w.path.length<2)return;
    const end=w.path.length-1.55;
    if(w.st==='work'){w.tm-=dt;if(w.tm<=0)w.st='go'}
    else if(w.st==='go'){w.s+=dt*1.4;if(w.s>=end){w.s=end;w.st='back'}}
    else{w.s-=dt*1.7;if(w.s<=0){w.s=0;w.st='work';w.tm=2+Math.random()}}
  });
  for(const k of [...walkers.keys()])if(!active.has(k))walkers.delete(k);
  const want=Math.min(Math.max(0,S.idle),6);
  while(wanderers.length<want)wanderers.push({x:KC+.5,y:KR+1.5,tx:KC+.5,ty:KR+1.5,wait:Math.random()*2});
  wanderers.length=want;
  for(const p of wanderers){
    const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy);
    if(d<.05){p.wait-=dt;if(p.wait<=0){for(let k=0;k<8;k++){const r=KR+Math.floor(Math.random()*5)-2,c=KC+Math.floor(Math.random()*5)-2;if(inb(r,c)&&reach[r*COLS+c]&&!isWall(T(r,c).b)&&!(r===KR&&c===KC)){p.tx=c+.2+Math.random()*.6;p.ty=r+.2+Math.random()*.6;break}}p.wait=1+Math.random()*3}}
    else{const sp=Math.min(d,.6*dt);p.x+=dx/d*sp;p.y+=dy/d*sp}
  }
}
