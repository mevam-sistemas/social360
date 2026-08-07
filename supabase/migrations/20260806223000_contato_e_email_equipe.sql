-- Contato operacional da equipe e trilha da sincronização com Supabase Auth.
alter table social.equipe add column if not exists telefone text;

create table if not exists social.equipe_email_alteracoes (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid not null references social.instituicoes(id),
  equipe_id uuid not null references social.equipe(id),
  email_anterior text not null,
  email_novo text not null,
  solicitada_por uuid not null references social.equipe(id),
  solicitada_em timestamptz not null default now(),
  concluida_em timestamptz,
  status text not null check (status in ('iniciada','concluida','revertida','falhou')),
  detalhe text
);

create index if not exists equipe_email_alteracoes_instituicao_idx
  on social.equipe_email_alteracoes(instituicao_id, solicitada_em desc);

alter table social.equipe_email_alteracoes enable row level security;
drop policy if exists equipe_email_alteracoes_ver on social.equipe_email_alteracoes;
create policy equipe_email_alteracoes_ver on social.equipe_email_alteracoes
for select to authenticated using (
  instituicao_id = social.minha_instituicao() and social.pode('gerir_equipe')
);

grant select on social.equipe_email_alteracoes to authenticated;
revoke insert, update, delete on social.equipe_email_alteracoes from public, anon, authenticated;

create table if not exists social.equipe_exportacoes (
  id uuid primary key default gen_random_uuid(),
  instituicao_id uuid not null references social.instituicoes(id),
  exportada_por uuid not null references social.equipe(id),
  exportada_em timestamptz not null default now(),
  formato text not null default 'pdf' check (formato='pdf'),
  total_registros integer not null check (total_registros>=0)
);
alter table social.equipe_exportacoes enable row level security;
drop policy if exists equipe_exportacoes_ver on social.equipe_exportacoes;
create policy equipe_exportacoes_ver on social.equipe_exportacoes for select to authenticated
using (instituicao_id=social.minha_instituicao() and social.pode('gerir_equipe'));
drop policy if exists equipe_exportacoes_criar on social.equipe_exportacoes;
create policy equipe_exportacoes_criar on social.equipe_exportacoes for insert to authenticated
with check (
  instituicao_id=social.minha_instituicao()
  and exportada_por=(social.eu()).id
  and social.pode('gerir_equipe')
);
grant select,insert on social.equipe_exportacoes to authenticated;
revoke update,delete on social.equipe_exportacoes from public,anon,authenticated;
