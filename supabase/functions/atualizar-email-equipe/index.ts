import { withSupabase } from 'jsr:@supabase/server@^1';

const origem='https://app.360social.com.br';
const cors={
  'Access-Control-Allow-Origin':origem,
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const resposta=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}
});

export default {fetch:withSupabase({auth:'user'},async(req,ctx)=>{
  if(req.method!=='POST')return resposta({error:'método não permitido'},405);
  try{
    const usuario=ctx.supabase.schema('social');
    const admin=ctx.supabaseAdmin;
    const db=admin.schema('social');
    const {data:pode,error:erroPode}=await usuario.rpc('pode',{acao:'gerir_equipe'});
    if(erroPode||!pode)throw new ErroHttp('sem permissão para gerir a equipe',403);

    const corpo=await req.json().catch(()=>({}));
    const equipeId=String(corpo.equipe_id||'');
    const emailNovo=String(corpo.email_novo||'').trim().toLowerCase();
    if(!/^[0-9a-f-]{36}$/i.test(equipeId))throw new ErroHttp('integrante inválido',400);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNovo)||emailNovo.length>254)throw new ErroHttp('e-mail inválido',400);

    const {data:autor}=await db.from('equipe').select('id,instituicao_id')
      .eq('auth_id',ctx.userClaims?.sub).eq('ativo',true).single();
    if(!autor)throw new ErroHttp('conta sem instituição ativa',403);
    const {data:alvo}=await db.from('equipe').select('id,email,auth_id,tem_acesso')
      .eq('id',equipeId).eq('instituicao_id',autor.instituicao_id).single();
    if(!alvo)throw new ErroHttp('integrante não encontrado',404);
    const emailAnterior=String(alvo.email||'').trim().toLowerCase();
    if(emailAnterior===emailNovo)return resposta({ok:true,email:emailNovo,status:'sem_alteracao'});
    const {data:duplicado}=await db.from('equipe').select('id').eq('instituicao_id',autor.instituicao_id)
      .ilike('email',emailNovo).neq('id',equipeId).limit(1).maybeSingle();
    if(duplicado)throw new ErroHttp('este e-mail já pertence a outra pessoa da equipe',409);

    const alteracaoId=crypto.randomUUID();
    const {error:erroInicio}=await db.from('equipe_email_alteracoes').insert({
      id:alteracaoId,instituicao_id:autor.instituicao_id,equipe_id:equipeId,
      email_anterior:emailAnterior,email_novo:emailNovo,solicitada_por:autor.id,status:'iniciada'
    });
    if(erroInicio)throw new ErroHttp('não foi possível iniciar a alteração auditável',500);

    let authAlterado=false;
    try{
      if(alvo.auth_id&&alvo.tem_acesso){
        const {error}=await admin.auth.admin.updateUserById(alvo.auth_id,{email:emailNovo,email_confirm:true});
        if(error)throw error;
        authAlterado=true;
      }
      const {error:erroFicha}=await db.from('equipe').update({email:emailNovo})
        .eq('id',equipeId).eq('instituicao_id',autor.instituicao_id);
      if(erroFicha)throw erroFicha;
      await db.from('equipe_email_alteracoes').update({status:'concluida',concluida_em:new Date().toISOString()})
        .eq('id',alteracaoId);
      console.info('[360social][equipe-email]',{alteracao_id:alteracaoId,equipe_id:equipeId,status:'concluida'});
      return resposta({ok:true,email:emailNovo,status:'concluida'});
    }catch(erro){
      let status='falhou',detalhe='alteração não concluída';
      if(authAlterado&&alvo.auth_id){
        const {error:erroReversao}=await admin.auth.admin.updateUserById(alvo.auth_id,{email:emailAnterior,email_confirm:true});
        status=erroReversao?'falhou':'revertida';
        detalhe=erroReversao?'falha na ficha e na reversão do Auth':'Auth devolvido ao endereço anterior';
      }
      await db.from('equipe_email_alteracoes').update({status,concluida_em:new Date().toISOString(),detalhe})
        .eq('id',alteracaoId);
      console.error('[360social][equipe-email]',{alteracao_id:alteracaoId,equipe_id:equipeId,status});
      throw new ErroHttp(status==='revertida'?'não foi possível salvar; o e-mail anterior foi preservado':'a sincronização precisa de suporte antes de nova tentativa',500);
    }
  }catch(erro){
    return resposta({error:erro instanceof Error?erro.message:'erro inesperado'},erro instanceof ErroHttp?erro.status:500);
  }
})};

class ErroHttp extends Error{constructor(message:string,public status:number){super(message)}}

