# Governança do Supabase compartilhado

O schema `social` convive com o Modox (`public`) e o CT360 (`ct360`). O repositório
`mevam-sistemas/ct360` passou a custodiar a linha do tempo completa das migrações dos três produtos.

Em 4 de agosto de 2026, cada mudança do 360social já existente foi comprovada no banco e registrada
no histórico remoto, sem reexecutar SQL. As 44 versões agora estão alinhadas.

Para uma alteração futura:

1. criar o arquivo em `mevam-sistemas/ct360/supabase/migrations`;
2. qualificar todas as referências com `social.`, `storage.` ou o schema correto;
3. revisar RLS, grants e funções `security definer`;
4. executar `npm run db:verify` antes e depois;
5. registrar a versão do 360social que passou a depender da migração.

Não usar `migration repair` sem prova material e nunca aplicar SQL pelo Dashboard.
