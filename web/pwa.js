(function(){
  if(!('serviceWorker' in navigator)) return;
  let recarregando = false, jaControlada = !!navigator.serviceWorker.controller;
  const VAPID_PUBLICA='BKE9NnyJ_s5SWjjdW_0S8DWg7l2iB16_QBm4s_L_jV7aSkUeaMZnNZMJNgyWqYjDAS1K3gUWpKyYAqjuW2v-Ma8';
  const bytesBase64Url=s=>{const p='='.repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...b].map(c=>c.charCodeAt(0)));};
  window.ativarNotificacoesPush=async function(){
    if(!('PushManager'in window))throw new Error('Este aparelho não oferece notificações push.');
    const perm=await Notification.requestPermission(); if(perm!=='granted')throw new Error('As notificações não foram autorizadas.');
    const reg=await navigator.serviceWorker.ready; let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytesBase64Url(VAPID_PUBLICA)});
    if(typeof window.registrarPushNoBanco!=='function')throw new Error('Entre na sua conta antes de ativar as notificações.');
    await window.registrarPushNoBanco(sub.toJSON()); return true;
  };

  function avisoAtualizacao(reg){
    if(!navigator.serviceWorker.controller || !reg.waiting) return;
    let el = document.getElementById('pwa-atualizacao');
    if(!el){
      el = document.createElement('div'); el.id = 'pwa-atualizacao';
      el.setAttribute('role','status'); el.setAttribute('aria-live','polite');
      el.style.cssText = 'position:fixed;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);'
        +'z-index:10000;width:min(520px,calc(100% - 28px));background:#fff;color:#1A1C20;border:1px solid #F8D4B6;'
        +'border-radius:14px;box-shadow:0 12px 36px rgba(26,28,32,.22);padding:13px 14px;display:flex;'
        +'align-items:center;gap:12px;font:600 13.5px/1.4 system-ui,-apple-system,sans-serif';
      el.innerHTML = '<span style="flex:1"><b style="display:block">Nova versão disponível</b>'
        +'<span style="color:#6E737D;font-weight:500">Atualize para receber as melhorias do 360social.</span></span>'
        +'<button type="button" style="border:0;border-radius:10px;background:#F26A1B;color:#fff;padding:10px 13px;min-height:44px;'
        +'font:750 13px system-ui;white-space:nowrap;cursor:pointer">Atualizar agora</button>';
      document.body.appendChild(el);
    }
    el.querySelector('button').onclick = () => {
      el.querySelector('button').disabled = true;
      el.querySelector('button').textContent = 'Atualizando…';
      reg.waiting.postMessage({tipo:'ATUALIZAR_AGORA'});
    };
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if(!jaControlada){ jaControlada = true; return; }
    if(recarregando) return; recarregando = true; location.reload();
  });

  window.addEventListener('load', async () => {
    try{
      const reg = await navigator.serviceWorker.register('/sw.js', {scope:'/', updateViaCache:'none'});
      avisoAtualizacao(reg);
      reg.addEventListener('updatefound', () => {
        const nova = reg.installing; if(!nova) return;
        nova.addEventListener('statechange', () => { if(nova.state === 'installed') avisoAtualizacao(reg); });
      });
      const verificar = () => reg.update().catch(() => {});
      verificar(); setInterval(verificar, 15 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') verificar(); });
      const id=new URLSearchParams(location.search).get('diretiva'); if(id){let n=0;const abrir=setInterval(()=>{n++;if(typeof abrirDiretivas==='function'&&typeof CONEXAO!=='undefined'&&CONEXAO.ligada){clearInterval(abrir);abrirDiretivas();history.replaceState({},'',location.pathname);}else if(n>40)clearInterval(abrir);},250);}
    }catch(e){ console.error('[PWA] registro indisponível', e); }
  });
})();
