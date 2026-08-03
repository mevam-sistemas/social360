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
    if(!conta){
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: origem, data:{ nome_pessoa:alvo.nome, origem:'convite_equipe_360social' }
      });
      if(error) throw new ErroHttp('não foi possível enviar o convite: ' + error.message, 400);
      conta = data.user;
      enviado = true;
    }
    if(!conta) throw new ErroHttp('não foi possível criar a conta', 500);

    const { error:vincularError } = await dbAdmin.from('equipe').update({ auth_id:conta.id })
      .eq('id', alvo.id).eq('instituicao_id', eu.instituicao_id);
    if(vincularError) throw new ErroHttp('não foi possível vincular o acesso', 500);
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
