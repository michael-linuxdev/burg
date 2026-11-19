// Zinnenwerk – Echtzeit: Angriffswellen, Feindbewegung, Feuer, Bogenschützen. Kein DOM.
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
    S.enemies.push({w:k,type,r,c,x:c+.5,y:r+.5,tr:null,tc:null,hp:h,max:h,cd:0,ign:1,wait:i*0.7,atk:null,ang:0})});
  S.raidActive=true;S.raidSide=null;
  const parts=[];const cnt=t=>list.filter(x=>x===t).length;
  if(cnt('raider'))parts.push(cnt('raider')+' Räuber');if(cnt('fire'))parts.push(cnt('fire')+' Brandstifter');if(cnt('ram'))parts.push(cnt('ram')+(cnt('ram')>1?' Rammböcke':' Rammbock'));
  H.say('⚔️ Angriff: '+parts.join(', ')+'!');H.sfx('glocke');H.vibrate([80,60,80]);
}
function decide(e){
  ensure();let best=null,bd=Infinity;
  for(const[dr,dc]of DIRS){const r=e.r+dr,c=e.c+dc;if(!inb(r,c))continue;const d=dist[r*COLS+c];if(d<bd){bd=d;best=[r,c]}}
  if(!best){e.atk=null;return}
  const[r,c]=best,t=T(r,c);
  if(r===KR&&c===KC)e.atk='keep';
  else if(isWall(t.b))e.atk=[r,c];
  else{e.atk=null;e.tr=r;e.tc=c}
  e.ang=Math.atan2(r-e.r,c-e.c);
}
function ignite(b){if(flammable(b)&&!b.burn){b.burn=0.01;H.sfx('feuer')}}
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
        if(e.atk==='keep'){H.fx(KC+.5,KR+1,'dust',3);H.sfx('treffer');S.keepHp-=e.type==='ram'?10:et.dmg;if(S.keepHp<=0){S.keepHp=0;gameOver();return}}
        else{const ar=e.atk[0],ac=e.atk[1],t=T(ar,ac);t.b.hp-=et.dmg;H.fx(ac+.5,ar+.8,'dust',e.type==='ram'?6:2);H.sfx(e.type==='ram'?'ramme':'treffer');
          if(t.b.hp<=0){t.b=null;bump();e.atk=null;H.fx(ac+.5,ar+.6,'dust',16);H.sfx('einsturz');assignWorkers()}}
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
    if(Math.random()<dt*.12)for(const[dr,dc]of DIRS){if(inb(r+dr,c+dc)&&Math.random()<.5)ignite(T(r+dr,c+dc).b)}
    if(b.burn>2.5&&wellNear(r,c)){b.burn=0;return}
    if(b.hp<=0){H.say(B[b.type].n+' ist abgebrannt.');H.fx(c+.5,r+.5,'smoke',14);t.b=null;S.fireDays=3;bump();assignWorkers()}
  });
  // Schützen: Bergfried (2 Wachen + bis zu 3 Schützen, Reichweite 3,5), Türme (je bis zu 3, Reichweite 4,6), Rest in den Bergfried.
  let a=S.archers;const sh=[{k:'keep',x:KC+.5,y:KR+.5,range:3.5,n:2+Math.min(a,3)}];a-=Math.min(a,3);
  S.grid.forEach((t,i)=>{if(t.b&&t.b.type==='turm'){const k=Math.min(a,3);a-=k;t.b.arch=k;if(k)sh.push({k:'t'+i,x:i%COLS+.5,y:(i/COLS|0)+.5,range:4.6,n:k})}});
  if(a>0)sh[0].n+=a;
  for(const s of sh){
    cds[s.k]=(cds[s.k]||0)+dt*s.n;
    while(cds[s.k]>=1){
      let tg=null,bd=s.range;
      for(const e of S.enemies){if(e.wait>0||e.hp<=0)continue;const d=Math.hypot(e.x-s.x,e.y-s.y);if(d<=bd){bd=d;tg=e}}
      if(!tg){cds[s.k]=Math.min(cds[s.k],1);break}
      cds[s.k]-=1;tg.hp-=3*ETYPE[tg.type].armor;H.shot(s.x,s.y,tg.x,tg.y);
      if(tg.hp<=0){S.res.gold+=tg.type==='ram'?RAM_GOLD:KILL_GOLD;H.fx(tg.x,tg.y,'dust',8)}
    }
  }
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
// Bogenschützen ausbilden: braucht Kaserne, eine freie Person und ARCHER_GOLD. Rückgabe: Fehlertext oder ''.
function recruitWhy(){if(!count('kaserne'))return 'Erst eine Kaserne bauen';if(S.idle<1)return 'Keine freien Leute';if(S.res.gold<ARCHER_GOLD)return 'Nicht genug Gold';return ''}
function recruit(){const why=recruitWhy();if(why)return why;S.res.gold-=ARCHER_GOLD;S.archers++;assignWorkers();H.sfx('klick');return ''}
