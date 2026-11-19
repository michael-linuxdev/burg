// Burgwacht – Spielprotokoll für Playtests (Oberfläche). Schreibt lokal mit, was im Spiel passiert:
// Missionsstarts, Bauen/Abreißen, Ausbilden, Befehle, Handel, Ereignisse, Meldungen, Tageszusammenfassung,
// Tempo, Bildrate, Fehler und eigene Notizen. Nur im Browser gespeichert (localStorage), abschaltbar.
// Ansehen, kopieren, als Datei speichern oder leeren im Menü unter „Spielprotokoll“.
const PLOG_KEY='zinnenwerk-playlog',PLOG_MAX=4000;
const PL={buf:[],t0:Date.now(),saveT:0,fpsN:0,fpsT:performance.now(),lastMsg:''};
try{PL.buf=JSON.parse(store.get(PLOG_KEY)||'[]');if(!Array.isArray(PL.buf))PL.buf=[]}catch(e){PL.buf=[]}
if(SET.playlog===undefined)SET.playlog=true;
function plog(kind,text){
  if(!SET.playlog||PL.quiet)return;
  PL.buf.push([Date.now(),S?S.day:0,kind,String(text)]);
  if(PL.buf.length>PLOG_MAX)PL.buf.splice(0,PL.buf.length-PLOG_MAX);
  clearTimeout(PL.saveT);PL.saveT=setTimeout(()=>store.set(PLOG_KEY,JSON.stringify(PL.buf)),800);
}
const plMission=()=>S?(S.mi===CUSTOM?'Eigene Karte „'+S.custom.n+'“':S.mi<0?'Freies Spiel ('+COLS+'×'+ROWS+')':'Mission '+(S.mi+1)+' „'+MISSIONS[S.mi].n+'“'):'–';
const plTile=(r,c)=>'('+r+','+c+')';
const plRes=()=>['holz','stein','gold','brot','aepfel','eisen','bogen','speer','schwert'].map(k=>RICON[k]+Math.floor(S.res[k])).join(' ');
// Logik-Funktionen umhüllen: Verhalten bleibt gleich, es wird nur zusätzlich protokolliert
function plWrap(name,after){const f=globalThis[name];if(typeof f!=='function')return;
  globalThis[name]=function(...a){const r=f.apply(this,a);try{after(r,a)}catch(e){}return r}}
plWrap('startGame',(r,[mi])=>plog('start','Start: '+plMission()+(S&&S.seed!=null?' · Seed '+S.seed:'')));
plWrap('resume',()=>plog('start','Spielstand geladen: '+plMission()+', Tag '+S.day));
plWrap('act',(r,[k,row,col])=>{if(!r||S.edit)return;plog('bau',(B[k].tool?'Abriss: '+B[r.b.type].n:'Bau: '+B[k].n)+' '+plTile(row,col))});
plWrap('undo',n=>{if(n)plog('bau','Rückgängig: '+n+' Bauteil(e)')});
{const f=recruit;recruit=function(t){PL.quiet=1;let r;try{r=f.apply(this,arguments)}finally{PL.quiet=0}plog('truppe',r?'Ausbilden '+UNIT[t||'archer'].n+' abgelehnt: '+r:'Ausgebildet: '+UNIT[t||'archer'].n+' (jetzt '+S.units.length+' Truppen)');return r}}
plWrap('order',(n,[list,i])=>{if(list.length&&!S.edit)plog('befehl','Befehl: '+list.length+' Einheit(en) nach '+plTile(i/COLS|0,i%COLS)+(n<list.length?' ('+n+' kommen hin)':''))});
plWrap('orderAttack',(n,[list,e])=>plog('befehl','Angriff: '+n+' Einheit(en) auf '+ETYPE[e.type].n));
plWrap('orderAttackB',(n,[list,i])=>{const b=S.grid[i].b;plog('befehl','Gebäudeangriff: '+n+' Einheit(en) auf '+(b?B[b.type].n:'?')+' '+plTile(i/COLS|0,i%COLS))});
plWrap('trade',(why,[k,d])=>plog('handel',why?'Handel abgelehnt: '+why:(d>0?'Gekauft: ':'Verkauft: ')+TRADE_N+' '+RNAME[k]+' für '+tradePrice(k,d)+' Gold'));
plWrap('upgradeKeep',why=>plog('burg',why?'Ausbau abgelehnt: '+why:'Burg ausgebaut: '+KEEP_LV[S.keepLv].n));
plWrap('triggerEvent',(r,[id])=>plog('ereignis','Ereignis: '+EVENTS[id].n));
{const f=resolveEvent;resolveEvent=function(i){const p=S&&S.ev.pending,r=f.apply(this,arguments);if(p)plog('ereignis','Entscheidung '+p.n+': '+(i<0?'abgelehnt':r?'nicht möglich ('+r+')':p.opts[i].t));return r}}
plWrap('spawnWave',()=>plog('angriff','Welle '+S.raids+': '+S.enemies.filter(e=>e.w===S.raids).length+' Feinde'));
// Tageszusammenfassung
plWrap('dayTick',()=>{if(!S||S.edit)return;plog('tag','Tag '+S.day+': 👥'+S.pop+'/'+cap()+' frei '+S.idle+' · ❤️'+Math.round(S.pp)+' · '+plRes()+' · Truppen '+S.units.length+' · Feinde '+S.enemies.filter(e=>!e.def).length+' · Bergfried '+Math.ceil(S.keepHp)+'/'+S.keepMax)});
// Meldungen, Sieg, Niederlage, Ereignis-Dialog
{const say=H.say;H.say=m=>{if(m!==PL.lastMsg){PL.lastMsg=m;plog('meldung',m)}say(m)}}
{const w=H.won,l=H.lost;H.won=()=>{plog('ende','Gewonnen: '+plMission()+' an Tag '+S.day);w()};H.lost=()=>{plog('ende','Verloren: '+plMission()+' an Tag '+S.day+' ('+S.repelled+' Wellen abgewehrt)');l()}}
{const f=setSpeed;setSpeed=v=>{if(v!==speed)plog('tempo','Tempo: '+(v?v+'×':'Pause'));f(v)}}
// Fehler und Bildrate (alle 15 s Durchschnitt, nur wenn gespielt wird)
window.addEventListener('error',e=>plog('fehler','Fehler: '+e.message+' ('+(e.filename||'').split('/').pop()+':'+e.lineno+')'));
window.addEventListener('unhandledrejection',e=>plog('fehler','Fehler (Promise): '+(e.reason&&e.reason.message||e.reason)));
(function fps(){PL.fpsN++;const n=performance.now();if(n-PL.fpsT>=15000){if(S&&!uiPause&&speed>0&&!S.edit)plog('fps','Bildrate: '+Math.round(PL.fpsN*1000/(n-PL.fpsT))+' fps · Grafik '+SET.quality+' · '+(TRANS?'quer':'hoch'));PL.fpsN=0;PL.fpsT=n}requestAnimationFrame(fps)})();
plog('sitzung','Sitzung: '+new Date().toLocaleString('de-DE')+' · '+innerWidth+'×'+innerHeight+' @'+(devicePixelRatio||1)+' · '+navigator.userAgent);
// ---------- Ansicht ----------
const fmtT=ts=>new Date(ts).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const plText=list=>list.map(([ts,d,k,m])=>'['+fmtT(ts)+'] T'+d+' '+k.padEnd(8)+' '+m).join('\n');
function openPlaylog(){
  const n=PL.buf.length;
  modal('Spielprotokoll','<p class="tip">'+n+' Einträge, nur auf diesem Gerät gespeichert. Für Rückmeldungen: als Datei speichern oder kopieren und weitergeben.</p><pre id="plogView"></pre>',[
    {t:'📝 Notiz',f:plNote},{t:'Als Datei',p:1,f:plExport},{t:'Kopieren',f:plCopy},{t:'Leeren',f:plClear},{t:'Zurück',f:openMenu}]);
  $('plogView').textContent=n?plText(PL.buf.slice(-300)):'Noch keine Einträge.';$('plogView').scrollTop=1e9;
}
function plExport(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['Burgwacht – Spielprotokoll\n'+plText(PL.buf)+'\n'],{type:'text/plain'}));
  a.download='burgwacht-protokoll-'+new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.txt';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast('Protokoll gespeichert.')}
async function plCopy(){try{await navigator.clipboard.writeText(plText(PL.buf));toast('Protokoll kopiert.')}catch(e){toast('Kopieren ging nicht. Nutze „Als Datei“.')}}
function plClear(){const b=[...document.querySelectorAll('#mBtns .btn')].find(x=>x.textContent==='Leeren');if(b&&!b.dataset.sure){b.dataset.sure=1;b.textContent='Wirklich leeren?';return}
  PL.buf=[];store.set(PLOG_KEY,'[]');toast('Protokoll geleert.');openPlaylog()}
function plNote(){
  modal('Notiz','<p class="tip">Was ist dir aufgefallen? Die Notiz landet mit Zeit und Spieltag im Protokoll.</p><textarea id="plNoteTxt" rows="4" maxlength="1000" style="width:100%;font:inherit;padding:8px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink)"></textarea>',[
    {t:'Speichern',p:1,f:()=>{const v=$('plNoteTxt').value.trim();if(v){const on=SET.playlog;SET.playlog=true;plog('notiz','Notiz ('+plMission()+'): '+v);SET.playlog=on;toast('Notiz gespeichert.')}openPlaylog()}},{t:'Abbrechen',f:openPlaylog}]);
  setTimeout(()=>{const el=$('plNoteTxt');if(el)el.focus()},50);
}
$('openPlaylog').onclick=openPlaylog;
$('setLog').checked=SET.playlog;$('setLog').onchange=e=>{SET.playlog=e.target.checked;saveSettings();if(SET.playlog)plog('sitzung','Protokoll eingeschaltet')};
