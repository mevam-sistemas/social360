import { withSupabase } from 'jsr:@supabase/server@^1';

const origem = 'https://app.360social.com.br';
const cors = {
  'Access-Control-Allow-Origin': origem,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default { fetch:withSupabase({ auth:'user' }, async (req, ctx) => {
  if(req.method !== 'POST') return resposta({ error:'método não permitido' }, 405);
  try{
    const usuario = ctx.supabase.schema('social');
    const admin = ctx.supabaseAdmin;
    const dbAdmin = admin.schema('social');

    const { data:pode, error:podeError } = await usuario.rpc('pode', { acao:'gerir_equipe' });
    if(podeError || !pode) throw new ErroHttp('sem permissão para gerir a equipe', 403);

    const corpo = await req.json().catch(() => ({}));
    const equipeId = String(corpo.equipe_id || '');
    if(!/^[0-9a-f-]{36}$/i.test(equipeId)) throw new ErroHttp('integrante inválido', 400);

    const { data:eu } = await dbAdmin.from('equipe').select('instituicao_id')
      .eq('auth_id', ctx.userClaims?.sub).eq('ativo', true).single();
    if(!eu) throw new ErroHttp('conta sem instituição ativa', 403);
    const { data:alvo } = await dbAdmin.from('equipe')
      .select('id,instituicao_id,nome,email,auth_id,tem_acesso,ativo')
      .eq('id', equipeId).eq('instituicao_id', eu.instituicao_id).single();
    if(!alvo || !alvo.ativo || !alvo.tem_acesso) throw new ErroHttp('integrante sem acesso ativo', 400);
    const email = String(alvo.email || '').trim().toLowerCase();
    if(!email.includes('@')) throw new ErroHttp('e-mail inválido', 400);

    let conta = await buscarUsuarioPorEmail(admin, email);
    if(conta){
      const { data:vinculos, error:vinculosError } = await dbAdmin.from('equipe').select('id,instituicao_id')
        .eq('auth_id', conta.id).neq('id', alvo.id);
      if(vinculosError) throw new ErroHttp('não foi possível validar o vínculo da conta', 500);
      if(vinculos?.length) throw new ErroHttp('este e-mail já pertence a outro acesso', 409);
    }

    if(alvo.auth_id && alvo.auth_id !== conta?.id){
      await dbAdmin.from('equipe').update({ auth_id:null }).eq('id', alvo.id);
    }

    let enviado = false;
    let actionLink = '';
    if(!conta){
      const { data, error } = await admin.auth.admin.generateLink({type:'invite',email,options:{
        redirectTo: origem, data:{ nome_pessoa:alvo.nome, origem:'convite_equipe_360social' }
      }});
      if(error || !data?.properties?.action_link) throw new ErroHttp('não foi possível criar o convite: ' + (error?.message || 'link ausente'), 400);
      conta = data.user;
      actionLink = data.properties.action_link;
      enviado = true;
    }else{
      const {data,error}=await admin.auth.admin.generateLink({type:'recovery',email,options:{redirectTo:origem}});
      if(error || !data?.properties?.action_link)throw new ErroHttp('não foi possível criar o acesso: '+(error?.message||'link ausente'),400);
      actionLink=data.properties.action_link;
    }
    if(!conta) throw new ErroHttp('não foi possível criar a conta', 500);

    const { error:vincularError } = await dbAdmin.from('equipe').update({ auth_id:conta.id })
      .eq('id', alvo.id).eq('instituicao_id', eu.instituicao_id);
    if(vincularError) throw new ErroHttp('não foi possível vincular o acesso', 500);
    if(actionLink){
      const nome=escapar(alvo.nome);
      const html=`<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#171719"><div style="max-width:540px;margin:auto;padding:36px 16px"><div style="background:#fff;border:1px solid #e4e5e8;border-radius:20px;overflow:hidden;box-shadow:0 12px 36px rgba(20,20,22,.08)"><div style="height:6px;background:#f36c21"></div><div style="padding:32px 30px"><div style="font-size:23px;font-weight:850">360<span style="color:#f36c21">social</span></div><p style="margin:28px 0 8px;color:#b74c12;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">Acesso da instituição</p><h1 style="font-size:26px;line-height:1.2;margin:0 0 12px">Olá, ${nome}. Seu acesso está pronto.</h1><p style="color:#62636b;font-size:15px;line-height:1.65">${enviado?'Você foi convidado(a) para integrar a equipe no 360social. Crie sua senha pessoal para entrar com segurança.':'Seu cadastro já possui acesso ao 360social. Use este link para escolher uma nova senha e entrar.'}</p><a href="${actionLink}" style="display:block;text-align:center;background:#f36c21;color:#fff;text-decoration:none;border-radius:12px;padding:15px;margin-top:24px;font-weight:800">${enviado?'Criar minha senha e entrar':'Criar nova senha e entrar'}</a><p style="font-size:12.5px;color:#7b7c84;line-height:1.55;margin-top:22px">Este link é pessoal e temporário. Não encaminhe para outra pessoa.</p><div style="border-top:1px solid #e5e7eb;margin-top:27px;padding-top:18px;color:#7b7c84;font-size:12px">360social · um produto Arbor Labs · desenvolvido no Brasil</div></div></div></div></body></html>`;
      const envio=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':Deno.env.get('BREVO_API_KEY')!,'content-type':'application/json'},body:JSON.stringify({sender:{name:'360social · Arbor Labs',email:'contato@arborlabs.com.br'},replyTo:{name:'Arbor Labs',email:'contato@arborlabs.com.br'},to:[{email,name:alvo.nome}],subject:'SEU ACESSO AO 360SOCIAL',htmlContent:html,tags:['360social','convite']})});
      if(!envio.ok)throw new ErroHttp(`não foi possível enviar o convite (${envio.status})`,502);
      const comprovante=await envio.json().catch(()=>({}));
      console.log('[360social][convite] aceito pelo Brevo',{equipe_id:alvo.id,message_id:comprovante?.messageId||null});
    }
    return resposta({ ok:true, status:enviado?'convite_enviado':'conta_vinculada', email });
  }catch(e){
    const status = e instanceof ErroHttp ? e.status : 400;
    return resposta({ error:e instanceof Error ? e.message : 'erro inesperado' }, status);
  }
}) };

async function buscarUsuarioPorEmail(admin:any, email:string){
  for(let page=1; page<=10; page++){
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage:100 });
    if(error) throw new ErroHttp('não foi possível consultar as contas', 500);
    const achou = data.users.find((u:any) => String(u.email || '').toLowerCase() === email);
    if(achou) return achou;
    if(data.users.length < 100) break;
  }
  return null;
}
class ErroHttp extends Error { constructor(message:string, public status:number){ super(message); } }
function resposta(body:unknown, status=200){
  return new Response(JSON.stringify(body), { status, headers:{...cors,'Content-Type':'application/json'} });
}
function escapar(valor:string){return String(valor||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
