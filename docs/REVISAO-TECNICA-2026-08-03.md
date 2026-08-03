# Revisão técnica do 360social — 03/08/2026

## Resumo executivo

O portal está adequado para piloto e início de operação comercial, com isolamento por instituição no banco, Storage privado e cabeçalhos de segurança. Ainda não deve receber uma promessa contratual de capacidade ou disponibilidade sem ambiente de homologação, monitoramento, teste de carga e restauração completa testada.

## Experiência e acessibilidade

Implementado nesta revisão:

- botão global **Voltar**, incluindo formulários internos de instituição e doações;
- descarte de áudio, imagem, anexos e valores ainda não publicados ao voltar;
- microfone circular com nome acessível;
- alvos principais de toque com pelo menos 44 px;
- foco visível para teclado;
- respeito a `prefers-reduced-motion`;
- textos alternativos em logotipos, fotos da equipe e imagens de orientações.

Próximas melhorias recomendadas:

- substituir `prompt()` e `alert()` por diálogos acessíveis;
- retirar estilos e eventos inline para consolidar o design system e endurecer a CSP;
- testar manualmente com VoiceOver/TalkBack e zoom de 200%;
- evitar textos justificados em blocos curtos no celular, pois os espaços irregulares prejudicam a leitura.

## Desempenho

Situação atual:

- o cliente web estático tem aproximadamente 550 KB antes de compressão, contando HTML, ponte do banco e biblioteca Supabase;
- o aplicativo carrega diversas tabelas completas da instituição após o login;
- filtros e relatórios são processados no navegador;
- o arquivo HTML concentra interface, estilos, dados de demonstração e regras de apresentação.

Risco principal: o carregamento integral funciona no volume atual, mas cresce linearmente com pessoas, atendimentos, doações e anexos de cada instituição. Antes de clientes com dezenas de milhares de registros, implementar paginação, consultas agregadas no servidor e carregamento sob demanda.

## Segurança

Verificações realizadas no banco de produção:

- 27 tabelas no schema `social`;
- nenhuma tabela `social` sem RLS;
- 52 políticas RLS no schema `social`;
- 22 políticas no Storage;
- nenhuma função `security definer` do schema `social` sem `search_path` fixado;
- chave do navegador é publicável; chave de serviço permanece apenas no ambiente servidor;
- arquivos de pessoas, equipe, instituições, diretivas e áudios usam buckets privados.

Melhorias implementadas:

- senha mínima de 10 caracteres para novos cadastros e redefinições;
- `Permissions-Policy` restritiva, liberando câmera e microfone somente para o próprio portal;
- CSP, HSTS, proteção contra iframe, `nosniff` e política de referenciador já ativas.

Pendências prioritárias:

1. ativar proteção contra senhas vazadas e MFA para presidência/coordenação no Supabase;
2. remover `'unsafe-inline'` da CSP após modularizar eventos e estilos;
3. contratar monitoramento de erros e alertas de disponibilidade sem registrar dados sensíveis;
4. executar teste automatizado de isolamento entre duas instituições antes de cada release;
5. revisar trimestralmente concessões, políticas RLS e acessos administrativos.

## Cookies, armazenamento e LGPD

O código não instala analytics, publicidade, pixels nem cookies não necessários. O Supabase guarda a sessão de autenticação no armazenamento local; o service worker guarda somente arquivos públicos da interface; notificações push exigem ação explícita do usuário.

Não foi criado bloqueio obrigatório por “aceite de cookies”. A ANPD orienta que consentimento não é a base apropriada para tecnologia estritamente necessária e desaconselha condicionar o acesso ao aceite sem alternativa real. O passo correto é publicar aviso de privacidade, termos de uso e política de retenção com a identidade jurídica do controlador, encarregado/canal de direitos, finalidades, bases legais, compartilhamentos e prazos. Esses textos devem ser aprovados por assessoria jurídica antes de virarem aceite contratual.

## Capacidade

Medição em 03/08/2026:

- banco: 16.641.171 bytes (~15,9 MiB);
- aproximadamente 200 linhas de negócio;
- 8 usuários de autenticação;
- 4 objetos no Storage, somando 251.389 bytes;
- 14 conexões ao banco no instante da medição.

Limites incluídos no Supabase Pro, sujeitos ao plano e cobrança vigentes:

- 100 mil usuários ativos mensais;
- 500 conexões Realtime simultâneas incluídas;
- 8 GB de disco por projeto incluídos, com expansão paga;
- 100 GB de Storage incluídos;
- 250 GB de egress incluídos;
- 2 milhões de invocações de Edge Functions incluídas.

Esses limites não equivalem a capacidade garantida do aplicativo. Sem teste de carga, a recomendação comercial conservadora é operar inicialmente até **50 instituições, 500 integrantes cadastrados e 100 usuários simultâneos**, monitorando latência e consumo. É uma faixa de piloto, não um limite técnico definitivo. A infraestrutura pode crescer muito além disso, mas o carregamento integral por instituição precisa ser paginado antes.

## Backup e continuidade

- Supabase Pro: backup diário do banco com retenção de sete dias.
- Os backups do banco não incluem objetos do Storage.
- Necessário adicionar cópia externa cifrada de todos os buckets e `pg_dump` cifrado.
- Meta inicial recomendada: RPO 24 h e RTO 4 h; para RPO menor, avaliar PITR.
- A restauração deve ser testada trimestralmente em ambiente isolado.
- Produção deve usar branch protegida e promoção manual após homologação; `main` não deve continuar publicando diretamente sem aprovação.

## Fontes técnicas

- ANPD — Guia de Cookies e Proteção de Dados Pessoais: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf
- LGPD — Lei 13.709/2018: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- Supabase — RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase — Backups: https://supabase.com/docs/guides/platform/backups
- Supabase — Billing e cotas: https://supabase.com/docs/guides/platform/billing-on-supabase
- Cloudflare Pages — Limites: https://developers.cloudflare.com/pages/platform/limits/
