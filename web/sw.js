/* 360social PWA — somente a interface pública entra no cache.
   Dados do Supabase, fotos, documentos e prontuários nunca são interceptados. */
const VERSAO = '360social-shell-v15';
const SHELL = [
  '/', '/manifest.json', '/supabase.min.js', '/ponte-banco.js?v=15', '/pwa.js?v=1',
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
