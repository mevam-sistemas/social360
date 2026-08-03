-- Estoque rastreável sobre os movimentos de doação já existentes.
-- O histórico antigo é preservado; novos movimentos exigem local de armazenamento.

create table if not exists social.locais_estoque (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid not null references social.instituicoes(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 80),
  descricao text,
  ativo boolean not null default true,
  criada_em timestamptz not null default now(),
  criada_por uuid references social.equipe(id)
);
create unique index if not exists locais_estoque_nome_unico
  on social.locais_estoque (instituicao_id, lower(trim(nome)));

alter table social.doacoes
  add column if not exists local_estoque_id uuid references social.locais_estoque(id);
create index if not exists doacoes_estoque_movimento
  on social.doacoes (instituicao_id, local_estoque_id, item, unidade_medida, quando desc);

create table if not exists social.doacao_observacoes (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid not null references social.instituicoes(id) on delete cascade,
  doacao_id uuid not null references social.doacoes(id) on delete cascade,
  texto text not null check (length(trim(texto)) between 1 and 2000),
  criada_por uuid not null references social.equipe(id),
  criada_em timestamptz not null default now()
);
create index if not exists doacao_observacoes_linha_tempo
  on social.doacao_observacoes (doacao_id, criada_em);

alter table social.locais_estoque enable row level security;
alter table social.doacao_observacoes enable row level security;

drop policy if exists "le_ver" on social.locais_estoque;
create policy "le_ver" on social.locais_estoque for select to authenticated
using (instituicao_id = social.minha_instituicao() and social.pode('doacoes'));

drop policy if exists "le_criar" on social.locais_estoque;
create policy "le_criar" on social.locais_estoque for insert to authenticated
with check (instituicao_id = social.minha_instituicao() and social.pode('doacoes'));

drop policy if exists "le_editar" on social.locais_estoque;
create policy "le_editar" on social.locais_estoque for update to authenticated
using (instituicao_id = social.minha_instituicao() and social.pode('doacoes'))
with check (instituicao_id = social.minha_instituicao() and social.pode('doacoes'));

drop policy if exists "dob_ver" on social.doacao_observacoes;
create policy "dob_ver" on social.doacao_observacoes for select to authenticated
using (instituicao_id = social.minha_instituicao() and social.pode('doacoes'));

drop policy if exists "dob_criar" on social.doacao_observacoes;
create policy "dob_criar" on social.doacao_observacoes for insert to authenticated
with check (
  instituicao_id = social.minha_instituicao()
  and social.pode('doacoes')
  and exists (
    select 1 from social.doacoes d
    where d.id = doacao_id and d.instituicao_id = social.minha_instituicao()
  )
);

-- Movimentos de estoque são imutáveis: correções entram como novo movimento,
-- preservando autoria, data e hora em vez de reescrever o passado.
drop policy if exists "do_mexer" on social.doacoes;
drop policy if exists "do_criar" on social.doacoes;
create policy "do_criar" on social.doacoes for insert to authenticated
with check (instituicao_id = social.minha_instituicao() and social.pode('doacoes'));

create or replace function social.validar_movimento_estoque()
returns trigger
language plpgsql
security definer
set search_path = social, public
as $$
declare
  v_saldo numeric;
begin
  if new.local_estoque_id is null then
    raise exception 'local de armazenamento é obrigatório';
  end if;
  if not exists (
    select 1 from social.locais_estoque l
    where l.id = new.local_estoque_id and l.instituicao_id = new.instituicao_id and l.ativo
  ) then
    raise exception 'local de armazenamento inválido ou inativo';
  end if;
  new.item := trim(new.item);
  new.unidade_medida := coalesce(nullif(trim(new.unidade_medida), ''), 'unidade');
  if new.quantidade <= 0 then raise exception 'quantidade precisa ser positiva'; end if;
  if new.tipo = 'saida' then
    select coalesce(sum(case when d.tipo = 'entrada' then d.quantidade else -d.quantidade end), 0)
      into v_saldo
    from social.doacoes d
    where d.instituicao_id = new.instituicao_id
      and d.local_estoque_id = new.local_estoque_id
      and lower(trim(d.item)) = lower(new.item)
      and lower(coalesce(nullif(trim(d.unidade_medida), ''), 'unidade')) = lower(new.unidade_medida);
    if v_saldo < new.quantidade then
      raise exception 'saldo insuficiente: disponível % %', v_saldo, new.unidade_medida;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists doacoes_validar_estoque on social.doacoes;
create trigger doacoes_validar_estoque
before insert on social.doacoes
for each row execute function social.validar_movimento_estoque();

drop function if exists social.criar_doacao_completa(uuid,text,text,text,numeric,text,uuid,text,jsonb);
create function social.criar_doacao_completa(
  p_id uuid,
  p_tipo text,
  p_item text,
  p_categoria text,
  p_quantidade numeric,
  p_unidade_medida text,
  p_quem text,
  p_unidade_id uuid,
  p_local_estoque_id uuid,
  p_observacao text,
  p_anexos jsonb
)
returns json
language plpgsql
security definer
set search_path = social, public
as $$
declare
  v_inst uuid;
  v_eu social.equipe;
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_item jsonb;
begin
  v_inst := social.minha_instituicao();
  if v_inst is null then raise exception 'sem instituição vinculada'; end if;
  if not social.pode('doacoes') then raise exception 'sem permissão para lançar doações'; end if;
  v_eu := social.eu();
  if p_tipo not in ('entrada','saida') then raise exception 'tipo precisa ser entrada ou saída'; end if;
  if coalesce(trim(p_item),'') = '' then raise exception 'item é obrigatório'; end if;
  if coalesce(trim(p_quem),'') = '' then raise exception 'quem é obrigatório'; end if;
  if p_unidade_id is not null and not exists (
    select 1 from social.unidades where id = p_unidade_id and instituicao_id = v_inst
  ) then raise exception 'local do movimento não encontrado nesta instituição'; end if;

  insert into social.doacoes (
    id, instituicao_id, tipo, item, categoria, quantidade, unidade_medida,
    quem, unidade_id, local_estoque_id, observacao, registrada_por
  ) values (
    v_id, v_inst, p_tipo, trim(p_item), nullif(trim(coalesce(p_categoria,'')),''),
    coalesce(p_quantidade,1), coalesce(nullif(trim(coalesce(p_unidade_medida,'')),''),'unidade'),
    trim(p_quem), p_unidade_id, p_local_estoque_id,
    nullif(trim(coalesce(p_observacao,'')),''), v_eu.id
  );

  if p_anexos is not null then
    for v_item in select * from jsonb_array_elements(p_anexos) loop
      insert into social.anexos (instituicao_id, doacao_id, tipo, url, nome, criado_por)
      values (v_inst, v_id, v_item->>'tipo', v_item->>'url', v_item->>'nome', v_eu.id);
    end loop;
  end if;
  return json_build_object('id',v_id);
end $$;

revoke all on function social.criar_doacao_completa(uuid,text,text,text,numeric,text,text,uuid,uuid,text,jsonb) from public;
grant execute on function social.criar_doacao_completa(uuid,text,text,text,numeric,text,text,uuid,uuid,text,jsonb) to authenticated;
grant select, insert, update on social.locais_estoque to authenticated;
grant select, insert on social.doacao_observacoes to authenticated;
