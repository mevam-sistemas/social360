/* ============================================================
   PONTE COM O BANCO — 360social ligado ao Supabase (schema social)
   ------------------------------------------------------------
   Regra da casa: quem chega sem login vê a demonstração, intacta.
   Quem entra com e-mail que está na equipe de uma instituição vê
   e grava DADOS REAIS. A tela é a mesma; a fonte muda por baixo.

   Como muda por baixo: todas as escritas do app passam pelo objeto
   `dados` ou por meia dúzia de funções nomeadas. Este módulo troca
   essas portas quando há sessão — o resto do app não sabe a
   diferença. IDs viram UUID gerado aqui (crypto.randomUUID) para a
   tela continuar síncrona enquanto o INSERT viaja.

   O que fica só na tela por enquanto (sem tabela no banco):
   configuração de envios de e-mail e anexos de atendimento.
   ============================================================ */

const SBS_URL = 'https://lshjtlzlywipxtfwbxxe.supabase.co';
const SBS_KEY = 'sb_publishable_7-sR87eV6b4I8nx-k6Hriw_DEVprjfz'; /* chave pública */
const sbc = supabase.createClient(SBS_URL, SBS_KEY, { db: { schema: 'social' } });

const CONEXAO = { ligada:false, eu:null, orgId:null };
/* papel no banco ⇄ papel na tela (a tela chama a assistente de 'social') */
const P_DB2TELA = { operador:'operador', assistente:'social', coordenador:'coordenador', presidente:'presidente' };
const P_TELA2DB = { operador:'operador', social:'assistente', coordenador:'coordenador', presidente:'presidente' };
/* id do evento (tela) ⇄ coluna evento_* de config_email — convite_equipe
   fica fora do mapa de propósito: é fixo (fixo:true), não tem coluna no
   banco, e a tela já não deixa desligar. */
const MAPA_EVENTO_EMAIL = { resumo_diario:'evento_resumo_diario',
  relatorio_mensal:'evento_relatorio_mensal', pendencia_atrasada:'evento_pendencia_atrasada',
  retorno_hoje:'evento_retorno_hoje', lotacao:'evento_lotacao',
  sem_abordagem:'evento_sem_abordagem', doacao_grande:'evento_doacao_grande' };

/* ---- aviso discreto quando uma gravação falha ---- */
function avisoDB(oQue){
  let t = document.getElementById('aviso-db');
  if(!t){
    t = document.createElement('div'); t.id = 'aviso-db';
    t.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);'
      + 'background:#8f3907;color:#fff;padding:10px 18px;border-radius:12px;font-size:13.5px;'
      + 'z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,.25);max-width:92vw';
    document.body.appendChild(t);
  }
  t.textContent = 'Não foi possível salvar ' + oQue + ' no banco. Confira a conexão e tente de novo.';
  t.style.display = 'block';
  clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 6000);
}
function pushDB(q, oQue){
  Promise.resolve(q).then(r => { if(r && r.error){ console.error('[banco]', oQue, r.error); avisoDB(oQue); } })
    .catch(e => { console.error('[banco]', oQue, e); avisoDB(oQue); });
}

/* ============================================================
   ENTRAR — e-mail → código → sessão. Sem senha para decorar.
   ============================================================ */
let emailPendente = '';
function abrirEntrar(){
  fecharEntrar();
  const o = document.createElement('div'); o.id = 'entrar-ov';
  o.style.cssText = 'position:fixed;inset:0;background:rgba(15,12,8,.55);z-index:9998;'
    + 'display:flex;align-items:center;justify-content:center;padding:18px';
  o.innerHTML = `<div style="background:#fff;border-radius:18px;padding:26px 24px;max-width:380px;width:100%">
    <h2 style="margin:0 0 6px;font-size:19px">Entrar na sua instituição</h2>
    <p style="margin:0 0 16px;color:#6b625a;font-size:13.5px">Use o e-mail com que você foi
      cadastrado na equipe. Se já tem senha, entre direto; se não, deixe o campo de senha em
      branco e mandamos um código de 6 dígitos.</p>
    <div id="ent-p1">
      <input id="ent-email" type="email" placeholder="seu@email.com" autocomplete="email"
        style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px">
      <input id="ent-senha" type="password" placeholder="Senha — deixe em branco se não tiver"
        autocomplete="current-password"
        style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin-top:8px">
      <button onclick="entrarComSenha()" class="bt" style="width:100%;margin-top:12px">Entrar</button>
    </div>
    <div id="ent-p2" style="display:none">
      <input id="ent-cod" inputmode="numeric" placeholder="Código de 6 dígitos"
        style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:17px;letter-spacing:.2em;text-align:center">
      <button onclick="confirmarCodigo()" class="bt" style="width:100%;margin-top:12px">Entrar</button>
    </div>
    <div id="ent-msg" style="margin-top:10px;font-size:13px;color:#8f3907"></div>
    <button onclick="fecharEntrar()" style="margin-top:14px;background:none;border:none;color:#6b625a;
      font-size:13px;cursor:pointer;text-decoration:underline">Continuar só olhando a demonstração</button>
  </div>`;
  document.body.appendChild(o);
  setTimeout(() => { const e = document.getElementById('ent-email'); if(e) e.focus(); }, 60);
}
function fecharEntrar(){ const o = document.getElementById('entrar-ov'); if(o) o.remove(); }
/* botão único: com senha preenchida tenta login por senha; em branco, manda
   o código por e-mail — mesmo comportamento de sempre pra quem nunca definiu
   senha, então ninguém que já usava o código perde o próprio fluxo. */
async function entrarComSenha(){
  const email = (document.getElementById('ent-email').value || '').trim().toLowerCase();
  const senha = document.getElementById('ent-senha').value || '';
  const msg = document.getElementById('ent-msg');
  if(!email.includes('@')){ msg.textContent = 'Confira o e-mail.'; return; }
  if(!senha) return enviarCodigo();
  msg.textContent = 'Entrando…';
  const { error } = await sbc.auth.signInWithPassword({ email, password: senha });
  if(error){ msg.textContent = 'E-mail ou senha não conferem. Se esqueceu a senha, deixe o campo em branco e entre por código.'; return; }
  fecharEntrar();
  conectar();
}
async function enviarCodigo(){
  const email = (document.getElementById('ent-email').value || '').trim().toLowerCase();
  const msg = document.getElementById('ent-msg');
  if(!email.includes('@')){ msg.textContent = 'Confira o e-mail.'; return; }
  msg.textContent = 'Enviando…';
  const { error } = await sbc.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if(error){ console.error(error); msg.textContent = 'Não consegui enviar agora. Tente de novo em instantes.'; return; }
  emailPendente = email;
  document.getElementById('ent-p1').style.display = 'none';
  document.getElementById('ent-p2').style.display = '';
  msg.textContent = 'Código enviado para ' + email + '. Vale por alguns minutos.';
  document.getElementById('ent-cod').focus();
}
async function confirmarCodigo(){
  const cod = (document.getElementById('ent-cod').value || '').replace(/\D/g, '');
  const msg = document.getElementById('ent-msg');
  if(cod.length < 6){ msg.textContent = 'O código tem 6 dígitos.'; return; }
  msg.textContent = 'Conferindo…';
  const { error } = await sbc.auth.verifyOtp({ email: emailPendente, token: cod, type: 'email' });
  if(error){ msg.textContent = 'Código não confere ou venceu. Peça outro.'; return; }
  fecharEntrar();
  conectar(true);
}

/* ============================================================
   DEFINIR SENHA — oferecido uma vez, logo após entrar por código, pra quem
   ainda não tem senha. Sem 2FA: é só entrar mais rápido da próxima vez.
   Nunca é obrigatório e nunca aparece de novo na mesma sessão se fechado.
   ============================================================ */
let ofereceuSenha = false;
function oferecerDefinirSenha(){
  if(ofereceuSenha) return; ofereceuSenha = true;
  const o = document.createElement('div'); o.id = 'senha-ov';
  o.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9998;'
    + 'background:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 8px 30px rgba(0,0,0,.25);'
    + 'max-width:360px;width:92vw';
  o.innerHTML = `<b style="font-size:14px">Quer entrar mais rápido da próxima vez?</b>
    <p style="margin:6px 0 10px;color:#6b625a;font-size:13px">Defina uma senha agora — sem senha
      decorada, também dá pra continuar entrando por código sempre.</p>
    <input id="ds-senha" type="password" placeholder="Nova senha (mínimo 6 caracteres)"
      style="width:100%;padding:9px 11px;border:1.5px solid #d8d0c6;border-radius:9px;font-size:14px;box-sizing:border-box">
    <div style="display:flex;gap:8px;margin-top:10px">
      <button onclick="confirmarDefinirSenha()" class="bt" style="flex:1">Definir senha</button>
      <button onclick="document.getElementById('senha-ov').remove()"
        style="background:none;border:none;color:#6b625a;font-size:13px;cursor:pointer">Agora não</button>
    </div>
    <div id="ds-msg" style="margin-top:8px;font-size:12.5px;color:#8f3907"></div>`;
  document.body.appendChild(o);
}
async function confirmarDefinirSenha(){
  const senha = document.getElementById('ds-senha').value || '';
  const msg = document.getElementById('ds-msg');
  if(senha.length < 6){ msg.textContent = 'A senha precisa de pelo menos 6 caracteres.'; return; }
  msg.textContent = 'Salvando…';
  const { error } = await sbc.auth.updateUser({ password: senha });
  if(error){ console.error('[banco] definir senha', error); msg.textContent = 'Não consegui salvar agora. Tente de novo depois.'; return; }
  const o = document.getElementById('senha-ov'); if(o) o.remove();
}

/* ============================================================
   CONECTAR — vincula a conta à equipe e troca a fonte dos dados
   ============================================================ */
async function conectar(viaCodigo){
  const { data, error } = await sbc.rpc('vincular_meu_acesso');
  if(error){
    avisoDB('a conexão'); await sbc.auth.signOut(); return;
  }
  if(!data){
    /* e-mail novo, sem equipe em nenhuma instituição: antes disso era beco
       sem saída (alerta + logout). Agora oferece criar a instituição na
       hora — self-service, igual ao que o site já promete. */
    mostrarCriarInstituicao(viaCodigo);
    return;
  }
  await entrarComVinculo(data, viaCodigo);
}

async function entrarComVinculo(data, viaCodigo){
  CONEXAO.eu = data; CONEXAO.orgId = data.instituicao_id;
  try{
    await carregarTudo();
  }catch(e){
    console.error('[banco] carga', e);
    avisoDB('a carga dos dados'); return;
  }
  CONEXAO.ligada = true;
  const pt = P_DB2TELA[data.papel] || 'operador';
  SESSAO = { papel: pt, nome: data.nome, rotulo: ROTULO_PAPEL[pt] };
  document.querySelectorAll('.rodape-l button').forEach(b => {
    if(b.textContent.trim() === 'Trocar' || b.textContent.trim() === 'Entrar') b.textContent = 'Sair';
    b.onclick = trocarPapel;
  });
  identidade(); irMenu(inicioDoPapel());
  // quem entrou por código (sem senha) ganha o convite pra definir uma — só
  // uma vez por sessão, nunca obrigatório, login por código continua igual.
  if(viaCodigo) setTimeout(oferecerDefinirSenha, 900);
}

/* ============================================================
   CRIAR MINHA INSTITUIÇÃO — cadastro self-service (01/08/2026).
   Aparece quando o e-mail que acabou de confirmar o código não está em
   nenhuma equipe: antes disso era beco sem saída (site prometia "crie a
   conta da sua instituição", app só sabia dizer "peça pra te adicionarem").
   ============================================================ */
function mostrarCriarInstituicao(){
  // hoje só se chega aqui vindo do fluxo por código (signInWithOtp cria a
  // conta na hora) — por isso oferece definir senha ao final, sempre.
  fecharCriarInstituicao();
  const o = document.createElement('div'); o.id = 'criar-inst-ov';
  o.style.cssText = 'position:fixed;inset:0;background:rgba(15,12,8,.55);z-index:9998;'
    + 'display:flex;align-items:center;justify-content:center;padding:18px';
  o.innerHTML = `<div style="background:#fff;border-radius:18px;padding:26px 24px;max-width:400px;width:100%">
    <h2 style="margin:0 0 6px;font-size:19px">Este e-mail ainda não está em nenhuma instituição</h2>
    <p style="margin:0 0 16px;color:#6b625a;font-size:13.5px">Se você já faz parte de uma instituição no
      360social, peça a quem coordena para te adicionar em Instituição → Equipe e acessos. Se é a
      primeira vez, crie a instituição agora — sete dias grátis, sem cartão.</p>
    <label style="font-size:13px;color:#6b625a">Nome da instituição</label>
    <input id="ci-inst" placeholder="Ex.: Projeto Social Cidade Melhor" autocomplete="organization"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin:4px 0 10px;box-sizing:border-box">
    <label style="font-size:13px;color:#6b625a">Seu nome</label>
    <input id="ci-nome" placeholder="Como você quer ser chamado" autocomplete="name"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin:4px 0 10px;box-sizing:border-box">
    <label style="font-size:13px;color:#6b625a">Cidade <span style="opacity:.6">— opcional</span></label>
    <input id="ci-cidade" placeholder="Ex.: Itajaí — SC"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin:4px 0 14px;box-sizing:border-box">
    <button onclick="confirmarCriarInstituicao()" class="bt" style="width:100%">Criar minha instituição</button>
    <div id="ci-msg" style="margin-top:10px;font-size:13px;color:#8f3907"></div>
    <button onclick="cancelarCriarInstituicao()" style="margin-top:14px;background:none;border:none;color:#6b625a;
      font-size:13px;cursor:pointer;text-decoration:underline">Sair</button>
  </div>`;
  document.body.appendChild(o);
  setTimeout(() => { const e = document.getElementById('ci-inst'); if(e) e.focus(); }, 60);
}
function fecharCriarInstituicao(){ const o = document.getElementById('criar-inst-ov'); if(o) o.remove(); }
async function confirmarCriarInstituicao(){
  const inst = (document.getElementById('ci-inst').value || '').trim();
  const nome = (document.getElementById('ci-nome').value || '').trim();
  const cidade = (document.getElementById('ci-cidade').value || '').trim();
  const msg = document.getElementById('ci-msg');
  if(!inst){ msg.textContent = 'Dá um nome pra sua instituição.'; return; }
  if(!nome){ msg.textContent = 'Falta o seu nome.'; return; }
  msg.textContent = 'Criando…';
  const { data, error } = await sbc.rpc('criar_minha_instituicao',
    { p_nome_instituicao: inst, p_nome_pessoa: nome, p_cidade: cidade || null });
  if(error || !data){
    console.error('[banco] criar instituição', error);
    msg.textContent = 'Não consegui criar agora. Tente de novo em instantes.';
    return;
  }
  fecharCriarInstituicao();
  await entrarComVinculo(data, true);
}
async function cancelarCriarInstituicao(){
  fecharCriarInstituicao();
  await sbc.auth.signOut();
}

function nomeDe(eqId){
  const u = EQUIPE.find(x => x.id === eqId);
  return u ? u.nome : '';
}

async function carregarTudo(){
  const pega = async (q, oQue) => {
    const { data, error } = await q;
    if(error) throw new Error(oQue + ': ' + error.message);
    return data || [];
  };
  const [orgs, unis, srvs, eqp, fns, cfgsEmail, audit] = await Promise.all([
    pega(sbc.from('instituicoes').select('*').limit(1), 'instituição'),
    pega(sbc.from('unidades').select('*').order('nome'), 'unidades'),
    pega(sbc.from('servicos').select('*').order('ordem'), 'serviços'),
    pega(sbc.from('equipe').select('*').order('criado_em'), 'equipe'),
    pega(sbc.from('funcoes').select('*').order('nome'), 'funções'),
    pega(sbc.from('config_email').select('*').eq('instituicao_id', CONEXAO.orgId), 'config de e-mail'),
    /* auditoria só existe pra quem tem pode('config_org') — mesma regra do
       config_email logo acima: a política de segurança já filtra, então
       quem não pode configurar a instituição simplesmente recebe zero
       linhas aqui, sem erro. */
    pega(sbc.from('auditoria').select('*').order('quando', { ascending:false }).limit(300), 'auditoria')
  ]);
  const o = orgs[0] || {};
  Object.assign(ORG, { nome:o.nome||ORG.nome, nomeCompleto:o.nome_completo||'', cidade:o.cidade||'',
    cnpj:o.cnpj||'', endereco:o.endereco||'', telefone:o.telefone||'', email:o.email||'',
    site:o.site||'', responsavel:o.responsavel||'', logo:o.logo_url||null });
  /* config_email só existe se a instituição já foi seedada (RLS: só quem tem
     pode('config_org') enxerga a linha) — sem ela, a tela de e-mail continua
     mostrando o mock, sem quebrar. Endereço de envio ("remetenteEnd") não
     tem coluna própria: hoje o envio real sempre sai do único e-mail
     verificado no Brevo, então persistir esse campo criaria a falsa
     impressão de que ele muda o remetente de verdade — fica só de mock. */
  const ce = cfgsEmail[0];
  if(ce){
    Object.assign(EMAIL, { remetenteNome: ce.remetente_nome || EMAIL.remetenteNome,
      responderPara: ce.responder_para || '', assinatura: ce.assinatura || '',
      horaResumo: (ce.hora_resumo || '18:00').slice(0, 5),
      soComMovimento: ce.so_com_movimento !== false });
    EMAIL.eventos.forEach(e => { const campo = MAPA_EVENTO_EMAIL[e.id];
      if(campo) e.liga = !!ce[campo]; });
  }
  LOCAIS.length = 0;
  unis.forEach(u => LOCAIS.push({ id:u.id, nome:u.nome, curto:u.curto, categoria:u.categoria||'',
    tipo:u.tipo, capacidade:u.capacidade, endereco:u.endereco||'', horario:u.horario||'',
    ativa: u.ativa !== false }));
  /* Todos entram (ativo e arquivado) — mesmo padrão de Locais/Funções — para
     dar pra reativar pela tela sem eles sumirem do estado local. Só o
     formulário de registrar atendimento filtra pelos ativos. */
  SERVICOS.length = 0;
  srvs.forEach(s => SERVICOS.push({ id:s.id, nome:s.nome, cat:s.categoria||'Outros',
    tipo:s.tipo||'servico', ativo:s.ativo!==false, ordem:s.ordem||0 }));
  FUNCOES.length = 0;
  fns.forEach(f => FUNCOES.push({ id:f.id, nome:f.nome, ativa: f.ativa !== false }));
  const nomeFuncao = fid => fid ? ((FUNCOES.find(f => f.id === fid) || {}).nome || '') : '';
  EQUIPE.length = 0;
  eqp.forEach(u => EQUIPE.push({ id:u.id, nome:u.nome, email:u.email,
    papel: P_DB2TELA[u.papel] || 'operador',
    unidade: u.unidade_id ? ((LOCAIS.find(l => l.id === u.unidade_id) || {}).curto || 'Todas') : 'Todas',
    funcao: nomeFuncao(u.funcao_id),
    status: u.ativo ? 'ativo' : 'inativo',
    acesso: u.tem_acesso === false ? 'nao' : 'sim',
    desde: String(u.criado_em || '').slice(0, 10), obs: u.observacao || '' }));

  /* nomeDe() já enxerga EQUIPE aqui — precisa vir depois do forEach acima. */
  BD.auditoria.length = 0;
  audit.forEach(a => BD.auditoria.push({ id:a.id, quando:new Date(a.quando),
    autor: nomeDe(a.autor_id) || 'Sistema', acao:a.acao, tabela:a.tabela,
    registroId:a.registro_id, detalhe:a.detalhe||null }));

  const [pes, ats, prs, regs, pends, doas, fts, presEq, axs] = await Promise.all([
    pega(sbc.from('pessoas').select('*').order('criada_em', { ascending:false }), 'pessoas'),
    pega(sbc.from('atendimentos').select('*, atendimento_servicos(servico_id, quantidade)').order('quando'), 'atendimentos'),
    pega(sbc.from('presencas').select('*').order('entrada'), 'presenças'),
    pega(sbc.from('registros_trabalho').select('*').order('quando'), 'registros'),
    pega(sbc.from('pendencias').select('*'), 'pendências'),
    pega(sbc.from('doacoes').select('*').order('quando'), 'doações'),
    pega(sbc.from('fotos_pessoa').select('*').order('criada_em'), 'histórico de fotos'),
    pega(sbc.from('presencas_equipe').select('*').order('criada_em'), 'presença da equipe'),
    pega(sbc.from('anexos').select('*').order('criado_em'), 'anexos')
  ]);
  BD.pessoas.length = 0;
  pes.filter(p => !p.arquivada).forEach(p => BD.pessoas.push({ id:p.id, nome:p.nome,
    apelido:p.apelido||'', nasc:p.nascimento||'', tel:p.telefone||'', cpf:p.cpf||'', sexo:p.sexo||null,
    codigo:p.codigo, foto:p.foto_url||null, criado:new Date(p.criada_em), obs:p.observacao||'', docs:[] }));
  BD.atend.length = 0;
  ats.forEach(a => {
    const quantidades = {};
    (a.atendimento_servicos||[]).forEach(x => { quantidades[x.servico_id] = Number(x.quantidade) || 1; });
    BD.atend.push({ id:a.id, pessoa:a.pessoa_id, local:a.unidade_id,
      localDescricao:a.local_descricao||'',
      servicos:(a.atendimento_servicos||[]).map(x => x.servico_id), quantidades,
      quando:new Date(a.quando), operador:nomeDe(a.operador_id), obs:a.observacao||'', anexos:[] });
  });
  BD.presencas.length = 0;
  prs.forEach(p => BD.presencas.push({ id:p.id, pessoa:p.pessoa_id, local:p.unidade_id,
    entrada:new Date(p.entrada), saida:p.saida ? new Date(p.saida) : null,
    porQuem:nomeDe(p.por_quem), encerradaAuto:!!p.encerrada_auto }));
  BD.tecnicos.length = 0;
  regs.forEach(t => BD.tecnicos.push({ id:t.id, pessoa:t.pessoa_id, tipo:t.tipo,
    profissional:nomeDe(t.autor_id), quando:new Date(t.quando), modo:t.modo||'',
    situacao:t.situacao||'', texto:t.texto, encaminhamento:t.encaminhamento||'' }));
  BD.pendencias.length = 0;
  pends.forEach(p => BD.pendencias.push({ id:p.id, pessoa:p.pessoa_id, texto:p.texto,
    data:p.data_prevista, profissional:nomeDe(p.responsavel_id), status:p.status }));
  BD.doacoes.length = 0;
  doas.forEach(d => BD.doacoes.push({ id:d.id, tipo:d.tipo, item:d.item, categoria:d.categoria||'',
    qtd:Number(d.quantidade), quem:d.quem, local:d.unidade_id, quando:new Date(d.quando),
    responsavel:nomeDe(d.registrada_por), observacao:d.observacao||'', anexos:[] }));
  BD.fotos.length = 0;
  fts.forEach(f => BD.fotos.push({ id:f.id, pessoa:f.pessoa_id, url:f.url,
    quando:new Date(f.criada_em), quem:nomeDe(f.criada_por), motivo:f.motivo||'' }));
  BD.presEquipe.length = 0;
  presEq.forEach(p => BD.presEquipe.push({ id:p.id, equipe:p.equipe_id, local:p.unidade_id,
    tipo:p.tipo, entrada:p.entrada ? new Date(p.entrada) : null, saida:p.saida ? new Date(p.saida) : null,
    quando: new Date(p.entrada || p.criada_em), funcao: nomeFuncao(p.funcao_id) || '',
    observacao:p.observacao||'', porQuem:nomeDe(p.registrada_por), encerradaAuto:!!p.encerrada_auto }));

  /* Anexos servem dois contextos (atendimento e doação) na mesma tabela —
     cada anexo já sabe a quem pertence pelo id preenchido; aqui só
     distribuímos cada um para o registro certo, já carregado acima. */
  axs.forEach(x => {
    const item = { tipo: /^image\//.test(x.tipo) || x.tipo === 'img' ? 'img' : 'arq', url:x.url, nome:x.nome||'' };
    if(x.atendimento_id){
      const a = BD.atend.find(y => y.id === x.atendimento_id);
      if(a) a.anexos.push(item);
    } else if(x.doacao_id){
      const d = BD.doacoes.find(y => y.id === x.doacao_id);
      if(d) d.anexos.push(item);
    }
  });
}

/* ============================================================
   ESCRITAS — a tela grava na hora; o banco recebe em seguida.
   Se o banco recusar, o aviso aparece e nada fica escondido.
   ============================================================ */
const demoDados = Object.assign({}, dados);

function proximoCodigo(){
  let prefixo = 'P-', maior = 0;
  BD.pessoas.forEach(p => {
    const m = String(p.codigo||'').match(/^(.*?)(\d+)$/);
    if(m){ if(+m[2] > maior){ maior = +m[2]; prefixo = m[1]; } }
  });
  return prefixo + (maior + 1);
}

dados.criarPessoa = function(p){
  if(!CONEXAO.ligada) return demoDados.criarPessoa(p);
  const id = crypto.randomUUID();
  const novo = Object.assign({ id, codigo: proximoCodigo(), criado:new Date(),
    apelido:'', nasc:'', tel:'', cpf:'', foto:null, obs:'', docs:[] }, p, { id });
  novo.codigo = novo.codigo || proximoCodigo();
  BD.pessoas.unshift(novo);
  pushDB(sbc.from('pessoas').insert({ id, instituicao_id:CONEXAO.orgId, codigo:novo.codigo,
    nome:novo.nome, apelido:novo.apelido||null, nascimento:novo.nasc||null,
    telefone:novo.tel||null, cpf:novo.cpf||null, sexo:novo.sexo||null, observacao:novo.obs||null,
    foto_url:novo.foto||null, criada_por:CONEXAO.eu.id }), 'o cadastro');
  return novo;
};

dados.criarAtendimento = function(a){
  if(!CONEXAO.ligada) return demoDados.criarAtendimento(a);
  const id = crypto.randomUUID();
  const novo = Object.assign({ id, quando:new Date(), operador:SESSAO.nome, anexos:[], localDescricao:'', quantidades:{} }, a, { id });
  BD.atend.push(novo);
  pushDB((async () => {
    const r1 = await sbc.from('atendimentos').insert({ id, instituicao_id:CONEXAO.orgId,
      pessoa_id:novo.pessoa, unidade_id:novo.local||null, local_descricao:novo.localDescricao||null,
      observacao:novo.obs||null, operador_id:CONEXAO.eu.id });
    if(r1.error) return r1;
    if((novo.servicos||[]).length){
      const r2 = await sbc.from('atendimento_servicos')
        .insert(novo.servicos.map(s => ({ atendimento_id:id, servico_id:s,
          quantidade: (novo.quantidades && novo.quantidades[s]) || 1 })));
      if(r2.error) return r2;
    }
    if((novo.anexos||[]).length){
      const r3 = await sbc.from('anexos').insert(novo.anexos.map(x => ({
        instituicao_id:CONEXAO.orgId, pessoa_id:novo.pessoa, atendimento_id:id,
        tipo:x.tipo, url:x.url, nome:x.nome||null, criado_por:CONEXAO.eu.id })));
      if(r3.error) return r3;
    }
    return r1;
  })(), 'o atendimento');
  return novo;
};

dados.criarDoacao = function(d){
  if(!CONEXAO.ligada) return demoDados.criarDoacao(d);
  const id = crypto.randomUUID();
  const novo = Object.assign({ id, quando:new Date(), responsavel:SESSAO.nome, observacao:'', anexos:[] }, d, { id });
  BD.doacoes.push(novo);
  pushDB((async () => {
    const r1 = await sbc.from('doacoes').insert({ id, instituicao_id:CONEXAO.orgId, tipo:novo.tipo,
      item:novo.item, categoria:novo.categoria||null, quantidade:novo.qtd, quem:novo.quem,
      unidade_id:novo.local||null, observacao:novo.observacao||null, registrada_por:CONEXAO.eu.id });
    if(r1.error) return r1;
    if((novo.anexos||[]).length){
      const r2 = await sbc.from('anexos').insert(novo.anexos.map(x => ({
        instituicao_id:CONEXAO.orgId, doacao_id:id,
        tipo:x.tipo, url:x.url, nome:x.nome||null, criado_por:CONEXAO.eu.id })));
      if(r2.error) return r2;
    }
    return r1;
  })(), 'a doação');
  return novo;
};

dados.criarTecnico = function(t){
  if(!CONEXAO.ligada) return demoDados.criarTecnico(t);
  const id = crypto.randomUUID();
  const novo = Object.assign({ id, quando:new Date(), profissional:SESSAO.nome }, t, { id });
  BD.tecnicos.push(novo);
  pushDB(sbc.from('registros_trabalho').insert({ id, instituicao_id:CONEXAO.orgId,
    pessoa_id:novo.pessoa, tipo:novo.tipo, modo:novo.modo||null, situacao:novo.situacao||null,
    texto:novo.texto, encaminhamento:novo.encaminhamento||null, autor_id:CONEXAO.eu.id }),
    'o registro de trabalho');
  return novo;
};

dados.criarPendencia = function(p){
  if(!CONEXAO.ligada) return demoDados.criarPendencia(p);
  const id = crypto.randomUUID();
  BD.pendencias.push(Object.assign({ id, status:'pendente', profissional:SESSAO.nome }, p, { id }));
  pushDB(sbc.from('pendencias').insert({ id, instituicao_id:CONEXAO.orgId, pessoa_id:p.pessoa,
    texto:p.texto, data_prevista:p.data, responsavel_id:CONEXAO.eu.id }), 'a pendência');
};

dados.entrar = function(pessoaId, localId){
  if(!CONEXAO.ligada) return demoDados.entrar(pessoaId, localId);
  if(BD.presencas.some(p => !p.saida && p.pessoa === pessoaId && p.local === localId)) return null;
  const id = crypto.randomUUID();
  const e = { id, pessoa:pessoaId, local:localId, entrada:new Date(), saida:null,
    porQuem:SESSAO.nome, encerradaAuto:false };
  BD.presencas.push(e);
  pushDB(sbc.from('presencas').insert({ id, instituicao_id:CONEXAO.orgId, pessoa_id:pessoaId,
    unidade_id:localId, por_quem:CONEXAO.eu.id }), 'a entrada');
  return e;
};

dados.sair = function(pessoaId, localId){
  const e = demoDados.sair(pessoaId, localId);
  if(CONEXAO.ligada && e)
    pushDB(sbc.from('presencas').update({ saida: e.saida.toISOString() }).eq('id', e.id), 'a saída');
  return e;
};

dados.trocarFoto = function(pessoaId, url, motivo){
  if(!CONEXAO.ligada) return demoDados.trocarFoto(pessoaId, url, motivo);
  const p = dados.pessoa(pessoaId); if(!p) return null;
  const id = crypto.randomUUID();
  const f = { id, pessoa:pessoaId, url, quando:new Date(), quem:SESSAO.nome,
    motivo: motivo || 'Atualização de foto' };
  BD.fotos.push(f); p.foto = url;
  pushDB(sbc.from('fotos_pessoa').insert({ id, instituicao_id:CONEXAO.orgId, pessoa_id:pessoaId,
    url, motivo:f.motivo, criada_por:CONEXAO.eu.id }), 'o histórico de foto');
  /* a foto em uso (resolução cheia) entra no cadastro logo depois,
     quando quem chamou terminar de atribuir p.foto — por isso o respiro */
  setTimeout(() => sincronizarPessoa(pessoaId), 600);
  return f;
};

dados.encerrarLocal = function(localId){
  const antesPessoas = dados.dentroAgora(localId).length;
  const antesEquipe = dados.dentroAgoraEquipe(localId).length;
  const n = demoDados.encerrarLocal(localId);
  if(CONEXAO.ligada){
    if(antesPessoas > 0)
      pushDB(sbc.from('presencas').update({ saida:new Date().toISOString(), encerrada_auto:true })
        .eq('unidade_id', localId).is('saida', null), 'o encerramento do dia');
    if(antesEquipe > 0)
      pushDB(sbc.from('presencas_equipe').update({ saida:new Date().toISOString(), encerrada_auto:true })
        .eq('unidade_id', localId).eq('tipo', 'presenca').is('saida', null), 'o encerramento da presença da equipe');
  }
  return n;
};

/* ---- presença da equipe: prontuário, turnos e faltas ---- */
dados.entrarEquipe = function(equipeId, localId, funcao){
  if(!CONEXAO.ligada) return demoDados.entrarEquipe(equipeId, localId, funcao);
  if(BD.presEquipe.some(p => p.tipo === 'presenca' && !p.saida && p.equipe === equipeId && p.local === localId))
    return null;
  const id = crypto.randomUUID();
  const u = EQUIPE.find(x => x.id === equipeId);
  const funcaoNome = funcao || (u ? u.funcao : '');
  const funcaoId = funcaoNome ? ((FUNCOES.find(f => f.nome === funcaoNome) || {}).id || null) : null;
  const agr = new Date();
  const e = { id, equipe:equipeId, local:localId, tipo:'presenca', entrada:agr, saida:null,
    quando:agr, funcao:funcaoNome, observacao:'', porQuem:SESSAO.nome, encerradaAuto:false };
  BD.presEquipe.push(e);
  pushDB(sbc.from('presencas_equipe').insert({ id, instituicao_id:CONEXAO.orgId, equipe_id:equipeId,
    unidade_id:localId, tipo:'presenca', funcao_id:funcaoId, registrada_por:CONEXAO.eu.id }), 'a presença da equipe');
  return e;
};

dados.sairEquipe = function(equipeId, localId){
  const e = demoDados.sairEquipe(equipeId, localId);
  if(CONEXAO.ligada && e)
    pushDB(sbc.from('presencas_equipe').update({ saida: e.saida.toISOString() }).eq('id', e.id), 'a saída da equipe');
  return e;
};

dados.registrarFaltaEquipe = function(equipeId, localId, observacao){
  if(!CONEXAO.ligada) return demoDados.registrarFaltaEquipe(equipeId, localId, observacao);
  const id = crypto.randomUUID();
  const u = EQUIPE.find(x => x.id === equipeId);
  const funcaoNome = u ? u.funcao : '';
  const funcaoId = funcaoNome ? ((FUNCOES.find(f => f.nome === funcaoNome) || {}).id || null) : null;
  const agr = new Date();
  const f = { id, equipe:equipeId, local: localId||null, tipo:'falta', entrada:null, saida:null,
    quando:agr, funcao:funcaoNome, observacao: observacao||'', porQuem:SESSAO.nome, encerradaAuto:false };
  BD.presEquipe.push(f);
  pushDB(sbc.from('presencas_equipe').insert({ id, instituicao_id:CONEXAO.orgId, equipe_id:equipeId,
    unidade_id:localId||null, tipo:'falta', funcao_id:funcaoId, observacao:observacao||null,
    registrada_por:CONEXAO.eu.id }), 'a falta da equipe');
  return f;
};

function sincronizarPessoa(pid){
  if(!CONEXAO.ligada) return;
  const p = dados.pessoa(pid); if(!p) return;
  pushDB(sbc.from('pessoas').update({ nome:p.nome, apelido:p.apelido||null, nascimento:p.nasc||null,
    telefone:p.tel||null, cpf:p.cpf||null, sexo:p.sexo||null, observacao:p.obs||null, foto_url:p.foto||null })
    .eq('id', pid), 'a edição do cadastro');
}

/* ---- funções nomeadas que gravam direto ---- */
const demoSalvarEdicao = salvarEdicao;
salvarEdicao = function(){
  const pid = ctx.pessoa;
  demoSalvarEdicao();
  if(CONEXAO.ligada) setTimeout(() => sincronizarPessoa(pid), 800);
};

const demoSalvarPapel = salvarPapel;
salvarPapel = function(uid){
  if(!CONEXAO.ligada) return demoSalvarPapel(uid);
  const nome = $('eq-nome').value.trim(), email = $('eq-email').value.trim().toLowerCase(),
        papel = $('eq-papel').value, obs = $('eq-obs').value.trim(), unid = $('eq-unidade').value,
        funcao = $('eq-funcao').value, acesso = $('eq-acesso').value;
  if(!nome){ $('eq-nome').focus(); return; }
  if(!email.includes('@')){ $('eq-email').focus(); return; }
  const unidId = unid === 'Todas' ? null : ((LOCAIS.find(l => l.curto === unid) || {}).id || null);
  const funcaoId = funcao ? ((FUNCOES.find(f => f.nome === funcao) || {}).id || null) : null;
  const temAcesso = acesso !== 'nao';
  const u = EQUIPE.find(x => x.id === uid);
  if(u){
    Object.assign(u, { nome, email, papel, funcao, acesso, obs, unidade:unid });
    pushDB(sbc.from('equipe').update({ nome, email, papel:P_TELA2DB[papel],
      observacao:obs||null, unidade_id:unidId, funcao_id:funcaoId, tem_acesso:temAcesso })
      .eq('id', uid), 'a alteração do acesso');
  } else {
    const id = crypto.randomUUID();
    EQUIPE.push({ id, nome, email, papel, funcao, acesso, obs, unidade:unid, status:'ativo', desde: iso(new Date()) });
    pushDB(sbc.from('equipe').insert({ id, instituicao_id:CONEXAO.orgId, nome, email,
      papel:P_TELA2DB[papel], observacao:obs||null, unidade_id:unidId, funcao_id:funcaoId,
      tem_acesso:temAcesso }), 'o novo acesso');
  }
  abrirInstituicao('equipe');
  $('org-corpo').insertAdjacentHTML('afterbegin',
    `<div class="nota ok" style="margin-bottom:14px">${esc(nome)} — ${ROTULO_PAPEL[papel]}.
     ${uid ? 'Acesso atualizado.' : 'Pessoa adicionada. Ela entra com o e-mail informado, por código.'}</div>`);
};

const demoSalvarLocal = salvarLocal;
salvarLocal = function(lid){
  if(!CONEXAO.ligada) return demoSalvarLocal(lid);
  const nome = $('lc-nome').value.trim();
  if(!nome){ $('lc-nome').focus(); return; }
  const catSel = $('lc-categoria').value;
  const categoria = catSel === 'Outro' ? ($('lc-categoria-outro').value.trim() || 'Outro') : catSel;
  const campos = { nome, curto: $('lc-curto').value.trim() || nome, categoria,
    tipo: $('lc-tipo').value, capacidade: $('lc-capacidade').value ? +$('lc-capacidade').value : null,
    endereco: $('lc-endereco').value.trim() || null, horario: $('lc-horario').value.trim() || null };
  const l = LOCAIS.find(x => x.id === lid);
  if(l){
    Object.assign(l, campos);
    pushDB(sbc.from('unidades').update(campos).eq('id', lid), 'o local');
  } else {
    const id = crypto.randomUUID();
    LOCAIS.push(Object.assign({ id, ativa:true }, campos));
    pushDB(sbc.from('unidades').insert(Object.assign({ id, instituicao_id:CONEXAO.orgId, ativa:true }, campos)),
      'o novo local');
  }
  abrirInstituicao('locais');
  $('org-corpo').insertAdjacentHTML('afterbegin',
    `<div class="nota ok" style="margin-bottom:14px">${esc(nome)} — local ${lid?'atualizado':'adicionado'}.</div>`);
};

const demoArquivarLocal = arquivarLocal;
arquivarLocal = function(lid){
  const antes = (LOCAIS.find(x => x.id === lid) || {}).ativa;
  demoArquivarLocal(lid);
  const depois = (LOCAIS.find(x => x.id === lid) || {}).ativa;
  if(CONEXAO.ligada && antes !== false && depois === false)
    pushDB(sbc.from('unidades').update({ ativa:false }).eq('id', lid), 'o arquivamento do local');
};
const demoReativarLocal = reativarLocal;
reativarLocal = function(lid){
  demoReativarLocal(lid);
  if(CONEXAO.ligada) pushDB(sbc.from('unidades').update({ ativa:true }).eq('id', lid), 'a reativação do local');
};

/* ---- serviços e recursos — Fase 3b ---- */
const demoSalvarServico = salvarServico;
salvarServico = function(sid){
  if(!CONEXAO.ligada) return demoSalvarServico(sid);
  const nome = $('sv-nome').value.trim();
  if(!nome){ $('sv-nome').focus(); return; }
  const categoria = $('sv-categoria').value.trim() || 'Outros', tipo = $('sv-tipo').value;
  const s = SERVICOS.find(x => x.id === sid);
  if(s){
    Object.assign(s, { nome, cat:categoria, tipo });
    pushDB(sbc.from('servicos').update({ nome, categoria, tipo }).eq('id', sid), 'o serviço');
  } else {
    const id = crypto.randomUUID();
    SERVICOS.push({ id, nome, cat:categoria, tipo, ativo:true, ordem:SERVICOS.length });
    pushDB(sbc.from('servicos').insert({ id, instituicao_id:CONEXAO.orgId, nome, categoria, tipo,
      ordem:SERVICOS.length }), 'o novo serviço');
  }
  abrirInstituicao('servicos');
  $('org-corpo').insertAdjacentHTML('afterbegin',
    `<div class="nota ok" style="margin-bottom:14px">${esc(nome)} — ${sid?'atualizado':'adicionado'}.</div>`);
};
const demoArquivarServico = arquivarServico;
arquivarServico = function(sid){
  const antes = (SERVICOS.find(x => x.id === sid) || {}).ativo;
  demoArquivarServico(sid);
  const depois = (SERVICOS.find(x => x.id === sid) || {}).ativo;
  if(CONEXAO.ligada && antes !== false && depois === false)
    pushDB(sbc.from('servicos').update({ ativo:false }).eq('id', sid), 'o arquivamento do serviço');
};
const demoReativarServico = reativarServico;
reativarServico = function(sid){
  demoReativarServico(sid);
  if(CONEXAO.ligada) pushDB(sbc.from('servicos').update({ ativo:true }).eq('id', sid), 'a reativação do serviço');
};

const demoAdicionarFuncao = adicionarFuncao;
adicionarFuncao = function(){
  if(!CONEXAO.ligada) return demoAdicionarFuncao();
  const nome = $('fn-nova').value.trim();
  if(!nome) return;
  if(FUNCOES.some(f => f.nome.toLowerCase() === nome.toLowerCase())){
    $('fn-nova').value = ''; abrirInstituicao('equipe'); return;
  }
  const id = crypto.randomUUID();
  FUNCOES.push({ id, nome, ativa:true });
  pushDB(sbc.from('funcoes').insert({ id, instituicao_id:CONEXAO.orgId, nome }), 'a nova função');
  abrirInstituicao('equipe');
};
const demoArquivarFuncao = arquivarFuncao;
arquivarFuncao = function(fid){
  demoArquivarFuncao(fid);
  if(CONEXAO.ligada) pushDB(sbc.from('funcoes').update({ ativa:false }).eq('id', fid), 'o arquivamento da função');
};
const demoReativarFuncao = reativarFuncao;
reativarFuncao = function(fid){
  demoReativarFuncao(fid);
  if(CONEXAO.ligada) pushDB(sbc.from('funcoes').update({ ativa:true }).eq('id', fid), 'a reativação da função');
};

const demoDesligar = desligarEquipe;
desligarEquipe = function(uid){
  const antes = (EQUIPE.find(x => x.id === uid) || {}).status;
  demoDesligar(uid);
  const depois = (EQUIPE.find(x => x.id === uid) || {}).status;
  if(CONEXAO.ligada && antes === 'ativo' && depois === 'inativo')
    pushDB(sbc.from('equipe').update({ ativo:false, desligado_em:new Date().toISOString(), auth_id:null })
      .eq('id', uid), 'o desligamento');
};
const demoReligar = religarEquipe;
religarEquipe = function(uid){
  demoReligar(uid);
  if(CONEXAO.ligada)
    pushDB(sbc.from('equipe').update({ ativo:true, desligado_em:null }).eq('id', uid), 'a reativação');
};

const demoSalvarOrg = salvarOrg;
salvarOrg = function(){
  demoSalvarOrg();
  if(CONEXAO.ligada)
    pushDB(sbc.from('instituicoes').update({ nome:ORG.nome, nome_completo:ORG.nomeCompleto||null,
      cidade:ORG.cidade||null, cnpj:ORG.cnpj||null, telefone:ORG.telefone||null,
      endereco:ORG.endereco||null, email:ORG.email||null, site:ORG.site||null,
      responsavel:ORG.responsavel||null }).eq('id', CONEXAO.orgId), 'os dados da instituição');
};

/* "Endereço de envio" não é enviado ao banco — não tem coluna em
   config_email, e persistir esse campo daria a entender que ele controla o
   remetente de verdade, quando hoje o envio real sempre sai do único
   e-mail verificado no Brevo, independente do que estiver escrito aqui. */
const demoSalvarEmail = salvarEmail;
salvarEmail = function(){
  demoSalvarEmail();
  if(CONEXAO.ligada)
    pushDB(sbc.from('config_email').update({ remetente_nome:EMAIL.remetenteNome||null,
      responder_para:EMAIL.responderPara||null, assinatura:EMAIL.assinatura||null,
      hora_resumo:EMAIL.horaResumo||null }).eq('instituicao_id', CONEXAO.orgId),
      'a configuração de envio de e-mail');
};
const demoVirarEvento = virarEvento;
virarEvento = function(i){
  demoVirarEvento(i);
  const e = EMAIL.eventos[i], campo = e && MAPA_EVENTO_EMAIL[e.id];
  if(CONEXAO.ligada && campo)
    pushDB(sbc.from('config_email').update({ [campo]:e.liga }).eq('instituicao_id', CONEXAO.orgId),
      'a configuração de ' + e.nome);
};

const demoSubirLogo = subirLogo;
subirLogo = function(inp){
  demoSubirLogo(inp);
  if(CONEXAO.ligada) setTimeout(() => pushDB(sbc.from('instituicoes')
    .update({ logo_url: ORG.logo }).eq('id', CONEXAO.orgId), 'o logotipo'), 900);
};
const demoTirarLogo = tirarLogo;
tirarLogo = function(){
  demoTirarLogo();
  if(CONEXAO.ligada) pushDB(sbc.from('instituicoes')
    .update({ logo_url:null }).eq('id', CONEXAO.orgId), 'a remoção do logotipo');
};

/* Conectado, o botão de papel vira porta de saída — papel de verdade
   não se troca por clique, se troca em Equipe e acessos. */
const demoTrocarPapel = trocarPapel;
trocarPapel = function(){
  if(!CONEXAO.ligada) return demoTrocarPapel();
  if(confirm('Sair da sua conta?')) sbc.auth.signOut().then(() => location.reload());
};

/* ---- arranque: sessão guardada entra sozinha; visita vê a demo ---- */
(async () => {
  try{
    const { data:{ session } } = await sbc.auth.getSession();
    if(session){ await conectar(); return; }
  }catch(e){ console.error('[banco] sessão', e); }
  const rod = document.querySelector('.rodape-l');
  if(rod && !document.getElementById('bt-entrar')){
    const b = document.createElement('button');
    b.id = 'bt-entrar'; b.textContent = 'Entrar'; b.onclick = abrirEntrar;
    rod.appendChild(b);
  }
})();
