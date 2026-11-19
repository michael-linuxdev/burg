// Burgwacht – Interaktives Tutorial für Mission 1. Führt Schritt für Schritt durch die ersten Handgriffe.
// Abschaltbar (Einstellungen) und jederzeit wiederholbar. Gehört zur Oberfläche.
const TUT={on:false,i:0,flags:{}};
// Hilfsschritt „Gebäude k bauen“: zeigt je nach Lage auf „Bauen“, die passende Karte oder das Feld
function buildStep(k,text,fieldText){
  return{
    text:()=>sel===k?fieldText:$('buildWrap').classList.contains('open')?'Wähle „'+B[k].n+'“.':text,
    target:()=>sel===k?null:$('buildWrap').classList.contains('open')?`.card[data-k="${k}"]`:sel?'#tDone':'#openBuild',
    done:()=>count(k)>0
  };
}
const TUT_STEPS=[
  buildStep('holzf','Willkommen, Burgherr! Zuerst brauchst du Holz. Tippe auf „Bauen“.','Tippe auf ein helles Feld am Waldrand. Der Holzfäller braucht Bäume in der Nähe.'),
  buildStep('obst','Gut gemacht! Jetzt etwas zu essen: Öffne wieder „Bauen“ – oder tippe erst auf „Fertig“.','Setze den Obstgarten auf ein freies Feld nahe am Bergfried.'),
  buildStep('haus','Damit neue Leute zuziehen, brauchen sie ein Dach über dem Kopf. Baue eine Hütte.','Setze die Hütte auf ein freies Feld. Jede Hütte bietet Platz für 8 Leute.'),
  {text:()=>sel?'Tippe auf „Fertig“, um das Bauen zu beenden.':'Im Hof legst du Steuern und Rationen fest. Öffne den „Hof“.',
   target:()=>sel?'#tDone':'#openCourt',done:()=>TUT.flags.court},
  {text:()=>'Steuern bringen Gold, machen die Leute aber unzufriedener. Mehr Essen macht sie froh. Ab 50 ❤️ Beliebtheit ziehen Leute zu. Schließe den Hof.',
   target:()=>'#courtWrap .close',done:()=>!$('courtWrap').classList.contains('open')},
  {text:()=>'Schau dir dein Dorf genauer an: Zoome mit zwei Fingern heran. Am Computer geht das mit dem Mausrad.',
   target:()=>null,done:()=>zoom>1.3},
  {enter(){if(S.res.stein<6){S.res.stein=6;toast('Der König schickt dir 6 🪨 Stein für deine erste Mauer.')}},
   ...buildStep('mauer','Zum Schluss deine erste Mauer. Öffne „Bauen“ und wähle unter „Burg“ die Mauer.','Ziehe mit dem Finger über mehrere Felder, um eine Mauer zu bauen. Mit „↶“ machst du Fehler rückgängig.'),
   done:()=>count('mauer')>=3},
  {text:()=>'Prima! Du kennst jetzt das Wichtigste. Ziel dieser Mission: 24 Einwohner. Baue Hütten, sorge für Essen und halte die Leute bei Laune. Tipps findest du immer in der Hinweiszeile oben.',
   target:()=>null,next:true,done:()=>TUT.flags.next}
];
let tutTarget=null;
function tutMaybeStart(){if(S&&S.mi===0&&SET.tutorial&&!SET.tutDone)tutStart();else tutStop(false)}
function tutStart(){TUT.on=true;TUT.i=0;TUT.flags={};$('coach').hidden=false;tutEnter();tutTick()}
function tutEnter(){const st=TUT_STEPS[TUT.i];if(st&&st.enter)st.enter();$('coachNext').hidden=!(st&&st.next)}
function tutStop(done){
  TUT.on=false;$('coach').hidden=true;document.body.classList.remove('coaching');if(tutTarget)tutTarget.classList.remove('coach-target');tutTarget=null;
  if(done){SET.tutDone=true;saveSettings()}
}
function tutTick(){
  if(!TUT.on)return;
  if(!S||S.mi!==0||S.over||S.won){tutStop(false);return}
  const menuOpen=$('menu').style.display==='flex'||$('modal').style.display==='flex'||$('settings').style.display==='flex';
  $('coach').hidden=menuOpen;document.body.classList.toggle('coaching',!menuOpen);
  let st=TUT_STEPS[TUT.i];
  while(st&&st.done()){TUT.i++;st=TUT_STEPS[TUT.i];if(st){tutEnter();AU.play('klick')}}
  if(!st){tutStop(true);return}
  const txt=st.text();if($('coachText').textContent!==txt)$('coachText').textContent=txt;
  const sel2=st.target(),el=sel2&&!menuOpen?document.querySelector(sel2):null;
  if(el!==tutTarget){if(tutTarget)tutTarget.classList.remove('coach-target');if(el)el.classList.add('coach-target');tutTarget=el}
}
$('coachSkip').onclick=()=>{tutStop(true);toast('Tutorial beendet. Du kannst es in den Einstellungen wiederholen.')};
$('coachNext').onclick=()=>{TUT.flags.next=true;tutTick()};
$('openCourt').addEventListener('click',()=>{if(TUT.on)TUT.flags.court=true});
setInterval(tutTick,250);
