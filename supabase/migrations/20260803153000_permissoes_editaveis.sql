-- Permissões personalizáveis por instituição e papel.
-- As linhas são overrides; quando não há linha, social.pode() mantém o padrão histórico.

create table if not exists social.papel_permissoes (
  instituicao_id uuid not null references social.instituicoes(id) on delete cascade,
  papel text not null check (papel in ('operador','assistente','coordenador','presidente')),
  acao text not null check (acao in (
    'ver_presenca','registrar_entrada','buscar_pessoa','criar_pessoa','editar_pessoa',
    'registrar_atend','usar_camera','ver_prontuario','ver_tecnico','criar_tecnico',
    'ver_pendencias','doacoes','ver_painel','relatorios','config_org','gerir_equipe'
  )),
  permitido boolean not null,
  alterada_em timestamptz not null default now(),
  alterada_por uuid references social.equipe(id),
  primary key (instituicao_id, papel, acao)
);

alter table social.papel_permissoes enable row level security;

drop policy if exists "pp_ver" on social.papel_permissoes;
create policy "pp_ver" on social.papel_permissoes for select to authenticated
using (instituicao_id = social.minha_instituicao());

-- Escrita normal fica fechada: alterações passam pela RPC abaixo, que valida
-- papel, ação e trava as duas permissões que evitam perda de acesso administrativo.
grant select on social.papel_permissoes to authenticated;

create or replace function social.pode(acao text)
returns boolean
language plpgsql
stable
security definer
set search_path = social, public
as $$
declare
  v_papel text := social.meu_papel();
  v_inst uuid := social.minha_instituicao();
  v_acao text := acao;
  v_override boolean;
  v_padrao boolean;
begin
  v_padrao := case v_papel
    when 'operador' then acao = any(array[
      'ver_presenca','registrar_entrada','buscar_pessoa','criar_pessoa','registrar_atend','usar_camera'])
    when 'assistente' then acao = any(array[
      'ver_presenca','registrar_entrada','buscar_pessoa','criar_pessoa','editar_pessoa',
      'registrar_atend','usar_camera','ver_prontuario','ver_tecnico','criar_tecnico',
      'ver_pendencias','ver_painel'])
    when 'coordenador' then acao = any(array[
      'ver_presenca','registrar_entrada','buscar_pessoa','criar_pessoa','editar_pessoa',
      'registrar_atend','usar_camera','ver_prontuario','ver_pendencias','doacoes',
      'ver_painel','relatorios','config_org','gerir_equipe'])
    when 'presidente' then acao = any(array[
      'ver_presenca','buscar_pessoa','ver_prontuario','ver_tecnico','doacoes',
      'ver_painel','relatorios','config_org','gerir_equipe'])
    else false
  end;

  select pp.permitido into v_override
  from social.papel_permissoes pp
  where pp.instituicao_id = v_inst and pp.papel = v_papel and pp.acao = v_acao;

  return coalesce(v_override, v_padrao);
end $$;

create or replace function social.definir_permissao_papel(
  p_papel text,
  p_acao text,
  p_permitido boolean
)
returns json
language plpgsql
security definer
set search_path = social, public
as $$
declare
  v_inst uuid := social.minha_instituicao();
  v_eu social.equipe := social.eu();
begin
  if v_inst is null or v_eu.id is null then raise exception 'sem instituição vinculada'; end if;
  if social.meu_papel() <> 'presidente' then
    raise exception 'somente a Presidência pode alterar permissões dos perfis';
  end if;
  if p_papel not in ('operador','assistente','coordenador','presidente') then
    raise exception 'perfil inválido';
  end if;
  if p_acao not in (
    'ver_presenca','registrar_entrada','buscar_pessoa','criar_pessoa','editar_pessoa',
    'registrar_atend','usar_camera','ver_prontuario','ver_tecnico','criar_tecnico',
    'ver_pendencias','doacoes','ver_painel','relatorios','config_org','gerir_equipe'
  ) then raise exception 'permissão inválida'; end if;
  if p_papel = 'presidente' and p_acao in ('config_org','gerir_equipe') and not p_permitido then
    raise exception 'esta permissão é obrigatória para evitar perda de acesso administrativo';
  end if;

  insert into social.papel_permissoes
    (instituicao_id, papel, acao, permitido, alterada_em, alterada_por)
  values (v_inst, p_papel, p_acao, p_permitido, now(), v_eu.id)
  on conflict (instituicao_id, papel, acao) do update
    set permitido = excluded.permitido, alterada_em = now(), alterada_por = v_eu.id;

  return json_build_object('papel',p_papel,'acao',p_acao,'permitido',p_permitido);
end $$;

revoke all on function social.definir_permissao_papel(text,text,boolean) from public;
grant execute on function social.definir_permissao_papel(text,text,boolean) to authenticated;
