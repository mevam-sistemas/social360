# Operação segura do 360social

## Versionamento

- `MAIOR`: mudança incompatível ou grande reformulação.
- `MENOR`: funcionalidade nova compatível.
- `CORREÇÃO`: correção sem nova funcionalidade.
- Toda mudança publicada deve atualizar `VERSION` e `CHANGELOG.md`.
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
- Manter, além do backup gerenciado, um `pg_dump` cifrado e uma cópia cifrada dos buckets em provedor ou conta independente.
- Política inicial: diário por 30 dias, semanal por 12 semanas e mensal por 12 meses.
- Testar restauração trimestralmente; backup sem teste de restauração não é evidência de recuperação.
- Definir RPO de 24 horas com backup diário ou habilitar PITR para reduzir o RPO.

## Antes de cada implantação

- Verificar migrações reversíveis ou preparar procedimento de correção progressiva.
- Nunca remover coluna/tabela no mesmo release que deixa de usá-la; usar duas versões.
- Conferir políticas RLS, Storage privado e funções `security definer` com `search_path` fixado.
- Monitorar erros, latência, tamanho do banco, armazenamento e egress após a publicação.
