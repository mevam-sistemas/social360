-- Cadastro flexível: somente o nome continua obrigatório.
alter table social.pessoas
  add column if not exists rg text,
  add column if not exists rg_orgao text,
  add column if not exists rg_uf text,
  add column if not exists sem_documentos boolean not null default false,
  add column if not exists situacao_rua boolean,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists referencia_endereco text;

-- Fotos de pessoas são sensíveis: o bucket já é privado. As políticas antigas
-- permitiam escrita sem conferir a instituição e leitura por qualquer equipe.
drop policy if exists "fotos_read" on storage.objects;
drop policy if exists "fotos_write" on storage.objects;
drop policy if exists "fotos_pessoa_ler" on storage.objects;
create policy "fotos_pessoa_ler" on storage.objects for select to authenticated
using (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = social.minha_instituicao()::text
  and social.pode('buscar_pessoa')
);

drop policy if exists "fotos_pessoa_criar" on storage.objects;
create policy "fotos_pessoa_criar" on storage.objects for insert to authenticated
with check (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = social.minha_instituicao()::text
  and (social.pode('criar_pessoa') or social.pode('editar_pessoa'))
);

drop policy if exists "fotos_pessoa_atualizar" on storage.objects;
create policy "fotos_pessoa_atualizar" on storage.objects for update to authenticated
using (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = social.minha_instituicao()::text
  and social.pode('editar_pessoa')
)
with check (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = social.minha_instituicao()::text
  and social.pode('editar_pessoa')
);

drop policy if exists "fotos_pessoa_remover" on storage.objects;
create policy "fotos_pessoa_remover" on storage.objects for delete to authenticated
using (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1] = social.minha_instituicao()::text
  and social.pode('editar_pessoa')
);

update storage.buckets set
  public = false,
  file_size_limit = 524288,
  allowed_mime_types = array['image/webp']::text[]
where id = 'fotos';
