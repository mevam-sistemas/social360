import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async req => {
  if(req.method==='OPTIONS')return new Response('ok',{headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type'}});
  try{
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth=req.headers.get('Authorization')||'';
    const usuario=createClient(url,anon,{global:{headers:{Authorization:auth}},db:{schema:'social'}});
    const {data:{user},error:authError}=await usuario.auth.getUser(); if(authError||!user)throw new Error('não autenticado');
    const {diretiva_id}=await req.json();
    const {data:dir,error:dirError}=await usuario.from('diretivas').select('id,titulo,texto').eq('id',diretiva_id).single();
    if(dirError||!dir)throw new Error('orientação não encontrada');
    const admin=createClient(url,service,{db:{schema:'social'}});
    const {data:dest}=await admin.from('diretiva_destinatarios').select('equipe_id').eq('diretiva_id',diretiva_id);
    const ids=[...new Set((dest||[]).map(x=>x.equipe_id))];
    const {data:subs}=ids.length?await admin.from('push_inscricoes').select('*').in('equipe_id',ids):{data:[]};
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:contato@360social.com.br',Deno.env.get('VAPID_PUBLIC_KEY')!,Deno.env.get('VAPID_PRIVATE_KEY')!);
    const payload=JSON.stringify({titulo:dir.titulo,texto:dir.texto,diretiva_id:dir.id});
    await Promise.allSettled((subs||[]).map(async s=>{try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload);}catch(e){if(e?.statusCode===404||e?.statusCode===410)await admin.from('push_inscricoes').delete().eq('id',s.id);else throw e;}}));
    return new Response(JSON.stringify({ok:true,enviadas:(subs||[]).length}),{headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
  }catch(e){return new Response(JSON.stringify({error:e.message}),{status:400,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});}
});
