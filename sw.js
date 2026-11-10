const C='coach-v2';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 if(u.hostname==='ntfy.sh'||u.pathname.endsWith('sw.js'))return;
 const net=u.origin===location.origin||u.hostname==='gist.githubusercontent.com';
 if(net){if(u.pathname.endsWith('stand.txt'))return;
  const k=u.origin+u.pathname;
  e.respondWith(fetch(r).then(x=>{if(x.ok){const c=x.clone();caches.open(C).then(c2=>c2.put(k,c))}return x}).catch(()=>caches.match(k)));return}
 e.respondWith(caches.match(r).then(m=>m||fetch(r).then(x=>{try{const c=x.clone();caches.open(C).then(k=>k.put(r,c))}catch(_){}return x})));
});
