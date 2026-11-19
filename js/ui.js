// Zinnenwerk – Kamera, Gesten, Oberfläche, Menüs, Hauptschleife
// ---------- Kamera ----------
let zoom=1,baseCell=30,vw=0,vh=0,padT=0,padB=0,padL=0,padR=0;
function resize(){
  const r=$('stage').getBoundingClientRect();dpr=Math.min(window.devicePixelRatio||1,Q().dpr);
  const wasW=vw,land=r.width>r.height*1.1,flip=land!==TRANS;
  if(flip){TRANS=land;document.body.classList.toggle('land',land);zoom=1;terrKey='';weather=[];parts=[]}
  vw=r.width;vh=r.height;cv.width=Math.round(vw*dpr);cv.height=Math.round(vh*dpr);
  if(TRANS){const h=$('hud').getBoundingClientRect(),sr=$('stage').getBoundingClientRect();padL=h.right-sr.left+10;padR=10;padT=10;padB=10}
  else{padL=0;padR=0;padT=$('hud').offsetHeight+14;padB=$('dock').offsetHeight+20}
  const nb=Math.max(8,Math.min((vw-padL-padR)/scN(),(vh-padT-padB)/srN()));
  if(flip||Math.abs(nb-baseCell)>.01||!wasW){baseCell=nb;terrKey='';cell=baseCell*zoom;ox=padL+((vw-padL-padR)-scN()*cell)/2;oy=padT+((vh-padT-padB)-srN()*cell)/2}
  else cell=baseCell*zoom;
  clampCam();
}
function clampCam(){
  const mw=scN()*cell,mh=srN()*cell,aw=vw-padL-padR,ah=vh-padT-padB;
  if(mw<=aw)ox=padL+(aw-mw)/2;else ox=Math.min(padL,Math.max(vw-padR-mw,ox));
  if(mh<=ah)oy=padT+(ah-mh)/2;else oy=Math.min(padT,Math.max(vh-padB-mh,oy));
}
function zoomAt(px,py,z){z=Math.max(1,Math.min(3,z));const wx=(px-ox)/cell,wy=(py-oy)/cell;zoom=z;cell=baseCell*z;ox=px-wx*cell;oy=py-wy*cell;clampCam()}

// ---------- Oberfläche ----------
const tq=[];let tBusy=false;
function toast(m){if(tq.length&&tq[tq.length-1]===m)return;tq.push(m);if(tq.length>4)tq.shift();if(!tBusy)nextToast()}
H.say=toast;
H.vibrate=p=>{if(!SET.vibrate)return;try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};
function nextToast(){const el=$('toast');if(!tq.length){tBusy=false;el.classList.remove('show');return}tBusy=true;el.textContent=tq.shift();el.classList.add('show');setTimeout(()=>{el.classList.remove('show');setTimeout(nextToast,220)},2400)}
const GROUPS=[['Wohnen und Glaube',['haus','kapelle','brunnen']],['Nahrung',['obst','farm','muehle','baecker']],['Rohstoffe',['holzf','stein','mine','weide']],['Lager',['lager','korn','ruest']],['Waffen',['bogner','schmied','gerber']],['Burg',['mauer','tor','turm','kaserne']],['Werkzeug',['abriss']]];
function buildCards(){
  const el=$('cards');el.innerHTML='';
  for(const[name,keys]of GROUPS){
    const h=document.createElement('div');h.className='grp';h.textContent=name;el.appendChild(h);
    const g=document.createElement('div');g.className='cards';
    for(const k of keys){const d=B[k],b=document.createElement('button');b.className='card';b.dataset.k=k;
      b.innerHTML=(d.tool?`<span class="x">${d.i}</span>`:`<img src="${makeIcon(k)}" alt="">`)+`<span class="nm">${d.n}</span><span class="cs">${d.tool?'½ zurück':costTxt(d.cost)}</span>`;
      b.onclick=()=>{sel=k;closeSheets();refreshSel()};g.appendChild(b)}
    el.appendChild(g);
  }
}
function updateCards(){document.querySelectorAll('.card').forEach(b=>b.classList.toggle('poor',!has(B[b.dataset.k].cost)))}
function refreshSel(){
  const on=!!sel;$('toolbar').style.display=on?'flex':'none';$('openBuild').style.display=on?'none':'flex';$('openCourt').style.display=on?'none':'flex';
  if(on){const d=B[sel];$('tIcon').innerHTML=d.tool?d.i:`<img src="${makeIcon(sel)}" alt="">`;
    $('tText').innerHTML=`<b>${d.n}${d.tool?'':' <span style="font-weight:400;color:var(--muted)">'+costTxt(d.cost)+'</span>'}</b>${d.d}`}
  requestAnimationFrame(resize);if(S)hud(true);
}
function openSheet(id){closeSheets();$(id).classList.add('open');if(id==='courtWrap')court();else updateCards()}
function closeSheets(){document.querySelectorAll('.sheetwrap').forEach(w=>w.classList.remove('open'))}
document.querySelectorAll('.sheetwrap').forEach(w=>w.addEventListener('click',e=>{if(e.target===w||e.target.hasAttribute('data-close'))closeSheets()}));
$('openBuild').onclick=()=>openSheet('buildWrap');$('openCourt').onclick=()=>openSheet('courtWrap');
$('tDone').onclick=()=>{sel=null;refreshSel()};
$('tUndo').onclick=()=>{const n=undo();toast(n?(n===1?'Rückgängig gemacht.':n+' Bauteile zurückgenommen.'):'Nichts mehr rückgängig zu machen.');hud(true)};
const segBtns={};
function makeSeg(id,list,set){const el=$(id);segBtns[id]=list.map((o,i)=>{const b=document.createElement('button');b.textContent=o.n;b.onclick=()=>{set(i);if(id==='taxseg'||id==='ratseg')court()};el.appendChild(b);return b})}
makeSeg('taxseg',TAX,i=>S.tax=i);makeSeg('ratseg',RAT,i=>S.ration=i);
function court(){
  segBtns.taxseg.forEach((b,i)=>b.setAttribute('aria-pressed',S.tax===i?'true':'false'));
  segBtns.ratseg.forEach((b,i)=>b.setAttribute('aria-pressed',S.ration===i?'true':'false'));
  const t=TAX[S.tax],g=Math.round(S.pop*t.g);
  $('taxsub').textContent=(g>=0?'+'+g:'−'+Math.abs(g))+' Gold pro Tag, '+(t.p>=0?'+':'−')+Math.abs(t.p)+' Beliebtheit.';
  const need=Math.ceil(S.pop*RAT[S.ration].r),food=S.res.brot+S.res.aepfel;
  let rs=S.ration?need+' Essen pro Tag. Der Vorrat reicht für '+(need?Math.floor(food/need):0)+' Tage.':'Niemand bekommt etwas zu essen.';
  if(S.eff<S.ration)rs+=' Wegen Mangel gilt gerade: '+RAT[S.eff].n+'.';$('ratsub').textContent=rs;
  $('factors').innerHTML=factors().map(([n,v])=>`<li><span>${n}</span><span class="${v>0?'plus':v<0?'minus':''}">${v>0?'+':v<0?'−':'±'}${Math.abs(v)}</span></li>`).join('');
  const sea=seasonOf(S.day),left=SLEN-((S.day-1)%SLEN);
  $('seasub').textContent=SEAS[sea][0]+' '+SEAS[sea][1]+', noch '+left+(left===1?' Tag. ':' Tage. ')+
    (sea===3?'Felder und Obstgärten ruhen. Deine Leute verbrennen '+Math.ceil(S.pop/10)+' Holz pro Tag.':sea===2?'Obstgärten tragen doppelt. Danach kommt der Winter.':'Alle Höfe arbeiten normal.');
  const k=count('kaserne')>0;
  $('armysub').textContent='Truppen: '+S.units.length+(S.units.length?' (Sold '+soldCost()+' 💰 pro Tag)':'')+'. Die Wachen im Bergfried schießen immer mit. Türme fassen je 3 Einheiten.';
  const rb=$('recruit'),why=recruitWhy(),U=UNIT.archer;rb.disabled=!!why;
  rb.textContent=why&&/Kaserne|Leute/.test(why)?why:'Bogenschütze ausbilden ('+U.gold+' 💰 + '+costTxt(U.need)+')';
  if(why&&!/Kaserne|Leute/.test(why))rb.title=why;
  // Burg
  const lv=KEEP_LV[S.keepLv],nx=KEEP_LV[S.keepLv+1];
  $('keepsub').innerHTML=`<img src="${makeIcon('keep'+S.keepLv)}" alt=""><span><b>${lv.n}</b> · ${Math.ceil(S.keepHp)}/${S.keepMax} LP · ${lv.guards} Wachen · ${lv.pop} Grundplätze</span>`;
  const ub=$('upgrade');ub.style.display=nx?'':'none';
  if(nx){ub.disabled=!!upgradeWhy();ub.textContent='Ausbauen zur '+nx.n+' ('+costTxt(nx.cost)+')';$('upsub').textContent=nx.n+': '+nx.hp+' LP, '+nx.guards+' Wachen, '+nx.pop+' Grundplätze, größere Grundlager.'}
  else $('upsub').textContent='Deine Burg ist voll ausgebaut.';
  // Lager
  $('storesub').innerHTML=Object.keys(STORE_NAME).map(kind=>{const ks=Object.keys(STORE).filter(k=>STORE[k]===kind),c=storeCap(kind);
    return `<li><span>${STORE_NAME[kind]} <small>(je ${c})</small></span><span>${ks.filter(k=>S.res[k]>0||kind!=='waffen').map(k=>`<span class="${S.res[k]>=c?'minus':''}">${RICON[k]} ${Math.floor(S.res[k])}</span>`).join(' ')||'leer'}</span></li>`}).join('')+
    (Object.keys(S.spill).length?`<li class="minus"><span>Heute verfallen</span><span>${Object.entries(S.spill).map(([k,v])=>v+' '+RICON[k]).join(' ')}</span></li>`:'');
}
function hint(){
  if(sel)return B[sel].drag?'Mit dem Finger über die Felder ziehen. Mit zwei Fingern verschieben.':'Tippe auf ein helles Feld. Ein Finger verschiebt die Karte.';
  if(S.grid.some(t=>t.b&&t.b.burn))return 'Es brennt! Tippe auf brennende Gebäude, um sie für 2 💰 zu löschen.';
  const sea=seasonOf(S.day),left=SLEN-((S.day-1)%SLEN);
  if(sea===3&&S.cold)return 'Deine Leute frieren. Holzfäller liefern Brennholz.';
  const sp=Object.keys(S.spill);if(sp.length)return 'Lager voll: '+sp.map(k=>RNAME[k]).join(', ')+' verfällt. Baue '+[...new Set(sp.map(k=>STORE_NAME[STORE[k]]))].join(' oder ')+'.';
  if(S.unpaid)return 'Der Sold für die Bogenschützen fehlt. Erhöhe die Steuern oder bilde vorerst keine weiteren Schützen aus.';
  if(!count('holzf'))return 'Tippe auf „Bauen“ und setze einen Holzfäller an den Waldrand.';
  if(!count('obst')&&!count('farm'))return 'Baue einen Obstgarten, damit niemand hungert.';
  const cut=S.grid.filter(t=>t.b&&t.b.cut).length;if(cut)return cut+' Gebäude sind abgeschnitten (graues Zeichen). Baue ein Tor in die Mauer.';
  if(sea===2&&left<=3)return 'Der Winter kommt in '+left+(left===1?' Tag':' Tagen')+'. Lege Essen und Holz auf Vorrat.';
  if(sea===3)return 'Winter: Felder ruhen (blaues Zeichen). Brot und Vorräte bringen dich durch.';
  if(S.pop>=cap()-1&&count('haus')<2)return 'Baue Hütten, damit neue Leute zuziehen.';
  if(mission().goals.some(g=>g[0]==='brot')&&!count('baecker'))return 'Brot entsteht so: Weizenhof, dann Mühle, dann Bäckerei.';
  if(!count('stein')&&S.nextRaid!=null)return 'Ein Steinbruch an den Felsen liefert Stein für Mauern.';
  if(S.lastDelta<0&&S.pp<58)return 'Die Beliebtheit sinkt. Passe Steuern oder Rationen im Hof an.';
  if(mission().raid&&mission().raid.fire<=S.raids+1&&!count('brunnen'))return 'Brandstifter kommen. Brunnen löschen Feuer in der Nähe.';
  if(S.nextRaid!=null&&!count('mauer')&&S.nextRaid<=4)return 'Ziehe Mauern um den Bergfried, bevor die Feinde kommen.';
  if(S.nextRaid!=null&&!count('kaserne')&&S.raids>=1)return 'Mit einer Kaserne bildest du im Hof Bogenschützen aus.';
  if(S.nextRaid!=null&&count('kaserne')&&S.res.bogen<1&&!count('bogner'))return 'Bogenschützen brauchen Bögen. Ein Bogenmacher schnitzt sie aus Holz.';
  if(KEEP_LV[S.keepLv+1]&&!upgradeWhy())return 'Du kannst deine Burg im Hof zur '+KEEP_LV[S.keepLv+1].n+' ausbauen.';
  if(S.idle>0)return S.idle===1?'1 Person hat keine Arbeit.':S.idle+' Leute haben keine Arbeit.';
  const off=S.grid.filter(t=>t.b&&B[t.b.type]&&B[t.b.type].w&&!t.b.on).length;
  if(off)return off+' Gebäude ohne Arbeiter (roter Punkt). Mehr Hütten bringen mehr Leute.';
  return 'Tippe auf ein Feld, um mehr zu erfahren. Zwei Finger zoomen.';
}
let hudT=0;const BASE_SHOW=['holz','stein','weizen','mehl','brot','aepfel','gold'];
function hud(force){
  const t=performance.now();if(!force&&t-hudT<200)return;hudT=t;
  const sea=seasonOf(S.day),tod=timeOfDay();
  $('day').textContent='Tag '+S.day;$('season').textContent=SEAS[sea][0]+' '+SEAS[sea][1];$('clock').textContent=tod.label[0];$('clock').title=tod.label[1];$('clock').setAttribute('aria-label',tod.label[1]);
  // Grundrohstoffe immer, weitere nur wenn vorhanden oder ein Erzeuger steht. Fast volle Lager werden markiert.
  const prodBy=k=>Object.keys(B).some(t=>(B[t].prod&&B[t].prod[k]||B[t].modes&&Object.values(B[t].modes).some(m=>m.prod[k]))&&count(t));
  $('res').innerHTML=RES.filter(([k])=>BASE_SHOW.includes(k)||S.res[k]>0||prodBy(k)).map(([k,i])=>{const c=resCap(k),v=Math.floor(S.res[k]),cls=S.spill[k]?'spill':v>=c*.9?'full':'';
    return `<span class="${cls}" title="${RNAME[k]}${isFinite(c)?' ('+v+' von '+c+')':''}">${i} <b>${v}</b></span>`}).join('');
  $('popl').textContent='👥 '+S.pop+'/'+cap()+(S.idle>0?' ('+S.idle+' frei)':'');
  $('ppn').textContent=Math.round(S.pp);
  const pb=$('ppb');pb.style.width=S.pp+'%';pb.style.background=S.pp>=50?'var(--good)':S.pp>=25?'var(--gold)':'var(--danger)';
  const tr=$('trend');tr.textContent=S.lastDelta>0?'▲':S.lastDelta<0?'▼':'';tr.className=S.lastDelta>0?'plus':'minus';
  const rd=$('raid');
  if(S.enemies.length){rd.textContent='⚔️ '+S.enemies.length+' Feinde';rd.className='soon'}
  else if(S.nextRaid==null){rd.textContent='🕊️ Friedlich';rd.className=''}
  else{rd.textContent='⚔️ in '+S.nextRaid+(S.nextRaid===1?' Tag':' Tagen');rd.className=S.nextRaid<=3?'soon':''}
  $('dayprog').firstChild.style.width=(S.clock/DAY*100)+'%';
  const m=mission();
  if(m.goals.length)$('goal').innerHTML='Ziel: '+goalState().map(g=>`<span class="${g.ok?'done':''}">${GOALTXT[g.t][0]} ${Math.min(g.v,g.n)}/${g.n} ${GOALTXT[g.t][1]}</span>`).join(', ');
  else $('goal').textContent='Freies Spiel: '+S.repelled+(S.repelled===1?' Angriff':' Angriffe')+' abgewehrt';
  $('hint').textContent=hint();
  $('tUndo').disabled=!canUndo();
  if($('courtWrap').classList.contains('open'))court();
  if($('buildWrap').classList.contains('open'))updateCards();
}
function info(r,c){
  const t=T(r,c);
  if(t.b){
    const b=t.b;
    if(b.type==='keep')return toast(KEEP_LV[S.keepLv].n+': '+Math.ceil(S.keepHp)+' von '+S.keepMax+' Lebenspunkten. Fällt sie, ist das Spiel vorbei. Ausbauen kannst du im Hof.');
    const d=B[b.type];
    if(b.burn){if(S.res.gold>=2){S.res.gold-=2;b.burn=0;toast(d.n+' gelöscht. −2 💰')}else toast('Nicht genug Gold zum Löschen.');return}
    if(d.wall)return toast(d.n+': '+Math.max(0,Math.round(b.hp))+' von '+d.hp+' Lebenspunkten.');
    if(b.cut)return toast(d.n+' ist abgeschnitten. Deine Leute brauchen einen Weg zum Bergfried.');
    if(b.winter)return toast(d.n+' ruht im Winter.');
    if(d.modes){b.mode=b.mode==='schwert'?'speer':'schwert';AU.play('klick');return toast('Schmied stellt jetzt '+(b.mode==='schwert'?'Schwerter':'Speere')+' her ('+costTxt(d.modes[b.mode].use)+' → '+costTxt(d.modes[b.mode].prod)+').')}
    if(d.store)return toast(d.n+': +'+STORE_ADD[d.store]+' Platz je Rohstoff. Insgesamt passen jetzt '+storeCap(d.store)+' hinein.');
    if(d.w)return toast(d.n+': '+(b.on?(b.starved?'wartet auf Rohstoffe ('+costTxt(recipe(b).use)+').':'arbeitet.'):'braucht '+d.w+' Arbeiter.'));
    return toast(d.n+'. '+d.d);
  }
  toast(t.t===TREE?'Wald. Holzfäller brauchen ihn in der Nähe.':t.t===ROCK?'Felsen. Hier gehört ein Steinbruch hin.':t.t===WATER?(seasonOf(S.day)===3?'Ein zugefrorener Teich.':'Ein Teich.'):'Freies Feld. Öffne „Bauen“, um etwas zu errichten.');
}
// ---------- Gesten ----------
const ptrs=new Map();let gest=null;
const loc=e=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
const tileAtP=p=>{const sc=Math.floor((p.x-ox)/cell),sr=Math.floor((p.y-oy)/cell),r=TRANS?sc:sr,c=TRANS?sr:sc;return inb(r,c)?[r,c]:null};
cv.addEventListener('pointerdown',e=>{
  if(!S||uiPause)return;cv.setPointerCapture(e.pointerId);const p=loc(e);ptrs.set(e.pointerId,p);
  if(ptrs.size===2){if(gest&&gest.mode==='paint')undoEnd();const[a,b]=[...ptrs.values()];gest={mode:'pinch',d0:Math.hypot(a.x-b.x,a.y-b.y)||1,z0:zoom,mx:(a.x+b.x)/2,my:(a.y+b.y)/2};return}
  if(ptrs.size>2)return;
  gest={mode:'pending',sx:p.x,sy:p.y,ox0:ox,oy0:oy,last:''};
  if(sel&&B[sel].drag&&!S.over&&!S.won){gest.mode='paint';undoBegin();paint(p,true)}
});
cv.addEventListener('pointermove',e=>{
  if(!ptrs.has(e.pointerId))return;const p=loc(e);ptrs.set(e.pointerId,p);if(!gest)return;
  if(gest.mode==='pinch'){if(ptrs.size<2)return;const[a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    ox+=mx-gest.mx;oy+=my-gest.my;gest.mx=mx;gest.my=my;zoomAt(mx,my,gest.z0*d/gest.d0);return}
  if(gest.mode==='paint'){paint(p,false);return}
  const dx=p.x-gest.sx,dy=p.y-gest.sy;
  if(gest.mode==='pending'&&Math.hypot(dx,dy)>8)gest.mode='pan';
  if(gest.mode==='pan'){ox=gest.ox0+dx;oy=gest.oy0+dy;clampCam()}
});
const endPtr=e=>{
  if(!ptrs.has(e.pointerId))return;const p=ptrs.get(e.pointerId);ptrs.delete(e.pointerId);
  if(gest&&gest.mode==='pending'&&e.type==='pointerup')tap(p);
  if(ptrs.size===1&&gest&&gest.mode==='pinch'){const q=[...ptrs.values()][0];gest={mode:'pan',sx:q.x,sy:q.y,ox0:ox,oy0:oy}}
  else if(!ptrs.size){if(gest&&gest.mode==='paint')undoEnd();gest=null;if(S)hud(true)}
};
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('wheel',e=>{e.preventDefault();const p=loc(e);zoomAt(p.x,p.y,zoom*Math.exp(-e.deltaY*.0015))},{passive:false});
function paint(p,first){const t=tileAtP(p);if(!t)return;const k=t.join(',');if(k===gest.last)return;gest.last=k;record(act(sel,t[0],t[1],!first));hud(true)}
function tap(p){if(S.over||S.won)return;const t=tileAtP(p);if(!t)return;if(!sel)info(t[0],t[1]);else{record(act(sel,t[0],t[1],false));hud(true)}}
function setSpeed(v){speed=v;document.querySelectorAll('.speed button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.s===v?'true':'false'))}
document.querySelectorAll('.speed button').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.s));
$('upgrade').onclick=()=>{const why=upgradeKeep();if(why)toast(why);terrKey='';court();hud(true)};
$('recruit').onclick=()=>{const why=recruit();toast(why?why+'.':'Ein Bogenschütze steht bereit.');court();hud(true)};

// ---------- Menü & Dialoge ----------
function modal(title,html,btns){
  $('mTitle').textContent=title;$('mBody').innerHTML=html;const row=$('mBtns');row.innerHTML='';
  btns.forEach(b=>{const el=document.createElement('button');el.className='btn'+(b.p?' primary':'');el.textContent=b.t;el.onclick=b.f;row.appendChild(el)});
  $('modal').style.display='flex';uiPause=true;closeSheets();
}
function closeModal(){$('modal').style.display='none';$('menu').style.display='none';uiPause=false;if(S)hud(true);if(typeof tutTick==='function')tutTick()}
function brief(mi){
  const m=mi<0?FREE:MISSIONS[mi];
  const goals=m.goals.length?'<ul class="goals">'+m.goals.map(([t,n])=>'<li>'+GOALTXT[t][0]+' '+n+' '+GOALTXT[t][1]+'</li>').join('')+'</ul>':'';
  $('menu').style.display='none';
  modal((mi<0?'':'Mission '+(mi+1)+': ')+m.n,'<p>'+m.s+'</p>'+goals+'<p class="tip">Alle 6 Tage wechselt die Jahreszeit. Im Winter ruhen Felder und Obstgärten.</p>',
    [{t:'Los geht’s',p:1,f:()=>{newGame(mi);closeModal();toast(mi<0?'Die ersten Feinde kommen an Tag 8.':'Viel Erfolg!')}},{t:'Zurück',f:openMenu}]);
}
function newGame(mi){startGame(mi);resetView();zoom=1;setSpeed(SET.speed);refreshSel();resize();if(typeof tutMaybeStart==='function')tutMaybeStart()}
H.won=()=>{
  const next=S.mi+1<MISSIONS.length?S.mi+1:null;
  modal('Mission geschafft','<p>„'+mission().n+'“ ist abgeschlossen. Deine Burg steht nach '+S.day+' Tagen stolzer da als je zuvor.</p>'+(next==null?'<p>Das war die letzte Mission. Im freien Spiel kannst du weiterbauen.</p>':''),
    next!=null?[{t:'Nächste Mission',p:1,f:()=>brief(next)},{t:'Menü',f:openMenu}]:[{t:'Freies Spiel',p:1,f:()=>brief(-1)},{t:'Menü',f:openMenu}]);
};
H.lost=()=>{
  modal('Die Burg ist gefallen','<p>Deine Burg hielt '+S.day+' Tage stand und wehrte '+S.repelled+(S.repelled===1?' Angriff':' Angriffe')+' ab.</p>',
    [{t:'Nochmal versuchen',p:1,f:()=>{newGame(S.mi);closeModal()}},{t:'Menü',f:openMenu}]);
};
function openMenu(){
  $('modal').style.display='none';uiPause=true;closeSheets();
  const p=getProg(),hasRun=S&&!S.over&&!S.won;
  $('contRow').style.display=hasRun?'flex':'none';
  if(hasRun)$('cont').textContent='Weiterspielen: '+mission().n+', Tag '+S.day;
  const ol=$('mlist');ol.innerHTML='';
  MISSIONS.forEach((m,i)=>{const open=i===0||p.done.includes(i-1)||p.done.includes(i),done=p.done.includes(i);
    const li=document.createElement('li'),b=document.createElement('button');b.disabled=!open;
    b.innerHTML=`<span class="no">${i+1}</span><span><span class="mt">${m.n}</span><span class="ms">${m.goals.map(([t,n])=>GOALTXT[t][0]+' '+n).join('  ')}</span></span><span class="st">${done?'✓ geschafft':open?'':'🔒'}</span>`;
    b.onclick=()=>brief(i);li.appendChild(b);ol.appendChild(li)});
  renderSlots();
  $('menu').style.display='flex';
}
$('cont').onclick=closeModal;$('free').onclick=()=>brief(-1);$('menuBtn').onclick=openMenu;

// ---------- Spielstände ----------
const fmtWhen=ts=>{if(!ts)return '';const d=new Date(ts),t=new Date();const hm=d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  return d.toDateString()===t.toDateString()?'heute, '+hm:d.toLocaleDateString('de-DE',{day:'numeric',month:'numeric'})+', '+hm};
function renderSlots(){
  const ul=$('slots');ul.innerHTML='';const running=S&&!S.over&&!S.won;
  const rows=[['auto','Automatisch',AUTO],[1,'Platz 1',SLOT+1],[2,'Platz 2',SLOT+2],[3,'Platz 3',SLOT+3]];
  for(const[id,label,key]of rows){
    const o=readSave(key),pv=savePreview(o),li=document.createElement('li');
    li.innerHTML=`<div class="sl"><b>${label}</b><span>${pv?pv.name+' · Tag '+pv.day+' · '+pv.season:'leer'}</span>${pv&&pv.saved?`<small>${fmtWhen(pv.saved)}</small>`:''}</div>`;
    const btns=document.createElement('div');btns.className='sb';
    if(id!=='auto'&&running){const b=document.createElement('button');b.className='btn';b.textContent='Speichern';
      b.onclick=()=>{if(o&&!b.dataset.sure){b.dataset.sure=1;b.textContent='Überschreiben?';return}saveSlot(id);toast('Gespeichert in '+label+'.');renderSlots()};btns.appendChild(b)}
    if(o){const b=document.createElement('button');b.className='btn primary';b.textContent='Laden';
      b.onclick=()=>{const fresh=readSave(key);if(!fresh)return;resume(fresh);save();resetView();zoom=1;setSpeed(SET.speed);refreshSel();resize();closeModal();toast(label+' geladen.')};btns.appendChild(b)}
    li.appendChild(btns);ul.appendChild(li);
  }
}

// ---------- Einstellungen ----------
function openSettings(){
  $('volMusic').value=Math.round(SET.music*100);$('volSfx').value=Math.round(SET.sfx*100);
  $('setVib').checked=SET.vibrate;$('setTut').checked=SET.tutorial;
  segBtns.qualseg.forEach((b,i)=>b.setAttribute('aria-pressed',Object.keys(QUALITY)[i]===SET.quality?'true':'false'));
  segBtns.speedseg.forEach((b,i)=>b.setAttribute('aria-pressed',[1,3][i]===SET.speed?'true':'false'));
  $('qualsub').textContent=SET.quality==='niedrig'?'Weniger Partikel und Wetter, einfaches Nachtlicht, geringere Auflösung. Für ältere Handys.':SET.quality==='mittel'?'Weniger Partikel und Wetter, Lichtkegel ohne Leuchten.':'Alle Effekte.';
  $('menu').style.display='none';$('settings').style.display='flex';
}
makeSeg('qualseg',Object.values(QUALITY),i=>{SET.quality=Object.keys(QUALITY)[i];saveSettings();terrKey='';resize();openSettings()});
makeSeg('speedseg',[{n:'1×'},{n:'3×'}],i=>{SET.speed=[1,3][i];saveSettings();openSettings()});
$('volMusic').oninput=e=>{SET.music=e.target.value/100;AU.setVolume('music',SET.music);saveSettings()};
$('volSfx').oninput=e=>{SET.sfx=e.target.value/100;AU.setVolume('sfx',SET.sfx);saveSettings()};
$('volSfx').onchange=()=>AU.play('bau');
$('setVib').onchange=e=>{SET.vibrate=e.target.checked;saveSettings();if(SET.vibrate)H.vibrate(40)};
$('setTut').onchange=e=>{SET.tutorial=e.target.checked;if(SET.tutorial)SET.tutDone=false;saveSettings()};
$('setClose').onclick=()=>{$('settings').style.display='none';openMenu()};
$('openSettings').onclick=openSettings;
$('tutAgain').onclick=()=>{SET.tutorial=true;SET.tutDone=false;saveSettings();$('settings').style.display='none';brief(0)};
AU.setVolume('music',SET.music);AU.setVolume('sfx',SET.sfx);
// Klang erst nach der ersten Berührung starten (Browser-Regel)
['pointerdown','keydown'].forEach(ev=>window.addEventListener(ev,()=>AU.unlock(),{capture:true,passive:true}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)AU.suspend();else AU.resume()});

function loop(t){
  now=t/1000;const real=Math.min(.05,(t-lastT)/1000)||0;lastT=t;
  if(S&&!S.over&&!S.won&&!uiPause&&speed>0){
    for(let i=0;i<speed;i++){step(real);if(S.won||S.over)break;updateLife(real)}
  }
  arrows.forEach(a=>a.t+=real);arrows=arrows.filter(a=>a.t<.3);
  draw(uiPause||!speed||!S||S.over||S.won?0:real*speed);if(S){hud();AU.setMood(S.enemies.length||(S.nextRaid!=null&&S.nextRaid<=1&&!S.over)?'war':'calm')}
  requestAnimationFrame(loop);
}
const saved=loadSave();
if(saved)resume(saved);
else startGame(0);
buildCards();$('buildIc').src=makeIcon('haus');
new ResizeObserver(resize).observe($('stage'));new ResizeObserver(resize).observe($('hud'));resize();
hud(true);openMenu();
requestAnimationFrame(loop);
