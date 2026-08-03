-- Logotipos ficam no Storage; a tabela social.instituicoes guarda só a URL pública.
-- O limite também existe no cliente para feedback rápido, mas o banco é a
-- autoridade final: nenhum upload acima de 120 KB entra no bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos-instituicoes', 'logos-instituicoes', true, 122880, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "logos_instituicao_ler" on storage.objects;
create policy "logos_instituicao_ler"
on storage.objects for select to authenticated
using (
  bucket_id = 'logos-instituicoes'
  and (storage.foldername(name))[1] = social.minha_instituicao()::text
);

drop policy if exists "logos_instituicao_criar" on storage.objects;
create policy "logos_instituicao_criar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'logos-instituicoes'
  and (storage.foldername(name))[1] = social.minha_instituicao()::text
  and social.pode('config_org')
);

drop policy if exists "logos_instituicao_atualizar" on storage.objects;
create policy "logos_instituicao_atualizar"
on storage.objects for update to authenticated
using (
  bucket_id = 'logos-instituicoes'
  and (storage.foldername(name))[1] = social.minha_instituicao()::text
  and social.pode('config_org')
)
with check (
  bucket_id = 'logos-instituicoes'
  and (storage.foldername(name))[1] = social.minha_instituicao()::text
  and social.pode('config_org')
);

drop policy if exists "logos_instituicao_remover" on storage.objects;
create policy "logos_instituicao_remover"
on storage.objects for delete to authenticated
using (
  bucket_id = 'logos-instituicoes'
  and (storage.foldername(name))[1] = social.minha_instituicao()::text
  and social.pode('config_org')
);
