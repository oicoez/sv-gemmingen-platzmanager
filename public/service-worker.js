const CACHE="clubplanner-shell-v5.1.1";
const SHELL=["/","/index.html","/manifest.json","/icons/icon-192.png","/icons/icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=="GET"||u.origin!==self.location.origin)return;
 if(u.pathname.startsWith("/api/")||u.pathname==="/health")return;
 if(e.request.mode==="navigate"){e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put("/index.html",copy));return r}).catch(()=>caches.match("/index.html")));return}
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
});