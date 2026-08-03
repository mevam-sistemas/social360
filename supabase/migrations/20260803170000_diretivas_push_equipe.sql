alter table social.equipe add column if not exists foto_url text;

create table if not exists social.diretivas (
 id uuid primary key default gen_random_uuid(), instituicao_id uuid not null references social.instituicoes(id) on delete cascade,
 titulo text not null check(length(trim(titulo)) between 3 and 100), texto text not null check(length(trim(texto)) between 1 and 300),
 prioridade text not null default 'recomendacao' check(prioridade in ('recomendacao','ordem_dia','urgente')),
 destino text not null default 'todos' check(destino in ('todos','escala_hoje')), anexo_url text,
 criada_por uuid not null references social.equipe(id), criada_em timestamptz not null default now(), ativa boolean not null default true
);
create table if not exists social.diretiva_destinatarios (
 diretiva_id uuid not null references social.diretivas(id) on delete cascade, equipe_id uuid not null references social.equipe(id) on delete cascade,
 lida_em timestamptz, ciente_em timestamptz, primary key(diretiva_id,equipe_id)
);
create table if not exists social.diretiva_comentarios (
 id uuid primary key default gen_random_uuid(), diretiva_id uuid not null references social.diretivas(id) on delete cascade,
 equipe_id uuid not null references social.equipe(id), texto text not null check(length(trim(texto)) between 1 and 500), criada_em timestamptz not null default now()
);
create table if not exists social.push_inscricoes (
 id uuid primary key default gen_random_uuid(), instituicao_id uuid not null references social.instituicoes(id) on delete cascade,
 equipe_id uuid not null references social.equipe(id) on delete cascade, endpoint text not null unique, p256dh text not null, auth text not null,
 agente text, criada_em timestamptz not null default now(), atualizada_em timestamptz not null default now()
);
alter table social.diretivas enable row level security; alter table social.diretiva_destinatarios enable row level security;
alter table social.diretiva_comentarios enable row level security; alter table social.push_inscricoes enable row level security;
create policy "dir_ver" on social.diretivas for select to authenticated using(instituicao_id=social.minha_instituicao() and (criada_por=(social.eu()).id or exists(select 1 from social.diretiva_destinatarios x where x.diretiva_id=id and x.equipe_id=(social.eu()).id)));
create or replace function social.eh_autor_diretiva(p_diretiva uuid) returns boolean language sql stable security definer set search_path=public,social as $$
  select exists(select 1 from social.diretivas where id=p_diretiva and criada_por=(social.eu()).id)
$$;
grant execute on function social.eh_autor_diretiva(uuid) to authenticated;

create policy "dird_ver" on social.diretiva_destinatarios for select to authenticated using(equipe_id=(social.eu()).id or social.eh_autor_diretiva(diretiva_id));
create policy "dirc_ver" on social.diretiva_comentarios for select to authenticated using(exists(select 1 from social.diretivas d where d.id=diretiva_id and (d.criada_por=(social.eu()).id or exists(select 1 from social.diretiva_destinatarios x where x.diretiva_id=d.id and x.equipe_id=(social.eu()).id))));
create policy "push_propria" on social.push_inscricoes for all to authenticated using(equipe_id=(social.eu()).id) with check(instituicao_id=social.minha_instituicao() and equipe_id=(social.eu()).id);

create or replace function social.criar_diretiva(p_titulo text,p_texto text,p_prioridade text,p_destino text,p_anexo_url text default null) returns uuid language plpgsql security definer set search_path=social,public as $$
declare v_id uuid:=gen_random_uuid(); v_eu social.equipe:=social.eu(); v_inst uuid:=social.minha_instituicao();
begin if social.meu_papel() not in ('presidente','coordenador','assistente') then raise exception 'sem permissão para publicar orientações'; end if;
 insert into social.diretivas(id,instituicao_id,titulo,texto,prioridade,destino,anexo_url,criada_por) values(v_id,v_inst,trim(p_titulo),trim(p_texto),p_prioridade,p_destino,p_anexo_url,v_eu.id);
 if p_destino='escala_hoje' then insert into social.diretiva_destinatarios(diretiva_id,equipe_id) select v_id,e.id from social.equipe e where e.instituicao_id=v_inst and e.ativo and (e.id=v_eu.id or exists(select 1 from social.presencas_equipe p where p.equipe_id=e.id and (p.entrada at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date));
 else insert into social.diretiva_destinatarios(diretiva_id,equipe_id) select v_id,id from social.equipe where instituicao_id=v_inst and ativo; end if; return v_id; end $$;
create or replace function social.marcar_diretiva(p_id uuid,p_ciente boolean default false) returns void language plpgsql security definer set search_path=social,public as $$ begin update social.diretiva_destinatarios set lida_em=coalesce(lida_em,now()),ciente_em=case when p_ciente then coalesce(ciente_em,now()) else ciente_em end where diretiva_id=p_id and equipe_id=(social.eu()).id; end $$;
create or replace function social.comentar_diretiva(p_id uuid,p_texto text) returns uuid language plpgsql security definer set search_path=social,public as $$ declare v uuid:=gen_random_uuid(); begin if not exists(select 1 from social.diretivas d where d.id=p_id and (d.criada_por=(social.eu()).id or exists(select 1 from social.diretiva_destinatarios x where x.diretiva_id=p_id and x.equipe_id=(social.eu()).id))) then raise exception 'orientação não encontrada'; end if; insert into social.diretiva_comentarios(id,diretiva_id,equipe_id,texto) values(v,p_id,(social.eu()).id,trim(p_texto)); return v; end $$;
grant execute on function social.criar_diretiva(text,text,text,text,text) to authenticated; grant execute on function social.marcar_diretiva(uuid,boolean) to authenticated; grant execute on function social.comentar_diretiva(uuid,text) to authenticated;
grant select on social.diretivas,social.diretiva_destinatarios,social.diretiva_comentarios to authenticated; grant select,insert,update,delete on social.push_inscricoes to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('diretivas','diretivas',false,245760,array['image/webp']::text[]),('fotos-equipe','fotos-equipe',false,245760,array['image/webp']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "diretivas_img" on storage.objects for insert to authenticated with check(bucket_id='diretivas' and (storage.foldername(name))[1]=social.minha_instituicao()::text and social.meu_papel() in ('presidente','coordenador','assistente'));
create policy "diretivas_img_ver" on storage.objects for select to authenticated using(bucket_id='diretivas' and (storage.foldername(name))[1]=social.minha_instituicao()::text);
create policy "equipe_foto" on storage.objects for insert to authenticated with check(bucket_id='fotos-equipe' and (storage.foldername(name))[1]=social.minha_instituicao()::text and social.pode('gerir_equipe'));
create policy "equipe_foto_ver" on storage.objects for select to authenticated using(bucket_id='fotos-equipe' and (storage.foldername(name))[1]=social.minha_instituicao()::text);
