import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const origem='https://app.360social.com.br';
const cors={'Access-Control-Allow-Origin':origem,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const publica={ok:true,mensagem:'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const esc=(s:string)=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'método não permitido'},405);
  try{
    const email=String((await req.json().catch(()=>({})))?.email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return json(publica);
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let destino=email;
    let {data:link,error}=await admin.auth.admin.generateLink({type:'recovery',email:destino,options:{redirectTo:origem}});
    if(error||!link?.properties?.action_link){
      const {data:equipe}=await admin.schema('social').from('equipe').select('auth_id').ilike('email',email).eq('ativo',true).eq('tem_acesso',true).limit(1).maybeSingle();
      if(equipe?.auth_id){
        const {data:conta}=await admin.auth.admin.getUserById(equipe.auth_id);
        destino=String(conta?.user?.email||'').trim().toLowerCase();
        if(destino){({data:link,error}=await admin.auth.admin.generateLink({type:'recovery',email:destino,options:{redirectTo:origem}}));}
      }
    }
    if(error||!link?.properties?.action_link){console.error('[360social][recuperacao] link não criado',{motivo:error?.message||'sem link'});return json(publica);}
    const nomeCompleto=String(link.user?.user_metadata?.nome||link.user?.user_metadata?.name||'').trim();
    const nome=esc(nomeCompleto.split(/\s+/)[0]||'Olá');
    const html=`<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#171719"><div style="max-width:540px;margin:auto;padding:36px 16px"><div style="background:#fff;border:1px solid #e4e5e8;border-radius:20px;overflow:hidden;box-shadow:0 12px 36px rgba(20,20,22,.08)"><div style="height:6px;background:#f36c21"></div><div style="padding:32px 30px"><div style="font-size:23px;font-weight:850">360<span style="color:#f36c21">social</span></div><p style="margin:28px 0 8px;color:#b74c12;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">Acesso seguro</p><h1 style="font-size:26px;line-height:1.2;margin:0 0 12px">Olá, ${nome}. Vamos recuperar seu acesso.</h1><p style="color:#62636b;font-size:15px;line-height:1.65">Recebemos um pedido para criar uma nova senha no 360social. Use o botão abaixo para escolher uma senha exclusiva.</p><a href="${link.properties.action_link}" style="display:block;text-align:center;background:#f36c21;color:#fff;text-decoration:none;border-radius:12px;padding:15px;margin-top:24px;font-weight:800">Criar nova senha</a><p style="font-size:12.5px;color:#7b7c84;line-height:1.55;margin-top:22px">Este link é pessoal e temporário. Se você não fez o pedido, ignore esta mensagem.</p><div style="border-top:1px solid #e5e7eb;margin-top:27px;padding-top:18px;color:#7b7c84;font-size:12px">360social · um produto Arbor Labs · desenvolvido no Brasil</div></div></div></div></body></html>`;
    const envio=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':Deno.env.get('BREVO_API_KEY')!,'content-type':'application/json'},body:JSON.stringify({sender:{name:'360social · Arbor Labs',email:'contato@arborlabs.com.br'},replyTo:{name:'Arbor Labs',email:'contato@arborlabs.com.br'},to:[{email:destino,name:nomeCompleto||undefined}],subject:'RECUPERAÇÃO DE SENHA - 360SOCIAL',htmlContent:html,tags:['360social','recuperacao']})});
    if(!envio.ok){console.error('[360social][recuperacao] Brevo recusou',{status:envio.status,detalhe:(await envio.text()).slice(0,500)});return json(publica);}
    const comprovante=await envio.json().catch(()=>({}));
    console.log('[360social][recuperacao] aceita pelo Brevo',{message_id:comprovante?.messageId||null});
  }catch(error){console.error('[360social][recuperacao]',error instanceof Error?error.message:error);}
  return json(publica);
});
