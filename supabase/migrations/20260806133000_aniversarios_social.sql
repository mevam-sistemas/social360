create table if not exists social.aniversarios_enviados (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null,
  ano integer not null,
  destinatario text not null,
  enviado_em timestamptz not null default now(),
  unique (pessoa_id, ano)
);

alter table social.aniversarios_enviados enable row level security;
revoke all on social.aniversarios_enviados from public, anon, authenticated;
grant all on social.aniversarios_enviados to service_role;

create or replace function social.aniversariantes_pendentes()
returns table(pessoa_id uuid, nome text, email text, perfil text, instituicao text)
language sql security definer set search_path=social,public
as $$
  select eq.id,eq.nome,eq.email,
         case eq.papel::text when 'presidente' then 'presidencia'
           when 'coordenador' then 'coordenacao'
           when 'assistente' then 'assistencia_social' else 'equipe' end,
         coalesce(i.nome,'sua instituição')
    from social.equipe eq join social.instituicoes i on i.id=eq.instituicao_id
   where eq.ativo and eq.nascimento is not null and eq.email is not null
     and position('@' in eq.email)>1
     and extract(month from eq.nascimento)=extract(month from timezone('America/Sao_Paulo',now()))
     and extract(day from eq.nascimento)=extract(day from timezone('America/Sao_Paulo',now()))
     and not exists (
       select 1 from social.aniversarios_enviados a
        where a.pessoa_id=eq.id
          and a.ano=extract(year from timezone('America/Sao_Paulo',now()))::int
     )
  union all
  select md5('social-pessoa:'||sp.id::text)::uuid,sp.nome,sp.email,
         'pessoa_atendida',coalesce(i.nome,'sua instituição')
    from social.pessoas sp join social.instituicoes i on i.id=sp.instituicao_id
   where sp.nascimento is not null and sp.email is not null
     and position('@' in sp.email)>1
     and extract(month from sp.nascimento)=extract(month from timezone('America/Sao_Paulo',now()))
     and extract(day from sp.nascimento)=extract(day from timezone('America/Sao_Paulo',now()))
     and not exists (
       select 1 from social.aniversarios_enviados a
        where a.pessoa_id=md5('social-pessoa:'||sp.id::text)::uuid
          and a.ano=extract(year from timezone('America/Sao_Paulo',now()))::int
     );
$$;

revoke all on function social.aniversariantes_pendentes() from public,anon,authenticated;
grant execute on function social.aniversariantes_pendentes() to service_role;
