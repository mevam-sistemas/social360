# Registro de implantações e incidentes

Este documento registra mudanças relevantes, evidências de validação e pendências humanas. Segredos, tokens e links temporários de autenticação nunca devem ser registrados aqui.

## 2026-08-04 — custódia central do banco compartilhado

- Identificado que Modox, 360social e CT360 usam o mesmo projeto Supabase em schemas separados.
- As migrações passaram a ter fonte canônica única em `mevam-sistemas/ct360`.
- Quinze versões aplicadas manualmente foram verificadas por objetos reais e registradas como
  aplicadas, sem executar novamente SQL ou alterar dados.
- Resultado: 44 migrações locais e remotas alinhadas e verificáveis por comando automatizado.

## 2026-08-04 — versão 1.4.1

### Transparência dos envios e verificações de release

- O endereço técnico de envio deixou de ser um campo fictício editável na interface.
- Automações ainda não implantadas aparecem desabilitadas e identificadas como planejadas.
- O release ganhou verificação automática de versão, PWA, fluxos de autenticação, recursos críticos e exposição de credenciais.
- Backups independentes concluídos nas execuções [30865796732](https://github.com/mevam-sistemas/social360/actions/runs/30865796732) e [30883014954](https://github.com/mevam-sistemas/social360/actions/runs/30883014954).
- Restauração conjunta de Modox e 360social comprovada na execução [30861809522](https://github.com/mevam-sistemas/social360/actions/runs/30861809522).

## 2026-08-04 — versão 1.3.0

### Versão única e atualização do PWA

- Rodapé, cache do PWA e aviso de atualização passaram a usar a fonte canônica em `web/sw.js`.
- O número fixo `v1.2.1` foi removido do HTML.
- Uma mudança futura de versão exige alteração em um único arquivo publicado.

## 2026-08-03 — versão 1.2.1

### Recuperação de acesso e separação do Modox

- Ocorrência: a recuperação de `edsonlapa@gmail.com`, presidente do Instituto SOS Vida já cadastrado, chegou ao fluxo do Modox.
- Causa: 360social e Modox compartilham o projeto de autenticação; o endereço padrão pertence à PlataformaX/Modox e a variação solicitada pelo 360social não estava integralmente contemplada na lista de redirecionamentos.
- Correção: autorização de `https://app.360social.com.br/**` no Supabase e uso do domínio exato nos fluxos de recuperação, cadastro e convite.
- Validação: recuperação executada com conta controlada; o link recebido terminou em `app.360social.com.br` e abriu a tela “Escolher nova senha”. Nenhuma senha de teste foi alterada.
- Situação do Edson: acesso presidencial confirmado pelo responsável da instituição após a correção.

### Convites e vínculos da equipe

- A função `convidar-equipe` foi publicada no Supabase e está ativa.
- Somente usuário autenticado com permissão `gerir_equipe` pode convidar ou vincular contas.
- O integrante deve estar ativo, ter acesso habilitado e pertencer à mesma instituição do solicitante.
- Contas existentes são vinculadas à ficha da equipe; não é criada outra instituição.
- E-mail já vinculado a outra ficha é recusado.
- Convites retornam exclusivamente para `https://app.360social.com.br`.
- Teste externo sem autenticação: HTTP 401.
- Código e interface incorporados no PR [#22](https://github.com/mevam-sistemas/social360/pull/22), versão pública 1.2.1.

### Backup e restauração

- Backup independente diário do PostgreSQL e Storage permanece ativo, cifrado e armazenado no Cloudflare R2.
- Foi implantado o workflow `Teste de restauração`, manual e trimestral.
- Ensaio concluído em PostgreSQL 17 descartável: download, decifragem, checksums, estrutura, dados, chaves e políticas do esquema `social` aprovados.
- A produção não foi alterada durante o ensaio.
- Evidência: [execução 30860131607](https://github.com/mevam-sistemas/social360/actions/runs/30860131607).
- Implantação e ajustes: PRs [#23](https://github.com/mevam-sistemas/social360/pull/23), [#24](https://github.com/mevam-sistemas/social360/pull/24), [#25](https://github.com/mevam-sistemas/social360/pull/25), [#26](https://github.com/mevam-sistemas/social360/pull/26), [#27](https://github.com/mevam-sistemas/social360/pull/27) e [#28](https://github.com/mevam-sistemas/social360/pull/28).

## Padrão reutilizável para outros produtos

Antes de aplicar estas melhorias ao Modox ou a outro produto:

1. Mapear quais serviços e projetos são compartilhados, especialmente Supabase Auth.
2. Configurar e testar domínios e rotas de retorno específicos de cada produto.
3. Testar e-mail e link completos com conta controlada antes de envolver cliente real.
4. Manter autorização no servidor e RLS; esconder botões não é segurança.
5. Versionar a implantação e usar PR com verificações obrigatórias.
6. Manter backup externo cifrado de banco e arquivos.
7. Executar restauração em ambiente descartável e guardar a evidência.
8. Registrar incidentes, causa, correção, validação e pendências sem expor segredos.
