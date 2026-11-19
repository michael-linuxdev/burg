// Burgwacht – Kartenschmiede (Oberfläche): Gelände malen, Bergfried setzen, Einstellungen, Testen, Speichern,
// Teilen als Link (komprimiert im URL-Fragment #karte=…) oder als Datei. Das Kartenformat steht in maps.js.
const BRUSH=[['gras',GRASS,'🟩','Gras'],['wald',TREE,'🌲','Wald'],['fels',ROCK,'🪨','Fels'],['eisen',IRON,'⛓️','Eisen'],
  ['wasser',WATER,'💧','Wasser'],['huegel',HILL,'⛰️','Hügel'],['sumpf',SWAMP,'🟫','Sumpf'],['keep',-1,'🏰','Bergfried']];
const ED={on:false,brush:1,meta:null,id:null,dirty:0,lastT:0};
const newMeta=()=>({n:'Meine Karte',s:'',res:{...BASE},pop:10,goals:[['raids',3]],raid:{start:8,every:7,scale:1,fire:3,ram:99,ladder:99,archer:99},events:true});
// Kartenschmiede öffnen: mit einer gespeicherten Karte oder neu (Größe, zufällig oder leer)
function edOpen(map,id){
  if(map){S=newState(CUSTOM,{map});ED.meta={n:map.n,s:map.s,res:{...map.res},pop:map.pop,goals:map.goals.map(g=>[...g]),raid:map.raid?{...map.raid}:null,events:map.events};ED.id=id}
  else{S=newState(-1,{size:'mittel'});ED.meta=newMeta();ED.id=null}
  edPrepare();
}
function edPrepare(){
  S.edit=true;S.enemies=[];S.nextRaid=null;S.units=[];S.tv=(S.tv||0)+1;cds={};cacheGv=-1;undoClear();
  ED.on=true;resetView();zoom=1;setSpeed(0);document.body.classList.add('editing');$('edbar').hidden=false;
  $('menu').style.display='none';$('modal').style.display='none';uiPause=false;edBrushes();refreshSel();resize();focusKeep();
}
function edLeave(){ED.on=false;document.body.classList.remove('editing');$('edbar').hidden=true;if(S)S.edit=false}
function edBrushes(){
  $('edBrushes').innerHTML=BRUSH.map(([k,v,i,n],j)=>`<button class="chip" data-j="${j}" aria-pressed="${j===ED.brush}" aria-label="${n}" title="${n}"><span>${i}</span><small>${n}</small></button>`).join('');
}
$('edBrushes').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;ED.brush=+b.dataset.j;edBrushes()});
// Ein Feld bemalen. Um den Bergfried bleibt ein 3 × 3-Feld Gras.
function edPaint(r,c){
  const br=BRUSH[ED.brush];
  if(br[1]<0){if(r<2||c<2||r>ROWS-3||c>COLS-3)return toast('Der Bergfried braucht etwas Abstand zum Rand.');
    S.grid[KI].b=null;setMapSize(COLS,ROWS,r,c);S.kr=r;S.kc=c;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)S.grid[(r+a)*COLS+c+b].t=GRASS;S.grid[KI].b={type:'keep',id:0}}
  else{if(Math.abs(r-KR)<=1&&Math.abs(c-KC)<=1)return;S.grid[r*COLS+c].t=br[1]}
  bump();ED.dirty=1;
}
// Gelände nach dem Malen neu vorrendern (gedrosselt)
function edTick(){if(ED.on&&ED.dirty&&performance.now()-ED.lastT>250){ED.dirty=0;ED.lastT=performance.now();S.tv++;terrKey=''}}
// Einstellungen (Name, Ziele, Vorräte, Angriffe)
function edSettings(){
  const m=ED.meta,R=m.raid||{start:8,every:7,scale:1,fire:3,ram:99,ladder:99,archer:99},gv=t=>{const g=m.goals.find(x=>x[0]===t);return g?g[1]:''};
  const num=(id,v,min,max,step=1)=>`<input type="number" id="${id}" value="${v}" min="${min}" max="${max}" step="${step}" inputmode="decimal">`;
  $('edForm').innerHTML=`
    <label class="fld"><span>Name</span><input id="edN" maxlength="40" value="${m.n.replace(/"/g,'&quot;')}"></label>
    <label class="fld"><span>Beschreibung</span><textarea id="edS" maxlength="300" rows="2">${m.s.replace(/</g,'&lt;')}</textarea></label>
    <h3>Karte</h3><div class="row"><select id="edSize">${Object.entries(MAPSIZE).map(([k,v])=>`<option value="${k}" ${v.cols===COLS&&v.rows===ROWS?'selected':''}>${v.n} (${v.cols}×${v.rows})</option>`).join('')}</select>
      <button class="btn" id="edGen">Zufällig erzeugen</button><button class="btn" id="edClear">Leeren</button></div>
    <h3>Start</h3><div class="grid2"><label class="fld"><span>👥 Einwohner</span>${num('edPop',m.pop,1,200)}</label>
      ${['holz','stein','gold','aepfel','brot','bogen'].map(k=>`<label class="fld"><span>${RICON[k]} ${RNAME[k]}</span>${num('edR_'+k,m.res[k]||0,0,999)}</label>`).join('')}</div>
    <h3>Ziele <small>(leer = kein Ziel)</small></h3><div class="grid2">${GOAL_TYPES.map(t=>`<label class="fld"><span>${GOALTXT[t][0]} ${GOALTXT[t][1]}</span>${num('edG_'+t,gv(t),0,999)}</label>`).join('')}</div>
    <h3>Angriffe</h3><label class="toggle"><input type="checkbox" id="edRaid" ${m.raid?'checked':''}><span>Feinde greifen an</span></label>
    <div class="grid2"><label class="fld"><span>Erster Angriff (Tag)</span>${num('edRs',R.start,2,200)}</label><label class="fld"><span>Abstand (Tage)</span>${num('edRe',R.every,2,60)}</label>
      <label class="fld"><span>Stärke</span>${num('edRk',R.scale,.2,4,.1)}</label>
      ${[['fire','Brandstifter'],['ram','Rammböcke'],['ladder','Leitermänner'],['archer','Bogenschützen']].map(([k,n])=>`<label class="fld"><span>${n} ab Welle</span>${num('edRw_'+k,R[k]>=99?'':R[k],1,98)}</label>`).join('')}</div>
    <label class="toggle"><input type="checkbox" id="edEv" ${m.events!==false?'checked':''}><span>Ereignisse (Seuche, Händler, Wölfe …)</span></label>`;
  $('edGen').onclick=()=>edRegen(false);$('edClear').onclick=()=>edRegen(true);
  openSheet('edWrap');
}
function edRead(){
  if(!$('edN'))return;const m=ED.meta,v=id=>$(id).value;
  m.n=v('edN').trim()||'Eigene Karte';m.s=v('edS').trim();m.pop=Math.max(1,+v('edPop')||10);
  for(const k of['holz','stein','gold','aepfel','brot','bogen'])m.res[k]=Math.max(0,+v('edR_'+k)||0);
  m.goals=GOAL_TYPES.filter(t=>+v('edG_'+t)>0).map(t=>[t,+v('edG_'+t)]);
  m.raid=$('edRaid').checked?{start:+v('edRs')||8,every:+v('edRe')||7,scale:+v('edRk')||1,...Object.fromEntries(['fire','ram','ladder','archer'].map(k=>[k,+v('edRw_'+k)||99]))}:null;
  m.events=$('edEv').checked;
}
function edRegen(blank){
  edRead();const sz=$('edSize').value,ms=MAPSIZE[sz];
  if(blank){const[kr,kc]=keepPos(ms.cols,ms.rows);setMapSize(ms.cols,ms.rows,kr,kc);S.grid=Array.from({length:N},()=>({t:GRASS,b:null}));S.grid[KI].b={type:'keep',id:0};S.cols=COLS;S.rows=ROWS;S.kr=KR;S.kc=KC}
  else{const keepMeta=ED.meta;S=newState(-1,{size:sz});ED.meta=keepMeta}
  closeSheets();edPrepare();
}
const edMap=()=>{edRead();return validateMap(mapFromState(ED.meta))};
function edStore(map){const l=loadMaps();if(ED.id!=null&&l[ED.id])l[ED.id]=map;else{l.push(map);ED.id=l.length-1}saveMaps(l)}
$('edSave').onclick=()=>{const map=edMap();if(!map)return toast('Die Karte ist ungültig.');edStore(map);toast('Karte „'+map.n+'“ gespeichert.')};
$('edSet').onclick=edSettings;
$('edWrap').addEventListener('click',e=>{if(e.target.hasAttribute('data-close'))edRead()});
$('edTest').onclick=()=>{const map=edMap();if(!map)return toast('Die Karte ist ungültig.');if(!map.goals.length&&!map.raid)return toast('Lege in den Einstellungen ein Ziel oder Angriffe fest.');
  edStore(map);edLeave();playMap(map);toast('Testlauf. Über das Menü kommst du zurück in die Kartenschmiede.')};
$('edClose').onclick=()=>{const map=edMap();if(map)edStore(map);edLeave();S=null;openMenu();toast('Karte gespeichert.')};
// Eigene Karte spielen
let curMap=null;
function playMap(map){curMap=map;newGame(CUSTOM);closeModal()}
function briefMap(map){
  $('menu').style.display='none';
  const goals=map.goals.length?'<ul class="goals">'+map.goals.map(([t,n])=>'<li>'+GOALTXT[t][0]+' '+n+' '+GOALTXT[t][1]+'</li>').join('')+'</ul>':'<p>Endlos: Wie lange hält deine Burg?</p>';
  modal(map.n,'<p></p>'+goals+`<p class="tip">${map.cols}×${map.rows} Felder${map.raid?', erster Angriff an Tag '+map.raid.start:', keine Angriffe'}.</p>`,
    [{t:'Los geht’s',p:1,f:()=>playMap(map)},{t:'Zurück',f:openMenu}]);
  $('mBody').firstChild.textContent=map.s||'Eine eigene Karte aus der Kartenschmiede.';
}
// ---------- Teilen: Link und Datei ----------
async function packMap(map){
  let bytes=new TextEncoder().encode(JSON.stringify(map)),pre='j';
  if(typeof CompressionStream!=='undefined'){bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());pre='z'}
  let bin='';for(const b of bytes)bin+=String.fromCharCode(b);
  return pre+btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function unpackMap(s){
  try{const pre=s[0];let b=s.slice(1).replace(/-/g,'+').replace(/_/g,'/');while(b.length%4)b+='=';
    const bytes=Uint8Array.from(atob(b),c=>c.charCodeAt(0));
    const txt=pre==='z'?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text():new TextDecoder().decode(bytes);
    return validateMap(JSON.parse(txt))}catch(e){return null}
}
async function shareMap(map){
  const url=location.origin+location.pathname+'#karte='+await packMap(map);
  if(navigator.share){try{await navigator.share({title:'Burgwacht: '+map.n,text:'Spiel meine Karte „'+map.n+'“ in Burgwacht!',url});return}catch(e){if(e&&e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(url);toast('Link kopiert. Wer ihn öffnet, bekommt die Karte.');return}catch(e){}
  modal('Karte teilen','<p>Kopiere diesen Link:</p><textarea id="shareUrl" rows="4" readonly style="width:100%"></textarea>',[{t:'Fertig',p:1,f:openMenu}]);$('shareUrl').value=url;$('shareUrl').select();
}
function exportMap(map){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(map,null,1)],{type:'application/json'}));
  a.download='burgwacht-'+map.n.toLowerCase().replace(/[^a-z0-9äöüß]+/g,'-')+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function addMap(map,how){const l=loadMaps();l.push(map);saveMaps(l);toast('Karte „'+map.n+'“ '+how+'. Du findest sie im Menü unter „Eigene Karten“.');renderMyMaps()}
$('edImport').onclick=()=>$('edFile').click();
$('edFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const map=validateMap(JSON.parse(await f.text()));if(!map)return toast('Diese Datei ist keine gültige Karte.');addMap(map,'importiert')}catch(err){toast('Diese Datei ist keine gültige Karte.')}};
$('edNew').onclick=()=>edOpen();
// Liste der eigenen Karten im Menü
function renderMyMaps(){
  const ul=$('mymaps'),l=loadMaps();ul.innerHTML=l.length?'':'<li class="empty">Noch keine eigenen Karten.</li>';
  l.forEach((map,i)=>{const li=document.createElement('li');
    li.innerHTML=`<div class="sl"><b></b><span>${map.cols}×${map.rows} · ${map.goals.map(([t,n])=>GOALTXT[t][0]+' '+n).join(' ')||'endlos'}</span></div><div class="sb"></div>`;
    li.querySelector('b').textContent=map.n;const sb=li.querySelector('.sb');
    for(const[t,f,p]of[['Spielen',()=>briefMap(map),1],['Bearbeiten',()=>edOpen(map,i)],['Teilen',()=>shareMap(map)],['Datei',()=>exportMap(map)],['Löschen',null]]){
      const b=document.createElement('button');b.className='btn'+(p?' primary':'');b.textContent=t;
      b.onclick=f||(()=>{if(!b.dataset.sure){b.dataset.sure=1;b.textContent='Wirklich?';return}const l2=loadMaps();l2.splice(i,1);saveMaps(l2);renderMyMaps()});sb.appendChild(b)}
    ul.appendChild(li)});
}
// Geteilte Karte beim Start aus dem Link übernehmen
(async()=>{const h=location.hash;if(!h.startsWith('#karte='))return;const map=await unpackMap(h.slice(7));
  try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}
  if(map)addMap(map,'übernommen');else toast('Der Kartenlink ist beschädigt.')})();
