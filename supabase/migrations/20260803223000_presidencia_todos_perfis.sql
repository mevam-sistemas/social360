-- A Presidência é o papel administrativo máximo da instituição e precisa
-- conseguir executar qualquer fluxo ao alternar o ponto de vista da tela.
-- A troca visual não altera social.meu_papel(): no banco ele segue presidente.

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
  if v_papel = 'presidente' then
    return v_acao = any(array[
      'ver_presenca','registrar_entrada','buscar_pessoa','criar_pessoa','editar_pessoa',
      'registrar_atend','usar_camera','ver_prontuario','ver_tecnico','criar_tecnico',
      'ver_pendencias','doacoes','ver_painel','relatorios','config_org','gerir_equipe'
    ]);
  end if;

  v_padrao := case v_papel
    when 'operador' then v_acao = any(array[
      'ver_presenca','registrar_entrada','buscar_pessoa','criar_pessoa','registrar_atend','usar_camera'])
    when 'assistente' then v_acao = any(array[
      'ver_presenca','registrar_entrada','buscar_pessoa','criar_pessoa','editar_pessoa',
      'registrar_atend','usar_camera','ver_prontuario','ver_tecnico','criar_tecnico',
      'ver_pendencias','ver_painel'])
    when 'coordenador' then v_acao = any(array[
      'ver_presenca','registrar_entrada','buscar_pessoa','criar_pessoa','editar_pessoa',
      'registrar_atend','usar_camera','ver_prontuario','ver_pendencias','doacoes',
      'ver_painel','relatorios','config_org','gerir_equipe'])
    else false
  end;

  select pp.permitido into v_override
  from social.papel_permissoes pp
  where pp.instituicao_id = v_inst and pp.papel = v_papel and pp.acao = v_acao;

  return coalesce(v_override, v_padrao);
end $$;
