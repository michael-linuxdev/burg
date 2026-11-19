// Burgwacht – Zeichnen: Gelände, Gebäude, Figuren, Licht, Wetter. Liest den Spielzustand S nur.
const $=id=>document.getElementById(id);
const cv=$('cv'),ctx=cv.getContext('2d');
// Ansichtszustand (gehört nicht zur Spiellogik)
let sel=null,speed=1,lastT=0,arrows=[],cell=30,ox=0,oy=0,dpr=1,uiPause=true,now=0;
let walkers=new Map(),wanderers=[];
// Truppen: Auswahl (ids), Auswahlrahmen in Bildschirmpixeln, Befehlsmarker, Blickrichtung je Einheit
let picked=new Set(),boxR=null,marks=[];const uoff=new Map(),ufc=new Map();
// ---------- Zeichnen ----------
const PAL={grass:'#7BA04C',stone:'#B9B3A4',stoneL:'#D3CEC1',stoneD:'#8A8475',wood:'#8A5A33',woodD:'#5E3B1F',
  thatch:'#CFA953',thatchD:'#A37F37',roofR:'#A8452F',roofRD:'#7E3122',plaster:'#EFE6CF',
  woad:'#2E5A88',gold:'#D9A93A',leaf1:'#3F7A37',leaf2:'#2F6230',leaf3:'#62A04A',shadow:'rgba(25,35,15,.28)'};
let TRANS=false;
const scN=()=>TRANS?ROWS:COLS,srN=()=>TRANS?COLS:ROWS;
const sx=(tx,ty)=>ox+(TRANS?ty:tx)*cell,sy=(tx,ty)=>oy+(TRANS?tx:ty)*cell;
const dispSide=s=>TRANS?({Norden:'Westen',Süden:'Osten',Westen:'Norden',Osten:'Süden'})[s]||s:s;
let terr=null,terrKey='',parts=[],lights=[],glows=[],weather=[],SEASON=1,DARK=0,dk=null,dkg=null;
let FOE=0;// zeichnet gerade die feindliche Burg (dunkler Stein, rote Banner)
const TOPL=()=>SEASON===3?'#F3F6F9':FOE?'#9C9184':'#D3CEC1';
const hash=(r,c)=>{let h=(r*73856093)^(c*19349663)^S.seed;h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296};
function rr(g,x,y,w,h,rad){g.beginPath();if(g.roundRect)g.roundRect(x,y,w,h,rad);else g.rect(x,y,w,h)}
function ell(g,x,y,rx,ry){g.beginPath();g.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,7);g.fill()}
function circ(g,x,y,r){g.beginPath();g.arc(x,y,Math.max(.1,r),0,7);g.fill()}
function poly(g,p){g.beginPath();g.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)g.lineTo(p[i],p[i+1]);g.closePath();g.fill()}
function line(g,x1,y1,x2,y2){g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke()}
function bar(g,x,y,w,f){g.fillStyle='rgba(0,0,0,.55)';rr(g,x,y,w,4,2);g.fill();g.fillStyle=f>.5?'#6FCF6A':f>.25?'#E2B64E':'#E5534B';rr(g,x,y,w*Math.max(0,f),4,2);g.fill()}
function fx(tx,ty,kind,n,screen){
  if(TRANS&&!screen){const q=tx;tx=ty;ty=q}
  const lim=Q().parts;if(lim<200)n=Math.ceil(n*lim/250);
  for(let i=0;i<n;i++){const a=Math.random()*6.28,s=Math.random();
    const p={x:tx+(Math.random()-.5)*.3,y:ty+(Math.random()-.5)*.2,vx:Math.cos(a)*s*.6,vy:Math.sin(a)*s*.3,life:0,kind,max:.4};
    if(kind==='dust'){p.max=.6+Math.random()*.5;p.vy-=.2}
    else if(kind==='ember'){p.max=.8+Math.random()*.6;p.vx*=.4;p.vy=-.6-Math.random()*.6}
    else if(kind==='chip'){p.max=.5;p.vy=-1.2-Math.random()*.6;p.vx*=1.5}
    else if(kind==='smoke'){p.max=1.6+Math.random();p.vx=.12+Math.random()*.1;p.vy=-.35-Math.random()*.2}
    parts.push(p)}
  if(parts.length>lim)parts.splice(0,parts.length-lim);
}
const SP=[
  {g:'#86B054',pd:'rgba(50,90,25,.13)',pl:'rgba(205,232,120,.16)',td:'rgba(45,85,25,.35)',tl:'rgba(190,228,110,.42)',fl:100,hof:'183,154,106',tf:7,fo:'rgba(35,65,20,.26)',ro:'rgba(140,120,85,.38)'},
  {g:'#7BA04C',pd:'rgba(50,85,25,.13)',pl:'rgba(195,220,115,.13)',td:'rgba(45,80,25,.35)',tl:'rgba(180,210,105,.35)',fl:45,hof:'183,154,106',tf:7,fo:'rgba(35,65,20,.28)',ro:'rgba(140,120,85,.38)'},
  {g:'#9E9C4E',pd:'rgba(110,80,25,.15)',pl:'rgba(225,185,90,.16)',td:'rgba(110,80,30,.35)',tl:'rgba(215,180,95,.4)',fl:0,lv:110,hof:'176,146,98',tf:6,fo:'rgba(120,70,20,.22)',ro:'rgba(140,120,85,.38)'},
  {g:'#E8EDF1',pd:'rgba(150,170,195,.2)',pl:'rgba(255,255,255,.55)',td:'rgba(150,165,185,.3)',tl:'rgba(255,255,255,.5)',fl:0,hof:'200,194,182',tf:1.5,fo:'rgba(120,140,165,.22)',ro:'rgba(150,150,155,.25)'}];
const TS=()=>Math.min(Q().ts,dpr*2);
function renderTerrain(){
  const key=S.seed+'|'+COLS+'x'+ROWS+'|'+baseCell+'|'+dpr+'|'+SEASON+'|'+TRANS+'|'+TS();if(terrKey===key&&terr)return;terrKey=key;
  // Gelände wird mit mindestens 30 px je Feld vorgerendert (große Karten zoomen weiter hinein), höchstens 8 Mio. Pixel
  const C=Math.max(baseCell,30),W=scN()*C,H=srN()*C,P=SP[SEASON],ts=Math.min(TS(),Math.sqrt(8e6/(W*H)));terr=document.createElement('canvas');terr.width=Math.ceil(W*ts);terr.height=Math.ceil(H*ts);
  const g=terr.getContext('2d');g.scale(ts,ts);const R=rng(S.seed^0x51f15e);
  const soft=(x,y,rad,col)=>{const gr=g.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,col);gr.addColorStop(1,col.replace(/[\d.]+\)$/,'0)'));g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2)};
  g.fillStyle=P.g;g.fillRect(0,0,W,H);
  for(let i=0;i<70;i++)soft(R()*W,R()*H,C*(1+R()*2),R()<.5?P.pd:P.pl);
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=T(r,c).t,x=(TRANS?r:c)*C+C/2,y=(TRANS?c:r)*C+C/2;
    if(t===TREE)soft(x,y,C*.95,P.fo);if(t===ROCK)soft(x,y,C*.9,P.ro)}
  // Hügel: helle Kuppe, Hang an der Bildschirm-Unterkante, Lichtkante oben
  const tAt=(r,c)=>inb(r,c)?T(r,c).t:-1,scr=(r,c,dx,dy)=>TRANS?tAt(r+dx,c+dy):tAt(r+dy,c+dx);
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const t=T(r,c).t,x=(TRANS?r:c)*C,y=(TRANS?c:r)*C;
    if(t===HILL){// weiche Kuppe: Schatten nach rechts unten, Licht nach links oben, über Feldgrenzen verschmolzen
      soft(x+C*.62,y+C*.72,C*1.05,SEASON===3?'rgba(110,130,160,.3)':'rgba(55,70,25,.34)');
      soft(x+C*.4,y+C*.38,C*.95,SEASON===3?'rgba(255,255,255,.6)':'rgba(230,236,150,.46)')}
    if(t===SWAMP){const R2=rng(r*977+c*131+S.seed);
      for(let k=0;k<3;k++)soft(x+C*(.25+R2()*.5),y+C*(.25+R2()*.5),C*(.6+R2()*.2),SEASON===3?'rgba(175,190,205,.6)':'rgba(82,86,40,.5)');
      for(let k=0;k<3;k++){g.fillStyle=SEASON===3?'rgba(214,230,242,.9)':'rgba(48,72,70,.7)';ell(g,x+C*(.2+R2()*.6),y+C*(.2+R2()*.6),C*(.08+R2()*.08),C*(.04+R2()*.04))}
      g.strokeStyle=SEASON===3?'#B9A98A':'#6E7A36';g.lineWidth=1.2;for(let k=0;k<5;k++){const rx=x+C*(.1+R2()*.8),ry=y+C*(.3+R2()*.6);g.beginPath();g.moveTo(rx,ry);g.lineTo(rx+(R2()-.5)*C*.08,ry-C*(.18+R2()*.12));g.stroke();
        if(k%2){g.fillStyle='#5E3B1F';ell(g,rx,ry-C*.2,C*.022,C*.05)}}}}
  const kx=(TRANS?KR:KC)*C+C/2,ky=(TRANS?KC:KR)*C+C/2,gr=g.createRadialGradient(kx,ky,C*.3,kx,ky,C*2.4);
  gr.addColorStop(0,`rgba(${P.hof},.85)`);gr.addColorStop(.6,`rgba(${P.hof},.4)`);gr.addColorStop(1,`rgba(${P.hof},0)`);g.fillStyle=gr;g.fillRect(kx-C*3,ky-C*3,C*6,C*6);
  g.lineWidth=1;
  for(let i=0;i<N*P.tf;i++){const x=R()*W,y=R()*H;g.strokeStyle=R()<.5?P.td:P.tl;g.beginPath();g.moveTo(x,y);g.lineTo(x-1.5,y-3-R()*2);g.moveTo(x,y);g.lineTo(x+1.5,y-3-R()*2);g.stroke()}
  const fl=['#F4F1E4','#F2D45C','#B79BD6','#EFA0A8'];for(let i=0;i<P.fl;i++){g.fillStyle=fl[Math.floor(R()*4)];circ(g,R()*W,R()*H,1.4)}
  const lv=['#C8742A','#D9A93A','#B8452B','#8E5A2A'];for(let i=0;i<(P.lv||0);i++){g.fillStyle=lv[Math.floor(R()*4)];ell(g,R()*W,R()*H,2,1.2)}
  const wt=[];for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(T(r,c).t===WATER)wt.push([(TRANS?r:c)*C+C/2,(TRANS?c:r)*C+C/2]);
  const isW=(x,y)=>wt.some(p=>Math.abs(p[0]-x)<1&&Math.abs(p[1]-y)<1);
  const pond=(rad,col,dy)=>{g.fillStyle=col;wt.forEach(([x,y])=>{circ(g,x,y+dy,rad);if(isW(x+C,y))g.fillRect(x,y+dy-rad,C,rad*2);if(isW(x,y+C))g.fillRect(x-rad,y+dy,rad*2,C);if(isW(x+C,y)&&isW(x,y+C)&&isW(x+C,y+C))g.fillRect(x,y+dy,C,C)})};
  if(SEASON===3){pond(C*.82,'#D3DCE3',0);pond(C*.7,'#9EC3D8',0);pond(C*.56,'#BCD8E7',-C*.04);
    g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=1;wt.forEach(([x,y],i)=>{if(i%2)return;g.beginPath();g.moveTo(x-C*.3,y-C*.1);g.lineTo(x,y+C*.05);g.lineTo(x+C*.25,y-C*.15);g.moveTo(x,y+C*.05);g.lineTo(x+C*.05,y+C*.3);g.stroke()})}
  else{pond(C*.82,'#CDB98A',0);pond(C*.7,'#2C6A8E',0);pond(C*.56,'#3A80A8',-C*.04)}
}
const AUT=[['#9A4A1C','#C8742A','#E3A548'],['#A97E1F','#D9A93A','#EDCB66'],['#86331F','#B8452B','#DA6E44']];
function crownCols(h){return SEASON===2?AUT[Math.floor(h*3)%3]:SEASON===0?['#3C8236','#57A346','#86C766']:[PAL.leaf2,PAL.leaf1,PAL.leaf3]}
function bare(g,cx,by,C,sc){g.strokeStyle='#5E4330';g.lineWidth=Math.max(1,C*.04*sc);g.lineCap='round';
  line(g,cx,by,cx,by-C*.42*sc);line(g,cx,by-C*.2*sc,cx-C*.16*sc,by-C*.38*sc);line(g,cx,by-C*.28*sc,cx+C*.17*sc,by-C*.46*sc);line(g,cx,by-C*.38*sc,cx-C*.08*sc,by-C*.52*sc);
  g.lineCap='butt';g.fillStyle='#FBFCFD';circ(g,cx-C*.15*sc,by-C*.39*sc,C*.025*sc);circ(g,cx+C*.16*sc,by-C*.47*sc,C*.025*sc);circ(g,cx,by-C*.43*sc,C*.03*sc)}
function drawTree(g,x,y,C,h){
  const sw=Math.sin(now*1.2+h*9)*C*.02;
  g.fillStyle=PAL.shadow;ell(g,x+C*.62,y+C*.84,C*.32,C*.11);
  if(h<.4){
    g.fillStyle=PAL.woodD;g.fillRect(x+C*.46,y+C*.6,C*.08,C*.24);
    for(let k=0;k<3;k++){const ty=y+C*(.7-k*.2),w=C*(.36-k*.08),tx=x+C*.5+sw*(k+1)/2;g.fillStyle=k%2?'#2E5E33':'#264F2C';poly(g,[tx,ty-C*.32,x+C*.5-w,ty,x+C*.5+w,ty]);
      if(SEASON===3){g.fillStyle='#F7F9FB';poly(g,[tx,ty-C*.32,tx-w*.45,ty-C*.17,tx+w*.45,ty-C*.17])}}
    g.fillStyle='rgba(255,255,255,.07)';poly(g,[x+C*.5+sw*1.5,y+C*.06,x+C*.24,y+C*.5,x+C*.5,y+C*.5]);
  }else if(SEASON===3){bare(g,x+C*.5,y+C*.84,C,1)}
  else{const cc=crownCols(h);
    g.fillStyle=PAL.woodD;g.fillRect(x+C*.46,y+C*.6,C*.08,C*.24);
    g.fillStyle=cc[0];circ(g,x+C*.5+sw,y+C*.44,C*.32);g.fillStyle=cc[1];circ(g,x+C*.42+sw,y+C*.37,C*.22);g.fillStyle=cc[2];circ(g,x+C*.37+sw,y+C*.3,C*.09);
    if(SEASON===0&&h>.65){g.fillStyle='#F6C6D6';for(const[a,b2]of[[.3,.45],[.6,.35],[.55,.55],[.42,.28]])circ(g,x+C*a+sw,y+C*b2,C*.03)}}
}
function drawRock(g,x,y,C,h,iron){
  g.fillStyle=PAL.shadow;ell(g,x+C*.58,y+C*.82,C*.36,C*.1);
  g.fillStyle=iron?'#6A4E44':'#6E6C65';poly(g,[x+C*.1,y+C*.82,x+C*.2,y+C*.4,x+C*.5,y+C*.2,x+C*.86,y+C*.42,x+C*.9,y+C*.82]);
  g.fillStyle=iron?'#8E6A5A':'#9C9A92';poly(g,[x+C*.2,y+C*.4,x+C*.5,y+C*.2,x+C*.86,y+C*.42,x+C*.55,y+C*.52]);
  g.fillStyle=SEASON===3?'#F3F6F9':iron?'#A98676':'#BDBBB3';poly(g,[x+C*.32,y+C*.36,x+C*.5,y+C*.25,x+C*.66,y+C*.36,x+C*.5,y+C*.44]);
  if(iron){g.fillStyle='#B5532E';for(const[a,b]of[[.3,.6],[.56,.66],[.72,.52],[.42,.48]])circ(g,x+C*a,y+C*b,C*.04);g.fillStyle='#D9823E';circ(g,x+C*.56,y+C*.64,C*.018)}
  if(h>.5){g.fillStyle=iron?'#7A5A4A':'#7F7D76';ell(g,x+C*.82,y+C*.86,C*.1,C*.06)}
}
function box(g,x,y,C,o){
  const W=C*o.w,x0=x+(C-W)/2+C*(o.dx||0),gy=y+C*(o.gy||.86),H=C*o.h,D=C*o.d,ov=C*.05;
  g.fillStyle=PAL.shadow;poly(g,[x0+W,gy,x0+W+C*.14,gy-C*.03,x0+W+C*.14,gy-H-D*.55,x0+W,gy-H-D*.7]);
  g.fillStyle=o.wall;g.fillRect(x0,gy-H,W,H);
  g.fillStyle='rgba(0,0,0,.10)';g.fillRect(x0+W*.72,gy-H,W*.28,H);
  g.strokeStyle='rgba(40,25,10,.6)';g.lineWidth=1;g.strokeRect(x0+.5,gy-H+.5,W-1,H-1);
  const rx=x0-ov,rw=W+ov*2,ry=gy-H-D;
  g.fillStyle=o.roof;g.fillRect(rx,ry,rw,D*.5);g.fillStyle=o.roofD;g.fillRect(rx,ry+D*.5,rw,D*.5+ov*.6);
  if(o.stripes){g.strokeStyle='rgba(60,40,10,.25)';for(let k=1;k<6;k++)line(g,rx+rw*k/6,ry+2,rx+rw*k/6,ry+D-2)}
  if(SEASON===3){g.fillStyle='#F6F8FA';g.fillRect(rx,ry,rw,D*.5);g.fillStyle='rgba(246,248,250,.85)';g.fillRect(rx,ry+D*.5,rw,D*.16);for(let k=0;k<4;k++)circ(g,rx+rw*(.15+k*.23),ry+D*.66,D*.07)}
  g.strokeStyle='rgba(255,255,255,.3)';line(g,rx,ry+D*.5,rx+rw,ry+D*.5);
  g.strokeStyle='rgba(40,25,10,.6)';g.strokeRect(rx+.5,ry+.5,rw-1,D+ov*.6-1);
  return{x0,W,gy,H,D};
}
function door(g,cx,gy,C,w=.14,h=.17){g.fillStyle=PAL.woodD;rr(g,cx-C*w/2,gy-C*h,C*w,C*h,[C*w/2,C*w/2,0,0]);g.fill()}
function win(g,x,y,C){g.fillStyle='#3B3226';g.fillRect(x,y,C*.09,C*.08);g.fillStyle='rgba(255,215,130,.55)';g.fillRect(x+1,y+1,C*.09-2,C*.08-2)}
function cube(g,cx,cy,s){g.fillStyle=PAL.stoneD;g.fillRect(cx-s/2,cy-s*.45,s,s*.45);g.fillStyle=TOPL();g.fillRect(cx-s/2,cy-s,s,s*.55);g.strokeStyle='rgba(30,25,18,.5)';g.lineWidth=1;g.strokeRect(cx-s/2+.5,cy-s+.5,s-1,s-1)}
function flag(g,x,y,C,len){
  g.strokeStyle='#3B2A1A';g.lineWidth=1.5;line(g,x,y,x,y-len);
  const w=Math.sin(now*5)*C*.03,w2=Math.sin(now*5+1.5)*C*.03,t=y-len;
  g.fillStyle=FOE?'#8E1F1A':PAL.woad;g.beginPath();g.moveTo(x,t);g.quadraticCurveTo(x+C*.12,t+w,x+C*.26,t+w2);g.lineTo(x+C*.26,t+C*.14+w2);g.quadraticCurveTo(x+C*.12,t+C*.14+w,x,t+C*.14);g.closePath();g.fill();
  g.fillStyle=PAL.gold;g.beginPath();g.moveTo(x,t+C*.055);g.quadraticCurveTo(x+C*.12,t+C*.055+w,x+C*.26,t+C*.055+w2);g.lineTo(x+C*.26,t+C*.085+w2);g.quadraticCurveTo(x+C*.12,t+C*.085+w,x,t+C*.085);g.closePath();g.fill();
}
function person(g,x,y,C,col,carry,walk,hat){
  g.fillStyle=PAL.shadow;ell(g,x,y+C*.1,C*.09,C*.035);
  const s=walk?Math.sin(now*14)*C*.03:0;g.strokeStyle='#3A2A1C';g.lineWidth=Math.max(1,C*.03);
  line(g,x-C*.03,y+C*.02,x-C*.03+s,y+C*.1);line(g,x+C*.03,y+C*.02,x+C*.03-s,y+C*.1);
  g.fillStyle=col;rr(g,x-C*.065,y-C*.1,C*.13,C*.13,C*.04);g.fill();g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=1;g.stroke();
  g.fillStyle='#F1D3B5';circ(g,x,y-C*.15,C*.055);
  if(hat){g.fillStyle=hat;g.beginPath();g.arc(x,y-C*.16,C*.06,Math.PI,0);g.fill()}
  if(carry)drawCarry(g,x+C*.09,y-C*.06,C,carry);
}
function drawCarry(g,x,y,C,k){
  if(k==='holz'){g.fillStyle='#7A4E2D';g.fillRect(x-C*.08,y-C*.03,C*.16,C*.06);g.fillStyle='#D2A86E';circ(g,x+C*.08,y,C*.03)}
  else if(k==='stein')cube(g,x,y+C*.04,C*.09);
  else if(k==='aepfel'){g.fillStyle='#8A6A44';rr(g,x-C*.06,y-C*.02,C*.12,C*.06,2);g.fill();g.fillStyle='#D33B2C';circ(g,x-C*.025,y-C*.03,C*.025);circ(g,x+C*.025,y-C*.03,C*.025)}
  else if(k==='weizen'){g.strokeStyle='#D9B54A';g.lineWidth=2;line(g,x-C*.04,y+C*.04,x+C*.02,y-C*.08);line(g,x,y+C*.04,x+C*.05,y-C*.07)}
  else if(k==='mehl'){g.fillStyle='#F2EEE4';ell(g,x,y,C*.06,C*.07);g.strokeStyle='#A9A08A';g.lineWidth=1;g.stroke()}
  else if(k==='brot'){g.fillStyle='#C98A42';ell(g,x,y,C*.08,C*.045)}
}
// Waffen in der rechten Hand (x, y = Füße der Figur)
function bow(g,x,y,C,col='#6B4423'){g.strokeStyle=col;g.lineWidth=Math.max(1.2,C*.025);g.beginPath();g.arc(x+C*.04,y-C*.06,C*.12,-1.15,1.15);g.stroke();
  g.strokeStyle='rgba(235,228,205,.9)';g.lineWidth=.8;line(g,x+C*.04+Math.cos(-1.15)*C*.12,y-C*.06+Math.sin(-1.15)*C*.12,x+C*.04+Math.cos(1.15)*C*.12,y-C*.06+Math.sin(1.15)*C*.12)}
function spear(g,x,y,C,len=.5){g.strokeStyle='#6B4423';g.lineWidth=Math.max(1.2,C*.025);line(g,x+C*.1,y+C*.1,x+C*.1,y-C*len);g.fillStyle='#C8CDD2';poly(g,[x+C*.07,y-C*len,x+C*.1,y-C*(len+.1),x+C*.13,y-C*len])}
function sword(g,x,y,C){g.strokeStyle='#D8DDE2';g.lineWidth=Math.max(1.5,C*.03);line(g,x+C*.1,y-C*.02,x+C*.17,y-C*.26);g.strokeStyle='#5E3B1F';line(g,x+C*.07,y-C*.04,x+C*.13,y)}
function shield(g,x,y,C,col){g.fillStyle=col;circ(g,x-C*.08,y-C*.05,C*.065);g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=1;g.beginPath();g.arc(x-C*.08,y-C*.05,C*.065,0,7);g.stroke();g.fillStyle=PAL.gold;circ(g,x-C*.08,y-C*.05,C*.02)}
const HELM={archer:'#4F6B3A',spear:'#8C939A',sword:'#A9B0B7',knight:'#C9CED3'};
// Eigene Einheit an den Bildschirmkoordinaten X, Y (Füße). on: ausgewählt, f: Blickrichtung (1 rechts, −1 links)
function drawUnit(g,u,C,X,Y,on,f=1){
  const U=UNIT[u.type],mv=u.path&&u.path.length>0;
  if(on){g.strokeStyle='#FFD54A';g.lineWidth=2;g.beginPath();g.ellipse(X,Y+C*.1,C*(u.type==='knight'?.26:.17),C*.075,0,0,7);g.stroke()}
  g.save();if(f<0){g.translate(X,0);g.scale(-1,1);g.translate(-X,0)}
  if(u.type==='sram'){const s=mv?Math.sin(now*6)*C*.01:0;
    g.fillStyle=PAL.shadow;ell(g,X,Y+C*.12,C*.34,C*.07);g.fillStyle='#2B2620';circ(g,X-C*.2,Y+C*.08,C*.07);circ(g,X+C*.16,Y+C*.08,C*.07);
    g.fillStyle='#7A5232';g.fillRect(X-C*.3,Y-C*.09+s,C*.56,C*.16);g.fillStyle=U.col;poly(g,[X-C*.32,Y-C*.09+s,X+C*.28,Y-C*.09+s,X+C*.2,Y-C*.3+s,X-C*.24,Y-C*.3+s]);
    g.strokeStyle='rgba(40,25,10,.5)';g.lineWidth=1;for(let k=1;k<4;k++)line(g,X-C*.32+C*.15*k,Y-C*.09+s,X-C*.26+C*.13*k,Y-C*.3+s);
    g.fillStyle='#5E3B1F';g.fillRect(X+C*.2,Y-C*.05+s,C*.22,C*.07);g.fillStyle='#9AA2AA';g.fillRect(X+C*.38,Y-C*.07+s,C*.07,C*.11);
    g.fillStyle=PAL.woad;g.fillRect(X-C*.05,Y-C*.42+s,C*.12,C*.08);g.strokeStyle='#3B2A1A';line(g,X-C*.05,Y-C*.3+s,X-C*.05,Y-C*.44+s)}
  else if(u.type==='kat'){const arm=u.cd>1/U.rate-.5?-.2:-1.1;// Arm schnellt nach dem Wurf nach vorn
    g.fillStyle=PAL.shadow;ell(g,X,Y+C*.12,C*.3,C*.07);g.fillStyle='#2B2620';circ(g,X-C*.18,Y+C*.08,C*.065);circ(g,X+C*.18,Y+C*.08,C*.065);
    g.fillStyle='#6B4A2A';g.fillRect(X-C*.26,Y-C*.02,C*.52,C*.08);g.strokeStyle='#5E3B1F';g.lineWidth=Math.max(1.5,C*.04);line(g,X-C*.12,Y,X,Y-C*.22);line(g,X+C*.12,Y,X,Y-C*.22);
    g.save();g.translate(X,Y-C*.2);g.rotate(arm);g.strokeStyle='#8A5A33';g.lineWidth=Math.max(1.5,C*.035);line(g,0,0,C*.34,0);g.fillStyle='#4A3220';circ(g,C*.34,0,C*.05);if(arm<-1)g.fillStyle='#8C8A84',circ(g,C*.34,0,C*.035);g.restore();
    g.fillStyle=PAL.woad;g.fillRect(X-C*.24,Y-C*.06,C*.06,C*.06)}
  else if(u.type==='knight'){
    const s=mv?Math.sin(now*16)*C*.04:0;g.fillStyle=PAL.shadow;ell(g,X,Y+C*.1,C*.22,C*.05);
    g.strokeStyle='#3A2616';g.lineWidth=Math.max(1.2,C*.03);for(const[lx,ph]of[[-.13,1],[-.07,-1],[.08,-1],[.14,1]])line(g,X+C*lx,Y,X+C*lx+s*ph,Y+C*.1);
    g.fillStyle='#7A4E2D';ell(g,X,Y-C*.02,C*.18,C*.07);g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=1;g.beginPath();g.ellipse(X,Y-C*.02,C*.18,C*.07,0,0,7);g.stroke();
    g.fillStyle='#7A4E2D';poly(g,[X+C*.12,Y-C*.06,X+C*.2,Y-C*.2,X+C*.26,Y-C*.17,X+C*.18,Y-C*.02]);g.fillStyle='#3A2616';poly(g,[X+C*.13,Y-C*.1,X+C*.19,Y-C*.21,X+C*.16,Y-C*.06]);
    g.fillStyle=U.col;g.fillRect(X-C*.12,Y-C*.06,C*.18,C*.06);// Satteldecke
    person(g,X-C*.02,Y-C*.1,C,U.col,null,0,HELM.knight);spear(g,X-C*.02,Y-C*.12,C,.42);
  }else{
    person(g,X,Y,C,U.col,null,mv,HELM[u.type]);
    if(u.type==='archer')bow(g,X,Y,C);else if(u.type==='spear')spear(g,X,Y,C);else{shield(g,X,Y,C,'#8A5A33');sword(g,X,Y,C)}
  }
  g.restore();
  if(u.hp<u.max)bar(g,X-C*.2,Y-C*(u.type==='knight'?.56:.4),C*.4,u.hp/u.max);
}
// Bildschirmposition einer Einheit: Füße (X, Y, angehoben) und Bodenhöhe für die Tiefensortierung (gy)
function unitXY(u){const o=uoff.get(u.id)||[0,0],X=sx(u.x,u.y)+o[0]*cell,gy=sy(u.x,u.y)+o[1]*cell;return{X,Y:gy+cell*.06-unitLift(u)*cell,gy}}
function enemyXY(e){const X=sx(e.x,e.y),Y=sy(e.x,e.y)+cell*.06;return{X,Y:Y-enemyLift(e)*cell,gy:Y}}
// Mehrere Einheiten auf einem Feld nebeneinander stellen (Bergfried etwas weiter)
const USLOT=[[0,0],[-.24,-.08],[.24,-.08],[-.24,.14],[.24,.14],[0,.2]];
function layoutUnits(){
  uoff.clear();const at=new Map();
  for(const u of S.units){if(u.path.length)continue;if(!at.has(u.i))at.set(u.i,[]);at.get(u.i).push(u)}
  for(const[i,l]of at){const k=i===KI?1.3:1;l.forEach((u,j)=>{const o=USLOT[j%USLOT.length];uoff.set(u.id,[o[0]*k,o[1]*k])})}
  for(const u of S.units){const X=sx(u.x,u.y),f=ufc.get(u.id);if(!f){ufc.set(u.id,{x:X,f:1});continue}if(Math.abs(X-f.x)>.5){f.f=X<f.x?-1:1;f.x=X}}
  if(ufc.size>S.units.length*2+8)for(const k of[...ufc.keys()])if(!S.units.some(u=>u.id===k))ufc.delete(k);
}
function drawWallish(g,x,y,C,b,nb){
  const bt=B[b.type].base||b.type;
  if(bt==='mauer')return drawWallBand(g,x,y,C,b,nb);
  const t=bt,tower=t==='turm',gate=t==='tor',d=B[b.type];
  const H=C*(tower?.64:gate?.44:.32),e=tower?C*.07:0,x0=x-e,w=C+e*2,top=y-H-e,dep=C+e,fy=top+dep,fh=y+C-fy;
  const oN=tower||!nb(-1,0),oS=tower||!nb(1,0),oW=tower||!nb(0,-1),oE=tower||!nb(0,1);
  if(oE){g.fillStyle=PAL.shadow;poly(g,[x0+w,top+C*.1,x0+w+C*.2,top+C*.3,x0+w+C*.2,y+C+C*.06,x0+w,y+C])}
  if(oS||gate){
    g.fillStyle=PAL.stoneD;g.fillRect(x0,fy,w,fh);
    g.strokeStyle='rgba(40,35,25,.35)';g.lineWidth=1;const rows=Math.max(2,Math.round(fh/(C*.12)));
    for(let q=1;q<=rows;q++){const ly=fy+fh*q/rows;if(q<rows)line(g,x0,ly,x0+w,ly);
      for(let s=0;s<3;s++){const lx=x0+w*(s+(q%2?.5:0))/3;if(lx>x0+1&&lx<x0+w-1)line(g,lx,ly-fh/rows,lx,ly)}}
    g.strokeStyle='rgba(30,25,18,.6)';g.strokeRect(x0+.5,fy+.5,w-1,fh-1);
  }
  g.fillStyle=PAL.stone;g.fillRect(x0,top,w,dep);
  const ins=C*.14;g.fillStyle=TOPL();g.fillRect(x0+(oW?ins:0),top+(oN?ins:0),w-(oW?ins:0)-(oE?ins:0),dep-(oN?ins:0)-(oS?ins:0));
  g.strokeStyle='rgba(30,25,18,.55)';g.lineWidth=1;g.beginPath();
  if(oN){g.moveTo(x0,top+.5);g.lineTo(x0+w,top+.5)}if(oS){g.moveTo(x0,fy-.5);g.lineTo(x0+w,fy-.5)}
  if(oW){g.moveTo(x0+.5,top);g.lineTo(x0+.5,fy)}if(oE){g.moveTo(x0+w-.5,top);g.lineTo(x0+w-.5,fy)}g.stroke();
  const m=C*.14,mer=(mx,my)=>{g.fillStyle=PAL.stoneD;g.fillRect(mx,my+m*.55,m,m*.45);g.fillStyle=TOPL();g.fillRect(mx,my,m,m*.6);g.strokeStyle='rgba(30,25,18,.5)';g.strokeRect(mx+.5,my+.5,m-1,m-1)};
  const n=tower?3:2;
  for(let k=0;k<n;k++){const f=(k+.5)/n;
    if(oN)mer(x0+w*f-m/2,top-m*.4);if(oW)mer(x0-m*.1,top+dep*f-m/2);if(oE)mer(x0+w-m*.9,top+dep*f-m/2);if(oS)mer(x0+w*f-m/2,fy-m*.8)}
  if(gate){const dw=C*.44,dh=fh*.9,dx=x+C/2-dw/2,dy=y+C-dh;
    g.fillStyle='#5A3A1E';rr(g,dx,dy,dw,dh,[dw/2,dw/2,0,0]);g.fill();g.strokeStyle='#2E1D0E';g.lineWidth=1;g.stroke();
    for(let s=1;s<4;s++)line(g,dx+dw*s/4,dy+dh*.18,dx+dw*s/4,dy+dh);g.fillStyle='#333';g.fillRect(dx,dy+dh*.5,dw,1.5)}
  if(tower){g.fillStyle='#2B2620';g.fillRect(x+C*.47,fy+fh*.25,C*.06,fh*.4)}
  const f=b.hp/d.hp;
  if(f<.6){g.strokeStyle='rgba(30,20,10,.7)';g.lineWidth=1.2;g.beginPath();g.moveTo(x+C*.3,top+dep*.3);g.lineTo(x+C*.42,top+dep*.5);g.lineTo(x+C*.36,top+dep*.75);
    if(f<.3){g.moveTo(x+C*.7,top+dep*.2);g.lineTo(x+C*.6,top+dep*.45);g.lineTo(x+C*.72,top+dep*.7)}g.stroke()}
  if(f<1&&(tower||gate))bar(g,x,top-C*.18,C,f);
  if(FOE&&tower)flag(g,x+C*.5,top+dep*.3,C,C*.45);
  if(DARK>.02&&g===ctx){if(tower)glows.push({x:x+C*.5,y:top+dep*.5,r:C*1.6,a:.8});if(gate){glows.push({x:x+C*.15,y:y+C*.75,r:C*1.1,a:.8});glows.push({x:x+C*.85,y:y+C*.75,r:C*1.1,a:.8})}}
  if(DARK>.2&&gate&&g===ctx)for(const tx of[.12,.88]){const fl=Math.sin(now*14+tx*9)*C*.015;g.fillStyle='#5E3B1F';g.fillRect(x+C*tx-1,y+C*.72,2,C*.12);g.fillStyle='#FFC23A';poly(g,[x+C*tx-C*.035,y+C*.72,x+C*tx,y+C*.62+fl,x+C*tx+C*.035,y+C*.72])}
}
function drawWallBand(g,x,y,C,b,nb){
  const H=C*.36,k=C*.52,a=(C-k)/2,cN=nb(-1,0),cS=nb(1,0),cW=nb(0,-1),cE=nb(0,1);
  const hx0=x+(cW?0:a),hx1=x+C-(cE?0:a),vy0=y+(cN?0:a),vy1=y+C-(cS?0:a),ht=y+a-H;
  g.fillStyle=PAL.shadow;g.fillRect(hx0+C*.14,y+a+C*.05,hx1-hx0,k);if(cN||cS)g.fillRect(x+a+C*.14,vy0+C*.05,k,vy1-vy0);
  // Vorderseite
  const fy=ht+k;g.fillStyle=PAL.stoneD;g.fillRect(hx0,fy,hx1-hx0,H);
  g.strokeStyle='rgba(40,35,25,.35)';g.lineWidth=1;
  for(let q=1;q<=3;q++){const ly=fy+H*q/3;if(q<3)line(g,hx0,ly,hx1,ly);for(let i=0;i<4;i++){const lx=x+C*(i+(q%2?.5:0))/4;if(lx>hx0+1&&lx<hx1-1)line(g,lx,ly-H/3,lx,ly)}}
  g.strokeStyle='rgba(30,25,18,.6)';g.strokeRect(hx0+.5,fy+.5,hx1-hx0-1,H-1);
  // Oberseite
  const rects=[[hx0,ht,hx1-hx0,k]];if(cN||cS)rects.push([x+a,vy0-H,k,vy1-vy0]);
  g.strokeStyle='rgba(30,25,18,.6)';g.lineWidth=2;rects.forEach(r=>g.strokeRect(...r));
  g.fillStyle=PAL.stone;rects.forEach(r=>g.fillRect(...r));
  const i2=C*.09;g.fillStyle=TOPL();
  g.fillRect(hx0+(cW?0:i2),ht+i2,hx1-hx0-(cW?0:i2)-(cE?0:i2),k-i2*2);
  if(cN||cS)g.fillRect(x+a+i2,vy0-H+(cN?0:i2),k-i2*2,vy1-vy0-(cN?0:i2)-(cS?0:i2));
  // Zinnen, über Feldgrenzen hinweg im gleichen Takt
  const m=C*.13,mer=(mx,my)=>{g.fillStyle=PAL.stoneD;g.fillRect(mx,my+m*.55,m,m*.45);g.fillStyle=TOPL();g.fillRect(mx,my,m,m*.6);g.strokeStyle='rgba(30,25,18,.5)';g.lineWidth=1;g.strokeRect(mx+.5,my+.5,m-1,m-1)};
  for(let i=0;i<4;i++){const px=x+C*(.125+i*.25)-m/2,inC=px+m>x+a&&px<x+a+k;
    if(px>=hx0-1&&px+m<=hx1+1&&!(inC&&cN))mer(px,ht-m*.45)}
  if(cN||cS)for(let i=0;i<4;i++){const py=y+C*(.125+i*.25)-m/2-H,inC=py+m>ht&&py<ht+k;
    if(py>=vy0-H-1&&py+m<=vy1-H+1&&!inC){mer(x+a-m*.15,py);mer(x+a+k-m*.85,py)}}
  const f=b.hp/B[b.type].hp;if(FOE&&f<1)bar(g,x+C*.1,ht-C*.2,C*.8,f);
  if(f<.6){g.strokeStyle='rgba(30,20,10,.7)';g.lineWidth=1.2;g.beginPath();g.moveTo(x+C*.4,ht+k*.2);g.lineTo(x+C*.48,ht+k*.5);g.lineTo(x+C*.42,fy+H*.7);
    if(f<.3){g.moveTo(x+C*.62,ht+k*.15);g.lineTo(x+C*.56,ht+k*.6);g.lineTo(x+C*.64,fy+H*.5)}g.stroke()}
}
// Bergfried in drei Stufen: 0 Holzburg (Holz, Palisadenspitzen), 1 Steinburg, 2 Festung (größer, Ecktürme, zwei Banner)
function drawKeep(g,x,y,C,lv=S?S.keepLv||0:0,fb=null){
  const wood=lv===0,fort=lv===2,sc=fort?1.12:1;
  const cW=wood?'#7A5232':PAL.stoneD,cT=wood?'#9A7048':PAL.stone,cI=wood?(SEASON===3?'#F3F6F9':'#B08A5E'):TOPL();
  const x0=x-C*.22*sc-(sc-1)*C*.5,w=C*1.44*sc,gy=y+C*1.02,H=C*.8*sc,dep=C*1.1*sc,top=gy-H-dep,fy=gy-H;
  g.fillStyle=PAL.shadow;poly(g,[x0+w,top+C*.15,x0+w+C*.32,top+C*.42,x0+w+C*.32,gy+C*.06,x0+w,gy]);
  g.fillStyle=cW;g.fillRect(x0,fy,w,H);
  g.strokeStyle=wood?'rgba(40,20,5,.45)':'rgba(40,35,25,.3)';g.lineWidth=1;
  if(wood){for(let s2=1;s2<9;s2++){const lx=x0+w*s2/9;line(g,lx,fy,lx,gy)}g.strokeStyle='#4A3220';g.lineWidth=2;line(g,x0,fy+H*.3,x0+w,fy+H*.3);line(g,x0,fy+H*.75,x0+w,fy+H*.75)}
  else for(let q=1;q<6;q++){const ly=fy+H*q/6;line(g,x0,ly,x0+w,ly);for(let s2=0;s2<5;s2++){const lx=x0+w*(s2+(q%2?.5:0))/5;if(lx>x0+1&&lx<x0+w-1)line(g,lx,ly-H/6,lx,ly)}}
  g.lineWidth=1;g.fillStyle='rgba(0,0,0,.12)';g.fillRect(x0+w*.75,fy,w*.25,H);
  g.fillStyle='#2B2620';for(const px of[.18,.82])g.fillRect(x0+w*px-C*.03,fy+H*.18,C*.06,C*.18);
  const dw=C*.34,dh=H*.48;g.fillStyle='#5A3A1E';rr(g,x0+w/2-dw/2,gy-dh,dw,dh,[dw/2,dw/2,0,0]);g.fill();g.strokeStyle='#2E1D0E';g.stroke();
  g.strokeStyle='rgba(30,25,18,.6)';g.strokeRect(x0+.5,fy+.5,w-1,H-1);
  g.fillStyle=cT;g.fillRect(x0,top,w,dep);g.fillStyle=cI;g.fillRect(x0+C*.16,top+C*.16,w-C*.32,dep-C*.32);
  g.strokeStyle='rgba(30,25,18,.55)';g.strokeRect(x0+.5,top+.5,w-1,dep-1);
  const ix=x0+w*.3,iw=w*.4,it=top+dep*.18;
  g.fillStyle=cW;g.fillRect(ix,it+C*.24,iw,C*.2);g.fillStyle=cT;g.fillRect(ix,it,iw,C*.26);g.strokeStyle='rgba(30,25,18,.55)';g.strokeRect(ix+.5,it+.5,iw-1,C*.44-1);
  if(wood){// Palisadenspitzen statt Zinnen
    const sp=(px,py)=>{g.fillStyle='#5E3B1F';poly(g,[px,py,px,py-C*.08,px+C*.06,py-C*.15,px+C*.12,py-C*.08,px+C*.12,py]);g.fillStyle=SEASON===3?'#F6F8FA':'#C89A68';poly(g,[px+C*.02,py-C*.08,px+C*.06,py-C*.13,px+C*.1,py-C*.08]);g.strokeStyle='rgba(30,15,5,.6)';g.lineWidth=1;line(g,px+C*.06,py-C*.13,px+C*.06,py)};
    for(let k=0;k<8;k++){const f=(k+.5)/8;sp(x0+w*f-C*.06,top+C*.04);sp(x0+w*f-C*.06,fy+C*.04)}
  }else{
    const m=C*.15,mer=(mx,my)=>{g.fillStyle=PAL.stoneD;g.fillRect(mx,my+m*.55,m,m*.45);g.fillStyle=TOPL();g.fillRect(mx,my,m,m*.6);g.strokeStyle='rgba(30,25,18,.5)';g.strokeRect(mx+.5,my+.5,m-1,m-1)};
    for(let k=0;k<4;k++){const f=(k+.5)/4;mer(x0+w*f-m/2,top-m*.4);mer(x0-m*.1,top+dep*f-m/2);mer(x0+w-m*.9,top+dep*f-m/2);mer(x0+w*f-m/2,fy-m*.8)}
  }
  if(fort)for(const[px,py]of[[x0,top],[x0+w,top],[x0,fy],[x0+w,fy]]){// Ecktürme
    const r=C*.17;g.fillStyle=PAL.stoneD;g.fillRect(px-r,py-C*.08,r*2,C*.3);g.fillStyle=PAL.stone;ell(g,px,py-C*.08,r,r*.75);g.fillStyle=TOPL();ell(g,px,py-C*.1,r*.7,r*.5);
    g.fillStyle='#46525F';poly(g,[px-r,py-C*.1,px,py-C*.42,px+r,py-C*.1]);g.strokeStyle='rgba(30,25,18,.5)';g.lineWidth=1;g.beginPath();g.ellipse(px,py-C*.08,r,r*.75,0,0,7);g.stroke()}
  flag(g,ix+iw/2,it+C*.1,C,C*.55);if(fort)flag(g,ix+iw*.15,it+C*.18,C,C*.4);
  if(fb){if(fb.hp<fb.max)bar(g,x0,top-C*.3,w,fb.hp/fb.max)}else if(S&&S.keepHp<S.keepMax)bar(g,x0,top-C*.3,w,S.keepHp/S.keepMax);
  if(DARK>.02)glows.push({x:x+C*.5,y:y+C*.5,r:C*2.6,a:.9});
}
function flames(g,x,y,C){
  for(let k=0;k<3;k++){const f=Math.sin(now*12+k*2.1)*.06,fx2=x+C*(.3+k*.2),h=C*(.42+f+(k===1?.12:0)),by=y+C*.7;
    g.fillStyle=k===1?'#FFC23A':'#F0602A';g.beginPath();g.moveTo(fx2-C*.1,by);g.quadraticCurveTo(fx2-C*.08,by-h*.6,fx2,by-h);g.quadraticCurveTo(fx2+C*.08,by-h*.6,fx2+C*.1,by);g.fill()}
  lights.push({x:x+C*.5,y:y+C*.45,r:C*(1.4+Math.sin(now*9)*.15),a:.5});
}
function drawB(g,x,y,C,b,nb,r,c,live){
  const t=b.type,d=B[t];
  if(d.foe){// feindliche Burg: dunkler Stein, rote Banner
    const keep=[PAL.stone,PAL.stoneD];PAL.stone='#8A8174';PAL.stoneD='#5E574E';FOE=1;
    if(t==='fkeep')drawKeep(g,x,y,C,1,b);else drawWallish(g,x,y,C,b,nb);
    FOE=0;PAL.stone=keep[0];PAL.stoneD=keep[1];return}
  if(d.wall)return drawWallish(g,x,y,C,b,nb);
  const active=!d.w||b.on;
  g.save();if(d.w&&!b.on)g.globalAlpha=.6;
  switch(t){
    case 'haus':{const k=box(g,x,y,C,{w:.62,h:.26,d:.34,wall:PAL.plaster,roof:PAL.thatch,roofD:PAL.thatchD,stripes:1});
      g.strokeStyle=PAL.woodD;g.lineWidth=1.2;line(g,k.x0+k.W*.25,k.gy-k.H,k.x0+k.W*.25,k.gy);line(g,k.x0+k.W*.75,k.gy-k.H,k.x0+k.W*.75,k.gy);
      door(g,k.x0+k.W*.5,k.gy,C);win(g,k.x0+k.W*.06,k.gy-k.H*.72,C);break}
    case 'holzf':{const k=box(g,x,y,C,{w:.46,h:.24,d:.28,dx:-.13,wall:PAL.wood,roof:'#6E4A2A',roofD:'#553820'});door(g,k.x0+k.W*.5,k.gy,C,.12,.15);
      g.fillStyle=PAL.shadow;ell(g,x+C*.78,y+C*.84,C*.16,C*.05);
      for(const[px,py]of[[.66,.8],[.8,.8],[.73,.7]]){g.fillStyle='#7A4E2D';circ(g,x+C*px,y+C*py,C*.065);g.fillStyle='#D2A86E';circ(g,x+C*px,y+C*py,C*.035)}break}
    case 'obst':{g.strokeStyle='#8A6A44';g.lineWidth=1.2;g.strokeRect(x+C*.08,y+C*.14,C*.84,C*.78);
      for(const[px,py]of[[.3,.4],[.7,.4],[.3,.76],[.7,.76]]){const cx=x+C*px,cy=y+C*py;g.fillStyle=PAL.shadow;ell(g,cx+C*.05,cy+C*.08,C*.13,C*.05);
        if(SEASON===3){bare(g,cx,cy+C*.06,C,.55);continue}
        const cc=SEASON===2?AUT[1]:SEASON===0?['#3C8236','#57A346']:[PAL.leaf2,PAL.leaf1];
        g.fillStyle=PAL.woodD;g.fillRect(cx-1.5,cy-C*.02,3,C*.1);g.fillStyle=cc[0];circ(g,cx,cy-C*.08,C*.14);g.fillStyle=cc[1];circ(g,cx-C*.03,cy-C*.11,C*.09);
        g.fillStyle=SEASON===0?'#F7CAD8':'#D33B2C';const fr=SEASON===2?[[.06,-.05],[-.05,-.03],[.01,-.14],[-.08,-.1],[.08,-.12],[0,-.02]]:[[.06,-.05],[-.05,-.03],[.01,-.14]];
        for(const[fx2,fy2]of fr)circ(g,cx+C*fx2,cy+C*fy2,C*.026)}break}
    case 'farm':{g.fillStyle=SEASON===3?'#E4EAEE':'#8A6A3F';rr(g,x+C*.06,y+C*.1,C*.88,C*.8,C*.06);g.fill();
      for(let k=0;k<4;k++){const ry=y+C*(.24+k*.18);
        if(SEASON===3){g.fillStyle='rgba(160,170,180,.35)';g.fillRect(x+C*.1,ry,C*.8,C*.03);continue}
        if(SEASON===0){g.strokeStyle='#5DAA43';g.lineWidth=1.4;for(let s=0;s<9;s++){const sx=x+C*(.13+s*.093);line(g,sx,ry+C*.03,sx+Math.sin(now*2+s)*C*.01,ry-C*.04)}continue}
        if(SEASON===2){g.fillStyle='#B59650';g.fillRect(x+C*.1,ry-C*.02,C*.8,C*.05);continue}
        g.fillStyle='#D9B54A';g.fillRect(x+C*.1,ry-C*.05,C*.8,C*.09);
        g.strokeStyle='#B08A2A';g.lineWidth=1;for(let s=0;s<7;s++){const sx=x+C*(.14+s*.12),sw=Math.sin(now*2+s*.7+k)*C*.025;line(g,sx,ry+C*.04,sx+sw,ry-C*.08)}}
      if(SEASON===2)for(const[px,py]of[[.32,.56],[.66,.38]]){g.fillStyle=PAL.shadow;ell(g,x+C*px+C*.05,y+C*py+C*.07,C*.11,C*.04);g.fillStyle='#D8B25A';ell(g,x+C*px,y+C*py,C*.1,C*.08);g.strokeStyle='#A07E36';g.lineWidth=1;g.beginPath();g.ellipse(x+C*px,y+C*py,C*.06,C*.05,0,0,7);g.stroke()}
      break}
    case 'muehle':{const k=box(g,x,y,C,{w:.44,h:.4,d:.2,wall:'#D8CFB8',roof:'#7A5236',roofD:'#5E3E28'});door(g,k.x0+k.W/2,k.gy,C,.12,.16);
      const cx=k.x0+k.W/2,cy=k.gy-k.H*.72,a=active&&!b.starved?now*1.6:.4;
      g.save();g.translate(cx,cy);g.rotate(a);for(let s=0;s<4;s++){g.rotate(Math.PI/2);g.fillStyle='#EFE6CF';g.fillRect(C*.05,-C*.05,C*.34,C*.1);g.strokeStyle='#6B4A2A';g.lineWidth=1;g.strokeRect(C*.05,-C*.05,C*.34,C*.1);line(g,0,0,C*.4,0)}
      g.fillStyle='#4A3220';circ(g,0,0,C*.05);g.restore();break}
    case 'baecker':{const k=box(g,x,y,C,{w:.6,h:.27,d:.32,wall:'#C9845E',roof:PAL.roofR,roofD:PAL.roofRD});
      g.strokeStyle='rgba(90,40,20,.35)';g.lineWidth=1;for(let q=1;q<3;q++)line(g,k.x0,k.gy-k.H*q/3,k.x0+k.W,k.gy-k.H*q/3);
      const chx=k.x0+k.W*.72,chy=k.gy-k.H-k.D-C*.1;g.fillStyle='#7A4632';g.fillRect(chx,chy,C*.1,C*.2);
      door(g,k.x0+k.W*.32,k.gy,C);win(g,k.x0+k.W*.62,k.gy-k.H*.72,C);
      if(live&&active&&!b.starved&&Math.random()<.08)fx((chx+C*.05-ox)/C,(chy-oy)/C,'smoke',1,true);break}
    case 'stein':{g.fillStyle='#6B675E';ell(g,x+C*.46,y+C*.56,C*.36,C*.28);g.fillStyle='#4F4C45';ell(g,x+C*.46,y+C*.61,C*.26,C*.18);
      for(const[px,py]of[[.64,.84],[.78,.84],[.71,.74]])cube(g,x+C*px,y+C*py,C*.11);
      g.strokeStyle=PAL.woodD;g.lineWidth=2;g.beginPath();g.moveTo(x+C*.16,y+C*.86);g.lineTo(x+C*.2,y+C*.18);g.lineTo(x+C*.5,y+C*.28);g.stroke();
      g.lineWidth=1;g.strokeStyle='#333';line(g,x+C*.5,y+C*.28,x+C*.5,y+C*.48);cube(g,x+C*.5,y+C*.56,C*.08);break}
    case 'brunnen':{g.fillStyle=PAL.shadow;ell(g,x+C*.58,y+C*.74,C*.3,C*.1);
      g.fillStyle=PAL.stoneD;ell(g,x+C*.5,y+C*.66,C*.28,C*.16);g.fillStyle=PAL.stone;ell(g,x+C*.5,y+C*.6,C*.28,C*.16);
      g.fillStyle=SEASON===3?'#BCD8E7':'#2F6E93';ell(g,x+C*.5,y+C*.6,C*.18,C*.09);g.fillStyle='rgba(255,255,255,.4)';ell(g,x+C*.45+Math.sin(now*2)*C*.02,y+C*.58,C*.05,C*.02);
      g.fillStyle=PAL.woodD;g.fillRect(x+C*.24,y+C*.24,C*.05,C*.38);g.fillRect(x+C*.71,y+C*.24,C*.05,C*.38);
      g.fillStyle=PAL.roofR;poly(g,[x+C*.14,y+C*.28,x+C*.5,y+C*.08,x+C*.86,y+C*.28]);g.fillStyle=PAL.roofRD;poly(g,[x+C*.14,y+C*.28,x+C*.86,y+C*.28,x+C*.86,y+C*.32,x+C*.14,y+C*.32]);
      g.strokeStyle='#333';g.lineWidth=1;line(g,x+C*.5,y+C*.3,x+C*.5,y+C*.44);g.fillStyle=PAL.wood;g.fillRect(x+C*.46,y+C*.42,C*.08,C*.07);break}
    case 'kapelle':{const k=box(g,x,y,C,{w:.58,h:.34,d:.3,wall:'#F1ECDD',roof:'#5E6E80',roofD:'#46525F'});
      const sx=k.x0+k.W*.5,st=k.gy-k.H-C*.34;g.fillStyle='#E6DFCB';g.fillRect(sx-C*.08,st,C*.16,C*.34+k.H*.35);
      g.strokeStyle='rgba(40,25,10,.6)';g.lineWidth=1;g.strokeRect(sx-C*.08+.5,st+.5,C*.16-1,C*.34+k.H*.35-1);
      g.fillStyle='#46525F';poly(g,[sx-C*.11,st,sx,st-C*.26,sx+C*.11,st]);
      g.strokeStyle=PAL.gold;g.lineWidth=1.5;line(g,sx,st-C*.26,sx,st-C*.38);line(g,sx-C*.04,st-C*.34,sx+C*.04,st-C*.34);
      win(g,sx-C*.045,st+C*.08,C);door(g,sx,k.gy,C,.13,.18);break}
    case 'kaserne':{const k=box(g,x,y,C,{w:.78,h:.28,d:.3,wall:'#8F6A45',roof:'#5A4632',roofD:'#433424'});
      g.strokeStyle='rgba(40,25,10,.4)';g.lineWidth=1;for(let q=1;q<6;q++)line(g,k.x0+k.W*q/6,k.gy-k.H,k.x0+k.W*q/6,k.gy);
      for(const px of[.2,.8]){g.fillStyle=PAL.woad;circ(g,k.x0+k.W*px,k.gy-k.H*.55,C*.06);g.fillStyle=PAL.gold;circ(g,k.x0+k.W*px,k.gy-k.H*.55,C*.025)}
      door(g,k.x0+k.W/2,k.gy,C);flag(g,k.x0+k.W*.92,k.gy-k.H-k.D*.4,C,C*.4);break}
    case 'lager':{// offener Schuppen mit Stämmen, Steinen und Kisten
      g.fillStyle=PAL.shadow;g.fillRect(x+C*.16,y+C*.84,C*.78,C*.06);
      g.fillStyle=PAL.woodD;for(const px of[.1,.86])g.fillRect(x+C*px,y+C*.36,C*.05,C*.5);
      const ry=y+C*.24;g.fillStyle=SEASON===3?'#F6F8FA':'#7A5236';g.fillRect(x+C*.04,ry,C*.92,C*.12);g.fillStyle=SEASON===3?'#DDE5EC':'#5E3E28';g.fillRect(x+C*.04,ry+C*.12,C*.92,C*.05);
      g.strokeStyle='rgba(40,25,10,.6)';g.lineWidth=1;g.strokeRect(x+C*.04+.5,ry+.5,C*.92-1,C*.17-1);
      for(let k=0;k<3;k++){g.fillStyle='#7A4E2D';g.fillRect(x+C*.18,y+C*(.7-k*.09),C*.32,C*.08);g.fillStyle='#D2A86E';circ(g,x+C*.5,y+C*(.74-k*.09),C*.04)}
      cube(g,x+C*.64,y+C*.84,C*.13);cube(g,x+C*.78,y+C*.84,C*.13);cube(g,x+C*.71,y+C*.72,C*.13);
      g.fillStyle='#A07850';g.fillRect(x+C*.6,y+C*.44,C*.24,C*.16);g.strokeStyle='#5E3B1F';g.strokeRect(x+C*.6+.5,y+C*.44+.5,C*.24-1,C*.16-1);line(g,x+C*.6,y+C*.44,x+C*.84,y+C*.6);break}
    case 'korn':{const k=box(g,x,y,C,{w:.5,h:.44,d:.26,wall:'#C9A36A',roof:PAL.roofR,roofD:PAL.roofRD});
      g.strokeStyle='rgba(90,60,20,.4)';g.lineWidth=1;for(let q=1;q<5;q++)line(g,k.x0+k.W*q/5,k.gy-k.H,k.x0+k.W*q/5,k.gy);
      door(g,k.x0+k.W/2,k.gy,C,.14,.2);
      for(const[px,py]of[[.12,.86],[.86,.86],[.86,.74]]){g.fillStyle='#E9DDB8';ell(g,x+C*px,y+C*py,C*.07,C*.08);g.strokeStyle='#A08A5A';g.beginPath();g.ellipse(x+C*px,y+C*py,C*.07,C*.08,0,0,7);g.stroke()}break}
    case 'mine':{// Stolleneingang mit Holzrahmen, Erzkarren
      g.fillStyle='#6B675E';ell(g,x+C*.5,y+C*.58,C*.42,C*.3);g.fillStyle='#857F74';ell(g,x+C*.46,y+C*.52,C*.32,C*.2);
      if(SEASON===3){g.fillStyle='#F3F6F9';ell(g,x+C*.46,y+C*.42,C*.26,C*.1)}
      g.fillStyle='#1E1A16';rr(g,x+C*.34,y+C*.48,C*.24,C*.3,[C*.12,C*.12,0,0]);g.fill();
      g.fillStyle=PAL.woodD;g.fillRect(x+C*.31,y+C*.48,C*.05,C*.32);g.fillRect(x+C*.56,y+C*.48,C*.05,C*.32);g.fillRect(x+C*.29,y+C*.45,C*.34,C*.06);
      g.fillStyle='#4A4A50';g.fillRect(x+C*.66,y+C*.74,C*.22,C*.1);g.fillStyle='#2B2620';circ(g,x+C*.7,y+C*.86,C*.03);circ(g,x+C*.84,y+C*.86,C*.03);
      g.fillStyle='#8E5A44';for(const[px,py]of[[.71,.72],[.77,.7],[.83,.72]])circ(g,x+C*px,y+C*py,C*.035);break}
    case 'schmied':{const k=box(g,x,y,C,{w:.54,h:.28,d:.28,dx:-.08,wall:'#8C8578',roof:'#3E3A36',roofD:'#2C2926'});
      const chx=k.x0+k.W*.75,chy=k.gy-k.H-k.D-C*.12;g.fillStyle='#5A544C';g.fillRect(chx,chy,C*.1,C*.22);
      door(g,k.x0+k.W*.35,k.gy,C);
      g.fillStyle='#2E2E33';g.fillRect(x+C*.72,y+C*.76,C*.18,C*.05);g.fillRect(x+C*.77,y+C*.8,C*.08,C*.06);g.fillRect(x+C*.74,y+C*.85,C*.14,C*.03);
      const hot=active&&!b.starved;if(hot){g.fillStyle='rgba(255,140,40,.85)';g.fillRect(k.x0+k.W*.6,k.gy-k.H*.6,C*.08,C*.07)}
      if(live&&hot){if(Math.random()<.06)fx((chx+C*.05-ox)/C,(chy-oy)/C,'smoke',1,true);if(Math.random()<.05)fx((x+C*.81-ox)/C,(y+C*.74-oy)/C,'ember',1,true);if(DARK>.02)lights.push({x:x+C*.6,y:y+C*.62,r:C*.9,a:.35})}
      const ic=(b.mode||'speer')==='schwert'?'#C8CDD2':'#B08A5A';g.strokeStyle=ic;g.lineWidth=2;line(g,x+C*.1,y+C*.9,x+C*.1,y+C*.56);break}
    case 'weide':{g.strokeStyle='#8A6A44';g.lineWidth=1.4;rr(g,x+C*.06,y+C*.14,C*.88,C*.78,C*.04);g.stroke();
      for(let k=0;k<5;k++){const px=x+C*(.06+k*.22);g.fillStyle='#6B4A2A';g.fillRect(px-1,y+C*.12,2,C*.06);g.fillRect(px-1,y+C*.88,2,C*.06)}
      if(SEASON!==3){g.fillStyle='rgba(90,150,60,.35)';ell(g,x+C*.5,y+C*.55,C*.36,C*.3)}
      const cows=[[.32,.42],[.66,.62],[.4,.74]];cows.forEach(([px,py],i)=>{const cx=x+C*px+Math.sin(now*.5+i*2)*C*.02,cy=y+C*py;
        g.fillStyle=PAL.shadow;ell(g,cx+C*.03,cy+C*.07,C*.11,C*.035);g.fillStyle=i%2?'#7A4E2D':'#F2EEE4';rr(g,cx-C*.1,cy-C*.06,C*.18,C*.1,C*.04);g.fill();
        g.fillStyle=i%2?'#F2EEE4':'#3A2A1C';circ(g,cx-C*.02,cy-C*.02,C*.025);g.fillStyle=i%2?'#5E3B1F':'#E8D8C0';rr(g,cx+C*.06,cy-C*.08,C*.07,C*.07,C*.02);g.fill();
        g.fillStyle='#2B2620';g.fillRect(cx-C*.08,cy+C*.04,2,C*.04);g.fillRect(cx+C*.05,cy+C*.04,2,C*.04)});break}
    case 'gerber':{const k=box(g,x,y,C,{w:.46,h:.24,d:.26,dx:-.14,wall:'#A8865C',roof:'#6E4A2A',roofD:'#553820'});door(g,k.x0+k.W*.5,k.gy,C,.12,.15);
      g.strokeStyle=PAL.woodD;g.lineWidth=1.5;line(g,x+C*.66,y+C*.88,x+C*.66,y+C*.46);line(g,x+C*.92,y+C*.88,x+C*.92,y+C*.46);line(g,x+C*.64,y+C*.48,x+C*.94,y+C*.48);
      g.fillStyle='#B07A48';rr(g,x+C*.69,y+C*.5,C*.09,C*.22,C*.03);g.fill();g.fillStyle='#8E5A34';rr(g,x+C*.8,y+C*.5,C*.09,C*.2,C*.03);g.fill();
      g.fillStyle='#5E4A3A';ell(g,x+C*.2,y+C*.86,C*.09,C*.04);break}
    case 'bogner':{const k=box(g,x,y,C,{w:.5,h:.25,d:.28,dx:-.1,wall:'#B48E5E',roof:'#5A6E3A',roofD:'#46562C'});door(g,k.x0+k.W*.4,k.gy,C,.12,.15);
      g.strokeStyle='#6B4423';g.lineWidth=1.6;for(let q=0;q<2;q++){const bx=x+C*(.74+q*.12);g.beginPath();g.arc(bx-C*.06,y+C*.68,C*.16,-1.1,1.1);g.stroke();g.strokeStyle='#E8E0C8';g.lineWidth=.8;line(g,bx-C*.06+Math.cos(-1.1)*C*.16,y+C*.68+Math.sin(-1.1)*C*.16,bx-C*.06+Math.cos(1.1)*C*.16,y+C*.68+Math.sin(1.1)*C*.16);g.strokeStyle='#6B4423';g.lineWidth=1.6}break}
    case 'bruecke':{// Bohlen quer über den Fluss: läuft das Wasser auf dem Bildschirm senkrecht, liegt die Brücke waagerecht
      const wAt=(dx,dy)=>{const r2=r+(TRANS?dx:dy),c2=c+(TRANS?dy:dx);return inb(r2,c2)&&T(r2,c2).t===WATER&&!(T(r2,c2).b&&T(r2,c2).b.type==='bruecke')};
      const hor=live?(wAt(0,-1)||wAt(0,1)||!(wAt(-1,0)||wAt(1,0))):true;
      g.save();if(!hor){g.translate(x+C/2,y+C/2);g.rotate(Math.PI/2);g.translate(-x-C/2,-y-C/2)}
      g.fillStyle='rgba(20,40,60,.35)';g.fillRect(x,y+C*.66,C,C*.1);
      g.fillStyle='#8A5A33';g.fillRect(x-1,y+C*.24,C+2,C*.46);
      g.strokeStyle='#5E3B1F';g.lineWidth=1;for(let k=1;k<6;k++)line(g,x+C*k/6,y+C*.24,x+C*k/6,y+C*.7);
      g.fillStyle=SEASON===3?'#F3F6F9':'#A87444';g.fillRect(x-1,y+C*.24,C+2,C*.08);
      g.fillStyle='#5E3B1F';g.fillRect(x-1,y+C*.18,C+2,C*.05);g.fillRect(x-1,y+C*.7,C+2,C*.05);
      for(const px of[.1,.9]){g.fillRect(x+C*px-1.5,y+C*.12,3,C*.12);g.fillRect(x+C*px-1.5,y+C*.7,3,C*.14)}
      g.restore();break}
    case 'markt':{// Marktstand mit gestreiftem Dach, Körben und Fässern
      g.fillStyle=PAL.shadow;ell(g,x+C*.56,y+C*.86,C*.4,C*.08);
      g.fillStyle=PAL.woodD;for(const px of[.12,.84])g.fillRect(x+C*px,y+C*.34,C*.04,C*.5);
      g.fillStyle='#8A5A33';g.fillRect(x+C*.1,y+C*.6,C*.8,C*.1);g.strokeStyle='rgba(40,25,10,.6)';g.lineWidth=1;g.strokeRect(x+C*.1+.5,y+C*.6+.5,C*.8-1,C*.1-1);
      for(let k=0;k<6;k++){g.fillStyle=SEASON===3?(k%2?'#F6F8FA':'#DDE5EC'):(k%2?'#EFE6CF':'#B8452B');poly(g,[x+C*(.06+k*.147),y+C*.36,x+C*(.06+(k+1)*.147),y+C*.36,x+C*(.06+(k+1)*.147)-C*.02,y+C*.2,x+C*(.06+k*.147)+C*.02,y+C*.2])}
      g.strokeStyle='rgba(60,20,10,.5)';line(g,x+C*.06,y+C*.36,x+C*.94,y+C*.36);
      g.fillStyle='#D33B2C';circ(g,x+C*.24,y+C*.57,C*.04);circ(g,x+C*.31,y+C*.57,C*.04);g.fillStyle='#D9B54A';ell(g,x+C*.5,y+C*.58,C*.08,C*.035);g.fillStyle='#8E5A44';circ(g,x+C*.7,y+C*.57,C*.035);
      g.fillStyle='#7A4E2D';rr(g,x+C*.74,y+C*.72,C*.14,C*.14,C*.03);g.fill();g.strokeStyle='#4A3220';g.stroke();line(g,x+C*.74,y+C*.79,x+C*.88,y+C*.79);
      g.fillStyle='#A07850';g.fillRect(x+C*.14,y+C*.74,C*.16,C*.11);break}
    case 'apotheke':{const k=box(g,x,y,C,{w:.56,h:.3,d:.3,wall:'#E8E2D0',roof:'#4F7A55',roofD:'#3C5E41'});
      door(g,k.x0+k.W*.35,k.gy,C);win(g,k.x0+k.W*.62,k.gy-k.H*.72,C);
      const sx2=k.x0+k.W*.8,sy2=k.gy-k.H*.45;g.fillStyle='#F6F2E6';rr(g,sx2-C*.07,sy2-C*.07,C*.14,C*.14,2);g.fill();g.fillStyle='#2F8A4A';g.fillRect(sx2-C*.02,sy2-C*.055,C*.04,C*.11);g.fillRect(sx2-C*.055,sy2-C*.02,C*.11,C*.04);
      if(SEASON!==3)for(const px of[.12,.2]){g.fillStyle='#5DAA43';circ(g,x+C*px,y+C*.84,C*.05);g.fillStyle='#B79BD6';circ(g,x+C*px,y+C*.8,C*.02)}break}
    case 'ruest':{const k=box(g,x,y,C,{w:.62,h:.3,d:.28,wall:PAL.stone,roof:'#5E6E80',roofD:'#46525F'});
      g.strokeStyle='rgba(40,35,25,.35)';g.lineWidth=1;for(let q=1;q<3;q++)line(g,k.x0,k.gy-k.H*q/3,k.x0+k.W,k.gy-k.H*q/3);
      door(g,k.x0+k.W/2,k.gy,C,.15,.19);
      for(const px of[.18,.82]){const sx2=k.x0+k.W*px,sy2=k.gy-k.H*.55;g.fillStyle='#A3302A';poly(g,[sx2-C*.06,sy2-C*.06,sx2+C*.06,sy2-C*.06,sx2+C*.06,sy2+C*.01,sx2,sy2+C*.07,sx2-C*.06,sy2+C*.01]);g.fillStyle=PAL.gold;circ(g,sx2,sy2-C*.01,C*.02)}break}
  }
  g.restore();
  if(!live)return;
  const mk=(col,cross)=>{const mx=x+C*.86,my=y+C*.1;g.fillStyle=col;circ(g,mx,my,C*.11);g.strokeStyle='#fff';g.lineWidth=1.4;g.beginPath();g.arc(mx,my,C*.11,0,7);g.stroke();if(cross)line(g,mx-C*.05,my-C*.05,mx+C*.05,my+C*.05)};
  if(b.cut)mk('#5C6B78',1);else if(d.w&&!b.on)mk('#B3261E');else if(b.winter)mk('#8DB8D6');else if(b.starved)mk('#D98E04');
  if(DARK>.02&&/haus|holzf|baecker|kapelle|kaserne|muehle|schmied|gerber|bogner|ruest|korn|mine|markt|apotheke/.test(t)&&active)glows.push({x:x+C*.5,y:y+C*.62,r:C*1.15,a:.85});
  if(b.burn){flames(g,x,y,C);if(Math.random()<.25)fx((x-ox)/C+.5,(y-oy)/C+.3,'ember',1,true)}
}
function drawEnemy(g,e,C){
  const q=enemyXY(e),x=q.X,y=q.Y,mv=e.tr!=null&&!(e.climb>0);
  if(e.type==='ladder'){// Leiter: beim Klettern an die Mauer gelehnt, sonst auf der Schulter
    g.strokeStyle='#8A6A44';g.lineWidth=Math.max(1,C*.022);
    if(e.climb>0&&e.tr!=null){const tX=sx(e.tc+.5,e.tr+.5),tY=sy(e.tc+.5,e.tr+.5),dx=tX-q.X,dy=tY-q.gy,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
      const bx=q.X+ux*C*.2,by=q.gy+uy*C*.2+C*.1,top=tileLift(e.tr*COLS+e.tc)*C+C*.12,ex=q.X+ux*C*.42,ey=q.gy+uy*C*.42-top,px=-uy*C*.06,py=ux*C*.06;
      line(g,bx+px,by+py,ex+px,ey+py);line(g,bx-px,by-py,ex-px,ey-py);for(let k=1;k<5;k++){const f=k/5;line(g,bx+px+(ex-bx)*f,by+py+(ey-by)*f,bx-px+(ex-bx)*f,by-py+(ey-by)*f)}}
    else{const l0x=x-C*.16,l0y=y+C*.02,l1x=x+C*.14,l1y=y-C*.34;line(g,l0x,l0y,l1x,l1y);line(g,l0x+C*.05,l0y+C*.03,l1x+C*.05,l1y+C*.03);for(let k=1;k<5;k++){const f=k/5;line(g,l0x+(l1x-l0x)*f,l0y+(l1y-l0y)*f,l0x+(l1x-l0x)*f+C*.05,l0y+(l1y-l0y)*f+C*.03)}}
  }
  if(e.type==='wolf'){const fa=e.tr!=null?(TRANS?e.tr-e.r:e.tc-e.c):1,f=fa<0?-1:1,s=mv?Math.sin(now*18)*C*.03:0;g.save();g.translate(x,y);g.scale(f,1);
    g.fillStyle=PAL.shadow;ell(g,0,C*.1,C*.16,C*.04);g.strokeStyle='#4A4440';g.lineWidth=Math.max(1,C*.025);for(const[lx,ph]of[[-.1,1],[-.05,-1],[.06,-1],[.1,1]])line(g,C*lx,C*.02,C*lx+s*ph,C*.1);
    g.fillStyle='#7C7670';ell(g,0,0,C*.14,C*.055);g.fillStyle='#8E8780';poly(g,[C*.1,-C*.03,C*.2,-C*.08,C*.24,-C*.03,C*.2,C*.02,C*.11,C*.03]);
    g.fillStyle='#5E5852';poly(g,[C*.15,-C*.07,C*.17,-C*.13,C*.19,-C*.07]);poly(g,[-C*.13,-C*.01,-C*.24,-C*.06,-C*.14,C*.03]);g.fillStyle='#F2C94C';circ(g,C*.19,-C*.05,C*.012);g.restore();
    if(e.hp<e.max)bar(g,x-C*.2,y-C*.3,C*.4,e.hp/e.max);return}
  if(e.type==='ram'){
    const fa=TRANS?Math.sin(e.ang):Math.cos(e.ang),f=fa<-.2?-1:1;g.save();g.translate(x,y);g.scale(f,1);
    g.fillStyle=PAL.shadow;ell(g,0,C*.14,C*.36,C*.08);
    g.fillStyle='#2B2620';const wob=mv?Math.sin(now*6)*C*.01:0;circ(g,-C*.2,C*.09,C*.07);circ(g,C*.16,C*.09,C*.07);
    g.fillStyle='#7A5232';g.fillRect(-C*.3,-C*.08+wob,C*.56,C*.16);
    g.fillStyle='#9A7048';poly(g,[-C*.32,-C*.08+wob,C*.28,-C*.08+wob,C*.2,-C*.3+wob,-C*.24,-C*.3+wob]);
    g.strokeStyle='rgba(40,25,10,.5)';g.lineWidth=1;for(let k=1;k<4;k++)line(g,-C*.32+C*.15*k,-C*.08+wob,-C*.26+C*.13*k,-C*.3+wob);
    g.fillStyle='#5E3B1F';g.fillRect(C*.2,-C*.04+wob,C*.22,C*.07);g.fillStyle='#777';g.fillRect(C*.38,-C*.06+wob,C*.06,C*.11);
    g.restore();
  }else{
    const fire=e.type==='fire',arch=e.type==='archer',s=mv?Math.sin(now*16)*C*.035:0;
    g.fillStyle=PAL.shadow;ell(g,x,q.gy+C*.1,C*.1,C*.04);
    g.strokeStyle='#2A1C14';g.lineWidth=Math.max(1,C*.03);line(g,x-C*.03,y+C*.02,x-C*.03+s,y+C*.1);line(g,x+C*.03,y+C*.02,x+C*.03-s,y+C*.1);
    g.fillStyle=fire?'#B5541C':arch?'#7E2A3A':'#9E2B25';rr(g,x-C*.07,y-C*.1,C*.14,C*.14,C*.04);g.fill();g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=1;g.stroke();
    g.fillStyle='#F0D2B4';circ(g,x,y-C*.15,C*.055);
    if(fire){g.fillStyle='#3B2A20';g.beginPath();g.arc(x,y-C*.16,C*.065,Math.PI,0);g.fill();
      g.strokeStyle='#6B4423';g.lineWidth=2;line(g,x+C*.07,y-C*.02,x+C*.14,y-C*.2);
      const fl=Math.sin(now*15)*C*.02;g.fillStyle='#FFC23A';poly(g,[x+C*.1,y-C*.2,x+C*.15,y-C*.36+fl,x+C*.19,y-C*.2]);
      lights.push({x:x+C*.15,y:y-C*.25,r:C*.8,a:.35})}
    else if(arch){g.fillStyle='#3B2A20';g.beginPath();g.arc(x,y-C*.16,C*.068,Math.PI,0);g.fill();bow(g,x,y,C,'#4A2E18')}
    else if(e.type==='ladder'){g.fillStyle='#5E4330';g.beginPath();g.arc(x,y-C*.16,C*.062,Math.PI,0);g.fill()}
    else{g.fillStyle='#8C939A';g.beginPath();g.arc(x,y-C*.17,C*.065,Math.PI,0);g.fill();
      g.strokeStyle='#6B4423';g.lineWidth=1.5;line(g,x+C*.1,y+C*.08,x+C*.1,y-C*.32);g.fillStyle='#B8BDC2';poly(g,[x+C*.07,y-C*.32,x+C*.1,y-C*.42,x+C*.13,y-C*.32])}
  }
  if(e.hp<e.max)bar(g,x-C*.25,y-C*.46,C*.5,e.hp/e.max);
}
function draw(dt){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cv.width/dpr,cv.height/dpr);
  if(!S)return;ensure();SEASON=seasonOf(S.day);const tod=timeOfDay();DARK=tod.dark;renderTerrain();
  const C=cell,g=ctx,SCn=scN(),SRn=srN(),MW=SCn*C,MH=SRn*C;lights=[];glows=[];
  g.save();g.shadowColor='rgba(0,0,0,.28)';g.shadowBlur=14;g.shadowOffsetY=3;g.fillStyle=PAL.grass;rr(g,ox,oy,MW,MH,12);g.fill();g.restore();
  g.save();rr(g,ox,oy,MW,MH,12);g.clip();
  g.drawImage(terr,ox,oy,MW,MH);
  // Wasser glitzert
  g.strokeStyle='rgba(255,255,255,.3)';g.lineWidth=1.2;
  if(SEASON!==3)for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(T(r,c).t===WATER&&!T(r,c).b&&sx(c,r)>-C&&sx(c,r)<vw&&sy(c,r)>-C&&sy(c,r)<vh){const h=hash(r,c),x=sx(c,r),wy=sy(c,r)+C*(.4+h*.2)+Math.sin(now*1.5+h*5)*C*.04;
    g.beginPath();g.moveTo(x+C*.25,wy);g.quadraticCurveTo(x+C*.5,wy-C*.08,x+C*.75,wy);g.stroke()}
  // Trampelpfade
  g.save();g.lineCap='round';g.lineJoin='round';g.strokeStyle='rgba(160,128,80,.38)';g.lineWidth=C*.24;
  for(const w of walkers.values()){if(!w.path||w.path.length<2)continue;g.beginPath();w.path.forEach((i,k)=>{const tx=i%COLS+.5,ty=(i/COLS|0)+.5,px=sx(tx,ty),py=sy(tx,ty);k?g.lineTo(px,py):g.moveTo(px,py)});g.stroke()}
  g.restore();
  if(sel&&B[sel]&&!B[sel].tool){const wn=SEASON===3;g.fillStyle=wn?'rgba(40,110,190,.16)':'rgba(255,250,220,.22)';g.strokeStyle=wn?'rgba(40,110,190,.45)':'rgba(255,250,220,.55)';g.lineWidth=1;
    for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(!reason(sel,r,c)){rr(g,sx(c,r)+2,sy(c,r)+2,C-4,C-4,C*.15);g.fill();g.stroke()}}
  // Figuren nach Bildschirmreihen sortieren
  const rows=Array.from({length:SRn},()=>[]);const put=(ry,fn)=>rows[Math.max(0,Math.min(SRn-1,Math.floor(ry)))].push([ry,fn]);
  for(const w of walkers.values()){
    if(!w.path||w.path.length<2)continue;
    const k=Math.min(Math.floor(w.s),w.path.length-2),f=w.s-k,a=w.path[k],b=w.path[k+1];
    const tx=(a%COLS)+((b%COLS)-(a%COLS))*f+.5,ty=(a/COLS|0)+((b/COLS|0)-(a/COLS|0))*f+.5;
    const working=w.st==='work';let X=sx(tx,ty),Y=sy(tx,ty);if(working){X+=C*.3;Y+=C*.36}
    const d=B[w.type],carry=w.st==='go'?Object.keys(d.prod)[0]:null;
    if(working&&dt&&(w.type==='holzf'||w.type==='stein')&&Math.random()<dt*3){fx((X-ox)/C,(Y-oy)/C-.1,w.type==='holzf'?'chip':'dust',1,true);if(X>0&&X<vw&&Y>0&&Y<vh)AU.play(w.type==='holzf'?'holz':'steinbruch',.35*Math.min(1,zoom/1.6))}
    put((Y-oy)/C,()=>person(g,X,Y+(working?-Math.abs(Math.sin(now*6))*C*.04:0),C,d.col,carry,!working,'#6B4A2A'));
  }
  for(const p of wanderers){const mv=Math.hypot(p.tx-p.x,p.ty-p.y)>.05,X=sx(p.x,p.y),Y=sy(p.x,p.y);put((Y-oy)/C,()=>person(g,X,Y,C,'#8C6F9E',null,mv,null))}
  for(const e of S.enemies)if(e.wait<=0)put((enemyXY(e).gy-oy)/C+(enemyLift(e)>0?.01:0),()=>drawEnemy(g,e,C));
  layoutUnits();
  for(const u of S.units){const q=unitXY(u),on=picked.has(u.id),f=(ufc.get(u.id)||{f:1}).f;put((q.gy-oy)/C+(unitLift(u)>0?.01:0),()=>drawUnit(g,u,C,q.X,q.Y,on,f))}
  const nbAt=(r,c)=>(dsr,dsc)=>{const r2=r+(TRANS?dsc:dsr),c2=c+(TRANS?dsr:dsc);if(!inb(r2,c2))return false;const b=T(r2,c2).b;return !!(b&&isWall(b))};// Mauern verbinden sich nicht mit dem Bergfried
  // Nur sichtbare Reihen und Spalten zeichnen (mit Rand für hohe Gebäude und den Bergfried)
  const sc0=Math.max(0,Math.floor(-ox/C)-1),sc1=Math.min(SCn-1,Math.ceil((vw-ox)/C)+1),sr0=Math.max(0,Math.floor(-oy/C)-1),sr1=Math.min(SRn-1,Math.ceil((vh-oy)/C)+2);
  let keepAt=null;
  for(let sr=sr0;sr<=sr1;sr++){
    for(let sc=sc0;sc<=sc1;sc++){const r=TRANS?sc:sr,c=TRANS?sr:sc,t=T(r,c),x=ox+sc*C,y=oy+sr*C;
      if(t.t===TREE)drawTree(g,x,y,C,hash(r,c));else if(t.t===ROCK||t.t===IRON)drawRock(g,x,y,C,hash(r,c),t.t===IRON);
      if(t.b){if(t.b.type==='keep'||t.b.type==='fkeep')keepAt=[x,y,t.b,r,c];else drawB(g,x,y,C,t.b,nbAt(r,c),r,c,true)}}
    // Der Bergfried ist breiter als ein Feld: erst nach den übrigen Gebäuden seiner Reihe zeichnen, damit Mauern daneben nicht hineinragen
    if(keepAt){if(keepAt[2].type==='keep')drawKeep(g,keepAt[0],keepAt[1],C);else drawB(g,keepAt[0],keepAt[1],C,keepAt[2],()=>false,keepAt[3],keepAt[4],true);keepAt=null}
    rows[sr].sort((a,b)=>a[0]-b[0]).forEach(a=>a[1]());
  }
  // Partikel (in Bildschirmfeldern)
  for(const p of parts){p.life+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.kind==='chip')p.vy+=3*dt}
  parts=parts.filter(p=>p.life<p.max);
  for(const p of parts){const k=p.life/p.max,px=ox+p.x*C,py=oy+p.y*C;
    if(p.kind==='dust'){g.fillStyle=`rgba(175,155,125,${.55*(1-k)})`;circ(g,px,py,C*(.06+k*.12))}
    else if(p.kind==='smoke'){g.fillStyle=`rgba(125,125,125,${.38*(1-k)})`;circ(g,px,py,C*(.07+k*.2))}
    else if(p.kind==='ember'){g.fillStyle=`rgba(255,170,60,${1-k})`;circ(g,px,py,C*.025)}
    else{g.fillStyle='#C9A06A';g.fillRect(px,py,2,2)}}
  // Pfeile im Bogen
  // Höhe von Schütze und Ziel (Mauer, Turm, Bergfried) wird auf dem Bildschirm nach oben abgetragen
  for(const a of arrows){const dur=a.kind==='stone'?.6:.18;if(a.t>dur+.02)continue;const p=Math.min(1,a.t/dur);
    const x1=TRANS?a.y1:a.x1,y1=(TRANS?a.x1:a.y1)-a.l1-.25,x2=TRANS?a.y2:a.x2,y2=(TRANS?a.x2:a.y2)-a.l2-.12;
    const ax=x1+(x2-x1)*p,ay=y1+(y2-y1)*p-Math.sin(Math.PI*p)*.5;
    const dx=x2-x1,dy=(y2-y1)-Math.cos(Math.PI*p)*.5*Math.PI,an=Math.atan2(dy,dx),L=C*.2;
    const hx=ox+ax*C,hy=oy+ay*C;if(a.kind==='stone'){g.fillStyle='#6E6C65';circ(g,hx,hy-Math.sin(Math.PI*p)*C*.4,C*.07);continue}
    g.strokeStyle=a.foe?'#4A1410':'#3B2A1A';g.lineWidth=1.4;line(g,hx-Math.cos(an)*L,hy-Math.sin(an)*L,hx,hy);
    g.strokeStyle=a.foe?'#D04A3A':'#EDE4CC';line(g,hx-Math.cos(an)*L,hy-Math.sin(an)*L,hx-Math.cos(an)*L*.7,hy-Math.sin(an)*L*.7)}
  drawOrders(g,C,dt);
  // Wetter
  if(SEASON===3||SEASON===2){const want=Math.round((SEASON===3?90:14)*SCn*SRn/240*Q().weather);while(weather.length<want)weather.push({x:Math.random()*SCn,y:Math.random()*SRn,s:.5+Math.random(),p:Math.random()*6});weather.length=want;
    for(const f of weather){if(SEASON===3){f.y+=dt*(.5+f.s*.4);f.x+=Math.sin(now+f.p)*dt*.25}else{f.y+=dt*.45;f.x+=Math.sin(now*1.5+f.p)*dt*.6}
      if(f.y>SRn){f.y=0;f.x=Math.random()*SCn}if(f.x<0)f.x+=SCn;if(f.x>SCn)f.x-=SCn;const px=ox+f.x*C,py=oy+f.y*C;
      if(SEASON===3){g.fillStyle='rgba(255,255,255,.85)';circ(g,px,py,1+f.s)}else{g.save();g.translate(px,py);g.rotate(now*2+f.p);g.fillStyle=AUT[Math.floor(f.p)%3][1];g.fillRect(-3,-1.5,6,3);g.restore()}}}
  else weather.length=0;
  // Nacht
  if(tod.dusk>.02){g.fillStyle=`rgba(255,120,40,${.13*tod.dusk})`;g.fillRect(ox,oy,MW,MH)}
  nightPass(g,DARK);
  // Licht
  if(lights.length&&Q().light){g.globalCompositeOperation='lighter';for(const l of lights){const gr=g.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r);gr.addColorStop(0,`rgba(255,140,50,${l.a})`);gr.addColorStop(1,'rgba(255,140,50,0)');g.fillStyle=gr;g.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2)}g.globalCompositeOperation='source-over'}
  // Angriffsrichtung (als Bildschirmrand)
  if(S.raidSide){const al=.35+Math.sin(now*4)*.12,s2=dispSide(S.raidSide),D=C*1.3;let gr;
    if(s2==='Norden')gr=g.createLinearGradient(0,oy,0,oy+D);if(s2==='Süden')gr=g.createLinearGradient(0,oy+MH,0,oy+MH-D);
    if(s2==='Westen')gr=g.createLinearGradient(ox,0,ox+D,0);if(s2==='Osten')gr=g.createLinearGradient(ox+MW,0,ox+MW-D,0);
    gr.addColorStop(0,`rgba(190,40,30,${al})`);gr.addColorStop(1,'rgba(190,40,30,0)');g.fillStyle=gr;g.fillRect(ox,oy,MW,MH)}
  if(S.enemies.some(e=>!e.def)){g.fillStyle='rgba(110,30,10,.07)';g.fillRect(ox,oy,MW,MH)}
  const vg=g.createRadialGradient(ox+MW/2,oy+MH/2,Math.min(MW,MH)*.45,ox+MW/2,oy+MH/2,Math.hypot(MW,MH)*.6);
  vg.addColorStop(0,'rgba(20,25,10,0)');vg.addColorStop(1,'rgba(20,25,10,.3)');g.fillStyle=vg;g.fillRect(ox,oy,MW,MH);
  g.restore();
}
// Befehle sichtbar machen: Ziele der ausgewählten Truppen, angegriffene Feinde, frische Befehle, Auswahlrahmen
function drawOrders(g,C,dt){
  if(picked.size){const dests=new Set(),foes=new Set();
    const bts=new Set();for(const u of S.units){if(!picked.has(u.id))continue;if(u.tgtB!=null)bts.add(u.tgtB);else if(u.tgt)foes.add(u.tgt);else if(u.dest!=null)dests.add(u.dest)}
    for(const i of bts){const X=sx(i%COLS+.5,(i/COLS|0)+.5),Y=sy(i%COLS+.5,(i/COLS|0)+.5);g.strokeStyle='rgba(229,83,75,.95)';g.lineWidth=2.5;g.setLineDash([5,4]);g.strokeRect(X-C*.48,Y-C*.85,C*.96,C*1.3);g.setLineDash([])}
    g.strokeStyle='rgba(255,213,74,.9)';g.lineWidth=1.5;
    for(const i of dests){const tx=i%COLS+.5,ty=(i/COLS|0)+.5,X=sx(tx,ty),Y=sy(tx,ty)-tileLift(i)*C;g.beginPath();g.ellipse(X,Y+C*.08,C*.22,C*.09,0,0,7);g.stroke()}
    for(const e of foes){if(!S.enemies.includes(e))continue;const q=enemyXY(e);g.strokeStyle='rgba(229,83,75,.95)';g.lineWidth=2;g.beginPath();g.ellipse(q.X,q.Y+C*.08,C*.2,C*.08,0,0,7);g.stroke();
      line(g,q.X-C*.26,q.Y+C*.08,q.X-C*.16,q.Y+C*.08);line(g,q.X+C*.16,q.Y+C*.08,q.X+C*.26,q.Y+C*.08)}}
  for(const m of marks){m.t+=dt||.016;const k=m.t/.6;if(k>=1)continue;const tx=m.i%COLS+.5,ty=(m.i/COLS|0)+.5,X=sx(tx,ty),Y=sy(tx,ty)-tileLift(m.i)*C+C*.08;
    g.strokeStyle=m.foe?`rgba(229,83,75,${1-k})`:`rgba(255,213,74,${1-k})`;g.lineWidth=2.5;g.beginPath();g.ellipse(X,Y,C*(.15+k*.3),C*(.06+k*.12),0,0,7);g.stroke()}
  marks=marks.filter(m=>m.t<.6);
  if(boxR){const x=Math.min(boxR.x0,boxR.x1),y=Math.min(boxR.y0,boxR.y1),w=Math.abs(boxR.x1-boxR.x0),h=Math.abs(boxR.y1-boxR.y0);
    g.fillStyle='rgba(255,213,74,.14)';g.fillRect(x,y,w,h);g.save();g.setLineDash([6,4]);g.strokeStyle='rgba(255,213,74,.95)';g.lineWidth=1.5;g.strokeRect(x+.5,y+.5,w,h);g.restore()}
}
const iconCache={};
function makeIcon(k){
  if(/^keep\d$/.test(k)){if(iconCache[k])return iconCache[k];const keepS=SEASON,keepD=DARK;SEASON=1;DARK=0;
    const s2=96,cn=document.createElement('canvas');cn.width=s2;cn.height=s2;const g=cn.getContext('2d'),C=40;drawKeep(g,(s2-C)/2,(s2-C)/2+6,C,+k[4]);SEASON=keepS;DARK=keepD;return iconCache[k]=cn.toDataURL()}
  if(k==='berater'){if(iconCache[k])return iconCache[k];const cn=document.createElement('canvas');cn.width=cn.height=72;const g=cn.getContext('2d'),c=36;
    // Berater: rundes Gesicht, grauer Bart, blaue Kappe mit goldener Feder
    g.fillStyle='#2E5A88';g.beginPath();g.arc(c,c+30,26,Math.PI,0);g.fill();g.fillStyle=PAL.gold;g.fillRect(c-3,c+8,6,20);
    g.fillStyle='#F1D3B5';circ(g,c,c-2,17);g.fillStyle='#D9D4CC';g.beginPath();g.moveTo(c-15,c+2);g.quadraticCurveTo(c,c+30,c+15,c+2);g.quadraticCurveTo(c,c+10,c-15,c+2);g.fill();
    g.fillStyle='#3B2A1A';circ(g,c-6,c-5,2.2);circ(g,c+6,c-5,2.2);g.strokeStyle='#A07A5A';g.lineWidth=1.5;g.beginPath();g.arc(c,c+3,4,.2,Math.PI-.2);g.stroke();
    g.fillStyle='#E9A08A';circ(g,c-10,c+1,3);circ(g,c+10,c+1,3);
    g.fillStyle='#1F4E79';g.beginPath();g.ellipse(c,c-15,19,9,0,Math.PI,0);g.fill();g.fillRect(c-19,c-16,38,5);g.fillStyle=PAL.gold;g.fillRect(c-19,c-13,38,2);
    g.strokeStyle=PAL.gold;g.lineWidth=3;g.beginPath();g.moveTo(c+10,c-17);g.quadraticCurveTo(c+24,c-30,c+28,c-36);g.stroke();
    return iconCache[k]=cn.toDataURL()}
  if(/^unit:/.test(k)){if(iconCache[k])return iconCache[k];const t=k.slice(5),s2=64,cn=document.createElement('canvas');cn.width=s2;cn.height=s2;const g=cn.getContext('2d'),C=t==='knight'?118:132;
    drawUnit(g,{type:t,hp:1,max:1,path:[]},C,s2/2-(t==='knight'?4:6),s2*.82,false);return iconCache[k]=cn.toDataURL()}
  if(iconCache[k])return iconCache[k];const keepS=SEASON,keepD=DARK;SEASON=1;DARK=0;
  const s=80,cn=document.createElement('canvas');cn.width=s;cn.height=s;const g=cn.getContext('2d'),C=48,x=(s-C)/2,y=(s-C)/2+(B[k].wall?12:4);
  drawB(g,x,y,C,{type:k,on:true,hp:B[k].hp||40,max:B[k].hp||40},()=>false,0,0,false);
  SEASON=keepS;DARK=keepD;
  return iconCache[k]=cn.toDataURL();
}


function timeOfDay(){
  const p=(((S.day-1)+S.clock/DAY)/CYC+.12)%1,nc=-Math.cos(2*Math.PI*(p-.4));
  const dark=Math.max(0,Math.min(1,(nc-.3)/.6)),dusk=Math.max(0,1-Math.abs(nc-.18)/.3)*(1-dark);
  const label=p>=.72||p<.08?['🌙','Nacht']:p<.28?['🌅','Morgen']:p<.52?['🌞','Mittag']:['🌇','Abend'];
  return{p,dark,dusk,label};
}
function nightPass(g,amount){
  if(amount<.02)return;
  if(!Q().light){g.fillStyle=`rgba(8,14,44,${.4*amount})`;g.fillRect(ox,oy,scN()*cell,srN()*cell);return}
  if(!dk||dk.width!==cv.width||dk.height!==cv.height){dk=document.createElement('canvas');dk.width=cv.width;dk.height=cv.height;dkg=dk.getContext('2d')}
  dkg.setTransform(1,0,0,1,0,0);dkg.globalCompositeOperation='source-over';dkg.clearRect(0,0,dk.width,dk.height);
  dkg.setTransform(dpr,0,0,dpr,0,0);dkg.fillStyle=`rgba(8,14,44,${.48*amount})`;dkg.fillRect(ox,oy,scN()*cell,srN()*cell);
  dkg.globalCompositeOperation='destination-out';
  const all=glows.concat(lights.map(l=>({x:l.x,y:l.y,r:l.r*1.3,a:.95})));
  for(const l of all){const gr=dkg.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r);gr.addColorStop(0,`rgba(0,0,0,${l.a})`);gr.addColorStop(1,'rgba(0,0,0,0)');dkg.fillStyle=gr;dkg.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2)}
  g.save();g.setTransform(1,0,0,1,0,0);g.drawImage(dk,0,0);g.restore();
  if(Q().light<2)return;
  g.globalCompositeOperation='lighter';
  for(const l of glows){const gr=g.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r*.8);gr.addColorStop(0,`rgba(255,170,80,${.28*amount})`);gr.addColorStop(1,'rgba(255,170,80,0)');g.fillStyle=gr;g.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2)}
  g.globalCompositeOperation='source-over';
}

// ---------- Leben im Dorf (rein optisch) ----------
function updateLife(dt){
  const active=new Set();
  S.grid.forEach((t,i)=>{const b=t.b;if(!b||!b.on||b.cut||!B[b.type].prod)return;active.add(b.id);
    let w=walkers.get(b.id);
    if(!w||w.gv!==S.gv){w={gv:S.gv,path:pathFrom(i),s:0,st:'work',tm:Math.random()*2.5,type:b.type};walkers.set(b.id,w)}
    if(!w.path||w.path.length<2)return;
    const end=w.path.length-1.55;
    if(w.st==='work'){w.tm-=dt;if(w.tm<=0)w.st='go'}
    else if(w.st==='go'){w.s+=dt*1.4;if(w.s>=end){w.s=end;w.st='back'}}
    else{w.s-=dt*1.7;if(w.s<=0){w.s=0;w.st='work';w.tm=2+Math.random()}}
  });
  for(const k of [...walkers.keys()])if(!active.has(k))walkers.delete(k);
  const want=Math.min(Math.max(0,S.idle),6);
  while(wanderers.length<want)wanderers.push({x:KC+.5,y:KR+1.5,tx:KC+.5,ty:KR+1.5,wait:Math.random()*2});
  wanderers.length=want;
  for(const p of wanderers){
    const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy);
    if(d<.05){p.wait-=dt;if(p.wait<=0){for(let k=0;k<8;k++){const r=KR+Math.floor(Math.random()*5)-2,c=KC+Math.floor(Math.random()*5)-2;if(inb(r,c)&&reach[r*COLS+c]&&!isWall(T(r,c).b)&&!(r===KR&&c===KC)){p.tx=c+.2+Math.random()*.6;p.ty=r+.2+Math.random()*.6;break}}p.wait=1+Math.random()*3}}
    else{const sp=Math.min(d,.6*dt);p.x+=dx/d*sp;p.y+=dy/d*sp}
  }
}
function resetView(){arrows=[];sel=null;walkers=new Map();wanderers=[];parts=[];weather=[];picked=new Set();boxR=null;marks=[];ufc.clear()}
H.fx=(tx,ty,kind,n)=>fx(tx,ty,kind,n);
H.shot=(x1,y1,x2,y2,foe,l1,l2,kind)=>{arrows.push({x1,y1,x2,y2,foe:!!foe,l1:l1||0,l2:l2||0,t:0,kind});AU.play(kind==='stone'?'ramme':'pfeil',.6)};
H.sfx=n=>AU.play(n);
H.side=s=>dispSide(s);
