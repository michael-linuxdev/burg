// Zinnenwerk – Ereignisse und Markt. Kein DOM.
//
// Ereignisse würfelt dayTick() einmal am Tag (eventTick). Manche wirken sofort (Blitz, Wölfe), manche
// über mehrere Tage (Seuche, Missernte), manche verlangen eine Entscheidung (Händler, Turnier, Festtag).
// Entscheidungen liegen in S.ev.pending und werden über H.event() angezeigt; die Darstellung ruft
// resolveEvent(index) auf. Bleibt eine Entscheidung bis zum nächsten Tag offen, gilt „Ablehnen“.
const EVENTS={
  pest:{n:'Seuche',i:'🤒',w:2,when:()=>S.pop>=18&&!S.ev.pest,
    go(){if(count('apotheke')&&anyOn('apotheke')&&Math.random()<.7){H.say('🤒 Eine Seuche droht, aber deine Apotheke hält sie auf.');return}
      S.ev.pest=PEST_DAYS;H.say('🤒 Seuche! Jeden Tag stirbt jemand. Eine Apotheke heilt sie schnell.');H.sfx('glocke')}},
  harvest:{n:'Missernte',i:'🥀',w:2,when:()=>seasonOf(S.day)<3&&!S.ev.harvest&&(count('farm')+count('obst'))>0,
    go(){S.ev.harvest=BAD_HARVEST_DAYS;H.say('🥀 Missernte! Höfe und Obstgärten tragen '+BAD_HARVEST_DAYS+' Tage lang nur halb so viel.')}},
  wolves:{n:'Wölfe',i:'🐺',w:3,when:()=>seasonOf(S.day)===3,
    go(){const n=spawnWolves(2+Math.floor(S.day/18));if(n){H.say('🐺 Hungrige Wölfe kommen aus dem Wald!');H.sfx('glocke')}}},
  lightning:{n:'Blitzschlag',i:'⚡',w:2,when:()=>seasonOf(S.day)===1&&S.grid.some(t=>flammable(t.b)),
    go(){const l=S.grid.map((t,i)=>[t,i]).filter(([t])=>flammable(t.b)&&!t.b.burn);if(!l.length)return;const[t,i]=l[Math.floor(Math.random()*l.length)];
      ignite(t.b);H.fx(i%COLS+.5,(i/COLS|0)+.5,'ember',12);H.say('⚡ Ein Blitz hat '+B[t.b.type].n+' getroffen. Es brennt!')}},
  trader:{n:'Händler',i:'🧳',w:3,when:()=>true,choice:true,
    make(){// zwei Angebote zum Vorzugspreis: etwas kaufen, etwas verkaufen
      const buy=pickRes(k=>resCap(k)-S.res[k]>=10),sell=pickRes(k=>S.res[k]>=10&&k!==buy);const o=[];
      if(buy){const n=10,g=Math.ceil(n*PRICE[buy][0]*.75);o.push({t:'Kaufen: '+n+' '+RICON[buy]+' für '+g+' 💰',cost:{gold:g},gain:{[buy]:n}})}
      if(sell){const n=10,g=Math.floor(n*PRICE[sell][1]*1.4);o.push({t:'Verkaufen: '+n+' '+RICON[sell]+' für '+g+' 💰',cost:{[sell]:n},gain:{gold:g}})}
      return{text:'Ein Händler zieht durch dein Dorf und bietet dir ein gutes Geschäft an.',opts:o}}},
  tourney:{n:'Turnier',i:'🏇',w:2,when:()=>S.res.gold>=60&&S.pop>=16,choice:true,
    make(){return{text:'Die Ritter der Gegend wollen ein Turnier abhalten. Das Volk wäre begeistert.',opts:[{t:'Turnier ausrichten (50 💰, +10 ❤️)',cost:{gold:50},pp:10}]}}},
  feast:{n:'Festtag',i:'🎉',w:2,when:()=>S.res.gold>=25,choice:true,
    make(){return{text:'Morgen ist der Tag des Schutzheiligen. Ein Fest würde die Leute freuen.',opts:[{t:'Fest feiern (20 💰, 10 Essen, +5 ❤️)',cost:{gold:20},food:10,pp:5}]}}}
};
const anyOn=k=>S.grid.some(t=>t.b&&t.b.type===k&&t.b.on);
function pickRes(ok){const l=Object.keys(PRICE).filter(ok);return l.length?l[Math.floor(Math.random()*l.length)]:null}
// Laufende Ereignisse abarbeiten und ggf. ein neues auslösen (einmal am Tag aus dayTick)
function eventTick(){
  const ev=S.ev;
  if(ev.pending)resolveEvent(-1);
  if(ev.pest>0){
    if(anyOn('apotheke')){ev.pest=0;H.say('💊 Die Apotheke hat die Seuche besiegt.')}
    else{ev.pest--;if(S.pop>S.units.length+1){S.pop--;assignWorkers()}if(!ev.pest)H.say('Die Seuche ist vorüber.')}
  }
  if(ev.harvest>0){ev.harvest--;if(!ev.harvest)H.say('Die Felder tragen wieder normal.')}
  if(ev.cool>0){ev.cool--;return}
  const m=mission();if(m.events===false||S.day<6||Math.random()>=EVENT_CHANCE)return;
  const list=Object.entries(EVENTS).filter(([,e])=>e.when());if(!list.length)return;
  let r=Math.random()*list.reduce((a,[,e])=>a+e.w,0),pick=list[0];for(const x of list){r-=x[1].w;if(r<=0){pick=x;break}}
  triggerEvent(pick[0]);
}
function triggerEvent(id){
  const e=EVENTS[id];S.ev.cool=EVENT_COOL;S.ev.log.push([S.day,id]);if(S.ev.log.length>20)S.ev.log.shift();
  if(!e.choice){e.go();return}
  const m=e.make();if(!m.opts.length)return;
  S.ev.pending={id,n:e.n,i:e.i,text:m.text,opts:m.opts};H.event(S.ev.pending);
}
// Prüft, ob eine Option bezahlbar ist. Rückgabe: Grund oder ''.
function eventWhy(o){
  const miss=Object.keys(o.cost||{}).find(k=>S.res[k]<o.cost[k]);if(miss)return 'Nicht genug '+RNAME[miss];
  if(o.food&&S.res.brot+S.res.aepfel<o.food)return 'Nicht genug Essen';
  return '';
}
// Entscheidung umsetzen: i = Index der Option, −1 = ablehnen. Rückgabe: Fehlertext oder ''.
function resolveEvent(i){
  const p=S.ev.pending;if(!p)return '';
  if(i>=0){const o=p.opts[i];const why=eventWhy(o);if(why)return why;
    for(const[k,v]of Object.entries(o.cost||{}))S.res[k]-=v;
    if(o.food){let f=o.food;for(const k of['aepfel','brot']){const t=Math.min(S.res[k],f);S.res[k]-=t;f-=t}}
    for(const[k,v]of Object.entries(o.gain||{}))S.res[k]+=v;
    if(o.pp)S.pp=Math.min(100,S.pp+o.pp);
    clampRes();H.sfx('klick');
  }
  S.ev.pending=null;return '';
}
// ---------- Markt ----------
// Kaufen (dir=1) oder verkaufen (dir=−1) von TRADE_N Stück. Rückgabe: Fehlertext oder ''.
const tradePrice=(k,dir)=>dir>0?Math.ceil(TRADE_N*PRICE[k][0]):Math.floor(TRADE_N*PRICE[k][1]);
function tradeWhy(k,dir){
  if(!count('markt'))return 'Erst einen Markt bauen';
  if(dir>0){if(S.res.gold<tradePrice(k,1))return 'Nicht genug Gold';if(S.res[k]+TRADE_N>resCap(k))return 'Kein Platz mehr ('+STORE_NAME[STORE[k]]+')'}
  else if(S.res[k]<TRADE_N)return 'Zu wenig '+RNAME[k];
  return '';
}
function trade(k,dir){const why=tradeWhy(k,dir);if(why)return why;S.res.gold-=dir*tradePrice(k,dir);S.res[k]+=dir*TRADE_N;H.sfx('klick');return ''}
