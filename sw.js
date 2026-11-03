const RELEASE = {"version":"1.176","build":"f68a4c3f607e4f448d5a","files":[{"path":"index.html","sha256":"31dda42faf6e9117b4a10b7a12691483df796391cf5b46c7bd77d09489e02a0e"},{"path":"denik.html","sha256":"4acd62f14f8fb3ff89a0dfecf31378cecfe32686451f4a8583f2027427ef565c"},{"path":"generator.html","sha256":"228fd242b2b3cd4121b6c240f47717f0ecb93a7459fe5ce443426bbd2ee706d7"},{"path":"manifest.webmanifest","sha256":"e6f788263dfd680349d458efd4212a3f5ac232e9070f356898d1f44829a24b48"},{"path":"pwa-180.png","sha256":"f1fe1329b6ac241c9e9a237d19a3c3cd0d3ab4eca26d777ee7424231838c33e8"},{"path":"pwa-192.png","sha256":"b8ba8ce10ebfd8a487b8b42c4db169fe04e7b8f84c83c08081797ff883b77aa5"},{"path":"pwa-512.png","sha256":"42a622178d3aaf4a5a129bad1fe307c41921a8d760858eb7459bb5a76b16ead5"}]};
'use strict';
// RELEASE is generated from the actual bytes of the complete player release.
const ROOT=new URL(self.registration.scope);
const PREFIX='jad-pwa:'+ROOT.pathname+':';
const CACHE=PREFIX+RELEASE.build;
const assetURL=path=>new URL(path,ROOT).href;
const allowed=new Set(RELEASE.files.map(f=>assetURL(f.path)));
const digest=async buffer=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
self.addEventListener('install',event=>event.waitUntil((async()=>{
 try{
  // Fetch and verify everything before exposing a new release. Never mix
  // pages from separate GitHub deployments or activate a partial download.
  const files=await Promise.all(RELEASE.files.map(async file=>{
   const response=await fetch(assetURL(file.path),{cache:'no-store',redirect:'error'});
   if(!response.ok||await digest(await response.clone().arrayBuffer())!==file.sha256)throw Error('Incomplete release: '+file.path);
   return [assetURL(file.path),response];
  }));
  const cache=await caches.open(CACHE);
  await Promise.all(files.map(([url,response])=>cache.put(url,response)));
 }catch(error){await caches.delete(CACHE);throw error;}
 // No skipWaiting: an open game keeps its current version until consent.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==ROOT.origin)return;
 url.hash='';url.search='';
 if(url.href===ROOT.href)url.pathname+='index.html';
 if(!allowed.has(url.href))return; // No admin, arbitrary files or third parties.
 event.respondWith((async()=>{
  const cached=await (await caches.open(CACHE)).match(url.href);
  if(cached)return cached;
  // Repair an evicted entry only if it still belongs to this exact release.
  try{
   const response=await fetch(url.href,{cache:'no-store',redirect:'error'});
   const file=RELEASE.files.find(f=>assetURL(f.path)===url.href);
   if(response.ok&&await digest(await response.clone().arrayBuffer())===file.sha256){await (await caches.open(CACHE)).put(url.href,response.clone());return response;}
  }catch{}
  return new Response('Offline sada není dostupná. Připoj se k internetu, zavři karty Tornisty a znovu otevři aplikaci.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 })());
});
self.addEventListener('message',event=>{
 const reply=data=>event.ports?.[0]?.postMessage(data);
 if(event.data?.type==='STATUS'){
  event.waitUntil((async()=>{const cache=await caches.open(CACHE);const complete=(await Promise.all(RELEASE.files.map(f=>cache.match(assetURL(f.path))))).every(Boolean);reply({version:RELEASE.version,build:RELEASE.build,complete});})());
 }else if(event.data?.type==='APPLY_UPDATE'){
  event.waitUntil((async()=>{
   const clients=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>{const u=new URL(c.url);return u.origin===ROOT.origin&&u.pathname.startsWith(ROOT.pathname);});
   if(clients.length!==1||clients[0].id!==event.source?.id){reply({ok:false,reason:'tabs'});return;}
   reply({ok:true});
   await self.skipWaiting();
  })());
 }
});
