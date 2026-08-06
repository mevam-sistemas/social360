-- Ao separar o 360social em um projeto próprio, tabelas e RLS foram copiadas,
-- mas os GRANTs do papel authenticated não vieram no dump. RLS não substitui
-- o privilégio SQL básico: sem ambos, toda carga autenticada é recusada antes
-- mesmo de a política por instituição ser avaliada.
grant usage on schema social to authenticated, service_role;
revoke usage on schema social from anon;

do $$
declare
  p record;
  comando text;
begin
  for p in
    select distinct tablename, cmd
      from pg_policies
     where schemaname = 'social'
       and 'authenticated' = any(roles)
  loop
    comando := case p.cmd
      when 'ALL' then 'select, insert, update, delete'
      when 'SELECT' then 'select'
      when 'INSERT' then 'insert'
      when 'UPDATE' then 'update'
      when 'DELETE' then 'delete'
    end;
    if comando is not null then
      execute format('grant %s on table social.%I to authenticated', comando, p.tablename);
    end if;
  end loop;
end
$$;

-- Estas duas RPCs são restritas internamente ao e-mail de suporte. Precisam
-- ser executáveis no painel central, mas continuam proibidas para anônimos.
revoke all on function social.painel_resumo_instituicoes() from public, anon;
revoke all on function social.painel_lista_instituicoes() from public, anon;
grant execute on function social.painel_resumo_instituicoes() to authenticated, service_role;
grant execute on function social.painel_lista_instituicoes() to authenticated, service_role;

-- RPCs usadas diretamente pela aplicação e auxiliares referenciadas pelas
-- próprias políticas RLS. Rotinas de e-mail, aniversários, webhooks e triggers
-- não entram nesta lista e permanecem exclusivas do servidor.
grant execute on function social.vincular_meu_acesso() to authenticated;
grant execute on function social.meu_acesso() to authenticated;
grant execute on function social.meu_plano_instituicao() to authenticated;
grant execute on function social.criar_instituicao_completa() to authenticated;
grant execute on function social.criar_minha_instituicao(text,text,text) to authenticated;
grant execute on function social.criar_atendimento_completo(uuid,uuid,uuid,text,text,jsonb,jsonb) to authenticated;
grant execute on function social.criar_doacao_completa(uuid,text,text,text,numeric,text,text,uuid,uuid,text,jsonb) to authenticated;
grant execute on function social.criar_diretiva(text,text,text,text,text,text,text,integer) to authenticated;
grant execute on function social.marcar_diretiva(uuid,boolean) to authenticated;
grant execute on function social.comentar_diretiva(uuid,text) to authenticated;
grant execute on function social.registrar_audicao_diretiva(uuid) to authenticated;
grant execute on function social.definir_funcoes_equipe(uuid,uuid[]) to authenticated;
grant execute on function social.definir_permissao_papel(text,text,boolean) to authenticated;

grant execute on function social.minha_instituicao() to authenticated;
grant execute on function social.meu_papel() to authenticated;
grant execute on function social.eu() to authenticated;
grant execute on function social.pode(text) to authenticated;
grant execute on function social.eh_autor_diretiva(uuid) to authenticated;
