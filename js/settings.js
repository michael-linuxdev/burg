// Burgwacht – Einstellungen (pro Gerät in localStorage). Gehört zur Oberfläche, nicht zur Spiellogik.
// fps: Bildrate (30 schont Akku und Wärme, Vorgabe auf Touch-Geräten; 60 flüssiger)
const SET={music:.5,sfx:.8,quality:'hoch',speed:1,vibrate:true,tutorial:true,tutDone:false,fps:(typeof matchMedia!=='undefined'&&matchMedia('(pointer:coarse)').matches)?30:60};
(function(){try{const o=JSON.parse(store.get(SETTINGS)||'{}');for(const k in SET)if(o[k]!==undefined)SET[k]=o[k]}catch(e){}})();
function saveSettings(){store.set(SETTINGS,JSON.stringify(SET))}
// Grafikstufen: Partikel-Obergrenze, Wetterdichte, Licht (0 einfach, 1 Lichtkegel, 2 Lichtkegel + warmes Leuchten),
// Auflösung des vorgerenderten Geländes und maximale Pixeldichte der Zeichenfläche.
const QUALITY={
  hoch:{n:'Hoch',parts:400,weather:1,light:2,ts:3,dpr:2},
  mittel:{n:'Mittel',parts:180,weather:.5,light:1,ts:2,dpr:1.5},
  niedrig:{n:'Niedrig',parts:50,weather:.15,light:0,ts:1,dpr:1}
};
const Q=()=>QUALITY[SET.quality]||QUALITY.hoch;
