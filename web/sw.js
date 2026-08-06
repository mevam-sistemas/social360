/* 360social PWA — somente a interface pública entra no cache.
   Dados do Supabase, fotos, documentos e prontuários nunca são interceptados. */
// Fonte canônica da versão. O rodapé lê este mesmo arquivo, evitando que
// interface e cache do PWA mostrem números diferentes.
const SOCIAL360_VERSION = '1.4.7';
const VERSAO = '360social-shell-v' + SOCIAL360_VERSION;
const SHELL = [
  '/', '/manifest.json', '/supabase.min.js', '/qrcode.js?v=1', '/ponte-banco.js?v=26', '/pwa.js?v=2',
  '/marca/icone-laranja.svg', '/marca/png/icone-laranja-180.png',
  '/marca/png/icone-laranja-192.png', '/marca/png/icone-laranja-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSAO).then(cache => cache.addAll(SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(chaves => Promise.all(chaves.filter(k => k.startsWith('360social-shell-') && k !== VERSAO)
      .map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});

self.addEventListener('message', event => {
  if(event.data && event.data.tipo === 'ATUALIZAR_AGORA') self.skipWaiting();
});
self.addEventListener('push', event => {
  let d={}; try{d=event.data?event.data.json():{};}catch(_){d={texto:event.data?.text()};}
  event.waitUntil(self.registration.showNotification(d.titulo||'Nova orientação · 360social',{
    body:d.texto||'Há uma nova orientação para a equipe.',icon:'/marca/png/icone-laranja-192.png',
    badge:'/marca/png/icone-laranja-192.png',tag:d.diretiva_id?'diretiva-'+d.diretiva_id:'diretiva',data:{diretiva_id:d.diretiva_id||null,url:'/?diretiva='+(d.diretiva_id||'')}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close(); const alvo=event.notification.data?.url||'/';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(lista=>{
    for(const c of lista){if('focus' in c){c.navigate(alvo);return c.focus();}} return clients.openWindow(alvo);
  }));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  if(req.mode === 'navigate'){
    event.respondWith(fetch(req).then(res => {
      if(res.ok) caches.open(VERSAO).then(cache => cache.put('/', res.clone()));
      return res;
    }).catch(() => caches.match('/')));
    return;
  }

  const chave = url.pathname + url.search;
  if(!SHELL.includes(chave) && !SHELL.includes(url.pathname)) return;
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
    if(res.ok) caches.open(VERSAO).then(cache => cache.put(req, res.clone()));
    return res;
  })));
});
