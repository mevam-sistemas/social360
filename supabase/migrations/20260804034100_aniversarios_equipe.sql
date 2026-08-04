alter table social.equipe add column if not exists nascimento date;
alter table social.pessoas add column if not exists email text;

create or replace function public.aniversariantes_pendentes()
returns table(produto text, pessoa_id uuid, nome text, email text, papel text, instituicao text)
language sql security definer set search_path=public,social
as $$
  with papel_modox as (
    select p.id,
      case when bool_or(v.ativo and v.papel='admin') then 'direcao'
           when bool_or(v.ativo and v.papel='gestor') then 'gestao'
           when bool_or(v.ativo and v.papel='professor') then 'professor'
           else 'aluno' end papel,
      coalesce(max(e.nome) filter (where v.ativo),max(ec.nome),'sua instituição') instituicao
    from public.pessoas p
    left join public.vinculos v on v.pessoa_id=p.id
    left join public.escolas e on e.id=v.escola_id
    left join public.matriculas m on m.pessoa_id=p.id and m.status in ('ativa','concluida')
    left join public.turmas t on t.id=m.turma_id
    left join public.cursos c on c.id=t.curso_id
    left join public.escolas ec on ec.id=c.escola_id
    group by p.id
  )
  select 'modox',p.id,p.nome,p.email,pm.papel,pm.instituicao
    from public.pessoas p join papel_modox pm on pm.id=p.id
   where p.nascimento is not null and p.email is not null
     and extract(month from p.nascimento)=extract(month from timezone('America/Sao_Paulo',now()))
     and extract(day from p.nascimento)=extract(day from timezone('America/Sao_Paulo',now()))
     and not exists (select 1 from public.aniversarios_enviados a where a.produto='modox' and a.pessoa_id=p.id and a.ano=extract(year from timezone('America/Sao_Paulo',now()))::int)
  union all
  select '360social',eq.id,eq.nome,eq.email,
         case eq.papel::text when 'presidente' then 'presidencia' when 'coordenador' then 'coordenacao' when 'assistente' then 'assistencia_social' else 'equipe' end,
         coalesce(i.nome,'sua instituição')
    from social.equipe eq join social.instituicoes i on i.id=eq.instituicao_id
   where eq.ativo and eq.nascimento is not null and eq.email is not null and position('@' in eq.email)>1
     and extract(month from eq.nascimento)=extract(month from timezone('America/Sao_Paulo',now()))
     and extract(day from eq.nascimento)=extract(day from timezone('America/Sao_Paulo',now()))
     and not exists (select 1 from public.aniversarios_enviados a where a.produto='360social' and a.pessoa_id=eq.id and a.ano=extract(year from timezone('America/Sao_Paulo',now()))::int)
  union all
  select '360social',md5('social-pessoa:'||sp.id::text)::uuid,sp.nome,sp.email,'pessoa_atendida',coalesce(i.nome,'sua instituição')
    from social.pessoas sp join social.instituicoes i on i.id=sp.instituicao_id
   where sp.nascimento is not null and sp.email is not null and position('@' in sp.email)>1
     and extract(month from sp.nascimento)=extract(month from timezone('America/Sao_Paulo',now()))
     and extract(day from sp.nascimento)=extract(day from timezone('America/Sao_Paulo',now()))
     and not exists (select 1 from public.aniversarios_enviados a where a.produto='360social' and a.pessoa_id=md5('social-pessoa:'||sp.id::text)::uuid and a.ano=extract(year from timezone('America/Sao_Paulo',now()))::int);
$$;
revoke all on function public.aniversariantes_pendentes() from public,anon,authenticated;
grant execute on function public.aniversariantes_pendentes() to service_role;
