-- O schema social nunca possui RPC pública: todo acesso exige uma sessão válida.
-- A revogação explícita evita que o privilégio padrão PUBLIC torne funções
-- SECURITY DEFINER chamáveis pela API anônima.
do $$
declare
  f record;
  assinatura text;
begin
  for f in
    select n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) as argumentos,
           p.prorettype <> 'pg_catalog.trigger'::regtype as pode_ser_rpc
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'social'
  loop
    assinatura := format('%I.%I(%s)', f.nspname, f.proname, f.argumentos);
    execute format('revoke all on function %s from public, anon', assinatura);
    if f.pode_ser_rpc then
      execute format('grant execute on function %s to authenticated, service_role', assinatura);
    else
      execute format('grant execute on function %s to service_role', assinatura);
    end if;
  end loop;
end
$$;

-- Políticas antigas foram criadas sem TO authenticated e, por isso, apareciam
-- como pertencentes a PUBLIC. A expressão já recusava anônimos, mas restringir
-- o papel também reduz a superfície e torna a intenção verificável.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'social'
       and roles = '{public}'::name[]
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated',
      p.policyname, p.schemaname, p.tablename
    );
  end loop;
end
$$;

revoke usage on schema social from anon;
grant usage on schema social to authenticated, service_role;
