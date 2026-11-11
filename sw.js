// Cache only the public application shell. Business data stays in the encrypted account vault.
const PREFIX='vt-bhver1-shell-'+new URL('./',self.location).pathname+'-',CACHE=PREFIX+'pub20261111c',ENTRY=new URL('./index.html',self.location).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.add(new Request(ENTRY,{cache:'reload'}));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url),base=new URL('./',self.location);if(event.request.method!=='GET'||event.request.mode!=='navigate'||u.origin!==base.origin||![base.pathname,base.pathname+'index.html'].includes(u.pathname))return;
 event.respondWith((async()=>{try{const response=await fetch(event.request);if(response.ok&&response.headers.get('content-type')?.includes('text/html')){const cache=await caches.open(CACHE);await cache.put(ENTRY,response.clone());return response;}const saved=await caches.match(ENTRY);return saved||response;}catch(e){const saved=await caches.match(ENTRY);if(saved)return saved;throw e;}})());
});
