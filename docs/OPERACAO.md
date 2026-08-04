# Operação segura do 360social

## Versionamento

- `MAIOR`: mudança incompatível ou grande reformulação.
- `MENOR`: funcionalidade nova compatível.
- `CORREÇÃO`: correção sem nova funcionalidade.
- Toda mudança publicada deve atualizar `SOCIAL360_VERSION` em `web/sw.js` e `CHANGELOG.md`.
- O rodapé lê a versão diretamente de `web/sw.js`, a mesma fonte usada pelo cache do PWA.
- A versão deve receber uma tag Git, por exemplo `v1.1.0`.

## Fluxo de publicação recomendado

1. Criar uma branch curta a partir de `main`.
2. Abrir pull request e executar validações automáticas.
3. Publicar a branch em ambiente de prévia do Cloudflare.
4. Aplicar e testar migrações em um projeto Supabase de homologação.
5. Criar backup lógico cifrado do banco e cópia externa dos objetos do Storage.
6. Obter aprovação funcional da prévia.
7. Fazer merge em `main` e promover manualmente para produção.
8. Executar testes rápidos de login, cadastro, upload e permissões.
9. Criar a tag da versão e registrar o horário da implantação.

Hoje o Cloudflare publica `main` diretamente. Para separar homologação e produção, configure `main` como preview e uma branch protegida `production` como branch de produção.

## Backups

- O plano Pro do Supabase mantém backups diários do banco por sete dias.
- O backup do banco não inclui arquivos do Storage.
- O workflow `Backup independente` executa diariamente às 00h30 de Brasília e também pode ser iniciado manualmente.
- O arquivo contém `pg_dump`, todos os buckets do Storage, manifesto de conteúdo e checksums SHA-256.
- O pacote é comprimido e cifrado com `age` antes de ser enviado ao bucket privado no Cloudflare R2.
- Política gratuita inicial: 7 diários, 4 semanais e 6 mensais. A retenção deve ser ampliada quando houver orçamento ou obrigação regulatória.
- O workflow `Teste de restauração` roda trimestralmente e também manualmente: baixa o backup mais recente, valida todos os checksums e restaura os esquemas `public` (MODOX) e `social` em PostgreSQL descartável, sem tocar na produção.
- Backup sem teste de restauração bem-sucedido não é evidência de recuperação.
- Definir RPO de 24 horas com backup diário ou habilitar PITR para reduzir o RPO.

### Segredos da automação

Os valores ficam somente em **GitHub → Settings → Secrets and variables → Actions**:

- `SUPABASE_DB_URL`: conexão direta/pooler com permissão de exportação.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: leitura administrativa dos buckets.
- `BACKUP_PASSPHRASE`: frase longa e exclusiva para cifrar os pacotes.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` e `R2_BUCKET`: destino privado e independente.

Nunca registrar esses valores em issue, commit, log ou documentação. A frase de restauração deve ter uma segunda cópia em cofre de senhas controlado pela direção.

### Restauração

1. Baixar o arquivo `.tar.zst.age` do bucket privado.
2. Decifrar: `AGE_PASSPHRASE='...' age --decrypt --output backup.tar.zst arquivo.age`.
3. Extrair: `zstd --decompress --stdout backup.tar.zst | tar --extract`.
4. Validar `SHA256SUMS` antes de restaurar.
5. Restaurar primeiro em um projeto Supabase isolado de homologação usando `pg_restore`; nunca testar diretamente em produção.
6. Recriar os buckets e enviar os objetos preservando os caminhos registrados.

Faça um ensaio trimestral e registre duração, responsável e resultado. A credencial `service_role` e a senha do banco devem ser rotacionadas se aparecerem em qualquer log ou arquivo não cifrado.

## Antes de cada implantação

- Verificar migrações reversíveis ou preparar procedimento de correção progressiva.
- Nunca remover coluna/tabela no mesmo release que deixa de usá-la; usar duas versões.
- Conferir políticas RLS, Storage privado e funções `security definer` com `search_path` fixado.
- Monitorar erros, latência, tamanho do banco, armazenamento e egress após a publicação.
