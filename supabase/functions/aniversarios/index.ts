import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const primeiroNome=(nome:string)=>(nome||'').trim().split(/\s+/)[0]||'Olá';
const escapar=(s:string)=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

function mensagem(p:any){
  const nome=escapar(primeiroNome(p.nome));
  const abertura=p.perfil==='pessoa_atendida'
    ? `Hoje celebramos a sua vida, ${nome}. É uma alegria reconhecer o valor único da sua história.`
    : `Hoje o 360social celebra a sua vida, ${nome}. Seu cuidado com pessoas deixa marcas que nenhuma tela consegue medir.`;
  return `<div style="background:#faf9f7;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif"><div style="max-width:520px;margin:auto;background:#fff;border:1px solid #ececf2;border-radius:20px;padding:34px;color:#17171a"><div style="font-size:13px;font-weight:800;letter-spacing:.12em;color:#d85b12">360SOCIAL</div><h1 style="font-size:27px;line-height:1.2;margin:18px 0 14px">Um dia especial para agradecer pela sua vida.</h1><p style="font-size:16px;line-height:1.7;color:#55545d">${abertura}</p><p style="font-size:16px;line-height:1.7;color:#55545d">Obrigado pela caminhada com Jesus Cristo e por transformar fé em acolhimento. Que este novo ciclo renove suas forças e multiplique o bem.</p><blockquote style="margin:24px 0;padding:18px 20px;border-left:4px solid #f26a1b;background:#fff7f0;color:#3e352f;font-size:16px;line-height:1.6">“O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti e tenha misericórdia de ti.”<br><b>Números 6:24–25</b></blockquote><p style="font-size:16px;line-height:1.7;color:#55545d">Desejamos que esta data seja cheia de afeto, presença e esperança. Feliz aniversário!</p><p style="margin-top:26px;font-size:13px;color:#8b8991">Com carinho, equipe 360social.</p></div></div>`;
}

Deno.serve(async(req)=>{
  if(req.method!=='POST')return new Response('método não permitido',{status:405});
  if(req.headers.get('x-cron-secret')!==Deno.env.get('BIRTHDAY_CRON_SECRET'))return new Response('não autorizado',{status:401});
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{db:{schema:'social'}});
  const {data,error}=await sb.rpc('aniversariantes_pendentes');
  if(error)return Response.json({error:error.message},{status:500});
  let enviados=0,falhas=0;
  for(const p of data||[]){
    try{
      const envio=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':Deno.env.get('BREVO_API_KEY')!,'content-type':'application/json'},body:JSON.stringify({sender:{name:'360social · Arbor Labs',email:'contato@arborlabs.com.br'},replyTo:{name:'Arbor Labs',email:'contato@arborlabs.com.br'},to:[{email:p.email,name:p.nome}],subject:`${primeiroNome(p.nome)}, hoje celebramos a sua vida!`,htmlContent:mensagem(p),tags:['360social','aniversario']})});
      if(!envio.ok)throw new Error(`Brevo ${envio.status}: ${(await envio.text()).slice(0,300)}`);
      const comprovante=await envio.json().catch(()=>({}));
      console.log('[360social][aniversario] aceito pelo Brevo',{pessoa_id:p.pessoa_id,message_id:comprovante?.messageId||null});
      const ano=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date()));
      const {error:logError}=await sb.from('aniversarios_enviados').insert({pessoa_id:p.pessoa_id,ano,destinatario:p.email});
      if(logError)throw logError;
      enviados++;
    }catch(e){falhas++;console.error('aniversário',p.pessoa_id,e instanceof Error?e.message:String(e));}
  }
  return Response.json({ok:true,encontrados:(data||[]).length,enviados,falhas});
});
