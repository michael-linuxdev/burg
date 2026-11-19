// Zinnenwerk – Echtzeit: Angriffswellen, Feindbewegung, Feuer, Wachen im Bergfried. Kein DOM.
// Eigene Truppen: siehe units.js.
function waveList(k,R){
  const n=Math.max(1,Math.round((1+k*2)*R.scale));
  const extra=(from)=>from!=null&&k>=from?1+Math.floor((k-from)/2):0;
  const nf=extra(R.fire),na=extra(R.archer),nl=extra(R.ladder),nr=extra(R.ram);
  const list=[];const melee=Math.max(1,n-nf-na-nl);
  for(let i=0;i<melee;i++)list.push('raider');for(let i=0;i<nf;i++)list.push('fire');for(let i=0;i<na;i++)list.push('archer');for(let i=0;i<nl;i++)list.push('ladder');
  list.sort(()=>Math.random()-.5);for(let i=0;i<nr;i++)list.push('ram');
  return list;
}
function spawnWave(){
  ensure();
  const R=mission().raid,k=++S.raids,hp=8+k*3,list=waveList(k,R);
  const side=S.raidSide||'Norden',edge=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const on=side==='Norden'?r===0:side==='Süden'?r===ROWS-1:side==='Westen'?c===0:c===COLS-1;
    const t=T(r,c);if(on&&t.t===GRASS&&!t.b&&isFinite(dist[r*COLS+c]))edge.push([r,c]);
  }
  if(!edge.length){S.raidSide=null;return}
  list.forEach((type,i)=>{const[r,c]=edge[Math.floor(Math.random()*edge.length)],et=ETYPE[type],h=Math.round(hp*et.hpM);
    S.enemies.push({w:k,type,r,c,x:c+.5,y:r+.5,tr:null,tc:null,hp:h,max:h,cd:0,ign:1,wait:i*0.7,atk:null,ang:0,climb:0})});
  S.raidActive=true;S.raidSide=null;
  const parts=[];for(const t of Object.keys(ETYPE)){const n=list.filter(x=>x===t).length;if(n)parts.push(n+' '+(n>1?ETYPE[t].pl:ETYPE[t].n))}
  H.say('⚔️ Angriff: '+parts.join(', ')+'!');H.sfx('glocke');H.vibrate([80,60,80]);
}
// Nächsten Schritt wählen: Nachbarfeld mit den geringsten Restkosten (Leitermänner nutzen distL)
function decide(e){
  ensure();const D=e.type==='ladder'?distL:dist;let best=null,bd=Infinity;
  for(const[dr,dc]of DIRS){const r=e.r+dr,c=e.c+dc;if(!inb(r,c))continue;const d=D[r*COLS+c];if(d<bd){bd=d;best=[r,c]}}
  if(!best){e.atk=null;return}
  const[r,c]=best,t=T(r,c);
  if(r===KR&&c===KC)e.atk='keep';
  else if(isWall(t.b)&&!(e.type==='ladder'&&!B[t.b.type].gate))e.atk=[r,c];
  else{e.atk=null;e.tr=r;e.tc=c;if(isWall(t.b))e.climb=ETYPE.ladder.climb}
  e.ang=Math.atan2(r-e.r,c-e.c);
}
// Höhe eines Feindes über dem Boden (Leitermänner beim Klettern und oben auf der Mauer)
function enemyLift(e){const a=tileLift(e.r*COLS+e.c);if(e.tr==null)return a;const b=tileLift(e.tr*COLS+e.tc);
  if(e.climb>0)return a+(b-a)*(1-e.climb/ETYPE.ladder.climb);if(b>a)return b;return a+(b-a)*Math.max(0,1-Math.hypot(e.tc+.5-e.x,e.tr+.5-e.y))}
function ignite(b){if(flammable(b)&&!b.burn){b.burn=0.01;H.sfx('feuer')}}
function wellNear(r,c){for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++){if(inb(r+a,c+b)){const x=T(r+a,c+b).b;if(x&&x.type==='brunnen')return true}}return false}
function hitKeep(n){S.keepHp-=n;if(S.keepHp<=0){S.keepHp=0;gameOver();return true}return false}
function killReward(e){S.res.gold+=e.type==='ram'?RAM_GOLD:KILL_GOLD;H.fx(e.x,e.y,'dust',8)}
function update(dt){
  ensure();
  for(const e of S.enemies){
    if(e.wait>0){e.wait-=dt;continue}
    const et=ETYPE[e.type];e.cd-=dt;
    if(e.type==='fire'){e.ign-=dt;if(e.ign<=0){
      outer:for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){if(!inb(e.r+a,e.c+b))continue;const x=T(e.r+a,e.c+b).b;if(flammable(x)&&!x.burn){ignite(x);e.ign=4;break outer}}
      if(e.ign<=0)e.ign=.5;}}
    // Fernkämpfer: schießen auf die nächste eigene Einheit in Reichweite (auch auf Mauern), sonst auf den Bergfried
    if(et.range&&e.tr==null){
      let tg=null,bd=et.range;for(const u of S.units){const d=Math.hypot(u.x-e.x,u.y-e.y);if(d<bd){bd=d;tg=u}}
      if(tg){if(e.cd<=0){e.cd=1;H.shot(e.x,e.y,tg.x,tg.y,true,enemyLift(e),unitLift(tg));hurtUnit(tg,et.dmg*unitCover(tg))}continue}
      if(Math.hypot(KC+.5-e.x,KR+.5-e.y)<=et.range){if(e.cd<=0){e.cd=1;H.shot(e.x,e.y,KC+.5,KR+.5,true,enemyLift(e),.6);if(hitKeep(et.dmg))return}continue}
    }
    // Nahkämpfer: kämpfen gegen eigene Einheiten am Boden, die ihnen zu nahe kommen (Rammböcke nicht)
    else if(!et.range&&e.type!=='ram'&&!e.climb){
      const foe=S.units.find(u=>!u.dead&&!isUp(u.i)&&!u.path.length&&Math.hypot(u.x-e.x,u.y-e.y)<.75)||S.units.find(u=>!u.dead&&!isUp(u.i)&&Math.hypot(u.x-e.x,u.y-e.y)<.45);
      if(foe){if(e.cd<=0){e.cd=1;hurtUnit(foe,et.dmg);H.sfx('treffer')}continue}
    }
    if(e.atk){
      if(e.atk!=='keep'){const t=T(e.atk[0],e.atk[1]);if(!isWall(t.b)){e.atk=null;continue}}
      if(e.cd<=0){e.cd=1;
        if(e.atk==='keep'){H.fx(KC+.5,KR+1,'dust',3);H.sfx('treffer');if(hitKeep(e.type==='ram'?10:et.dmg))return}
        else{const ar=e.atk[0],ac=e.atk[1],t=T(ar,ac);t.b.hp-=et.dmg;H.fx(ac+.5,ar+.8,'dust',e.type==='ram'?6:2);H.sfx(e.type==='ram'?'ramme':'treffer');
          if(t.b.hp<=0){t.b=null;bump();e.atk=null;H.fx(ac+.5,ar+.6,'dust',16);H.sfx('einsturz');for(const u of S.units)if(u.i===ar*COLS+ac)hurtUnit(u,99);assignWorkers()}}
      }
      continue;
    }
    if(e.tr==null){decide(e);continue}
    if(e.climb>0){e.climb-=dt;continue}// Leiter anlegen und hinaufsteigen
    const tx=e.tc+.5,ty=e.tr+.5,dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy),sp=et.spd*dt;
    if(d<=sp){e.x=tx;e.y=ty;e.r=e.tr;e.c=e.tc;e.tr=null;e.tc=null}else{e.x+=dx/d*sp;e.y+=dy/d*sp}
  }
  // Feuer
  S.grid.forEach((t,i)=>{const b=t.b;if(!b||!b.burn)return;
    const r=i/COLS|0,c=i%COLS;b.burn+=dt;b.hp-=3*dt;
    if(Math.random()<dt*.12)for(const[dr,dc]of DIRS){if(inb(r+dr,c+dc)&&Math.random()<.5)ignite(T(r+dr,c+dc).b)}
    if(b.burn>2.5&&wellNear(r,c)){b.burn=0;return}
    if(b.hp<=0){H.say(B[b.type].n+' ist abgebrannt.');H.fx(c+.5,r+.5,'smoke',14);t.b=null;S.fireDays=3;bump();assignWorkers()}
  });
  // Wachen im Bergfried (Anzahl nach Burgstufe, Reichweite 3,5, ein Pfeil pro Wache und Sekunde)
  const n=KEEP_LV[S.keepLv].guards;
  cds.keep=(cds.keep||0)+dt*n;
  while(cds.keep>=1){
    let tg=null,bd=3.5;
    for(const e of S.enemies){if(e.wait>0||e.hp<=0)continue;const d=Math.hypot(e.x-KC-.5,e.y-KR-.5);if(d<=bd){bd=d;tg=e}}
    if(!tg){cds.keep=Math.min(cds.keep,1);break}
    cds.keep-=1;const hp0=tg.hp;tg.hp-=3*ETYPE[tg.type].armor;H.shot(KC+.5,KR+.5,tg.x,tg.y,false,.85,enemyLift(tg));
    if(tg.hp<=0&&hp0>0)killReward(tg);
  }
  updateUnits(dt);
  // Jede Welle zählt einzeln als abgewehrt, sobald ihr letzter Feind fällt (Wellen können sich überlappen).
  if(S.enemies.some(e=>e.hp<=0)){
    const waves=new Set(S.enemies.map(e=>e.w));S.enemies=S.enemies.filter(e=>e.hp>0);
    for(const w of waves)if(!S.enemies.some(e=>e.w===w)){S.repelled++;S.res.gold+=WAVE_GOLD;H.say('Angriff abgewehrt! +'+WAVE_GOLD+' 💰');checkWin();save()}
    S.raidActive=S.enemies.length>0;
  }
}
// Ein Simulationsschritt: Uhr weiterdrehen, ggf. Tageswechsel, dann Echtzeit-Update.
function step(dt){
  S.clock+=dt;
  while(S.clock>=DAY){S.clock-=DAY;dayTick();if(S.won||S.over)return}
  update(dt);
}
