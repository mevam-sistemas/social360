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
/* teste de 7 dias vencido sem assinatura ativa → app inteiro trava na tela
   de assinar (01/08/2026). Populado por entrarComVinculo() via meu_acesso(). */
let ACESSO = { bloqueado:false, dias_restantes:null, pode_assinar:false };
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
   ENTRAR — clientes já cadastrados (recuperação v8, 03/08/2026). Padrão Arbor Labs: só
   e-mail + senha, sem código por e-mail. Quem esquece a senha pede um link
   de redefinição (abaixo) — isso não é o mesmo que o código de login que
   foi removido, é só uma forma de recuperar acesso à própria conta.
   ============================================================ */
function abrirEntrar(){
  fecharEntrar(); fecharCadastroCompleto();
  const o = document.createElement('div'); o.id = 'entrar-ov';
  o.style.cssText = 'position:fixed;inset:0;background:rgba(15,12,8,.55);z-index:9998;'
    + 'display:flex;align-items:center;justify-content:center;padding:18px';
  const p = (typeof PLANO_ALVO !== 'undefined' && PLANO_ALVO && typeof PLANOS_INST !== 'undefined') ? PLANOS_INST[PLANO_ALVO] : null;
  const notaPlano = p ? `<div style="background:#fff1e6;border:1px solid #f2c99b;border-radius:10px;
      padding:9px 12px;margin-bottom:14px;font-size:13px;color:#8f3907">Plano escolhido:
      <b>${p.nome}</b> — R$ ${p.preco}/mês. Se você ainda não é cliente, clique em "Ainda não sou
      cliente" abaixo pra criar sua conta.</div>` : '';
  o.innerHTML = `<div style="background:#fff;border-radius:18px;padding:26px 24px;max-width:380px;width:100%">
    <h2 style="margin:0 0 6px;font-size:19px">Já sou cliente — Entrar</h2>
    ${notaPlano}
    <p style="margin:0 0 16px;color:#6b625a;font-size:13.5px">Use o e-mail e a senha da sua conta.</p>
    <input id="ent-email" type="email" placeholder="seu@email.com" autocomplete="email"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px">
    <input id="ent-senha" type="password" placeholder="Senha" autocomplete="current-password"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin-top:8px">
    <button onclick="entrarComSenha()" class="bt" style="width:100%;margin-top:12px">Entrar</button>
    <div id="ent-msg" style="margin-top:10px;font-size:13px;color:#8f3907"></div>
    <button onclick="abrirPedirRedefinirSenha()" style="margin-top:14px;background:none;border:none;color:#6b625a;
      font-size:13px;cursor:pointer;text-decoration:underline">Esqueci minha senha</button>
    <button onclick="fecharEntrar();abrirCadastroCompleto()" style="display:block;margin-top:8px;background:none;border:none;color:#6b625a;
      font-size:13px;cursor:pointer;text-decoration:underline">Ainda não sou cliente — criar conta</button>
  </div>`;
  document.body.appendChild(o);
  setTimeout(() => { const e = document.getElementById('ent-email'); if(e) e.focus(); }, 60);
}
function fecharEntrar(){ const o = document.getElementById('entrar-ov'); if(o) o.remove(); }
function abrirPedirRedefinirSenha(){
  const emailAtual = (document.getElementById('ent-email')?.value || '').trim().toLowerCase();
  fecharEntrar();
  const o = document.createElement('div'); o.id = 'pedir-redefinir-ov';
  o.style.cssText = 'position:fixed;inset:0;background:rgba(15,12,8,.55);z-index:9998;'
    + 'display:flex;align-items:center;justify-content:center;padding:18px';
  o.innerHTML = `<div style="background:#fff;border-radius:18px;padding:26px 24px;max-width:380px;width:100%">
    <h2 style="margin:0 0 6px;font-size:19px">Recuperar acesso</h2>
    <p style="margin:0 0 16px;color:#6b625a;font-size:13.5px">Informe o e-mail da sua conta. Você receberá um link para escolher uma nova senha.</p>
    <input id="pr-email" type="email" placeholder="seu@email.com" autocomplete="email"
      value="${esc(emailAtual)}"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px">
    <button id="pr-enviar" onclick="pedirRedefinirSenha()" class="bt" style="width:100%;margin-top:12px">Enviar link de recuperação</button>
    <div id="pr-msg" aria-live="polite" style="margin-top:10px;font-size:13px;color:#8f3907"></div>
    <button onclick="fecharPedirRedefinirSenha();abrirEntrar()" style="margin-top:14px;background:none;border:none;color:#6b625a;
      font-size:13px;cursor:pointer;text-decoration:underline">Voltar para entrar</button>
  </div>`;
  document.body.appendChild(o);
  setTimeout(() => { const e = document.getElementById('pr-email'); if(e) e.focus(); }, 60);
}
function fecharPedirRedefinirSenha(){ const o = document.getElementById('pedir-redefinir-ov'); if(o) o.remove(); }
async function entrarComSenha(){
  const email = (document.getElementById('ent-email').value || '').trim().toLowerCase();
  const senha = document.getElementById('ent-senha').value || '';
  const msg = document.getElementById('ent-msg');
  if(!email.includes('@')){ msg.textContent = 'Confira o e-mail.'; return; }
  if(!senha){ msg.textContent = 'Digite sua senha.'; return; }
  msg.textContent = 'Entrando…';
  const { error } = await sbc.auth.signInWithPassword({ email, password: senha });
  if(error){ msg.textContent = 'E-mail ou senha não conferem.'; return; }
  fecharEntrar();
  conectar();
}
async function pedirRedefinirSenha(){
  const email = (document.getElementById('pr-email')?.value || '').trim().toLowerCase();
  const msg = document.getElementById('pr-msg');
  const botao = document.getElementById('pr-enviar');
  if(!email.includes('@')){ msg.textContent = 'Confira o e-mail informado.'; return; }
  msg.textContent = 'Enviando link de redefinição…';
  botao.disabled = true;
  const { error } = await sbc.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if(error){
    console.error('[banco] redefinir senha', error);
    msg.textContent = 'Não consegui enviar agora. Tente de novo em instantes.';
    botao.disabled = false;
    return;
  }
  document.getElementById('pr-email').disabled = true;
  botao.textContent = 'Link solicitado';
  msg.style.color = '#12805c';
  msg.textContent = 'Se esse e-mail estiver cadastrado, o link chegará em alguns minutos. Confira também o spam.';
}

/* ============================================================
   REDEFINIR SENHA — a pessoa chega aqui pelo link de "esqueci minha
   senha" (evento PASSWORD_RECOVERY do Supabase, tratado no arranque lá
   embaixo). Único jeito de recuperar acesso agora que não existe mais
   código por e-mail.
   ============================================================ */
function abrirRedefinirSenha(){
  fecharEntrar(); fecharPedirRedefinirSenha(); fecharCadastroCompleto();
  const o = document.createElement('div'); o.id = 'redefinir-ov';
  o.style.cssText = 'position:fixed;inset:0;background:rgba(15,12,8,.55);z-index:9998;'
    + 'display:flex;align-items:center;justify-content:center;padding:18px';
  o.innerHTML = `<div style="background:#fff;border-radius:18px;padding:26px 24px;max-width:380px;width:100%">
    <h2 style="margin:0 0 6px;font-size:19px">Escolher nova senha</h2>
    <p style="margin:0 0 16px;color:#6b625a;font-size:13.5px">Defina a nova senha da sua conta.</p>
    <input id="rs-senha" type="password" placeholder="Nova senha (mínimo 6 caracteres)" autocomplete="new-password"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px">
    <button onclick="confirmarRedefinirSenha()" class="bt" style="width:100%;margin-top:12px">Salvar nova senha</button>
    <div id="rs-msg" style="margin-top:10px;font-size:13px;color:#8f3907"></div>
  </div>`;
  document.body.appendChild(o);
  setTimeout(() => { const e = document.getElementById('rs-senha'); if(e) e.focus(); }, 60);
}
async function confirmarRedefinirSenha(){
  const senha = document.getElementById('rs-senha').value || '';
  const msg = document.getElementById('rs-msg');
  if(senha.length < 6){ msg.textContent = 'A senha precisa de pelo menos 6 caracteres.'; return; }
  msg.textContent = 'Salvando…';
  const { error } = await sbc.auth.updateUser({ password: senha });
  if(error){ console.error('[banco] redefinir senha', error); msg.textContent = 'Não consegui salvar agora. Tente de novo.'; return; }
  const o = document.getElementById('redefinir-ov'); if(o) o.remove();
  await conectar();
}

/* ============================================================
   CONECTAR — vincula a conta à equipe e troca a fonte dos dados
   ============================================================ */
async function conectar(){
  const { data, error } = await sbc.rpc('vincular_meu_acesso');
  if(error){
    avisoDB('a conexão'); await sbc.auth.signOut(); return;
  }
  if(data){ await entrarComVinculo(data); return; }

  // sem vínculo: se veio de um cadastro completo cuja confirmação de e-mail
  // demorou (a pessoa clicou no link de confirmação minutos ou dias depois
  // do formulário), os dados do cadastro ficaram guardados no metadata da
  // própria conta desde o signUp — finaliza a criação da instituição agora,
  // sem pedir pra preencher tudo de novo.
  const { data: userData } = await sbc.auth.getUser();
  const meta = (userData && userData.user && userData.user.user_metadata) || {};
  if(meta.tipo_pessoa){
    const { data: inst, error: instErr } = await sbc.rpc('criar_instituicao_completa');
    if(!instErr && inst){ await entrarComVinculo(inst); return; }
    console.error('[banco] criar instituição (retomada)', instErr);
  }
  avisoDB('a conexão'); await sbc.auth.signOut();
}

async function entrarComVinculo(data){
  CONEXAO.eu = data; CONEXAO.orgId = data.instituicao_id;
  try{
    await carregarTudo();
  }catch(e){
    console.error('[banco] carga', e);
    avisoDB('a carga dos dados'); return;
  }
  CONEXAO.ligada = true;
  // sessão de verdade confirmada: some com a tela de boas-vindas (01/08/2026)
  // — só existia pra cobrir o painel de demonstração até aqui.
  const bv = document.getElementById('boas-vindas'); if(bv) bv.remove();
  const pt = P_DB2TELA[data.papel] || 'operador';
  SESSAO = { papel: pt, nome: data.nome, rotulo: ROTULO_PAPEL[pt] };
  document.querySelectorAll('.rodape-l button').forEach(b => {
    // bt-entrar e bt-criar-conta eram a porta de entrada; conectado, quem
    // sai usa o botão "Trocar" de sempre (vira "Sair" abaixo) — sem os
    // dois ficarem lado a lado dizendo "Sair" duas vezes.
    if(b.id === 'bt-criar-conta' || b.id === 'bt-entrar'){ b.remove(); return; }
    const t = b.textContent.trim();
    if(t === 'Trocar'){ b.textContent = 'Sair'; b.onclick = trocarPapel; }
  });
  identidade();

  // checa se o teste de 7 dias venceu sem assinatura ativa — se sim, a
  // instituição inteira fica travada na tela de assinar até alguém com
  // permissão renovar. Ninguém perde dado nenhum: só o acesso fica preso.
  let acesso = { bloqueado:false };
  try{
    const { data: a, error: eAcesso } = await sbc.rpc('meu_acesso');
    if(!eAcesso && a) acesso = a;
  }catch(e){ console.error('[banco] acesso', e); }
  ACESSO = acesso;

  if(ACESSO.bloqueado){
    abrirInstituicao('plano');
    return;
  }
  // veio de um card de plano no site (360social.com.br/#planos) — abre já
  // na aba de assinatura com o plano certo destacado, em vez de largar a
  // pessoa no painel geral pra ela ter que descobrir sozinha onde assina.
  if(PLANO_ALVO && typeof abrirInstituicao === 'function'){
    abrirInstituicao('plano');
    try{ history.replaceState(null, '', location.pathname); }catch(e){}
  } else {
    irMenu(inicioDoPapel());
  }
}

/* ============================================================
   CRIAR CONTA — cadastro completo PJ/PF (01/08/2026). Porta de entrada
   única de cliente novo: sem código por e-mail, sem "só olhar a
   demonstração" — o teste de sete dias grátis É a demonstração.
   ============================================================ */
let CC_TIPO = 'pj';
function abrirCadastroCompleto(){
  fecharCadastroCompleto(); fecharEntrar();
  const o = document.createElement('div'); o.id = 'cad-completo-ov';
  o.style.cssText = 'position:fixed;inset:0;background:rgba(15,12,8,.55);z-index:9998;'
    + 'display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto';
  const p = (typeof PLANO_ALVO !== 'undefined' && PLANO_ALVO && typeof PLANOS_INST !== 'undefined') ? PLANOS_INST[PLANO_ALVO] : null;
  const notaPlano = p ? `<div style="background:#fff1e6;border:1px solid #f2c99b;border-radius:10px;
      padding:9px 12px;margin-bottom:14px;font-size:13px;color:#8f3907">Plano escolhido:
      <b>${p.nome}</b> — R$ ${p.preco}/mês. Depois de criar sua conta, já te levamos direto pra assinar.</div>` : '';
  o.innerHTML = `<div style="background:#fff;border-radius:18px;padding:26px 24px;max-width:440px;width:100%;margin:24px 0">
    <h2 style="margin:0 0 6px;font-size:19px">Criar minha conta</h2>
    ${notaPlano}
    <p style="margin:0 0 16px;color:#6b625a;font-size:13.5px">Sete dias grátis pra testar de verdade,
      sem cartão. Depois do teste, é só assinar pra continuar — sem perder nada do que já foi feito.</p>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button type="button" id="cc-tipo-pj" onclick="ccEscolherTipo('pj')" class="bt" style="flex:1">Pessoa jurídica</button>
      <button type="button" id="cc-tipo-pf" onclick="ccEscolherTipo('pf')" class="bt g" style="flex:1">Pessoa física</button>
    </div>
    <label style="font-size:13px;color:#6b625a" id="cc-doc-label">CNPJ</label>
    <input id="cc-documento" placeholder="Só números" inputmode="numeric"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin:4px 0 10px;box-sizing:border-box">
    <label style="font-size:13px;color:#6b625a" id="cc-nome-inst-label">Nome da instituição</label>
    <input id="cc-nome-inst" placeholder="Ex.: Projeto Social Cidade Melhor" autocomplete="organization"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin:4px 0 10px;box-sizing:border-box">
    <label style="font-size:13px;color:#6b625a">Seu nome completo</label>
    <input id="cc-nome-pessoa" placeholder="Nome do responsável" autocomplete="name"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin:4px 0 10px;box-sizing:border-box">
    <label style="font-size:13px;color:#6b625a">Telefone / WhatsApp</label>
    <input id="cc-telefone" placeholder="(DD) 9 9999-9999" autocomplete="tel"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin:4px 0 10px;box-sizing:border-box">
    <label style="font-size:13px;color:#6b625a">Cidade</label>
    <input id="cc-cidade" placeholder="Ex.: Itajaí — SC"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin:4px 0 10px;box-sizing:border-box">
    <label style="font-size:13px;color:#6b625a">Endereço <span style="opacity:.6">— opcional</span></label>
    <input id="cc-endereco" placeholder="Rua, número, bairro"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin:4px 0 10px;box-sizing:border-box">
    <label style="font-size:13px;color:#6b625a">E-mail</label>
    <input id="cc-email" type="email" placeholder="seu@email.com" autocomplete="email"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin:4px 0 10px;box-sizing:border-box">
    <label style="font-size:13px;color:#6b625a">Senha</label>
    <input id="cc-senha" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password"
      style="width:100%;padding:11px 12px;border:1.5px solid #d8d0c6;border-radius:10px;font-size:15px;margin:4px 0 14px;box-sizing:border-box">
    <button onclick="confirmarCadastroCompleto()" class="bt" style="width:100%">Criar conta e começar meu teste</button>
    <div id="cc-msg" style="margin-top:10px;font-size:13px;color:#8f3907"></div>
    <button onclick="fecharCadastroCompleto();abrirEntrar()" style="margin-top:14px;background:none;border:none;color:#6b625a;
      font-size:13px;cursor:pointer;text-decoration:underline">Já sou cliente — entrar</button>
  </div>`;
  document.body.appendChild(o);
  CC_TIPO = 'pj';
  setTimeout(() => { const e = document.getElementById('cc-documento'); if(e) e.focus(); }, 60);
}
function fecharCadastroCompleto(){ const o = document.getElementById('cad-completo-ov'); if(o) o.remove(); }
function ccEscolherTipo(t){
  CC_TIPO = t;
  const bpj = document.getElementById('cc-tipo-pj'), bpf = document.getElementById('cc-tipo-pf');
  if(bpj) bpj.className = 'bt' + (t==='pj' ? '' : ' g');
  if(bpf) bpf.className = 'bt' + (t==='pf' ? '' : ' g');
  const dl = document.getElementById('cc-doc-label'); if(dl) dl.textContent = t==='pj' ? 'CNPJ' : 'CPF';
  const nl = document.getElementById('cc-nome-inst-label');
  if(nl) nl.textContent = t==='pj' ? 'Nome da instituição' : 'Nome do projeto ou iniciativa';
}
async function confirmarCadastroCompleto(){
  const doc = (document.getElementById('cc-documento').value || '').trim();
  const nomeInst = (document.getElementById('cc-nome-inst').value || '').trim();
  const nomePessoa = (document.getElementById('cc-nome-pessoa').value || '').trim();
  const telefone = (document.getElementById('cc-telefone').value || '').trim();
  const cidade = (document.getElementById('cc-cidade').value || '').trim();
  const endereco = (document.getElementById('cc-endereco').value || '').trim();
  const email = (document.getElementById('cc-email').value || '').trim().toLowerCase();
  const senha = document.getElementById('cc-senha').value || '';
  const msg = document.getElementById('cc-msg');
  const docDigitos = doc.replace(/\D/g, '');

  if(CC_TIPO === 'pj' && docDigitos.length !== 14){ msg.textContent = 'CNPJ precisa ter 14 dígitos.'; return; }
  if(CC_TIPO === 'pf' && docDigitos.length !== 11){ msg.textContent = 'CPF precisa ter 11 dígitos.'; return; }
  if(!nomeInst){ msg.textContent = 'Dá um nome pra sua instituição ou projeto.'; return; }
  if(!nomePessoa){ msg.textContent = 'Falta o seu nome completo.'; return; }
  if(!email.includes('@')){ msg.textContent = 'Confira o e-mail.'; return; }
  if(senha.length < 6){ msg.textContent = 'A senha precisa de pelo menos 6 caracteres.'; return; }

  msg.textContent = 'Criando sua conta…';
  // emailRedirectTo é essencial aqui: o projeto Supabase é compartilhado
  // entre 360social e MODOX (mesmo backend de autenticação), então sem
  // isso o link de confirmação usa a "Site URL" padrão do projeto — que é
  // do MODOX — e a pessoa confirma o e-mail mas cai dentro do app errado.
  // Mesma lógica já usada em pedirRedefinirSenha() logo acima.
  const { data: signData, error: signErr } = await sbc.auth.signUp({
    email, password: senha,
    options: { data: {
      tipo_pessoa: CC_TIPO, documento: docDigitos, nome_instituicao: nomeInst,
      nome_pessoa: nomePessoa, telefone, cidade, endereco
    }, emailRedirectTo: location.origin + location.pathname }
  });
  if(signErr){
    console.error('[banco] signUp', signErr);
    msg.textContent = (signErr.message || '').toLowerCase().includes('already registered')
      ? 'Este e-mail já tem conta — use "Já sou cliente, entrar".'
      : 'Não consegui criar a conta agora. Confira os dados e tente de novo.';
    return;
  }
  if(!signData.session){
    // projeto exige confirmação de e-mail: os dados já estão salvos na
    // conta (metadata) — conectar() finaliza a instituição sozinho assim
    // que a pessoa voltar autenticada pelo link.
    msg.textContent = 'Quase lá! Te mandamos um e-mail de confirmação — clique no link pra começar seu teste de 7 dias.';
    return;
  }
  msg.textContent = 'Preparando sua instituição…';
  const { data, error } = await sbc.rpc('criar_instituicao_completa');
  if(error || !data){
    console.error('[banco] criar instituição', error);
    msg.textContent = 'Sua conta foi criada, mas não consegui preparar a instituição agora. Feche e entre de novo em instantes — sua conta e senha já funcionam.';
    return;
  }
  fecharCadastroCompleto();
  await entrarComVinculo(data);
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
  const [orgs, unis, srvs, eqp, fns, cfgsEmail, audit, emailsLog] = await Promise.all([
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
    pega(sbc.from('auditoria').select('*').order('quando', { ascending:false }).limit(300), 'auditoria'),
    /* emails_log: mesma regra de permissão de config_email/auditoria (RLS
       exige pode('config_org') ou pode('relatorios')) — quem não pode,
       recebe zero linhas, sem erro. Tela "Log de envios" dentro de
       Envios por e-mail (ver blocoLogEmail() em index.html). */
    pega(sbc.from('emails_log').select('*').eq('instituicao_id', CONEXAO.orgId)
      .order('enviado_em', { ascending:false }).limit(100), 'log de envios')
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

  BD.emailsLog.length = 0;
  emailsLog.forEach(l => BD.emailsLog.push({ id:l.id, evento:l.evento,
    destinatario_email:l.destinatario_email, destinatario_nome:l.destinatario_nome,
    enviado_em:new Date(l.enviado_em), sucesso:l.sucesso, erro:l.erro||null }));

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
  // atendimento + serviços + anexos numa transação só no banco (RPC) — antes
  // eram 3 inserts separados aqui; se o 2º ou 3º falhasse depois do 1º já
  // ter sido gravado, ficava um atendimento incompleto sem ninguém perceber
  // na tela (achado numa auditoria de segurança, 03/08/2026 — ver
  // db/20-transacoes-atomicas.sql, função criar_atendimento_completo).
  pushDB(sbc.rpc('criar_atendimento_completo', {
    p_id: id, p_pessoa_id: novo.pessoa, p_unidade_id: novo.local || null,
    p_local_descricao: novo.localDescricao || null, p_observacao: novo.obs || null,
    p_servicos: (novo.servicos || []).map(s => ({ servico_id: s, quantidade: (novo.quantidades && novo.quantidades[s]) || 1 })),
    p_anexos: (novo.anexos || []).map(x => ({ tipo: x.tipo, url: x.url, nome: x.nome || null }))
  }), 'o atendimento');
  return novo;
};

dados.criarDoacao = function(d){
  if(!CONEXAO.ligada) return demoDados.criarDoacao(d);
  const id = crypto.randomUUID();
  const novo = Object.assign({ id, quando:new Date(), responsavel:SESSAO.nome, observacao:'', anexos:[] }, d, { id });
  BD.doacoes.push(novo);
  // doação + anexos numa transação só (mesmo motivo do atendimento acima —
  // ver db/20-transacoes-atomicas.sql, função criar_doacao_completa).
  pushDB(sbc.rpc('criar_doacao_completa', {
    p_id: id, p_tipo: novo.tipo, p_item: novo.item, p_categoria: novo.categoria || null,
    p_quantidade: novo.qtd, p_quem: novo.quem, p_unidade_id: novo.local || null,
    p_observacao: novo.observacao || null,
    p_anexos: (novo.anexos || []).map(x => ({ tipo: x.tipo, url: x.url, nome: x.nome || null }))
  }), 'a doação');
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
    pushDB(sbc.from('presencas').update({ saida: e.saida.toISOString() })
      .eq('id', e.id).eq('instituicao_id', CONEXAO.orgId), 'a saída');
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
        .eq('unidade_id', localId).eq('instituicao_id', CONEXAO.orgId).is('saida', null), 'o encerramento do dia');
    if(antesEquipe > 0)
      pushDB(sbc.from('presencas_equipe').update({ saida:new Date().toISOString(), encerrada_auto:true })
        .eq('unidade_id', localId).eq('instituicao_id', CONEXAO.orgId).eq('tipo', 'presenca').is('saida', null),
        'o encerramento da presença da equipe');
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
    pushDB(sbc.from('presencas_equipe').update({ saida: e.saida.toISOString() })
      .eq('id', e.id).eq('instituicao_id', CONEXAO.orgId), 'a saída da equipe');
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
    .eq('id', pid).eq('instituicao_id', CONEXAO.orgId), 'a edição do cadastro');
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
      .eq('id', uid).eq('instituicao_id', CONEXAO.orgId), 'a alteração do acesso');
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
    pushDB(sbc.from('unidades').update(campos).eq('id', lid).eq('instituicao_id', CONEXAO.orgId), 'o local');
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
    pushDB(sbc.from('unidades').update({ ativa:false }).eq('id', lid).eq('instituicao_id', CONEXAO.orgId),
      'o arquivamento do local');
};
const demoReativarLocal = reativarLocal;
reativarLocal = function(lid){
  demoReativarLocal(lid);
  if(CONEXAO.ligada) pushDB(sbc.from('unidades').update({ ativa:true }).eq('id', lid).eq('instituicao_id', CONEXAO.orgId),
    'a reativação do local');
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
    pushDB(sbc.from('servicos').update({ nome, categoria, tipo }).eq('id', sid).eq('instituicao_id', CONEXAO.orgId),
      'o serviço');
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
    pushDB(sbc.from('servicos').update({ ativo:false }).eq('id', sid).eq('instituicao_id', CONEXAO.orgId),
      'o arquivamento do serviço');
};
const demoReativarServico = reativarServico;
reativarServico = function(sid){
  demoReativarServico(sid);
  if(CONEXAO.ligada) pushDB(sbc.from('servicos').update({ ativo:true }).eq('id', sid).eq('instituicao_id', CONEXAO.orgId),
    'a reativação do serviço');
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
  if(CONEXAO.ligada) pushDB(sbc.from('funcoes').update({ ativa:false }).eq('id', fid).eq('instituicao_id', CONEXAO.orgId),
    'o arquivamento da função');
};
const demoReativarFuncao = reativarFuncao;
reativarFuncao = function(fid){
  demoReativarFuncao(fid);
  if(CONEXAO.ligada) pushDB(sbc.from('funcoes').update({ ativa:true }).eq('id', fid).eq('instituicao_id', CONEXAO.orgId),
    'a reativação da função');
};

const demoDesligar = desligarEquipe;
desligarEquipe = function(uid){
  const antes = (EQUIPE.find(x => x.id === uid) || {}).status;
  demoDesligar(uid);
  const depois = (EQUIPE.find(x => x.id === uid) || {}).status;
  if(CONEXAO.ligada && antes === 'ativo' && depois === 'inativo')
    pushDB(sbc.from('equipe').update({ ativo:false, desligado_em:new Date().toISOString(), auth_id:null })
      .eq('id', uid).eq('instituicao_id', CONEXAO.orgId), 'o desligamento');
};
const demoReligar = religarEquipe;
religarEquipe = function(uid){
  demoReligar(uid);
  if(CONEXAO.ligada)
    pushDB(sbc.from('equipe').update({ ativo:true, desligado_em:null })
      .eq('id', uid).eq('instituicao_id', CONEXAO.orgId), 'a reativação');
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
const LOGO_BUCKET = 'logos-instituicoes';
function blobDeDataUrl(u){
  const [cabecalho, b64] = u.split(','), mime = (cabecalho.match(/^data:([^;]+)/)||[])[1] || 'image/webp';
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type:mime });
}
subirLogo = async function(inp){
  const logo = await demoSubirLogo(inp);
  if(!logo || !CONEXAO.ligada) return;
  const caminho = `${CONEXAO.orgId}/logo.webp`;
  try{
    const arquivo = blobDeDataUrl(logo);
    const { error: envioErro } = await sbc.storage.from(LOGO_BUCKET)
      .upload(caminho, arquivo, { contentType:'image/webp', cacheControl:'3600', upsert:true });
    if(envioErro) throw envioErro;
    const { data: publico } = sbc.storage.from(LOGO_BUCKET).getPublicUrl(caminho);
    const logoUrl = `${publico.publicUrl}?v=${Date.now()}`;
    const { error: bancoErro } = await sbc.from('instituicoes')
      .update({ logo_url:logoUrl }).eq('id', CONEXAO.orgId);
    if(bancoErro) throw bancoErro;
    ORG.logo = logoUrl; identidade(); abrirInstituicao('identidade');
    mensagemLogo('Logotipo salvo.', true);
  }catch(e){
    console.error('[banco] salvar logotipo', e);
    mensagemLogo('Não foi possível salvar o logotipo. Tente novamente.', false);
    avisoDB('o logotipo');
  }
};
const demoTirarLogo = tirarLogo;
tirarLogo = async function(){
  demoTirarLogo();
  if(!CONEXAO.ligada) return;
  const caminho = `${CONEXAO.orgId}/logo.webp`;
  const { error } = await sbc.from('instituicoes')
    .update({ logo_url:null }).eq('id', CONEXAO.orgId);
  if(error){ console.error('[banco] remover logotipo', error); avisoDB('a remoção do logotipo'); return; }
  const { error: removerErro } = await sbc.storage.from(LOGO_BUCKET).remove([caminho]);
  if(removerErro) console.error('[banco] remover arquivo do logotipo', removerErro);
};

/* Conectado, o botão de papel vira porta de saída — papel de verdade
   não se troca por clique, se troca em Equipe e acessos. */
const demoTrocarPapel = trocarPapel;
trocarPapel = function(){
  if(!CONEXAO.ligada) return demoTrocarPapel();
  if(confirm('Sair da sua conta?')) sbc.auth.signOut().then(() => location.reload());
};

/* ============================================================
   PLANO E ASSINATURA — cobrança mensal recorrente da instituição no
   Mercado Pago (01/08/2026). Mesmo padrão do "plano da escola" já em
   produção no MODOX: uma Edge Function cria o /preapproval e devolve o
   link de checkout; o mp-webhook (compartilhado pelos dois produtos)
   confirma o pagamento depois e ativa sozinho — esta tela só pergunta de
   tempos em tempos se já ativou.
   ============================================================ */
async function carregarPlano(){
  const { data, error } = await sbc.rpc('meu_plano_instituicao');
  if(error){ console.error('[banco] plano', error); return; }
  Object.assign(PLANO, { plano:data?.plano||null, status:data?.status||'sem_assinatura',
    ativa_ate:data?.ativa_ate||null });
  const el = document.getElementById('plano-tela');
  if(el) el.outerHTML = blocoPlano();
}
async function assinarPlanoInstituicao(plano){
  if(!CONEXAO.ligada) return;
  const m = document.getElementById('m-plano');
  if(m){ m.textContent = 'Abrindo pagamento…'; m.style.color = 'var(--tx3)'; }
  document.querySelectorAll('#plano-opcoes button').forEach(b => b.disabled = true);
  try{
    const { data, error } = await sbc.functions.invoke('mp-assinatura-instituicao', { body: { plano } });
    if(error) throw new Error(error.message || 'não consegui iniciar a assinatura');
    if(!data?.init_point) throw new Error(data?.error || 'o Mercado Pago não devolveu o link de pagamento');
    const aba = window.open(data.init_point, '_blank');
    esperarPlanoInstituicao(!aba, data.init_point);
  }catch(e){
    document.querySelectorAll('#plano-opcoes button').forEach(b => b.disabled = false);
    if(m){ m.textContent = 'Ops: ' + e.message; m.style.color = 'var(--rx, #b3261e)'; }
  }
}
function esperarPlanoInstituicao(bloqueado, url){
  const m = document.getElementById('m-plano'); if(!m) return;
  m.style.color = 'var(--tx3)';
  m.innerHTML = `${bloqueado ? `O navegador bloqueou a nova aba — <a href="${url}" target="_blank" rel="noopener">toque aqui para pagar</a>. ` : 'O pagamento abriu em outra aba. '}Esta tela avisa sozinha quando o Mercado Pago autorizar a assinatura.`;
  let n = 0;
  const timer = setInterval(async () => {
    n++;
    const { data: p } = await sbc.rpc('meu_plano_instituicao');
    if(p?.status === 'ativa'){
      clearInterval(timer);
      Object.assign(PLANO, { plano:p.plano||null, status:p.status, ativa_ate:p.ativa_ate||null });
      const el = document.getElementById('plano-tela');
      if(el) el.outerHTML = blocoPlano();
      return;
    }
    if(n > 150){ clearInterval(timer);
      m.textContent = 'Ainda não veio a confirmação. Se você já autorizou no Mercado Pago, ela deve cair em instantes — pode fechar e reabrir esta tela depois.';
      return;
    }
    m.textContent = n < 15 ? 'Verificando…' : 'Ainda verificando… (' + Math.floor(n * 4 / 60) + ' min)';
  }, 4000);
}

/* link de "esqueci minha senha" volta pra cá com esse evento — único jeito
   de recuperar acesso agora que não existe mais código por e-mail. */
sbc.auth.onAuthStateChange((event) => {
  if(event === 'PASSWORD_RECOVERY') abrirRedefinirSenha();
});

/* ---- arranque: sessão guardada entra sozinha; visita vê a tela de
   boas-vindas (Entrar / Criar conta) — nunca a demonstração (01/08/2026),
   que só continua existindo por baixo como esqueleto de tela, sem
   aparecer pra ninguém até logar de verdade. ---- */
(async () => {
  try{
    const { data:{ session } } = await sbc.auth.getSession();
    if(session){ await conectar(); return; }
  }catch(e){ console.error('[banco] sessão', e); }
  const rod = document.querySelector('.rodape-l');
  if(rod && !document.getElementById('bt-entrar')){
    const b1 = document.createElement('button');
    b1.id = 'bt-entrar'; b1.textContent = 'Entrar'; b1.title = 'Já sou cliente'; b1.onclick = abrirEntrar;
    const b2 = document.createElement('button');
    b2.id = 'bt-criar-conta'; b2.textContent = 'Criar conta'; b2.title = 'Quero começar — 7 dias grátis';
    b2.style.cssText = 'background:var(--lar);color:#fff;border-color:var(--lar)';
    b2.onclick = abrirCadastroCompleto;
    rod.appendChild(b1); rod.appendChild(b2);
  }
  // veio de um card de plano no site (?plano=...) e não tem sessão salva:
  // quem clica em "Testar 7 dias grátis" a partir de um plano específico é,
  // na esmagadora maioria, gente nova — manda direto pro cadastro completo
  // (com "já sou cliente" como link secundário lá dentro), em vez de abrir
  // a tela de login e a pessoa achar que precisa já ter conta.
  if(typeof PLANO_ALVO !== 'undefined' && PLANO_ALVO) abrirCadastroCompleto();
})();
