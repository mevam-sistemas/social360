-- Uma pessoa pode exercer várias funções/cargos. O papel de acesso continua
-- único e independente em social.equipe.papel.

create table if not exists social.equipe_funcoes (
  instituicao_id uuid not null references social.instituicoes(id) on delete cascade,
  equipe_id uuid not null references social.equipe(id) on delete cascade,
  funcao_id uuid not null references social.funcoes(id) on delete cascade,
  criada_em timestamptz not null default now(),
  primary key (equipe_id, funcao_id)
);

create index if not exists equipe_funcoes_instituicao_idx
  on social.equipe_funcoes (instituicao_id, equipe_id);

insert into social.equipe_funcoes (instituicao_id,equipe_id,funcao_id)
select e.instituicao_id,e.id,e.funcao_id
from social.equipe e
where e.funcao_id is not null
on conflict (equipe_id,funcao_id) do nothing;

alter table social.equipe_funcoes enable row level security;
drop policy if exists "equipe_funcoes_ver" on social.equipe_funcoes;
create policy "equipe_funcoes_ver" on social.equipe_funcoes for select to authenticated
using (instituicao_id = social.minha_instituicao());
grant select on social.equipe_funcoes to authenticated;

create or replace function social.definir_funcoes_equipe(p_equipe uuid,p_funcoes uuid[])
returns void
language plpgsql
security definer
set search_path = social, public
as $$
declare v_inst uuid := social.minha_instituicao();
begin
  if v_inst is null or not social.pode('gerir_equipe') then raise exception 'sem permissão para gerir equipe'; end if;
  if not exists(select 1 from social.equipe e where e.id=p_equipe and e.instituicao_id=v_inst) then raise exception 'pessoa da equipe inválida'; end if;
  if exists(select 1 from unnest(coalesce(p_funcoes,'{}'::uuid[])) as ids(fid) where not exists(
    select 1 from social.funcoes f where f.id=ids.fid and f.instituicao_id=v_inst)) then raise exception 'função inválida'; end if;

  delete from social.equipe_funcoes where equipe_id=p_equipe and instituicao_id=v_inst;
  insert into social.equipe_funcoes(instituicao_id,equipe_id,funcao_id)
    select v_inst,p_equipe,ids.fid from unnest(coalesce(p_funcoes,'{}'::uuid[])) as ids(fid)
    on conflict do nothing;
  update social.equipe set funcao_id=(coalesce(p_funcoes,'{}'::uuid[]))[1]
    where id=p_equipe and instituicao_id=v_inst;
end $$;

revoke all on function social.definir_funcoes_equipe(uuid,uuid[]) from public;
grant execute on function social.definir_funcoes_equipe(uuid,uuid[]) to authenticated;
