alter table social.diretivas add column if not exists audio_url text;
alter table social.diretivas add column if not exists audio_mime text;
alter table social.diretivas add column if not exists audio_duracao_seg integer check(audio_duracao_seg between 1 and 120);
alter table social.diretiva_destinatarios add column if not exists audio_ouvido_em timestamptz;

drop function if exists social.criar_diretiva(text,text,text,text,text);
create function social.criar_diretiva(
  p_titulo text, p_texto text, p_prioridade text, p_destino text,
  p_anexo_url text default null, p_audio_url text default null,
  p_audio_mime text default null, p_audio_duracao_seg integer default null
) returns uuid language plpgsql security definer set search_path=social,public as $$
declare v_id uuid:=gen_random_uuid(); v_eu social.equipe:=social.eu(); v_inst uuid:=social.minha_instituicao();
begin
 if social.meu_papel() not in ('presidente','coordenador','assistente') then raise exception 'sem permissão para publicar orientações'; end if;
 if p_audio_duracao_seg is not null and (p_audio_duracao_seg < 1 or p_audio_duracao_seg > 120) then raise exception 'o áudio deve ter no máximo 2 minutos'; end if;
 insert into social.diretivas(id,instituicao_id,titulo,texto,prioridade,destino,anexo_url,criada_por,audio_url,audio_mime,audio_duracao_seg)
 values(v_id,v_inst,trim(p_titulo),trim(p_texto),p_prioridade,p_destino,p_anexo_url,v_eu.id,p_audio_url,p_audio_mime,p_audio_duracao_seg);
 if p_destino='escala_hoje' then
   insert into social.diretiva_destinatarios(diretiva_id,equipe_id)
   select v_id,e.id from social.equipe e where e.instituicao_id=v_inst and e.ativo and
     (e.id=v_eu.id or exists(select 1 from social.presencas_equipe p where p.equipe_id=e.id and
       (p.entrada at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date));
 else
   insert into social.diretiva_destinatarios(diretiva_id,equipe_id) select v_id,id from social.equipe where instituicao_id=v_inst and ativo;
 end if;
 return v_id;
end $$;

create or replace function social.registrar_audicao_diretiva(p_id uuid) returns timestamptz
language plpgsql security definer set search_path=social,public as $$
declare v_quando timestamptz;
begin
 update social.diretiva_destinatarios set lida_em=coalesce(lida_em,now()), audio_ouvido_em=coalesce(audio_ouvido_em,now())
 where diretiva_id=p_id and equipe_id=(social.eu()).id returning audio_ouvido_em into v_quando;
 if v_quando is null then raise exception 'orientação não destinada a esta pessoa'; end if;
 return v_quando;
end $$;

grant execute on function social.criar_diretiva(text,text,text,text,text,text,text,integer) to authenticated;
grant execute on function social.registrar_audicao_diretiva(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('diretivas-audios','diretivas-audios',false,3145728,array['audio/webm','audio/ogg','audio/mp4','audio/mpeg']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "diretivas_audio_inserir" on storage.objects for insert to authenticated
with check(bucket_id='diretivas-audios' and (storage.foldername(name))[1]=social.minha_instituicao()::text
  and social.meu_papel() in ('presidente','coordenador','assistente'));
create policy "diretivas_audio_ver" on storage.objects for select to authenticated
using(bucket_id='diretivas-audios' and (storage.foldername(name))[1]=social.minha_instituicao()::text);
