// Zinnenwerk – Spieldaten (reine Daten, kein DOM). Alle Zahlenwerte sind in docs/DESIGN.md dokumentiert.
// Kartengröße: logisch COLS × ROWS, Bergfried bei (KR, KC). Wird pro Mission über setMapSize() gesetzt.
let COLS=12,ROWS=20,N=COLS*ROWS,KR=11,KC=5,KI=KR*COLS+KC;
function setMapSize(cols,rows,kr,kc){COLS=cols;ROWS=rows;N=cols*rows;KR=kr;KC=kc;KI=kr*cols+kc}
const SEAS=[['🌸','Frühling'],['☀️','Sommer'],['🍂','Herbst'],['❄️','Winter']],SLEN=6,CYC=6;
const seasonOf=d=>Math.floor((d-1)/SLEN)%4;
const GRASS=0,TREE=1,ROCK=2,WATER=3;
const DAY=4,SAVE='zinnenwerk-v3',PROG='zinnenwerk-progress';
const RES=[['holz','🪵'],['stein','🪨'],['weizen','🌾'],['mehl','🫙'],['brot','🍞'],['aepfel','🍎'],['gold','💰']];
const RICON=Object.fromEntries(RES);
const RNAME={holz:'Holz',stein:'Stein',weizen:'Weizen',mehl:'Mehl',brot:'Brot',aepfel:'Äpfel',gold:'Gold'};
const B={
  haus:{n:'Hütte',i:'🏠',cost:{holz:6},cap:8,d:'Platz für 8 Leute.'},
  holzf:{n:'Holzfäller',i:'🪓',cost:{holz:3},w:1,prod:{holz:3},near:TREE,r:2,col:'#7A4E2D',d:'3 Holz pro Tag. Muss nah am Wald stehen.'},
  obst:{n:'Obstgarten',i:'🍎',cost:{holz:5},w:1,prod:{aepfel:3},col:'#3F7A3A',d:'3 Äpfel pro Tag.'},
  farm:{n:'Weizenhof',i:'🌾',cost:{holz:10},w:1,prod:{weizen:4},col:'#B8901C',d:'4 Weizen pro Tag, für die Mühle.'},
  muehle:{n:'Mühle',i:'⚙️',cost:{holz:15},w:1,use:{weizen:4},prod:{mehl:4},col:'#D9D2BE',d:'Mahlt 4 Weizen zu 4 Mehl.'},
  baecker:{n:'Bäckerei',i:'🥖',cost:{holz:10},w:1,use:{mehl:4},prod:{brot:10},col:'#D9D2BE',d:'Backt aus 4 Mehl 10 Brot.'},
  stein:{n:'Steinbruch',i:'⛏️',cost:{holz:8},w:2,prod:{stein:3},near:ROCK,r:1,col:'#6F6F78',d:'3 Stein pro Tag. Muss direkt an Felsen stehen.'},
  brunnen:{n:'Brunnen',i:'🪣',cost:{holz:4,stein:4},nofire:1,d:'Löscht Brände im Umkreis von 3 Feldern.'},
  kapelle:{n:'Kapelle',i:'⛪',cost:{stein:8,gold:30},d:'+2 Beliebtheit pro Tag (bis zu 3 Kapellen).'},
  mauer:{n:'Mauer',cost:{stein:1},wall:1,hp:30,drag:1,d:'Mit dem Finger ziehen. Deine Leute kommen nicht hindurch.'},
  tor:{n:'Tor',cost:{holz:4,stein:8},wall:1,gate:1,hp:150,d:'Lässt deine Leute durch, Feinde nicht. Sehr stabil.'},
  turm:{n:'Turm',cost:{stein:10},wall:1,hp:90,d:'Hält 3 Bogenschützen mit großer Reichweite.'},
  kaserne:{n:'Kaserne',i:'🛡️',cost:{holz:10,stein:6},d:'Erlaubt Bogenschützen im Hof.'},
  abriss:{n:'Abreißen',i:'✖️',cost:{},drag:1,tool:1,d:'Tippe oder ziehe über Gebäude. Du bekommst die Hälfte zurück.'}
};
const TAX=[{n:'Geschenk',g:-0.4,p:3},{n:'Keine',g:0,p:1},{n:'Niedrig',g:0.6,p:-2},{n:'Mittel',g:1,p:-4},{n:'Hoch',g:1.5,p:-7}];
const RAT=[{n:'Keine',r:0,p:-8},{n:'Halb',r:0.15,p:-4},{n:'Normal',r:0.3,p:0},{n:'Doppelt',r:0.6,p:4}];
const ETYPE={
  raider:{n:'Räuber',hpM:1,spd:1.1,dmg:3,armor:1},
  fire:{n:'Brandstifter',hpM:.7,spd:1.3,dmg:2,armor:1},
  ram:{n:'Rammbock',hpM:3.5,spd:.45,dmg:14,armor:.34}
};
const BASE={holz:40,stein:0,weizen:0,mehl:0,brot:0,aepfel:15,gold:60};
const MISSIONS=[
  {n:'Ein neuer Anfang',s:'Der König hat dir ein Stück Land überlassen. Noch droht keine Gefahr. Baue ein Dorf auf, in dem die Leute gerne leben.',
   seed:1201,res:{...BASE},pop:10,goals:[['pop',24]],raid:null},
  {n:'Brot für alle',s:'Äpfel allein machen niemanden satt. Baue die Brotkette aus Weizenhof, Mühle und Bäckerei auf. Eine kleine Bande treibt sich herum.',
   seed:3307,res:{...BASE,holz:60,aepfel:20},pop:14,goals:[['brot',40]],raid:{start:10,every:9,fire:99,ram:99,scale:.6}},
  {n:'Steinerne Wacht',s:'Räuber ziehen durch das Tal. Baue Mauern und Türme und wehre drei Angriffe ab. Denk an ein Tor, sonst kommen deine Leute nicht mehr hinaus.',
   seed:4411,res:{...BASE,holz:50,stein:20,aepfel:20,gold:80},pop:14,goals:[['raids',3]],raid:{start:7,every:6,fire:99,ram:99,scale:1}},
  {n:'Flammen im Tal',s:'Die Räuber haben Fackelträger dabei. Brunnen löschen Brände in der Nähe, und du kannst brennende Häuser antippen, um sie für 2 Gold zu löschen.',
   seed:5519,res:{...BASE,holz:60,stein:20,aepfel:20,gold:100},pop:16,goals:[['raids',4],['pp',50]],raid:{start:7,every:6,fire:1,ram:99,scale:1}},
  {n:'Die Belagerung',s:'Ein Heer mit Rammböcken rückt an. Pfeile richten gegen sie wenig aus, aber ein starkes Tor und dicke Mauern bremsen sie lange genug.',
   seed:6623,res:{...BASE,holz:80,stein:40,brot:10,aepfel:20,gold:150},pop:18,goals:[['raids',5]],raid:{start:8,every:5,fire:2,ram:2,scale:1.2}}
];
const FREE={n:'Freies Spiel',s:'Endlose Angriffe auf einer zufälligen Karte. Wie lange hält deine Burg?',res:{...BASE,brot:5},pop:10,goals:[],raid:{start:8,every:7,fire:3,ram:5,scale:1}};
const GOALTXT={pop:['👥','Einwohner'],brot:['🍞','Brot auf Vorrat'],raids:['⚔️','Angriffe abgewehrt'],pp:['❤️','Beliebtheit am Ende']};
