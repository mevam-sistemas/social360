alter table social.anexos add column if not exists descricao text,
  add column if not exists categoria text;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('documentos-pessoas','documentos-pessoas',false,5242880,
  array['image/webp','application/pdf']::text[])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "documentos_pessoa_ler" on storage.objects;
create policy "documentos_pessoa_ler" on storage.objects for select to authenticated
using (
  bucket_id='documentos-pessoas'
  and (storage.foldername(name))[1]=social.minha_instituicao()::text
  and social.pode('buscar_pessoa')
);

drop policy if exists "documentos_pessoa_criar" on storage.objects;
create policy "documentos_pessoa_criar" on storage.objects for insert to authenticated
with check (
  bucket_id='documentos-pessoas'
  and (storage.foldername(name))[1]=social.minha_instituicao()::text
  and (social.pode('criar_pessoa') or social.pode('editar_pessoa'))
);

drop policy if exists "documentos_pessoa_remover" on storage.objects;
create policy "documentos_pessoa_remover" on storage.objects for delete to authenticated
using (
  bucket_id='documentos-pessoas'
  and (storage.foldername(name))[1]=social.minha_instituicao()::text
  and social.pode('editar_pessoa')
);

drop policy if exists "ax_pessoa_criar" on social.anexos;
create policy "ax_pessoa_criar" on social.anexos for insert to authenticated
with check (
  instituicao_id=social.minha_instituicao()
  and pessoa_id is not null and atendimento_id is null and doacao_id is null
  and (social.pode('criar_pessoa') or social.pode('editar_pessoa'))
);

drop policy if exists "ax_pessoa_ver" on social.anexos;
create policy "ax_pessoa_ver" on social.anexos for select to authenticated
using (
  instituicao_id=social.minha_instituicao()
  and pessoa_id is not null and atendimento_id is null and doacao_id is null
  and social.pode('buscar_pessoa')
);
