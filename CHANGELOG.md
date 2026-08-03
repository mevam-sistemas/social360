# Histórico de versões

Este projeto usa versionamento semântico: `MAIOR.MENOR.CORREÇÃO`.

## 1.1.1 — 2026-08-03

- Backup independente diário e manual do PostgreSQL e do Supabase Storage.
- Pacote compactado e cifrado antes do envio ao bucket privado Cloudflare R2.
- Retenção automática de 7 cópias diárias, 4 semanais e 6 mensais.
- Usuário PostgreSQL somente leitura e credencial R2 limitada a um único bucket.
- Procedimento documentado de verificação e restauração trimestral.

## 1.1.0 — 2026-08-03

- Navegação “Voltar” consistente, com descarte de rascunhos e mídias não publicados.
- Gravação de áudio nas orientações e histórico individual de audição.
- Fotos privadas de integrantes da equipe.
- Melhorias de foco, alvos de toque, movimento reduzido e textos alternativos.
- Senha mínima de 10 caracteres nos novos cadastros e redefinições.

## 1.0.0 — 2026-08-03

- Primeira versão operacional do portal SaaS em produção.
- Cadastro de pessoas, atendimentos, presença, doações, relatórios e administração institucional.
- PWA instalável com atualização controlada.
