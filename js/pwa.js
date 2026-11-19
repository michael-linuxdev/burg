// Zinnenwerk – Service Worker anmelden und auf neue Versionen hinweisen.
(function(){
  if(!('serviceWorker' in navigator)||!location.protocol.startsWith('http'))return;
  let reloading=false;
  const show=w=>{
    const el=document.getElementById('update');if(!el)return;
    el.hidden=false;
    el.onclick=()=>{el.textContent='Wird aktualisiert …';w.postMessage('skipWaiting')};
  };
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{
      if(reg.waiting&&navigator.serviceWorker.controller)show(reg.waiting);
      reg.addEventListener('updatefound',()=>{
        const w=reg.installing;if(!w)return;
        w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)show(w)});
      });
      // Bei längerer Nutzung gelegentlich nach Updates schauen
      setInterval(()=>reg.update().catch(()=>{}),30*60*1000);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{})});
    }).catch(()=>{});
  });
})();
