// Zinnenwerk – Spieldaten (reine Daten, kein DOM). Alle Zahlenwerte sind in docs/DESIGN.md dokumentiert.
// Kartengröße: logisch COLS × ROWS, Bergfried bei (KR, KC). Wird pro Mission über setMapSize() gesetzt.
let COLS=12,ROWS=20,N=COLS*ROWS,KR=11,KC=5,KI=KR*COLS+KC;
function setMapSize(cols,rows,kr,kc){COLS=cols;ROWS=rows;N=cols*rows;KR=kr;KC=kc;KI=kr*cols+kc}
const SEAS=[['🌸','Frühling'],['☀️','Sommer'],['🍂','Herbst'],['❄️','Winter']],SLEN=6,CYC=6;
const seasonOf=d=>Math.floor((d-1)/SLEN)%4;
const GRASS=0,TREE=1,ROCK=2,WATER=3;
const DAY=4,SAVE='zinnenwerk-v3',AUTO='zinnenwerk-auto',SLOT='zinnenwerk-slot-',PROG='zinnenwerk-progress',SETTINGS='zinnenwerk-settings';
const RES=[['holz','🪵'],['stein','🪨'],['weizen','🌾'],['mehl','🫙'],['brot','🍞'],['aepfel','🍎'],['gold','💰'],
  ['eisen','⛓️'],['haeute','🐄'],['bogen','🏹'],['speer','🔱'],['schwert','🗡️'],['leder','🦺']];
const RICON=Object.fromEntries(RES);
const RNAME={holz:'Holz',stein:'Stein',weizen:'Weizen',mehl:'Mehl',brot:'Brot',aepfel:'Äpfel',gold:'Gold',
  eisen:'Eisen',haeute:'Häute',bogen:'Bögen',speer:'Speere',schwert:'Schwerter',leder:'Lederrüstungen'};
// Lagerart je Rohstoff: Lager (Rohstoffe), Kornkammer (Essen), Rüstkammer (Waffen). Gold ist unbegrenzt.
const STORE={holz:'lager',stein:'lager',eisen:'lager',weizen:'lager',mehl:'lager',haeute:'lager',brot:'korn',aepfel:'korn',bogen:'waffen',speer:'waffen',schwert:'waffen',leder:'waffen'};
const STORE_NAME={lager:'Lager',korn:'Kornkammer',waffen:'Rüstkammer'};
// Grundkapazität je Rohstoff (hängt von der Burgstufe ab) und Zuwachs je Lagergebäude
const STORE_ADD={lager:100,korn:80,waffen:20};
// Burgstufen: Lebenspunkte, Grundbevölkerung (Platz ohne Hütten), Wachen (schießen immer), Grundlager, Ausbaukosten
const KEEP_LV=[
  {n:'Holzburg',hp:150,pop:12,guards:2,store:{lager:100,korn:60,waffen:6},cost:null},
  {n:'Steinburg',hp:300,pop:20,guards:3,store:{lager:150,korn:90,waffen:10},cost:{holz:30,stein:60,gold:80}},
  {n:'Festung',hp:500,pop:28,guards:5,store:{lager:220,korn:130,waffen:15},cost:{stein:120,eisen:30,gold:180}}
];
const B={
  haus:{n:'Hütte',i:'🏠',cost:{holz:6},cap:8,d:'Platz für 8 Leute.'},
  holzf:{n:'Holzfäller',i:'🪓',cost:{holz:3},w:1,prod:{holz:3},near:TREE,r:2,col:'#7A4E2D',d:'3 Holz pro Tag. Muss nah am Wald stehen.'},
  obst:{n:'Obstgarten',i:'🍎',cost:{holz:5},w:1,prod:{aepfel:3},col:'#3F7A3A',d:'3 Äpfel pro Tag.'},
  farm:{n:'Weizenhof',i:'🌾',cost:{holz:10},w:1,prod:{weizen:4},col:'#B8901C',d:'4 Weizen pro Tag, für die Mühle.'},
  muehle:{n:'Mühle',i:'⚙️',cost:{holz:15},w:1,use:{weizen:4},prod:{mehl:4},col:'#D9D2BE',tier:1,d:'Mahlt 4 Weizen zu 4 Mehl.'},
  baecker:{n:'Bäckerei',i:'🥖',cost:{holz:10},w:1,use:{mehl:4},prod:{brot:10},col:'#D9D2BE',tier:2,d:'Backt aus 4 Mehl 10 Brot.'},
  stein:{n:'Steinbruch',i:'⛏️',cost:{holz:8},w:2,prod:{stein:3},near:ROCK,r:1,col:'#6F6F78',d:'3 Stein pro Tag. Muss direkt an Felsen stehen.'},
  brunnen:{n:'Brunnen',i:'🪣',cost:{holz:4,stein:4},nofire:1,d:'Löscht Brände im Umkreis von 3 Feldern.'},
  kapelle:{n:'Kapelle',i:'⛪',cost:{stein:8,gold:30},d:'+2 Beliebtheit pro Tag (bis zu 3 Kapellen).'},
  mauer:{n:'Mauer',cost:{stein:1},wall:1,hp:30,drag:1,d:'Mit dem Finger ziehen. Deine Leute kommen nicht hindurch.'},
  tor:{n:'Tor',cost:{holz:4,stein:8},wall:1,gate:1,hp:150,d:'Lässt deine Leute durch, Feinde nicht. Sehr stabil.'},
  turm:{n:'Turm',cost:{stein:10},wall:1,hp:90,d:'Platz für 3 Truppen. Bogenschützen schießen von hier besonders weit.'},
  kaserne:{n:'Kaserne',i:'🛡️',cost:{holz:10,stein:6},d:'Erlaubt das Ausbilden von Truppen im Hof.'},
  lager:{n:'Lager',cost:{holz:12},store:'lager',d:'+100 Platz je Rohstoff (Holz, Stein, Eisen, Weizen, Mehl, Häute).'},
  korn:{n:'Kornkammer',cost:{holz:10,stein:4},store:'korn',d:'+80 Platz für Brot und Äpfel.'},
  mine:{n:'Eisenmine',cost:{holz:15,stein:5},w:2,prod:{eisen:2},near:ROCK,r:1,col:'#7A5A4A',d:'2 Eisen pro Tag. Muss direkt an Felsen stehen.'},
  weide:{n:'Viehweide',cost:{holz:8},w:1,prod:{haeute:2},col:'#8A6A44',d:'2 Häute pro Tag. Im Winter weniger (1).'},
  gerber:{n:'Gerberei',cost:{holz:12},w:1,use:{haeute:2},prod:{leder:1},col:'#6E4A2A',tier:2,d:'Macht aus 2 Häuten 1 Lederrüstung.'},
  bogner:{n:'Bogenmacher',cost:{holz:12},w:1,use:{holz:2},prod:{bogen:1},col:'#6B4A2A',tier:2,d:'Schnitzt aus 2 Holz 1 Bogen.'},
  schmied:{n:'Schmied',cost:{holz:10,stein:10},w:1,modes:{speer:{use:{eisen:1,holz:1},prod:{speer:1}},schwert:{use:{eisen:2},prod:{schwert:1}}},mode:'speer',col:'#3A3A42',tier:2,d:'Schmiedet Speere (1 Eisen + 1 Holz) oder Schwerter (2 Eisen). Antippen zum Umstellen.'},
  ruest:{n:'Rüstkammer',cost:{holz:8,stein:12},store:'waffen',d:'+20 Platz je Waffenart. Ohne Rüstkammer passen nur wenige Waffen in den Bergfried.'},
  abriss:{n:'Abreißen',i:'✖️',cost:{},drag:1,tool:1,d:'Tippe oder ziehe über Gebäude. Du bekommst die Hälfte zurück.'}
};
const TAX=[{n:'Geschenk',g:-0.4,p:3},{n:'Keine',g:0,p:1},{n:'Niedrig',g:0.5,p:-2},{n:'Mittel',g:0.8,p:-4},{n:'Hoch',g:1.2,p:-7}];
const RAT=[{n:'Keine',r:0,p:-8},{n:'Halb',r:0.15,p:-4},{n:'Normal',r:0.3,p:0},{n:'Doppelt',r:0.6,p:4}];
// Feinde: LP-Faktor, Tempo, Schaden pro Sekunde, Rüstung (Faktor auf erlittenen Schaden).
// range: Fernkämpfer (schießt auf Truppen, sonst auf den Bergfried), climb: Sekunden zum Überwinden einer Mauer.
const ETYPE={
  raider:{n:'Räuber',pl:'Räuber',hpM:1,spd:1.1,dmg:3,armor:1},
  fire:{n:'Brandstifter',pl:'Brandstifter',hpM:.7,spd:1.3,dmg:2,armor:1},
  ram:{n:'Rammbock',pl:'Rammböcke',hpM:3.5,spd:.45,dmg:14,armor:.34},
  archer:{n:'feindlicher Bogenschütze',pl:'feindliche Bogenschützen',hpM:.8,spd:1,dmg:2,armor:1,range:3.5},
  ladder:{n:'Leitermann',pl:'Leitermänner',hpM:.9,spd:1.1,dmg:2,armor:1,climb:2.5}
};
// Sold: Gold pro Bogenschütze und Tag. Ausbildung kostet ARCHER_GOLD.
const WAVE_GOLD=10,KILL_GOLD=2,RAM_GOLD=6,SOLD=1,ARCHER_GOLD=12;
// Eigene Truppen: Kosten (Gold + Waffen), Sold pro Tag, Lebenspunkte, Tempo (Felder/s), Schaden pro Schlag,
// Schläge pro Sekunde, Reichweite (Fernkampf: range, Nahkampf: reach), Rüstung (Faktor auf erlittenen Schaden),
// vsRam: Schadensfaktor gegen Rammböcke.
const UNIT={
  archer:{n:'Bogenschütze',pl:'Bogenschützen',i:'🏹',gold:ARCHER_GOLD,need:{bogen:1},sold:1,hp:10,spd:1.2,dmg:3,rate:1,range:3.2,armor:1,col:'#2E5A88',d:'Schießt von Mauern und Türmen weiter.'},
  spear:{n:'Speerträger',pl:'Speerträger',i:'🔱',gold:8,need:{speer:1},sold:1,hp:16,spd:1.1,dmg:3,rate:1,reach:1.15,vsRam:3,armor:.9,col:'#6B7A3A',d:'Günstig, kurze Reichweite, dreifacher Schaden gegen Rammböcke.'},
  sword:{n:'Schwertkämpfer',pl:'Schwertkämpfer',i:'🗡️',gold:15,need:{schwert:1,leder:1},sold:2,hp:26,spd:.85,dmg:6,rate:1,reach:.9,armor:.6,col:'#7A2E2E',d:'Langsam, aber zäh und schlagkräftig.'},
  knight:{n:'Ritter',pl:'Ritter',i:'🐎',gold:40,need:{schwert:1,leder:1},sold:3,hp:34,spd:2.3,dmg:7,rate:1.2,reach:1,armor:.6,col:'#C9A23A',d:'Schnell zu Pferd, ideal für Ausfälle.'}
};
const BASE={holz:40,stein:0,weizen:0,mehl:0,brot:0,aepfel:15,gold:60,eisen:0,haeute:0,bogen:0,speer:0,schwert:0,leder:0};
const MISSIONS=[
  {n:'Ein neuer Anfang',s:'Der König hat dir ein Stück Land überlassen. Noch droht keine Gefahr. Baue ein Dorf auf, in dem die Leute gerne leben.',
   seed:1201,res:{...BASE},pop:10,goals:[['pop',24]],raid:null},
  {n:'Brot für alle',s:'Äpfel allein machen niemanden satt. Baue die Brotkette aus Weizenhof, Mühle und Bäckerei auf. Eine kleine Bande treibt sich herum.',
   seed:3307,res:{...BASE,holz:60,aepfel:20},pop:14,goals:[['brot',40]],raid:{start:10,every:9,fire:99,ram:99,scale:.6}},
  {n:'Steinerne Wacht',s:'Räuber ziehen durch das Tal. Baue Mauern und Türme und wehre drei Angriffe ab. Denk an ein Tor, sonst kommen deine Leute nicht mehr hinaus.',
   seed:4411,res:{...BASE,holz:50,stein:20,aepfel:20,gold:80,bogen:4},pop:14,goals:[['raids',3]],raid:{start:7,every:6,fire:99,ram:99,scale:1}},
  {n:'Flammen im Tal',s:'Die Räuber haben Fackelträger dabei. Brunnen löschen Brände in der Nähe, und du kannst brennende Häuser antippen, um sie für 2 Gold zu löschen.',
   seed:5519,res:{...BASE,holz:60,stein:20,aepfel:20,gold:100,bogen:4},pop:16,goals:[['raids',4],['pp',50]],raid:{start:7,every:6,fire:1,ram:99,ladder:3,scale:1}},
  {n:'Die Belagerung',s:'Ein Heer mit Rammböcken rückt an. Pfeile richten gegen sie wenig aus, aber ein starkes Tor und dicke Mauern bremsen sie lange genug.',
   seed:6623,res:{...BASE,holz:80,stein:40,brot:10,aepfel:20,gold:150,bogen:6,speer:4},pop:18,goals:[['raids',5]],raid:{start:8,every:5,fire:2,ram:2,archer:3,scale:1.4}}
];
const FREE={n:'Freies Spiel',s:'Endlose Angriffe auf einer zufälligen Karte. Wie lange hält deine Burg?',res:{...BASE,brot:5,bogen:3},pop:10,goals:[],raid:{start:8,every:7,fire:3,ram:5,ladder:4,archer:6,scale:1}};
const GOALTXT={pop:['👥','Einwohner'],brot:['🍞','Brot auf Vorrat'],raids:['⚔️','Angriffe abgewehrt'],pp:['❤️','Beliebtheit am Ende']};
