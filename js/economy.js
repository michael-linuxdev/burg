// Zinnenwerk – Tageslauf: Produktion, Essen, Brennholz, Steuern, Beliebtheit, Bevölkerung, Angriffsplan, Ziele. Kein DOM.
function factors(){
  const f=[['Rationen ('+RAT[S.eff].n+')',RAT[S.eff].p]];
  if(S.variety>1)f.push(['Abwechslung beim Essen',2]);
  f.push(['Steuern ('+TAX[S.tax].n+')',TAX[S.tax].p]);
  const k=Math.min(count('kapelle'),3);if(k)f.push(['Kapellen',k*2]);
  if(S.fireDays>0)f.push(['Angst nach Bränden',-3]);
  if(S.cold)f.push(['Kälte ohne Brennholz',-4]);
  if(S.unpaid)f.push(['Sold nicht bezahlt',-3]);
  return f;
}
// Jahreszeit-Faktor der Produktion: Herbst Obst ×2, Winter Viehweide ×0,5 (Felder und Obst ruhen ganz)
function prodMult(type,sea){if(type==='obst'&&sea===2)return 2;if(type==='weide'&&sea===3)return .5;return 1}
function dayTick(){
  const sBefore=seasonOf(S.day);S.day++;const sea=seasonOf(S.day);
  assignWorkers();
  // Produktion in Stufen (tier): erst Rohstoffe, dann Mühle (1), dann Bäckerei und Werkstätten (2).
  // So wird frisch Geerntetes noch am selben Tag weiterverarbeitet.
  const bl=S.grid.map(t=>t.b).filter(b=>b&&b.on&&!b.cut);
  const pass=tier=>bl.filter(b=>(B[b.type].tier||0)===tier).forEach(b=>{const rc=recipe(b);
    if(sea===3&&(b.type==='obst'||b.type==='farm')){b.winter=1;return}b.winter=0;
    if(rc.use&&!has(rc.use)){b.starved=1;return}b.starved=0;if(rc.use)for(const[k,v]of Object.entries(rc.use))S.res[k]-=v;
    for(const[k,v]of Object.entries(rc.prod))S.res[k]+=Math.round(v*prodMult(b.type,sea))});
  S.grid.forEach(t=>{if(t.b&&(t.b.type==='obst'||t.b.type==='farm'))t.b.winter=sea===3?1:0});
  S.spill={};pass(0);pass(1);pass(2);
  const lost=clampRes(),lk=Object.keys(lost);
  if(lk.length)H.say('Lager voll: '+lk.map(k=>lost[k]+' '+RNAME[k]).join(', ')+' verfallen. Baue '+[...new Set(lk.map(k=>STORE_NAME[STORE[k]]))].map(n=>n==='Kornkammer'?'eine Kornkammer':n==='Rüstkammer'?'eine Rüstkammer':'ein Lager').join(' oder ')+'.');
  // Essen
  const food=S.res.brot+S.res.aepfel;let eff=S.ration;
  while(eff>0&&food<Math.ceil(S.pop*RAT[eff].r))eff--;
  if(eff<S.ration&&eff!==S.prevEff)H.say(eff===0?'Die Vorräte sind leer. Dein Volk hungert.':'Zu wenig Essen, die Rationen wurden gekürzt.');
  S.prevEff=S.eff=eff;
  let need=Math.min(food,Math.ceil(S.pop*RAT[eff].r));
  const kinds=['brot','aepfel'].filter(k=>S.res[k]>0).sort((a,b)=>S.res[a]-S.res[b]);
  S.variety=eff>0?kinds.length:0;
  kinds.forEach((k,i)=>{const take=Math.min(S.res[k],Math.ceil(need/(kinds.length-i)));S.res[k]-=take;need-=take});
  // Brennholz im Winter
  if(sea===3){const need=Math.ceil(S.pop/10);if(S.res.holz>=need){S.res.holz-=need;S.cold=false}else{if(!S.cold)H.say('Kein Brennholz! Deine Leute frieren.');S.cold=true}}else S.cold=false;
  if(sea!==sBefore)H.say(['🌸 Frühling! Die Felder tragen wieder.','☀️ Der Sommer beginnt.','🍂 Herbst: Obstgärten tragen doppelt.','❄️ Winter: Felder und Obstgärten ruhen, und deine Leute verbrennen Holz.'][sea]);
  if(sea===2&&(S.day-1)%SLEN===SLEN-2)H.say('Der Winter naht. Lege Essen und Holz auf Vorrat.');
  // Steuern
  if(S.tax===0&&S.res.gold<Math.ceil(S.pop*0.4)){S.tax=1;H.say('Kein Gold mehr für Geschenke.')}
  S.res.gold=Math.max(0,S.res.gold+Math.round(S.pop*TAX[S.tax].g));
  // Sold für Bogenschützen; reicht das Gold nicht, sinkt die Beliebtheit
  const sold=soldCost();
  if(sold){if(S.res.gold>=sold){S.res.gold-=sold;S.unpaid=false}else{if(!S.unpaid)H.say('Der Sold für deine Truppen fehlt! Das Volk murrt.');S.res.gold=0;S.unpaid=true}}else S.unpaid=false;
  // Beliebtheit
  const sum=factors().reduce((a,x)=>a+x[1],0);
  const before=S.pp;S.pp=Math.max(0,Math.min(100,S.pp+sum*0.5));S.lastDelta=S.pp-before;
  if(S.fireDays>0)S.fireDays--;
  // Bevölkerung
  const cp=cap();
  if(S.pp>=50&&S.pop<cp)S.pop+=Math.min(cp-S.pop,S.pp>=75?2:1);
  else if(S.pp<50){const old=S.pop;S.pop=Math.max(S.units.length,S.pop-(S.pp<25?2:1));if(S.pop<old&&S.day%3===0)H.say('Unzufriedene Leute verlassen die Burg.')}
  if(S.pop>cp)S.pop=Math.max(S.units.length,cp);
  assignWorkers();
  // Angriffe
  if(S.nextRaid!=null){
    S.nextRaid--;
    if(S.nextRaid===3){const sides=S.raids<2?['Norden','Osten','Westen']:['Norden','Osten','Westen','Süden'];S.raidSide=sides[Math.floor(Math.random()*sides.length)];H.say('Späher melden Feinde aus dem '+H.side(S.raidSide)+'.')}
    if(S.nextRaid<=0){spawnWave();S.nextRaid=mission().raid.every}
  }
  checkWin();save();
}
function goalState(){return mission().goals.map(([t,n])=>{const v=t==='pop'?S.pop:t==='brot'?S.res.brot:t==='raids'?S.repelled:Math.round(S.pp);return{t,n,v,ok:v>=n}})}
function checkWin(){
  if(S.won||S.over||!mission().goals.length)return;
  if(goalState().every(x=>x.ok)){
    S.won=true;save();
    const p=getProg();if(!p.done.includes(S.mi))p.done.push(S.mi);setProg(p);
    H.sfx('sieg');H.won();
  }
}
function gameOver(){S.over=true;save();H.sfx('niederlage');H.lost()}
