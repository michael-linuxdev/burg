// Zinnenwerk – Eigene Truppen: Einheiten auf der Karte, Wegfindung, Befehle, Kampf. Kein DOM.
//
// Einheiten stehen auf Bodenfeldern oder oben auf Mauern, Türmen und dem Bergfried („erhöht“).
// Wegfindung: wie die eigenen Leute (Gras begehbar, Tore passierbar, Mauern nicht). Zusätzlich darf eine
// Einheit von einem Bodenfeld, das mit dem Bergfried verbunden ist (reach), auf eine angrenzende Mauer
// steigen, oben entlanglaufen und wieder auf ein solches Feld hinabsteigen. So kommt niemand über die
// Mauer nach draußen, der nicht auch durch ein Tor käme.
const UPLACES={mauer:2,turm:3,keep:5};// Plätze oben auf Mauerfeld, Turm, Bergfried
const GROUND_CAP=3;// Einheiten je Bodenfeld beim Verteilen einer Gruppe
let uid=1;

const isUp=i=>{const b=S.grid[i].b;return !!b&&(b.type==='keep'||(isWall(b)&&!B[b.type].gate))};
const upCap=i=>{const b=S.grid[i].b;return b?UPLACES[b.type]||0:0};
function groundOk(i){const t=S.grid[i];return t.t===GRASS&&(!isWall(t.b)||B[t.b.type].gate)&&!(t.b&&t.b.type==='keep')}
function unitStep(a,b){// darf eine Einheit von Feld a nach Feld b?
  const ua=isUp(a),ub=isUp(b);
  if(ua&&ub)return true;
  if(!ua&&!ub)return groundOk(b);
  return ua?groundOk(b)&&reach[b]:reach[a]===1;
}
// Breitensuche von Feld a zu Feld b, Rückgabe: Liste der Felder ohne a, oder null
function unitPath(a,b){
  if(a===b)return[];
  const pv=new Int32Array(N).fill(-1);pv[a]=a;const q=[a];
  for(let h=0;h<q.length;h++){const u=q[h],ur=u/COLS|0,uc=u%COLS;
    for(const[dr,dc]of DIRS){const r=ur+dr,c=uc+dc;if(!inb(r,c))continue;const v=r*COLS+c;
      if(pv[v]>=0||!unitStep(u,v))continue;pv[v]=u;if(v===b){const p=[v];let k=u;while(k!==a){p.push(k);k=pv[k]}return p.reverse()}q.push(v)}}
  return null;
}
const unitsAt=i=>S.units.filter(u=>(u.dest!=null?u.dest:u.i)===i);
function newUnit(type,i){const U=UNIT[type];return{id:uid++,type,i,x:i%COLS+.5,y:(i/COLS|0)+.5,hp:U.hp,max:U.hp,path:[],dest:null,cd:0,tgt:null,post:i}}
// Neue Einheit aufstellen: Bogenschützen zuerst in den Bergfried, dann auf freie Turmplätze; Nahkämpfer vor den Bergfried
function deployUnit(u){
  if(u.type==='archer'){
    if(unitsAt(KI).length<UPLACES.keep){u.i=u.post=KI;return}
    for(let i=0;i<N;i++){const b=S.grid[i].b;if(b&&b.type==='turm'&&unitsAt(i).length<UPLACES.turm&&unitPath(KI,i)){order([u],i);return}}
    u.i=u.post=KI;return;
  }
  const door=KI+COLS;u.i=KI;u.x=KC+.5;u.y=KR+.5;order([u],inb(KR+1,KC)&&groundOk(door)?door:KI);
}
// Gruppe zu Feld t schicken. Verteilt auf freie Plätze rund um das Ziel (bei Mauern entlang der Mauer).
function order(list,t){
  if(!list.length)return 0;ensure();
  const slots=[],seen=new Set([t]),q=[t],upT=isUp(t);
  for(let h=0;h<q.length&&slots.length<list.length;h++){const i=q[h];
    const free=(upT?upCap(i):GROUND_CAP)-S.units.filter(u=>!list.includes(u)&&(u.dest!=null?u.dest:u.i)===i).length;
    for(let k=0;k<free&&slots.length<list.length;k++)slots.push(i);
    const r=i/COLS|0,c=i%COLS;
    for(const[dr,dc]of DIRS){const r2=r+dr,c2=c+dc;if(!inb(r2,c2))continue;const v=r2*COLS+c2;if(seen.has(v))continue;
      if(upT?!isUp(v):!groundOk(v))continue;seen.add(v);q.push(v)}}
  let n=0;
  list.forEach((u,k)=>{const d=slots[k];if(d==null)return;const p=unitPath(u.i,d);if(!p)return;u.path=p;u.dest=d;u.post=d;u.tgt=null;n++});
  return n;
}
function orderAttack(list,e){// auf einen Feind hetzen: Nahkämpfer laufen hin, Schützen nähern sich bis in Reichweite
  let n=0;for(const u of list){u.tgt=e;u.chase=0;n++}return n;
}
function unitRange(u){const U=UNIT[u.type];if(!U.range)return U.reach;const b=S.grid[u.i].b;
  return b?b.type==='turm'?U.range+1.4:b.type==='keep'?U.range+.3:isWall(b)&&!B[b.type].gate?U.range+.8:U.range:U.range}
function unitLift(u){const b=S.grid[u.i].b;if(!b||u.path.length)return 0;return b.type==='turm'?.64:b.type==='keep'?.85:isWall(b)&&!B[b.type].gate?.36:0}
function hurtUnit(u,dmg){u.hp-=dmg*(UNIT[u.type].armor||1);if(u.hp<=0&&!u.dead){u.dead=true;H.say(UNIT[u.type].n+' ist gefallen.');H.fx(u.x,u.y,'dust',6)}}
// Einheiten bewegen und kämpfen lassen
function updateUnits(dt){
  for(const u of S.units){
    const U=UNIT[u.type];
    // Bewegung entlang des Pfads (bricht ab, wenn der Weg versperrt wurde)
    if(u.path.length){
      const nx=u.path[0];
      if(!unitStep(u.i,nx)){const p=u.dest!=null?unitPath(u.i,u.dest):null;if(p&&p.length){u.path=p}else{u.path=[];u.dest=null;u.post=u.i}continue}
      const tx=nx%COLS+.5,ty=(nx/COLS|0)+.5,dx=tx-u.x,dy=ty-u.y,d=Math.hypot(dx,dy),sp=U.spd*dt;
      if(d<=sp){u.x=tx;u.y=ty;u.i=nx;u.path.shift();if(!u.path.length)u.dest=null}else{u.x+=dx/d*sp;u.y+=dy/d*sp}
    }
    u.cd-=dt;
    if(u.tgt&&(u.tgt.hp<=0||!S.enemies.includes(u.tgt)))u.tgt=null;
    // Ziel wählen: befohlener Feind, sonst nächster in Reichweite (Nahkämpfer verteidigen ihren Posten im Umkreis 2)
    const rng=unitRange(u);let tg=u.tgt,bd=Infinity;
    if(!tg)for(const e of S.enemies){if(e.wait>0||e.hp<=0)continue;const d=Math.hypot(e.x-u.x,e.y-u.y);
      if(d<bd&&(d<=rng||(!U.range&&!u.path.length&&Math.hypot(e.x-(u.post%COLS+.5),e.y-((u.post/COLS|0)+.5))<2.2&&!isUp(u.i)))){bd=d;tg=e}}
    if(!tg){if(!u.path.length&&u.i!==u.post&&!isUp(u.i)){const p=unitPath(u.i,u.post);if(p){u.path=p;u.dest=u.post}}continue}
    const d=Math.hypot(tg.x-u.x,tg.y-u.y);
    if(d<=rng+.05){
      if(u.path.length&&u.dest!=null&&!u.tgt){/* unterwegs: im Vorbeigehen schießen */}
      if(u.cd<=0){u.cd=1/U.rate;let dmg=U.dmg*ETYPE[tg.type].armor;if(U.vsRam&&tg.type==='ram')dmg*=U.vsRam;
        const hp0=tg.hp;tg.hp-=dmg;if(U.range){H.shot(u.x,u.y-unitLift(u),tg.x,tg.y)}else H.sfx('treffer');
        if(tg.hp<=0&&hp0>0)killReward(tg)}
    }else if(!isUp(u.i)||u.tgt){
      // hinterherlaufen (Ziel neu berechnen höchstens alle 0,5 s)
      u.chase=(u.chase||0)-dt;
      if(u.chase<=0){u.chase=.5;const ti=(tg.r)*COLS+tg.c,p=unitPath(u.i,ti);if(p){if(U.range&&p.length)p.length=Math.max(1,p.length-Math.floor(rng));u.path=p;u.dest=p.length?p[p.length-1]:null}}
    }
  }
  if(S.units.some(u=>u.hp<=0)){S.units=S.units.filter(u=>u.hp>0);assignWorkers()}
}
const soldiers=()=>S.units.length;
const soldCost=()=>S.units.reduce((a,u)=>a+UNIT[u.type].sold,0);
// Truppen ausbilden: Kaserne, freie Person, Gold und Waffen. Rückgabe: Fehlertext oder ''.
function recruitWhy(t='archer'){const U=UNIT[t];if(!count('kaserne'))return 'Erst eine Kaserne bauen';if(S.idle<1)return 'Keine freien Leute';
  if(S.res.gold<U.gold)return 'Nicht genug Gold';const miss=Object.keys(U.need).find(k=>S.res[k]<U.need[k]);if(miss)return 'Keine '+RNAME[miss]+' in der Rüstkammer';return ''}
function recruit(t='archer'){const why=recruitWhy(t);if(why)return why;const U=UNIT[t];S.res.gold-=U.gold;for(const[k,v]of Object.entries(U.need))S.res[k]-=v;
  const u=newUnit(t,KI);S.units.push(u);deployUnit(u);assignWorkers();H.sfx('klick');return ''}
