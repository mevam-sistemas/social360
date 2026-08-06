# Auditoria dos fundamentos — 6 de agosto de 2026

Escopo: segurança, isolamento, experiência responsiva, acessibilidade, PWA,
notificações, e-mails, versionamento, desempenho e continuidade operacional.

## Evidências verificadas

- O 360social usa o projeto Supabase exclusivo `qimjttthnvmyjeqqopbf`.
- As 29 tabelas do produto possuem RLS ativo; nenhuma função do schema social é
  executável anonimamente.
- Funções privilegiadas têm `search_path` explícito e os endpoints sensíveis
  recusam chamadas sem autenticação.
- Senhas exigem no mínimo 10 caracteres no cliente e no servidor, com proteção
  contra senhas comprometidas habilitada.
- CSP, HSTS, bloqueio de iframe, `nosniff` e política de permissões são enviados
  em produção. A aplicação protegida nasce inerte e invisível à acessibilidade
  até a sessão ser confirmada.
- Login, cadastro e recuperação são modais acessíveis; busca, rodapé e foco de
  teclado seguem os contratos globais de acessibilidade.
- O PWA oferece atualização controlada, push autenticado e versão canônica única.
  E-mails são próprios do 360social.
- O release impõe orçamento aos arquivos críticos e o carregamento de produção
  foi medido sem regressão relevante.
- Backup diário cifrado e teste periódico de restauração são executados pelo
  GitHub Actions, sem tornar dados pessoais públicos.

## Regra de manutenção

Toda mudança de banco deve chegar por migration versionada, manter o isolamento
por instituição e incluir teste de regressão quando alterar autenticação,
prontuários, arquivos, pagamentos ou permissões.
