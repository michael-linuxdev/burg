// Burgwacht – Klang: prozedurale Musik und Geräusche mit der Web Audio API (keine Audiodateien).
// Startet erst nach der ersten Berührung (Browser-Regel). Lautstärken kommen aus den Einstellungen.
const AU=(()=>{
  let ac=null,master=null,musicBus=null,sfxBus=null,noiseBuf=null,started=false;
  let vol={music:.5,sfx:.8},mood='calm',nextNote=0,step=0,timer=null,phrase=[],chord=0;
  const last={};
  // Mindestabstand je Geräusch in Sekunden, damit es bei vielen Ereignissen nicht knattert
  const GAP={pfeil:.09,treffer:.12,ramme:.3,feuer:.6,holz:.35,steinbruch:.45,bau:.05,stein:.05,abriss:.08,einsturz:.25,glocke:2,klick:.05};

  function init(){
    if(ac)return;
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    ac=new C();
    master=ac.createDynamicsCompressor();master.threshold.value=-14;master.ratio.value=4;master.connect(ac.destination);
    musicBus=ac.createGain();sfxBus=ac.createGain();musicBus.connect(master);sfxBus.connect(master);
    noiseBuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    apply();
  }
  function apply(){if(!ac)return;const t=ac.currentTime;musicBus.gain.setTargetAtTime(vol.music*.32,t,.1);sfxBus.gain.setTargetAtTime(vol.sfx*.9,t,.05)}
  function unlock(){
    init();if(!ac)return;
    if(ac.state==='suspended')ac.resume();
    if(!started){started=true;nextNote=ac.currentTime+.3;timer=setInterval(schedule,90)}
  }
  // ---------- Bausteine ----------
  function env(g,t,a,peak,dec){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec)}
  function osc(type,f,t,a,peak,dec,bus,detune){
    const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(detune)o.detune.value=detune;
    env(g,t,a,peak,dec);o.connect(g);g.connect(bus||sfxBus);o.start(t);o.stop(t+a+dec+.05);return o;
  }
  function noise(t,dur,peak,ftype,f,q,bus,a){
    const s=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();s.buffer=noiseBuf;s.loop=true;
    fl.type=ftype;fl.frequency.setValueAtTime(f,t);fl.Q.value=q||1;env(g,t,a||.004,peak,dur);
    s.connect(fl);fl.connect(g);g.connect(bus||sfxBus);s.start(t,Math.random()*.5);s.stop(t+dur+.1);return{s,fl};
  }
  // ---------- Geräusche ----------
  const SFX={
    bau(t){noise(t,.12,.5,'lowpass',900,1);osc('sine',140,t,.003,.5,.14);noise(t+.11,.08,.3,'bandpass',1400,3)},
    stein(t){noise(t,.09,.5,'bandpass',2200,4);osc('triangle',320,t,.002,.15,.06)},
    abriss(t){for(let k=0;k<4;k++)noise(t+k*.05,.18,.35,'lowpass',700-k*120,1);osc('sine',70,t,.005,.4,.3)},
    holz(t){noise(t,.05,.35,'bandpass',1800,5);osc('triangle',220,t,.002,.2,.07)},
    steinbruch(t){noise(t,.04,.3,'highpass',3000,2);osc('square',900+Math.random()*200,t,.001,.05,.04)},
    pfeil(t){const n=noise(t,.22,.18,'bandpass',2500,6,null,.02);n.fl.frequency.exponentialRampToValueAtTime(700,t+.22)},
    treffer(t){noise(t,.1,.45,'lowpass',500,1);osc('sine',110,t,.002,.35,.1)},
    ramme(t){osc('sine',60,t,.004,.8,.45);noise(t,.3,.5,'lowpass',300,1);noise(t+.02,.12,.3,'bandpass',900,2)},
    einsturz(t){for(let k=0;k<7;k++)noise(t+k*.07,.4,.35,'lowpass',500-k*40,.8);osc('sine',45,t,.01,.7,.9)},
    feuer(t){for(let k=0;k<6;k++)noise(t+Math.random()*.5,.03,.25,'highpass',2000+Math.random()*2000,1);noise(t,.6,.12,'lowpass',600,1,null,.1)},
    glocke(t){for(let k=0;k<3;k++){const b=t+k*.9;[[1,.5],[2.01,.25],[2.76,.18],[5.4,.1]].forEach(([m,p])=>osc('sine',392*m,b,.004,p*.6,2.2))}},
    sieg(t){[392,494,587,784].forEach((f,i)=>{osc('triangle',f,t+i*.16,.01,.35,.5);osc('sine',f*2,t+i*.16,.01,.08,.4)});[392,587,784].forEach(f=>osc('triangle',f,t+.7,.02,.25,1.4))},
    niederlage(t){[392,349,311,262].forEach((f,i)=>osc('triangle',f,t+i*.35,.02,.3,.6));osc('sine',98,t+1.4,.05,.4,2)},
    klick(t){osc('triangle',660,t,.001,.12,.05)}
  };
  function play(name,gain){
    if(!ac||ac.state!=='running'||vol.sfx<=0||!SFX[name])return;
    const t=ac.currentTime;if(last[name]&&t-last[name]<(GAP[name]||.05))return;last[name]=t;
    if(gain!=null&&gain<1){const g=ac.createGain();g.gain.value=gain;g.connect(sfxBus);const keep=sfxBus;sfxBus=g;try{SFX[name](t)}finally{sfxBus=keep}}
    else SFX[name](t);
  }
  // ---------- Musik ----------
  // D-dorisch, ruhiger Dreiertakt mit Bordun (Grundton + Quinte), Laute (gezupft) und gelegentlich Flöte.
  // Bei Angriff: Moll-Bordun, Trommel und schnelleres Tempo.
  const SCALE=[0,2,3,5,7,9,10],BASEF=146.83;// D3
  const f=deg=>{const o=Math.floor(deg/7),s=((deg%7)+7)%7;return BASEF*Math.pow(2,o+SCALE[s]/12)};
  const CHORDS=[0,3,4,0,6,3,4,0];// Stufen für die Bordun-Wechsel (i, IV, V, i, VII …)
  function newPhrase(){const p=[];let d=7+[0,2,4][Math.floor(Math.random()*3)];
    for(let i=0;i<12;i++){if(Math.random()<.22){p.push(null);continue}d+=[-2,-1,-1,0,1,1,2][Math.floor(Math.random()*7)];d=Math.max(4,Math.min(13,d));p.push(d)}
    p[11]=7+CHORDS[chord%8]%7;return p}
  function lute(t,freq,peak){osc('sawtooth',freq,t,.004,peak,.5,musicBus,-4);osc('triangle',freq*2,t,.003,peak*.4,.25,musicBus,3)}
  function flute(t,freq,dur){const o=osc('sine',freq,t,.08,.12,dur,musicBus);const l=ac.createOscillator(),lg=ac.createGain();l.frequency.value=5;lg.gain.value=freq*.006;l.connect(lg);lg.connect(o.frequency);l.start(t);l.stop(t+dur+.2)}
  function drone(t,deg,dur,minor){[0,4].forEach(k=>osc('triangle',f(deg+k-7)*(k===4&&minor?Math.pow(2,-1/12):1)/2,t,.6,.06,dur,musicBus))}
  function drum(t,acc){noise(t,.12,acc?.35:.2,'lowpass',180,1,musicBus);osc('sine',acc?70:55,t,.003,acc?.5:.3,.18,musicBus)}
  function schedule(){
    if(!ac||ac.state!=='running')return;
    if(vol.music<=0){nextNote=ac.currentTime+.2;return}
    const war=mood==='war',beat=war?.32:.46;
    while(nextNote<ac.currentTime+.4){
      const t=nextNote,pos=step%12;
      if(pos===0){if(step%48===0||!phrase.length)phrase=newPhrase();chord++;drone(t,CHORDS[chord%8],beat*12,war)}
      if(war&&pos%3===0)drum(t,pos===0);
      const d=phrase[pos];
      if(d!=null){if(!war&&Math.floor(step/48)%3===2&&pos%3===0)flute(t,f(d)*2,beat*2.6);else lute(t,f(d),war?.09:.07)}
      if(pos%6===0)lute(t,f(CHORDS[chord%8]),.05);
      step++;nextNote+=beat*(pos%3===2&&!war&&Math.random()<.15?1.5:1);
    }
  }
  return{
    unlock,play,
    setVolume(kind,v){vol[kind]=Math.max(0,Math.min(1,v));apply()},
    setMood(m){if(m!==mood){mood=m;step=step-step%12}},
    get running(){return !!ac&&ac.state==='running'},
    suspend(){if(ac&&ac.state==='running')ac.suspend()},
    resume(){if(ac&&started&&ac.state==='suspended')ac.resume()}
  };
})();
